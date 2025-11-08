import { getResponse } from "@apis/instance";

/** 문서 한 페이지 응답 매핑 */
export type DocPage = {
  docId: number;
  pageNumber: number;
  pageId: number; // 서버가 pagId로 주는 케이스도 있어 합쳐서 처리
  image: string;
  ocr: string;
  sum?: string;
  tts?: string;
};

export async function fetchDocPage(docId: number, page: number) {
  type Raw = {
    docId: number;
    pageNumber: number;
    pageId?: number;
    pagId?: number; // 백엔드 오타 대비
    image: string;
    ocr: string;
    sum?: string;
    tts?: string;
  };

  const data = await getResponse<Raw>(`/doc/${docId}/${page}/`);
  if (!data) return null;

  const pageId = data.pageId ?? data.pagId ?? -1;

  const base = import.meta.env.VITE_BASE_URL?.replace(/\/$/, ""); // 맨뒤 / 제거
  const fullImage = data.image.startsWith("http")
    ? data.image
    : `${base}${data.image.startsWith("/") ? "" : "/"}${data.image}`;

  const mapped: DocPage = {
    docId: data.docId,
    pageNumber: data.pageNumber,
    pageId,
    image: fullImage,
    ocr: data.ocr,
    sum: data.sum,
    tts: data.tts,
  };
  return mapped;
}

export type PageSummary = {
  page_id: number;
  summary: string;
  summary_tts?: string;
};

export async function fetchPageSummary(pageId: number) {
  return getResponse<PageSummary>(`/page/${pageId}/summary/`);
}
