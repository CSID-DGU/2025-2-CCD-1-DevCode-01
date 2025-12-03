import { useEffect, useRef, useState, type FocusEvent } from "react";
import styled from "styled-components";
import { type PageReview, type TtsPair } from "@apis/lecture/review.api";
import {
  createNote,
  updateNote,
  fetchNoteByPage,
  updateNoteTts,
  type Note,
  type NoteTts,
} from "@apis/lecture/note.api";
import { fonts } from "@styles/fonts";

export type MemoBoxProps = {
  pageId: number;
  docId?: number;
  review?: PageReview | null;
  autoSaveDebounceMs?: number;
  saveOnUnmount?: boolean;
  autoReadOnFocus?: boolean;
  updateWithTts?: boolean;
  onPlayMemoTts?: (payload: { content: string; tts?: TtsPair | null }) => void;
};

export default function MemoBox({
  pageId,
  docId,
  review,
  autoSaveDebounceMs = 1200,
  saveOnUnmount = true,
  autoReadOnFocus = true,
  onPlayMemoTts,
  updateWithTts = false,
}: MemoBoxProps) {
  const [noteId, setNoteId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [noteTts, setNoteTts] = useState<NoteTts | null>(null);
  const [dirty, setDirty] = useState(false);

  const [status, setStatus] = useState<
    "idle" | "loading" | "saving" | "saved" | "error"
  >("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const prevPageRef = useRef<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  };

  /* ---------- 1) review.note 기반 초기화 ---------- */
  useEffect(() => {
    if (!review) {
      console.log("[MemoBox] review 없음, note API로 조회 예정");
      return;
    }

    console.log("[MemoBox] review 변경 감지", {
      hasNote: !!review.note,
      note: review.note,
    });

    if (review.note) {
      setNoteId(review.note.note_id);
      setContent(review.note.content ?? "");
      setNoteTts(review.note.note_tts ?? null);
      setDirty(false);
    } else {
      setNoteId(null);
      setContent("");
      setNoteTts(null);
      setDirty(false);
    }
  }, [review]);

  /* ---------- 2) review가 없을 때 API로 메모 조회 ---------- */
  useEffect(() => {
    if (review) return;

    let cancelled = false;

    const load = async () => {
      setStatus("loading");
      setErrMsg(null);
      try {
        console.log("[Memo] GET /note/ 조회...", pageId);

        const note = await fetchNoteByPage(pageId);
        if (cancelled) return;

        if (note) {
          console.log("[Memo] ▶ 메모 있음:", note);
          setNoteId(note.note_id);
          setContent(note.content ?? "");
          setNoteTts(note.note_tts ?? null);
        } else {
          setNoteId(null);
          setContent("");
          setNoteTts(null);
        }
        setDirty(false);
        setStatus("idle");
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setStatus("error");
        setErrMsg("메모를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [pageId, review]);

  /* ---------- 저장 로직: noteId 유무에 따라 POST / PATCH (텍스트만) ---------- */
  // MemoBox.tsx 안

  const saveOnce = async () => {
    if (!dirty) return;

    if (noteId == null && content.trim() === "") {
      setDirty(false);
      setStatus("idle");
      return;
    }

    setStatus("saving");
    setErrMsg(null);

    try {
      let saved: Note | null = null;

      if (noteId == null) {
        saved = await createNote(pageId, content);
        if (saved) setNoteId(saved.note_id);
      } else {
        if (updateWithTts) {
          saved = await updateNoteTts(noteId, content);
        } else {
          saved = await updateNote(noteId, content);
        }
      }

      if (!saved) {
        throw new Error("저장 실패");
      }
      setContent(saved.content ?? content);
      setNoteTts(saved.note_tts ?? null);
      setDirty(false);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      console.error(e);
      setStatus("error");
      setErrMsg("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  /* ---------- 자동 저장 타이머 ---------- */
  useEffect(() => {
    clearTimer();
    if (dirty) {
      saveTimer.current = setTimeout(() => {
        void saveOnce();
      }, autoSaveDebounceMs);
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, dirty, noteId, pageId, autoSaveDebounceMs]);

  useEffect(() => {
    const prev = prevPageRef.current;
    if (prev !== null && prev !== pageId) {
      clearTimer();
      void saveOnce();
    }
    prevPageRef.current = pageId;

    return () => {
      clearTimer();
      if (saveOnUnmount) void saveOnce();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, saveOnUnmount]);

  const onBlur: React.FocusEventHandler<HTMLTextAreaElement> = () => {
    clearTimer();
    void saveOnce();
  };

  /* ---------- 포커스 TTS 핸들러 ---------- */
  const handleFocus: React.FocusEventHandler<HTMLTextAreaElement> = async (
    e: FocusEvent<HTMLTextAreaElement>
  ) => {
    console.log("[MemoBox] handleFocus fired", {
      targetEq: e.currentTarget === e.target,
      autoReadOnFocus,
      hasOnPlayMemoTts: !!onPlayMemoTts,
      noteId,
      contentLen: content.trim().length,
      dirty,
      updateWithTts,
    });
    // if (e.currentTarget !== e.target) return;
    if (!autoReadOnFocus) return;
    // if (!onPlayMemoTts) return;

    // const text = content.trim();

    if (e.currentTarget !== e.target) return;
    if (!autoReadOnFocus) {
      console.log("[MemoBox] autoReadOnFocus=false → 조용히 종료");
      return;
    }
    if (!onPlayMemoTts) {
      console.log("[MemoBox] onPlayMemoTts 없음 → 종료");
      return;
    }

    const text = content.trim();
    if (!text) {
      console.log("[MemoBox] content 비어있음 → 종료");
      return;
    }
    if (!text) return;

    if (noteId == null) {
      onPlayMemoTts({ content: text, tts: null });
      return;
    }

    if (updateWithTts && dirty) {
      try {
        const updated = await updateNoteTts(noteId, text);

        setContent(updated.content ?? text);
        setNoteTts(updated.note_tts ?? null);
        setDirty(false);

        const ttsPair: TtsPair | null = updated.note_tts
          ? {
              female: updated.note_tts.female ?? null,
              male: updated.note_tts.male ?? null,
            }
          : null;

        onPlayMemoTts({
          content: updated.content ?? text,
          tts: ttsPair,
        });
        return;
      } catch (err) {
        console.error("[Memo] TTS 갱신 실패:", err);
        onPlayMemoTts({
          content: text,
          tts: null,
        });
        return;
      }
    }

    const ttsPair: TtsPair | null = noteTts
      ? {
          female: noteTts.female ?? null,
          male: noteTts.male ?? null,
        }
      : null;

    onPlayMemoTts({
      content: text,
      tts: ttsPair,
    });
  };

  return (
    <section
      data-doc-id={docId}
      data-page={pageId}
      aria-label={`메모 입력 패널 (문서 ${docId ?? "-"}, 페이지 ${pageId})`}
    >
      <MetaRow aria-live="polite">
        <span>
          {status === "loading" && "불러오는 중"}
          {status === "saving" && "저장 중"}
          {status === "saved" && "저장됨"}
          {status === "error" && (errMsg ?? "오류")}
          {status === "idle" && (dirty ? "변경사항 있음" : "최신 상태")}
        </span>
      </MetaRow>

      <TxtArea
        aria-label="메모 입력"
        placeholder="페이지를 이동하거나 포커스가 해제되면 자동으로 저장됩니다."
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        onBlur={onBlur}
        onFocus={handleFocus}
      />

      <BtnRow>
        <button
          type="button"
          onClick={() => void saveOnce()}
          disabled={!dirty || status === "saving"}
          aria-disabled={!dirty || status === "saving"}
        >
          수동 저장
        </button>
      </BtnRow>
    </section>
  );
}

/* ---------- styled ---------- */
const MetaRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--c-gray9, #666);

  span {
    ${fonts.regular17}
  }
`;

const TxtArea = styled.textarea`
  width: 100%;
  min-height: 240px;
  border: 1px solid var(--c-grayD, #e5e7eb);
  padding: 1rem;
  border-radius: 12px;
  resize: vertical;
  ${fonts.regular24}
  color: var(--c-black);
`;

const BtnRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  justify-content: flex-end;

  button {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: #fff;
    cursor: pointer;
    ${fonts.regular24}
  }
`;
