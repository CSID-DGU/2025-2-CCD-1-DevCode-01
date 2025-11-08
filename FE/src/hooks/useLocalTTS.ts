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

    // 안전망
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
    } catch {
      console.log("error");
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text) return;

    try {
      speechSynthesis.resume();
    } catch {
      console.log("error");
    }

    const voices = await ensureVoices();
    const v =
      voices.find((x) => x.lang?.toLowerCase().startsWith("ko")) ||
      voices.find((x) => x.lang?.toLowerCase().startsWith("en")) ||
      null;

    const needCancel = speechSynthesis.speaking || speechSynthesis.pending;
    if (needCancel) {
      await new Promise((r) => setTimeout(r, 80));
      try {
        speechSynthesis.cancel();
      } catch {
        console.log("error");
      }
      await new Promise((r) => setTimeout(r, 40)); // cancel 처리 시간
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (v) u.voice = v;
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;

    u.onstart = () => console.log("[TTS] ▶", text, v?.name);
    u.onerror = (e) => {
      // @ts-expect-ignore
      if (e?.error !== "canceled") console.warn("[TTS] ❌", e);
    };
    u.onend = () => console.log("[TTS] ⏹ end");

    try {
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn("[TTS] speak failed", e);
    }
  }, []);

  return { speak, stop };
}
