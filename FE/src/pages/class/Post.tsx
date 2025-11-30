import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { fetchDocPage, fetchPageSummary } from "@apis/lecture/lecture.api";
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
import { useFocusTTS } from "src/hooks/useFocusTTS";
import BottomToolbar from "src/components/lecture/pre/BottomToolBar";
import RightTabsPost from "src/components/lecture/post/RightTabPost";

type RouteParams = { courseId?: string; docId?: string };
type NavState = { navTitle?: string; totalPage?: number; docId?: number };

function useDocIdFromParamsAndState(params: RouteParams, state?: NavState) {
  return useMemo(() => {
    // 1순위: location state에 docId가 있으면 그거
    if (typeof state?.docId === "number" && Number.isFinite(state.docId)) {
      return state.docId;
    }

    // 2순위: URL 파라미터 (docId > courseId)
    const raw = params.docId ?? params.courseId;
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.docId, params.courseId, state?.docId]);
}

export default function PostClass() {
  const params = useParams<RouteParams>();
  const { state } = useLocation() as { state?: NavState };

  const role = (localStorage.getItem("role") || "student") as
    | "assistant"
    | "student";

  const docId = useDocIdFromParamsAndState(params, state);
  const totalPage = state?.totalPage ?? null;

  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const [docPage, setDocPage] = useState<Awaited<
    ReturnType<typeof fetchDocPage>
  > | null>(null);
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof fetchPageSummary>
  > | null>(null);
  const [review, setReview] = useState<PageReview | null>(null);

  const [fontPct, setFontPct] = useState<number>(readFontPct());
  const [readOnFocus, setReadOnFocus] = useState<boolean>(readReadOnFocus());
  const stackByFont = fontPct >= 175;
  const [mode, setMode] = useState<"ocr" | "image">(
    role === "assistant" ? "image" : "ocr"
  );
  const navigate = useNavigate();

  const liveRef = useRef<HTMLDivElement | null>(null);
  const mainRegionRef = useRef<HTMLDivElement | null>(null);
  const docBodyRef = useRef<HTMLDivElement | null>(null);
  const sidePaneRef = useRef<HTMLDivElement | null>(null);
  const ocrAudioRef = useRef<HTMLAudioElement | null>(null);
  const sumAudioRef = useRef<HTMLAudioElement | null>(null);
  const announce = useMemo(() => makeAnnouncer(liveRef), []);

  const cleanOcr = useMemo(() => formatOcr(docPage?.ocr ?? ""), [docPage?.ocr]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === A11Y_STORAGE_KEYS.font) setFontPct(readFontPct());
      if (e.key === A11Y_STORAGE_KEYS.readOnFocus)
        setReadOnFocus(readReadOnFocus());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
          setReview(null);
          toast.error("페이지 로드 실패");
          return;
        }

        setDocPage(dp);

        if (dp.pageId) {
          const [sum, rev] = await Promise.all([
            fetchPageSummary(dp.pageId),
            fetchPageReview(dp.pageId),
          ]);
          if (!cancelled) {
            setSummary(sum ?? null);
            setReview(rev ?? null);
          }
        } else {
          setSummary(null);
          setReview(null);
        }

        const nextDefault: "ocr" | "image" =
          role === "assistant" ? "image" : "ocr";
        setMode(nextDefault);

        announce(
          `페이지 ${dp.pageNumber}${totalPage ? ` / 총 ${totalPage}` : ""}, ${
            nextDefault === "ocr" ? "본문" : "원본"
          } 보기`
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
  }, [docId, page, role, totalPage, announce]);

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

  // 페이지 이동/토글
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
            // ocrAudioRef={ocrAudioRef}
            docBodyRef={docBodyRef}
            mainRegionRef={mainRegionRef}
          />

          <RightTabsPost
            stack={stackByFont}
            role={role}
            review={review}
            summary={{
              text: summary?.summary ?? "",
              // ttsUrl: summary?.summary_tts ?? "",
              sumAudioRef,
              sidePaneRef,
            }}
            memo={{
              docId: Number(docId) || 0,
              pageId: docPage?.pageId ?? null,
            }}
            board={{
              docId: Number(docId) || 0,
              page: page,
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
