import { useCallback, useEffect } from "react";

let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;
let inited = false;

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReadyPromise) return voicesReadyPromise;

  voicesReadyPromise = new Promise((resolve) => {
    const cur = speechSynthesis.getVoices();
    if (cur.length) return resolve(cur);

    const handler = () => {
      const v = speechSynthesis.getVoices();
      resolve(v);
      speechSynthesis.onvoiceschanged = null;
    };
    speechSynthesis.onvoiceschanged = handler;

    setTimeout(() => {
      resolve(speechSynthesis.getVoices());
      speechSynthesis.onvoiceschanged = null;
    }, 1500);
  });

  return voicesReadyPromise;
}

export async function initTTS() {
  if (inited) return;
  inited = true;

  try {
    speechSynthesis.resume();
  } catch {
    console.log("error");
  }

  await ensureVoices();
  await new Promise((r) => setTimeout(r, 60));

  const u = new SpeechSynthesisUtterance("준비 완료");
  u.lang = "ko-KR";
  u.volume = 1;
  u.rate = 1;
  u.pitch = 1;

  u.onstart = () => console.log("[TTS] ▶ init");
  u.onerror = (e) => console.warn("[TTS] ❌ init", e);
  u.onend = () => console.log("[TTS] ⏹ init end");

  try {
    speechSynthesis.speak(u);
  } catch (e) {
    console.warn("[TTS] speak(init) failed", e);
  }
  console.log("[TTS] engine initialized");
}

export function useLocalTTS() {
  useEffect(() => {
    void ensureVoices();
  }, []);

  const stop = useCallback(() => {
    try {
      speechSynthesis.cancel();
      console.log("[TTS] stop() → cancel()");
    } catch (e) {
      console.warn("[TTS] stop() error", e);
    }
  }, []);

  const speak = useCallback(async (rawText: string) => {
    const text = (rawText ?? "").trim();
    if (!text) {
      console.warn("[TTS] speak() with empty text, skip");
      return;
    }

    // 1. 혹시 남은 발화 있으면 그냥 즉시 정리
    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
      }
    } catch (e) {
      console.warn("[TTS] pre-cancel error", e);
    }

    // 2. 보이스 준비
    let v: SpeechSynthesisVoice | null = null;
    try {
      const voices = await ensureVoices();
      v =
        voices.find((x) => x.lang?.toLowerCase().startsWith("ko")) ||
        voices.find((x) => x.lang?.toLowerCase().startsWith("en")) ||
        null;
    } catch (e) {
      console.warn("[TTS] ensureVoices error", e);
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (v) u.voice = v;
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;

    u.onstart = () =>
      console.log("[TTS] ▶ start", { len: text.length, voice: v?.name });
    u.onend = () => console.log("[TTS] ⏹ end");
    u.onerror = (e: SpeechSynthesisErrorEvent) => {
      console.warn("[TTS] ❌ utterance error", {
        error: e.error,
        message: e,
      });
    };

    try {
      console.log("[TTS] speak() 호출");
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn("[TTS] speechSynthesis.speak() 실패", e);
    }
  }, []);

  return { speak, stop };
}
