import { applyUiScale } from "@shared/applyUiScale";
import { A11Y_STORAGE_KEYS } from "./a11y.constants";
import { normalizeFontToPct } from "./a11y.mappers";
import type { FontInput } from "./a11y.types";

export function migrateA11yKeysOnce() {
  const legacy = localStorage.getItem("mode");
  const hcStored = localStorage.getItem("high_contrast");

  if (legacy && hcStored == null) {
    const next = legacy === "hc";
    localStorage.setItem("high_contrast", String(next));
  }

  if (legacy != null) {
    localStorage.removeItem("mode");
  }
}

export function applyA11yFromStorage() {
  const raw = localStorage.getItem(A11Y_STORAGE_KEYS.font);
  const fontPct = normalizeFontToPct(raw);
  const hc = localStorage.getItem(A11Y_STORAGE_KEYS.hc) === "true";

  applyUiScale(fontPct);
  document.documentElement.classList.toggle("hc", hc);
}

export function setA11yAndApply(next: {
  font?: FontInput;
  high_contrast?: boolean;
}) {
  if (typeof next.font !== "undefined") {
    const pct = normalizeFontToPct(next.font);
    localStorage.setItem(A11Y_STORAGE_KEYS.font, String(pct));
    applyUiScale(pct);
  }
  if (typeof next.high_contrast === "boolean") {
    localStorage.setItem(A11Y_STORAGE_KEYS.hc, String(next.high_contrast));
    document.documentElement.classList.toggle("hc", next.high_contrast);
  }
}
