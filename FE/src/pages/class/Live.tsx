import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { fetchDocPage, fetchPageSummary } from "@apis/lecture/lecture.api";
import { formatOcr } from "@shared/formatOcr";

import DocPane from "src/components/lecture/pre/DocPane";
import RightTabs from "src/components/lecture/live/RightTabs";
import BottomToolbar from "src/components/lecture/pre/BottomToolBar";

import { useFocusTTS } from "src/hooks/useFocusTTS";
import { useDocLiveSync } from "src/hooks/useDocLiveSync";
import {
  A11Y_STORAGE_KEYS,
  makeAnnouncer,
  readFontPct,
  readReadOnFocus,
} from "./pre/ally";
import { Container, Grid, SrLive, Wrap } from "./pre/styles";

type RouteParams = { courseId?: string; docId?: string };
type NavState = { navTitle?: string; totalPages?: number; docId?: number };

export default function LiveClass() {
  const params = useParams<RouteParams>();
  const { state } = useLocation() as { state?: NavState };

  const role = (localStorage.getItem("role") || "student") as
    | "assistant"
    | "student";

  const parsedParamId = Number(params.docId);
  const docId =
    state?.docId ?? (Number.isFinite(parsedParamId) ? parsedParamId : NaN);
  const totalPages = state?.totalPages ?? null;

  const [page, setPage] = useState<number>(1);
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

  // ------- refs -------
  const liveRef = useRef<HTMLDivElement | null>(null);
  const mainRegionRef = useRef<HTMLDivElement | null>(null);
  const docBodyRef = useRef<HTMLDivElement | null>(null);
  const sidePaneRef = useRef<HTMLDivElement | null>(null);
  const ocrAudioRef = useRef<HTMLAudioElement | null>(null);
  const sumAudioRef = useRef<HTMLAudioElement | null>(null);

  const announce = useMemo(() => makeAnnouncer(liveRef), []);
  const cleanOcr = useMemo(() => formatOcr(docPage?.ocr ?? ""), [docPage?.ocr]);

  // ------- 접근성 설정 변경 이벤트 -------
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

  // ------- 데이터 로딩 -------
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
          `페이지 ${dp.pageNumber}${totalPages ? ` / 총 ${totalPages}` : ""}, ${
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
  }, [docId, page, role, totalPages, announce]);

  // ------- 포커스-자동읽기 (TTS) -------
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

  // ------- 동기화 (웹소켓) -------
  const token = localStorage.getItem("access");
  const serverBase = import.meta.env.VITE_WS_BASE as string;

  const clampPage = (n: number) => {
    if (!totalPages) return Math.max(1, n);
    return Math.min(Math.max(1, n), totalPages);
  };

  const applyRemotePage = (p: number) => {
    setPage((cur) => (cur === p ? cur : p));
  };

  const { notifyLocalPage } = useDocLiveSync({
    serverBase,
    docId: Number(docId),
    token,
    onRemotePage: applyRemotePage,
    totalPages: totalPages ?? null,
    announce,
  });

  const goToPage = (n: number) => {
    const next = clampPage(n);
    if (next === page) return;
    setPage(next);
    notifyLocalPage(next);
    announce(`페이지 ${next}로 이동합니다.`);
  };

  // ------- 네비게이션/모드 -------
  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : true;

  const toggleMode = () =>
    setMode((prev) => {
      const next = prev === "ocr" ? "image" : "ocr";
      announce(next === "image" ? "원본 보기" : "본문 보기");
      setTimeout(() => mainRegionRef.current?.focus(), 0);
      return next;
    });

  // ------- 렌더링 -------
  return (
    <Wrap aria-busy={loading} aria-describedby="live-status">
      <SrLive
        id="live-status"
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
      />

      <Container>
        <Grid $stack={stackByFont}>
          <DocPane
            mode={mode}
            ocrText={cleanOcr}
            imageUrl={docPage?.image}
            ocrAudioRef={ocrAudioRef}
            docBodyRef={docBodyRef}
            mainRegionRef={mainRegionRef}
          />

          <RightTabs
            stack={stackByFont}
            activeInitial="memo"
            role={role}
            summary={{
              text: summary?.summary ?? "",
              ttsUrl: summary?.summary_tts ?? "",
              sumAudioRef,
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
              canUpload: role === "assistant",
            }}
          />
        </Grid>
      </Container>

      <BottomToolbar
        canPrev={canPrev}
        canNext={canNext}
        page={page}
        totalPages={totalPages ?? undefined}
        mode={mode}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
        onToggleMode={toggleMode}
        onPause={() => announce("일시 정지")}
        onBookmark={() => announce("현재 페이지 북마크됨")}
        onEnd={() => announce("강의 종료")}
        onGoTo={(n) => goToPage(n)}
      />
    </Wrap>
  );
}
