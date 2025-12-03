import React, { useId, useRef, useState } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import SummaryPane from "../pre/SummaryPane";
import ClassPane from "./ClassPane";
import { PANEL_FIXED_H_LIVE } from "@pages/class/pre/styles";
import MemoBox from "../live/Memo";
import BoardBox from "../live/BoardBox";
import type { PageReview, TtsPair } from "@apis/lecture/review.api";
import { useFocusSpeak } from "@shared/tts/useFocusSpeak";

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
  buildBoardTtsText?: (raw: string) => Promise<string>;
  registerBoardStop?: (fn: () => void) => void;
};

const TAB_ORDER: TabKey[] = ["class", "memo", "board", "summary"];

const label = (k: TabKey) =>
  k === "class"
    ? "수업"
    : k === "memo"
    ? "메모"
    : k === "board"
    ? "추가 자료"
    : "요약";

const FOCUSABLE_SELECTOR =
  'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

export default function RightTabsPost({
  stack,
  review,
  memo,
  board,
  summary,
  onSummaryTtsPlay,
  summaryTtsLoading,
  onPlayMemoTts,
  readOnFocus,
  onStopAllTts,
  buildBoardTtsText,
}: Props) {
  const [tab, setTab] = useState<TabKey>("class");
  const baseId = useId();

  const asideRef = useRef<HTMLElement | null>(null);
  const tablistRef = useRef<HTMLDivElement | null>(null);

  const id = (k: TabKey) => ({
    tab: `${baseId}-tab-${k}`,
    panel: `${baseId}-panel-${k}`,
  });

  const focusBottomToolbar = (): boolean => {
    const bottom = document.querySelector<HTMLElement>(
      "[data-area='bottom-toolbar']"
    );
    if (!bottom) return false;

    const all = Array.from(
      bottom.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );

    const target = all.find((el) => {
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.getAttribute("aria-disabled") === "true") return false;
      if (el instanceof HTMLButtonElement && el.disabled) return false;
      if (el instanceof HTMLInputElement && el.disabled) return false;
      if (el instanceof HTMLSelectElement && el.disabled) return false;
      if (el instanceof HTMLTextAreaElement && el.disabled) return false;

      return true;
    });

    if (!target) return false;

    target.focus();
    return true;
  };

  /* ---------- 탭 클릭 시: 탭 전환 + 패널 안으로 진입 ---------- */
  const handleTabClick = (k: TabKey) => {
    onStopAllTts?.();
    setTab(k);

    setTimeout(() => {
      if (k === "summary") {
        summary.sidePaneRef.current?.focus();
        return;
      }

      const panelId = id(k).panel;
      const panelEl = document.getElementById(panelId);
      if (!panelEl) return;

      const focusTarget =
        panelEl.querySelector<HTMLElement>("[data-focus-initial='true']") ||
        panelEl.querySelector<HTMLElement>("textarea") ||
        panelEl.querySelector<HTMLElement>("button, [tabindex]");

      focusTarget?.focus();
    }, 0);
  };

  /* ---------- Tab 키: 탭 버튼 위에서는 "옆 탭으로만" 이동 ---------- */
  const makeTabButtonKeyDown =
    (k: TabKey): React.KeyboardEventHandler<HTMLButtonElement> =>
    (e) => {
      if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;

      const tablistEl = tablistRef.current;
      if (!tablistEl) return;
      if (!tablistEl.contains(e.currentTarget)) return;

      const idx = TAB_ORDER.indexOf(k);
      if (idx === -1) return;

      if (k === "summary" && !e.shiftKey) {
        const moved = focusBottomToolbar();
        if (moved) {
          e.preventDefault();
        }
        return;
      }

      e.preventDefault();

      let nextIdx: number;
      if (e.shiftKey) {
        nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      } else {
        nextIdx = (idx + 1) % TAB_ORDER.length;
      }

      const nextKey = TAB_ORDER[nextIdx];
      const nextTabId = id(nextKey).tab;
      const nextTabEl = document.getElementById(
        nextTabId
      ) as HTMLButtonElement | null;

      nextTabEl?.focus();
    };

  /* ---------- 패널 안에서의 Tab ----------
   *  이제는 Tab으로 탭 전환 안 함.
   *  → Tab은 브라우저 기본 동작: 패널 안 포커스 요소들 → 그 다음(보통 BottomToolbar)
   */
  const handleAsideKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;

    const root = asideRef.current;
    const tablist = tablistRef.current;
    if (!root || !tablist) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (!root.contains(target)) return;
    if (tablist.contains(target)) return;
  };

  const tabSpeak = useFocusSpeak();

  return (
    <Aside
      ref={asideRef}
      $stack={stack}
      aria-label="수업/메모/판서/요약 패널"
      data-area="review-pane"
      onKeyDown={handleAsideKeyDown}
    >
      {/* 탭 헤더 */}
      <Tablist
        ref={tablistRef}
        role="tablist"
        aria-label="우측 기능"
        aria-orientation="horizontal"
      >
        {TAB_ORDER.map((k) => (
          <Tab
            key={k}
            id={id(k).tab}
            role="tab"
            aria-selected={tab === k}
            aria-controls={id(k).panel}
            type="button"
            onClick={() => handleTabClick(k)}
            onKeyDown={makeTabButtonKeyDown(k)}
            aria-label={label(k)}
            {...tabSpeak}
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
          <MemoBox
            docId={memo.docId}
            pageId={memo.pageId}
            review={review}
            onPlayMemoTts={onPlayMemoTts}
            autoReadOnFocus={!!readOnFocus}
            updateWithTts
          />
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
            buildBoardTtsText={buildBoardTtsText}
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
