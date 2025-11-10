// src/apis/lecture/speech.api.ts
import instance from "@apis/instance";

export async function uploadSpeech(
  pageId: number,
  file: Blob,
  timeStampHHMMSS: string
) {
  const fd = new FormData();
  fd.append("audio", file, `lecture-${pageId}.wav`);
  fd.append("timestamp", timeStampHHMMSS);

  const { data } = await instance.post(`/class/speech/${pageId}/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { audio: string; timestamp: string };
}

/** 응답 기다리지 않는 버전(대용량 OK: SPA 내 라우팅은 업로드를 끊지 않음) */
export function uploadSpeechFireAndForget(
  pageId: number,
  file: Blob,
  timeStampHHMMSS: string
) {
  const fd = new FormData();
  fd.append("audio", file, `lecture-${pageId}.wav`);
  fd.append("timestamp", timeStampHHMMSS);

  const base = (instance.defaults.baseURL ?? "").replace(/\/+$/, "");
  const url = `${base}/class/speech/${pageId}/`;

  const token = localStorage.getItem("access") ?? "";

  // ❌ keepalive 안 씀(64KB 제한 회피)
  void fetch(url, {
    method: "POST",
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch((e) => {
    console.warn("[speech upload] fire-and-forget failed:", e);
  });
}
