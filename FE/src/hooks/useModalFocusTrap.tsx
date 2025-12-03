import { useCallback, useEffect, useRef } from "react";

type UseModalFocusTrapOptions = {
  open: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onClose?: () => void;
};

export function useModalFocusTrap({
  open,
  containerRef,
  initialFocusRef,
  onClose,
}: UseModalFocusTrapOptions) {
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    const root = containerRef.current;
    if (!root) return [];

    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => {
      if (el.hasAttribute("disabled")) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return true;
    });

    return nodes;
  }, [containerRef]);

  useEffect(() => {
    if (!open) return;

    previousActiveRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    const t = window.setTimeout(() => {
      const target =
        initialFocusRef?.current || getFocusableElements()[0] || null;
      target?.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
    };
  }, [open, initialFocusRef, getFocusableElements]);

  useEffect(() => {
    if (open) return;

    const prev = previousActiveRef.current;
    if (prev && typeof prev.focus === "function") {
      const t = window.setTimeout(() => {
        try {
          prev.focus();
        } catch {
          // ignore
        }
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!open) return;

      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key !== "Tab") return;

      const focusables = getFocusableElements();
      if (!focusables.length) return;

      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? focusables.indexOf(active) : -1;

      if (e.shiftKey) {
        if (currentIndex <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        }
        return;
      }

      if (currentIndex === -1 || currentIndex === focusables.length - 1) {
        e.preventDefault();
        focusables[0].focus();
      }
    },
    [open, getFocusableElements, onClose]
  );

  return { handleKeyDown };
}
