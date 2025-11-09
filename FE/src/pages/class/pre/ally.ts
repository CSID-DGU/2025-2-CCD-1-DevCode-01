// src/pages/class/Pre/a11y.ts
import type { RefObject } from "react";

/** 접근성 관련 localStorage 키 */
export const A11Y_STORAGE_KEYS = {
  font: "font",
  readOnFocus: "read_on_focus",
} as const;

/** 기본 폰트 배율 (%) */
const DEFAULT_FONT_PCT = 125;

/** 저장된 폰트 배율 읽기 */
export const readFontPct = (): number => {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEYS.font);
    const n = parseInt(raw ?? String(DEFAULT_FONT_PCT), 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FONT_PCT;
  } catch {
    return DEFAULT_FONT_PCT;
  }
};

/** 포커스 시 읽기 활성화 여부 읽기 */
export const readReadOnFocus = (): boolean => {
  try {
    return localStorage.getItem(A11Y_STORAGE_KEYS.readOnFocus) === "1";
  } catch {
    return false;
  }
};

/**
 * 스크린리더용 라이브영역에 메시지를 전달하는 함수 생성
 * ref 또는 HTMLElement 자체를 모두 지원
 */
export function makeAnnouncer(
  target: RefObject<HTMLElement | null> | HTMLElement | null
) {
  return (msg: string) => {
    const el =
      target && "current" in target
        ? target.current
        : (target as HTMLElement | null);

    if (el) {
      el.textContent = msg;
      // SR 업데이트 타이밍 확보 (리렌더링 유도)
      setTimeout(() => {
        el.textContent = msg;
      }, 50);
    }
  };
}
