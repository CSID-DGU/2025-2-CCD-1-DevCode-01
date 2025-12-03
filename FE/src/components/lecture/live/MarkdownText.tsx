import React, { useEffect, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import styled from "styled-components";
import { fonts } from "@styles/fonts";

import { parseOcrSegments } from "@shared/ocr/parse";
import type { OcrSegment } from "@shared/ocr/types";

function dropNodeRef<T>(props: T): T {
  if (!props) return props;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { node, ref, ...rest } = props as Record<string, unknown>;
  return rest as T;
}

export default function MarkdownText({ children }: { children: string }) {
  const components: Components = {
    h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
      <H1 {...dropNodeRef(props)} />
    ),
    h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
      <H2 {...dropNodeRef(props)} />
    ),
    h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
      <H3 {...dropNodeRef(props)} />
    ),
    p: (props: React.ComponentPropsWithoutRef<"p">) => (
      <P {...dropNodeRef(props)} />
    ),
    li: (props: React.ComponentPropsWithoutRef<"li">) => (
      <LI {...dropNodeRef(props)} />
    ),
    ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
      <UL {...dropNodeRef(props)} />
    ),
    ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
      <OL {...dropNodeRef(props)} />
    ),

    pre: (props: React.ComponentPropsWithoutRef<"pre">) => (
      <CodeBlock {...dropNodeRef(props)} />
    ),

    code: ({
      inline,
      className,
      children,
      ...rest
    }: {
      inline?: boolean;
      className?: string;
      children?: React.ReactNode;
    }) => {
      const cleaned = dropNodeRef(rest);

      if (inline) {
        return (
          <CodeInline className={className} {...cleaned}>
            {children}
          </CodeInline>
        );
      }
      return (
        <code className={className} {...cleaned}>
          {children}
        </code>
      );
    },
  };

  const hasCustom = /<수식>|<코드>/.test(children);

  // 1) 커스텀 태그(<수식>, <코드>)가 없으면 기존 그대로
  if (!hasCustom) {
    return (
      <Root>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={components}
        >
          {children}
        </ReactMarkdown>
      </Root>
    );
  }

  // 2) 커스텀 태그가 있으면 OcrSegment로 파싱해서 처리하기 ~
  //    - text  -> ReactMarkdown
  //    - code  -> 코드 블록
  //    - math  -> MathJax 블록
  const segments: OcrSegment[] = parseOcrSegments(children);

  return (
    <Root>
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          if (!seg.content.trim()) return null;
          return (
            <ReactMarkdown
              key={`md-${idx}`}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={components}
            >
              {seg.content}
            </ReactMarkdown>
          );
        }

        if (seg.type === "code") {
          return (
            <CodeBlock
              key={`code-${idx}`}
              tabIndex={-1}
              aria-hidden="true"
              data-skip-focus-tts="true"
            >
              <code>{seg.content}</code>
            </CodeBlock>
          );
        }

        if (seg.type === "math") {
          return <MathBlock key={`math-${idx}`} latex={seg.content} />;
        }

        return null;
      })}
    </Root>
  );
}

/* ---------- MathJax 블록 ---------- */

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

    mj.typesetPromise([root]).catch((err) => {
      console.error("[MarkdownText/MathJax] typeset 실패:", err);
    });
  }, [latex]);

  return (
    <MathContainer
      ref={ref}
      tabIndex={-1}
      aria-hidden="true"
      data-skip-focus-tts="true"
    >
      {"$$ " + latex + " $$"}
    </MathContainer>
  );
}

/* ---- styles ---- */
const Root = styled.div`
  line-height: 1.7;
  color: var(--c-black);
  word-break: break-word;
  white-space: normal;
  ${fonts.regular20}
`;

const P = styled.p`
  ${fonts.regular20}
`;

const H1 = styled.h1`
  ${fonts.medium26}
`;

const H2 = styled.h2`
  font-size: 1.25rem;
  margin: 0.6rem 0;
  ${fonts.medium26}
`;

const H3 = styled.h3`
  font-size: 1.1rem;
  margin: 0.6rem 0;
  ${fonts.medium26}
`;

const UL = styled.ul`
  padding-left: 1.25rem;
  ${fonts.regular20}
  margin: 0.4rem 0;
`;

const OL = styled.ol`
  padding-left: 1.25rem;
  margin: 0.4rem 0;
  ${fonts.regular20}
`;

const LI = styled.li`
  margin: 0.2rem 0;
  ${fonts.regular20}
`;

const CodeInline = styled.code`
  padding: 0 4px;
  border-radius: 4px;
  background: #f3f4f6;
  ${fonts.regular20}
`;

const CodeBlock = styled.pre`
  padding: 10px;
  border-radius: 8px;
  background: #f3f4f6;
  overflow: auto;
  ${fonts.regular20}
`;

const MathContainer = styled.div`
  max-width: 60ch;
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--c-grayL);
  border-radius: 8px;
  ${fonts.medium26};
  color: var(--c-black);
  overflow: auto;
`;
