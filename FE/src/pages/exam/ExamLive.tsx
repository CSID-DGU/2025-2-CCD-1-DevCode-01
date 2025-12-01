import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Spinner from "src/components/common/Spinner";
import api from "@apis/instance";

import {
  endExam,
  type ExamResultResponse,
  type ExamQuestion,
  type ExamItem,
  fetchExamItemTTS,
} from "@apis/exam/exam.api";
import { useTtsTextBuilder } from "src/hooks/useTtsTextBuilder";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";
import { useLocalTTS } from "src/hooks/useLocalTTS";

import * as S from "./ExamLive.styles";
import { readFontPct } from "@pages/class/pre/ally";

const ExamTake = () => {
  const navigate = useNavigate();

  const [exam, setExam] = useState<ExamResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"detail" | "page">("detail");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 서버 TTS (mp3)
  const { soundRate, soundVoice } = useSoundOptions();

  // 로컬 Web Speech TTS (안내 / 전체 듣기)
  const { speak, stop } = useLocalTTS();

  // 서버 TTS 오디오
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // item별 TTS 캐시
  const [ttsMap, setTtsMap] = useState<
    Record<string, { female?: string; male?: string }>
  >({});
  const [ttsLoadingKey, setTtsLoadingKey] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // 문제 전체 듣기 상태
  const [isWholeReading, setIsWholeReading] = useState(false);
  const isWholeReadingRef = useRef(false);

  const makeKey = (qNo: number, idx: number) => `${qNo}-${idx}`;

  const [fontPct, setFontPct] = useState(() => readFontPct());

  useEffect(() => {
    const handleFontChange = () => {
      setFontPct(readFontPct());
    };

    window.addEventListener("a11y-font-change", handleFontChange);
    return () =>
      window.removeEventListener("a11y-font-change", handleFontChange);
  }, []);

  // 배율에 따라 레이아웃 모드 결정
  const layoutMode: "normal" | "compact" | "stack" = useMemo(() => {
    if (fontPct >= 175) return "stack"; // 175~300% -> 세로 스택
    if (fontPct >= 150) return "compact"; // 150~200% -> 좁은 2열
    return "normal"; // 그 외 -> 기본 2열
  }, [fontPct]);

  /* ---------- 공통: 로컬 안내 음성 ---------- */
  const announce = (text: string) => {
    if (!text) return;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // ignore
      }
      setPlayingKey(null);
    }
    stop();
    speak(text);
  };

  useEffect(() => {
    return () => {
      stop();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          // ignore
        }
      }
    };
  }, [stop]);

  /* ---------- 1) 페이지 진입 시마다 /exam/result/ 호출 ---------- */
  useEffect(() => {
    let cancelled = false;

    const loadExam = async () => {
      setLoading(true);
      try {
        const res = await api.get<ExamResultResponse>("/exam/result/");

        if (cancelled) return;

        const data = res.data;

        if (!data || !data.questions || data.questions.length === 0) {
          console.warn("[ExamTake] 응답이 없거나 questions가 비어 있습니다.");
        } else {
          setExam(data);
        }
        setCurrentIndex(0);
        setViewMode("detail");
      } catch (e: unknown) {
        const err = e as { response?: { status?: number } };

        if (err.response?.status === 403) {
          console.info(
            "[ExamTake] /exam/result/ 403 → 시험 종료, /exam으로 이동"
          );
          if (!cancelled) {
            navigate("/exam", { replace: true });
          }
          return;
        }

        console.error("[ExamTake] /exam/result/ 호출 실패:", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadExam();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  /* ---------- 2) 문제 정렬 / 현재 문제 / 종료 시각 ---------- */
  const questions: ExamQuestion[] = useMemo(() => {
    if (!exam) return [];
    return [...exam.questions].sort(
      (a, b) => a.questionNumber - b.questionNumber
    );
  }, [exam]);

  const currentQuestion: ExamQuestion | null = questions[currentIndex] ?? null;

  const endTimeText = useMemo(() => {
    if (!exam?.endTime) return null;
    const d = new Date(exam.endTime);
    if (Number.isNaN(d.getTime())) return exam.endTime;
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [exam]);

  const isFirst = currentIndex === 0;
  const isLast = questions.length > 0 && currentIndex === questions.length - 1;

  /* ---------- 3) 서버 TTS: item 개별 듣기 ---------- */
  const handlePlayItemTTS = async (
    questionNumber: number,
    itemIndex: number,
    rawText?: string | null
  ) => {
    const key = makeKey(questionNumber, itemIndex);

    if (isWholeReadingRef.current) {
      isWholeReadingRef.current = false;
      setIsWholeReading(false);
      stop();
    }

    stop();

    if (playingKey === key && audioRef.current) {
      if (!audioRef.current.paused) {
        audioRef.current.pause();
        setPlayingKey(null);
        return;
      }
    }

    let tts = ttsMap[key];

    if (!tts) {
      if (!rawText) {
        alert("텍스트가 없어 음성을 생성할 수 없습니다.");
        return;
      }

      let finalText = rawText;
      try {
        // 🔥 OCR 세그먼트 → 코드/수식 변환 포함 전처리
        finalText = await buildTtsText(rawText);
      } catch (err) {
        console.error("[ExamTake] buildTtsText 실패, 원본 텍스트로 진행:", err);
      }

      try {
        setTtsLoadingKey(key);

        // 🔥 text를 body에 담아서 보내기
        const res = await fetchExamItemTTS(
          questionNumber,
          itemIndex,
          finalText
        );

        setTtsLoadingKey(null);

        if (!res || !res.tts) {
          console.error("[ExamTake] TTS 응답 없음:", res);
          alert("음성을 불러오지 못했습니다.");
          return;
        }

        tts = res.tts;
        setTtsMap((prev) => ({
          ...prev,
          [key]: res.tts,
        }));
      } catch (err) {
        console.error("[ExamTake] TTS 요청 실패:", err);
        setTtsLoadingKey(null);
        alert("음성을 불러오지 못했습니다.");
        return;
      }
    }

    const url =
      soundVoice === "남성" ? tts.male ?? tts.female : tts.female ?? tts.male;

    if (!url) {
      alert("재생할 음성 파일이 없습니다.");
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    try {
      audio.pause();
      audio.src = url;
      applyPlaybackRate(audio, soundRate);
      await audio.play();
      setPlayingKey(key);

      audio.onended = () => {
        setPlayingKey((prev) => (prev === key ? null : prev));
      };
    } catch (err) {
      console.error("[ExamTake] 오디오 재생 실패:", err);
      alert("음성을 재생할 수 없습니다.");
    }
  };

  /* ---------- 4) 네비게이션 / 보기모드 / 종료 ---------- */

  const resetAllTTS = () => {
    isWholeReadingRef.current = false;
    setIsWholeReading(false);
    stop();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // ignore
      }
      setPlayingKey(null);
    }
  };

  const handleClickThumbnail = (index: number) => {
    setCurrentIndex(index);
    setViewMode("detail");
    resetAllTTS();
  };

  const handlePrev = () => {
    if (isFirst) return;
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setViewMode("detail");
    resetAllTTS();
  };

  const handleNext = () => {
    if (isLast) return;
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
    setViewMode("detail");
    resetAllTTS();
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === "detail" ? "page" : "detail"));
  };

  const handleEndExam = async () => {
    setLoading(true);
    resetAllTTS();

    const ok = await endExam();
    setLoading(false);

    if (!ok) {
      alert("시험 종료에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    navigate("/exam", { replace: true });
  };

  /* ---------- 5) 문제 전체 듣기 (로컬 TTS로 한 번에) ---------- */

  const { buildTtsText } = useTtsTextBuilder();

  const handlePlayWholeQuestion = async () => {
    if (!currentQuestion || !exam) return;

    if (isWholeReadingRef.current) {
      isWholeReadingRef.current = false;
      setIsWholeReading(false);
      stop();
      return;
    }

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // ignore
      }
      setPlayingKey(null);
    }

    isWholeReadingRef.current = true;
    setIsWholeReading(true);

    try {
      const parts: string[] = [];

      for (const item of currentQuestion.items) {
        if (!item.displayText) continue;

        if (item.kind === "chart" || item.kind === "table") {
          parts.push(item.displayText);
        } else {
          try {
            const processed = await buildTtsText(item.displayText);
            parts.push(processed);
          } catch {
            parts.push(item.displayText);
          }
        }
      }

      const fullText = parts.join("\n\n");

      if (!isWholeReadingRef.current) return;

      stop();
      speak(fullText);
    } finally {
      //ignore
    }
  };

  /* ---------- 6) 로딩 / 빈 상태 ---------- */

  if (loading && !exam) {
    return (
      <S.FullPageCenter>
        <Spinner />
      </S.FullPageCenter>
    );
  }

  return (
    <S.PageContainer>
      {loading && (
        <S.Overlay>
          <Spinner />
        </S.Overlay>
      )}

      {/* 상단 툴바 */}
      <S.Toolbar>
        <S.ToolbarLeft>
          {currentQuestion && (
            <S.ToolbarTitle>
              문제 {currentQuestion.questionNumber}
            </S.ToolbarTitle>
          )}
          {endTimeText && (
            <S.ToolbarInfo>시험 종료 시각: {endTimeText}</S.ToolbarInfo>
          )}
        </S.ToolbarLeft>

        <S.ToolbarRight>
          {/* 보기 모드 토글 */}
          <S.ToolbarButton
            type="button"
            onClick={handleToggleViewMode}
            aria-pressed={viewMode === "page"}
            aria-label={
              viewMode === "detail"
                ? "현재 텍스트 모드입니다. 시험지 전체 페이지 보기로 전환"
                : "현재 시험지 전체 페이지 모드입니다. 텍스트로 보기로 전환"
            }
            onFocus={() => {
              announce(
                viewMode === "detail"
                  ? "시험지 전체 페이지 보기 버튼입니다. 현재는 텍스트 모드입니다."
                  : "텍스트로 보기 버튼입니다. 현재는 시험지 전체 페이지 모드입니다."
              );
            }}
          >
            {viewMode === "detail" ? "시험지 원본 사진 보기" : "텍스트로 보기"}
          </S.ToolbarButton>

          {/* 현재 문제 전체 듣기 */}
          <S.ToolbarButton
            type="button"
            onClick={handlePlayWholeQuestion}
            aria-pressed={isWholeReading}
            aria-label={
              isWholeReading
                ? "현재 문제 전체 듣기 정지"
                : "현재 문제의 모든 내용을 순서대로 듣기"
            }
            onFocus={() => {
              announce(
                isWholeReading
                  ? "문제 전체 듣기 정지 버튼입니다."
                  : "문제 전체 듣기 버튼입니다. 누르면 이 문제의 모든 내용을 순서대로 읽어줍니다."
              );
            }}
          >
            {isWholeReading ? "전체 듣기 정지" : "문제 전체 듣기"}
          </S.ToolbarButton>

          {/* 시험 종료 */}
          <S.EndButton
            type="button"
            onClick={handleEndExam}
            aria-label="시험 종료 후 시험 시작 화면으로 이동"
            onFocus={() => {
              announce(
                "시험 종료 버튼입니다. 누르면 시험이 완전히 종료됩니다."
              );
            }}
          >
            시험 종료
          </S.EndButton>
        </S.ToolbarRight>
      </S.Toolbar>

      {/* 메인 레이아웃 */}
      <S.MainLayout $mode={layoutMode}>
        {/* 썸네일 영역 */}
        <S.ThumbnailPane $mode={layoutMode}>
          <S.ThumbnailTitle>문제 목록</S.ThumbnailTitle>
          <S.ThumbnailList>
            {questions.map((q, idx) => {
              const isActive = idx === currentIndex;
              return (
                <S.ThumbnailItem
                  key={q.questionNumber}
                  $active={isActive}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isActive}
                  aria-label={`문제 ${q.questionNumber}로 이동`}
                  onClick={() => handleClickThumbnail(idx)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLLIElement>): void => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClickThumbnail(idx);
                    }
                  }}
                  onFocus={() => {
                    announce(
                      `문제 ${q.questionNumber}로 이동 버튼입니다. 엔터 키를 누르면 이 문제로 이동합니다.`
                    );
                  }}
                >
                  <S.ThumbImage
                    src={q.questionImagePath}
                    alt={`문제 ${q.questionNumber} 원본 이미지 미리보기`}
                  />
                  <S.ThumbMeta $active={isActive}>
                    <p className="label">문제 {q.questionNumber}</p>
                  </S.ThumbMeta>
                </S.ThumbnailItem>
              );
            })}
          </S.ThumbnailList>
        </S.ThumbnailPane>

        {/* 문제 내용 영역 */}
        <S.QuestionPane $mode={layoutMode}>
          <S.QuestionHeader>
            <S.NavButton
              type="button"
              onClick={handlePrev}
              disabled={isFirst}
              aria-label="이전 문제로 이동"
              onFocus={() => {
                if (isFirst) {
                  announce(
                    "이전 문제로 이동 버튼입니다. 첫 번째 문제라 비활성화되어 있습니다."
                  );
                } else {
                  announce("이전 문제로 이동 버튼입니다.");
                }
              }}
            >
              ← 이전
            </S.NavButton>

            <S.QuestionIndicator>
              {currentIndex + 1} / {questions.length}
            </S.QuestionIndicator>

            <S.NavButton
              type="button"
              onClick={handleNext}
              disabled={isLast}
              aria-label="다음 문제로 이동"
              onFocus={() => {
                if (isLast) {
                  announce(
                    "다음 문제로 이동 버튼입니다. 마지막 문제라 비활성화되어 있습니다."
                  );
                } else {
                  announce("다음 문제로 이동 버튼입니다.");
                }
              }}
            >
              다음 →
            </S.NavButton>
          </S.QuestionHeader>

          <S.QuestionContent>
            {!currentQuestion || !exam ? (
              <S.NoQuestionBox>
                <p>표시할 문제가 없습니다.</p>
              </S.NoQuestionBox>
            ) : viewMode === "page" ? (
              <S.QuestionImageWrapper>
                <S.QuestionImage
                  src={currentQuestion.questionImagePath}
                  alt={`문제 ${currentQuestion.questionNumber} 전체 이미지`}
                />
              </S.QuestionImageWrapper>
            ) : (
              <S.ItemsWrapper>
                {currentQuestion.items.map((item, idx) => {
                  const key = makeKey(currentQuestion.questionNumber, idx);
                  const isLoading = ttsLoadingKey === key;
                  const isPlaying =
                    playingKey === key && !audioRef.current?.paused;

                  return (
                    <S.ItemBlock key={idx} $kind={item.kind}>
                      {item.kind === "chart" || item.kind === "table" ? (
                        <>
                          <S.ItemImageButton
                            type="button"
                            onClick={() => setPreviewImage(item.imagePath)}
                            aria-label={`문제 ${
                              currentQuestion.questionNumber
                            }의 ${
                              item.kind === "chart" ? "차트" : "표"
                            } 이미지 확대해서 보기`}
                            onFocus={() => {
                              announce(
                                `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번째 요소, ${
                                  item.kind === "chart" ? "차트" : "표"
                                } 이미지 버튼입니다. 엔터 키를 누르면 확대해서 볼 수 있습니다.`
                              );
                            }}
                          >
                            <S.ItemImage
                              src={item.imagePath}
                              alt={`문제 ${currentQuestion.questionNumber} ${
                                item.kind === "chart" ? "차트" : "표"
                              } 이미지 (눌러서 확대)`}
                            />
                          </S.ItemImageButton>
                          {item.displayText && (
                            <S.ItemSubText>{item.displayText}</S.ItemSubText>
                          )}
                        </>
                      ) : (
                        <ItemTextContent item={item} />
                      )}
                      <S.TtsButtonContainer>
                        <S.TtsButton
                          type="button"
                          onClick={() =>
                            handlePlayItemTTS(
                              currentQuestion.questionNumber,
                              idx,
                              item.displayText ?? null
                            )
                          }
                          disabled={isLoading}
                          aria-label={
                            isLoading
                              ? `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번째 요소, 음성 불러오는 중`
                              : isPlaying
                              ? `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번째 요소, 재생 중. 정지하려면 엔터 키를 누르세요.`
                              : `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번째 요소 듣기 버튼`
                          }
                          onFocus={() => {
                            if (isLoading) {
                              announce(
                                `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번째 요소 듣기 버튼입니다. 음성을 불러오는 중입니다.`
                              );
                            } else if (isPlaying) {
                              announce(
                                `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번째 요소가 재생 중입니다. 정지하려면 엔터 키를 누르세요.`
                              );
                            } else {
                              announce(
                                `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번째 요소 듣기 버튼입니다. 엔터 키를 누르면 이 내용을 읽어줍니다.`
                              );
                            }
                          }}
                        >
                          {isLoading
                            ? "불러오는 중..."
                            : isPlaying
                            ? "정지"
                            : "듣기"}
                        </S.TtsButton>
                      </S.TtsButtonContainer>
                    </S.ItemBlock>
                  );
                })}
              </S.ItemsWrapper>
            )}
          </S.QuestionContent>
        </S.QuestionPane>
      </S.MainLayout>

      {/* chart/table 확대 모달 */}
      {previewImage && (
        <S.ModalBackdrop onClick={() => setPreviewImage(null)}>
          <S.ModalContent
            onClick={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-label="확대된 문제 이미지 보기"
          >
            <S.ModalCloseButton
              type="button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
              aria-label="이미지 닫기"
            >
              ✕
            </S.ModalCloseButton>
            <S.ModalImage src={previewImage} alt="확대된 문제 이미지" />
          </S.ModalContent>
        </S.ModalBackdrop>
      )}
    </S.PageContainer>
  );
};

export default ExamTake;

/* ---------- 텍스트 변환 컴포넌트 (수식 포함) ---------- */

function ItemTextContent({ item }: { item: ExamItem }) {
  const { buildTtsText } = useTtsTextBuilder();
  const [text, setText] = useState(item.displayText ?? "");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!item.displayText) return;
      try {
        const processed = await buildTtsText(item.displayText);
        if (!cancelled) {
          setText(processed);
        }
      } catch (err) {
        console.error("[ItemTextContent] buildTtsText 실패:", err);
        if (!cancelled) {
          setText(item.displayText ?? "");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [item.displayText, buildTtsText]);

  return (
    <S.ItemText as={item.kind === "code" ? "pre" : "p"} $kind={item.kind}>
      {text}
    </S.ItemText>
  );
}
