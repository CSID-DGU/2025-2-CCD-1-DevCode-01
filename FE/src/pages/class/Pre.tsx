import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  fetchPageSummary,
  fetchDocPage,
  type DocPage,
  type PageSummary,
} from "@apis/lecture/lecture.api";
import { formatOcr } from "@shared/formatOcr";
import {
  A11Y_STORAGE_KEYS,
  makeAnnouncer,
  readFontPct,
  readReadOnFocus,
} from "./pre/ally";

import { useFocusTTS } from "src/hooks/useFocusTTS";
import { Container, Grid, SrLive, Wrap } from "./pre/styles";
import DocPane from "src/components/lecture/pre/DocPane";
import BottomToolbar from "src/components/lecture/pre/BottomToolBar";
import { useLocalTTS } from "src/hooks/useLocalTTS";
import RightTabs from "src/components/lecture/live/RightTabs";

type RouteParams = { docId?: string; courseId?: string };
type NavState = { navTitle?: string; totalPage?: number };
type UserRole = "assistant" | "student";

function useDocId(params: RouteParams) {
  return useMemo(() => {
    const raw = params.docId ?? params.courseId;
    const n = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.docId, params.courseId]);
}

/** A11Y 관련 폰트/읽기 옵션 상태를 관리하는 훅 */
function useA11ySettings() {
  const [fontPct, setFontPct] = useState<number>(readFontPct());
  const [readOnFocus, setReadOnFocus] = useState<boolean>(readReadOnFocus());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === A11Y_STORAGE_KEYS.font) setFontPct(readFontPct());
      if (e.key === A11Y_STORAGE_KEYS.readOnFocus) {
        setReadOnFocus(readReadOnFocus());
      }
    };

    const onFontCustom = () => setFontPct(readFontPct());
    const onReadCustom = () => setReadOnFocus(readReadOnFocus());
    const onVisible = () => {
      if (!document.hidden) {
        setFontPct(readFontPct());
        setReadOnFocus(readReadOnFocus());
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("a11y:font-change", onFontCustom as EventListener);
    window.addEventListener(
      "a11y:read-on-focus-change",
      onReadCustom as EventListener
    );
    document.addEventListener("visibilitychange", onVisible);

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
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { fontPct, readOnFocus };
}

export default function PreClass() {
  const params = useParams<RouteParams>();
  const { state } = useLocation() as { state?: NavState };
  const navigate = useNavigate();

  const role: UserRole =
    (localStorage.getItem("role") as UserRole) || "student";
  const isAssistant = role === "assistant";

  const docIdNum = useDocId(params);

  const [page, setPage] = useState(1);
  const [docPage, setDocPage] = useState<DocPage | null>(null);
  const [totalPage, setTotalPage] = useState<number>();
  const [loading, setLoading] = useState(false);
  const { fontPct, readOnFocus } = useA11ySettings();
  const stackByFont = fontPct >= 175;

  const cleanOcr = useMemo(() => formatOcr(docPage?.ocr ?? ""), [docPage?.ocr]);

  const [mode, setMode] = useState<"ocr" | "image">(
    isAssistant ? "image" : "ocr"
  );

  const liveRef = useRef<HTMLDivElement | null>(null);
  const announce = useMemo(() => makeAnnouncer(liveRef), []);
  const mainRegionRef = useRef<HTMLDivElement | null>(null);
  const docBodyRef = useRef<HTMLDivElement | null>(null);
  const sidePaneRef = useRef<HTMLDivElement | null>(null);
  const ocrAudioRef = useRef<HTMLAudioElement | null>(null);
  const sumAudioRef = useRef<HTMLAudioElement | null>(null);

  const [summary, setSummary] = useState<PageSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);

  const { speak } = useLocalTTS();

  /** 교안 페이지 로드 + status 폴링 */
  useEffect(() => {
    if (!docIdNum) return;

    let cancelled = false;
    let retryTimeout: number | null = null;

    const POLL_INTERVAL = 2000;

    const loadDocPage = async (isRetry = false) => {
      try {
        if (!isRetry) {
          setLoading(true);
        }

        const dp = await fetchDocPage(docIdNum, page);
        if (cancelled) return;

        if (!dp) {
          setDocPage(null);
          setSummary(null);
          toast.error("교안 페이지를 불러오지 못했어요.");
          announce("교안 페이지를 불러오지 못했습니다.");
          setLoading(false);
          return;
        }

        setDocPage(dp);
        if (dp.totalPage != null) setTotalPage(dp.totalPage);

        if (dp.status === "processing") {
          if (!isRetry) {
            announce("현재 페이지를 처리하는 중입니다. 잠시만 기다려 주세요.");
          }

          retryTimeout = window.setTimeout(() => {
            void loadDocPage(true);
          }, POLL_INTERVAL);

          return;
        }

        setSummary(null);
        setSummaryLoading(false);
        setSummaryRequested(false);

        const nextDefault: "ocr" | "image" = isAssistant ? "image" : "ocr";
        setMode(nextDefault);

        const totalForAnnounce = dp.totalPage ?? totalPage;
        announce(
          `페이지 ${dp.pageNumber}${
            totalForAnnounce ? ` / 총 ${totalForAnnounce}` : ""
          }로 이동했습니다. ${
            nextDefault === "ocr"
              ? "본문 보기가 활성화되었습니다."
              : "원본 이미지 보기가 활성화되었습니다."
          }`
        );
        mainRegionRef.current?.focus();

        setLoading(false);
      } catch {
        if (!cancelled) {
          toast.error("데이터 로딩 중 오류가 발생했어요.");
          announce("데이터 로딩 중 오류가 발생했습니다.");
          setLoading(false);
        }
      }
    };

    void loadDocPage(false);

    return () => {
      cancelled = true;
      if (retryTimeout != null) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [docIdNum, page, isAssistant, announce, totalPage]);

  /* 요약 로드 */
  useEffect(() => {
    if (!docIdNum) return;
    if (!docPage?.pageId || docPage.pageId <= 0) return;
    if (!summaryRequested) return;

    let cancelled = false;

    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        setSummary(null);

        const s = await fetchPageSummary(docPage.pageId);
        if (!cancelled) {
          setSummary(s);
        }
      } catch {
        if (!cancelled) {
          toast.error("요약을 불러오지 못했어요.");
          announce("요약을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [docIdNum, docPage?.pageId, summaryRequested, announce]);

  /* 문서 제목 */
  useEffect(() => {
    const t = `${state?.navTitle ?? "수업 전"} - p.${page}`;
    document.title = `캠퍼스 메이트 | ${t}`;
  }, [state?.navTitle, page]);

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

  const canPrev = page > 1;
  const canNext = totalPage ? page < totalPage : true;

  const toggleMode = () => {
    setMode((m) => {
      const next = m === "ocr" ? "image" : "ocr";
      announce(
        next === "image"
          ? "원본 이미지 보기가 활성화되었습니다."
          : "본문 보기가 활성화되었습니다."
      );
      setTimeout(() => mainRegionRef.current?.focus(), 0);
      return next;
    });
  };

  // 강의 시작 → 라이브 페이지로 이동
  const onStartClass = () => {
    if (!docIdNum) {
      toast.error("문서가 없어 강의를 시작할 수 없어요.");
      announce("문서가 없어 강의를 시작할 수 없습니다.");
      return;
    }
    announce("강의가 시작되었습니다. 라이브 화면으로 이동합니다.");
    navigate(`/lecture/doc/${docIdNum}/live/`, {
      state: {
        docId: docIdNum,
        totalPage: totalPage ?? null,
        navTitle: state?.navTitle ?? "라이브",
        autoRecord: true,
      },
      replace: false,
    });
  };

  return (
    <Wrap aria-busy={loading}>
      <SrLive ref={liveRef} aria-live="polite" aria-atomic="true" />
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

          {docIdNum && (
            <RightTabs
              key={`pre-righttabs-${docIdNum}-${page}`}
              stack={stackByFont}
              activeInitial="memo"
              showBoard={false}
              role={role}
              memo={{
                docId: docIdNum,
                pageId: docPage?.pageId ?? null,
                pageNumber: docPage?.pageNumber ?? page,
              }}
              summary={{
                text: summary?.summary ?? "",
                ttsUrl: summary?.summary_tts ?? undefined,
                sumAudioRef,
                sidePaneRef,
                loading: summaryLoading,
              }}
              onSummaryOpen={() => setSummaryRequested(true)}
            />
          )}
        </Grid>
      </Container>

      <BottomToolbar
        canPrev={canPrev}
        canNext={canNext}
        page={page}
        totalPage={totalPage}
        mode={mode}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        onToggleMode={toggleMode}
        onStart={onStartClass}
        speak={speak}
        onGoTo={(n) => setPage(n)}
      />
    </Wrap>
  );
}
