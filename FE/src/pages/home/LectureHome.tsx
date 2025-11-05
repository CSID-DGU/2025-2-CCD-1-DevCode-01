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
    load();
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
          gridTemplateColumns: `repeat(auto-fill, minmax(${columnMin}, 1fr))`,
        }}
        aria-label="강의 목록 그리드"
      >
        <AddTileContainer>
          <AddTile
            type="button"
            aria-label="강의 추가"
            onClick={() => setOpen(true)}
          >
            <AddInner>
              <AddPlus aria-hidden>＋</AddPlus>
            </AddInner>
          </AddTile>
          <AddText>강의 추가</AddText>
        </AddTileContainer>

        {/* 강의 폴더 타일들 */}
        {lectures.map((lec) => (
          <Tile
            key={lec.lecture_id}
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
            <FolderIcon aria-hidden>📁</FolderIcon>
            <Title id={`lec-${lec.lecture_id}-title`} title={lec.title}>
              {lec.title}
            </Title>
            <Meta>{lec.code ? `코드: ${lec.code}` : "코드 없음"}</Meta>
          </Tile>
        ))}
      </Grid>

      {/* 강의 추가 모달 (만들기/코드 참여) */}
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

const Main = styled.main<{ $uiScale: number }>`
  font-size: ${({ $uiScale }) => `${16 * $uiScale}px`};
  padding: 3rem;
`;

const Grid = styled.section`
  display: grid;
  gap: 1rem;
`;

const TileBase = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 1rem;
  min-height: 10rem;

  border-radius: 16px;
  border: 2px solid var(--c-grayL);
  background: var(--c-white);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
    }
  }
`;

const Tile = styled(TileBase)``;

const AddTile = styled.button`
  width: 12.5625rem;
  height: 9.5rem;
  text-align: center;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-style: dashed;
  color: var(--c-black);
  border-radius: 10px;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const AddInner = styled.div`
  display: grid;
  place-items: center;
  gap: 0.25rem;
  font-weight: 500;
  font-size: 1rem;
`;

const AddPlus = styled.span`
  font-size: 3rem;
  line-height: 1;
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

const FolderIcon = styled.div`
  font-size: 3rem;
  line-height: 1;
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

/* 스크린리더 전용 텍스트 */
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
