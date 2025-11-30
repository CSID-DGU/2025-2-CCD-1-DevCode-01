import { DOC_TEXT_MEASURE, PANEL_FIXED_H } from "@pages/class/pre/styles";
import { fonts } from "@styles/fonts";
import { RichOcrContent } from "src/components/common/RichOcrContent";
import Spinner from "src/components/common/Spinner";
import styled from "styled-components";

type Props = {
  mode: "ocr" | "image";
  ocrText: string;
  imageUrl?: string | null;
  docBodyRef: React.RefObject<HTMLDivElement | null>;
  mainRegionRef: React.RefObject<HTMLDivElement | null>;
  onPlayOcrTts?: () => void;
  ocrTtsLoading?: boolean;
};

export default function DocPane({
  mode,
  ocrText,
  imageUrl,
  docBodyRef,
  mainRegionRef,
  onPlayOcrTts,
  ocrTtsLoading,
}: Props) {
  const isOcrLoading = mode === "ocr" && !ocrText;
  const isImageLoading = mode === "image" && !imageUrl;

  return (
    <Pane
      ref={mainRegionRef}
      role="region"
      aria-label={mode === "ocr" ? "교안 본문 텍스트" : "교안 원본 이미지"}
      tabIndex={0}
      onFocus={() => {
        if (onPlayOcrTts && mode === "ocr" && !isOcrLoading) {
          onPlayOcrTts();
        }
      }}
    >
      <Body
        ref={docBodyRef}
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
            {onPlayOcrTts && !isOcrLoading && (
              <SrOnlyFocusable
                type="button"
                onClick={onPlayOcrTts}
                disabled={ocrTtsLoading}
                aria-label={
                  ocrTtsLoading ? "본문 음성을 준비 중입니다" : "본문 TTS 재생"
                }
              />
            )}

            {isOcrLoading ? (
              <LoadingBox role="status" aria-live="polite">
                <Spinner aria-hidden="true" />
                <span>본문을 처리하는 중입니다...</span>
              </LoadingBox>
            ) : (
              <RichOcrContent text={ocrText} />
            )}
          </section>
        )}
      </Body>
    </Pane>
  );
}

/* ---------- styled ---------- */

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
    outline: 2px solid var(--c-blue);
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

const LoadingBox = styled.div`
  border: 1px solid #d6e2f0;
  border-radius: 10px;
  padding: 28px;
  color: var(--c-black);
  text-align: center;
  background: var(--c-white);
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
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
