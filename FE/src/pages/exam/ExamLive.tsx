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
import { fonts } from "@styles/fonts";

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

  /* ---------- 2) 문제 정렬 (문제번호 기준 오름차순) ---------- */
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

  const handleClickThumbnail = (index: number) => {
    setCurrentIndex(index);
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
                  <ThumbMeta $active={isActive}>
                    <p className="label">문제 {q.questionNumber}</p>
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
              <QuestionImageWrapper>
                <QuestionImage
                  src={currentQuestion.questionImagePath}
                  alt={`문제 ${currentQuestion.questionNumber} 전체 이미지`}
                />
              </QuestionImageWrapper>
            ) : (
              // 상세 모드: items 순서대로 (텍스트/차트/테이블)
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

      {/* chart/table 확대 모달 */}
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
  background: var(--c-grayL);
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
  ${fonts.medium24};

  @media (min-width: 768px) {
    ${fonts.bold32};
  }
`;

const ToolbarInfo = styled.span`
  margin-top: 2px;
  ${fonts.regular20};
  color: var(--c-grayD);

  @media (min-width: 768px) {
    ${fonts.bold20};
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
  ${fonts.regular17};
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }

  @media (min-width: 768px) {
    padding: 9px 14px;
    ${fonts.medium24};
  }
`;

const EndButton = styled.button`
  padding: 8px 12px;
  border-radius: 999px;
  border: none;
  background: #ef4444;
  color: #ffffff;
  ${fonts.regular17};
  cursor: pointer;

  &:hover {
    background: #dc2626;
  }

  @media (min-width: 768px) {
    padding: 9px 14px;
    ${fonts.medium24};
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
  background: var(--c-white);
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);

  @media (min-width: 768px) {
    padding: 16px 18px;
  }
`;

const ThumbnailTitle = styled.h2`
  ${fonts.regular17};
  margin-bottom: 6px;
  color: var(--c-grayD);

  @media (min-width: 900px) {
    ${fonts.bold20};
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
  background: ${({ $active }) =>
    $active ? "var(--c-blue)" : "var(--c-white)"};
  border: 2px solid
    ${({ $active }) => ($active ? "var(--c-blue)" : "var(--c-white)")};
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

const ThumbMeta = styled.div<{ $active: boolean }>`
  flex: 1;
  min-width: 0;

  .label {
    ${fonts.bold20};
    color: ${({ $active }) => ($active ? "var(--c-white)" : "var(--c-black)")};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
  ${fonts.bold20}
  border-radius: 999px;
  border: 2px solid var(--c-black);
  background: var(--c-white);
  cursor: pointer;
  color: var(--c-black);

  &:disabled {
    background: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
    border: none;
  }
`;

const QuestionIndicator = styled.span`
  ${fonts.bold20}
  color: var(--c-grayD)
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
  background: var(--c-black);
  border-radius: 12px;
  overflow: hidden;
`;

const QuestionImage = styled.img`
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  display: block;
  background: var(--c-black);
`;

const ItemsWrapper = styled.div`
  flex: 1;
  min-height: 0;
  padding: 8px 4px 0;
  overflow-y: auto;
`;

const ItemText = styled.p<{ $kind: ExamItem["kind"] }>`
  ${fonts.regular20};
  white-space: pre-wrap;
  color: var(--c-black);

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
    background: var(--c-black);
    color: var(--c-white);
    padding: 8px 10px;
    border-radius: 8px;
    overflow-x: auto;
  `}
`;

const ItemSubText = styled.p`
  margin-top: 4px;
  ${fonts.regular17};
  line-height: 1.5;
  color: var(--c-grayD);
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
  top: 15px;
  right: 15px;
  border: none;
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
  padding: 8px 10px;
  border-radius: 999px;
  cursor: pointer;
  ${fonts.regular17};
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
