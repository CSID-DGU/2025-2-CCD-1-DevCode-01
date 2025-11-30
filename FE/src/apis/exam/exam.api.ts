import { getResponse, postResponse } from "@apis/instance";

export type ExamItemKind =
  | "qnum"
  | "text"
  | "choice"
  | "chart"
  | "code"
  | "table";

export type ExamItem = {
  kind: ExamItemKind;
  imagePath: string;
  displayText: string;
};

export type ExamQuestion = {
  questionNumber: number;
  questionImagePath: string;
  items: ExamItem[];
};

export type ExamResultResponse = {
  endTime: string;
  questions: ExamQuestion[];
};

// 시험 조회
export async function fetchExamResult(): Promise<ExamResultResponse | null> {
  return await getResponse<ExamResultResponse>("/exam/result/");
}

//시험 시작
export async function startExam(
  endTime: string,
  images: File[]
): Promise<ExamResultResponse | null> {
  const formData = new FormData();
  formData.append("endTime", endTime);

  images.forEach((file) => {
    formData.append("images", file);
  });

  const res = await postResponse<FormData, ExamResultResponse>(
    "/exam/start/",
    formData
  );
  return res;
}
