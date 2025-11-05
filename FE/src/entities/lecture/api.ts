// src/entities/lecture/api.ts

import { getResponse, postResponse } from "@apis/instance";
import type { Lecture } from "./types";

// -------------------- 타입 정의 --------------------
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

type CreateLectureReq = { title: string };
type CreateLectureRes = { lecture_id: number; title: string; code: string };

type JoinLectureReq = { code: string };
type JoinLectureRes = { lecture_id: number; title: string };

// -------------------- 유틸 --------------------
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

// -------------------- 목데이터 --------------------
const mockLectures: Lecture[] = [
  {
    lecture_id: 1,
    title: "데이터베이스",
    code: "DB1234",
    created_at: "2025-11-01T10:00:00",
    lecture_tts: null,
  },
  {
    lecture_id: 2,
    title: "융합캡스톤디자인",
    code: "CAP5678",
    created_at: "2025-11-02T09:30:00",
    lecture_tts: null,
  },
  {
    lecture_id: 3,
    title: "AI 프로그래밍",
    code: "AI9012",
    created_at: "2025-11-03T14:20:00",
    lecture_tts: null,
  },
];

// -------------------- API --------------------

// ✅ 모든 강의 목록 조회 (없으면 목데이터 반환)
export const fetchLectures = async (): Promise<Lecture[]> => {
  const res = await getResponse<LectureListResponse>("/lecture/");
  if (!isLectureListResponse(res) || !res.lecture.length) {
    console.warn(
      "[fetchLectures] 서버 응답이 없거나 비어 있음 → 목데이터 사용"
    );
    return mockLectures;
  }
  return res.lecture.map(mapListItem);
};

// 새 강의 생성
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
