import instance from "@apis/instance";

export async function uploadSpeech(
  pageId: number,
  file: Blob,
  timeStampHHMMSS: string
) {
  const fd = new FormData();
  fd.append("audio", file, `lecture-${pageId}.wav`); // 브라우저 기본은 webm. BE가 mp3로 변환해 파일명 리턴해도 OK
  fd.append("timestamp", timeStampHHMMSS);

  const { data } = await instance.post(`/class/speech/${pageId}/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { audio: string; timestamp: string };
}
