import { useEffect, useRef } from "react";

type Opts = {
  enabled: boolean;
  mode: "ocr" | "image";
  page: number;
  docContainerRef: React.RefObject<HTMLElement | null>;
  sumContainerRef: React.RefObject<HTMLElement | null>;
  ocrAudioRef: React.RefObject<HTMLAudioElement | null>;
  sumAudioRef: React.RefObject<HTMLAudioElement | null>;
  announce?: (msg: string) => void;
};

export function useFocusTTS({
  enabled,
  mode,
  page,
  docContainerRef,
  sumContainerRef,
  ocrAudioRef,
  sumAudioRef,
  announce,
}: Opts) {
  const docTimer = useRef<number | null>(null);
  const sumTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const docEl = docContainerRef.current;
    const sumEl = sumContainerRef.current;
    if (!docEl && !sumEl) return;

    const debug = (...a: unknown[]) => console.log("[FocusTTS]", ...a);
    const pauseAll = () => {
      try {
        ocrAudioRef.current?.pause();
      } catch {
        console.log("error");
      }
      try {
        sumAudioRef.current?.pause();
      } catch {
        console.log("error");
      }
    };
    const tryPlay = async (who: "ocr" | "summary") => {
      const el = who === "ocr" ? ocrAudioRef.current : sumAudioRef.current;
      const src = el?.currentSrc || el?.src;
      debug(`tryPlay(${who})`, { hasEl: !!el, src, mode, page });
      if (!el) return;
      try {
        el.currentTime = 0;
        await el.play();
        debug(`play ok: ${who}`);
      } catch (err) {
        debug(`play failed: ${who}`, err);
        announce?.(
          who === "ocr"
            ? "자동 재생이 차단되었습니다. 엔터를 눌러 본문 듣기를 시작하세요."
            : "자동 재생이 차단되었습니다. 엔터를 눌러 요약 듣기를 시작하세요."
        );
      }
    };

    const debounce = (fn: () => void, which: "doc" | "sum", delay = 120) => {
      const id = window.setTimeout(fn, delay) as unknown as number;
      if (which === "doc") docTimer.current = id;
      else sumTimer.current = id;
    };

    const onDocFocusIn = (e: FocusEvent) => {
      debug("focusin: doc-body", e.target);
      if (mode !== "ocr") return;
      pauseAll();
      debounce(() => void tryPlay("ocr"), "doc");
    };
    const onSumFocusIn = (e: FocusEvent) => {
      debug("focusin: summary-pane", e.target);
      pauseAll();
      debounce(() => void tryPlay("summary"), "sum");
    };

    docEl?.addEventListener("focusin", onDocFocusIn);
    sumEl?.addEventListener("focusin", onSumFocusIn);

    return () => {
      if (docTimer.current) clearTimeout(docTimer.current);
      if (sumTimer.current) clearTimeout(sumTimer.current);
      docEl?.removeEventListener("focusin", onDocFocusIn);
      sumEl?.removeEventListener("focusin", onSumFocusIn);
    };
  }, [
    enabled,
    mode,
    page,
    docContainerRef,
    sumContainerRef,
    ocrAudioRef,
    sumAudioRef,
    announce,
  ]);
}
