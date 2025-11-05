import { getResponse, postResponse } from "@apis/instance";
import type { Lecture } from "./types";

// 폴더(강의) 목록 응답
type LectureListItemDTO = {
  id: number;
  title: string;
  code: string;
  lecture_tts: string | null;
  created_at: string;
};
type LectureListResponse = {
  lecture: LectureListItemDTO[];
};

// 생성 요청/응답
type CreateLectureReq = { title: string };
type CreateLectureRes = { lecture_id: number; title: string; code: string };

// 코드 참여 요청/응답
type JoinLectureReq = { code: string };
type JoinLectureRes = { lecture_id: number; title: string };

const isLectureListResponse = (v: unknown): v is LectureListResponse => {
  return (
    typeof v === "object" &&
    v !== null &&
    "lecture" in v &&
    Array.isArray((v as LectureListResponse).lecture)
  );
};

const mapListItem = (dto: LectureListItemDTO): Lecture => ({
  lecture_id: dto.id,
  title: dto.title,
  code: dto.code,
  created_at: dto.created_at,
  lecture_tts: dto.lecture_tts,
});

/* ---------------- API ---------------- */

// 모든 강의 목록 조회
export const fetchLectures = async (): Promise<Lecture[]> => {
  const res = await getResponse<LectureListResponse>("/api/lectures/");
  if (!isLectureListResponse(res)) {
    console.warn("[fetchLectures] 예상치 못한 응답:", res);
    return [];
  }
  return res.lecture.map(mapListItem);
};

// 새 강의 생성
export const createLecture = async (
  payload: CreateLectureReq
): Promise<Lecture | null> => {
  const res = await postResponse<CreateLectureReq, CreateLectureRes>(
    "/api/lectures/",
    payload
  );
  if (!res) return null;
  const mapped: Lecture = {
    lecture_id: res.lecture_id,
    title: res.title,
    code: res.code,
  };
  return mapped;
};

// 강의 코드로 참여
export const joinLecture = async (
  payload: JoinLectureReq
): Promise<Lecture | null> => {
  const res = await postResponse<JoinLectureReq, JoinLectureRes>(
    "/api/lectures/join/",
    payload
  );
  if (!res) return null;
  const mapped: Lecture = {
    lecture_id: res.lecture_id,
    title: res.title,
  };
  return mapped;
};
