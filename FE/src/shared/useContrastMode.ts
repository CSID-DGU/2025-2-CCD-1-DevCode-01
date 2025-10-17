import { useEffect, useState } from "react";
import { getMode, setMode, toggleMode, type Mode } from "./contrastMode";

export const useContrastMode = () => {
  const [mode, set] = useState<Mode>(getMode());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as Mode;
      set(detail);
    };
    window.addEventListener("modechange", onChange);
    return () => window.removeEventListener("modechange", onChange);
  }, []);

  return {
    mode,
    setMode: (m: Mode) => setMode(m),
    toggleMode: () => toggleMode(),
    isHC: mode === "hc",
  };
};
