import type { LectureNote } from "@apis/lecture/memo.api";

import { fonts } from "@styles/fonts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MemoItem, Role } from "src/hooks/useLectureMemoList";
import styled from "styled-components";

type Props = {
  items: MemoItem[];
  onSaveAll: (lines: { text: string; role?: Role }[]) => Promise<void>;
  iconOf: (role: Role) => string;
  stickyTop?: string;
  onFocusNote?: (note: LectureNote) => void;
};

const normalize = (s: string) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export default function MemoListCard({
  items,
  onSaveAll,
  iconOf,
  stickyTop = "0",
  onFocusNote,
}: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    const h = `${d.getHours()}`.padStart(2, "0");
    const min = `${d.getMinutes()}`.padStart(2, "0");
    return `${y}.${m}.${day} ${h}:${min}`;
  };

  const lastKey = useMemo(
    () => (items.length ? items[items.length - 1].createdAt : ""),
    [items]
  );

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lastKey]);

  const saveLines = async (raw: string) => {
    const lines = normalize(raw).map((text) => ({ text }));
    if (!lines.length) return;
    setBusy(true);
    try {
      await onSaveAll(lines);
      setSavedAt(Date.now());
      setValue("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleEnterSave = async () => {
    const text = value.trim();
    if (!text || busy) return;
    await saveLines(text);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = async (
    e
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleEnterSave();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      await handleEnterSave();
    }
  };

  const onPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = async (
    e
  ) => {
    const data = e.clipboardData.getData("text");
    if (!data.includes("\n")) return;
    e.preventDefault();
    await saveLines(data);
  };

  const onClickSave = async () => {
    if (!value.trim() || busy) return;
    await saveLines(value);
  };

  const statusText = busy ? "저장중" : savedAt ? "방금 저장됨" : "대기중";

  return (
    <Card aria-busy={busy}>
      <Header style={{ position: "sticky", top: stickyTop, zIndex: 1 }}>
        <TitleWrap>
          <h3 id="memo-heading">메모</h3>
        </TitleWrap>

        <RightWrap>
          <Status aria-live="polite" data-busy={busy}>
            <Dot data-busy={busy} />
            {statusText}
          </Status>
          <SaveButton
            type="button"
            onClick={onClickSave}
            disabled={busy || !value.trim()}
            aria-label="메모 저장"
          >
            저장
          </SaveButton>
        </RightWrap>
      </Header>

      <Hint>Enter 저장 · Shift+Enter 줄바꿈</Hint>

      <List
        ref={listRef}
        role="log"
        aria-labelledby="memo-heading"
        aria-live="polite"
      >
        {items.map((it, idx) => (
          <Row
            key={`${it.createdAt}-${idx}`}
            $role={it.role}
            tabIndex={0}
            onFocus={() => onFocusNote?.(it.note)}
          >
            <Icon aria-hidden="true">{iconOf(it.role)}</Icon>
            <Text>
              {it.text}
              <Time dateTime={it.createdAt}>
                {formatDateTime(it.createdAt)}
              </Time>
            </Text>
          </Row>
        ))}
      </List>

      <InputArea>
        <Textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="메모 입력 후 Enter 또는 [저장] 버튼"
          rows={3}
          disabled={busy}
          aria-label="메모 입력"
        />
      </InputArea>
    </Card>
  );
}

/* ---------- styles ---------- */
const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.75rem;
  max-height: 70vh;
  background: #fff8a7;
`;

const Header = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed ${({ theme }) => theme.colors.base.grayD};
`;

const TitleWrap = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  h3 {
    ${fonts.bold26}
    color: ${({ theme }) => theme.colors.base.black}
  }
`;

const Hint = styled.span`
  ${fonts.regular17}
  color: #6b7280;
  text-align: end;
`;

const RightWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Status = styled.div`
  ${fonts.medium24}
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  &[data-busy="true"] {
    color: #4f46e5;
  }
`;

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #9ca3af;

  &[data-busy="true"] {
    background: #4f46e5;
    animation: pulse 1s infinite ease-in-out;
  }

  @keyframes pulse {
    0% {
      opacity: 0.4;
      transform: scale(0.9);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0.4;
      transform: scale(0.9);
    }
  }
`;

const SaveButton = styled.button`
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: ${({ theme }) => theme.colors.base.blueD};
  color: #fff;
  ${fonts.bold20}
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const List = styled.div`
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 160px;
  max-height: 40vh;
  padding-right: 0.25rem;
`;

const Row = styled.div<{ $role: Role }>`
  display: grid;
  grid-template-columns: 1.75rem 1fr;
  align-items: start;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  background: ${({ $role, theme }) => {
    if ($role === "assistant") return theme.colors.base.white;
    if ($role === "student") return theme.colors.base.blueL;
    return "#f3f4f6";
  }};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.base.blueD};
    outline-offset: 2px;
  }
`;

const Icon = styled.div`
  font-size: 1.1rem;
  line-height: 1.75rem;
  text-align: center;
`;

const Text = styled.div`
  font-size: 0.95rem;
  line-height: 1.4;
  position: relative;
  padding-right: 6.5rem;
  word-break: break-word;
  color: ${({ theme }) => theme.colors.base.black};
  ${fonts.regular20}
`;

const Time = styled.time`
  position: absolute;
  right: 0;
  top: 0;
  font-size: 0.75rem;
  color: #9ca3af;
`;

const InputArea = styled.div`
  margin-top: 0.25rem;
`;

const Textarea = styled.textarea`
  width: 100%;
  resize: none;
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  outline: none;
  ${fonts.regular20}
  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }
`;
