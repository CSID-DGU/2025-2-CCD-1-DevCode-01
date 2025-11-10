import { DEFAULT_FONT_PCT, FONT_RANGE } from "./a11y.constants";
import type { FontInput } from "./a11y.types";

const RANGE_MIN = Number(FONT_RANGE.min);
const RANGE_MAX = Number(FONT_RANGE.max);
const DEFAULT_NUM = Number(DEFAULT_FONT_PCT);

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
      return Number(trimmed);
    }
  }
  return undefined;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function normalizeFontToPct(input: FontInput): number {
  if (typeof input === "object" && input !== null) {
    const { pct } = input;

    const pctNum = toNumber(pct);
    if (pctNum !== undefined) {
      return clamp(pctNum, RANGE_MIN, RANGE_MAX);
    }

    return DEFAULT_NUM;
  }

  const directNum = toNumber(input);
  if (directNum !== undefined) {
    return clamp(directNum, RANGE_MIN, RANGE_MAX);
  }

  return DEFAULT_NUM;
}
