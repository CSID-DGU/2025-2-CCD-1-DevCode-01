// ocr text에서 latex 코드, 수식 블록 추출

export type LatexBlock = {
  original: string;
  latex: string;
};

const LATEX_REGEX = /\${1,2}([^$]+)\${1,2}|\\\(([^)]+)\\\)|\\\[([^\]]+)\\\]/g;

export function extractLatexBlocks(text: string): LatexBlock[] {
  const blocks: LatexBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = LATEX_REGEX.exec(text)) !== null) {
    const original = match[0];
    const latex = match[1] || match[2] || match[3];

    if (latex) {
      blocks.push({ original, latex: latex.trim() });
    }
  }

  return blocks;
}
