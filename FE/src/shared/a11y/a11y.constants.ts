export const A11Y_STORAGE_KEYS = {
  font: "font",
  hc: "high_contrast",
} as const;

export const DEFAULT_FONT_PCT = "125";

export const FONT_RANGE = { min: "100", max: "400" } as const;

export const SIZE_PRESETS = [
  { id: "normal", label: "100%", valuePct: "100" },
  { id: "mid", label: "125%", valuePct: "125" },
  { id: "large", label: "150%", valuePct: "150" },
  { id: "xlarge", label: "175%", valuePct: "175" },
  { id: "xxlarge", label: "200%", valuePct: "200" },
  { id: "max", label: "300%", valuePct: "300" },
] as const;
