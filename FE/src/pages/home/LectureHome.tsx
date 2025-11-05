import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import {
  fetchLectures,
  updateLecture,
  deleteLecture,
} from "src/entities/lecture/api";
import type { Lecture } from "src/entities/lecture/types";
import { fonts } from "@styles/fonts";
import toast from "react-hot-toast";
import { LectureCard } from "src/components/home/LectureCard";
import { copyLectureCode } from "src/utils/home/clipboard";
import AddLectureDialog from "./AddLectureDialog";

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

  const menuRef = useRef<HTMLDivElement | null>(null);
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

  const load = async () => {
    setBusy(true);
    const data = await fetchLectures();
    setLectures(data);
    setBusy(false);
  };
  useEffect(() => {
    void load();
  }, []);

  // 편집 시작/저장/취소
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

  return (
    <Main
      aria-busy={busy}
      aria-label="강의 목록 화면"
      $uiScale={uiScale}
      role="region"
    >
      <SrOnly as="h1">강의실 홈</SrOnly>

      <Grid
        style={{ gridTemplateColumns: `repeat(auto-fill, ${columnMin})` }}
        aria-label="강의 목록 그리드"
      >
        {/* (+) 강의 추가 */}
        <AddTileBox style={{ width: columnMin }}>
          <AddTile aria-label="강의 추가" onClick={() => setOpen(true)}>
            <AddInner>
              <AddPlus aria-hidden>＋</AddPlus>
            </AddInner>
          </AddTile>
          <AddText>강의 추가</AddText>
        </AddTileBox>

        {/* 폴더 타일들 */}
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
            onOpen={() => onOpenLecture?.(lec)}
            onStartEdit={() => startEdit(lec)}
            onSaveEdit={() => void saveEdit(lec)}
            onCancelEdit={cancelEdit}
            onDelete={() => void onDelete(lec)}
            onCopyCode={() => void copyLectureCode(lec.code)}
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

/* ============================= styled ============================= */
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
