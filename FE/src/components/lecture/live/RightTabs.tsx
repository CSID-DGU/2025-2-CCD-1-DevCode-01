import React, { useId, useState, useRef, useCallback } from "react";
import styled from "styled-components";
import MemoBox from "./Memo";
import { fonts } from "@styles/fonts";
import SummaryPane from "../pre/SummaryPane";
import { PANEL_FIXED_H_LIVE } from "@pages/class/pre/styles";
import BoardBox from "./BoardBox";
import type { NoteTts } from "@apis/lecture/note.api";
import { useFocusSpeak } from "@shared/tts/useFocusSpeak";

type Role = "student" | "assistant";
export type TabKey = "memo" | "board" | "summary";

type Props = {
  stack: boolean;
  activeInitial?: TabKey;
  role: Role;
  summary: {
    text: string;
    ttsUrl?: string;
    sumAudioRef?: React.RefObject<HTMLAudioElement | null>;
    sidePaneRef?: React.RefObject<HTMLDivElement | null>;
    loading?: boolean;
  };
  memo: {
    docId: number;
    pageId?: number | null;
    pageNumber: number;
  };
  board?: {
    docId: number;
    page: number;
    pageId?: number | null;
  };
  showBoard?: boolean;
  onSummaryOpen?: () => void;
  onSummaryTtsPlay?: () => void;
  summaryTtsLoading?: boolean;
  memoAutoReadOnFocus?: boolean;
  memoUpdateWithTts?: boolean;
  onPlayMemoTts?: (payload: { content: string; tts?: NoteTts | null }) => void;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onStopAllTts?: () => void;
  localTtsEnabled?: boolean;
  boardTtsEnabled?: boolean;
};

export default function RightTabs({
  stack,
  activeInitial = "memo",
  // role,
  memo,
  board,
  summary,
  showBoard = true,
  onSummaryOpen,
  onSummaryTtsPlay,
  summaryTtsLoading,
  memoAutoReadOnFocus,
  memoUpdateWithTts,
  onPlayMemoTts,
  activeTab,
  onTabChange,
  onStopAllTts,
  localTtsEnabled = true,
  boardTtsEnabled = true,
}: Props) {
  const [innerTab, setInnerTab] = useState<TabKey>(activeInitial);

  const isControlled = activeTab != null;
  const currentTab: TabKey = isControlled ? (activeTab as TabKey) : innerTab;

  const baseId = useId();
  const tabIds: Record<TabKey, string> = {
    memo: `${baseId}-tab-memo`,
    board: `${baseId}-tab-board`,
    summary: `${baseId}-tab-summary`,
  };
  const panelIds: Record<TabKey, string> = {
    memo: `${baseId}-panel-memo`,
    board: `${baseId}-panel-board`,
    summary: `${baseId}-panel-summary`,
  };

  const hasBoard = showBoard && board;

  const changeTab = (next: TabKey) => {
    onStopAllTts?.();

    if (!isControlled) {
      setInnerTab(next);
    }
    onTabChange?.(next);
  };

  const memoPanelRef = useRef<HTMLElement | null>(null);

  const focusFirstInMemoPanel = useCallback(() => {
    requestAnimationFrame(() => {
      const root = memoPanelRef.current;
      if (!root) return;

      const selector =
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

      const first = root.querySelector<HTMLElement>(selector);
      first?.focus();
    });
  }, []);

  const handleClickSummary = () => {
    changeTab("summary");
    onSummaryOpen?.();
  };

  const focusSpeak = useFocusSpeak({ enabled: localTtsEnabled });

  return (
    <Aside $stack={stack} aria-label="메모, 판서, 요약 패널">
      <Tablist
        role="tablist"
        aria-label="우측 기능"
        aria-orientation="horizontal"
      >
        {/* 메모 탭 */}
        <Tab
          id={tabIds.memo}
          role="tab"
          aria-selected={currentTab === "memo"}
          aria-controls={panelIds.memo}
          type="button"
          aria-label="메모"
          onClick={() => changeTab("memo")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              changeTab("memo");
              focusFirstInMemoPanel();
            }
          }}
          {...focusSpeak}
        >
          메모
        </Tab>

        {/* 판서 탭 */}
        {hasBoard && (
          <Tab
            id={tabIds.board}
            role="tab"
            aria-selected={currentTab === "board"}
            aria-controls={panelIds.board}
            onClick={() => changeTab("board")}
            type="button"
            aria-label="추가자료"
            {...focusSpeak}
          >
            추가 자료
          </Tab>
        )}

        {/* 요약 탭 */}
        <Tab
          id={tabIds.summary}
          role="tab"
          aria-selected={currentTab === "summary"}
          aria-controls={panelIds.summary}
          onClick={handleClickSummary}
          type="button"
          aria-label="요약"
          {...focusSpeak}
        >
          요약
        </Tab>
      </Tablist>

      {/* 메모 패널 */}
      <Panel
        id={panelIds.memo}
        role="tabpanel"
        aria-labelledby={tabIds.memo}
        hidden={currentTab !== "memo"}
        ref={memoPanelRef}
      >
        {typeof memo.pageId === "number" && memo.pageId > 0 ? (
          <>
            {console.log("[RightTabs] Memo panel 렌더링", {
              pageId: memo.pageId,
              memoAutoReadOnFocus,
              memoUpdateWithTts,
              hasOnPlayMemoTts: !!onPlayMemoTts,
              currentTab,
            })}
            <MemoBox
              docId={memo.docId}
              pageId={memo.pageId}
              autoReadOnFocus={memoAutoReadOnFocus}
              updateWithTts={memoUpdateWithTts}
              onPlayMemoTts={onPlayMemoTts}
            />
          </>
        ) : (
          <EmptyState role="status" aria-live="polite">
            이 페이지는 아직 메모를 사용할 수 없어요. 조금만 기다려주세요.
          </EmptyState>
        )}
      </Panel>

      {/* 판서 패널*/}
      {hasBoard && (
        <Panel
          id={panelIds.board}
          role="tabpanel"
          aria-labelledby={tabIds.board}
          hidden={currentTab !== "board"}
        >
          {typeof board?.pageId === "number" && board.pageId > 0 ? (
            <BoardBox
              docId={board.docId}
              pageId={board.pageId}
              assetBase={import.meta.env.VITE_BASE_URL}
              token={localStorage.getItem("access")}
              enableTts={localTtsEnabled && boardTtsEnabled}
            />
          ) : (
            <EmptyState role="status" aria-live="polite">
              이 페이지는 아직 판서를 사용할 수 없어요.
            </EmptyState>
          )}
        </Panel>
      )}

      {/* 요약 패널 */}
      <Panel
        id={panelIds.summary}
        role="tabpanel"
        aria-labelledby={tabIds.summary}
        hidden={currentTab !== "summary"}
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

/* ---------- styled ---------- */

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
  gap: 0.5rem;
  width: 100%;
`;

const Tab = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 2px solid #e5e5e5;
  background: #fff;
  cursor: pointer;
  ${fonts.medium24};

  &:hover {
    border-color: var(--c-grayC, #d1d5db);
  }

  &[aria-selected="true"] {
    background: var(--c-blue, #2563eb);
    color: var(--c-white, #fff);
    border-color: var(--c-blue, #2563eb);
  }

  &:focus {
    outline: none;
  }
  &:focus-visible {
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(37, 99, 235, 0.35);

    &[aria-selected="true"] {
      box-shadow: 0 0 0 2px var(--c-blue, #2563eb),
        0 0 0 6px rgba(37, 99, 235, 0.35);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: border-color 0.15s ease, box-shadow 0.15s ease,
      background-color 0.15s ease, color 0.15s ease;
  }

  @media (forced-colors: active) {
    &:focus-visible {
      outline: 5px solid var(--c-blue);
      outline-offset: 2px;
    }
  }
`;

const Panel = styled.section`
  display: grid;
  gap: 10px;

  &[hidden] {
    display: none !important;
  }
`;

const EmptyState = styled.p`
  margin: 0;
  color: var(--c-gray9, #666);
  font-size: 0.875rem;
`;
