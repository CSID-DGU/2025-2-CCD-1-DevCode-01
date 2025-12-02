import { getResponse, postResponse } from "@apis/instance";

export type UserRole = "student" | "assistant" | string;

export type NoteTts = {
  female?: string | null;
  male?: string | null;
};

export type LectureNote = {
  note_id: number;
  user_role: UserRole;
  content: string;
  note_tts?: NoteTts;
  created_at: string;
};

export async function getLecturesMemo(
  lectureId: number
): Promise<LectureNote[]> {
  const data = await getResponse<LectureNote[]>(`/lecture/${lectureId}/note/`);
  if (!data) throw new Error("메모 조회 실패");
  return data;
}

export async function postLecturesMemo(
  lectureId: number,
  content: string
): Promise<LectureNote> {
  const data = await postResponse<{ content: string }, LectureNote>(
    `/lecture/${lectureId}/note/`,
    { content }
  );
  if (!data) throw new Error("메모 저장 실패");
  return data;
}
