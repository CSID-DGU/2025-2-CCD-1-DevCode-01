import instance, { getResponse } from "@apis/instance";

export type BoardItem = {
  boardId: number;
  image: string | null;
  text: string | null;
};

export type BoardListResponse = {
  pageId: number;
  boards: BoardItem[];
};

/** 판서 리스트 조회 */
export async function fetchBoards(pageId: number) {
  return await getResponse<BoardListResponse>(`/page/${pageId}/board/`);
}

/** 이미지 업로드 (multipart/form-data)  */
export async function uploadBoardImage(pageId: number, file: File) {
  const form = new FormData();
  form.append("image", file);
  // ❗ Content-Type은 직접 지정하지 말 것: axios가 boundary 포함해 자동 설정함
  const res = await instance.post<BoardItem>(`/page/${pageId}/board/`, form);
  return res.data;
}
