import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useReducer } from "react";
import toast from "react-hot-toast";

import { fetchDocPage, fetchPageSummary } from "@apis/lecture/lecture.api";
import { formatOcr } from "@shared/formatOcr";

import DocPane from "src/components/lecture/pre/DocPane";
import RightTabs from "src/components/lecture/live/RightTabs";
import BottomToolbar from "src/components/lecture/pre/BottomToolBar";

import { useFocusTTS } from "src/hooks/useFocusTTS";
import { useDocLiveSync } from "src/hooks/useDocLiveSync";
import type { LiveRole } from "src/hooks/useDocLiveSync";
import {
  A11Y_STORAGE_KEYS,
  makeAnnouncer,
  readFontPct,
  readReadOnFocus,
} from "./pre/ally";
import {
  Container,
  Grid,
  SrLive,
  Wrap,
  DocPaneWrapper,
  SyncToggleInPane,
} from "./pre/styles";
import { postBookmarkClock, toHHMMSS } from "@apis/lecture/bookmark.api";
import { uploadSpeechQueued } from "@apis/lecture/speech.api";
import { useAudioRecorder } from "@shared/useAudioRecorder";

type RouteParams = { courseId?: string; docId?: string };
type NavState = {
  navTitle?: string;
  totalPage?: number;
  docId?: number;
  autoRecord?: boolean;
  startPage?: number;
  resumeClock?: string | null;
};

type RecPersist = {
  status: "idle" | "recording" | "paused";
  startedAt?: number;
  accumulated: number;
};

const recKey = (docId: number) => `rec:${docId}`;

const loadRec = (docId: number): RecPersist => {
  try {
    const raw = localStorage.getItem(recKey(docId));
    if (!raw) return { status: "idle", accumulated: 0 };
    const parsed = JSON.parse(raw) as RecPersist;
    return {
      status: parsed.status ?? "idle",
      startedAt:
        typeof parsed.startedAt === "number" ? parsed.startedAt : undefined,
      accumulated:
        typeof parsed.accumulated === "number" ? parsed.accumulated : 0,
    };
  } catch {
    return { status: "idle", accumulated: 0 };
  }
};

const saveRec = (docId: number, v: RecPersist) =>
  localStorage.setItem(recKey(docId), JSON.stringify(v));

const clearRec = (docId: number) => localStorage.removeItem(recKey(docId));

export default function LiveClass() {
  const params = useParams<RouteParams>();
  const { state } = useLocation() as { state?: NavState };

  console.log("[LiveClass] received resumeClock =", state?.resumeClock);

  const [totalPageNum, setTotalPageNum] = useState<number | null>(
    typeof state?.totalPage === "number" ? state!.totalPage : null
  );

  const navigate = useNavigate();

  const storedRole = localStorage.getItem("role") as LiveRole | null;
  const role: LiveRole = storedRole ?? "student";

  const parsedParamId = Number(params.docId);
  const docId =
    state?.docId ?? (Number.isFinite(parsedParamId) ? parsedParamId : NaN);
  const totalPage = state?.totalPage ?? null;

  const [page, setPage] = useState<number>(Number(state?.startPage) || 1);
  const lastRemotePageRef = useRef<number | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  const [docPage, setDocPage] = useState<Awaited<
    ReturnType<typeof fetchDocPage>
  > | null>(null);

  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof fetchPageSummary>
  > | null>(null);

  const [fontPct, setFontPct] = useState<number>(readFontPct());
  const [readOnFocus, setReadOnFocus] = useState<boolean>(readReadOnFocus());
  const stackByFont = fontPct >= 175;

  const [mode, setMode] = useState<"ocr" | "image">(
    role === "assistant" ? "image" : "ocr"
  );

  // 페이지 따라가기 토글 (장애학우 전용)
  const [followEnabled, setFollowEnabled] = useState<boolean>(true);

  // ------- refs -------
  const liveRef = useRef<HTMLDivElement | null>(null);
  const mainRegionRef = useRef<HTMLDivElement | null>(null);
  const docBodyRef = useRef<HTMLDivElement | null>(null);
  const sidePaneRef = useRef<HTMLDivElement | null>(null);
  const ocrAudioRef = useRef<HTMLAudioElement | null>(null);
  const sumAudioRef = useRef<HTMLAudioElement | null>(null);

  const pageRef = useRef<number>(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const announce = useMemo(() => makeAnnouncer(liveRef), []);
  const cleanOcr = useMemo(() => formatOcr(docPage?.ocr ?? ""), [docPage?.ocr]);

  /* ------------------ 접근성 설정 변경 이벤트 ------------------ */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === A11Y_STORAGE_KEYS.font) setFontPct(readFontPct());
      if (e.key === A11Y_STORAGE_KEYS.readOnFocus)
        setReadOnFocus(readReadOnFocus());
    };
    const onFontCustom = () => setFontPct(readFontPct());
    const onReadCustom = () => setReadOnFocus(readReadOnFocus());

    window.addEventListener("storage", onStorage);
    window.addEventListener("a11y:font-change", onFontCustom as EventListener);
    window.addEventListener(
      "a11y:read-on-focus-change",
      onReadCustom as EventListener
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "a11y:font-change",
        onFontCustom as EventListener
      );
      window.removeEventListener(
        "a11y:read-on-focus-change",
        onReadCustom as EventListener
      );
    };
  }, []);

  /* ------------------ 데이터 로딩 ------------------ */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const dp = await fetchDocPage(docId!, page);
        if (cancelled) return;

        if (!dp) {
          setDocPage(null);
          setSummary(null);
          toast.error("페이지 로드 실패");
          return;
        }

        setDocPage(dp);

        const tpFromApi =
          typeof dp.totalPage === "string"
            ? Number.parseInt(dp.totalPage, 10)
            : NaN;
        if (Number.isFinite(tpFromApi) && tpFromApi > 0) {
          setTotalPageNum(tpFromApi);
        }

        if (dp.pageId) {
          const sum = await fetchPageSummary(dp.pageId);
          if (!cancelled) setSummary(sum ?? null);
        } else {
          setSummary(null);
        }

        const nextDefaultMode: "ocr" | "image" =
          role === "assistant" ? "image" : "ocr";
        setMode(nextDefaultMode);

        announce(
          `페이지 ${dp.pageNumber}${totalPage ? ` / 총 ${totalPage}` : ""}, ${
            nextDefaultMode === "ocr" ? "본문" : "원본"
          } 보기`
        );

        setTimeout(() => mainRegionRef.current?.focus(), 0);
      } catch (err) {
        if (!cancelled) {
          toast.error("데이터 로드 중 오류가 발생했습니다.");
          setDocPage(null);
          setSummary(null);
          console.log(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docId, page, role, totalPage, announce, totalPageNum]);

  /* ------------------ 포커스-자동읽기 (TTS) ------------------ */
  useFocusTTS({
    enabled: readOnFocus,
    mode,
    page,
    docContainerRef: docBodyRef,
    sumContainerRef: sidePaneRef,
    ocrAudioRef,
    sumAudioRef,
    announce,
  });

  /* ------------------ 동기화 (웹소켓) ------------------ */
  const token = localStorage.getItem("access");
  const serverBase = import.meta.env.VITE_WS_BASE as string;

  const clampPage = (n: number) => {
    if (!totalPage) return Math.max(1, n);
    return Math.min(Math.max(1, n), totalPage);
  };

  const applyRemotePage = (p: number) => {
    const target = clampPage(p);
    lastRemotePageRef.current = target;

    setPage((cur) => {
      if (role !== "student") return cur;
      if (!followEnabled) return cur;

      return cur === target ? cur : target;
    });
  };

  const { notifyLocalPage, sendToggleSync } = useDocLiveSync({
    serverBase,
    docId: Number(docId),
    token,
    role,
    onRemotePage: applyRemotePage,
    currentPageRef: pageRef,
    totalPage: totalPageNum ?? null,
    announce,
  });

  useEffect(() => {
    const sp = Number(state?.startPage);
    if (!Number.isFinite(sp) || sp <= 0) return;

    const target = clampPage(sp);
    setPage(target);
    if (role === "assistant") {
      notifyLocalPage(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------ 장애학우: 따라가기 토글 핸들러 ------------------ */
  const handleToggleFollow = () => {
    if (role !== "student") return;

    setFollowEnabled((prev) => {
      const next = !prev;
      const ok = sendToggleSync(next);
      if (!ok) {
        toast.error("실시간 연결이 불안정합니다.");
        return prev;
      }

      if (next) {
        const target = lastRemotePageRef.current;
        if (typeof target === "number") {
          setPage((cur) => (cur === target ? cur : target));
          announce?.(`학습도우미가 보고 있는 페이지 ${target}로 이동합니다.`);
        } else {
          announce?.("학습도우미 페이지를 따라갑니다.");
        }
      } else {
        announce?.("페이지 따라가기를 끕니다.");
      }

      return next;
    });
  };

  /* ------------------ 녹음 훅 ------------------ */
  const { start, stop, pause, resume } = useAudioRecorder();

  /* ------------------ 자동 시작/상태 복원 ------------------ */
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(docId)) return;
    const dId = Number(docId);
    const persisted = loadRec(dId);

    const hasResumeClock = typeof state?.resumeClock === "string";
    const baseOffsetSec = parseHHMMSSToSec(state?.resumeClock ?? null);
    const initialAccumulated = hasResumeClock
      ? baseOffsetSec
      : persisted.accumulated ?? 0;

    const initialStatus: RecPersist["status"] = hasResumeClock
      ? "idle"
      : persisted.status;

    if (!startedRef.current) {
      if (state?.autoRecord || initialStatus === "recording") {
        start()
          .then(() => {
            const now = Date.now();
            saveRec(dId, {
              status: "recording",
              startedAt: now,
              accumulated: initialAccumulated,
            });
            announce("녹음을 시작했습니다.");
            toast.success("녹음 시작");
            rerender();
          })
          .catch(() => {
            toast.error("마이크 권한 또는 녹음 시작에 실패했어요.");
            announce("녹음을 시작하지 못했습니다. 설정을 확인해 주세요.");
          });
        startedRef.current = true;
      } else if (initialStatus === "paused") {
        saveRec(dId, {
          status: "paused",
          accumulated: initialAccumulated,
          startedAt: undefined,
        });
        rerender();
      } else {
        saveRec(dId, { status: "idle", accumulated: initialAccumulated });
        rerender();
      }
    }
  }, [docId, state?.autoRecord, state?.resumeClock, start, announce, rerender]);

  /* ------------------ 중지(토글) ------------------ */
  const handlePauseToggle = () => {
    if (!Number.isFinite(docId)) return;
    const dId = Number(docId);
    const p = loadRec(dId);

    if (p.status === "recording" && p.startedAt) {
      const now = Date.now();
      const acc = p.accumulated + Math.floor((now - p.startedAt) / 1000);
      try {
        pause();
        saveRec(dId, { status: "paused", accumulated: acc });
        announce("녹음 일시 정지");
        rerender();
      } catch {
        /* ignore */
      }
    } else if (p.status === "paused") {
      try {
        resume();
        saveRec(dId, {
          status: "recording",
          startedAt: Date.now(),
          accumulated: p.accumulated,
        });
        announce("녹음 재개");
        rerender();
      } catch {
        /* ignore */
      }
    } else if (p.status === "idle") {
      start()
        .then(() => {
          saveRec(dId, {
            status: "recording",
            startedAt: Date.now(),
            accumulated: 0,
          });
          announce("녹음을 시작했습니다.");
          toast.success("녹음 시작");
          rerender();
        })
        .catch(() => {
          toast.error("마이크 권한 또는 녹음 시작에 실패했어요.");
          announce("녹음을 시작하지 못했습니다.");
        });
    }
  };

  const pauseLabel = (() => {
    if (!Number.isFinite(docId)) return "중지";
    const p = loadRec(Number(docId));
    return p.status === "paused" ? "녹음 다시 시작" : "녹음 일시 정지";
  })();

  /* ------------------ 북마크: 논리시간 우선 ------------------ */

  // cut 순차 실행용 큐
  const cutTailRef = useRef<Promise<void>>(Promise.resolve());

  // 마지막 업로드 (pageId + timestamp) 기억해서 중복 방지
  const lastUploadRef = useRef<{ pageId: number; ts: string } | null>(null);

  const enqueueCut = (prevPageId: number | null) => {
    cutTailRef.current = cutTailRef.current.then(
      () => cutAndUploadCurrentPageAsync(prevPageId),
      () => cutAndUploadCurrentPageAsync(prevPageId)
    );
  };

  const parseHHMMSSToSec = (hhmmss?: string | null): number => {
    if (!hhmmss) return 0;
    const parts = hhmmss.split(":");
    if (parts.length !== 3) return 0;

    const [hStr, mStr, sStr] = parts;
    const h = Number.parseInt(hStr, 10);
    const m = Number.parseInt(mStr, 10);
    const s = Number.parseInt(sStr, 10);

    if ([h, m, s].some((n) => Number.isNaN(n) || n < 0)) return 0;

    return h * 3600 + m * 60 + s;
  };

  const getLogicalSeconds = (docId: number): number => {
    const p = loadRec(docId);
    if (p.status === "recording" && p.startedAt) {
      return p.accumulated + Math.floor((Date.now() - p.startedAt) / 1000);
    }
    return p.accumulated;
  };

  const getCurrentClock = (): string => {
    if (Number.isFinite(docId)) {
      const dId = Number(docId);
      const sec = getLogicalSeconds(dId);

      if (sec > 0) {
        return toHHMMSS(sec);
      }
    }

    const t1 = ocrAudioRef.current?.currentTime ?? 0;
    const t2 = sumAudioRef.current?.currentTime ?? 0;
    return toHHMMSS(Math.max(t1, t2));
  };

  const onBookmark = async () => {
    const pageId = docPage?.pageId;
    if (!pageId) {
      toast.error("이 페이지는 북마크를 저장할 수 없어요.");
      return;
    }
    const hhmmss = getCurrentClock();

    const ok = await postBookmarkClock(pageId, hhmmss);
    if (ok) {
      toast.success(`북마크 저장됨 (${hhmmss})`);
      announce(`현재 시각 ${hhmmss}에 북마크가 추가되었습니다.`);
    } else {
      toast.error("북마크 저장에 실패했어요. 네트워크를 확인해 주세요.");
      announce("북마크 저장에 실패했습니다.");
    }
  };

  /* ------------------ 페이지 전환 업로드: Blob + 끝시각만 ------------------ */

  const cutAndUploadCurrentPageAsync = async (prevPageId: number | null) => {
    if (!Number.isFinite(docId) || !prevPageId) return;
    const dId = Number(docId);

    const p = loadRec(dId);
    if (p.status !== "recording" || !p.startedAt) return;

    // 페이지를 떠나는 시점의 논리 시간
    const endSec = getLogicalSeconds(dId);
    const endHHMMSS = toHHMMSS(endSec);

    const blob: Blob = await stop();
    console.log("%c[Recorder.stop#cut]", "color:lightgreen;font-weight:bold", {
      type: blob?.type,
      size: blob?.size,
      endHHMMSS,
      prevPageId,
    });

    // 중복 업로드 방지
    const key = { pageId: prevPageId, ts: endHHMMSS };
    if (
      lastUploadRef.current &&
      lastUploadRef.current.pageId === key.pageId &&
      lastUploadRef.current.ts === key.ts
    ) {
      console.warn("[cut] duplicated upload skipped", key);
    } else {
      lastUploadRef.current = key;

      if (!blob) {
        console.warn("[cut] empty blob, skip upload", {
          prevPageId,
          endHHMMSS,
        });
      } else {
        uploadSpeechQueued(prevPageId, blob, endHHMMSS);
      }
    }

    console.log("[cut] prevPageId, endHHMMSS, recPersist =", {
      prevPageId,
      endHHMMSS,
      rec: loadRec(dId),
    });

    // 녹음 상태 갱신 및 재시작
    saveRec(dId, {
      status: "paused",
      accumulated: endSec,
      startedAt: undefined,
    });
    await start().catch((err) => {
      console.warn("[cut] restart recording failed:", err);
    });
    saveRec(dId, {
      status: "recording",
      accumulated: endSec,
      startedAt: Date.now(),
    });
  };

  // 강의 종료
  const onEndLecture = async () => {
    console.log("[onEndLecture] docId, docPage, pageId =", {
      docId,
      docPage,
      pageId: docPage?.pageId,
      recPersist: Number.isFinite(docId) ? loadRec(Number(docId)) : null,
    });

    try {
      if (!Number.isFinite(docId)) throw new Error("잘못된 문서 ID");
      const dId = Number(docId);
      const pageId = docPage?.pageId;
      if (!pageId) throw new Error("pageId 없음");

      const p = loadRec(dId);
      let blob: Blob | null = null;

      if (p.status === "recording" && p.startedAt) {
        await new Promise((r) => setTimeout(r, 120));
        blob = await stop();
      } else if (p.status === "paused") {
        await start().catch(() => {});
        saveRec(dId, {
          status: "recording",
          accumulated: p.accumulated,
          startedAt: Date.now(),
        });
        await new Promise((r) => setTimeout(r, 250));
        blob = await stop();
      }

      const endSec = getLogicalSeconds(dId);
      const endHHMMSS = toHHMMSS(endSec);

      if (blob && blob.size > 0) {
        uploadSpeechQueued(pageId, blob, endHHMMSS);
      } else {
        console.warn("[end] empty blob → skip upload");
      }

      if (!pageId) {
        console.warn(
          "[onEndLecture] pageId 없음 → 업로드 스킵하고 그냥 종료 이동"
        );
        clearRec(dId);
        navigate(`/lecture/doc/${docId}/post`, {
          replace: true,
          state: {
            docId: dId,
            totalPage,
            navTitle: state?.navTitle,
          },
        });
        return;
      }

      clearRec(dId);
      toast.success("강의를 종료합니다.");
      announce("강의 종료");
      navigate(`/lecture/doc/${docId}/post`, {
        replace: true,
        state: { docId: dId, totalPage, navTitle: state?.navTitle },
      });
    } catch (e) {
      console.error(e);
      toast.error("강의 종료 처리 중 오류가 발생했어요.");
      announce("강의 종료 처리 중 오류가 발생했습니다.");
    }
  };

  /* ------------------ 페이지 이동: 즉시 전환 + 비동기 업로드 ------------------ */
  const goToPage = (n: number) => {
    const next = clampPage(n);
    if (next === page) return;

    const prevPageId = docPage?.pageId ?? null;
    console.log("[goToPage]", { fromPage: page, toPage: next, prevPageId });
    enqueueCut(prevPageId);

    setPage(next);

    if (role === "assistant") {
      notifyLocalPage(next);
    } else if (role === "student" && followEnabled) {
      setFollowEnabled(false);
      sendToggleSync(false);
    }

    announce(`페이지 ${next}로 이동합니다.`);
  };

  /* ------------------ 렌더링 ------------------ */
  const canPrev = page > 1;
  const canNext = totalPage ? page < totalPage : true;

  const toggleMode = () =>
    setMode((prev) => {
      const next = prev === "ocr" ? "image" : "ocr";
      announce(next === "image" ? "원본 보기" : "본문 보기");
      setTimeout(() => mainRegionRef.current?.focus(), 0);
      return next;
    });

  return (
    <Wrap aria-busy={loading} aria-describedby="live-status">
      <SrLive
        id="live-status"
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
      />

      {/* ====== 플로팅 따라가기 토글 (장애학우 전용) ====== */}

      <Container>
        <Grid $stack={stackByFont}>
          <DocPaneWrapper>
            {role === "student" && (
              <SyncToggleInPane
                type="button"
                aria-pressed={followEnabled}
                aria-label={
                  followEnabled
                    ? "페이지 따라가기 켜짐. 버튼을 눌러 끌 수 있습니다."
                    : "페이지 따라가기 꺼짐. 버튼을 눌러 켤 수 있습니다."
                }
                onClick={handleToggleFollow}
                onFocus={() => {
                  announce(
                    followEnabled
                      ? "페이지 따라가기 버튼입니다. 현재 켜져 있습니다."
                      : "페이지 따라가기 버튼입니다. 현재 꺼져 있습니다."
                  );
                }}
              >
                {followEnabled ? "따라가기 ON" : "따라가기 OFF"}
              </SyncToggleInPane>
            )}

            <DocPane
              mode={mode}
              ocrText={cleanOcr}
              imageUrl={docPage?.image}
              docBodyRef={docBodyRef}
              mainRegionRef={mainRegionRef}
            />
          </DocPaneWrapper>
          <RightTabs
            stack={stackByFont}
            activeInitial="memo"
            role={role}
            summary={{
              text: summary?.summary ?? "",
              sidePaneRef,
            }}
            memo={{
              docId: Number.isFinite(docId) ? (docId as number) : 0,
              pageId: docPage?.pageId ?? null,
              pageNumber: page,
            }}
            board={{
              docId: Number.isFinite(docId) ? (docId as number) : 0,
              page,
              pageId: docPage?.pageId ?? null,
            }}
          />
        </Grid>
      </Container>

      <BottomToolbar
        canPrev={canPrev}
        canNext={canNext}
        page={page}
        totalPage={totalPage ?? undefined}
        mode={mode}
        onPrev={() => void goToPage(page - 1)}
        onNext={() => void goToPage(page + 1)}
        onToggleMode={toggleMode}
        onPause={handlePauseToggle}
        onBookmark={onBookmark}
        onEnd={onEndLecture}
        onGoTo={(n) => void goToPage(n)}
        pauseLabel={pauseLabel}
      />
    </Wrap>
  );
}
