export type LectureDoc = {
  id: number;
  title: string;
  created_at: string;
};

export type LectureDocDTO = {
  docId: number;
  title: string;
  createdAt: string;
};

export type LectureDocsResponse = {
  lectureId: number;
  docs: LectureDocDTO[];
};

export const mapLectureDoc = (dto: LectureDocDTO): LectureDoc => ({
  id: dto.docId,
  title: dto.title,
  created_at: dto.createdAt,
});
