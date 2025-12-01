import { getResponse, postNoResponse } from "@apis/instance";

// 교수 발화 요약 생성
export const requestDocSpeechSummary = async (
  docId: number,
  timestamp: string
): Promise<boolean> => {
  if (!Number.isFinite(docId)) {
    console.warn("docID 에러:", docId);
    return false;
  }

  const ok = await postNoResponse(`/doc/${docId}/speech/summary/`, {
    timestamp,
  });

  if (!ok) {
    console.warn("교수 발화 요약 생성 요청 실패", docId, timestamp);
  }

  return ok;
};

// 교수발화 요약 리스트

export type SpeechSummaryItem = {
  speechSummaryId: number;
  createdAt: string;
};

export type SpeechSummaryListResponse = {
  summaries: SpeechSummaryItem[];
};

export const fetchDocSpeechSummaries = async (
  docId: number
): Promise<SpeechSummaryListResponse | null> => {
  if (!Number.isFinite(docId)) return null;
  return await getResponse<SpeechSummaryListResponse>(
    `/doc/${docId}/speech/summary/`
  );
};
