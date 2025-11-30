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
    if (state === "recording") return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/mp4"; // Safari (m4a)

    const rec = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.start(1000); // 1초 chunk로 안전
    recorderRef.current = rec;

    setSeconds(0);
    tickStart();
    setState("recording");
  }, [state]);

  const pause = useCallback(() => {
    if (state !== "recording") return;
    recorderRef.current?.pause();
    tickStop();
    setState("paused");
  }, [state]);

  const resume = useCallback(() => {
    if (state !== "paused") return;
    recorderRef.current?.resume();
    tickStart();
    setState("recording");
  }, [state]);

  const stop = useCallback(() => {
    return new Promise<Blob>((resolve) => {
      if (!recorderRef.current) {
        return resolve(new Blob([], { type: "application/octet-stream" }));
      }

      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorderRef.current?.mimeType || "audio/webm",
        });
        chunksRef.current = [];

        // stream 정리
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        tickStop();
        setState("stopped");
        resolve(blob);
      };

      try {
        recorderRef.current.stop();
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

// function encodeWAV(
//   buffers: Float32Array[],
//   inSampleRate: number,
//   targetSampleRate: number
// ): Blob {
//   let length = 0;
//   for (const b of buffers) length += b.length;
//   const mono = new Float32Array(length);
//   let offset = 0;
//   for (const b of buffers) {
//     mono.set(b, offset);
//     offset += b.length;
//   }

//   const resampled =
//     inSampleRate === targetSampleRate
//       ? mono
//       : resampleFloat32(mono, inSampleRate, targetSampleRate);

//   const bytesPerSample = 2;
//   const numChannels = 1;
//   const blockAlign = numChannels * bytesPerSample;
//   const byteRate = targetSampleRate * blockAlign;
//   const dataSize = resampled.length * bytesPerSample;

//   const buffer = new ArrayBuffer(44 + dataSize);
//   const view = new DataView(buffer);

//   const writeString = (dv: DataView, off: number, s: string) => {
//     for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
//   };

//   // RIFF
//   writeString(view, 0, "RIFF");
//   view.setUint32(4, 36 + dataSize, true);
//   writeString(view, 8, "WAVE");
//   // fmt
//   writeString(view, 12, "fmt ");
//   view.setUint32(16, 16, true);
//   view.setUint16(20, 1, true); // PCM
//   view.setUint16(22, numChannels, true);
//   view.setUint32(24, targetSampleRate, true);
//   view.setUint32(28, byteRate, true);
//   view.setUint16(32, blockAlign, true);
//   view.setUint16(34, 16, true); // bits per sample
//   // data
//   writeString(view, 36, "data");
//   view.setUint32(40, dataSize, true);

//   // samples
//   let pos = 44;
//   for (let i = 0; i < resampled.length; i++, pos += 2) {
//     const s = Math.max(-1, Math.min(1, resampled[i]));
//     view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
//   }

//   return new Blob([view], { type: "audio/wav" });
// }

// function resampleFloat32(
//   input: Float32Array,
//   inRate: number,
//   outRate: number
// ): Float32Array {
//   const ratio = outRate / inRate;
//   const newLen = Math.round(input.length * ratio);
//   const out = new Float32Array(newLen);

//   let idxFloat = 0;
//   for (let i = 0; i < newLen; i++) {
//     const idx = idxFloat | 0;
//     const frac = idxFloat - idx;

//     const s0 = input[idx] ?? 0;
//     const s1 = input[idx + 1] ?? s0;

//     out[i] = s0 + (s1 - s0) * frac;
//     idxFloat += 1 / ratio;
//   }
//   return out;
// }
