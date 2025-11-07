export const A11Y_STORAGE_KEYS = {
  font: "font",
  hc: "high_contrast",
} as const;

export const DEFAULT_FONT_PCT = "125";

export const FONT_RANGE = { min: "100", max: "400" } as const;

export const SIZE_PRESETS = [
  { id: "normal", label: "보통", valuePct: "125" },
  { id: "large", label: "크게", valuePct: "150" },
  { id: "xlarge", label: "매우 크게", valuePct: "175" },
  { id: "xxlarge", label: "가장 크게", valuePct: "200" },
] as const;
