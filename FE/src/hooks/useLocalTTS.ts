import { useCallback, useContext } from "react";
import { TTSContext, type TTSSettings } from "@shared/tts/TTSProvider";

export async function initTTS() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.resume();
    console.log("[TTS] engine resume");
  } catch (e) {
    console.warn("[TTS] initTTS resume error", e);
  }
}

export function useLocalTTS() {
  const ctx = useContext(TTSContext);

  const speak = useCallback(
    (
      rawText: string,
      opts?: Partial<Pick<TTSSettings, "rate" | "pitch" | "volume" | "lang">>
    ) => {
      if (!ctx) {
        console.warn("[useLocalTTS] TTSContext not found");
        return;
      }

      const text = (rawText ?? "").trim();
      if (!text) {
        console.warn("[useLocalTTS] speak() with empty text, skip");
        return;
      }

      ctx.speak(text, opts);
    },
    [ctx]
  );

  const stop = useCallback(() => {
    if (!ctx) return;
    ctx.cancel();
  }, [ctx]);

  return {
    speak,
    stop,
    settings: ctx?.settings,
  };
}
