import type { OcrSegment } from "./parse";

const BLOCK_REGEX = /<(수식|코드)>([\s\S]*?)<\/\1>/g;

export function parseOcrSegments(raw: string): OcrSegment[] {
  const segments: OcrSegment[] = [];

  if (!raw) return segments;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK_REGEX.exec(raw)) !== null) {
    const [full, tag, inner] = match;
    const index = match.index;

    // 일반 텍스트
    if (index > lastIndex) {
      const prev = raw.slice(lastIndex, index);
      if (prev.trim().length > 0) {
        segments.push({
          type: "text",
          content: prev,
        });
      }
    }

    // 블록
    const trimmedInner = inner.trim();

    if (tag === "코드") {
      segments.push({
        type: "code",
        content: trimmedInner,
      });
    } else if (tag === "수식") {
      segments.push({
        type: "math",
        content: trimmedInner,
      });
    }

    lastIndex = index + full.length;
  }

  // 3) 마지막 꼬리 텍스트
  if (lastIndex < raw.length) {
    const tail = raw.slice(lastIndex);
    if (tail.trim().length > 0) {
      segments.push({
        type: "text",
        content: tail,
      });
    }
  }

  return segments;
}
