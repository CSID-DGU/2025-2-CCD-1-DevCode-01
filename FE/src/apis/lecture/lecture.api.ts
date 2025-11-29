import { getResponse, postResponse } from "@apis/instance";
import type { AxiosError } from "axios";

export type PageStatus = "processing" | "done";

export type PageTTSResponse = {
  page_tts?: {
    female?: string;
    male?: string;
  };
};

export type PageTTSResult = {
  female: string;
  male: string;
};

export type DocPage = {
  docId: number;
  pageNumber: number;
  pageId: number;
  image: string | null;
  ocr: string | null;
  totalPage: number;
  tts?: string;
  status: PageStatus;
};

export async function fetchDocPage(docId: number, page: number) {
  type Raw = {
    docId: number;
    pageNumber: number;
    pageId?: number;
    pagId?: number;
    image: string | null;
    ocr: string | null;
    totalPage: number;
    tts?: string;
    status: PageStatus;
  };

  const data = await getResponse<Raw>(`/doc/${docId}/${page}/`);
  if (!data) return null;

  const pageId = data.pageId ?? data.pagId ?? -1;

  const base = import.meta.env.VITE_BASE_URL?.replace(/\/$/, ""); // 맨뒤 / 제거

  let fullImage: string | null = null;
  if (data.image) {
    fullImage = data.image.startsWith("http")
      ? data.image
      : `${base}${data.image.startsWith("/") ? "" : "/"}${data.image}`;
  }

  const mapped: DocPage = {
    docId: data.docId,
    pageNumber: data.pageNumber,
    pageId,
    image: fullImage,
    ocr: data.ocr,
    totalPage: data.totalPage,
    tts: data.tts,
    status: data.status ?? "done",
  };
  return mapped;
}

export type PageSummary = {
  page_id: number;
  summary: string;
  summary_tts?: string;
};

export async function fetchPageSummary(pageId: number) {
  const data = await postResponse<null, PageSummary>(
    `/page/${pageId}/summary/`,
    null
  );
  if (!data) throw new Error("요약 불러오기 실패");
  return data;
}

//강의 tts
export type PageTTSRequestBody = {
  ocr_text: string;
};

function isAxiosError(error: unknown): error is AxiosError {
  return typeof error === "object" && error !== null && "isAxiosError" in error;
}

function getHttpStatus(err: unknown): number | null {
  if (isAxiosError(err) && err.response?.status) {
    return err.response.status;
  }
  return null;
}

// 수식 포함 최종 텍스트 기반 TTS 요청

export async function fetchPageTTS(
  pageId: number,
  ocrText: string,
  retry = 1
): Promise<PageTTSResult> {
  try {
    const body: PageTTSRequestBody = { ocr_text: ocrText };

    const data = await postResponse<PageTTSRequestBody, PageTTSResponse>(
      `/page/${pageId}/tts/`,
      body
    );

    const female = data?.page_tts?.female;
    const male = data?.page_tts?.male;

    if (!female || !male) {
      throw new Error("TTS 응답 형식이 올바르지 않습니다.");
    }

    const result: PageTTSResult = { female, male };
    return result;
  } catch (err: unknown) {
    const status = getHttpStatus(err);

    if (
      status !== null &&
      retry > 0 &&
      (status === 404 || status === 409 || status === 500)
    ) {
      await new Promise((r) => setTimeout(r, 800));
      return fetchPageTTS(pageId, ocrText, retry - 1);
    }

    throw err;
  }
}
