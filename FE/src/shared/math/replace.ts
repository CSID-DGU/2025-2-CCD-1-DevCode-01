import { extractLatexBlocks, type LatexBlock } from "./latex";
import { latexToMathML } from "./mathjax";
import { mathmlToSpeech } from "./sre";

function convertLatexBlock(block: LatexBlock): string {
  const mathml = latexToMathML(block.latex);
  const speech = mathmlToSpeech(mathml);
  return speech;
}

export function replaceLatexWithSpeech(text: string): string {
  const blocks = extractLatexBlocks(text);
  if (blocks.length === 0) return text;

  let result = text;
  for (const block of blocks) {
    const speech = convertLatexBlock(block);
    result = result.replace(block.original, speech);
  }
  return result;
}
