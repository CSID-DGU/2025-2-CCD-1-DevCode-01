import { useCallback, useEffect, useRef, useState } from "react";

/* Safari 호환 */
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

export interface AudioRecorder {
  state: RecorderState;
  seconds: number;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<Blob>; // 브라우저에 따라 webm / m4a / wav
}

export function useAudioRecorder(): AudioRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const tickStart = () => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  };
  const tickStop = () => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    const recState = recorderRef.current?.state;

    // 이미 녹음 중이면 그냥 무시
    if (recState === "recording") {
      console.log("[recorder] already recording");
      return;
    }

    // 일시정지 상태면 새 스트림 만들지 말고 재개
    if (recState === "paused") {
      recorderRef.current?.resume();
      tickStart();
      setState("recording");
      return;
    }

    // 여기까지 왔으면 inactive거나 처음 시작인 상태 → 새로 시작
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/mp4"; // Safari

    const rec = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.start(1000);
    recorderRef.current = rec;

    setSeconds(0);
    tickStart();
    setState("recording");
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current?.state !== "recording") return;
    recorderRef.current.pause();
    tickStop();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (recorderRef.current?.state !== "paused") return;
    recorderRef.current.resume();
    tickStart();
    setState("recording");
  }, []);

  const stop = useCallback(() => {
    return new Promise<Blob>((resolve) => {
      const rec = recorderRef.current;
      if (!rec) {
        return resolve(new Blob([], { type: "application/octet-stream" }));
      }

      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        chunksRef.current = [];

        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        tickStop();
        setState("stopped");
        recorderRef.current = null;
        resolve(blob);
      };

      try {
        rec.stop();
      } catch {
        resolve(new Blob([], { type: "application/octet-stream" }));
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        /*ignore*/
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      tickStop();
    };
  }, []);

  return { state, seconds, start, pause, resume, stop };
}
