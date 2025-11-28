// 프론트에서 실제로 쓰는 “내부용 데이터 모양”
export type LectureDoc = {
  id: number;
  title: string;
  created_at: string;
  review: boolean;
  timestamp: string | null;
};

//서버가 보내주는 원본 데이터 모양
export type LectureDocDTO = {
  docId: number;
  title: string;
  createdAt: string;
  review: boolean;
  timestamp: string | null;
};

export type LectureDocsResponse = {
  lectureId: number;
  docs: LectureDocDTO[];
};

export const mapLectureDoc = (dto: LectureDocDTO): LectureDoc => ({
  id: dto.docId,
  title: dto.title,
  review: dto.review,
  timestamp: dto.timestamp,
  created_at: dto.createdAt,
});
