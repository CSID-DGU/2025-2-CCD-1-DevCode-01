import { DOC_TEXT_MEASURE, PANEL_FIXED_H } from "@pages/class/pre/styles";
import { fonts } from "@styles/fonts";
import Spinner from "src/components/common/Spinner";
import styled from "styled-components";

type Props = {
  mode: "ocr" | "image";
  ocrText: string;
  imageUrl?: string | null;
  ocrAudioRef: React.RefObject<HTMLAudioElement | null>;
  docBodyRef: React.RefObject<HTMLDivElement | null>;
  mainRegionRef: React.RefObject<HTMLDivElement | null>;
};

export default function DocPane({
  mode,
  ocrText,
  imageUrl,
  ocrAudioRef,
  docBodyRef,
  mainRegionRef,
}: Props) {
  const isOcrLoading = mode === "ocr" && !ocrText;
  const isImageLoading = mode === "image" && !imageUrl;

  return (
    <Pane
      ref={mainRegionRef}
      role="region"
      aria-label={mode === "ocr" ? "교안 본문 텍스트" : "교안 원본 이미지"}
      tabIndex={-1}
    >
      <Body
        ref={docBodyRef}
        tabIndex={0}
        role="group"
        aria-label={mode === "ocr" ? "본문 영역" : "원본 이미지 영역"}
        data-area="doc-body"
      >
        {mode === "image" ? (
          isImageLoading ? (
            <LoadingBox role="status" aria-live="polite">
              <Spinner aria-hidden="true" />
              <span>이미지를 불러오는 중입니다...</span>
            </LoadingBox>
          ) : (
            imageUrl && <Image src={imageUrl} alt="교안 원본 이미지" />
          )
        ) : (
          <section>
            {!isOcrLoading && (
              <SrOnlyFocusable
                type="button"
                onClick={() => ocrAudioRef.current?.play()}
                aria-label="본문 TTS 재생"
              >
                본문 듣기
              </SrOnlyFocusable>
            )}

            {isOcrLoading ? (
              <LoadingBox role="status" aria-live="polite">
                <Spinner aria-hidden="true" />
                <span>본문을 처리하는 중입니다...</span>
              </LoadingBox>
            ) : (
              <Paragraph>{ocrText}</Paragraph>
            )}
          </section>
        )}
      </Body>
    </Pane>
  );
}

/* styled */
const Pane = styled.div`
  background: var(--c-white);
  border: 1px solid #e7eef6;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  height: ${PANEL_FIXED_H};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Body = styled.div`
  flex: 1 1 auto;
  overflow: auto;
  padding: clamp(16px, 2.2vw, 24px);
  overscroll-behavior: contain;
  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
    border-radius: 8px;
  }
  p,
  li {
    max-width: ${DOC_TEXT_MEASURE}ch;
  }
`;

const Image = styled.img`
  width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid #eef2f7;
  background: #fafafa;
`;

const Paragraph = styled.p`
  white-space: pre-wrap;
  line-height: 1.7;
  ${fonts.medium26};
  color: var(--c-black);
  letter-spacing: 0.002em;
`;

const LoadingBox = styled.div`
  border: 1px solid #d6e2f0;
  border-radius: 10px;
  padding: 28px;
  color: #6b7280;
  text-align: center;
  background: ${({ theme }) => theme.colors.base.white};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  span {
    ${fonts.medium26};
  }
`;

const SrOnlyFocusable = styled.button`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  overflow: hidden;
  &:focus {
    outline: none;
  }
`;
