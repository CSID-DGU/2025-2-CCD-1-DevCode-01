import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import { useContrastMode } from "@shared/useContrastMode";
import {
  SIZE_PRESETS,
  DEFAULT_FONT_PCT,
  A11Y_STORAGE_KEYS,
} from "@shared/a11y/a11y.constants";
import { normalizeFontToPct } from "@shared/a11y/a11y.mappers";
import { setA11yAndApply } from "@shared/a11y/initA11y";
import { patchAccessibility } from "@apis/nav/a11y";
import { lockBodyScroll, unlockBodyScroll } from "@shared/ui/scrollLock";
import Portal from "@shared/ui/portal";
import { useModalFocusTrap } from "src/hooks/useModalFocusTrap";
import { useFocusSpeak } from "@shared/tts/useFocusSpeak";

type Props = {
  open: boolean;
  onClose: () => void;
  onApplied?: (v: { font: string; high_contrast: boolean }) => void;
};

export default function A11yModal({ open, onClose, onApplied }: Props) {
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  const { isHC, toggleMode } = useContrastMode();

  const getStoredFont = () =>
    (typeof window !== "undefined" &&
      localStorage.getItem(A11Y_STORAGE_KEYS.font)) ||
    DEFAULT_FONT_PCT;

  const initialHCRef = useRef<boolean>(isHC);

  const [, setDraftHC] = useState<boolean>(isHC);
  const [draftFont, setDraftFont] = useState<string>(getStoredFont());

  useEffect(() => {
    if (!open) return;
    initialHCRef.current = isHC;
    setDraftHC(isHC);
    setDraftFont(getStoredFont());
  }, [open, isHC]);

  const handleCancel = useCallback(() => {
    if (isHC !== initialHCRef.current) toggleMode();
    onClose();
  }, [isHC, toggleMode, onClose]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const firstFocusRef = useRef<HTMLDivElement | null>(null);

  const focusSpeak = useFocusSpeak();

  const { handleKeyDown } = useModalFocusTrap({
    open,
    containerRef: cardRef,
    initialFocusRef: firstFocusRef,
    onClose: handleCancel,
  });

  const onOverlayMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!cardRef.current) return;
    if (!cardRef.current.contains(e.target as Node)) handleCancel();
  };

  const onToggleHC = () => {
    setDraftHC((v) => !v);
    toggleMode();
  };

  const handleSave = async () => {
    setA11yAndApply({ font: draftFont, high_contrast: isHC });
    window.dispatchEvent(new Event("a11y-font-change"));

    const res = await patchAccessibility({
      font: draftFont,
      high_contrast: isHC,
    });

    if (!res) {
      console.error("접근성 설정 PATCH 실패", res);
    }

    onApplied?.({ font: draftFont, high_contrast: isHC });
    onClose();
  };

  const currentScaleNum = normalizeFontToPct(draftFont);

  if (!open) return null;

  return (
    <Portal>
      <Overlay role="presentation" onMouseDown={onOverlayMouseDown}>
        <Card
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="a11y-title"
          aria-describedby="a11y-desc"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          <Header>
            <h2 id="a11y-title">화면 설정</h2>
            <CloseBtn
              type="button"
              aria-label="모달 닫기"
              title="닫기"
              onClick={handleCancel}
              {...focusSpeak}
            >
              ×
            </CloseBtn>
          </Header>

          <Desc id="a11y-desc">
            고대비 모드와 글자 크기를 한 번에 설정하세요.
          </Desc>

          <Section>
            <SecTitle>고대비 모드</SecTitle>
            <Switch
              ref={firstFocusRef}
              role="switch"
              aria-checked={isHC}
              aria-label={`고대비 모드 ${isHC ? "켜짐" : "꺼짐"}`}
              tabIndex={0}
              onClick={onToggleHC}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleHC();
                }
              }}
              $on={isHC}
              {...focusSpeak}
            >
              <span className="track" />
              <span className="thumb" />
              <span className="label">{isHC ? "켜짐" : "꺼짐"}</span>
            </Switch>
          </Section>

          <Section>
            <SecTitle>글자 크기</SecTitle>
            <RadioRow role="radiogroup" aria-label="글자 크기 선택">
              {SIZE_PRESETS.map((opt) => (
                <RadioItem key={opt.valuePct}>
                  <input
                    type="radio"
                    id={`fz-${opt.valuePct}`}
                    name="font-size"
                    value={opt.valuePct}
                    checked={currentScaleNum === Number(opt.valuePct)}
                    onChange={() => setDraftFont(opt.valuePct)}
                    aria-label={`글자 크기 ${opt.label}`}
                    {...focusSpeak}
                  />
                  <label htmlFor={`fz-${opt.valuePct}`}>{opt.label}</label>
                </RadioItem>
              ))}
            </RadioRow>

            <ScalePreview style={{ fontSize: `${currentScaleNum}%` }}>
              가독성 미리보기 AaBb123 가독성 미리보기
            </ScalePreview>
          </Section>

          <Footer>
            <Btn
              type="button"
              data-variant="ghost"
              onClick={handleCancel}
              aria-label="닫기"
              {...focusSpeak}
            >
              취소
            </Btn>
            <Btn
              type="button"
              onClick={handleSave}
              aria-label="적용하기"
              {...focusSpeak}
            >
              적용하기
            </Btn>
          </Footer>
        </Card>
      </Overlay>
    </Portal>
  );
}

/* ---------- styled ---------- */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: clamp(12px, 4vh, 24px);
  touch-action: none;
`;

const Card = styled.div`
  width: min(720px, 100%);
  max-width: calc(100vw - 32px);
  max-height: min(88vh, 100dvh - 48px);
  overflow: auto;
  border-radius: 20px;
  background: var(--c-white);
  color: var(--c-black);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  padding: 24px 28px 20px;
  border: 1px solid var(--c-black);
  &:focus-within {
    outline: 2px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  h2 {
    ${fonts.bold32};
    margin: 0;
  }
`;

const CloseBtn = styled.button`
  all: unset;
  cursor: pointer;
  ${fonts.bold26};
  line-height: 1;
  padding: 0 6px;
  &:hover {
    transform: scale(1.1);
  }
`;

const Desc = styled.p`
  ${fonts.regular17};
  margin: 0 0 14px;
  color: var(--c-grayD);
`;

const Section = styled.section`
  border: 1px solid var(--c-grayD);
  border-radius: 16px;
  padding: 16px;
  margin-top: 14px;
  background: #fff;
`;

const SecTitle = styled.h3`
  ${fonts.bold20};
  margin: 0 0 12px;
  color: black;
`;

const Switch = styled.div<{ $on: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  .track {
    width: 46px;
    height: 24px;
    border-radius: 999px;
    background: ${({ $on }) => ($on ? "#2563eb" : "#d1d5db")};
    transition: background 0.15s ease;
  }
  .thumb {
    position: absolute;
    left: ${({ $on }) => ($on ? "26px" : "4px")};
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: white;
    border: 1px solid #9ca3af;
    transition: left 0.15s ease;
  }
  .label {
    ${fonts.medium24};
    color: #111827;
  }
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 3px;
  }
`;

const RadioRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
`;

const RadioItem = styled.div`
  display: inline-flex;
  align-items: center;
  color: black;
  gap: 6px;
  ${fonts.medium24};
  input[type="radio"] {
    width: 20px;
    height: 20px;
    accent-color: var(--c-yellowM);
    cursor: pointer;
    &:focus-visible {
      outline: 3px solid var(--c-blue);
      outline-offset: 2px;
    }
  }
`;

const ScalePreview = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--c-white);
  ${fonts.regular20};
  color: var(--c-black);
`;

const Footer = styled.div`
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const Btn = styled.button`
  ${fonts.medium24};
  height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  cursor: pointer;
  border: none;
  background: var(--c-blue);
  color: var(--c-white);
  &[data-variant="ghost"] {
    background: transparent;
    color: var(--c-blue);
    border: 2px solid var(--c-blue);
  }
  &:hover {
    opacity: 0.9;
  }
`;
