import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

import Spinner from "src/components/common/Spinner";
import {
  fetchExamResult,
  endExam,
  type ExamResultResponse,
  type ExamQuestion,
  type ExamItem,
} from "@apis/exam/exam.api";
import { DUMMY_EXAM_RESULT } from "@apis/exam/exam.dummy";
import { useTtsTextBuilder } from "src/hooks/useTtsTextBuilder";

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
  const [viewMode, setViewMode] = useState<"detail" | "page">("detail"); // 텍스트/원본 전환
  const [previewImage, setPreviewImage] = useState<string | null>(null); // chart/table 확대

  /* ---------- 1) 진입 시 진행 중 시험 조회 (/exam/result/) ---------- */
  useEffect(() => {
    // /exam/start 에서 state로 exam을 넘겨준 경우 → 그대로 사용
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

  /* ---------- 2) 문제 정렬 (문제번호 기준 오름차순) ---------- */
  const questions: ExamQuestion[] = useMemo(() => {
    if (!exam) return [];
    return [...exam.questions].sort(
      (a, b) => a.questionNumber - b.questionNumber
    );
  }, [exam]);

  const currentQuestion: ExamQuestion | null = questions[currentIndex] ?? null;

  // 시험 종료 시간 텍스트 (간단 포맷)
  const endTimeText = useMemo(() => {
    if (!exam?.endTime) return null;
    const d = new Date(exam.endTime);
    if (Number.isNaN(d.getTime())) return exam.endTime;
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [exam]);

  const handleClickThumbnail = (index: number) => {
    setCurrentIndex(index);
    // 문제 바뀔 때 텍스트 모드로 초기화
    setViewMode("detail");
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setViewMode("detail");
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
    setViewMode("detail");
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

    navigate("/exam", { replace: true });
  };

  const isFirst = currentIndex === 0;
  const isLast = questions.length > 0 && currentIndex === questions.length - 1;

  // 진입 직후, 아직 exam도 없고 응답도 안 온 상태 → 전체 스피너
  if (loading && !exam) {
    return (
      <FullPageCenter>
        <Spinner />
      </FullPageCenter>
    );
  }

  return (
    <PageContainer>
      {loading && (
        <Overlay>
          <Spinner />
        </Overlay>
      )}

      {/* 상단 툴바 */}
      <Toolbar>
        <ToolbarLeft>
          {currentQuestion && (
            <ToolbarTitle>문제 {currentQuestion.questionNumber}</ToolbarTitle>
          )}
          {endTimeText && (
            <ToolbarInfo>시험 종료 시각: {endTimeText}</ToolbarInfo>
          )}
        </ToolbarLeft>

        <ToolbarRight>
          <ToolbarButton type="button" onClick={handleToggleViewMode}>
            {viewMode === "detail"
              ? "시험지 전체 페이지 보기"
              : "텍스트로 보기"}
          </ToolbarButton>

          <EndButton type="button" onClick={handleEndExam}>
            시험 종료
          </EndButton>
        </ToolbarRight>
      </Toolbar>

      {/* 메인 레이아웃: 문제 영역 + 썸네일 영역 */}
      <MainLayout>
        {/* 썸네일 목록 */}
        <ThumbnailPane>
          <ThumbnailTitle>문제 목록</ThumbnailTitle>
          <ThumbnailList>
            {questions.map((q, idx) => {
              const isActive = idx === currentIndex;
              return (
                <ThumbnailItem
                  key={q.questionNumber}
                  $active={isActive}
                  onClick={() => handleClickThumbnail(idx)}
                >
                  <ThumbImage
                    src={q.questionImagePath}
                    alt={`문제 ${q.questionNumber} 원본 이미지 미리보기`}
                  />
                  <ThumbMeta>
                    <p className="label">문제 {q.questionNumber}</p>
                    <p className="sub">
                      {isActive ? "현재 문제" : "눌러서 이동"}
                    </p>
                  </ThumbMeta>
                </ThumbnailItem>
              );
            })}
          </ThumbnailList>
        </ThumbnailPane>

        {/* 문제 내용 영역 */}
        <QuestionPane>
          <QuestionHeader>
            <NavButton
              type="button"
              onClick={handlePrev}
              disabled={isFirst}
              aria-label="이전 문제"
            >
              ← 이전
            </NavButton>

            <QuestionIndicator>
              {currentIndex + 1} / {questions.length}
            </QuestionIndicator>

            <NavButton
              type="button"
              onClick={handleNext}
              disabled={isLast}
              aria-label="다음 문제"
            >
              다음 →
            </NavButton>
          </QuestionHeader>

          <QuestionContent>
            {!currentQuestion || !exam ? (
              <NoQuestionBox>
                <p>표시할 문제가 없습니다.</p>
              </NoQuestionBox>
            ) : viewMode === "page" ? (
              // ✅ 시험지 전체 페이지 보기 모드
              <QuestionImageWrapper>
                <QuestionImage
                  src={currentQuestion.questionImagePath}
                  alt={`문제 ${currentQuestion.questionNumber} 전체 이미지`}
                />
              </QuestionImageWrapper>
            ) : (
              // ✅ 상세 모드: items 순서대로 (텍스트/차트/테이블)
              <ItemsWrapper>
                {currentQuestion.items.map((item, idx) => (
                  <ItemBlock key={idx} $kind={item.kind}>
                    {item.kind === "chart" || item.kind === "table" ? (
                      <>
                        <ItemImageButton
                          type="button"
                          onClick={() => setPreviewImage(item.imagePath)}
                        >
                          <ItemImage
                            src={item.imagePath}
                            alt={`문제 ${currentQuestion.questionNumber} ${
                              item.kind === "chart" ? "차트" : "표"
                            } 이미지 (눌러서 확대)`}
                          />
                        </ItemImageButton>
                        {item.displayText && (
                          <ItemSubText>{item.displayText}</ItemSubText>
                        )}
                      </>
                    ) : (
                      <ItemTextContent item={item} />
                    )}
                  </ItemBlock>
                ))}
              </ItemsWrapper>
            )}
          </QuestionContent>
        </QuestionPane>
      </MainLayout>

      {/* ✅ chart/table 확대 모달 */}
      {previewImage && (
        <ModalBackdrop onClick={() => setPreviewImage(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalCloseButton
              type="button"
              onClick={() => setPreviewImage(null)}
            >
              ✕
            </ModalCloseButton>
            <ModalImage src={previewImage} alt="확대된 이미지" />
          </ModalContent>
        </ModalBackdrop>
      )}
    </PageContainer>
  );
};

export default ExamTake;

/* ---------- 텍스트 변환 컴포넌트 (useTtsTextBuilder 사용) ---------- */

function ItemTextContent({ item }: { item: ExamItem }) {
  const { buildTtsText } = useTtsTextBuilder();
  const [text, setText] = useState(item.displayText ?? "");

  // const runBuild = useCallback(async () => {
  //   if (!item.displayText) return;
  //   try {
  //     const processed = await buildTtsText(item.displayText);
  //     setText(processed);
  //   } catch (e) {
  //     console.error("[ItemTextContent] buildTtsText 실패:", e);
  //     setText(item.displayText ?? "");
  //   }
  // }, [item.displayText, buildTtsText]);

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
    <ItemText as={item.kind === "code" ? "pre" : "p"} $kind={item.kind}>
      {text}
    </ItemText>
  );
}

/* ---------- styled-components ---------- */

const PageContainer = styled.div`
  width: 100%;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
`;

const FullPageCenter = styled.div`
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Toolbar = styled.header`
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 12px 16px 8px;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  @media (min-width: 768px) {
    padding: 16px 20px 10px;
  }
`;

const ToolbarLeft = styled.div`
  display: flex;
  flex-direction: column;
`;

const ToolbarTitle = styled.h1`
  font-size: 1.1rem;
  font-weight: 700;

  @media (min-width: 768px) {
    font-size: 1.25rem;
  }
`;

const ToolbarInfo = styled.span`
  margin-top: 2px;
  font-size: 0.8rem;
  color: #6b7280;

  @media (min-width: 768px) {
    font-size: 0.85rem;
  }
`;

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ToolbarButton = styled.button`
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }

  @media (min-width: 768px) {
    padding: 9px 14px;
    font-size: 0.9rem;
  }
`;

const EndButton = styled.button`
  padding: 8px 12px;
  border-radius: 999px;
  border: none;
  background: #ef4444;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #dc2626;
  }

  @media (min-width: 768px) {
    padding: 9px 14px;
    font-size: 0.9rem;
  }
`;

const MainLayout = styled.main`
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 8px 16px 24px;

  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto auto;
  gap: 12px;

  @media (min-width: 900px) {
    grid-template-columns: 220px minmax(0, 1fr);
    grid-template-rows: 1fr;
    gap: 16px;
  }
`;

const ThumbnailPane = styled.aside`
  order: 2;
  @media (min-width: 900px) {
    order: 1;
  }
`;

const QuestionPane = styled.section`
  order: 1;
  @media (min-width: 900px) {
    order: 2;
  }

  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #ffffff;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);

  @media (min-width: 768px) {
    padding: 16px 18px;
  }
`;

const ThumbnailTitle = styled.h2`
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: #374151;

  @media (min-width: 900px) {
    font-size: 0.95rem;
  }
`;

const ThumbnailList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;

  display: flex;
  gap: 8px;
  overflow-x: auto;

  @media (min-width: 900px) {
    flex-direction: column;
    overflow-x: visible;
    overflow-y: auto;
    max-height: calc(100vh - 160px);
  }
`;

const ThumbnailItem = styled.li<{ $active: boolean }>`
  flex: 0 0 140px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 12px;
  background: ${({ $active }) => ($active ? "#e0f2fe" : "#f9fafb")};
  border: 1px solid ${({ $active }) => ($active ? "#38bdf8" : "#e5e7eb")};
  cursor: pointer;

  @media (min-width: 900px) {
    flex: 0 0 auto;
  }
`;

const ThumbImage = styled.img`
  width: 48px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
`;

const ThumbMeta = styled.div`
  flex: 1;
  min-width: 0;

  .label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sub {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 2px;
  }
`;

const QuestionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const NavButton = styled.button`
  padding: 6px 10px;
  font-size: 0.85rem;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  cursor: pointer;

  &:disabled {
    background: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
  }
`;

const QuestionIndicator = styled.span`
  font-size: 0.85rem;
  color: #4b5563;
`;

const QuestionContent = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
`;

const QuestionImageWrapper = styled.div`
  width: 100%;
  background: #111827;
  border-radius: 12px;
  overflow: hidden;
`;

const QuestionImage = styled.img`
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  display: block;
  background: #111827;
`;

const ItemsWrapper = styled.div`
  flex: 1;
  min-height: 0;
  padding: 8px 4px 0;
  overflow-y: auto;
`;

// kind별 텍스트 스타일
const ItemText = styled.p<{ $kind: ExamItem["kind"] }>`
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #111827;

  ${({ $kind }) =>
    $kind === "qnum" &&
    `
    font-weight: 700;
    margin-bottom: 4px;
  `}

  ${({ $kind }) =>
    $kind === "code" &&
    `
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    background: #111827;
    color: #e5e7eb;
    padding: 8px 10px;
    border-radius: 8px;
    overflow-x: auto;
  `}
`;

const ItemSubText = styled.p`
  margin-top: 4px;
  font-size: 0.8rem;
  line-height: 1.5;
  color: #4b5563;
`;

const ItemBlock = styled.div<{ $kind: ExamItem["kind"] }>`
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e5e7eb;

  &:last-child {
    border-bottom: none;
  }
`;

const ItemImageButton = styled.button`
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
  width: 100%;
  display: block;
`;

const ItemImage = styled.img`
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  border-radius: 8px;
  background: #f3f4f6;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;

/* ---------- 이미지 확대 모달 ---------- */

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
`;

const ModalContent = styled.div`
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: #0b1120;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalImage = styled.img`
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
`;

const ModalCloseButton = styled.button`
  position: absolute;
  top: 6px;
  right: 8px;
  border: none;
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
  padding: 4px 8px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.8rem;
`;

const NoQuestionBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 0.95rem;
  padding: 24px;
  text-align: center;
`;
