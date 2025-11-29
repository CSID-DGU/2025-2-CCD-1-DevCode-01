import { useEffect, useState } from "react";
import {
  readRateFromLS,
  readVoiceFromLS,
  SOUND_LS_KEYS,
  type SoundRate,
  type SoundVoice,
} from "@shared/a11y/soundOptions";

export function useSoundOptions(
  defaultRate: SoundRate = "보통",
  defaultVoice: SoundVoice = "여성"
) {
  const [soundRate, setSoundRate] = useState<SoundRate>(() =>
    readRateFromLS(defaultRate)
  );
  const [soundVoice, setSoundVoice] = useState<SoundVoice>(() =>
    readVoiceFromLS(defaultVoice)
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SOUND_LS_KEYS.rate) {
        setSoundRate(readRateFromLS(defaultRate));
      }
      if (e.key === SOUND_LS_KEYS.voice) {
        setSoundVoice(readVoiceFromLS(defaultVoice));
      }
    };

    const handleSoundChange = () => {
      setSoundRate(readRateFromLS(defaultRate));
      setSoundVoice(readVoiceFromLS(defaultVoice));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("sound:change", handleSoundChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "sound:change",
        handleSoundChange as EventListener
      );
    };
  }, [defaultRate, defaultVoice]);

  return { soundRate, soundVoice };
}

/** 재생 속도 조절 */
export function applyPlaybackRate(
  audio: HTMLAudioElement,
  rate: SoundRate
): void {
  audio.playbackRate = rate === "빠름" ? 1.4 : rate === "느림" ? 0.6 : 1.0;
}
