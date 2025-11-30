import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
  fetchDocPage,
  fetchPageSummary,
  fetchPageTTS,
  type PageSummary,
} from "@apis/lecture/lecture.api";
import { fetchPageReview, type PageReview } from "@apis/lecture/review.api";
import { formatOcr } from "@shared/formatOcr";

import DocPane from "src/components/lecture/pre/DocPane";
import {
  A11Y_STORAGE_KEYS,
  makeAnnouncer,
  readFontPct,
  readReadOnFocus,
} from "./pre/ally";
import { Container, Grid, SrLive, Wrap } from "./pre/styles";

import { useTtsTextBuilder } from "src/hooks/useTtsTextBuilder";
import { useOcrTtsAutoStop } from "src/hooks/useOcrTtsAutoStop";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";

import BottomToolbar from "src/components/lecture/pre/BottomToolBar";
import RightTabsPost from "src/components/lecture/post/RightTabPost";

type RouteParams = { courseId?: string; docId?: string };
type NavState = { navTitle?: string; docId?: number };
type UserRole = "assistant" | "student";

function useDocIdFromParamsAndState(params: RouteParams, state?: NavState) {
  return useMemo(() => {
    if (typeof state?.docId === "number" && Number.isFinite(state.docId)) {
      return state.docId;
    }

    const raw = params.docId ?? params.courseId;
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.docId, params.courseId, state?.docId]);
}

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

export default function PostClass() {
  const params = useParams<RouteParams>();
  const { state } = useLocation() as { state?: NavState };
  const navigate = useNavigate();

  const role: UserRole =
    ((localStorage.getItem("role") as UserRole) || "student") ?? "student";
  const isAssistant = role === "assistant";

  const docId = useDocIdFromParamsAndState(params, state);

  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const [docPage, setDocPage] = useState<Awaited<
    ReturnType<typeof fetchDocPage>
  > | null>(null);

  const [totalPage, setTotalPage] = useState<number | null>(null);

  const [summary, setSummary] = useState<PageSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [review, setReview] = useState<PageReview | null>(null);

  const { fontPct } = useA11ySettings();
  const stackByFont = fontPct >= 175;

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

  const cleanOcr = useMemo(() => formatOcr(docPage?.ocr ?? ""), [docPage?.ocr]);

  const { buildTtsText } = useTtsTextBuilder();
  const { soundRate, soundVoice } = useSoundOptions();
  const [pageTtsLoading, setPageTtsLoading] = useState(false);

  useEffect(() => {
    if (!docId) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const dp = await fetchDocPage(docId, page);
        if (cancelled) return;

        if (!dp) {
          setDocPage(null);
          setSummary(null);
          setReview(null);
          toast.error("페이지 로드 실패");
          return;
        }

        setDocPage(dp);
        setTotalPage(dp.totalPage ?? null);

        if (dp.pageId) {
          setSummaryLoading(true);
          try {
            // 1) 요약은 기존처럼 한 번만
            const sumPromise = fetchPageSummary(dp.pageId);

            // 2) 리뷰는 폴링
            const reviewPromise = (async (): Promise<PageReview | null> => {
              const MAX_ATTEMPTS = 20; // 3s × 20 = 최대 60초
              let attempt = 0;

              while (!cancelled && attempt < MAX_ATTEMPTS) {
                const res = await fetchPageReview(dp.pageId);
                if (!res) return null;

                const hasData =
                  !!res.note ||
                  (res.speeches && res.speeches.length > 0) ||
                  (res.bookmarks && res.bookmarks.length > 0) ||
                  (res.boards && res.boards.length > 0);

                const isDone = res.status === "done" || hasData; // status 없으면 데이터 존재 여부로 done 판단

                if (isDone) {
                  return res;
                }

                // 아직 처리 중인 경우
                await new Promise((r) => setTimeout(r, 3000));
                attempt += 1;
              }

              console.warn("[PageReview] polling timeout or cancelled");
              return null;
            })();

            const [sum, rev] = await Promise.all([sumPromise, reviewPromise]);
            if (!cancelled) {
              setSummary(sum ?? null);
              setReview(rev ?? null);
            }
          } finally {
            if (!cancelled) setSummaryLoading(false);
          }
        } else {
          setSummary(null);
          setReview(null);
          setSummaryLoading(false);
        }

        const nextDefault: "ocr" | "image" = isAssistant ? "image" : "ocr";
        setMode(nextDefault);

        announce(
          `페이지 ${dp.pageNumber}${
            dp.totalPage ? ` / 총 ${dp.totalPage}` : ""
          }, ${nextDefault === "ocr" ? "본문" : "원본"} 보기`
        );
        setTimeout(() => mainRegionRef.current?.focus(), 0);
      } catch (e) {
        if (!cancelled) {
          toast.error("데이터 로드 중 오류가 발생했습니다.");
          setDocPage(null);
          setSummary(null);
          setReview(null);
          console.log(e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docId, page, isAssistant, announce]);

  useOcrTtsAutoStop(ocrAudioRef, {
    pageKey: docPage?.pageId,
    mode,
    areaRef: docBodyRef as React.RefObject<HTMLElement | null>,
    announce,
    stopMessageOnBlur: "본문 음성 재생이 중지되었습니다.",
    stopMessageOnChange: "페이지 또는 보기 모드 변경으로 음성을 중지합니다.",
  });

  useOcrTtsAutoStop(sumAudioRef, {
    pageKey: docPage?.pageId,
    mode,
    areaRef: sidePaneRef as React.RefObject<HTMLElement | null>,
    announce,
    stopMessageOnBlur: "요약 음성 재생이 중지되었습니다.",
    stopMessageOnChange:
      "페이지 또는 보기 모드 변경으로 요약 음성을 중지합니다.",
  });

  useEffect(() => {
    const baseTitle = state?.navTitle ?? "수업 후";
    const pageLabel = docPage?.pageNumber ?? page;
    const t = `${baseTitle} - 수업 후 p.${pageLabel}`;
    document.title = `캠퍼스 메이트 | ${t}`;
  }, [state?.navTitle, docPage?.pageNumber, page]);

  /* 페이지 OCR → SRE → TTS 생성  */
  const handlePlayOcrTts = useCallback(async () => {
    if (!docPage?.pageId || !docPage.ocr) {
      toast.error("텍스트가 없어 음성을 생성할 수 없습니다.");
      return;
    }

    try {
      setPageTtsLoading(true);

      const finalText = await buildTtsText(docPage.ocr);
      const { female, male } = await fetchPageTTS(docPage.pageId, finalText);

      const url = soundVoice === "여성" ? female : male;

      if (!url) {
        toast.error("생성된 음성이 없습니다.");
        return;
      }

      if (ocrAudioRef.current) {
        ocrAudioRef.current.src = url;
        applyPlaybackRate(ocrAudioRef.current, soundRate);
        ocrAudioRef.current.currentTime = 0;
        await ocrAudioRef.current.play();
      }

      announce("본문 음성을 재생합니다.");
    } catch (e) {
      console.error(e);
      toast.error("음성 생성에 실패했습니다.");
      announce("음성을 불러오지 못했습니다.");
    } finally {
      setPageTtsLoading(false);
    }
  }, [
    docPage?.pageId,
    docPage?.ocr,
    soundVoice,
    soundRate,
    buildTtsText,
    announce,
  ]);

  const summaryTtsUrl =
    summary?.summary_tts && typeof summary.summary_tts === "object"
      ? soundVoice === "여성"
        ? summary.summary_tts.female ?? null
        : summary.summary_tts.male ?? null
      : typeof summary?.summary_tts === "string"
      ? summary.summary_tts
      : null;

  const clampPage = (n: number) =>
    !totalPage ? Math.max(1, n) : Math.min(Math.max(1, n), totalPage);

  const goToPage = (n: number) => {
    const next = clampPage(n);
    if (next === page) return;
    setPage(next);
    announce(`페이지 ${next}로 이동합니다.`);
  };

  const toggleMode = () =>
    setMode((prev) => {
      const next = prev === "ocr" ? "image" : "ocr";
      announce(next === "image" ? "원본 보기" : "본문 보기");
      setTimeout(() => mainRegionRef.current?.focus(), 0);
      return next;
    });

  const canPrev = page > 1;
  const canNext = totalPage ? page < totalPage : true;

  return (
    <Wrap aria-busy={loading} aria-describedby="live-status">
      <audio ref={ocrAudioRef} preload="none" />
      <audio ref={sumAudioRef} preload="none" />

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
            imageUrl={docPage?.image ?? ""}
            docBodyRef={docBodyRef}
            mainRegionRef={mainRegionRef}
            onPlayOcrTts={handlePlayOcrTts}
            ocrTtsLoading={pageTtsLoading}
          />

          <RightTabsPost
            stack={stackByFont}
            role={role}
            review={review}
            summary={{
              text: summary?.summary ?? "",
              ttsUrl: summaryTtsUrl ?? undefined,
              sumAudioRef,
              sidePaneRef,
              loading: summaryLoading,
            }}
            memo={{
              docId: docId ?? 0,
              pageId: docPage?.pageId ?? null,
            }}
            board={{
              docId: docId ?? 0,
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
        onGoTo={(n) => void goToPage(n)}
        startPageId={docPage?.pageId ?? null}
        onStartLive={(pageId) => {
          if (!docId) {
            toast.error("문서 정보가 없어 라이브를 시작할 수 없어요.");
            return;
          }
          navigate(`/lecture/doc/${docId}/live`, {
            state: {
              docId,
              totalPage,
              startPage: page,
              pageId,
              autoRecord: true,
            },
          });
        }}
      />
    </Wrap>
  );
}
