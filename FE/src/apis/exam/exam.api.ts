import { getResponse, postNoResponse, postResponse } from "@apis/instance";

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

export type ExamItemTTS = {
  female: string;
  male: string;
};

export type ExamItemTTSResponse = {
  questionNumber: number;
  itemIndex: number;
  tts: ExamItemTTS;
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

export async function endExam(): Promise<boolean> {
  return await postNoResponse("/exam/end/", null);
}

//시험 tts
export async function fetchExamItemTTS(
  questionNumber: number,
  itemIndex: number,
  text: string
): Promise<ExamItemTTSResponse | null> {
  return await postResponse<
    { questionNumber: number; itemIndex: number; text: string },
    ExamItemTTSResponse
  >("/exam/tts/", { questionNumber, itemIndex, text });
}
