import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";

type Props = {
  initialValue?: string;
  onSave?: (text: string) => Promise<void> | void;
  stickyTop?: string;
  title?: string;
  ariaLabel?: string;
};

export default function MemoCard({
  initialValue = "• 다음주까지 과제 제출\n• 수업 때 명찰 꼭 가져오기",
  onSave,
  stickyTop = "1rem",
  title = "MEMO",
  ariaLabel = "메모",
}: Props) {
  const [text, setText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [touched, setTouched] = useState(false);
  const liveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setText(initialValue);
    setTouched(false);
  }, [initialValue]);

  const handleSave = async () => {
    if (!onSave) return;
    try {
      setSaving(true);
      await onSave(text);
      setLastSaved(new Date());
      setTouched(false);
      requestAnimationFrame(() => {
        if (liveRef.current)
          liveRef.current.textContent = "메모가 저장되었습니다.";
      });
    } finally {
      setSaving(false);
    }
  };

  const isDisabled = saving || !touched || !text.trim();

  return (
    <Card $top={stickyTop} role="complementary" aria-label={ariaLabel}>
      <Hdr>
        <Title id="memo-title">{title}</Title>
        <Meta>
          {lastSaved ? (
            <span>
              마지막 저장:{" "}
              {lastSaved.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <span>아직 저장 전</span>
          )}
          {touched && <Dot aria-hidden>• 변경됨</Dot>}
        </Meta>
      </Hdr>

      <InputArea>
        <label className="sr-only" htmlFor="memo-input">
          메모 입력
        </label>
        <Input
          id="memo-input"
          value={text}
          placeholder="메시지 입력"
          onChange={(e) => {
            const val = e.target.value;

            const lines = val
              .split("\n")
              .map((line) => {
                const trimmed = line.trimStart();

                if (trimmed.length > 0 && !trimmed.startsWith("•")) {
                  return `• ${trimmed}`;
                }
                return line;
              })
              .join("\n");

            setText(lines);
            setTouched(true);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSave();
            } else if (e.key === "Enter") {
              setTimeout(() => {
                const el = e.target as HTMLTextAreaElement;
                const { selectionStart } = el;
                const val = el.value;
                const before = val.slice(0, selectionStart);
                const after = val.slice(selectionStart);
                const updated = `${before}• ${after}`;
                setText(updated);
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = selectionStart + 2;
                });
              }, 0);
            }
          }}
          aria-describedby="memo-title"
          aria-busy={saving}
        />
      </InputArea>

      <Toolbar>
        <Hint>⌘/Ctrl + Enter 로 저장</Hint>
        <Buttons>
          <SaveButton
            type="button"
            onClick={handleSave}
            disabled={isDisabled}
            aria-label="메모 저장"
          >
            {saving ? "저장 중…" : "저장"}
          </SaveButton>
        </Buttons>
      </Toolbar>

      {/* SR용 라이브 영역 */}
      <Live ref={liveRef} role="status" aria-live="polite" aria-atomic="true" />
    </Card>
  );
}

/* styled */
const Card = styled.section<{ $top: string }>`
  background: #fde68a;
  border-radius: 12px;
  padding: 1.25rem;
  gap: 1rem;
  display: flex;
  flex-direction: column;
  border: 1px solid #e6c65a;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: ${({ $top }) => $top};
  min-width: 280px;
`;

const Hdr = styled.div`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const Title = styled.h3`
  margin: 0;
  ${fonts.bold32};
  line-height: 1.1;
`;

const Meta = styled.div`
  ${fonts.regular17};
  color: ${({ theme }) => theme.colors.base.grayD};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Dot = styled.span`
  ${fonts.regular17};
  color: ${({ theme }) => theme.colors.base.blue};
`;

const InputArea = styled.div`
  margin-bottom: 0.75rem;
`;

const Input = styled.textarea`
  width: 100%;
  ${fonts.regular20};
  padding: 0.9rem 1rem;
  border: 2px solid var(--c-grayL);
  border-radius: 12px;
  background: #fff5d1;
  min-height: 15rem;
  resize: vertical;
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Hint = styled.span`
  ${fonts.regular17};
  color: ${({ theme }) => theme.colors.base.grayD};
`;

const Buttons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const SaveButton = styled.button`
  ${fonts.bold20};
  padding: 0.6rem 1rem;
  border-radius: 999px;
  border: 0;
  background: var(--c-white);
  color: var(--c-black);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transition: transform 0.02s ease-in-out;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &:active {
    transform: translateY(1px);
  }
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const Live = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
