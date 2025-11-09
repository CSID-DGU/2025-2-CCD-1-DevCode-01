// src/shared/useAudioRecorder.ts
import { useCallback, useEffect, useRef, useState } from "react";

type RecState = "idle" | "recording" | "paused";

export function useAudioRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  };

  const pickMime = () => {
    const cands = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
    ];
    for (const t of cands) {
      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported &&
        MediaRecorder.isTypeSupported(t)
      ) {
        return t;
      }
    }
    return "";
  };

  const start = useCallback(async () => {
    try {
      setError(null);
      setBlobUrl(null);
      setSeconds(0); // 재녹음 시 00:00부터
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMime();
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setBlobUrl(URL.createObjectURL(blob));
        chunksRef.current = [];
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setState("recording");
      startTimer();
    } catch (e) {
      // setError(e?.message ?? "마이크 권한 오류");
      setState("idle");
      clearTimer();
      console.log(e);
    }
  }, []);

  const pause = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      mr.pause();
      setState("paused");
      clearTimer(); // 시간 유지(멈춤)
    }
  }, []);

  const resume = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "paused") {
      mr.resume();
      setState("recording");
      startTimer();
    }
  }, []);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && (mr.state === "recording" || mr.state === "paused")) {
      mr.stop();
    }
    mediaRecorderRef.current = null;
    setState("idle");
    clearTimer(); // ⛔ setSeconds(0) 하지 않음 → 정지 시 표시 시간 유지
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { state, error, blobUrl, seconds, start, pause, resume, stop };
}
