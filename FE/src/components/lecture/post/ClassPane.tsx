import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import {
  fetchPageReview,
  fetchBookmarkDetail,
  type PageReview,
} from "@apis/lecture/review.api";
import { PANEL_FIXED_H_LIVE } from "@pages/class/pre/styles";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";
import Spinner from "src/components/common/Spinner";
import { useOcrTtsAutoStop } from "src/hooks/useOcrTtsAutoStop";

type Props = {
  pageId: number;
  review: PageReview | null;
  isActive: boolean;
};

export default function ClassPane({ pageId, review, isActive }: Props) {
  const [localReview, setLocalReview] = useState<PageReview | null>(review);

  /* ------ speeches 정렬 ------ */
  const speeches =
    localReview?.speeches?.slice().sort((a, b) => a.speech_id - b.speech_id) ??
    [];

  const bookmarks = localReview?.bookmarks ?? [];
  const isProcessing = localReview?.status === "processing";

  const [currentIndex, setCurrentIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [highlightText, setHighlightText] = useState<string | null>(null);

  const { soundRate, soundVoice } = useSoundOptions();

  useEffect(() => {
    setLocalReview(review);
    setCurrentIndex(0);
    setHighlightText(null);
  }, [review]);

  /* ---------- processing이면 폴링 ---------- */
  useEffect(() => {
    if (!isActive || !pageId) return;
    if (!isProcessing) return;

    let cancelled = false;

    const poll = async () => {
      const next = await fetchPageReview(pageId);
      if (cancelled) return;

      setLocalReview(next);

      if (next?.status === "processing") {
        setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [isProcessing, isActive, pageId]);

  const ensureSrc = (index: number) => {
    const a = audioRef.current;
    if (!a) return null;

    const speech = speeches[index];
    if (!speech?.stt_tts) return null;

    const female = speech.stt_tts.female;
    const male = speech.stt_tts.male;

    const url = soundVoice === "여성" ? female ?? male : male ?? female;
    if (!url) return null;

    if (a.src !== url) {
      a.src = url;
    }

    applyPlaybackRate(a, soundRate);
    return a;
  };

  const playFrom = (index: number, offsetSec = 0) => {
    const a = ensureSrc(index);
    if (!a) return;

    a.currentTime = offsetSec;
    a.play().then(
      () => setPlaying(true),
      () => {}
    );
  };

  const play = (index: number) => {
    playFrom(index, 0);
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const handleEnd = () => {
      const next = currentIndex + 1;
      if (next < speeches.length) {
        setCurrentIndex(next);
        play(next);
      } else {
        setPlaying(false);
      }
    };

    a.addEventListener("ended", handleEnd);
    return () => a.removeEventListener("ended", handleEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, speeches.length]);

  const onTogglePlay = () => {
    if (speeches.length === 0) return;

    setActive(true);
    setHighlightText(null);

    if (playing) {
      pause();
    } else {
      let index = currentIndex;
      if (!audioRef.current?.src) {
        index = 0;
        setCurrentIndex(0);
      }
      play(index);
    }
  };

  const onFocusCard = () => {
    if (speeches.length === 0) return;
    if (playing) return;

    setActive(true);
    setHighlightText(null);

    let index = currentIndex;
    if (!audioRef.current?.src) {
      index = 0;
      setCurrentIndex(0);
    }
    play(index);
  };

  const onClickBookmark = async (bookmark: {
    bookmark_id: number;
    timestamp: string;
  }) => {
    if (!audioRef.current) return;

    try {
      const detail = await fetchBookmarkDetail(bookmark.bookmark_id);

      const female = detail.stt_tts?.female;
      const male = detail.stt_tts?.male;
      const url = soundVoice === "여성" ? female ?? male : male ?? female;
      if (!url) return;

      const audio = audioRef.current;
      if (audio.src !== url) {
        audio.src = url;
      }

      applyPlaybackRate(audio, soundRate);
      audio.currentTime = detail.relative_time ?? 0;
      await audio.play();
      setPlaying(true);
      setActive(true);

      setHighlightText(detail.text ?? null);

      if (detail.text) {
        const idx = speeches.findIndex((s) => s.stt.includes(detail.text!));
        if (idx >= 0) {
          setCurrentIndex(idx);
        }
      }
    } catch (e) {
      console.error("북마크 호출 실패:", e);
    }
  };

  useOcrTtsAutoStop(audioRef, {
    pageKey: pageId,
    mode: isActive ? "class-active" : "class-inactive",
    areaRef,
  });

  const renderWithHighlight = (full: string) => {
    if (!highlightText) return full;

    const idx = full.indexOf(highlightText);
    if (idx === -1) return full;

    const before = full.slice(0, idx);
    const match = full.slice(idx, idx + highlightText.length);
    const after = full.slice(idx + highlightText.length);

    return (
      <>
        {before}
        <Highlight>{match}</Highlight>
        {after}
      </>
    );
  };

  return (
    <Wrap ref={areaRef}>
      {/* 북마크 */}
      <Section aria-label="북마크">
        <p>북마크</p>
        <MarkWrap>
          {bookmarks.length === 0 ? (
            <EmptyText>북마크가 없습니다.</EmptyText>
          ) : (
            bookmarks
              .slice()
              .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
              .map((b) => (
                <Mark
                  key={b.bookmark_id}
                  type="button"
                  onClick={() => onClickBookmark(b)}
                >
                  {b.timestamp.replace(/^00:/, "")}
                </Mark>
              ))
          )}
        </MarkWrap>
      </Section>

      {/* STT */}
      <Section aria-label="수업 STT">
        <HeaderRow>
          <p>STT</p>
          <GhostBtn type="button" onClick={pause} disabled={!playing}>
            정지
          </GhostBtn>
        </HeaderRow>

        {isProcessing && (
          <LoadingWrap>
            <Spinner />
            <LoadingText>
              수업 음성을 준비하고 있어요. 잠시만 기다려 주세요.
            </LoadingText>
          </LoadingWrap>
        )}

        {!isProcessing && (
          <>
            <Card
              ref={cardRef}
              tabIndex={0}
              $active={active}
              onClick={onTogglePlay}
              onFocus={onFocusCard}
              aria-label={
                playing
                  ? "재생 중, 클릭하면 일시정지"
                  : "일시정지, 클릭하면 재생"
              }
            >
              <Content>
                {speeches.map((s) => (
                  <p key={s.speech_id} className="sttText">
                    {renderWithHighlight(s.stt)}
                  </p>
                ))}
              </Content>
              <Hint>
                {playing ? "⏸ 클릭/포커스: 일시정지" : "▶ 클릭/포커스: 재생"}
              </Hint>
            </Card>

            <audio
              ref={audioRef}
              preload="none"
              style={{ display: "none" }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </>
        )}
      </Section>
    </Wrap>
  );
}

const Wrap = styled.div`
  display: grid;
  gap: 20px;
  height: ${PANEL_FIXED_H_LIVE};
`;

const Section = styled.section`
  display: grid;
  gap: 8px;

  p {
    ${fonts.bold26}
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const GhostBtn = styled.button`
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--c-blue);
  color: var(--c-white);
  ${fonts.bold20}
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Card = styled.article<{ $active?: boolean }>`
  border: 2px solid ${({ $active }) => ($active ? "var(--c-blue)" : "#e7eef6")};
  background: var(--c-white);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
`;

const Content = styled.div`
  ${fonts.regular20}
  display: grid;
  gap: 8px;
  margin-bottom: 10px;

  .sttText {
    ${fonts.regular20}
  }
`;

const Hint = styled.span`
  color: var(--c-grayD);
  ${fonts.regular17};
`;

const MarkWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Mark = styled.button`
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  ${fonts.regular20}
  cursor: pointer;

  &:hover {
    border-color: var(--c-blue);
  }
`;

const EmptyText = styled.p`
  ${fonts.regular20};
  color: var(--c-gray8, #6b7280);
  padding: 4px 0;
`;

const LoadingWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LoadingText = styled.p`
  ${fonts.regular20}
  color: #6b7280;
`;

const Highlight = styled.span`
  background: rgba(37, 99, 235, 0.15);
  color: var(--c-blue);
  font-weight: 600;
  padding: 0 2px;
  border-radius: 4px;
`;
