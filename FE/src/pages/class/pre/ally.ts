// src/pages/class/Pre/a11y.ts
export const A11Y_STORAGE_KEYS = {
  font: "font",
  readOnFocus: "read_on_focus",
} as const;
const DEFAULT_FONT_PCT = 125;

export const readFontPct = (): number => {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEYS.font);
    const n = parseInt(raw ?? String(DEFAULT_FONT_PCT), 10);
    return Number.isFinite(n) ? n : DEFAULT_FONT_PCT;
  } catch {
    return DEFAULT_FONT_PCT;
  }
};

export const readReadOnFocus = (): boolean => {
  try {
    return localStorage.getItem(A11Y_STORAGE_KEYS.readOnFocus) === "1";
  } catch {
    return false;
  }
};

// SR 라이브영역 announce
export const makeAnnouncer = (el: HTMLElement | null) => (msg: string) => {
  if (el) el.textContent = msg;
};
