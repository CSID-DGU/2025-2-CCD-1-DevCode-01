// src/components/lecture/DocItem.tsx
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(doc.title);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement | null>(null);
  const titleBtnRef = useRef<HTMLButtonElement | null>(null);

  const arrow = useContrastImage("/img/home/arrowDown");

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      const t = setTimeout(() => firstMenuItemRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [menuOpen]);

  const saveEdit = async (by: "enter" | "blur" = "blur") => {
    const next = newTitle.trim();
    if (!next) {
      toast.error("제목을 입력하세요.");
      return;
    }

    const updated = await updateLectureDoc(doc.id, next);
    if (!updated) throw new Error("no-updated");

    onTitleUpdated(doc.id, updated.title);
    setEditing(false);

    requestAnimationFrame(() => {
      if (by === "enter") {
        titleBtnRef.current?.focus({ preventScroll: true });
      } else {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    });

    toast.success("수정 완료");
  };

  return (
    <ItemRow aria-label={`${doc.title} 문서`}>
      {editing ? (
        <EditInput
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={() => void saveEdit("blur")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              void saveEdit("enter");
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setEditing(false);
              titleBtnRef.current?.focus();
            }
          }}
          aria-label="문서 제목 편집"
          autoFocus
        />
      ) : (
        <TitleBtn
          ref={titleBtnRef}
          type="button"
          onClick={() => onOpen(doc)}
          aria-labelledby={`doc-title-${doc.id}`}
        >
          <span id={`doc-title-${doc.id}`}>{doc.title}</span>
        </TitleBtn>
      )}

      <DateCol aria-label="작성일">{fmtDate(doc.created_at)}</DateCol>

      <MenuBtn
        ref={menuBtnRef}
        type="button"
        aria-label="교안 옵션 열기"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={`doc-menu-${doc.id}`}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((p) => !p);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !menuOpen) {
            e.preventDefault();
            setMenuOpen(true);
          } else if (e.key === "Escape" && menuOpen) {
            e.preventDefault();
            setMenuOpen(false);
            menuBtnRef.current?.focus();
          }
        }}
      >
        <img src={arrow} alt="" aria-hidden />
      </MenuBtn>

      {menuOpen && (
        <OptionsMenu
          ref={menuRef}
          onEdit={() => {
            setMenuOpen(false);
            setEditing(true);
          }}
          onDelete={() => {
            setMenuOpen(false);
            void onDelete(doc);
          }}
          top="calc(80%)"
          left="auto"
          right="0"
          transform="none"
          firstItemRef={firstMenuItemRef}
        />
      )}
    </ItemRow>
  );
}

/* styled */
const ItemRow = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 36px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: white;
  border: 1px solid color-mix(in srgb, var(--c-blueL) 30%, white);
`;

const TitleBtn = styled.button`
  ${fonts.regular20};
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0;
  color: black;
  cursor: pointer;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
    border-radius: 6px;
  }
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
  padding-right: 0.25rem;
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

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;
