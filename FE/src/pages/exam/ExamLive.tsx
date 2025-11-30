import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Spinner from "src/components/common/Spinner";
import {
  fetchExamResult,
  endExam,
  type ExamResultResponse,
  type ExamQuestion,
  type ExamItem,
  fetchExamItemTTS,
} from "@apis/exam/exam.api";
import { DUMMY_EXAM_RESULT } from "@apis/exam/exam.dummy";
import { useTtsTextBuilder } from "src/hooks/useTtsTextBuilder";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";

import * as S from "./ExamLive.styles";

type LocationState = {
  exam?: ExamResultResponse;
};

const ExamTake = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [exam, setExam] = useState<ExamResultResponse | null>(
    state?.exam ?? null
  );
  const [loading, setLoading] = useState(!state?.exam);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"detail" | "page">("detail");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { soundRate, soundVoice } = useSoundOptions();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsMap, setTtsMap] = useState<
    Record<string, { female: string; male: string }>
  >({});
  const [ttsLoadingKey, setTtsLoadingKey] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const [isWholeReading, setIsWholeReading] = useState(false);
  const isWholeReadingRef = useRef(false);
  const wholeQuestionRef = useRef<ExamQuestion | null>(null);

  useEffect(() => {
    isWholeReadingRef.current = isWholeReading;
  }, [isWholeReading]);

  const makeKey = (qNo: number, idx: number) => `${qNo}-${idx}`;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handlePlayItemTTS = useCallback(
    async (questionNumber: number, itemIndex: number) => {
      const key = makeKey(questionNumber, itemIndex);

      if (
        !isWholeReadingRef.current &&
        playingKey === key &&
        audioRef.current
      ) {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
          setPlayingKey(null);
          return;
        }
      }

      let tts = ttsMap[key];

      if (!tts) {
        try {
          setTtsLoadingKey(key);
          const res = await fetchExamItemTTS(questionNumber, itemIndex);
          setTtsLoadingKey(null);

          if (!res || !res.tts) {
            console.error("[ExamTake] TTS 응답 없음:", res);
            alert("음성을 불러오지 못했습니다.");
            return;
          }

          tts = res.tts;
          setTtsMap((prev) => ({ ...prev, [key]: res.tts }));
        } catch (e) {
          console.error("[ExamTake] TTS 요청 실패:", e);
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
      } catch (e) {
        console.error("[ExamTake] 오디오 재생 실패:", e);
        alert("음성을 재생할 수 없습니다.");
      }
    },
    [soundRate, soundVoice, ttsMap, playingKey]
  );

  const playWholeFrom = useCallback(
    async (startIndex: number) => {
      const question = wholeQuestionRef.current;
      if (!question) return;

      const items = question.items;
      if (startIndex >= items.length) {
        setIsWholeReading(false);
        return;
      }

      await handlePlayItemTTS(question.questionNumber, startIndex);

      if (audioRef.current) {
        audioRef.current.onended = () => {
          if (!isWholeReadingRef.current) return;
          playWholeFrom(startIndex + 1);
        };
      }
    },
    [handlePlayItemTTS]
  );

  useEffect(() => {
    if (state?.exam) return;

    const load = async () => {
      setLoading(true);
      const data = await fetchExamResult();

      if (!data || data.questions.length === 0) {
        console.warn(
          "응답이 없거나 questions가 비어 있어서 더미 데이터를 사용합니다."
        );
        setExam(DUMMY_EXAM_RESULT);
        setLoading(false);
        return;
      }

      setExam(data);
      setLoading(false);
    };

    load();
  }, [state]);

  const questions: ExamQuestion[] = useMemo(() => {
    if (!exam) return [];
    return [...exam.questions].sort(
      (a, b) => a.questionNumber - b.questionNumber
    );
  }, [exam]);

  const currentQuestion: ExamQuestion | null = useMemo(
    () => questions[currentIndex] ?? null,
    [questions, currentIndex]
  );

  const endTimeText = useMemo(() => {
    if (!exam?.endTime) return null;
    const d = new Date(exam.endTime);
    if (Number.isNaN(d.getTime())) return exam.endTime;
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [exam]);

  const handlePlayWholeQuestion = useCallback(() => {
    if (!questions.length) return;
    const question = questions[currentIndex];
    if (!question) return;

    if (isWholeReadingRef.current) {
      setIsWholeReading(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    wholeQuestionRef.current = question;
    setIsWholeReading(true);
    playWholeFrom(0);
  }, [questions, currentIndex, playWholeFrom]);

  useEffect(() => {
    if (state?.exam) {
      return;
    }

    const load = async () => {
      setLoading(true);
      const data = await fetchExamResult();

      if (!data || data.questions.length === 0) {
        console.warn(
          "응답이 없거나 questions가 비어 있어서 더미 데이터를 사용합니다."
        );
        setExam(DUMMY_EXAM_RESULT);
        setLoading(false);
        return;
      }

      setExam(data);
      setLoading(false);
    };

    load();
  }, [state]);

  const handleClickThumbnail = (index: number) => {
    setCurrentIndex(index);
    setViewMode("detail");
    setIsWholeReading(false);
    if (audioRef.current) audioRef.current.pause();
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setViewMode("detail");
    setIsWholeReading(false);
    if (audioRef.current) audioRef.current.pause();
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
    setViewMode("detail");
    setIsWholeReading(false);
    if (audioRef.current) audioRef.current.pause();
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === "detail" ? "page" : "detail"));
  };

  const handleEndExam = async () => {
    setLoading(true);
    const ok = await endExam();
    setLoading(false);

    if (!ok) {
      alert("시험 종료에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    setIsWholeReading(false);
    if (audioRef.current) audioRef.current.pause();
    navigate("/exam", { replace: true });
  };

  const isFirst = currentIndex === 0;
  const isLast = questions.length > 0 && currentIndex === questions.length - 1;

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
          <S.ToolbarButton
            type="button"
            onClick={handleToggleViewMode}
            aria-pressed={viewMode === "page"}
            aria-label={
              viewMode === "detail"
                ? "현재 텍스트 모드입니다. 시험지 전체 페이지 보기로 전환"
                : "현재 시험지 전체 페이지 모드입니다. 텍스트로 보기로 전환"
            }
          >
            {viewMode === "detail"
              ? "시험지 전체 페이지 보기"
              : "텍스트로 보기"}
          </S.ToolbarButton>

          <S.ToolbarButton
            type="button"
            onClick={handlePlayWholeQuestion}
            aria-pressed={isWholeReading}
            aria-label={
              isWholeReading
                ? "현재 문제 전체 듣기 중지"
                : "현재 문제의 모든 내용을 순서대로 듣기"
            }
          >
            {isWholeReading ? "전체 듣기 정지" : "문제 전체 듣기"}
          </S.ToolbarButton>

          <S.EndButton type="button" onClick={handleEndExam}>
            시험 종료
          </S.EndButton>
        </S.ToolbarRight>
      </S.Toolbar>

      <S.MainLayout>
        {/* 썸네일 */}
        <S.ThumbnailPane>
          <S.ThumbnailTitle>문제 목록</S.ThumbnailTitle>
          <S.ThumbnailList>
            {questions.map((q, idx) => {
              const isActive = idx === currentIndex;
              return (
                <S.ThumbnailItem
                  key={q.questionNumber}
                  $active={isActive}
                  onClick={() => handleClickThumbnail(idx)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isActive}
                  aria-label={`문제 ${q.questionNumber}로 이동`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClickThumbnail(idx);
                    }
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

        {/* 문제 내용 */}
        <S.QuestionPane>
          <S.QuestionHeader>
            <S.NavButton
              type="button"
              onClick={handlePrev}
              disabled={isFirst}
              aria-label="이전 문제"
            >
              ← 이전
            </S.NavButton>

            <S.QuestionIndicator>
              {questions.length > 0
                ? `${currentIndex + 1} / ${questions.length}`
                : "문제 없음"}
            </S.QuestionIndicator>

            <S.NavButton
              type="button"
              onClick={handleNext}
              disabled={isLast}
              aria-label="다음 문제"
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
                  const isPlaying = playingKey === key;

                  return (
                    <S.ItemBlock key={idx} $kind={item.kind}>
                      {item.kind === "chart" || item.kind === "table" ? (
                        <>
                          <S.ItemImageButton
                            type="button"
                            onClick={() => setPreviewImage(item.imagePath)}
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
                          onClick={() => {
                            if (isWholeReadingRef.current) return;
                            handlePlayItemTTS(
                              currentQuestion.questionNumber,
                              idx
                            );
                          }}
                          disabled={isLoading}
                          aria-label={
                            isLoading
                              ? `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번 요소, 음성 불러오는 중`
                              : `문제 ${currentQuestion.questionNumber}의 ${
                                  idx + 1
                                }번 요소 듣기 버튼`
                          }
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
          <S.ModalContent onClick={(e) => e.stopPropagation()}>
            <S.ModalCloseButton
              type="button"
              onClick={() => setPreviewImage(null)}
            >
              ✕
            </S.ModalCloseButton>
            <S.ModalImage src={previewImage} alt="확대된 이미지" />
          </S.ModalContent>
        </S.ModalBackdrop>
      )}
    </S.PageContainer>
  );
};

export default ExamTake;

/* ---------- 텍스트 변환 컴포넌트 (useTtsTextBuilder 사용) ---------- */

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
      } catch (e) {
        console.error("[ItemTextContent] buildTtsText 실패:", e);
        if (!cancelled) {
          setText(item.displayText ?? "");
        }
      }
    };

    run();

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
