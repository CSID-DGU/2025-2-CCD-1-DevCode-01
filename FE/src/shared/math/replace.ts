import { extractLatexBlocks, type LatexBlock } from "./latex";
import { latexToMathML } from "./mathjax";
import { mathmlToSpeech } from "./sre";

async function convertLatexBlock(block: LatexBlock): Promise<string> {
  const mathml = await latexToMathML(block.latex);

  if (!mathml) {
    return block.original;
  }

  const speech = await mathmlToSpeech(mathml);
  return speech;
}
export async function replaceLatexWithSpeech(text: string): Promise<string> {
  const blocks = extractLatexBlocks(text);
  if (blocks.length === 0) return text;

  let result = text;

  for (const block of blocks) {
    const speech = await convertLatexBlock(block);

    result = result.replace(block.original, `<수식>${speech}</수식>`);
  }

  return result;
}
