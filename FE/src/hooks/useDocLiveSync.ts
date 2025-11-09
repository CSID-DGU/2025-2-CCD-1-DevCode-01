import { useCallback, useEffect, useMemo, useRef } from "react";

export type LiveMessage =
  | { type: "PAGE_CHANGE"; page: number }
  | { type: "PING" };

export interface UseDocLiveSyncOptions {
  /** ex) ws://localhost:8000 또는 wss://api.campusmate.ai */
  serverBase: string;
  /** 문서 ID (필수) */
  docId: number;
  /** 액세스 토큰 (필수) */
  token: string | null | undefined;
  /** 원격에서 페이지 변경이 들어왔을 때 호출 */
  onRemotePage: (page: number) => void;
  /** 페이지 범위(선택): 1~totalPages로 클램프 */
  totalPages?: number | null;
  /** 스크린리더 알림(선택) */
  announce?: (msg: string) => void;
}

export function useDocLiveSync({
  serverBase,
  docId,
  token,
  onRemotePage,
  totalPages,
  announce,
}: UseDocLiveSyncOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef({ tries: 0, closedByUser: false });
  const pingTimer = useRef<number | null>(null);
  const onRemotePageRef = useRef(onRemotePage);

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
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  /** 로컬에서 페이지 바꿀 때 서버에도 통지 */
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
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectRef.current.tries = 0;
        announce?.("실시간 연결이 활성화되었습니다.");
        // keepalive
        pingTimer.current = window.setInterval(
          () => send({ type: "PING" }),
          25_000
        );
      };

      ws.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isLiveMessage(parsed)) {
            if (parsed.type === "PAGE_CHANGE") {
              const next = clamp(parsed.page);
              onRemotePageRef.current(next);
              announce?.(`상대방이 페이지 ${next}로 이동했습니다.`);
            }
          }
        } catch {
          // JSON이 아니면 무시
        }
      };

      ws.onclose = () => {
        if (pingTimer.current) {
          clearInterval(pingTimer.current);
          pingTimer.current = null;
        }
        if (reconnectRef.current.closedByUser) return;
        const delay = Math.min(10_000, 500 * 2 ** reconnectRef.current.tries);
        reconnectRef.current.tries += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // 보통 onclose로 이어짐
      };
    };

    connect();

    return () => {
      reconnectRef.current.closedByUser = true;
      wsRef.current?.close();
      wsRef.current = null;
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
    };
  }, [url, clamp, announce, send]);

  return { notifyLocalPage };
}

/** 안전한 메시지 판별 (타입가드) */
function isLiveMessage(data: unknown): data is LiveMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.type === "PING") return true;
  return d.type === "PAGE_CHANGE" && typeof d.page === "number";
}
