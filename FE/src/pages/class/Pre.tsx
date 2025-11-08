import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import styled from "styled-components";
import toast from "react-hot-toast";
import {
  fetchPageSummary,
  fetchDocPage,
  type DocPage,
  type PageSummary,
} from "@apis/lecture/lecture.api";
import { formatOcr } from "@shared/formatOcr";

type RouteParams = { docId?: string; courseId?: string };
type NavState = { navTitle?: string; totalPages?: number };

const A11Y_STORAGE_KEYS = { font: "font" } as const;
const DEFAULT_FONT_PCT = 125;
const readFontPct = (): number => {
  try {
    const raw = window.localStorage.getItem(A11Y_STORAGE_KEYS.font);
    const n = parseInt(raw ?? String(DEFAULT_FONT_PCT), 10);
    return Number.isFinite(n) ? n : DEFAULT_FONT_PCT;
  } catch {
    return DEFAULT_FONT_PCT;
  }
};

export default function PreClass() {
  const params = useParams<RouteParams>();
  const { state } = useLocation() as { state?: NavState };

  const docIdNum = useMemo(() => {
    const raw = params.docId ?? params.courseId;
    const n = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.docId, params.courseId]);

  const [page, setPage] = useState<number>(1);
  const [docPage, setDocPage] = useState<DocPage | null>(null);
  const [summary, setSummary] = useState<PageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // 폰트 크기에 따라 우측 스택 여부 결정 (많이 크게=175 이상)
  const [fontPct, setFontPct] = useState<number>(readFontPct());
  const stackByFont = fontPct >= 175;

  const totalPages = state?.totalPages;
  const cleanOcr = useMemo(() => formatOcr(docPage?.ocr ?? ""), [docPage?.ocr]);

  // 보기 모드: OCR(본문) / IMAGE(원본)
  const [mode, setMode] = useState<"ocr" | "image">("ocr");

  const liveRef = useRef<HTMLDivElement | null>(null);
  const mainRegionRef = useRef<HTMLDivElement | null>(null);
  const ocrAudioRef = useRef<HTMLAudioElement | null>(null);
  const sumAudioRef = useRef<HTMLAudioElement | null>(null);

  /* --- 폰트 변경 실시간 반영 --- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === A11Y_STORAGE_KEYS.font) setFontPct(readFontPct());
    };
    const onCustom = () => setFontPct(readFontPct()); // window.dispatchEvent(new Event("a11y:font-change"))
    const onVisible = () => {
      if (!document.hidden) setFontPct(readFontPct());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("a11y:font-change", onCustom as EventListener);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("a11y:font-change", onCustom as EventListener);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* --- 데이터 로드 --- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!docIdNum) return;
      try {
        setLoading(true);
        const dp = await fetchDocPage(docIdNum, page);
        if (cancelled) return;
        if (!dp) {
          setDocPage(null);
          setSummary(null);
          toast.error("교안 페이지를 불러오지 못했어요.");
          announce("교안 페이지를 불러오지 못했습니다.");
          return;
        }
        setDocPage(dp);

        if (dp.pageId && dp.pageId > 0) {
          const sm = await fetchPageSummary(dp.pageId);
          if (!cancelled) setSummary(sm ?? null);
        } else {
          setSummary(null);
        }

        // 페이지 이동 시 항상 본문 모드로
        setMode("ocr");
        announce(
          `페이지 ${dp.pageNumber}${
            totalPages ? ` / 총 ${totalPages}` : ""
          }로 이동했습니다. 본문 보기가 활성화되었습니다.`
        );
        // 포커스 본문 영역
        mainRegionRef.current?.focus();
      } catch {
        if (!cancelled) {
          toast.error("데이터 로딩 중 오류가 발생했어요.");
          announce("데이터 로딩 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docIdNum, page]);

  /* --- 문서 탭 제목 --- */
  useEffect(() => {
    const t = `${state?.navTitle ?? "수업 전"} - p.${page}`;
    document.title = `캠퍼스 메이트 | ${t}`;
  }, [state?.navTitle, page]);

  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : true;

  const announce = (msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const toggleMode = () => {
    setMode((m) => {
      const next = m === "ocr" ? "image" : "ocr";
      announce(
        next === "image"
          ? "원본 이미지 보기가 활성화되었습니다."
          : "본문 보기가 활성화되었습니다."
      );
      // 모드 전환 시 본문 영역에 포커스
      setTimeout(() => mainRegionRef.current?.focus(), 0);
      return next;
    });
  };

  return (
    <Wrap aria-busy={loading}>
      {/* 스크린리더 라이브 영역 */}
      <SrLive ref={liveRef} aria-live="polite" aria-atomic="true" />
      <Container>
        <Grid $stack={stackByFont}>
          {/* 왼쪽: 본문(ocr) <-> 이미지(원본) 토글 */}
          <DocPane
            ref={mainRegionRef}
            role="region"
            aria-label={
              mode === "ocr" ? "교안 본문 텍스트" : "교안 원본 이미지"
            }
            tabIndex={-1}
          >
            <DocBody>
              {mode === "image" ? (
                docPage?.image ? (
                  <DocImage
                    src={docPage.image}
                    alt={`문서 ${docPage.docId}의 ${docPage.pageNumber}페이지 이미지`}
                  />
                ) : (
                  <Empty role="status">이미지를 불러오는 중…</Empty>
                )
              ) : (
                <>
                  <Section aria-labelledby="ocr-title">
                    <SectionTitle id="ocr-title">본문(OCR)</SectionTitle>

                    {/* SR 전용 TTS 재생 트리거 (시각적으로 숨김, 탭 가능) */}
                    <SrOnlyFocusable
                      type="button"
                      onClick={() => ocrAudioRef.current?.play()}
                      aria-label="본문 TTS 재생"
                    >
                      본문 듣기
                    </SrOnlyFocusable>
                    {docPage?.tts && (
                      <audio
                        ref={ocrAudioRef}
                        preload="none"
                        src={docPage.tts}
                      />
                    )}

                    <Paragraph>{cleanOcr || "텍스트가 없습니다."}</Paragraph>
                  </Section>
                </>
              )}
            </DocBody>
          </DocPane>

          {/* 오른쪽: 요약 */}
          <SidePane $stack={stackByFont} role="complementary" aria-label="요약">
            <Card>
              <CardTitle>요약</CardTitle>

              {/* SR 전용 요약 TTS 재생 */}
              <SrOnlyFocusable
                type="button"
                onClick={() => sumAudioRef.current?.play()}
                aria-label="요약 TTS 재생"
              >
                요약 듣기
              </SrOnlyFocusable>
              {summary?.summary_tts && (
                <audio
                  ref={sumAudioRef}
                  preload="none"
                  src={summary.summary_tts}
                />
              )}

              <Paragraph>{summary?.summary ?? "요약이 없습니다."}</Paragraph>
            </Card>
          </SidePane>
        </Grid>
      </Container>
      <Toolbar role="toolbar" aria-label="페이지 조작">
        <Group>
          <ToolBtn
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            aria-label="이전 페이지"
          >
            ‹
          </ToolBtn>

          <PageBadge aria-label={`현재 페이지 ${page}`}>{page}</PageBadge>
          <Slash>/</Slash>
          <span aria-label="전체 페이지">{totalPages ?? "?"}</span>

          <ToolBtn
            onClick={() => setPage((p) => p + 1)}
            disabled={!canNext}
            aria-label="다음 페이지"
          >
            ›
          </ToolBtn>
        </Group>

        <Divider role="separator" aria-orientation="vertical" />

        <Group>
          {/* 보기 전환: OCR ↔ IMAGE */}
          <ToolBtn
            onClick={toggleMode}
            aria-pressed={mode === "image"}
            aria-label={
              mode === "ocr" ? "원본 보기로 전환" : "본문 보기로 전환"
            }
          >
            {mode === "ocr" ? "원본 보기" : "본문 보기"}
          </ToolBtn>
        </Group>

        <Divider role="separator" aria-orientation="vertical" />

        <Group>
          <PrimaryBtn
            type="button"
            onClick={() => announce("강의가 시작되었습니다.")}
          >
            ▶ 강의시작
          </PrimaryBtn>
        </Group>
      </Toolbar>
    </Wrap>
  );
}

/* -------------------- styled -------------------- */

const CONTAINER_MAX = 1200;
const DOC_TEXT_MEASURE = 72;
const SIDE_MIN = 360;
const SIDE_MAX = 520;
const TOOLBAR_H = 56;
const TOOLBAR_GAP = 12;

const PANEL_FIXED_H = `calc(100dvh - 120px - ${TOOLBAR_H}px - ${TOOLBAR_GAP}px - env(safe-area-inset-bottom, 0px))`;

const Wrap = styled.section`
  --ui-scale-effective: calc(var(--ui-scale, 1));
  min-height: 100dvh;
  background: #f8fafc;
  padding-bottom: calc(
    ${TOOLBAR_H}px + ${TOOLBAR_GAP}px + env(safe-area-inset-bottom, 0px)
  );
  width: 100%;
`;

const SrLive = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  overflow: hidden;
`;

const Container = styled.div`
  max-width: ${CONTAINER_MAX}px;
  margin-inline: auto;
  padding: 16px clamp(16px, 4vw, 24px);
`;

const Grid = styled.div<{ $stack: boolean }>`
  display: grid;
  gap: 16px;

  grid-template-columns: ${({ $stack }) =>
    $stack
      ? "1fr"
      : `minmax(0, 1fr) minmax(${SIDE_MIN}px,
           clamp(${SIDE_MIN}px,
                 28vw,
                 ${SIDE_MAX}px))`};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const DocPane = styled.div`
  background: #fff;
  border: 1px solid #e7eef6;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);

  height: ${PANEL_FIXED_H};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DocBody = styled.div`
  flex: 1 1 auto;
  overflow: auto;
  padding: clamp(16px, 2.2vw, 24px);
  overscroll-behavior: contain;

  p,
  li {
    max-width: ${DOC_TEXT_MEASURE}ch;
  }
`;

const SidePane = styled.aside<{ $stack: boolean }>`
  position: ${({ $stack }) => ($stack ? "static" : "sticky")};
  top: 16px;

  background: #fff;
  border: 1px solid #e7eef6;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);

  display: grid;
  gap: 10px;
`;

const DocImage = styled.img`
  width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid #eef2f7;
  background: #fafafa;
`;
const Section = styled.section`
  display: grid;
  gap: 8px;
`;

const SectionTitle = styled.h2`
  font-size: clamp(1rem, 0.96rem + 0.2vw, 1.125rem);
  font-weight: 700;
  color: #0f172a;
`;

const Paragraph = styled.p`
  white-space: pre-wrap;
  line-height: 1.7;
  font-size: clamp(0.98rem, 0.96rem + 0.1vw, 1.05rem);
  color: #0b1220;
  letter-spacing: 0.002em;
`;

const Card = styled.section`
  border: 1px solid #eee;
  border-radius: 0.75rem;
  padding: 1rem;
  background: #fff;
`;

const CardTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
`;

const Empty = styled.div`
  border: 1px dashed #d6e2f0;
  border-radius: 10px;
  padding: 28px;
  color: #6b7280;
  text-align: center;
  background: #fbfdff;
`;

/* ======= 하단 툴바 ======= */
const Toolbar = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(${TOOLBAR_GAP}px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;

  height: ${TOOLBAR_H}px;
  padding: 0 0.75rem;

  background: #2b62d6;
  color: #fff;
  border-radius: 0.5rem;
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.12);
  z-index: 999; /* 콘텐츠 위로 */

  /* 내용 길어져도 가독성 위해 반응형 폭 한계 */
  max-width: min(92vw, 720px);
  width: max-content;
`;

const Group = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;

const Divider = styled.div`
  width: 1px;
  height: 1.25rem;
  background: #ffffff55;
`;

const ToolBtn = styled.button`
  border: 1px solid #ffffff66;
  background: transparent;
  color: #fff;
  padding: 0.25rem 0.6rem;
  border-radius: 0.4rem;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
`;

const PageBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  height: 1.6rem;
  border: 2px solid #fff;
  border-radius: 999px;
  padding: 0 0.3rem;
  font-weight: 700;
`;

const Slash = styled.span`
  opacity: 0.9;
`;

const PrimaryBtn = styled.button`
  background: #1048d6;
  color: #fff;
  padding: 0.35rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid #ffffff66;
  font-weight: 600;
`;

/* ===== SR 전용, 탭 가능(시각적으로 숨김) ===== */
const SrOnlyFocusable = styled.button`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  overflow: hidden;
  &:focus {
    outline: none;
  }
`;
