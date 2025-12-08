import { useContext, useMemo } from "react";
import { TTSContext } from "./TTSProvider";

type Options = {
  text?: string;
  fallbackFromAttr?: boolean;
  enabled?: boolean;
};

export function useFocusSpeak(opts: Options = {}) {
  const ctx = useContext(TTSContext);
  const { text, fallbackFromAttr = true, enabled = true } = opts;

  return useMemo(() => {
    if (!enabled) {
      return {
        onFocus: () => {},
        onBlur: () => {},
      };
    }

    const onFocus = (e: React.FocusEvent<HTMLElement>) => {
      if (!ctx) return;
      if (ctx.settings.trigger !== "focus") return;

      let toRead = text?.trim();
      if (!toRead && fallbackFromAttr) {
        const el = e.currentTarget;
        toRead =
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          el.textContent ||
          "";
      }
      toRead = toRead?.replace(/\s+/g, " ").trim();
      if (toRead) ctx.speak(toRead);
    };

    const onBlur = () => {
      ctx?.cancel();
    };

    return { onFocus, onBlur };
  }, [ctx, text, fallbackFromAttr, enabled]);
}
