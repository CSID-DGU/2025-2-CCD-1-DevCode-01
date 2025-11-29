export function latexToMathML(latex: string): string {
  const mj = window.MathJax;

  if (!mj || typeof mj.tex2mml !== "function") {
    console.warn("[MathJax] tex2mml 사용 불가, 원본 LaTeX 그대로 반환:", latex);
    return latex;
  }

  try {
    return mj.tex2mml(latex);
  } catch (e) {
    console.error("[MathJax] tex2mml 변환 실패:", e);
    return latex;
  }
}
