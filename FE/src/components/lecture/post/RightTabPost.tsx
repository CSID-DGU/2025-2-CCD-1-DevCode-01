import React, { useId, useState } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import SummaryPane from "../pre/SummaryPane";
import ClassPane from "./ClassPane";
import { PANEL_FIXED_H_LIVE } from "@pages/class/pre/styles";
import MemoBox from "../live/Memo";
import BoardBox from "../live/BoardBox";
import type { PageReview, TtsPair } from "@apis/lecture/review.api";

type TabKey = "class" | "memo" | "board" | "summary";
type Role = "student" | "assistant";

type Props = {
  stack: boolean;
  role: Role;
  review: PageReview | null;
  summary: {
    text: string;
    ttsUrl?: string | null;
    sumAudioRef: React.RefObject<HTMLAudioElement | null>;
    sidePaneRef: React.RefObject<HTMLDivElement | null>;
    loading?: boolean;
  };
  memo: { docId: number; pageId?: number | null };
  board: { docId: number; pageId?: number | null; page: number };
  onSummaryTtsPlay?: () => void;
  summaryTtsLoading?: boolean;
  onPlayMemoTts?: (payload: { content: string; tts?: TtsPair | null }) => void;
  readOnFocus?: boolean;
  onFocusReviewTts?: (opts: {
    tts?: TtsPair | null;
    fallbackText?: string;
  }) => void;
  onStopAllTts?: () => void;
};

export default function RightTabsPost({
  stack,
  // role,
  review,
  memo,
  board,
  summary,
  onSummaryTtsPlay,
  summaryTtsLoading,
  onPlayMemoTts,
  readOnFocus,
  onStopAllTts,
}: // onFocusReviewTts,
// readOnFocus,
Props) {
  const [tab, setTab] = useState<TabKey>("class");
  const baseId = useId();
  const id = (k: TabKey) => ({
    tab: `${baseId}-tab-${k}`,
    panel: `${baseId}-panel-${k}`,
  });

  const handleTabClick = (k: TabKey) => {
    // 1) 탭 바꿀 때는 모든 TTS 정지
    onStopAllTts?.();

    // 2) 현재 활성 탭 변경
    setTab(k);

    // 3) 다음 렌더 후 각 탭에 맞는 포커스 이동
    setTimeout(() => {
      // 요약 탭: 기존처럼 sidePaneRef에 포커스 → SummaryPane에서 autoPlayOnFocus
      if (k === "summary") {
        summary.sidePaneRef.current?.focus();
        return;
      }

      // 메모/수업/판서: 패널 DOM 안에서 포커스 타겟 찾기
      const panelId = id(k).panel;
      const panelEl = document.getElementById(panelId);
      if (!panelEl) return;

      // 우선순위: data-focus-initial > textarea > button > [tabindex]
      const focusTarget =
        panelEl.querySelector<HTMLElement>("[data-focus-initial='true']") ||
        panelEl.querySelector<HTMLElement>("textarea") ||
        panelEl.querySelector<HTMLElement>("button, [tabindex]");

      focusTarget?.focus();
    }, 0);
  };

  return (
    <Aside
      $stack={stack}
      aria-label="수업/메모/판서/요약 패널"
      data-area="review-pane"
    >
      <Tablist role="tablist" aria-label="우측 기능">
        {(["class", "memo", "board", "summary"] as TabKey[]).map((k) => (
          <Tab
            key={k}
            id={id(k).tab}
            role="tab"
            aria-selected={tab === k}
            aria-controls={id(k).panel}
            type="button"
            onClick={() => handleTabClick(k)}
          >
            {label(k)}
          </Tab>
        ))}
      </Tablist>

      {/* 수업 */}
      <Panel
        id={id("class").panel}
        role="tabpanel"
        aria-labelledby={id("class").tab}
        hidden={tab !== "class"}
        tabIndex={0}
      >
        <ClassPane review={review} isActive={tab === "class"} />
      </Panel>

      {/* 메모 */}
      <Panel
        id={id("memo").panel}
        role="tabpanel"
        aria-labelledby={id("memo").tab}
        hidden={tab !== "memo"}
      >
        {typeof memo.pageId === "number" && memo.pageId > 0 ? (
          <>
            {console.log("[RightTabsPost] Memo panel 렌더링", {
              pageId: memo.pageId,
              hasReview: !!review,
              hasOnPlayMemoTts: !!onPlayMemoTts,
            })}
            <MemoBox
              docId={memo.docId}
              pageId={memo.pageId}
              review={review}
              onPlayMemoTts={onPlayMemoTts}
              autoReadOnFocus={!!readOnFocus}
              updateWithTts
            />
          </>
        ) : (
          <Empty>이 페이지는 아직 메모를 사용할 수 없어요.</Empty>
        )}
      </Panel>

      {/* 판서 */}
      <Panel
        id={id("board").panel}
        role="tabpanel"
        aria-labelledby={id("board").tab}
        hidden={tab !== "board"}
      >
        {typeof board.pageId === "number" && board.pageId > 0 ? (
          <BoardBox
            docId={board.docId}
            pageId={board.pageId}
            assetBase={import.meta.env.VITE_BASE_URL}
            token={localStorage.getItem("access")}
          />
        ) : (
          <Empty>이 페이지는 아직 판서를 사용할 수 없어요.</Empty>
        )}
      </Panel>

      {/* 요약 */}
      <Panel
        id={id("summary").panel}
        role="tabpanel"
        aria-labelledby={id("summary").tab}
        hidden={tab !== "summary"}
      >
        <SummaryPane
          summaryText={summary.text ?? null}
          summaryTtsUrl={summary.ttsUrl ?? null}
          sumAudioRef={summary.sumAudioRef}
          sidePaneRef={summary.sidePaneRef}
          stack={stack}
          panelHeight={PANEL_FIXED_H_LIVE}
          loading={summary.loading || summaryTtsLoading}
          autoPlayOnFocus
          onPlaySummaryTts={onSummaryTtsPlay}
        />
      </Panel>
    </Aside>
  );
}

const label = (k: TabKey) =>
  k === "class"
    ? "수업"
    : k === "memo"
    ? "메모"
    : k === "board"
    ? "추가 자료"
    : "요약";

const Aside = styled.aside<{ $stack: boolean }>`
  position: ${({ $stack }) => ($stack ? "static" : "sticky")};
  top: 16px;
  background: var(--c-white);
  border: 1px solid #e7eef6;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-height: 340px;
`;
const Tablist = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
`;
const Tab = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 2px solid #e5e5e5;
  background: #fff;
  cursor: pointer;
  ${fonts.regular20};

  &[aria-selected="true"] {
    background: var(--c-blue);
    color: var(--c-white);
    border: 2px solid var(--c-blue);
  }

  &:focus-visible {
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.4);
  }

  &:focus {
    outline: none;
  }

  &:hover:not([aria-selected="true"]) {
    background: #f5faff;
    border-color: #d0e2ff;
  }
`;

const Panel = styled.section`
  display: grid;
  gap: 10px;
  &[hidden] {
    display: none !important;
  }
  overflow: scroll;

  &:focus-visible {
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.4);
  }
`;

const Empty = styled.p`
  margin: 0;
  color: var(--c-gray9, #666);
  font-size: 0.875rem;
`;
