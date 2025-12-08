import instance, { getResponse } from "@apis/instance";

/* ===== 타입 ===== */

export type BoardTts = {
  female?: string | null;
  male?: string | null;
};

export type BoardItem = {
  boardId: number;
  image: string | null;
  text: string | null;
  board_tts?: BoardTts | null;
};

export type BoardListResponse = {
  pageId: number;
  boards: BoardItem[];
};

export type PatchBoardTtsRequest = {
  board_text: string;
  processed_text: string;
};

export type PatchBoardTtsResponse = {
  board_id: number;
  board_text: string;
  board_tts: BoardTts | null;
};

/* ===== 조회 ===== */
export async function fetchBoards(pageId: number) {
  return await getResponse<BoardListResponse>(`/page/${pageId}/board/`);
}

/* ===== 업로드 ===== */
export async function uploadBoardImage(pageId: number, file: File) {
  const form = new FormData();
  form.append("image", file);
  const res = await instance.post<BoardItem>(`/page/${pageId}/board/`, form);
  return res.data;
}

/* ===== 수정 ===== */
export async function patchBoardText(boardId: number, text: string) {
  const res = await instance.patch<BoardItem>(`/board/${boardId}/`, { text });
  return res.data;
}

/* ===== 수정 - tts 포함 ===== */
export async function patchBoardTextWithTts(
  boardId: number,
  body: PatchBoardTtsRequest
) {
  const res = await instance.patch<PatchBoardTtsResponse>(
    `/board/${boardId}/tts/`,
    body
  );
  return res.data;
}

/* ===== 삭제 ===== */
export async function deleteBoard(boardId: number) {
  await instance.delete(`/board/${boardId}/`);
  return true;
}
