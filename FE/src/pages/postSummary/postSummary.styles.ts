import styled from "styled-components";
import { fonts } from "@styles/fonts";

/* 전체 페이지 컨테이너 */
export const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  background: #f5f7fb;
`;

export const SrLive = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  overflow: hidden;
`;

/* 상단 툴바 */
export const Toolbar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.5rem;
  border-bottom: 1px solid #dde3f0;
  background: #ffffff;
`;

export const ToolbarLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

export const ToolbarTitle = styled.h1`
  ${fonts.bold20};
  color: #111827;
`;

export const ToolbarSubtitle = styled.p`
  ${fonts.regular17};
  color: #6b7280;
`;

export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const ToolbarButton = styled.button`
  ${fonts.regular17};
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }

  &:focus-visible {
    outline: 2px solid var(--c-blue, #2563eb);
    outline-offset: 2px;
  }
`;

/* 메인 레이아웃 */
export const MainLayout = styled.main<{ $stack: boolean }>`
  flex: 1;
  display: grid;
  grid-template-columns: ${({ $stack }) =>
    $stack ? "1fr" : "260px minmax(0, 1fr)"};
  grid-template-rows: ${({ $stack }) =>
    $stack ? "280px minmax(0, 1fr)" : "1fr"};
  gap: 0;
  min-height: 0;
`;

/* 좌측 목록 패널 */
export const ListPane = styled.section<{ $stack: boolean }>`
  background: #ffffff;
  border-right: ${({ $stack }) => ($stack ? "none" : "1px solid #e5e7eb")};
  border-bottom: ${({ $stack }) => ($stack ? "1px solid #e5e7eb" : "none")};
  padding: 1rem;
  overflow: hidden;
`;

export const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

export const ListTitle = styled.h2`
  ${fonts.regular17};
  color: #111827;
`;

export const ListCount = styled.span`
  ${fonts.regular17};
  color: #6b7280;
`;

export const SummaryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

export const SummaryItem = styled.li<{ $active: boolean }>`
  border-radius: 0.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid ${({ $active }) => ($active ? "#2563eb" : "#e5e7eb")};
  background: ${({ $active }) => ($active ? "#eff6ff" : "#ffffff")};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  &:hover {
    background: ${({ $active }) => ($active ? "#e0ecff" : "#f9fafb")};
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

export const SummaryDate = styled.span`
  ${fonts.regular17};
  color: #111827;
`;

export const SummaryMeta = styled.span`
  ${fonts.regular17};
  color: #6b7280;
`;

/* 우측 상세 패널 */
export const DetailPane = styled.section`
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
`;

export const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
`;

export const DetailTitle = styled.h2`
  ${fonts.bold20};
  color: #111827;
`;

export const DetailMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;

  span {
    ${fonts.regular17};
    color: #6b7280;
  }
`;

export const EmptyState = styled.div`
  flex: 1;
  border-radius: 0.75rem;
  border: 1px dashed #d1d5db;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  ${fonts.regular17};
  color: #6b7280;
`;

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 220px;
  resize: vertical;
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  ${fonts.regular17};
  color: #111827;
  line-height: 1.6;

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

export const DetailFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
`;

export const FooterLeft = styled.div`
  ${fonts.regular17};
  color: #9ca3af;
`;

export const FooterRight = styled.div`
  display: flex;
  gap: 0.5rem;
`;

export const PrimaryButton = styled.button`
  ${fonts.regular17};
  padding: 0.4rem 0.9rem;
  border-radius: 0.6rem;
  border: none;
  background: var(--c-blue, #2563eb);
  color: #ffffff;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &:hover:not(:disabled) {
    background: #1d4ed8;
  }

  &:focus-visible {
    outline: 2px solid #1d4ed8;
    outline-offset: 2px;
  }
`;

export const GhostButton = styled.button`
  ${fonts.regular17};
  padding: 0.4rem 0.9rem;
  border-radius: 0.6rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }

  &:focus-visible {
    outline: 2px solid #9ca3af;
    outline-offset: 2px;
  }
`;
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;
