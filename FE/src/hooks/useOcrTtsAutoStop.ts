import { useEffect, useRef } from "react";

type Options = {
  /** 페이지/스크린 구분용 키 - 바뀌면 TTS 정지 */
  pageKey?: number | string | null;
  /** 모드 바뀌면 TTS 정지 */
  mode?: string;
  /** 이 영역 밖으로 포커스 나가면 TTS 정지 */
  areaRef?: React.RefObject<HTMLElement | null>;
  /** SR 라이브 영역에 읽어줄 함수 */
  announce?: (msg: string) => void;
  /** 포커스 벗어나서 끊길 때 안내 문구 */
  stopMessageOnBlur?: string;
  /** pageKey / mode 변경으로 끊길 때 안내 문구 */
  stopMessageOnChange?: string;
};

export function useOcrTtsAutoStop(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  {
    pageKey,
    mode,
    areaRef,
    announce,
    stopMessageOnBlur,
    stopMessageOnChange,
  }: Options
) {
  const lastPageKeyRef = useRef<typeof pageKey>(pageKey);
  const lastModeRef = useRef<typeof mode>(mode);

  // 1) 포커스가 areaRef 밖으로 나가면 정지
  useEffect(() => {
    const handleFocusIn = (event: Event) => {
      const audio = audioRef.current;
      const areaEl = areaRef?.current;
      if (!audio || !areaEl) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // 영역 안이면 유지
      if (areaEl.contains(target)) return;

      // 영역 밖으로 나갔으면 정지
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        if (stopMessageOnBlur && announce) {
          announce(stopMessageOnBlur);
        }
      }
    };

    window.addEventListener("focusin", handleFocusIn);
    return () => {
      window.removeEventListener("focusin", handleFocusIn);
    };
  }, [audioRef, areaRef, announce, stopMessageOnBlur]);

  // 2) pageKey나 mode가 바뀌면 정지
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      lastPageKeyRef.current = pageKey;
      lastModeRef.current = mode;
      return;
    }

    const pageChanged = lastPageKeyRef.current !== pageKey;
    const modeChanged = lastModeRef.current !== mode;

    if ((pageChanged || modeChanged) && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      if (stopMessageOnChange && announce) {
        announce(stopMessageOnChange);
      }
    }

    lastPageKeyRef.current = pageKey;
    lastModeRef.current = mode;
  }, [audioRef, pageKey, mode, announce, stopMessageOnChange]);
}
