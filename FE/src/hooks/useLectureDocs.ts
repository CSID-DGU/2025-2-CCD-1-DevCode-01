import { useCallback, useEffect, useState } from "react";
import {
  fetchLectureDocs,
  uploadLectureDoc,
  deleteLectureDoc,
  updateLectureDoc,
} from "src/entities/doc/api";
import type { LectureDoc } from "src/entities/doc/types";
import toast from "react-hot-toast";

export function useLectureDocs(lectureId: number | null) {
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<LectureDoc[]>([]);

  const refresh = useCallback(async () => {
    if (!lectureId) return;
    setBusy(true);
    try {
      const list = await fetchLectureDocs(lectureId);
      setDocs(list);
    } catch {
      toast.error("교안 목록을 불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [lectureId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      if (!lectureId) return;
      setBusy(true);
      try {
        const created = await uploadLectureDoc(lectureId, file);
        setDocs((prev) => [created, ...prev]);
        toast.success(`업로드 완료: ${file.name}`);
      } catch {
        toast.error("업로드에 실패했어요.");
      } finally {
        setBusy(false);
      }
    },
    [lectureId]
  );

  const remove = useCallback(
    async (docId: number) => {
      if (!lectureId) return;
      await deleteLectureDoc(docId);
      setDocs((prev) => prev.filter((x) => x.id !== docId));
      toast.success("삭제되었습니다.");
    },
    [lectureId]
  );

  const updateTitle = useCallback(async (docId: number, title: string) => {
    const updated = await updateLectureDoc(docId, title);
    if (updated) {
      setDocs((prev) =>
        prev.map((x) => (x.id === docId ? { ...x, title: updated.title } : x))
      );
      toast.success("제목이 수정되었습니다.");
    } else {
      toast.error("수정에 실패했어요.");
    }
  }, []);

  return { busy, docs, refresh, upload, remove, updateTitle };
}
