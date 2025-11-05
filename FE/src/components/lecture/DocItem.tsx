import styled from "styled-components";
import { fonts } from "@styles/fonts";
import { OptionsMenu } from "src/components/home/OptionsMenu";
import type { LectureDoc } from "src/entities/doc/types";
import { useRef, useState, useEffect } from "react";
import { useContrastImage } from "@shared/useContrastImage";
import toast from "react-hot-toast";
import { updateLectureDoc } from "src/entities/doc/api";

type Props = {
  doc: LectureDoc;
  onOpen: (doc: LectureDoc) => void;
  onDelete: (doc: LectureDoc) => void;
  fmtDate: (iso: string) => string;
  onTitleUpdated: (id: number, title: string) => void;
};

export default function DocItem({
  doc,
  onOpen,
  onDelete,
  fmtDate,
  onTitleUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(doc.title);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const arrow = useContrastImage("/img/home/arrowDown");

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const saveEdit = async () => {
    const next = newTitle.trim();
    if (!next) {
      toast.error("제목을 입력하세요.");
      return;
    }

    const updated = await updateLectureDoc(doc.id, next);
    if (updated) {
      onTitleUpdated(doc.id, updated.title);
      toast.success("수정 완료");
      setEditing(false);
    } else {
      toast.error("수정 실패");
    }
  };

  return (
    <ItemBody
      role="button"
      tabIndex={0}
      aria-labelledby={`doc-title-${doc.id}`}
      onClick={() => !editing && onOpen(doc)}
    >
      {editing ? (
        <EditInput
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
        />
      ) : (
        <TitleCol id={`doc-title-${doc.id}`}>{doc.title}</TitleCol>
      )}

      <DateCol aria-label="작성일">{fmtDate(doc.created_at)}</DateCol>

      <MenuBtn
        aria-label="교안 옵션 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
      >
        <img src={arrow} alt="" aria-hidden />
      </MenuBtn>

      {open && (
        <OptionsMenu
          ref={menuRef}
          onEdit={() => {
            setOpen(false);
            setEditing(true);
          }}
          onDelete={() => {
            setOpen(false);
            void onDelete(doc);
          }}
          top="calc(80%)"
          left="auto"
          right="0"
          transform="none"
        />
      )}
    </ItemBody>
  );
}

/* styled */
const ItemBody = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 36px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: white;
  border: 1px solid color-mix(in srgb, var(--c-blueL) 30%, white);
  cursor: pointer;
  position: relative;
`;

const TitleCol = styled.span`
  ${fonts.regular20};
  color: black;
`;

const EditInput = styled.input`
  ${fonts.regular20};
  border: 2px solid var(--c-blueL);
  border-radius: 8px;
  padding: 0.25rem 0.5rem;
  width: 100%;
  &:focus-visible {
    outline: 2px solid var(--c-blue);
  }
`;

const DateCol = styled.time`
  ${fonts.regular20};
  color: ${({ theme }) => theme.colors.base.grayD};
  text-align: right;
`;

const MenuBtn = styled.button`
  background: var(--c-white);
  border: 1px solid var(--c-grayL);
  border-radius: 999px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;

  img {
    width: 16px;
    height: 11px;
  }
`;
