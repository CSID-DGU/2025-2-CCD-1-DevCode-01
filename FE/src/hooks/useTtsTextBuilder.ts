import { replaceLatexWithSpeech } from "@shared/math/replace";
import { useCallback } from "react";

export function useTtsTextBuilder() {
  const buildTtsText = useCallback(async (ocrText: string): Promise<string> => {
    if (!ocrText) return "";
    const replaced = replaceLatexWithSpeech(ocrText);
    return replaced;
  }, []);

  return { buildTtsText };
}
