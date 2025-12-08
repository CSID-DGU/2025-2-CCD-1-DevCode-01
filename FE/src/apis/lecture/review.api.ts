import { getResponse, postResponse } from "@apis/instance";

export type TtsPair = {
  female?: string | null;
  male?: string | null;
};

export type PageReviewNote = {
  note_id: number;
  content: string;
  note_tts?: TtsPair | null;
};

export type PageReviewSpeech = {
  speech_id: number;
  stt: string;
  stt_tts?: TtsPair | null;
  end_time: string;
  duration: string;
  status?: string;
};

export type PageReviewBookmark = {
  bookmark_id: number;
  timestamp: string;
};

export type PageReviewBoard = {
  boardId: number;
  image: string | null;
  text: string | null;
  board_tts?: TtsPair | null;
};

export type PageReview = {
  status?: "processing" | "done";
  note: PageReviewNote | null;
  speeches: PageReviewSpeech[];
  bookmarks: PageReviewBookmark[];
  boards: PageReviewBoard[];
};

export type PageReviewRequest = {
  boards: {
    boardId: number;
    text: string;
  }[];
};

export async function postPageReview(
  pageId: number,
  body: PageReviewRequest
): Promise<PageReview> {
  const data = await postResponse<PageReviewRequest, PageReview>(
    `/page/${pageId}/review/`,
    body
  );

  if (!data) {
    throw new Error("리뷰 응답이 올바르지 않습니다.");
  }

  return data;
}
export type BookmarkDetail = {
  stt_tts: {
    female?: string;
    male?: string;
  } | null;
  relative_time: number;
  text: string;
};

//북마크 재생
export async function fetchBookmarkDetail(
  bookmarkId: number
): Promise<BookmarkDetail> {
  const data = await getResponse<BookmarkDetail>(
    `/class/bookmark/${bookmarkId}/`
  );

  if (!data) {
    throw new Error("북마크 정보를 불러오지 못했습니다.");
  }

  return data;
}
