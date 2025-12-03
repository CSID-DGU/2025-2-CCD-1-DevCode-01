import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Spinner from "src/components/common/Spinner";
import { readFontPct } from "@pages/class/pre/ally";

import * as S from "./postSummary.styles";
import {
  fetchSpeechSummaryDetail,
  patchSpeechSummary,
  type SpeechSummaryDetail,
} from "@apis/lecture/profTts.api";
import toast from "react-hot-toast";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";

type SpeechSummaryItem = {
  speechSummaryId: number;
  createdAt: string;
};

type LocationState = {
  docId?: number;
  summaries?: SpeechSummaryItem[];
  navTitle?: string;
};

export const PostSummary = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: LocationState };

  const docId = state?.docId;
  const summaries = useMemo(() => state?.summaries ?? [], [state?.summaries]);

  const navTitle = state?.navTitle ?? "수업 후";

  const [fontPct, setFontPct] = useState(() => readFontPct());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [detail, setDetail] = useState<SpeechSummaryDetail | null>(null);

  const [editText, setEditText] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);

  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { soundRate, soundVoice } = useSoundOptions();

  const ensureSummarySrc = useCallback(() => {
    const a = audioRef.current;
    if (!a || !detail) return null;

    const female = detail.stt_summary_tts?.female;
    const male = detail.stt_summary_tts?.male;

    const url = soundVoice === "여성" ? female ?? male : male ?? female;
    if (!url) return null;

    if (a.src !== url) {
      a.src = url;
    }

    applyPlaybackRate(a, soundRate);
    return a;
  }, [detail, soundRate, soundVoice]);

  const handleFocusTextarea = useCallback(() => {
    const a = ensureSummarySrc();
    if (!a) return;

    a.currentTime = 0;
    a.play()
      .then(() => {})
      .catch((err) => {
        console.warn("[PostSummary] 요약 TTS 자동 재생 실패:", err);
      });
  }, [ensureSummarySrc]);

  useEffect(() => {
    if (!detail) return;

    const a = audioRef.current;
    if (!a) return;

    a.pause();
    a.currentTime = 0;
    a.src = "";
  }, [detail?.speechSummaryId]);

  useEffect(() => {
    const handleFontChange = () => {
      setFontPct(readFontPct());
    };

    window.addEventListener("a11y-font-change", handleFontChange);
    return () =>
      window.removeEventListener("a11y-font-change", handleFontChange);
  }, []);

  const stackLayout = useMemo(() => fontPct >= 175, [fontPct]);

  useEffect(() => {
    if (!selectedId && summaries.length > 0) {
      setSelectedId(summaries[0].speechSummaryId);
    }
  }, [selectedId, summaries]);

  const selectedSummary = useMemo(
    () => summaries.find((s) => s.speechSummaryId === selectedId) ?? null,
    [summaries, selectedId]
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEditText("");
      setIsDirty(false);
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);
      try {
        const res = await fetchSpeechSummaryDetail(selectedId);
        if (!res || cancelled) return;

        setDetail(res);
        setEditText(res.stt_summary ?? "");
        setIsDirty(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSelectSummary = (id: number) => {
    if (id === selectedId) return;

    if (
      isDirty &&
      !window.confirm("수정 중인 내용이 사라집니다. 계속할까요?")
    ) {
      return;
    }

    setSelectedId(id);
  };

  const handleBackToPost = () => {
    if (!docId) {
      navigate(-1);
      return;
    }
    navigate(`/lecture/doc/${docId}/post`, {
      replace: false,
      state: { docId, navTitle },
    });
  };

  const handleSave = async () => {
    if (!detail || !docId) return;
    if (!isDirty) return;

    try {
      setLoading(true);

      const res = await patchSpeechSummary(detail.speechSummaryId, {
        stt_summary: editText,
      });

      if (!res) {
        console.warn("[PostSummary] PATCH 응답이 null입니다.");
        toast?.error("요약 저장에 실패했습니다.");
        return;
      }

      setDetail((prev: SpeechSummaryDetail | null) =>
        prev
          ? {
              ...prev,
              stt_summary: res.stt_summary,
              stt_summary_tts: res.stt_summary_tts,
              end_time: res.timestamp,
            }
          : prev
      );

      setIsDirty(false);
      toast.success("요약이 저장되었습니다.");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  const handleReset = () => {
    if (!isDirty || !detail) return;
    if (!window.confirm("수정한 내용을 모두 취소할까요?")) return;

    setEditText(detail.stt_summary ?? "");
    setIsDirty(false);
  };

  if (!docId) {
    return (
      <S.PageContainer>
        <S.Toolbar>
          <S.ToolbarLeft>
            <S.ToolbarTitle>교수 발화 요약</S.ToolbarTitle>
            <S.ToolbarSubtitle>
              잘못된 접근입니다. 문서 정보가 없습니다.
            </S.ToolbarSubtitle>
          </S.ToolbarLeft>
          <S.ToolbarRight>
            <S.ToolbarButton type="button" onClick={() => navigate(-1)}>
              뒤로 가기
            </S.ToolbarButton>
          </S.ToolbarRight>
        </S.Toolbar>
        <S.MainLayout $stack={true}>
          <S.ListPane $stack={true}>
            <S.EmptyState>이전 화면에서 다시 진입해 주세요.</S.EmptyState>
          </S.ListPane>
          <S.DetailPane />
        </S.MainLayout>
      </S.PageContainer>
    );
  }

  return (
    <S.PageContainer>
      {loading && (
        <S.Overlay>
          <Spinner />
        </S.Overlay>
      )}

      {/* 상단 툴바 */}
      <S.Toolbar>
        <S.ToolbarLeft>
          <S.ToolbarTitle>교수 발화 요약</S.ToolbarTitle>
          <S.ToolbarSubtitle>{navTitle}</S.ToolbarSubtitle>
        </S.ToolbarLeft>
        <S.ToolbarRight>
          <S.ToolbarButton type="button" onClick={handleBackToPost}>
            교안 보러가기
          </S.ToolbarButton>
        </S.ToolbarRight>
      </S.Toolbar>

      {/* 좌측 리스트 + 우측 상세 */}
      <S.MainLayout $stack={stackLayout}>
        {/* 리스트 영역 */}
        <S.ListPane $stack={stackLayout}>
          <S.ListHeader>
            <S.ListTitle>발화 요약 목록</S.ListTitle>
            <S.ListCount>{summaries.length}개</S.ListCount>
          </S.ListHeader>

          {summaries.length === 0 ? (
            <S.EmptyState>아직 생성된 발화 요약이 없습니다.</S.EmptyState>
          ) : (
            <S.SummaryList>
              {summaries.map((s) => {
                const active = s.speechSummaryId === selectedId;
                return (
                  <S.SummaryItem
                    key={s.speechSummaryId}
                    $active={active}
                    tabIndex={0}
                    role="button"
                    aria-pressed={active}
                    onClick={() => handleSelectSummary(s.speechSummaryId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectSummary(s.speechSummaryId);
                      }
                    }}
                  >
                    <S.SummaryDate $active={active}>
                      {s.createdAt}
                    </S.SummaryDate>
                  </S.SummaryItem>
                );
              })}
            </S.SummaryList>
          )}
        </S.ListPane>

        {/* 상세 / 수정 영역 */}
        <S.DetailPane>
          {!selectedSummary || !detail ? (
            <S.EmptyState>
              왼쪽에서 요약을 선택하면 내용이 여기 표시됩니다.
            </S.EmptyState>
          ) : (
            <>
              <S.DetailHeader>
                <S.DetailTitle>
                  발화 요약 #{detail.speechSummaryId}
                </S.DetailTitle>
                <S.DetailMeta>
                  <span>생성일: {detail.createdAt}</span>
                </S.DetailMeta>
              </S.DetailHeader>

              <S.TextArea
                placeholder="생성된 교수 발화 요약이 여기에 표시되고, 수정할 수 있습니다."
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  setIsDirty(true);
                }}
                onFocus={handleFocusTextarea}
                onBlur={() => {
                  const a = audioRef.current;
                  if (!a) return;
                  a.pause();
                }}
                onKeyDown={(e) => {
                  const isCtrlEnter =
                    (e.ctrlKey || e.metaKey) && e.key === "Enter";

                  if (isCtrlEnter) {
                    e.preventDefault();
                    if (isDirty && detail) {
                      void handleSave();
                    }
                  }
                }}
              />

              <audio
                ref={audioRef}
                preload="none"
                style={{ display: "none" }}
              />

              <S.DetailFooter>
                <S.FooterLeft>
                  {isDirty
                    ? "수정 내용이 저장되지 않았습니다."
                    : "모든 변경 사항이 저장되었습니다."}
                </S.FooterLeft>
                <S.FooterRight>
                  <S.GhostButton
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || !detail}
                  >
                    되돌리기
                  </S.GhostButton>
                  <S.PrimaryButton
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || !detail}
                  >
                    저장하기
                  </S.PrimaryButton>
                </S.FooterRight>
              </S.DetailFooter>
            </>
          )}
        </S.DetailPane>
      </S.MainLayout>
    </S.PageContainer>
  );
};

export default PostSummary;
