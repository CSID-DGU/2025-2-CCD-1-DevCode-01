// 속도 단계별 정보 (한 파일로 playbackRate만 조절)
export const SPEED = [
  { key: "verySlow", label: "가장 느리게", rate: 0.75 },
  { key: "slow", label: "느리게", rate: 0.9 },
  { key: "normal", label: "보통", rate: 1.0 },
  { key: "fast", label: "빠르게", rate: 1.25 },
  { key: "veryFast", label: "가장 빠르게", rate: 1.5 },
] as const;
export type SpeedKey = (typeof SPEED)[number]["key"];

export const VOICES = [
  { id: "female", label: "여성" },
  { id: "male", label: "남성" },
] as const;
export type VoiceId = (typeof VOICES)[number]["id"];

// 숫자 rate → speedKey 변환
export const rateToSpeedKey = (r: number): SpeedKey => {
  if (r <= 0.8) return "verySlow";
  if (r <= 0.95) return "slow";
  if (r <= 1.1) return "normal";
  if (r <= 1.35) return "fast";
  return "veryFast";
};
