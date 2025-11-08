import { useCallback } from "react";

export function initTTS() {
  const dummy = new SpeechSynthesisUtterance("준비 완료");
  dummy.lang = "ko-KR";
  dummy.volume = 100;
  window.speechSynthesis.speak(dummy);
  console.log("[TTS] engine initialized");
}

export function useLocalTTS() {
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    if (!text) return;

    const voices = window.speechSynthesis.getVoices();
    const koreanVoice =
      voices.find((v) => v.lang.startsWith("ko")) ||
      voices.find((v) => v.lang.startsWith("en")) ||
      null;

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    if (koreanVoice) utter.voice = koreanVoice;
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;

    utter.onstart = () => console.log("[TTS] ▶", text, koreanVoice?.name);
    utter.onerror = (e) => console.warn("[TTS] ❌", e);
    utter.onend = () => console.log("[TTS] ⏹ end");

    window.speechSynthesis.speak(utter);
  }, []);

  return { speak, stop };
}
