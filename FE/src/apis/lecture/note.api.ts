import { getResponse, postResponse, patchResponse } from "@apis/instance";

export type NoteTts = {
  female?: string | null;
  male?: string | null;
} | null;

export type Note = {
  note_id: number;
  content: string;
  note_tts?: NoteTts;
};

export async function fetchNoteByPage(pageId: number): Promise<Note | null> {
  const data = await getResponse<Note>(`/class/${pageId}/note/`);
  return data ?? null;
}

export async function createNote(
  pageId: number,
  content: string
): Promise<Note | null> {
  return await postResponse<{ content: string }, Note>(
    `/class/${pageId}/note/`,
    { content }
  );
}

export async function updateNote(
  noteId: number,
  content: string
): Promise<Note | null> {
  return await patchResponse<{ content: string }, Note>(
    `/class/note/${noteId}/`,
    { content }
  );
}

//노트 업데이트 tts

type UpdateNoteTtsRequest = {
  content: string;
};

export async function updateNoteTts(
  noteId: number,
  content: string
): Promise<Note> {
  const data = await patchResponse<UpdateNoteTtsRequest, Note>(
    `/class/note/${noteId}/tts/`,
    { content }
  );

  if (!data) {
    throw new Error("노트 TTS 응답이 올바르지 않습니다.");
  }

  return data;
}
