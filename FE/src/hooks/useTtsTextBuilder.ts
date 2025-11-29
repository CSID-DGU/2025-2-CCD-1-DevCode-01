import { useCallback } from "react";
import { parseOcrSegments } from "@shared/ocr/parse";
import type { OcrSegment } from "@shared/ocr/types";
import { latexToMathML } from "@shared/math/mathjax";
import { mathmlToSpeech } from "@shared/math/sre";

export function useTtsTextBuilder() {
  const buildTtsText = useCallback(async (ocrRaw: string): Promise<string> => {
    const segments: OcrSegment[] = parseOcrSegments(ocrRaw);
    const parts: string[] = [];

    for (const seg of segments) {
      switch (seg.type) {
        case "text": {
          parts.push(seg.content);
          break;
        }

        case "code": {
          parts.push(`<코드>${seg.content}</코드>`);
          break;
        }

        case "math": {
          const latex = seg.content;

          const mml = await latexToMathML(latex);

          if (!mml) {
            parts.push(`<수식>${latex}</수식>`);
            break;
          }
          const speech = await mathmlToSpeech(mml);
          parts.push(`<수식>${speech}</수식>`);
          break;
        }

        default: {
          const _exhaustiveCheck: never = seg;
          console.warn(
            "[useTtsTextBuilder] 알 수 없는 세그먼트 타입:",
            _exhaustiveCheck
          );
        }
      }
    }

    return parts.join("\n");
  }, []);

  return { buildTtsText };
}
