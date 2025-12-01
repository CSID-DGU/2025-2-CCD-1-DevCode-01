import { getResponse } from "@apis/instance";

export type TtsGenderSet = {
  female?: string;
  male?: string;
} | null;

export type PageReview = {
  status?: "processing" | "done";

  note?: {
    note_id: number;
    content: string;
    note_tts?: TtsGenderSet;
  } | null;

  speeches?: Array<{
    speech_id: number;
    stt: string;
    stt_tts?: TtsGenderSet;
    end_time?: string;
    duration?: string;
    status?: string;
  }>;

  bookmarks?: Array<{
    bookmark_id: number;
    timestamp: string;
  }>;

  boards?: Array<{
    boardId: number;
    image: string;
    text: string | null;
    board_tts?: TtsGenderSet;
  }>;
};

export async function fetchPageReview(
  pageId: number
): Promise<PageReview | null> {
  const raw = await getResponse<PageReview>(`/page/${pageId}/review/`);
  if (!raw) return null;

  const base = import.meta.env.VITE_BASE_URL?.replace(/\/$/, "") ?? "";

  const boards =
    raw.boards?.map((b) => {
      const fullImage = b.image?.startsWith("http")
        ? b.image
        : `${base}${b.image?.startsWith("/") ? "" : "/"}${b.image}`;
      return {
        ...b,
        image: fullImage,
      };
    }) ?? undefined;

  return {
    ...raw,
    boards,
  };
}
