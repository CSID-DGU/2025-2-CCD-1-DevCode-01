import instance from "@apis/instance";

let uploadTail: Promise<void> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = uploadTail.then(job, job);
  uploadTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function normalizeHHMMSS(hhmmss: string): string {
  const [h = "0", m = "0", s = "0"] = hhmmss.split(":");
  const H = String(Math.max(0, Number(h))).padStart(2, "0");
  const M = String(Math.max(0, Number(m))).padStart(2, "0");
  const S = String(Math.max(0, Number(s))).padStart(2, "0");
  return `${H}:${M}:${S}`;
}

interface PersistItem {
  url: string;
  token?: string;
  timeStamp: string;
  audioBuf: ArrayBuffer;
  mime: string;
  filename: string;
}
const PERSIST_KEY = "speech:pending";
function loadPersist(): PersistItem[] {
  try {
    return JSON.parse(localStorage.getItem(PERSIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function savePersist(items: PersistItem[]): void {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(items));
  } catch {
    console.log("err");
  }
}
async function persistJob(
  url: string,
  token: string | undefined,
  file: File,
  timeStamp: string
): Promise<void> {
  const audioBuf = await file.arrayBuffer();
  const item: PersistItem = {
    url,
    token,
    timeStamp,
    audioBuf,
    mime: file.type || "audio/webm",
    filename: file.name,
  };
  const cur = loadPersist();
  cur.push(item);
  savePersist(cur);
}

export async function drainSpeechQueue(): Promise<void> {
  const items = loadPersist();
  if (!items.length) return;
  const rest: PersistItem[] = [];
  for (const it of items) {
    try {
      if (!navigator.onLine) {
        rest.push(it);
        continue;
      }
      const fd = new FormData();
      fd.append(
        "audio",
        new File([it.audioBuf], it.filename, { type: it.mime })
      );
      fd.append("timestamp", it.timeStamp);
      const res = await fetch(it.url, {
        method: "POST",
        body: fd,
        headers: it.token ? { Authorization: `Bearer ${it.token}` } : undefined,
      });
      if (!res.ok) rest.push(it);
    } catch {
      rest.push(it);
    }
  }
  savePersist(rest);
}

export function registerSpeechBeacon(): void {
  if (typeof window === "undefined") return;
  const sendAllWithBeacon = () => {
    try {
      const items = loadPersist();
      const token = localStorage.getItem("access") ?? "";
      items.forEach((it) => {
        const fd = new FormData();
        fd.append(
          "audio",
          new File([it.audioBuf], it.filename, { type: it.mime })
        );
        fd.append("timestamp", it.timeStamp);
        const url = token
          ? `${it.url}?beacon=1&token=${encodeURIComponent(token)}`
          : `${it.url}?beacon=1`;
        (
          navigator as unknown as {
            sendBeacon?: (u: string, d: BodyInit) => boolean;
          }
        ).sendBeacon?.(url, fd);
      });
    } catch {
      console.log("Err");
    }
  };
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendAllWithBeacon();
  });
  window.addEventListener("pagehide", sendAllWithBeacon);
  window.addEventListener("online", () => {
    void drainSpeechQueue();
  });
}

export function uploadSpeechQueued(
  pageId: number,
  blob: Blob,
  hhmmssEnd: string,
  opts?: { maxUploadDurationMs?: number }
): void {
  const mime = blob.type || "";
  const ext = mime.includes("webm")
    ? "webm"
    : mime.includes("mp4") || mime.includes("m4a")
    ? "m4a"
    : "dat";

  const file = new File([blob], `lecture-${pageId}.${ext}`, {
    type: mime || `audio/${ext}`,
  });

  const base = (instance.defaults.baseURL ?? "").replace(/\/+$/, "");
  const url = `${base}/class/speech/${pageId}/`;
  const token = localStorage.getItem("access") ?? "";
  const timeStamp = normalizeHHMMSS(hhmmssEnd);

  const MAX_UPLOAD_DURATION_MS = opts?.maxUploadDurationMs ?? 5 * 60_000;

  console.log("[uploadSpeechQueued] enqueue", {
    pageId,
    hhmmssEnd,
    timeStamp,
    url,
    mime,
  });

  void enqueue(async () => {
    if (!navigator.onLine) {
      await persistJob(url, token || undefined, file, timeStamp);
      console.log("[uploadQueued] offline → persisted");
      return;
    }

    const controller = new AbortController();
    const fdFactory = () => {
      const fd = new FormData();
      fd.append("audio", file);
      fd.append("timestamp", timeStamp);
      return fd;
    };

    let timedOut = false;
    const hangGuard = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, MAX_UPLOAD_DURATION_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        body: fdFactory(),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      window.clearTimeout(hangGuard);

      if (res.ok) {
        console.log("[uploadQueued] ✅ success");
        return;
      }
      const msg = await res.text().catch(() => "");
      console.warn(`[uploadQueued] non-OK ${res.status}`, msg);
      await persistJob(url, token || undefined, file, timeStamp);
    } catch (err) {
      window.clearTimeout(hangGuard);
      if (
        err instanceof DOMException &&
        err.name === "AbortError" &&
        timedOut
      ) {
        console.warn(`[uploadQueued] ⏳ hang-guard abort → persist`);
        await persistJob(url, token || undefined, file, timeStamp);
        return;
      }
      console.warn("[uploadQueued] error → persist", (err as Error).message);
      await persistJob(url, token || undefined, file, timeStamp);
    }
  });
}
