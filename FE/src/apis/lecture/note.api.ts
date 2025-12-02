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
