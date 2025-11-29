// src/hooks/useOcrTtsAutoStop.ts
import { useEffect, type RefObject } from "react";

type ModeType = "ocr" | "image";

type Options = {
  /** 페이지 식별용 키(페이지 번호, pageId 등) - 바뀌면 자동으로 끊음 */
  pageKey?: number | string | null;
  /** 모드(ocr/image 등) - 바뀌면 자동으로 끊음 */
  mode?: ModeType;
  /** 포커스를 유지하고 싶은 본문 영역 */
  docBodyRef?: RefObject<HTMLElement | null>;
  /** 재생 중단 안내용 라이브 리전 announcer */
  announce?: (msg: string) => void;
  /** 포커스 빠져 나갈 때 멘트 커스터마이즈 */
  stopMessageOnBlur?: string;
  /** 페이지/모드 변경 시 멘트 커스터마이즈 */
  stopMessageOnChange?: string;
};

/**
 * OCR 페이지 TTS를 공통으로 제어하는 훅
 * - pageKey/모드 변경 시 오디오 정지
 * - 포커스가 docBodyRef 바깥으로 빠지면 정지
 */
export function useOcrTtsAutoStop(
  audioRef: RefObject<HTMLAudioElement | null>,
  {
    pageKey,
    mode,
    docBodyRef,
    announce,
    stopMessageOnBlur = "본문 음성 재생이 중지되었습니다.",
    stopMessageOnChange,
  }: Options
) {
  // 1) 페이지 key 변경 시 TTS 정지
  useEffect(() => {
    if (!pageKey) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;

    if (announce && stopMessageOnChange) {
      announce(stopMessageOnChange);
    }
  }, [pageKey, audioRef, announce, stopMessageOnChange]);

  // 2) 모드 변경 시 TTS 정지
  useEffect(() => {
    if (!mode) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;

    if (announce && stopMessageOnChange) {
      announce(stopMessageOnChange);
    }
  }, [mode, audioRef, announce, stopMessageOnChange]);

  // 3) 포커스가 docBodyRef 바깥으로 이동하면 TTS 정지
  useEffect(() => {
    if (!docBodyRef) return;

    const handleFocusIn = (event: FocusEvent) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      const target = event.target as HTMLElement | null;

      // 본문 영역 안이면 계속 재생
      if (target && docBodyRef.current?.contains(target)) {
        return;
      }

      // 그 외 요소로 포커스 이동 → 정지
      audio.pause();
      audio.currentTime = 0;

      if (announce) {
        announce(stopMessageOnBlur);
      }
    };

    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [audioRef, docBodyRef, announce, stopMessageOnBlur]);
}
