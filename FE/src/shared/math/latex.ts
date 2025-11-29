type MathJaxGlobal = {
  tex2mmlPromise?: (
    tex: string,
    options?: Record<string, unknown>
  ) => Promise<string>;
  tex2mml?: (tex: string, options?: Record<string, unknown>) => string;
};

function getMathJax(): MathJaxGlobal | null {
  const w = window as unknown as { MathJax?: MathJaxGlobal };
  return w.MathJax ?? null;
}

export type LatexBlock = {
  original: string;
  latex: string;
};

//  OCR 텍스트에서 <수식> ... </수식> 형태의 LaTeX 블록들을 추출

export function extractLatexBlocks(text: string): LatexBlock[] {
  const blocks: LatexBlock[] = [];
  const regex = /<수식>([\s\S]*?)<\/수식>/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const [full, inner] = match;
    blocks.push({
      original: full,
      latex: inner.trim(),
    });
  }

  return blocks;
}

// LaTeX → MathML
export async function latexToMathML(latex: string): Promise<string | null> {
  const mj = getMathJax();
  if (!mj) return null;

  if (typeof mj.tex2mmlPromise === "function") {
    try {
      const mml = await mj.tex2mmlPromise(latex, { display: true });
      return mml;
    } catch (e) {
      console.error("[latexToMathML] tex2mmlPromise 실패:", e);
      return null;
    }
  }

  if (typeof mj.tex2mml === "function") {
    try {
      const mml = mj.tex2mml(latex, { display: true });
      return mml;
    } catch (e) {
      console.error("[latexToMathML] tex2mml 실패:", e);
      return null;
    }
  }

  console.warn("[latexToMathML] MathJax tex2mml API를 찾을 수 없습니다.");
  return null;
}
