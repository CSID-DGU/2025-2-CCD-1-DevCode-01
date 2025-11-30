import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import toast from "react-hot-toast";

import {
  fetchLectures,
  updateLecture,
  deleteLecture,
} from "src/entities/lecture/api";
import type { Lecture } from "src/entities/lecture/types";
import { fonts } from "@styles/fonts";
import { LectureCard } from "src/components/home/LectureCard";
import { copyLectureCode } from "src/utils/home/clipboard";
import AddLectureDialog from "./AddLectureDialog";

import { useOcrTtsAutoStop } from "src/hooks/useOcrTtsAutoStop";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";

type Props = {
  uiScale?: 1 | 1.2 | 1.4 | 1.6;
  onOpenLecture?: (lecture: Lecture) => void;
};

export default function LectureHome({ uiScale = 1, onOpenLecture }: Props) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [open, setOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  // 강의 카드 컨텍스트 메뉴 영역
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 강의 목록 전체 영역 (포커스 이탈 감지용)
  const mainRef = useRef<HTMLElement | null>(null);

  // 강의 목록용 TTS 오디오 ref
  const lectureAudioRef = useRef<HTMLAudioElement | null>(null);

  // 사운드 옵션 변경 감지
  const { soundRate, soundVoice } = useSoundOptions();

  /* -------------------- 포커스 이탈 시 강의 TTS 자동 정지 -------------------- */
  useOcrTtsAutoStop(lectureAudioRef, {
    areaRef: mainRef as React.RefObject<HTMLElement | null>,
    stopMessageOnBlur: "강의 음성 재생이 중지되었습니다.",
  });

  /* -------------------- 외부 클릭 시 메뉴 닫기 -------------------- */
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const columnMin = useMemo(() => `${(14 * uiScale).toFixed(2)}rem`, [uiScale]);

  /* -------------------- 강의 목록 로드 -------------------- */
  const load = async () => {
    setBusy(true);
    const data = await fetchLectures();
    setLectures(data);
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  /* -------------------- 강의 타이틀 편집 -------------------- */
  const startEdit = (lec: Lecture) => {
    setEditingId(lec.lecture_id);
    setEditValue(lec.title);
    setMenuOpenId(null);
  };

  const saveEdit = async (lec: Lecture) => {
    const title = editValue.trim();
    if (!title || title === lec.title) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    const updated = await updateLecture(lec.lecture_id, { title });
    setBusy(false);
    if (!updated) {
      toast.error("수정에 실패했어요. 다시 시도해주세요.");
      return;
    }
    setLectures((prev) =>
      prev.map((x) =>
        x.lecture_id === lec.lecture_id ? { ...x, title: updated.title } : x
      )
    );
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  /* -------------------- 강의 삭제 -------------------- */
  const onDelete = async (lec: Lecture) => {
    if (!confirm(`정말 삭제할까요? \n[${lec.title}]`)) return;
    setBusy(true);
    const ok = await deleteLecture(lec.lecture_id);
    setBusy(false);
    if (!ok) {
      toast.error("삭제에 실패했어요.");
      return;
    }
    setLectures((prev) => prev.filter((x) => x.lecture_id !== lec.lecture_id));
  };

  /* -------------------- 강의 TTS 재생 -------------------- */
  const playLectureTts = useCallback(
    async (lec: Lecture) => {
      const tts = lec.lecture_tts;

      if (!tts) return;

      const femaleUrl = tts.female ?? undefined;
      const maleUrl = tts.male ?? undefined;

      let url: string | undefined;
      if (soundVoice === "여성") {
        url = femaleUrl ?? maleUrl;
      } else {
        url = maleUrl ?? femaleUrl;
      }

      if (!url) return;

      const audio = lectureAudioRef.current;
      if (!audio) return;

      if (!audio.src || audio.src !== url) {
        audio.src = url;
      }

      applyPlaybackRate(audio, soundRate);

      audio.currentTime = 0;
      try {
        await audio.play();
      } catch (err) {
        console.error("[LectureHome] 강의 TTS 재생 실패:", err);
      }
    },
    [soundRate, soundVoice]
  );

  return (
    <Main
      ref={mainRef}
      aria-busy={busy}
      aria-label="강의 목록 화면"
      $uiScale={uiScale}
      role="region"
    >
      {/* 강의 목록용 음성 재생 오디오 */}
      <audio ref={lectureAudioRef} preload="none" />

      <SrOnly as="h1">강의실 홈</SrOnly>

      <Grid
        style={{ gridTemplateColumns: `repeat(auto-fill, ${columnMin})` }}
        aria-label="강의 목록 그리드"
      >
        {/* 강의 추가 타일 */}
        <AddTileBox style={{ width: columnMin }}>
          <AddTile aria-label="강의 추가" onClick={() => setOpen(true)}>
            <AddInner>
              <AddPlus aria-hidden>＋</AddPlus>
            </AddInner>
          </AddTile>
          <AddText>강의 추가</AddText>
        </AddTileBox>

        {/* 강의 카드들 */}
        {lectures.map((lec) => (
          <LectureCard
            key={lec.lecture_id}
            style={{ width: columnMin }}
            lecture={lec}
            isEditing={editingId === lec.lecture_id}
            menuOpenId={menuOpenId}
            setMenuOpenId={setMenuOpenId}
            menuRef={menuRef}
            editValue={editValue}
            setEditValue={setEditValue}
            onOpen={() => {
              const audio = lectureAudioRef.current;
              if (audio && !audio.paused) {
                audio.pause();
                audio.currentTime = 0;
              }
              onOpenLecture?.(lec);
            }}
            onStartEdit={() => startEdit(lec)}
            onSaveEdit={() => void saveEdit(lec)}
            onCancelEdit={cancelEdit}
            onDelete={() => void onDelete(lec)}
            onCopyCode={() => void copyLectureCode(lec.code)}
            onFocus={() => void playLectureTts(lec)}
          />
        ))}
      </Grid>

      {/* 강의 추가 모달 */}
      <AddLectureDialog
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={(lec) => setLectures((prev) => [lec, ...prev])}
      />
    </Main>
  );
}

// style
const Main = styled.main<{ $uiScale: number }>`
  font-size: ${({ $uiScale }) => `${16 * $uiScale}px`};
  padding: 3rem;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
`;

const Grid = styled.section`
  display: grid;
  width: 100%;
  gap: 2rem 3rem;
  justify-content: start;
  align-content: start;
  grid-auto-flow: row;
`;

const TileBase = styled.div`
  width: 100%;
  border-radius: 10px;
  background: var(--c-white);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
      filter: brightness(1.02);
    }
  }
`;

const AddTile = styled.button`
  ${TileBase};
  display: flex;
  align-items: center;
  justify-content: center;
  border-style: dashed;
  color: var(--c-black);
  cursor: pointer;
  width: 12.5rem;
  height: 9.5rem;
  border-radius: 10px;
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
` as unknown as typeof TileBase;

const AddInner = styled.div`
  display: grid;
  place-items: center;
  gap: 0.25rem;
  font-weight: 600;
  font-size: 1rem;
`;

const AddPlus = styled.span`
  font-size: 3rem;
  line-height: 1;
  transform: translateY(-2px);
`;

const AddText = styled.span`
  display: block;
  margin-top: 0.125rem;
`;

const AddTileBox = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  ${fonts.regular32};
  gap: 14px;
`;

const SrOnly = styled.h1`
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
