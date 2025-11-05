export const VOICES = [
  { id: "female", label: "여성" },
  { id: "male", label: "남성" },
] as const;
export type VoiceId = (typeof VOICES)[number]["id"];

export const SPEED = [
  { key: "slow", label: "느림", rate: 0.9 },
  { key: "normal", label: "보통", rate: 1.0 },
  { key: "fast", label: "빠름", rate: 1.25 },
] as const;
export type SpeedKey = (typeof SPEED)[number]["key"];

export const rateToSpeedKey = (r: number): SpeedKey => {
  if (r <= 0.95) return "slow";
  if (r <= 1.12) return "normal";
  return "fast";
};

export const speedKeyToRate = (key: SpeedKey): number =>
  SPEED.find((s) => s.key === key)?.rate ?? 1.0;
