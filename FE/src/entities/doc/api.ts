import {
  getResponse,
  deleteResponse,
  postNoResponse,
  patchResponse,
} from "@apis/instance";
import type { LectureDoc, LectureDocDTO, LectureDocsResponse } from "./types";
import { mapLectureDoc } from "./types";

/* ---------- 타입 가드 ---------- */
const isLectureDocDTO = (v: unknown): v is LectureDocDTO => {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.docId === "number" &&
    typeof o.title === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.review === "boolean" &&
    (typeof o.timestamp === "string" || o.timestamp === null)
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

// 파일 업로드
export const uploadLectureDoc = async (
  lectureId: number,
  file: File
): Promise<LectureDoc> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await postNoResponse<unknown>(
    `/lecture/${lectureId}/doc/`,
    formData
  );

  if (!isLectureDocDTO(res)) {
    throw new Error("Invalid upload response");
  }

  return mapLectureDoc(res);
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
