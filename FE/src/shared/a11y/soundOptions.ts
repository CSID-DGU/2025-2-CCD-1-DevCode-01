export const SOUND_RATES = ["느림", "보통", "빠름"] as const;
export const SOUND_VOICES = ["여성", "남성"] as const;

export type SoundRate = (typeof SOUND_RATES)[number];
export type SoundVoice = (typeof SOUND_VOICES)[number];

export const SOUND_LS_KEYS = {
  rate: "rate",
  voice: "voice",
} as const;

const isSoundRate = (v: string): v is SoundRate =>
  (SOUND_RATES as readonly string[]).includes(v);
const isSoundVoice = (v: string): v is SoundVoice =>
  (SOUND_VOICES as readonly string[]).includes(v);

export function readRateFromLS(fallback: SoundRate = "보통"): SoundRate {
  const raw = localStorage.getItem(SOUND_LS_KEYS.rate);
  return raw && isSoundRate(raw) ? raw : fallback;
}
export function readVoiceFromLS(fallback: SoundVoice = "여성"): SoundVoice {
  const raw = localStorage.getItem(SOUND_LS_KEYS.voice);
  return raw && isSoundVoice(raw) ? raw : fallback;
}
export function writeSoundToLS(rate: SoundRate, voice: SoundVoice): void {
  localStorage.setItem(SOUND_LS_KEYS.rate, rate);
  localStorage.setItem(SOUND_LS_KEYS.voice, voice);
  window.dispatchEvent(
    new CustomEvent("sound:change", {
      detail: { rate, voice },
    })
  );
}
