import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  fetchPageSummary,
  fetchDocPage,
  type DocPage,
  type PageSummary,
  fetchPageTTS,
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

import {
  readRateFromLS,
  readVoiceFromLS,
  SOUND_LS_KEYS,
  type SoundRate,
  type SoundVoice,
} from "@shared/a11y/soundOptions";

import { Container, Grid, SrLive, Wrap } from "./pre/styles";
import DocPane from "src/components/lecture/pre/DocPane";
import RightTabs from "src/components/lecture/live/RightTabs";
import BottomToolbar from "src/components/lecture/pre/BottomToolBar";
import { useTtsTextBuilder } from "src/hooks/useTtsTextBuilder";

type RouteParams = { docId?: string; courseId?: string };
type NavState = { navTitle?: string; totalPage?: number };
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

  /* refs */
  const liveRef = useRef<HTMLDivElement | null>(null);
  const announce = useMemo(() => makeAnnouncer(liveRef), []);
  const mainRegionRef = useRef<HTMLDivElement | null>(null);
  const docBodyRef = useRef<HTMLDivElement | null>(null);
  const sidePaneRef = useRef<HTMLDivElement | null>(null);
  const ocrAudioRef = useRef<HTMLAudioElement | null>(null);
  const sumAudioRef = useRef<HTMLAudioElement | null>(null);

  /* summary */
  const [summary, setSummary] = useState<PageSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);

  /* local TTS (시간/확인) */
  const { speak } = useLocalTTS();

  /* page TTS */
  const [pageTtsLoading, setPageTtsLoading] = useState(false);

  /* sound options */
  const [soundRate, setSoundRate] = useState<SoundRate>(() =>
    readRateFromLS("보통")
  );
  const [soundVoice, setSoundVoice] = useState<SoundVoice>(() =>
    readVoiceFromLS("여성")
  );

  /* SRE 텍스트 빌더 */
  const { buildTtsText } = useTtsTextBuilder();

  /* sound 변경 감지 */
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SOUND_LS_KEYS.rate) setSoundRate(readRateFromLS("보통"));
      if (e.key === SOUND_LS_KEYS.voice) setSoundVoice(readVoiceFromLS("여성"));
    };

    const handleSoundChange = () => {
      setSoundRate(readRateFromLS("보통"));
      setSoundVoice(readVoiceFromLS("여성"));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("sound:change", handleSoundChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "sound:change",
        handleSoundChange as EventListener
      );
    };
  }, []);

  /* 페이지 로드 */
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

        /* 완료 상태 */
        setSummary(null);
        setSummaryRequested(false);
        setSummaryLoading(false);

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

    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        const s = await fetchPageSummary(docPage.pageId);
        if (!cancelled) setSummary(s);
      } catch {
        announce("요약을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [docPage?.pageId, summaryRequested, docIdNum, announce]);

  /* 문서 제목 */
  useEffect(() => {
    const t = `${state?.navTitle ?? "수업 전"} - p.${page}`;
    document.title = `캠퍼스 메이트 | ${t}`;
  }, [state?.navTitle, page]);

  /* 포커스 TTS */
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

  /* 페이지 전환 시 tts 초기화 */
  useEffect(() => {
    if (ocrAudioRef.current) {
      ocrAudioRef.current.pause();
      ocrAudioRef.current.removeAttribute("src");
      ocrAudioRef.current.load();
    }
  }, [docPage?.pageId]);

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
      setTimeout(() => mainRegionRef.current?.focus(), 0);
      return next;
    });
  };

  /* 페이지 OCR → SRE → 최종 텍스트 → TTS 생성 API 연결 */
  const handlePlayOcrTts = useCallback(async () => {
    if (!docPage?.pageId || !docPage.ocr) {
      toast.error("텍스트가 없어 음성을 생성할 수 없습니다.");
      return;
    }

    try {
      setPageTtsLoading(true);

      /** 1) OCR 텍스트에서 수식 처리 */
      const finalText = await buildTtsText(docPage.ocr);

      /** 2) 백엔드에 TTS 생성 요청 */
      const { female, male } = await fetchPageTTS(docPage.pageId, finalText);

      const url = soundVoice === "여성" ? female : male;

      /** 3) 오디오 재생 */
      if (ocrAudioRef.current) {
        ocrAudioRef.current.src = url;

        // 속도 옵션 적용
        ocrAudioRef.current.playbackRate =
          soundRate === "빠름" ? 1.4 : soundRate === "느림" ? 0.6 : 1.0;

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

  /* 강의 시작 */
  const onStartClass = () => {
    if (!docIdNum) {
      toast.error("문서가 없어 강의를 시작할 수 없어요.");
      return;
    }
    navigate(`/lecture/doc/${docIdNum}/live/`, {
      state: {
        docId: docIdNum,
        totalPage: totalPage ?? null,
        navTitle: state?.navTitle ?? "라이브",
        autoRecord: true,
      },
    });
  };

  return (
    <Wrap aria-busy={loading}>
      <audio ref={ocrAudioRef} preload="none" />
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
                ttsUrl: summary?.summary_tts,
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
