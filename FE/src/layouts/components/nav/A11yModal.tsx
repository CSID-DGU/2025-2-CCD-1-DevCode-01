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

type Props = {
  open: boolean;
  onClose: () => void;
  onApplied?: (v: { font: string; high_contrast: boolean }) => void;
};

export default function A11yModal({ open, onClose }: Props) {
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

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleCancel]);

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

    const res = await patchAccessibility({
      font: draftFont,
      high_contrast: isHC,
    });

    if (!res) {
      console.error("접근성 설정 PATCH 실패", res);
    }

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
        >
          <Header>
            <h2 id="a11y-title">화면 설정</h2>
            <CloseBtn aria-label="닫기" title="닫기" onClick={handleCancel}>
              ×
            </CloseBtn>
          </Header>

          <Desc id="a11y-desc">
            고대비 모드와 글자 크기를 한 번에 설정하세요.
          </Desc>

          <Section>
            <SecTitle>고대비 모드</SecTitle>
            <Switch
              role="switch"
              aria-checked={isHC}
              tabIndex={0}
              onClick={onToggleHC}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleHC();
                }
              }}
              $on={isHC}
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
            <Btn type="button" data-variant="ghost" onClick={handleCancel}>
              취소
            </Btn>
            <Btn type="button" onClick={handleSave}>
              적용하기
            </Btn>
          </Footer>
        </Card>
      </Overlay>
    </Portal>
  );
}

/* ---------------- styled ---------------- */
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
  transition: background 0.25s, color 0.25s;
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
    ${fonts.bold26};
    margin: 0;
  }
`;

const CloseBtn = styled.button`
  all: unset;
  cursor: pointer;
  ${fonts.bold26};
  line-height: 1;
  padding: 0 6px;
  color: var(--c-black);
  transition: transform 0.15s;

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
  border: 1px solid ${({ theme }) => theme.colors.base.grayD};
  border-radius: 16px;
  padding: 16px;
  margin-top: 14px;
  background: ${({ theme }) => theme.colors.base.white};
  transition: background 0.25s;
`;

const SecTitle = styled.h3`
  ${fonts.bold20};
  margin: 0 0 12px;
  color: ${({ theme }) => theme.colors.base.black};

  html.hc & {
    color: var(--c-white);
  }
`;

const Switch = styled.div<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: color 0.3s;

  /* 트랙 */
  .track {
    width: 56px;
    height: 28px;
    border-radius: 999px;
    position: relative;
    overflow: hidden;
    background: ${({ theme }) => theme.colors.base.grayL};
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.2);
    transition: background 0.35s ease;
  }

  .thumb {
    position: absolute;
    top: 7px;
    left: ${({ $on }) => ($on ? "30px" : "3px")};
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.base.blue};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1), background 0.35s ease;

    /* html.hc & {
      background: var(--c-black);
    } */
  }

  .label {
    ${fonts.medium24};
    min-width: 42px;
    text-align: left;
    color: ${({ theme }) => theme.colors.base.black};
    transition: color 0.3s;

    /* html.hc & {
      color: ${({ $on }) => ($on ? "var(--c-yellowM)" : "var(--c-beige)")};
    } */
  }
`;

const RadioRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
`;

const RadioItem = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.base.grayD};
  border-radius: 999px;
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--c-white);
  transition: background 0.25s;

  html.hc & {
    background: var(--c-grayX);
  }

  input {
    accent-color: var(--c-yellowM);
  }
  html.hc input {
    accent-color: var(--c-yellowM);
  }

  label {
    ${fonts.regular17};
    cursor: pointer;
    color: var(--c-black);

    html.hc & {
      color: var(--c-white);
    }
  }
`;

const ScalePreview = styled.div`
  border: 1px dashed ${({ theme }) => theme.colors.base.grayD};
  border-radius: 10px;
  padding: 12px;
  ${fonts.medium26};
  color: var(--c-black);
  background: var(--c-white);
  transition: background 0.25s, color 0.25s;

  html.hc & {
    color: var(--c-white);
    background: var(--c-grayX);
  }
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
  background: ${({ theme }) => theme.colors.base.blue};
  color: ${({ theme }) => theme.colors.base.white};
  transition: background 0.25s, color 0.25s;

  &[data-variant="ghost"] {
    background: transparent;
    color: var(--c-blue);
    border: 2px solid var(--c-blue);
  }

  html.hc & {
    background: var(--c-black);
    color: var(--c-white);

    &[data-variant="ghost"] {
      color: var(--c-yellowM);
      border-color: var(--c-yellowM);
      background: transparent;
    }
  }

  &:hover {
    opacity: 0.9;
  }
`;
