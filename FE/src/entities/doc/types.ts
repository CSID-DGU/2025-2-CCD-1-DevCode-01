// 프론트에서 사용할 도메인 타입 (UI는 이걸 사용)
export type LectureDoc = {
  id: number;
  title: string;
  created_at: string; // 표시용 문자열(그대로 사용)
};

// 백엔드 응답 DTO 타입
export type LectureDocDTO = {
  docId: number;
  title: string;
  createdAt: string; // "YYYY-MM-DD HH:mm"
};

export type LectureDocsResponse = {
  lectureId: number;
  docs: LectureDocDTO[];
};

// DTO -> 도메인 매핑
export const mapLectureDoc = (dto: LectureDocDTO): LectureDoc => ({
  id: dto.docId,
  title: dto.title,
  // 굳이 Date로 파싱하지 않고 그대로 전달 (크로스브라우저 안전)
  created_at: dto.createdAt,
});
