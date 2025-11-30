export type LectureTts = {
  female?: string | null;
  male?: string | null;
} | null;

export type Lecture = {
  lecture_id: number;
  title: string;
  code?: string;
  created_at?: string;
  lecture_tts?: LectureTts;
};
