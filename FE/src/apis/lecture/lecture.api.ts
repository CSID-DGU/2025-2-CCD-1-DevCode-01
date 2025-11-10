import { getResponse } from "@apis/instance";

export type DocPage = {
  docId: number;
  pageNumber: number;
  pageId: number;
  image: string;
  ocr: string;
  totalPage: number;
  tts?: string;
};

export async function fetchDocPage(docId: number, page: number) {
  type Raw = {
    docId: number;
    pageNumber: number;
    pageId?: number;
    pagId?: number;
    image: string;
    ocr: string;
    totalPage: number;
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
    totalPage: data.totalPage,
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
