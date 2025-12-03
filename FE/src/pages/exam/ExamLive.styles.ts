import styled, { css } from "styled-components";
import { fonts } from "@styles/fonts";
import type { ExamItem } from "@apis/exam/exam.api";

export const PageContainer = styled.div`
  width: 100%;
  background: var(--c-grayL);
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
`;

export const FullPageCenter = styled.div`
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const Toolbar = styled.header`
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

export const ToolbarLeft = styled.div`
  display: flex;
  flex-direction: column;
`;

export const ToolbarTitle = styled.h1`
  ${fonts.medium24};

  @media (min-width: 768px) {
    ${fonts.bold32};
  }
`;

export const ToolbarInfo = styled.span`
  margin-top: 2px;
  ${fonts.regular20};
  color: var(--c-grayD);

  @media (min-width: 768px) {
    ${fonts.bold20};
  }
`;

export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const ToolbarButton = styled.button`
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

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

export const EndButton = styled.button`
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

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

export const MainLayout = styled.main<{
  $mode: "normal" | "compact" | "stack";
}>`
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 8px 16px 24px;

  display: grid;
  gap: 12px;

  ${({ $mode }) => {
    if ($mode === "stack") {
      // 큰 글씨 → 위/아래로 쌓기
      return css`
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
      `;
    }
    if ($mode === "compact") {
      // 글씨가 좀 커진 경우 → 썸네일 칼럼 폭 줄인 2열
      return css`
        grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
        grid-template-rows: 1fr;
      `;
    }
    // 기본 2열
    return css`
      grid-template-columns: 18rem minmax(0, 1fr);
      grid-template-rows: 1fr;
    `;
  }}

  /* 화면이 좁을 때는 그냥 무조건 스택 */
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
`;

export const ThumbnailPane = styled.aside<{
  $mode: "normal" | "compact" | "stack";
}>`
  order: 2;
  @media (min-width: 900px) {
    order: 1;
  }

  ${({ $mode }) => {
    if ($mode === "stack") {
      return css`
        max-height: 40vh; /* 세로 스택에서 썸네일 높이 제한 */
        border-bottom: 1px solid var(--gray-300);
      `;
    }
    return css`
      max-height: none;
      border-right: 1px solid var(--gray-300);
    `;
  }}
`;

export const QuestionPane = styled.section<{
  $mode: "normal" | "compact" | "stack";
}>`
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
  ${({ $mode }) =>
    $mode === "stack" &&
    css`
      margin-top: 0.75rem;
    `}
`;

export const ThumbnailTitle = styled.h2`
  ${fonts.regular17};
  margin-bottom: 6px;
  color: var(--c-grayD);

  @media (min-width: 900px) {
    ${fonts.bold20};
  }
`;

export const ThumbnailList = styled.ul`
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

export const ThumbnailItem = styled.li<{ $active: boolean }>`
  flex: 0 0 140px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 12px;
  background: ${({ $active }) =>
    $active ? "var(--c-blue)" : "var(--c-white)"};
  cursor: pointer;

  @media (min-width: 900px) {
    flex: 0 0 auto;
  }

  &:focus-visible {
    border: 3px solid var(--c-yellowM);
  }
`;

export const ThumbImage = styled.img`
  width: 48px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
`;

export const ThumbMeta = styled.div<{ $active: boolean }>`
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

export const QuestionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

export const NavButton = styled.button`
  padding: 6px 10px;
  ${fonts.bold20};
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

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

export const QuestionIndicator = styled.span`
  ${fonts.bold20};
  color: var(--c-grayD);
`;

export const QuestionContent = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
`;

export const QuestionImageWrapper = styled.div`
  width: 100%;
  background: var(--c-black);
  border-radius: 12px;
  overflow: hidden;
`;

export const QuestionImage = styled.img`
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  display: block;
  background: var(--c-black);
`;

export const ItemsWrapper = styled.div`
  flex: 1;
  min-height: 0;
  padding: 8px 4px 0;
  overflow-y: auto;
`;

export const ItemText = styled.p<{ $kind: ExamItem["kind"] }>`
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

export const ItemSubText = styled.p`
  margin-top: 4px;
  ${fonts.regular17};
  line-height: 1.5;
  color: var(--c-grayD);
`;

export const ItemBlock = styled.div<{ $kind: ExamItem["kind"] }>`
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e5e7eb;

  &:last-child {
    border-bottom: none;
  }
`;

export const ItemImageButton = styled.button`
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
  width: 100%;
  display: block;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

export const ItemImage = styled.img`
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  border-radius: 8px;
  background: #f3f4f6;
`;

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;

/* ---------- 이미지 확대 모달 ---------- */

export const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
`;

export const ModalContent = styled.div`
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

export const ModalImage = styled.img`
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
`;

export const ModalCloseButton = styled.button`
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

export const NoQuestionBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 0.95rem;
  padding: 24px;
  text-align: center;
`;

export const TtsButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const TtsButton = styled.button`
  padding: 5px 15px;
  border-radius: 999px;
  border: 2px solid var(--c-blue);
  color: var(--c-blue);

  ${fonts.bold20}
  cursor: pointer;

  &:hover {
    outline: 5px solid var(--c-yellowM);
  }

  &:disabled {
    background: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;
