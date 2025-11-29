import { useCallback, useEffect, useState, type FocusEvent } from "react";
import styled from "styled-components";

import { PANEL_FIXED_H } from "@pages/class/pre/styles";
import { fonts } from "@styles/fonts";
import Spinner from "src/components/common/Spinner";

import {
  readRateFromLS,
  SOUND_LS_KEYS,
  type SoundRate,
} from "@shared/a11y/soundOptions";
import { RichOcrContent } from "src/components/common/RichOcrContent";

type Props = {
  summaryText?: string | null;
  summaryTtsUrl?: string | null;
  sidePaneRef: React.RefObject<HTMLDivElement | null>;
  sumAudioRef: React.RefObject<HTMLAudioElement | null>;
  stack: boolean;
  panelHeight?: string;
  loading?: boolean;
};

export default function SummaryPane({
  summaryText,
  summaryTtsUrl,
  sidePaneRef,
  sumAudioRef,
  stack,
  panelHeight,
  loading,
}: Props) {
  /* ----- 사운드 옵션(속도) ----- */
  const [soundRate, setSoundRate] = useState<SoundRate>(() =>
    readRateFromLS("보통")
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SOUND_LS_KEYS.rate) {
        setSoundRate(readRateFromLS("보통"));
      }
    };

    const handleSoundChange = () => {
      setSoundRate(readRateFromLS("보통"));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("sound:change", handleSoundChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "sound:change",
        handleSoundChange as EventListener
      );
    };
  }, []);

  /* ----- 요약 TTS 재생 ----- */
  const playSummaryTts = useCallback(async () => {
    console.log("[SummaryPane] summaryTtsUrl =", summaryTtsUrl);
    console.log(
      "[SummaryPane] audio src before play =",
      sumAudioRef.current?.src
    );

    if (!summaryTtsUrl) return;
    const audio = sumAudioRef.current;
    if (!audio) return;

    // src 보정
    if (!audio.src || audio.src !== summaryTtsUrl) {
      audio.src = summaryTtsUrl;
    }

    // 속도 반영
    audio.playbackRate =
      soundRate === "빠름" ? 1.4 : soundRate === "느림" ? 0.85 : 1.0;

    audio.currentTime = 0;
    try {
      await audio.play();
    } catch (err) {
      console.error("[SummaryPane] 요약 TTS 재생 실패:", err);
    }
  }, [summaryTtsUrl, sumAudioRef, soundRate]);

  const handlePaneFocus = (e: FocusEvent<HTMLElement>) => {
    if (e.currentTarget !== e.target) return;
    if (!loading && summaryTtsUrl) {
      void playSummaryTts();
    }
  };

  return (
    <Pane
      ref={sidePaneRef}
      $stack={stack}
      $height={panelHeight}
      role="complementary"
      aria-label="요약"
      tabIndex={0}
      data-area="summary-pane"
      aria-busy={!!loading}
      onFocus={handlePaneFocus}
    >
      <Header>
        <Title>요약</Title>

        <SrOnlyFocusable
          type="button"
          onClick={() => {
            void playSummaryTts();
          }}
          aria-label={loading ? "요약을 불러오는 중입니다" : "요약 TTS 재생"}
        >
          요약 듣기
        </SrOnlyFocusable>

        {summaryTtsUrl && <audio ref={sumAudioRef} preload="none" />}
      </Header>

      <Body>
        {loading ? (
          <Spinner role="status" aria-label="요약을 불러오는 중입니다" />
        ) : summaryText ? (
          <RichOcrContent text={summaryText} />
        ) : (
          <EmptyParagraph>요약이 없습니다.</EmptyParagraph>
        )}
      </Body>
    </Pane>
  );
}

/* styled */
const Pane = styled.aside<{ $stack: boolean; $height?: string }>`
  position: ${({ $stack }) => ($stack ? "static" : "sticky")};
  top: 16px;
  background: var(--c-white);
  color: var(--c-black);
  border: 1px solid #e7eef6;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  height: ${({ $height }) => $height ?? PANEL_FIXED_H};
  display: flex;
  flex-direction: column;
  overflow: hidden;

  ${({ $stack }) => $stack && `order:2;`}

  @media (max-width: 900px) {
    order: 2;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 10px;
    border-radius: 10px;
  }
`;

const Header = styled.div`
  padding: 14px 16px 0;
`;

const Title = styled.h3`
  ${fonts.bold32}
  color: var(--c-black);
  margin: 0;
`;

const Body = styled.div`
  flex: 1 1 auto;
  overflow: auto;
  padding: 12px 16px 16px;
  overscroll-behavior: contain;
`;

const EmptyParagraph = styled.p`
  white-space: pre-wrap;
  line-height: 1.7;
  ${fonts.medium26}
  color: var(--c-black);
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
