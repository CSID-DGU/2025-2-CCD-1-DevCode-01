import styled from "styled-components";
import { fonts } from "@styles/fonts";
import type { Lecture } from "src/entities/lecture/types";
import { OptionsMenu } from "./OptionsMenu";
import { EditTitleBar } from "./EditTitleBar";
import { useContrastImage } from "@shared/useContrastImage";

type Props = {
  style?: React.CSSProperties;
  lecture: Lecture;
  isEditing: boolean;
  menuOpenId: number | null;
  setMenuOpenId: (
    id: number | null | ((prev: number | null) => number | null)
  ) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  editValue: string;
  setEditValue: (v: string) => void;
  onOpen: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onCopyCode: () => void;
  onFocus?: () => void;
};

export const LectureCard = ({
  style,
  lecture: lec,
  isEditing,
  menuOpenId,
  setMenuOpenId,
  menuRef,
  editValue,
  setEditValue,
  onOpen,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onCopyCode,
  onFocus,
}: Props) => {
  const arrowDown = useContrastImage("/img/home/arrowDown");

  return (
    <FolderBox style={style}>
      <Tile
        tabIndex={0}
        role="button"
        aria-labelledby={`lec-${lec.lecture_id}-title`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        onFocus={onFocus}
        title={lec.title}
      >
        <FolderImg src="/img/home/folder.png" alt="" aria-hidden />
      </Tile>

      {!isEditing ? (
        <LabelArea>
          <TitleRow>
            <Title id={`lec-${lec.lecture_id}-title`} title={lec.title}>
              {lec.title}
            </Title>
            <MenuButton
              aria-label="옵션"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId((prev) =>
                  prev === lec.lecture_id ? null : lec.lecture_id
                );
              }}
            >
              <img src={arrowDown} alt="" />
            </MenuButton>
          </TitleRow>

          <Meta
            title={lec.code ? "클릭하면 복사됩니다" : "강의 코드가 없습니다"}
            $disabled={!lec.code}
            aria-disabled={!lec.code}
            onClick={onCopyCode}
          >
            {lec.code ?? "코드 없음"}
          </Meta>

          {menuOpenId === lec.lecture_id && (
            <OptionsMenu
              ref={menuRef}
              onEdit={onStartEdit}
              onDelete={onDelete}
            />
          )}
        </LabelArea>
      ) : (
        <EditTitleBar
          value={editValue}
          onChange={setEditValue}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      )}
    </FolderBox>
  );
};

/* ============ styled =========== */
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

const FolderBox = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
`;

const LabelArea = styled.div`
  text-align: center;
  width: 100%;
  position: relative;
`;

const TitleRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
`;

const Title = styled.h2`
  margin: 0;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${fonts.regular32};
`;

const MenuButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  display: grid;
  place-items: center;
  img {
    width: 22px;
    height: 11px;
  }
  &:hover {
    filter: brightness(0.9);
  }
`;

const Meta = styled.p<{ $disabled?: boolean }>`
  margin: 0;
  color: var(--c-grayD);
  ${fonts.regular24};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  user-select: none;
  transition: color 0.15s ease;
  &:hover {
    color: ${({ $disabled }) =>
      $disabled ? "var(--c-grayD)" : "var(--c-blue)"};
  }
  &:active {
    transform: ${({ $disabled }) => ($disabled ? "none" : "scale(0.96)")};
  }
`;
