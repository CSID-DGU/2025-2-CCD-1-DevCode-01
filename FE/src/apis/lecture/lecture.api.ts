import { getResponse, postResponse } from "@apis/instance";
import type { AxiosError } from "axios";

export type PageStatus = "processing" | "done";

export type PageTTSResponse = {
  status?: "processing" | "done";
  tts?:
    | string
    | {
        female?: string;
        male?: string;
      }
    | null;
  female?: string;
  male?: string;
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
  summary_tts?: {
    female?: string;
    male?: string;
  } | null;
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
  retry = 3
): Promise<PageTTSResult> {
  try {
    const body: PageTTSRequestBody = { ocr_text: ocrText };

    const data = await postResponse<PageTTSRequestBody, PageTTSResponse>(
      `/page/${pageId}/tts/`,
      body
    );
    console.log("TTS 응답(raw):", data);

    if (!data) {
      if (retry > 0) {
        await new Promise((r) => setTimeout(r, 800));
        return fetchPageTTS(pageId, ocrText, retry - 1);
      }
      throw new Error("TTS 응답이 비어 있습니다.");
    }

    let female = "";
    let male = "";

    if (typeof data.tts === "string") {
      female = data.tts;
      male = data.tts;
    }
    // case B: tts가 객체 { female, male }
    else if (data.tts && typeof data.tts === "object") {
      female = data.tts.female ?? "";
      male = data.tts.male ?? "";
    }
    // top-level female/male 필드로 오는 경우
    else {
      female = data.female ?? "";
      male = data.male ?? "";
    }

    // 2) 아직 생성 중인 경우 (URL 없음)
    const hasUrl = !!female || !!male;

    if (!hasUrl) {
      // 백엔드가 status를 주고 processing이면 재시도
      if (data.status === "processing" && retry > 0) {
        await new Promise((r) => setTimeout(r, 800));
        return fetchPageTTS(pageId, ocrText, retry - 1);
      }

      // status가 없지만 어쨌든 URL이 없는 경우 -> 재시도 한 번 더
      if (retry > 0) {
        await new Promise((r) => setTimeout(r, 800));
        return fetchPageTTS(pageId, ocrText, retry - 1);
      }

      throw new Error("TTS 응답에 유효한 URL이 없습니다.");
    }

    const safeFemale = female || male;
    const safeMale = male || female;

    return {
      female: safeFemale!,
      male: safeMale!,
    };
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
