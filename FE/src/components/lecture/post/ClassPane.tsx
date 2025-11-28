import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import type { PageReview } from "@apis/lecture/review.api";
import { PANEL_FIXED_H_LIVE } from "@pages/class/pre/styles";

/* ---------- 유틸 ---------- */
const toSec = (hhmmss: string) => {
  const [h = "0", m = "0", s = "0"] = (hhmmss || "00:00:00").split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// /* ---------- 더미 ---------- */
// const DUMMY_SPEECH = {
//   speech_id: 0,
//   stt: "직접 재산권을 다른 매체로 확장하는 사업 전략 되면 미디어 프랜차이즈업 원소스 멀티유즈가 있습니다 애들은 하나의 IP를 영화 드라마 소설 게임 등 여러 형태로 전개하여 수익을 창출하고 브랜드 가치를 확장하는 방법입니다 원소스 멀티유즈는 하나의 콘텐츠를 다양한 매체를 활용하여 난 전략입니다 미디어플랜 성공한 IP를 기반으로 영화 시리즈 게임 상품전 확장해나가는 사업 모델입니다",
//   stt_tts: "",
//   end_time: "00:00:30",
//   duration: "00:00:30",
// };
// const DUMMY_BOOKMARK = { bookmark_id: 0, timestamp: "00:00:15" };

type Props = {
  review: PageReview | null;
  /** “수업” 탭이 현재 보이는지 */
  isActive: boolean;
};

export default function ClassPane({ review, isActive }: Props) {
  const stt = review?.speeches?.[0]; // 한 페이지 = 1 발화
  const bookmarks = review?.bookmarks;
  //   const stt = review?.speeches?.[0] ?? DUMMY_SPEECH; // 한 페이지 = 1 발화
  // const bookmarks = review?.bookmarks ?? [DUMMY_BOOKMARK];

  // refs
  const cardRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // state
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);

  /* ---------- 공통 재생/정지 ---------- */
  const ensureSrc = () => {
    const a = audioRef.current;
    if (!a) return null;
    if (stt?.stt_tts && a.src !== stt.stt_tts) a.src = stt.stt_tts;
    return a;
  };

  const playFrom = (sec: number) => {
    const a = ensureSrc();
    if (!a) return;
    const dur = Math.max(1, toSec(stt?.duration ?? "00:00:00")); // 0 방지
    a.currentTime = clamp(sec, 0, dur);
    a.play().then(
      () => setPlaying(true),
      () => {}
    );
  };

  const pauseAudio = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
  };

  /* ---------- 탭 활성 시: 카드 포커스 & 처음부터 재생 ---------- */
  useEffect(() => {
    if (!isActive) return;
    setTimeout(() => {
      setActive(true);
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      cardRef.current?.focus({ preventScroll: true });
      playFrom(0);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  /* ---------- 카드 클릭: 재생/일시정지 토글 ---------- */
  const onTogglePlay = () => {
    if (playing) pauseAudio();
    else playFrom(audioRef.current?.currentTime ?? 0);
  };

  /* ---------- 북마크 클릭: 해당 초부터 재생 ---------- */
  const onClickBookmark = (timestamp: string) => {
    setActive(true);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    cardRef.current?.focus({ preventScroll: true });
    playFrom(toSec(timestamp));
  };

  return (
    <Wrap>
      {/* 북마크 */}
      <Section aria-label="북마크">
        <p>북마크</p>
        <MarkWrap>
          {(bookmarks ?? [])
            .slice()
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            .map((b) => (
              <Mark
                key={b.bookmark_id}
                type="button"
                onClick={() => onClickBookmark(b.timestamp)}
              >
                {b.timestamp.replace(/^00:/, "")}
              </Mark>
            ))}
        </MarkWrap>
      </Section>

      {/* STT */}
      <Section aria-label="수업 STT">
        <HeaderRow>
          <p>STT</p>
          <GhostBtn
            type="button"
            onClick={pauseAudio}
            aria-label="정지"
            disabled={!playing}
          >
            정지
          </GhostBtn>
        </HeaderRow>

        <Card
          ref={cardRef}
          tabIndex={0}
          onClick={onTogglePlay}
          aria-current={active ? "true" : undefined}
          $active={active}
          aria-label={
            playing ? "재생 중, 클릭하면 일시정지" : "일시정지, 클릭하면 재생"
          }
        >
          <Content>{stt?.stt}</Content>
          <Hint>{playing ? "⏸ 클릭: 일시정지" : "▶ 클릭: 재생"}</Hint>
        </Card>

        <audio
          ref={audioRef}
          preload="none"
          style={{ display: "none" }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </Section>
    </Wrap>
  );
}

/* ---------- 스타일 ---------- */
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
  color: var(--c-white);
  background: var(--c-blue);
  ${fonts.bold20}
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Card = styled.article<{ $active?: boolean }>`
  border: 2px solid
    ${({ $active }) => ($active ? "var(--c-blue, #2563eb)" : "#e7eef6")};
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  display: grid;
  gap: 8px;
  background: ${({ $active }) => ($active ? "rgba(37,99,235,0.06)" : "#fff")};
  transition: background-color 0.15s ease, border-color 0.15s ease;
  outline: none;
  cursor: pointer;
`;

const Content = styled.div`
  ${fonts.regular20}
`;

const Hint = styled.span`
  color: var(--c-gray8, #6b7280);
  ${fonts.regular17}
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
    border-color: var(--c-blue, #2563eb);
  }
`;
