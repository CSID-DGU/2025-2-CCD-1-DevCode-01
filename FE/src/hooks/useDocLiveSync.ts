import { useCallback, useEffect, useMemo, useRef } from "react";

export type LiveMessage =
  | { type: "PAGE_CHANGE"; page: number }
  | { type: "PING" };

export interface UseDocLiveSyncOptions {
  serverBase: string;
  docId: number;
  token: string | null | undefined;
  onRemotePage: (page: number) => void;
  totalPages?: number | null;
  announce?: (msg: string) => void;
  debug?: boolean;
}

export function useDocLiveSync({
  serverBase,
  docId,
  token,
  onRemotePage,
  totalPages,
  announce,
  debug = import.meta.env?.DEV ?? false,
}: UseDocLiveSyncOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef({ tries: 0, closedByUser: false });
  const pingTimer = useRef<number | null>(null);
  const onRemotePageRef = useRef(onRemotePage);

  // 안전 로그 출력기 (토큰 마스킹)
  const maskUrl = (u: string) => u.replace(/([?&]token=)[^&]+/i, "$1***");
  const log = (...args: unknown[]) => {
    if (!debug) return;

    console.log("[WS]", ...args);
  };
  const warn = (...args: unknown[]) => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.warn("[WS]", ...args);
  };
  const error = (...args: unknown[]) => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.error("[WS]", ...args);
  };

  // 최신 콜백 고정
  useEffect(() => {
    onRemotePageRef.current = onRemotePage;
  }, [onRemotePage]);

  const clamp = useCallback(
    (n: number) => {
      const min = 1;
      if (!totalPages) return Math.max(min, n);
      return Math.min(Math.max(min, n), totalPages);
    },
    [totalPages]
  );

  // ws://{server}/ws/doc/{docId}/?token={token}
  const url = useMemo(() => {
    if (!serverBase || !docId || !token) return null;
    const base = serverBase.replace(/\/+$/, "");
    return `${base}/ws/doc/${encodeURIComponent(
      String(docId)
    )}/?token=${encodeURIComponent(token)}`;
  }, [serverBase, docId, token]);

  const send = useCallback((msg: LiveMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] 소켓이 아직 열리지 않음", msg);
      return false;
    }
    ws.send(JSON.stringify(msg));
    console.log("[WS] 보냄:", msg);
    return true;
  }, []);

  const notifyLocalPage = useCallback(
    (page: number) => {
      const next = clamp(page);
      const ok = send({ type: "PAGE_CHANGE", page: next });
      if (!ok)
        announce?.("서버 연결이 불안정하여 페이지 동기화에 실패했습니다.");
    },
    [send, clamp, announce]
  );

  useEffect(() => {
    if (!url) return;

    reconnectRef.current.closedByUser = false;

    const connect = () => {
      log("connecting to", maskUrl(url));
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectRef.current.tries = 0;
        log("connected", maskUrl(url));
        announce?.("실시간 연결이 활성화되었습니다.");

        // keepalive
        pingTimer.current = window.setInterval(() => {
          log("↻ ping");
          send({ type: "PING" });
        }, 25_000);
      };

      ws.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          log("← received raw", parsed);

          if (isLiveMessage(parsed)) {
            if (parsed.type === "PAGE_CHANGE") {
              const next = clamp(parsed.page);
              log("PAGE_CHANGE →", next);
              onRemotePageRef.current(next);
              announce?.(`상대방이 페이지 ${next}로 이동했습니다.`);
            }
          } else {
            log("ignored (not LiveMessage)");
          }
        } catch (e) {
          // JSON이 아니면 무시 (서버에서 텍스트/빈 메시지일 수 있음)
          warn("non-JSON message ignored", event.data);
          console.log(e);
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        if (pingTimer.current) {
          clearInterval(pingTimer.current);
          pingTimer.current = null;
        }
        if (reconnectRef.current.closedByUser) {
          log("closed by user", ev.code, ev.reason || "");
          return;
        }
        warn("closed", ev.code, ev.reason || "");
        const delay = Math.min(10_000, 500 * 2 ** reconnectRef.current.tries);
        reconnectRef.current.tries += 1;
        log(`reconnecting in ${delay}ms (try #${reconnectRef.current.tries})`);
        setTimeout(connect, delay);
      };

      ws.onerror = (ev: Event) => {
        error("socket error", ev);
        // 보통 onclose로 이어짐
      };
    };

    connect();

    return () => {
      reconnectRef.current.closedByUser = true;
      log("cleanup: closing socket");
      wsRef.current?.close();
      wsRef.current = null;
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
    };
  }, [url, clamp, announce, send, log, warn, error]);

  return { notifyLocalPage };
}

/** 안전한 메시지 판별 (타입가드) */
function isLiveMessage(data: unknown): data is LiveMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.type === "PING") return true;
  return d.type === "PAGE_CHANGE" && typeof d.page === "number";
}
