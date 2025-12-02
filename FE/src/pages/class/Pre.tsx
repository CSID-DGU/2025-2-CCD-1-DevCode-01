import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  fetchPageSummary,
  fetchDocPage,
  type DocPage,
  type PageSummary,
  fetchPageTTS,
  fetchSummaryTTS,
} from "@apis/lecture/lecture.api";

import { formatOcr } from "@shared/formatOcr";

import {
  A11Y_STORAGE_KEYS,
  makeAnnouncer,
  readFontPct,
  readReadOnFocus,
} from "./pre/ally";

import { useFocusTTS } from "src/hooks/useFocusTTS";
import { useLocalTTS } from "src/hooks/useLocalTTS";

import { Container, Grid, SrLive, Wrap } from "./pre/styles";
import DocPane from "src/components/lecture/pre/DocPane";
import RightTabs from "src/components/lecture/live/RightTabs";
import BottomToolbar from "src/components/lecture/pre/BottomToolBar";
import { useTtsTextBuilder } from "src/hooks/useTtsTextBuilder";
import { useOcrTtsAutoStop } from "src/hooks/useOcrTtsAutoStop";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";

type RouteParams = { docId?: string; courseId?: string };
type NavState = {
  navTitle?: string;
  totalPage?: number;
  resumeClock?: string | null;
};
type UserRole = "assistant" | "student";

function useDocId(params: RouteParams) {
  return useMemo(() => {
    const raw = params.docId ?? params.courseId;
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.docId, params.courseId]);
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

  /* refs */
  const liveRef = useRef<HTMLDivElement | null>(null);
  const announce = useMemo(() => makeAnnouncer(liveRef), []);
  const mainRegionRef = useRef<HTMLDivElement | null>(null);
  const docBodyRef = useRef<HTMLDivElement | null>(null);
  const sidePaneRef = useRef<HTMLDivElement | null>(null);

  /** OCR TTS AUDIO REF */
  const ocrAudioRef = useRef<HTMLAudioElement | null>(null);

  /** SUMMARY TTS AUDIO REF */
  const sumAudioRef = useRef<HTMLAudioElement | null>(null);

  /* summary */
  const [summary, setSummary] = useState<PageSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);

  const [summaryTts, setSummaryTts] = useState<{
    female?: string;
    male?: string;
  } | null>(null);

  /* local TTS */
  const { speak, stop } = useLocalTTS();

  /* page TTS */
  const [pageTtsLoading, setPageTtsLoading] = useState(false);

  /* SRE 텍스트 빌더 */
  const { buildTtsText } = useTtsTextBuilder();

  const { soundRate, soundVoice } = useSoundOptions();

  /* ---------- 공통: 서버 오디오 정지 도우미 ---------- */
  const stopServerAudio = useCallback(() => {
    const ocr = ocrAudioRef.current;
    const sum = sumAudioRef.current;

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
  }, []);

  /* ---------- 공통: 로컬 TTS + 서버 오디오 정리 래퍼 ---------- */
  const speakWithStop = useCallback(
    (text: string) => {
      stopServerAudio();
      stop();
      speak(text);
    },
    [speak, stop, stopServerAudio]
  );

  useEffect(() => {
    if (!docIdNum) return;

    let cancelled = false;
    let retryTimer: number | null = null;

    const load = async () => {
      try {
        setLoading(true);

        const dp = await fetchDocPage(docIdNum, page);
        if (cancelled) return;

        if (!dp) {
          toast.error("페이지를 불러오지 못했습니다.");
          announce("페이지를 불러오지 못했습니다.");
          return;
        }

        setDocPage(dp);

        if (dp.totalPage) setTotalPage(dp.totalPage);

        if (dp.status === "processing") {
          announce("페이지를 처리하는 중입니다. 잠시 후 다시 로딩됩니다.");
          retryTimer = window.setTimeout(load, 3000);
          return;
        }

        setSummary(null);
        setSummaryRequested(false);
        setSummaryLoading(false);
        setSummaryTts(null);

        setMode(isAssistant ? "image" : "ocr");

        announce(`페이지 ${dp.pageNumber} 로 이동했습니다.`);
      } catch {
        if (!cancelled) {
          toast.error("데이터 로딩 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (retryTimer != null) clearTimeout(retryTimer);
    };
  }, [docIdNum, page, isAssistant, announce]);

  /* 요약 로드 */
  useEffect(() => {
    if (!docIdNum) return;
    if (!docPage?.pageId) return;
    if (!summaryRequested) return;

    let cancelled = false;

    const loadSummaryAndTts = async () => {
      try {
        setSummaryLoading(true);

        // 1) 요약 텍스트
        const s = await fetchPageSummary(docPage.pageId);
        if (cancelled) return;
        setSummary(s);

        // 2) 요약 TTS 생성 요청
        try {
          const { female, male } = await fetchSummaryTTS(
            docPage.pageId,
            s.summary
          );
          if (cancelled) return;
          setSummaryTts({ female, male });
        } catch (e) {
          console.error("[PreClass] 요약 TTS 생성 실패:", e);
          if (!cancelled) {
            setSummaryTts(null);
            announce("요약 음성을 불러오지 못했습니다.");
          }
        }
      } catch (e) {
        console.error("[PreClass] 요약 불러오기 실패:", e);
        if (!cancelled) {
          announce("요약을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadSummaryAndTts();

    return () => {
      cancelled = true;
    };
  }, [docPage?.pageId, summaryRequested, docIdNum, announce]);

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

  const canPrev = page > 1;
  const canNext = totalPage ? page < totalPage : true;

  const toggleMode = () => {
    setMode((m) => {
      const next = m === "ocr" ? "image" : "ocr";
      announce(
        next === "ocr"
          ? "본문 보기가 활성화되었습니다."
          : "원본 이미지 보기가 활성화되었습니다."
      );
      return next;
    });
  };

  /* 페이지 OCR → SRE → TTS 생성 */
  const handlePlayOcrTts = useCallback(async () => {
    if (!docPage?.pageId || !docPage.ocr) {
      toast.error("텍스트가 없어 음성을 생성할 수 없습니다.");
      return;
    }

    try {
      // 1) 로컬 TTS 정지
      stop();
      // 2) 요약 오디오 정지
      const sum = sumAudioRef.current;
      if (sum) {
        try {
          sum.pause();
          sum.currentTime = 0;
        } catch {
          // ignore
        }
      }

      setPageTtsLoading(true);

      const finalText = await buildTtsText(docPage.ocr);

      const { female, male } = await fetchPageTTS(docPage.pageId, finalText);

      const url =
        soundVoice === "여성" ? female ?? male ?? null : male ?? female ?? null;

      if (!url) {
        toast.error("생성된 본문 음성이 없습니다.");
        return;
      }

      const audio = ocrAudioRef.current;
      if (!audio) return;

      try {
        audio.pause();
      } catch {
        // ignore
      }
      audio.src = url;

      applyPlaybackRate(audio, soundRate);

      audio.currentTime = 0;
      await audio.play();

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
    stop,
  ]);

  /* 요약 TTS 재생 */
  const handlePlaySummaryTts = useCallback(async () => {
    if (!docPage?.pageId) {
      toast.error("페이지 정보가 없어 요약 음성을 재생할 수 없습니다.");
      return;
    }
    if (!summary?.summary) {
      toast.error("요약이 없어 음성을 재생할 수 없습니다.");
      return;
    }

    try {
      // 1) 로컬 TTS 정지
      stop();
      // 2) 본문 오디오 정지
      const ocr = ocrAudioRef.current;
      if (ocr) {
        try {
          ocr.pause();
          ocr.currentTime = 0;
        } catch {
          // ignore
        }
      }

      if (!summaryTts || (!summaryTts.female && !summaryTts.male)) {
        setSummaryRequested(true);
        toast("요약 음성을 준비하는 중입니다...");
        return;
      }

      const url =
        soundVoice === "여성"
          ? summaryTts.female ?? summaryTts.male ?? null
          : summaryTts.male ?? summaryTts.female ?? null;

      if (!url) {
        toast.error("생성된 요약 음성이 없습니다.");
        return;
      }

      const audio = sumAudioRef.current;
      if (!audio) return;

      if (!audio.src || audio.src !== url) {
        audio.src = url;
      }

      applyPlaybackRate(audio, soundRate);
      audio.currentTime = 0;
      await audio.play();

      announce("요약 음성을 재생합니다.");
    } catch (e) {
      console.error(e);
      toast.error("요약 음성 재생에 실패했습니다.");
      announce("요약 음성을 불러오지 못했습니다.");
    }
  }, [
    docPage?.pageId,
    summary?.summary,
    summaryTts,
    soundVoice,
    soundRate,
    announce,
    stop,
  ]);

  //메모 tts
  const handlePlayMemoTts = useCallback(
    async ({
      content,
      tts,
    }: {
      content: string;
      tts?: { female?: string | null; male?: string | null } | null;
    }) => {
      try {
        // 1) 로컬 TTS / 기존 서버 오디오 모두 정지
        stop();
        stopServerAudio();

        const url =
          tts && (tts.female || tts.male)
            ? soundVoice === "여성"
              ? tts.female ?? tts.male ?? null
              : tts.male ?? tts.female ?? null
            : null;

        if (!url) {
          // 서버 TTS가 아직 없으면 로컬 TTS로 fallback
          speakWithStop(content);
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
        await audio.play();

        announce("메모 음성을 재생합니다.");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          console.warn("[PreClass] 메모 음성 재생 중단(AbortError) - 무시");
          return;
        }

        console.error("[PreClass] 메모 음성 재생 실패:", e);
        toast.error("메모 음성 재생에 실패했습니다.");
        announce("메모 음성을 불러오지 못했습니다.");
      }
    },
    [stop, stopServerAudio, soundVoice, soundRate, speakWithStop, announce]
  );

  /* 강의 시작 */
  const onStartClass = () => {
    if (!docIdNum) {
      toast.error("문서가 없어 강의를 시작할 수 없어요.");
      return;
    }

    stop();
    stopServerAudio();

    navigate(`/lecture/doc/${docIdNum}/live/`, {
      state: {
        docId: docIdNum,
        totalPage: totalPage ?? null,
        navTitle: state?.navTitle ?? "라이브",
        autoRecord: true,
        resumeClock: state?.resumeClock ?? null,
      },
    });
  };

  const summaryTtsUrl =
    summaryTts && (summaryTts.female || summaryTts.male)
      ? soundVoice === "여성"
        ? summaryTts.female ?? summaryTts.male ?? null
        : summaryTts.male ?? summaryTts.female ?? null
      : null;

  return (
    <Wrap aria-busy={loading}>
      <audio ref={ocrAudioRef} preload="none" />
      <audio ref={sumAudioRef} preload="none" />
      <SrLive ref={liveRef} aria-live="polite" aria-atomic="true" />

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

          {docPage?.pageId && (
            <RightTabs
              stack={stackByFont}
              activeInitial="memo"
              showBoard={false}
              role={role}
              memo={{
                docId: docIdNum!,
                pageId: docPage.pageId,
                pageNumber: docPage.pageNumber,
              }}
              summary={{
                text: summary?.summary ?? "",
                ttsUrl: summaryTtsUrl ?? undefined,
                sumAudioRef,
                sidePaneRef,
                loading: summaryLoading,
              }}
              onSummaryOpen={() => setSummaryRequested(true)}
              onSummaryTtsPlay={handlePlaySummaryTts}
              memoAutoReadOnFocus={readOnFocus}
              memoUpdateWithTts
              onPlayMemoTts={handlePlayMemoTts}
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
        speak={speakWithStop}
        onGoTo={(n) => setPage(n)}
      />
    </Wrap>
  );
}
