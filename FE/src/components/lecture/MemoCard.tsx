import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";

type Props = {
  initialValue?: string;
  onSave?: (text: string) => Promise<void> | void;
  stickyTop?: string;
  ariaLabel?: string;
};

export default function MemoCard({
  initialValue = "",
  onSave,
  stickyTop = "1rem",
  ariaLabel = "메모",
}: Props) {
  const [text, setText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const liveRef = useRef<HTMLDivElement | null>(null);

  const escapeRegex = useCallback(
    (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    []
  );

  const makeNormalizer = useCallback(
    (icon: string) => {
      const iconRe = new RegExp(
        `^\\s*(?:${escapeRegex(icon)}\\s+|•\\s+)+`,
        "u"
      );
      return (val: string) =>
        val
          .split("\n")
          .map((line) => {
            const stripped = line.replace(iconRe, "");
            const trimmed = stripped.trimStart();
            if (!trimmed) return "";
            return `${icon} ${trimmed}`;
          })
          .join("\n");
    },
    [escapeRegex]
  );

  const role = useMemo<"student" | "assistant">(() => {
    return localStorage.getItem("role") === "assistant"
      ? "assistant"
      : "student";
  }, []);

  const icon = role === "student" ? "🐰" : "🐣";

  const normalize = useMemo(() => makeNormalizer(icon), [icon, makeNormalizer]);

  useEffect(() => {
    setText(normalize(initialValue));
    setTouched(false);
  }, [initialValue, normalize]);

  const handleSave = async () => {
    if (!onSave) return;
    try {
      setSaving(true);
      await onSave(text);
      setTouched(false);
      requestAnimationFrame(() => {
        if (liveRef.current)
          liveRef.current.textContent = "메모가 저장되었습니다.";
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // @ts-expect-error isComposing
    if (e.nativeEvent?.isComposing) {
      setText(e.target.value);
      setTouched(true);
      return;
    }
    setText(normalize(e.target.value));
    setTouched(true);
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>
  ) => {
    setText(normalize(e.currentTarget.value));
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Enter") {
      setTimeout(() => {
        const el = e.target as HTMLTextAreaElement;
        setText(normalize(el.value));
      }, 0);
    }
  };

  const isDisabled = saving || !touched || !text.trim();

  return (
    <Card $top={stickyTop} role="complementary" aria-label={ariaLabel}>
      <Hdr>
        <Title id="memo-title">MEMO </Title>
        <Meta>{touched && <Dot aria-hidden>• 변경됨</Dot>}</Meta>
      </Hdr>

      <InputArea>
        <label className="sr-only" htmlFor="memo-input">
          메모 입력
        </label>
        <Input
          id="memo-input"
          value={text}
          placeholder="메시지 입력"
          onChange={handleChange}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleEnterKey}
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
  background: #fff5d1;
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid #e6c65a;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: ${({ $top }) => $top};
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Hdr = styled.div`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Title = styled.h3`
  margin: 0;
  ${fonts.bold20};
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

const InputArea = styled.div``;

const Input = styled.textarea`
  width: 100%;
  ${fonts.regular20};
  padding: 0.9rem 1rem;
  border: 2px solid var(--c-grayL);
  border-radius: 12px;
  background: #fff;
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

  &:active {
    transform: translateY(1px);
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
