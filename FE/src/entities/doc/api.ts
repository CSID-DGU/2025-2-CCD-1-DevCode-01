import {
  getResponse,
  deleteResponse,
  postNoResponse,
  patchResponse,
} from "@apis/instance";
import type { LectureDoc, LectureDocDTO, LectureDocsResponse } from "./types";
import { mapLectureDoc } from "./types";

/* ---------- 타입 가드 ---------- */

const isDocTtsDTO = (
  v: unknown
): v is { female?: string | null; male?: string | null } => {
  if (v === null || v === undefined) return true; // optional이니까 허용
  if (typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const isStrOrNullOrUndef = (x: unknown) =>
    typeof x === "string" || x === null || x === undefined;

  return isStrOrNullOrUndef(o.female) && isStrOrNullOrUndef(o.male);
};

const isLectureDocDTO = (v: unknown): v is LectureDocDTO => {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.docId === "number" &&
    typeof o.title === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.review === "boolean" &&
    (typeof o.timestamp === "string" || o.timestamp === null) &&
    isDocTtsDTO(o.doc_tts)
  );
};

type UpdateLectureDocReq = { title: string };
type UpdateLectureDocRes = LectureDocDTO;

const isLectureDocsResponse = (v: unknown): v is LectureDocsResponse => {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.lectureId === "number" &&
    Array.isArray(o.doc) &&
    o.doc.every(isLectureDocDTO)
  );
};

/* ---------- APIs ---------- */

// 강의 교안 리스트 조회
export const getLectureDocs = async (
  lectureId: number
): Promise<LectureDoc[]> => {
  const res = await getResponse<unknown>(`/lecture/${lectureId}/doc/`);
  if (!isLectureDocsResponse(res)) return [];
  return res.doc.map(mapLectureDoc);
};

export const uploadLectureDoc = async (
  lectureId: number,
  file: File
): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  await postNoResponse(`/lecture/${lectureId}/doc/`, formData);
};

export const deleteLectureDoc = async (docId: number): Promise<boolean> => {
  const ok = await deleteResponse(`/doc/${docId}/`);
  return Boolean(ok);
};

export const updateLectureDoc = async (
  docId: number,
  title: string
): Promise<LectureDoc | null> => {
  const res = await patchResponse<UpdateLectureDocReq, UpdateLectureDocRes>(
    `/doc/${docId}/`,
    { title }
  );
  if (!res || !isLectureDocDTO(res)) return null;
  return mapLectureDoc(res);
};
