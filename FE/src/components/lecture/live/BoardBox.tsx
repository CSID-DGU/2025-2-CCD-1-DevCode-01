import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  fetchBoards,
  uploadBoardImage,
  type BoardItem,
} from "@apis/lecture/board.api";
// import { fonts } from "@styles/fonts";
import MarkdownText from "./MarkdownText";

type Props = {
  pageId: number;
  canUpload: boolean;
  /** 이미지 정적 경로가 '/boards/...' 형태면, 서버 절대경로 prefix가 필요하면 넣어줘요. (없으면 그대로 사용) */
  assetBase?: string; // 예: import.meta.env.VITE_BASE_URL
};

export default function BoardBox({ pageId, canUpload, assetBase = "" }: Props) {
  const [list, setList] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const toUrl = (p: string | null) =>
    !p ? "" : p.startsWith("http") ? p : `${assetBase}${p}`;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const handleFiles = async (file?: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const created = await uploadBoardImage(pageId, file);
      // 맨 위에 추가
      setList((prev) => [created, ...prev]);
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
    if (!canUpload) return;
    const file = e.dataTransfer.files?.[0];
    handleFiles(file);
  };

  return (
    <Wrap>
      {canUpload && (
        <Uploader
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          aria-label="사진 업로드 또는 드래그 앤 드롭"
        >
          <span>{uploading ? "업로드 중…" : "사진 업로드"}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFiles(e.target.files?.[0] ?? undefined)}
            hidden
          />
        </Uploader>
      )}

      {loading && <Hint>불러오는 중…</Hint>}
      {error && <Error role="alert">{error}</Error>}

      <List role="list" aria-busy={loading || uploading}>
        {list.map((b) => (
          <Item key={b.boardId} role="listitem">
            {b.image && <Thumb src={toUrl(b.image)} alt="판서 이미지" />}
            <Meta>{b.text && <MarkdownText>{b.text}</MarkdownText>}</Meta>
          </Item>
        ))}
        {!loading && list.length === 0 && (
          <Empty>아직 업로드된 판서가 없어요.</Empty>
        )}
      </List>
    </Wrap>
  );
}

/* ---------------- styles ---------------- */

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Uploader = styled.div`
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  &:hover {
    background: #f8fafc;
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
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px;
`;

const Thumb = styled.img`
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 8px;
`;

const Meta = styled.div`
  display: grid;
  gap: 4px;
`;

// const Text = styled.p`
//   ${fonts.medium24};
//   margin: 0;
//   color: #111827;
// `;
const Empty = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
  text-align: center;
`;
