// src/components/lecture/live/RightTabs.tsx
import React, { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";

type Role = "student" | "assistant";
type TabKey = "memo" | "board" | "summary";

type Props = {
  stack: boolean;
  activeInitial?: TabKey;
  role: Role;
  summary: {
    text: string;
    ttsUrl?: string;
    sumAudioRef: React.RefObject<HTMLAudioElement | null>;
    sidePaneRef: React.RefObject<HTMLDivElement | null>;
  };
  memo: { docId: number; page: number };
  board: { docId: number; page: number; canUpload: boolean };
};

export default function RightTabs({
  stack,
  activeInitial = "memo",
  // role,
  memo,
  board,
}: Props) {
  const [tab, setTab] = useState<TabKey>(activeInitial);

  // Stable ids for aria-controls/labeling
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

  // Roving tabindex for keyboard a11y
  const order: TabKey[] = ["memo", "board", "summary"];
  const listRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = {
    memo: useRef<HTMLButtonElement | null>(null),
    board: useRef<HTMLButtonElement | null>(null),
    summary: useRef<HTMLButtonElement | null>(null),
  };

  // Keyboard navigation: Left/Right/Home/End
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      const i = order.indexOf(tab);
      let next: TabKey | null = null;

      switch (e.key) {
        case "ArrowRight":
          next = order[(i + 1) % order.length];
          break;
        case "ArrowLeft":
          next = order[(i + order.length - 1) % order.length];
          break;
        case "Home":
          next = order[0];
          break;
        case "End":
          next = order[order.length - 1];
          break;
        default:
          break;
      }

      if (next) {
        e.preventDefault();
        setTab(next);
        btnRefs[next].current?.focus();
      }
    };

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [tab]);

  return (
    <Aside $stack={stack} aria-label="메모, 판서, 요약 패널">
      <Tablist ref={listRef} role="tablist" aria-label="우측 기능">
        <Tab
          ref={btnRefs.memo}
          id={tabIds.memo}
          role="tab"
          aria-selected={tab === "memo"}
          aria-controls={panelIds.memo}
          tabIndex={tab === "memo" ? 0 : -1}
          onClick={() => setTab("memo")}
          type="button"
        >
          메모
        </Tab>
        <Tab
          ref={btnRefs.board}
          id={tabIds.board}
          role="tab"
          aria-selected={tab === "board"}
          aria-controls={panelIds.board}
          tabIndex={tab === "board" ? 0 : -1}
          onClick={() => setTab("board")}
          type="button"
        >
          판서
        </Tab>
        <Tab
          ref={btnRefs.summary}
          id={tabIds.summary}
          role="tab"
          aria-selected={tab === "summary"}
          aria-controls={panelIds.summary}
          tabIndex={tab === "summary" ? 0 : -1}
          onClick={() => setTab("summary")}
          type="button"
        >
          요약
        </Tab>
      </Tablist>

      <Panel
        id={panelIds.memo}
        role="tabpanel"
        aria-labelledby={tabIds.memo}
        hidden={tab !== "memo"}
      >
        <MemoBox docId={memo.docId} page={memo.page} />
      </Panel>

      <Panel
        id={panelIds.board}
        role="tabpanel"
        aria-labelledby={tabIds.board}
        hidden={tab !== "board"}
      >
        <BoardBox
          docId={board.docId}
          page={board.page}
          canUpload={board.canUpload}
        />
      </Panel>

      <Panel
        id={panelIds.summary}
        role="tabpanel"
        aria-labelledby={tabIds.summary}
        hidden={tab !== "summary"}
      />
    </Aside>
  );
}

/* --- 스타일 --- */
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
  background: white;
  cursor: pointer;
  &[aria-selected="true"] {
    background: var(--c-blue);
    color: var(--c-white);
    border-color: var(--c-blue);
  }
`;
const Panel = styled.section`
  display: grid;
  gap: 10px;
`;

/* --- 더미 컴포넌트(후에 API 연결) --- */
function MemoBox({ docId, page }: { docId: number; page: number }) {
  // TODO: /api/page/{pageId}/memo (GET/PUT) 연결
  return (
    <section
      // 사용 표시: 디버깅/테스트용 data-attr로 보존
      data-doc-id={docId}
      data-page={page}
      aria-label={`메모 입력 패널 (문서 ${docId}, 페이지 ${page})`}
    >
      <textarea
        aria-label="메모 입력"
        style={{
          width: "100%",
          minHeight: 240,
          border: "1px solid var(--c-grayD),",
          padding: "1rem",
          borderRadius: "12px",
        }}
        placeholder="메모를 입력하세요…"
      />
    </section>
  );
}

function BoardBox({
  docId,
  page,
  canUpload,
}: {
  docId: number;
  page: number;
  canUpload: boolean;
}) {
  // TODO: 업로드 버튼(assistant만), 이미지 카드 리스트, 수정/삭제
  return (
    <section
      data-doc-id={docId}
      data-page={page}
      aria-label={`판서 패널 (문서 ${docId}, 페이지 ${page})`}
    >
      {canUpload && <button type="button">사진 업로드</button>}
      <div aria-label="판서 목록" />
    </section>
  );
}
