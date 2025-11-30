import { useCallback, useEffect, useMemo, useRef } from "react";

export type LiveRole = "assistant" | "student";

export type BoardEventType = "created" | "updated" | "deleted";

export interface BoardEventDataBase {
  boardId: number;
}
export interface BoardEventCreatedOrUpdated extends BoardEventDataBase {
  image: string | null;
  text: string | null;
}
export type BoardEventData = BoardEventCreatedOrUpdated | BoardEventDataBase;

export type LiveMessage =
  | { type: "PAGE_CHANGE"; page: number }
  | { type: "PING" }
  | { type: "BOARD_EVENT"; event: BoardEventType; data: BoardEventData }
  | { type: "TOGGLE_SYNC"; enabled: boolean }
  | { type: "FORCE_MOVE_REQUEST" };

export interface UseDocLiveSyncOptions {
  serverBase: string;
  docId: number;
  token: string | null | undefined;

  role?: LiveRole;

  onRemotePage?: (page: number) => void;

  onBoardCreated?: (data: BoardEventCreatedOrUpdated) => void;
  onBoardUpdated?: (data: BoardEventCreatedOrUpdated) => void;
  onBoardDeleted?: (data: BoardEventDataBase) => void;
  currentPageRef?: React.RefObject<number>;

  totalPage?: number | null;
  announce?: (msg: string) => void;
  debug?: boolean;
}

export function useDocLiveSync({
  serverBase,
  docId,
  token,
  role,
  onRemotePage,
  onBoardCreated,
  onBoardUpdated,
  onBoardDeleted,
  currentPageRef,
  totalPage,
  announce,
  debug = import.meta.env?.DEV ?? false,
}: UseDocLiveSyncOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef({ tries: 0, closedByUser: false });
  const pingTimer = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const onRemotePageRef = useRef(onRemotePage);
  const onBoardCreatedRef = useRef(onBoardCreated);
  const onBoardUpdatedRef = useRef(onBoardUpdated);
  const onBoardDeletedRef = useRef(onBoardDeleted);
  const announceRef = useRef(announce);

  useEffect(() => {
    onRemotePageRef.current = onRemotePage;
  }, [onRemotePage]);
  useEffect(() => {
    onBoardCreatedRef.current = onBoardCreated;
  }, [onBoardCreated]);
  useEffect(() => {
    onBoardUpdatedRef.current = onBoardUpdated;
  }, [onBoardUpdated]);
  useEffect(() => {
    onBoardDeletedRef.current = onBoardDeleted;
  }, [onBoardDeleted]);
  useEffect(() => {
    announceRef.current = announce;
  }, [announce]);

  const log = useCallback(
    (...args: unknown[]) => debug && console.log("[WS]", ...args),
    [debug]
  );
  const warn = useCallback(
    (...args: unknown[]) => debug && console.warn("[WS]", ...args),
    [debug]
  );
  const error = useCallback(
    (...args: unknown[]) => debug && console.error("[WS]", ...args),
    [debug]
  );

  const maskUrl = (u: string) => u.replace(/([?&]token=)[^&]+/i, "$1***");

  const clamp = useCallback(
    (n: number) => {
      const min = 1;
      if (!totalPage) return Math.max(min, n);
      return Math.min(Math.max(min, n), totalPage);
    },
    [totalPage]
  );

  const url = useMemo(() => {
    if (!serverBase || !docId || !token) return null;

    let base = serverBase.replace(/\/+$/, "");
    base = base.replace(/^http(s?):/, "ws$1:");

    return `${base}/ws/doc/${encodeURIComponent(
      String(docId)
    )}/?token=${encodeURIComponent(token)}`;
  }, [serverBase, docId, token]);

  const parseMessage = (msg: string): LiveMessage | null => {
    try {
      const parsed = JSON.parse(msg);
      if (isLiveMessage(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const send = useCallback(
    (msg: LiveMessage): boolean => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(msg));
      log("보냄:", msg);
      return true;
    },
    [log]
  );

  const sendBoardEvent = useCallback(
    (event: BoardEventType, data: BoardEventData) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn(
          "⚠️ [WS] 아직 연결되지 않아 BOARD_EVENT를 전송하지 못했습니다.",
          { event, data }
        );
        return;
      }
      const msg: LiveMessage = { type: "BOARD_EVENT", event, data };
      ws.send(JSON.stringify(msg));
      if (event === "created") console.log("🟢 [SEND BOARD_CREATED]", data);
      if (event === "updated") console.log("🟡 [SEND BOARD_UPDATED]", data);
      if (event === "deleted") console.log("🔴 [SEND BOARD_DELETED]", data);
    },
    []
  );

  const notifyLocalPage = useCallback(
    (page: number) => {
      const ok = send({ type: "PAGE_CHANGE", page: clamp(page) });
      if (!ok) {
        announceRef.current?.(
          "서버 연결이 불안정하여 페이지 동기화에 실패했습니다."
        );
      }
      return ok;
    },
    [send, clamp]
  );

  const sendToggleSync = useCallback(
    (enabled: boolean): boolean => {
      const ok = send({ type: "TOGGLE_SYNC", enabled });
      if (!ok) {
        announceRef.current?.(
          "실시간 연결이 불안정하여 페이지 따라가기 설정을 전송하지 못했습니다."
        );
      }
      return ok;
    },
    [send]
  );

  useEffect(() => {
    if (!url) return;

    reconnectRef.current.closedByUser = false;

    const connect = () => {
      if (reconnectRef.current.closedByUser) return;

      log("connecting to", maskUrl(url));
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectRef.current.tries = 0;
        log("connected", maskUrl(url));
        announceRef.current?.("실시간 연결이 활성화되었습니다.");

        if (pingTimer.current) {
          clearInterval(pingTimer.current);
        }
        pingTimer.current = window.setInterval(() => {
          send({ type: "PING" });
        }, 25_000);
      };

      ws.onmessage = (event) => {
        const parsed = parseMessage(event.data);
        if (!parsed) return;

        if (parsed.type === "PAGE_CHANGE" && onRemotePageRef.current) {
          const next = clamp(parsed.page);
          onRemotePageRef.current(next);
          announceRef.current?.(`상대방이 페이지 ${next}로 이동했습니다.`);
          return;
        }

        if (parsed.type === "BOARD_EVENT") {
          switch (parsed.event) {
            case "created":
              console.log("🟢 [BOARD_CREATED]", parsed.data);
              onBoardCreatedRef.current?.(
                parsed.data as BoardEventCreatedOrUpdated
              );
              break;
            case "updated":
              console.log("🟡 [BOARD_UPDATED]", parsed.data);
              onBoardUpdatedRef.current?.(
                parsed.data as BoardEventCreatedOrUpdated
              );
              break;
            case "deleted":
              console.log("🔴 [BOARD_DELETED]", parsed.data);
              onBoardDeletedRef.current?.(parsed.data as BoardEventDataBase);
              break;
          }
          return;
        }

        if (parsed.type === "FORCE_MOVE_REQUEST") {
          if (role === "assistant" && currentPageRef?.current != null) {
            const page = clamp(currentPageRef.current);
            send({ type: "PAGE_CHANGE", page });
          }
          return;
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        if (pingTimer.current) {
          clearInterval(pingTimer.current);
          pingTimer.current = null;
        }

        if (reconnectRef.current.closedByUser) return;

        if (ev.code === 1000) {
          log("closed normally (1000) – no reconnect");
          return;
        }

        const delay = Math.min(10_000, 500 * 2 ** reconnectRef.current.tries);
        reconnectRef.current.tries += 1;
        warn(`closed (${ev.code}) reconnecting in ${delay}ms`);

        if (reconnectTimeoutRef.current !== null) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = (ev: Event) => {
        error("socket error", ev);
      };
    };

    connect();

    return () => {
      reconnectRef.current.closedByUser = true;

      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }

      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [url, log, warn, error, clamp, send, role, currentPageRef]);

  return { send, sendBoardEvent, notifyLocalPage, sendToggleSync };
}

function isLiveMessage(data: unknown): data is LiveMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  if (d.type === "PING") return true;
  if (d.type === "PAGE_CHANGE" && typeof d.page === "number") return true;

  if (
    d.type === "BOARD_EVENT" &&
    typeof d.event === "string" &&
    d.data &&
    typeof d.data === "object"
  ) {
    return true;
  }

  if (d.type === "TOGGLE_SYNC" && typeof d.enabled === "boolean") return true;
  if (d.type === "FORCE_MOVE_REQUEST") return true;

  return false;
}
