import { getResponse, postResponse } from "@apis/instance";

export type PageStatus = "processing" | "done";

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
