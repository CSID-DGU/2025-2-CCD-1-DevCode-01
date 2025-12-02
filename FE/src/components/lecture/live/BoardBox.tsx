import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  fetchBoards,
  uploadBoardImage,
  patchBoardText,
  deleteBoard,
  type BoardItem,
} from "@apis/lecture/board.api";

import { PANEL_FIXED_H_LIVE } from "@pages/class/pre/styles";
import { fonts } from "@styles/fonts";
import {
  useDocLiveSync,
  type BoardEventCreatedOrUpdated,
  type BoardEventDataBase,
} from "src/hooks/useDocLiveSync";
import MarkdownText from "./MarkdownText";

type Props = {
  docId: number;
  pageId: number;
  assetBase?: string;
  token?: string | null;
  wsBase?: string;
};

export default function BoardBox({
  docId,
  pageId,
  assetBase = "",
  token,
  wsBase,
}: Props) {
  const [list, setList] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(
    null
  );

  const fileRef = useRef<HTMLInputElement | null>(null);
  const toUrl = (p: string | null) =>
    !p ? "" : p.startsWith("http") ? p : `${assetBase}${p}`;

  const accessToken = token ?? localStorage.getItem("access") ?? null;
  const wsServer =
    wsBase ??
    (import.meta.env.VITE_BASE_URL as string).replace(/^http(s?)/, "ws$1");

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreview(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchBoards(pageId);
    if (!res) setError("판서 목록을 불러오지 못했습니다.");
    setList(res?.boards ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [pageId]);

  const { sendBoardEvent } = useDocLiveSync({
    serverBase: wsServer,
    docId,
    token: accessToken,
    onBoardCreated: (data: BoardEventCreatedOrUpdated) => {
      setList((prev) =>
        prev.some((b) => b.boardId === data.boardId)
          ? prev
          : [{ ...data }, ...prev]
      );
    },
    onBoardUpdated: (data: BoardEventCreatedOrUpdated) => {
      setList((prev) =>
        prev.map((b) =>
          b.boardId === data.boardId
            ? { ...b, text: data.text, image: data.image }
            : b
        )
      );
    },
    onBoardDeleted: (data: BoardEventDataBase) => {
      setList((prev) => prev.filter((b) => b.boardId !== data.boardId));
      if (editingId === data.boardId) setEditingId(null);
    },
  });

  // 업로드
  const handleFiles = async (file?: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const created = await uploadBoardImage(pageId, file);
      setList((prev) => [created, ...prev]);

      sendBoardEvent("created", {
        boardId: created.boardId,
        image: created.image,
        text: created.text,
      });
    } catch (e) {
      console.error(e);
      setError("업로드에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleFiles(file);
  };

  // 수정 저장
  const saveText = async (boardId: number, nextText: string) => {
    try {
      setSavingId(boardId);
      const updated = await patchBoardText(boardId, nextText);
      setList((prev) =>
        prev.map((b) => (b.boardId === boardId ? { ...b, ...updated } : b))
      );
      setEditingId(null);

      sendBoardEvent("updated", {
        boardId,
        image: updated.image ?? null,
        text: updated.text ?? null,
      });
    } catch (e) {
      console.error(e);
      setError("설명 저장에 실패했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  // 삭제
  const remove = async (boardId: number) => {
    if (!confirm("이 추가 자료를 삭제할까요?")) return;
    try {
      setDeletingId(boardId);
      await deleteBoard(boardId);
      setList((prev) => prev.filter((b) => b.boardId !== boardId));
      if (editingId === boardId) setEditingId(null);

      sendBoardEvent("deleted", { boardId });
    } catch (e) {
      console.error(e);
      setError("삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Wrap>
        <Uploader
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          aria-label="사진 업로드 또는 드래그 앤 드롭"
        >
          <span>{uploading ? "업로드 중" : "사진 업로드"}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFiles(e.target.files?.[0] ?? undefined)}
            hidden
          />
        </Uploader>

        {loading && <Hint>불러오는 중…</Hint>}
        {error && <Error role="alert">{error}</Error>}

        <List role="list" aria-busy={loading || uploading}>
          {list.map((b) => {
            const isEditing = editingId === b.boardId;
            const isSaving = savingId === b.boardId;
            const isDeleting = deletingId === b.boardId;

            const src = b.image ? toUrl(b.image) : "";

            return (
              <Item key={b.boardId} role="listitem">
                {b.image && (
                  <ThumbButton
                    type="button"
                    onClick={() => setPreview({ src, alt: "추가자료 이미지" })}
                    aria-label="이미지 크게 보기"
                  >
                    <Thumb src={src} alt="추가자료 이미지" />
                  </ThumbButton>
                )}

                <Row>
                  <Actions>
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          aria-label="설명 저장"
                          disabled={isSaving}
                          onClick={() => {
                            const textarea = document.getElementById(
                              `edit-${b.boardId}`
                            ) as HTMLTextAreaElement | null;
                            if (textarea)
                              saveText(b.boardId, textarea.value.trim());
                          }}
                        >
                          {isSaving ? "저장중…" : "저장"}
                        </Button>
                        <Button
                          type="button"
                          aria-label="편집 취소"
                          onClick={() => setEditingId(null)}
                          $variant="ghost"
                        >
                          취소
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          onClick={() => setEditingId(b.boardId)}
                        >
                          수정
                        </Button>
                        <DangerBtn
                          type="button"
                          onClick={() => remove(b.boardId)}
                          disabled={isDeleting}
                          aria-label="추가 자료 삭제"
                        >
                          {isDeleting ? "삭제중…" : "삭제"}
                        </DangerBtn>
                      </>
                    )}
                  </Actions>
                </Row>

                {isEditing ? (
                  <EditArea
                    id={`edit-${b.boardId}`}
                    defaultValue={b.text ?? ""}
                    placeholder="이미지에 대한 설명이나 텍스트를 입력하세요"
                  />
                ) : b.text ? (
                  <MarkdownText>{b.text}</MarkdownText>
                ) : (
                  <EmptyLine>설명이 없습니다.</EmptyLine>
                )}
              </Item>
            );
          })}

          {!loading && list.length === 0 && (
            <Empty>아직 업로드된 추가 자료가 없어요.</Empty>
          )}
        </List>
      </Wrap>

      {preview && (
        <Overlay
          role="dialog"
          aria-modal="true"
          aria-label="이미지 미리보기"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreview(null);
            }
          }}
        >
          <PreviewInner>
            <PreviewImg src={preview.src} alt={preview.alt} />
            <CloseBtn type="button" onClick={() => setPreview(null)}>
              닫기
            </CloseBtn>
          </PreviewInner>
        </Overlay>
      )}
    </>
  );
}

/* styles */
const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: ${PANEL_FIXED_H_LIVE};
  min-width: 0;
`;

const Uploader = styled.div`
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  &:hover {
    background: var(--c-white);
  }
`;

const Hint = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
`;

const Error = styled.p`
  margin: 0;
  color: #b91c1c;
  font-size: 0.875rem;
`;

const List = styled.div`
  display: grid;
  gap: 12px;
  overflow: auto;
`;

const Item = styled.article`
  background: var(--c-white);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px;
  min-width: 0;
`;

const ThumbButton = styled.button`
  all: unset;
  display: block;
  width: 100%;
  cursor: pointer;
  margin-bottom: 8px;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
    border-radius: 10px;
  }
`;

const Thumb = styled.img`
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  border-radius: 8px;
`;

const Row = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 8px;
`;

const Actions = styled.div`
  display: inline-flex;
  gap: 8px;
`;

const Button = styled.button<{ $variant?: "ghost" }>`
  border: 2px solid var(--c-blue);
  color: var(--c-blue);
  background: var(--c-white);
  border-radius: 999px;
  ${fonts.regular20};
  padding: 4px 10px;
  cursor: pointer;
  ${({ $variant }) =>
    $variant === "ghost" && `border-color:#e5e7eb;color:#374151;`}
`;

const DangerBtn = styled(Button)`
  border-color: #ef4444;
  color: #ef4444;
`;

const EditArea = styled.textarea`
  width: 100%;
  min-height: 150px;
  resize: vertical;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  ${fonts.regular17};
  &:focus-visible {
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const EmptyLine = styled.p`
  margin: 0;
  color: var(--c-grayD);
`;

const Empty = styled.p`
  margin: 0;
  color: var(--c-grayD);
  font-size: 0.9rem;
  text-align: center;
`;

/* 이미지 확대 오버레이 */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
`;

const PreviewInner = styled.div`
  position: relative;
  max-width: 100%;
  max-height: 100%;
`;

const PreviewImg = styled.img`
  max-width: min(100vw - 48px, 960px);
  max-height: min(100vh - 96px, 720px);
  border-radius: 12px;
  display: block;
  background: #0f172a;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  border-radius: 999px;
  padding: 4px 10px;
  ${fonts.regular17};
  background: rgba(15, 23, 42, 0.85);
  color: #f9fafb;
  cursor: pointer;

  &:hover {
    background: rgba(15, 23, 42, 1);
  }
`;
