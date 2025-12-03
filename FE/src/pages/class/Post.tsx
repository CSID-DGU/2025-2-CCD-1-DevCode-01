import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
  fetchDocPage,
  fetchPageSummary,
  fetchPageTTS,
  type PageSummary,
  fetchSummaryTTS,
} from "@apis/lecture/lecture.api";

import { postPageReview, type PageReview } from "@apis/lecture/review.api";
import { fetchBoards, type BoardItem } from "@apis/lecture/board.api";
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
import { useLocalTTS } from "src/hooks/useLocalTTS";

import BottomToolbar from "src/components/lecture/pre/BottomToolBar";
import RightTabsPost from "src/components/lecture/post/RightTabPost";
import { useFocusTTS } from "src/hooks/useFocusTTS";
import { fetchDocSpeechSummaries } from "@apis/lecture/profTts.api";

type RouteParams = { courseId?: string; docId?: string };
type NavState = {
  navTitle?: string;
  docId?: number;
  resumeClock?: string | null;
};
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
    window.addEventListener("a11y-font-change", onFontCustom as EventListener);
    window.addEventListener(
      "a11y:read-on-focus-change",
      onReadCustom as EventListener
    );
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "a11y-font-change",
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

type BoardsPayload = {
  boards: {
    boardId: number;
    text: string;
  }[];
};

async function buildBoardsPayload(
  pageId: number,
  transformText: (raw: string) => Promise<string>
): Promise<BoardsPayload> {
  const res = await fetchBoards(pageId);
  const items: BoardItem[] = res?.boards ?? [];

  const boards = await Promise.all(
    items.map(async (b) => ({
      boardId: b.boardId,
      text: b.text ? await transformText(b.text) : "",
    }))
  );

  return { boards };
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

  const [summaryTts, setSummaryTts] = useState<{
    female?: string;
    male?: string;
  } | null>(null);

  const [summaryTtsLoading, setSummaryTtsLoading] = useState(false);

  const { fontPct, readOnFocus } = useA11ySettings();
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
  const memoAudioRef = useRef<HTMLAudioElement | null>(null);

  const cleanOcr = useMemo(() => formatOcr(docPage?.ocr ?? ""), [docPage?.ocr]);

  const { buildTtsText } = useTtsTextBuilder();
  const { soundRate, soundVoice } = useSoundOptions();
  const [pageTtsLoading, setPageTtsLoading] = useState(false);

  const { speak, stop } = useLocalTTS();

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

  /* 서버 오디오 정지 도우미 (본문/요약 공통) */
  const stopServerAudio = useCallback(() => {
    const ocr = ocrAudioRef.current;
    const sum = sumAudioRef.current;
    const memoEl = memoAudioRef.current;

    if (ocr) {
      try {
        ocr.pause();
        ocr.currentTime = 0;
      } catch {
        // ignore
      }
    }
    if (sum) {
      try {
        sum.pause();
        sum.currentTime = 0;
      } catch {
        // ignore
      }
    }
    if (memoEl) {
      try {
        memoEl.pause();
        memoEl.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, []);

  const stopAllTts = useCallback(() => {
    stopServerAudio();
    stop();
  }, [stopServerAudio, stop]);

  useEffect(() => {
    return () => {
      stopAllTts();
    };
  }, [stopAllTts]);

  const speakWithStop = useCallback(
    (text: string) => {
      stopServerAudio();
      stop();
      speak(text);
    },
    [stopServerAudio, stop, speak]
  );

  /* ---------------- 페이지 로드 + 요약/리뷰/요약TTS ---------------- */
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
          setSummaryTts(null);
          setReview(null);
          setSummaryLoading(false);
          toast.error("페이지 로드 실패");
          return;
        }

        setDocPage(dp);
        setTotalPage(dp.totalPage ?? null);

        setSummary(null);
        setSummaryTts(null);
        setSummaryLoading(false);
        setReview(null);

        if (dp.pageId) {
          setSummaryLoading(true);
          try {
            const sumPromise = (async () => {
              const s = await fetchPageSummary(dp.pageId);
              if (cancelled) return null;
              setSummary(s ?? null);

              if (s?.summary) {
                try {
                  const { female, male } = await fetchSummaryTTS(
                    dp.pageId,
                    s.summary
                  );
                  if (!cancelled) {
                    setSummaryTts({ female, male });
                  }
                } catch (err) {
                  console.error("[PostClass] 요약 TTS 생성 실패:", err);
                  if (!cancelled) {
                    setSummaryTts(null);
                    announce("요약 음성을 불러오지 못했습니다.");
                  }
                }
              }
              return s;
            })();

            const reviewPromise = (async (): Promise<PageReview | null> => {
              try {
                const boardsPayload = await buildBoardsPayload(
                  dp.pageId,
                  buildTtsText
                );

                const res = await postPageReview(dp.pageId, boardsPayload);
                return res ?? null;
              } catch (err) {
                console.error("[PostClass] postPageReview 실패:", err);
                return null;
              }
            })();

            const [, rev] = await Promise.all([sumPromise, reviewPromise]);
            if (!cancelled) {
              setReview(rev ?? null);
            }
          } finally {
            if (!cancelled) setSummaryLoading(false);
          }
        } else {
          setSummary(null);
          setSummaryTts(null);
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
      } catch (e) {
        if (!cancelled) {
          toast.error("데이터 로드 중 오류가 발생했습니다.");
          setDocPage(null);
          setSummary(null);
          setSummaryTts(null);
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

  type TtsPair = {
    female?: string | null;
    male?: string | null;
  } | null;

  const playReviewTts = useCallback(
    async (tts: TtsPair | null | undefined, fallbackText?: string) => {
      stop();
      stopServerAudio();

      const url =
        tts && (tts.female || tts.male)
          ? soundVoice === "여성"
            ? tts.female ?? tts.male ?? null
            : tts.male ?? tts.female ?? null
          : null;

      if (!url) {
        if (fallbackText) {
          speakWithStop(fallbackText);
        }
        return;
      }

      const audio = sumAudioRef.current;
      if (!audio) return;

      try {
        audio.pause();
      } catch {
        // ignore
      }

      audio.src = url;
      applyPlaybackRate(audio, soundRate);
      audio.currentTime = 0;

      try {
        const playPromise = audio.play();
        // 일부 브라우저는 play()가 Promise를 안 돌려주기도 해서 방어코드
        if (playPromise !== undefined) {
          await playPromise;
        }
      } catch (err) {
        if ((err as DOMException).name === "AbortError") {
          // 🔇 포커스 이동 등으로 인한 자연스러운 중단 → 조용히 무시
          console.warn(
            "[TTS] play aborted (probably due to quick focus change or pause)."
          );
          return;
        }
        throw err; // 다른 에러는 그대로 위로 던짐
      }
    },
    [stop, stopServerAudio, soundVoice, soundRate, speakWithStop]
  );

  const handleFocusReviewTts = useCallback(
    (opts: { tts?: TtsPair | null; fallbackText?: string }) => {
      if (!readOnFocus) return; // 설정 꺼져 있으면 아무것도 안 함
      void playReviewTts(opts.tts ?? null, opts.fallbackText);
    },
    [readOnFocus, playReviewTts]
  );

  const handlePlayMemoTts = useCallback(
    async ({ content, tts }: { content: string; tts?: TtsPair | null }) => {
      console.log("[PostClass] handlePlayMemoTts 호출", {
        contentLen: content?.length ?? 0,
        tts,
      });

      try {
        // 1) 로컬 TTS / 기존 서버 오디오 모두 정지
        stop(); // SpeechSynthesis
        stopServerAudio(); // ocr, sum, memo 오디오 전부 정지

        const url =
          tts && (tts.female || tts.male)
            ? soundVoice === "여성"
              ? tts.female ?? tts.male ?? null
              : tts.male ?? tts.female ?? null
            : null;

        console.log("[PostClass] handlePlayMemoTts URL 선택", {
          soundVoice,
          url,
        });

        if (!url) {
          console.log(
            "[PostClass] URL 없음 -> 로컬 TTS fallback (speakWithStop)"
          );
          speakWithStop(content);
          return;
        }

        const audio = memoAudioRef.current; // 🔹 sumAudioRef 대신 memoAudioRef 사용
        if (!audio) {
          console.warn("[PostClass] memoAudioRef.current가 없습니다.");
          return;
        }

        try {
          audio.pause();
        } catch {
          // ignore
        }

        audio.src = url;
        applyPlaybackRate(audio, soundRate);
        audio.currentTime = 0;

        console.log("[PostClass] memo audio.play() 호출 직전", {
          audioSrc: audio.src,
          playbackRate: audio.playbackRate,
        });

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }

        console.log("[PostClass] memo audio.play() 완료");
        announce("메모 음성을 재생합니다.");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          console.warn(
            "[PostClass] 메모 음성 재생 중단(AbortError) - 로컬 TTS로 대체"
          );
          // 필요하면 여기서도 speakWithStop(content) 호출 가능
          // speakWithStop(content);
          return;
        }

        console.error("[PostClass] 메모 음성 재생 실패:", e);
        toast.error("메모 음성 재생에 실패했습니다.");
        announce("메모 음성을 불러오지 못했습니다.");
      }
    },
    [stop, stopServerAudio, soundVoice, soundRate, speakWithStop, announce]
  );

  const handlePlaySummaryTts = useCallback(async () => {
    if (!docPage?.pageId) {
      toast.error("페이지 정보가 없어 요약 음성을 재생할 수 없습니다.");
      return;
    }
    if (!summary?.summary) {
      toast.error("요약 텍스트가 없습니다.");
      return;
    }
    if (!sumAudioRef.current) {
      console.warn("[PostClass] sumAudioRef.current가 없습니다.");
      return;
    }

    try {
      setSummaryTtsLoading(true);
      let female = summaryTts?.female;
      let male = summaryTts?.male;

      if (!female && !male) {
        const tts = await fetchSummaryTTS(docPage.pageId, summary.summary);
        female = tts.female;
        male = tts.male;
        setSummaryTts(tts);
      }

      const url =
        soundVoice === "여성" ? female || male || null : male || female || null;

      if (!url) {
        toast.error("생성된 요약 음성이 없습니다.");
        return;
      }

      const audio = sumAudioRef.current;
      if (!audio) return;

      if (audio.src !== url) {
        audio.src = url;
      }

      applyPlaybackRate(audio, soundRate);
      audio.currentTime = 0;

      await audio.play();
      announce("요약 음성을 재생합니다.");
    } catch (e) {
      console.error("[PostClass] 요약 TTS 재생 실패:", e);
      toast.error("요약 음성 재생에 실패했습니다.");
      announce("요약 음성을 불러오지 못했습니다.");
    } finally {
      setSummaryTtsLoading(false);
    }
  }, [
    docPage?.pageId,
    summary?.summary,
    summaryTts?.female,
    summaryTts?.male,
    soundVoice,
    soundRate,
    announce,
  ]);

  const summaryTtsUrl =
    summaryTts && (summaryTts.female || summaryTts.male)
      ? soundVoice === "여성"
        ? summaryTts.female ?? summaryTts.male ?? null
        : summaryTts.male ?? summaryTts.female ?? null
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
      return next;
    });

  const canPrev = page > 1;
  const canNext = totalPage ? page < totalPage : true;

  return (
    <Wrap aria-busy={loading} aria-describedby="live-status">
      <audio ref={ocrAudioRef} preload="none" />
      <audio ref={sumAudioRef} preload="none" />
      <audio ref={memoAudioRef} preload="none" />

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
            onSummaryTtsPlay={handlePlaySummaryTts}
            summaryTtsLoading={summaryTtsLoading}
            onPlayMemoTts={handlePlayMemoTts}
            readOnFocus={readOnFocus}
            onFocusReviewTts={handleFocusReviewTts}
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
              resumeClock: state?.resumeClock ?? null,
            },
          });
        }}
        onPostSummary={async () => {
          if (!docId) {
            toast.error("문서 정보가 없어 발화 요약을 확인할 수 없습니다.");
            return;
          }

          const res = await fetchDocSpeechSummaries(docId);

          if (!res) {
            toast.error("발화 요약 목록을 불러오지 못했습니다.");
            return;
          }

          navigate(`/lecture/doc/${docId}/post/summary`, {
            state: {
              docId,
              summaries: res.summaries,
              navTitle: state?.navTitle ?? "수업 후",
            },
          });
        }}
      />
    </Wrap>
  );
}
