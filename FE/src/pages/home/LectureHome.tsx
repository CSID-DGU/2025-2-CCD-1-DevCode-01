import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AddLectureDialog from "./AddLectureDialog";
import { fetchLectures } from "src/entities/lecture/api";
import type { Lecture } from "src/entities/lecture/types";
import { fonts } from "@styles/fonts";

type Props = {
  uiScale?: 1 | 1.2 | 1.4 | 1.6;
  onOpenLecture?: (lecture: Lecture) => void;
};

export default function LectureHome({ uiScale = 1, onOpenLecture }: Props) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const columnMin = useMemo(() => {
    const baseRem = 14;
    return `${(baseRem * uiScale).toFixed(2)}rem`;
  }, [uiScale]);

  const load = async () => {
    setBusy(true);
    const data = await fetchLectures();
    setLectures(data);
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Main
      aria-busy={busy}
      aria-label="강의 목록 화면"
      $uiScale={uiScale}
      role="region"
    >
      <SrOnly as="h1">강의실 홈</SrOnly>

      <Grid
        style={{
          gridTemplateColumns: `repeat(auto-fill, ${columnMin})`,
        }}
        aria-label="강의 목록 그리드"
      >
        {/* ── (+) 강의 추가 타일 ───────────────────────────────── */}
        <AddTileContainer style={{ width: columnMin }}>
          <AddTile aria-label="강의 추가" onClick={() => setOpen(true)}>
            <AddInner>
              <AddPlus aria-hidden>＋</AddPlus>
            </AddInner>
          </AddTile>
          <AddText>강의 추가</AddText>
        </AddTileContainer>

        {/* ── 폴더 타일 리스트 ──────────────────────────────── */}
        {lectures.map((lec) => (
          <FolderTileContainer
            key={lec.lecture_id}
            style={{ width: columnMin }}
          >
            <Tile
              tabIndex={0}
              role="button"
              aria-labelledby={`lec-${lec.lecture_id}-title`}
              onClick={() => onOpenLecture?.(lec)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenLecture?.(lec);
                }
              }}
            >
              <FolderImg src="/img/home/folder.png" alt="" aria-hidden />
            </Tile>

            <LabelWrap>
              <Title id={`lec-${lec.lecture_id}-title`} title={lec.title}>
                {lec.title}
              </Title>

              <Meta>{lec.code}</Meta>
            </LabelWrap>
          </FolderTileContainer>
        ))}
      </Grid>

      {/* ── 강의 추가 모달 (만들기/코드 참여) ───────────────── */}
      <AddLectureDialog
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={(lec) => {
          setLectures((prev) => [lec, ...prev]);
        }}
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
  position: relative;
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

const Tile = styled(TileBase)`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const FolderImg = styled.img`
  width: 92%;
  height: 92%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
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

const LabelWrap = styled.div`
  text-align: center;
  width: 100%;
`;

const AddText = styled.span`
  display: block;
  margin-top: 0.125rem;
`;

const AddTileContainer = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  ${fonts.regular32};
  gap: 15px;
`;

const FolderTileContainer = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  ${fonts.regular32};
  gap: 15px;
`;

const Title = styled.h2`
  font-size: 1rem;
  font-weight: 800;
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.p`
  margin: 0;
  color: var(--c-grayD);
  font-size: 0.875rem;
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
