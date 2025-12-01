// src/pages/class/PostSummary.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Spinner from "src/components/common/Spinner";
import { readFontPct } from "@pages/class/pre/ally";

import * as S from "./postSummary.styles";
import {
  fetchSpeechSummaryDetail,
  type SpeechSummaryDetail,
} from "@apis/lecture/profTts.api";

type SpeechSummaryItem = {
  speechSummaryId: number;
  createdAt: string;
  // 추후 리스트 API가 간단 요약 텍스트를 준다면 추가:
  // previewText?: string;
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
  const summaries: SpeechSummaryItem[] = state?.summaries ?? [];
  const navTitle = state?.navTitle ?? "수업 후";

  const [fontPct, setFontPct] = useState(() => readFontPct());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 상세 데이터
  const [detail, setDetail] = useState<SpeechSummaryDetail | null>(null);

  // 수정 텍스트
  const [editText, setEditText] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);

  const [loading, setLoading] = useState(false); // 저장/상세 로딩용

  // 배율에 따라 레이아웃 결정 (ExamTake와 비슷한 느낌)
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

  // 요약 선택 변경
  const handleSelectSummary = (id: number) => {
    if (id === selectedId) return;

    // 수정 중이면 경고 (간단 버전)
    if (
      isDirty &&
      !window.confirm("수정 중인 내용이 사라집니다. 계속할까요?")
    ) {
      return;
    }

    setSelectedId(id);
    // detail/editText는 위 useEffect에서 다시 세팅
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
      // TODO: API 연동
      // await patchDocSpeechSummary(detail.speechSummaryId, { stt_summary: editText });

      // 일단 로컬 상태만 동기화
      setDetail((prev: SpeechSummaryDetail | null) =>
        prev ? { ...prev, stt_summary: editText } : prev
      );

      setIsDirty(false);
      // toast.success("요약이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      // toast.error("요약 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!isDirty || !detail) return;
    if (!window.confirm("수정한 내용을 모두 취소할까요?")) return;

    // 상세에서 받은 원본 텍스트로 롤백
    setEditText(detail.stt_summary ?? "");
    setIsDirty(false);
  };

  if (!docId) {
    // docId 없이 직접 URL로 접근한 경우
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
            수업 후 화면으로 돌아가기
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
                    <S.SummaryDate>{s.createdAt}</S.SummaryDate>
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
                  <span>수업 종료 시점: {detail.end_time}</span>
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
