// OCR / 요약 텍스트에서 일반 텍스트, 코드 블록, 수식 블록을 파싱해서 리치하게 렌더링하는 공용 컴포넌트

import { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";

import { DOC_TEXT_MEASURE } from "@pages/class/pre/styles";
import { fonts } from "@styles/fonts";

import type { OcrSegment } from "@shared/ocr/types";
import { parseOcrSegments } from "@shared/ocr/parse";

type Props = {
  text: string;
};

export function RichOcrContent({ text }: Props) {
  const segments: OcrSegment[] = useMemo(() => parseOcrSegments(text), [text]);

  return (
    <div>
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return seg.content
            .split(/\n{2,}/)
            .map((block, i) => (
              <Paragraph key={`${idx}-text-${i}`}>{block.trim()}</Paragraph>
            ));
        }

        if (seg.type === "code") {
          return (
            <CodeBlock
              key={`${idx}-code`}
              tabIndex={0}
              aria-hidden="true"
              data-skip-focus-tts="true"
            >
              <code>{seg.content}</code>
            </CodeBlock>
          );
        }

        if (seg.type === "math") {
          return <MathBlock key={`${idx}-math`} latex={seg.content} />;
        }

        return null;
      })}
    </div>
  );
}

/* ---------- 수식 블록 (MathJax) ---------- */

type MathBlockProps = {
  latex: string;
};

function MathBlock({ latex }: MathBlockProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mj = (
      window as unknown as {
        MathJax?: { typesetPromise?: (nodes: Element[]) => Promise<unknown> };
      }
    ).MathJax;

    const root = ref.current;
    if (!mj?.typesetPromise || !root) return;

    mj.typesetPromise([root])
      .then(() => {
        const focusableSelector =
          'a, button, input, textarea, select, [tabindex], [contenteditable="true"], svg[focusable="true"]';

        root.querySelectorAll<HTMLElement>(focusableSelector).forEach((el) => {
          el.tabIndex = 0;
          el.setAttribute("aria-hidden", "true");
        });
      })
      .catch((err) => {
        console.error("[MathJax] typeset 실패:", err);
      });
  }, [latex]);

  return (
    <MathContainer
      ref={ref}
      aria-hidden="true"
      tabIndex={0}
      data-skip-focus-tts="true"
    >
      {"$$ " + latex + " $$"}
    </MathContainer>
  );
}

/* ---------- styled ---------- */

const Paragraph = styled.p`
  white-space: pre-wrap;
  line-height: 1.7;
  ${fonts.medium26};
  color: var(--c-black);
  letter-spacing: 0.002em;
  max-width: ${DOC_TEXT_MEASURE}ch;
  margin-bottom: 0.75rem;
`;

const CodeBlock = styled.pre`
  max-width: ${DOC_TEXT_MEASURE}ch;
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--c-grayL);
  ${fonts.regular20};
  color: var(--c-black);
  border-radius: 8px;
  overflow-x: auto;

  &:focus-visible {
    outline: none;
  }
`;

const MathContainer = styled.div`
  max-width: ${DOC_TEXT_MEASURE}ch;
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--c-grayL);
  border-radius: 8px;
  ${fonts.medium26};
  color: var(--c-black);
  overflow: auto;

  &:focus-visible {
    outline: none;
  }
`;
