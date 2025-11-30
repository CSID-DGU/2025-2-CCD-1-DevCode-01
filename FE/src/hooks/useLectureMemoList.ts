import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLecturesMemo,
  postLecturesMemo,
  type LectureNote,
} from "@apis/lecture/memo.api";

export type Role = "student" | "assistant" | string;

export type MemoItem = {
  text: string;
  role: Role;
  createdAt: string;
  note: LectureNote;
};

type State = { loading: boolean; error: string | null; notes: LectureNote[] };

const STRIP_ICON_RE = /^[\s•]*(🐰|🐣)\s*/u;

const normalizeLines = (s: string) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const stripIcon = (l: string) => l.replace(STRIP_ICON_RE, "").trim();

const iconOfRole = (role: Role) => (role === "assistant" ? "🐣" : "🐰");

export function useLectureMemoList(lectureId: number | null) {
  const [state, setState] = useState<State>({
    loading: false,
    error: null,
    notes: [],
  });

  const currentRole: Role = useMemo(
    () =>
      localStorage.getItem("role") === "assistant" ? "assistant" : "student",
    []
  );

  const load = useCallback(async () => {
    if (!lectureId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const notes = await getLecturesMemo(lectureId);
      setState({ loading: false, error: null, notes });
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "메모를 불러오지 못했습니다.",
      }));
    }
  }, [lectureId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lineMap = useMemo(() => {
    const sorted = [...state.notes].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
    );

    const map = new Map<string, MemoItem>();

    for (const n of sorted) {
      for (const raw of normalizeLines(n.content)) {
        const key = stripIcon(raw);
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, {
            text: key,
            role: n.user_role,
            createdAt: n.created_at,
            note: n,
          });
        }
      }
    }

    return map;
  }, [state.notes]);

  const existingSet = useMemo(() => new Set([...lineMap.keys()]), [lineMap]);

  const items: MemoItem[] = useMemo(() => {
    const toTime = (iso?: string) => (iso ? new Date(iso).getTime() : 0);
    return [...lineMap.values()].sort(
      (a, b) => toTime(a.createdAt) - toTime(b.createdAt)
    );
  }, [lineMap]);

  const saveAll = useCallback(
    async (nextItems: { text: string; role?: Role }[]) => {
      if (!lectureId) return;
      const nextSet = new Set(
        nextItems.map((i) => stripIcon(i.text)).filter(Boolean)
      );
      const newOnes = [...nextSet].filter((t) => t && !existingSet.has(t));

      for (const t of newOnes) {
        await postLecturesMemo(lectureId, t);
      }
      await load();
    },
    [lectureId, existingSet, load]
  );

  return {
    loading: state.loading,
    error: state.error,
    items,
    saveAll,
    reload: load,
    currentRole,
    iconOf: iconOfRole,
  };
}
