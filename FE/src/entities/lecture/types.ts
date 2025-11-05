// 서버 응답을 프론트에서 일관되게 쓰기 위한 표준 타입
export type Lecture = {
  lecture_id: number; // 서버 list에서는 id, create/join에서는 lecture_id로 오지만, 프론트는 통일해서 사용
  title: string;
  code?: string; // 목록/생성엔 존재, join 응답에는 없음 → optional
  created_at?: string; // 목록에만 존재 → optional
  lecture_tts?: string | null; // 목록에만 존재 → optional
};
