import {
  deleteResponse,
  getResponse,
  patchResponse,
  postResponse,
} from "@apis/instance";
import type { Lecture } from "./types";

type LectureListItemDTO = {
  id: number;
  title: string;
  code: string;
  lecture_tts: string | null;
  created_at: string;
};

type LectureListResponse =
  | LectureListItemDTO[]
  | { lecture: LectureListItemDTO[] };

const isArray = (v: unknown): v is LectureListItemDTO[] =>
  Array.isArray(v) &&
  v.every((x) => x && typeof x === "object" && "id" in x && "title" in x);

const mapItem = (dto: LectureListItemDTO): Lecture => ({
  lecture_id: dto.id,
  title: dto.title,
  code: dto.code,
  created_at: dto.created_at,
  lecture_tts: dto.lecture_tts,
});

export const fetchLectures = async (): Promise<Lecture[]> => {
  const res = await getResponse<LectureListResponse>("/lecture/");

  if (isArray(res)) return res.map(mapItem);

  if (typeof res === "object" && res?.lecture && isArray(res.lecture)) {
    return res.lecture.map(mapItem);
  }

  return [];
};

// 새 강의 생성
type CreateLectureReq = { title: string };
type CreateLectureRes = { lecture_id: number; title: string; code: string };

export const createLecture = async (
  payload: CreateLectureReq
): Promise<Lecture | null> => {
  const res = await postResponse<CreateLectureReq, CreateLectureRes>(
    "/lecture/",
    payload
  );
  if (!res) return null;
  return {
    lecture_id: res.lecture_id,
    title: res.title,
    code: res.code,
  };
};

// 강의 코드로 참여
type JoinLectureReq = { code: string };
type JoinLectureRes = { lecture_id: number; title: string };

export const joinLecture = async (
  payload: JoinLectureReq
): Promise<Lecture | null> => {
  const res = await postResponse<JoinLectureReq, JoinLectureRes>(
    "/lecture/join/",
    payload
  );
  if (!res) return null;
  return {
    lecture_id: res.lecture_id,
    title: res.title,
  };
};

export const updateLecture = async (
  lectureId: number,
  payload: { title: string }
): Promise<Lecture | null> => {
  const res = await patchResponse<{ title: string }, Lecture>(
    `/lecture/${lectureId}/`,
    payload
  );
  if (!res) return null;
  return res;
};

export const deleteLecture = (id: number) => deleteResponse(`/lecture/${id}/`);
