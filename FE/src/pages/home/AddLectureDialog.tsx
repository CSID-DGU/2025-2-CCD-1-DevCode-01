import { fonts } from "@styles/fonts";
import { useEffect, useRef, useState } from "react";
import { createLecture, joinLecture } from "src/entities/lecture/api";
import type { Lecture } from "src/entities/lecture/types";
import styled from "styled-components";

type AddLectureDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (lecture: Lecture) => void;
};

export default function AddLectureDialog({
  open,
  onClose,
  onSuccess,
}: AddLectureDialogProps) {
  // 현재 단계: 선택 / 생성 / 참여
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const firstFocusRef = useRef<HTMLButtonElement | null>(null);

  // 다이얼로그 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setMode("choose");
      setTitle("");
      setCode("");
      setTimeout(() => firstFocusRef.current?.focus(), 0);
    }
  }, [open]);

  // ESC 키로 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // 새 강의 생성 요청
  const handleCreate = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const res = await createLecture({ title: title.trim() });
    setBusy(false);
    if (res) {
      onSuccess(res);
      onClose();
    }
  };

  // 코드로 참여 요청
  const handleJoin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const res = await joinLecture({ code: code.trim() });
    setBusy(false);
    if (res) {
      onSuccess(res);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <Backdrop
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-lecture-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card>
        {/* 화면 리더 전용 제목 */}
        <SrOnly id="add-lecture-title">강의 추가</SrOnly>

        {/* 1) 무엇을 할지 선택 */}
        {mode === "choose" && (
          <ChooseWrap>
            <Heading>무엇을 하시겠어요?</Heading>
            <ChoiceGrid>
              <ChoiceButton
                ref={firstFocusRef}
                onClick={() => setMode("create")}
              >
                <ChoiceTitle>새 강의 만들기</ChoiceTitle>
                <ChoiceDesc>강의명을 입력하면 초대 코드가 생성돼요.</ChoiceDesc>
              </ChoiceButton>
              <ChoiceButton onClick={() => setMode("join")}>
                <ChoiceTitle>강의 코드로 참여</ChoiceTitle>
                <ChoiceDesc>받은 6자리 코드를 입력해 참여해요.</ChoiceDesc>
              </ChoiceButton>
            </ChoiceGrid>

            <RowEnd>
              <GhostButton type="button" onClick={onClose}>
                닫기
              </GhostButton>
            </RowEnd>
          </ChooseWrap>
        )}

        {/* 2) 새 강의 만들기 */}
        {mode === "create" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
          >
            <Heading>새 강의 만들기</Heading>
            <Label htmlFor="lecture-title">강의명</Label>
            <Input
              id="lecture-title"
              placeholder="예) 서양사강독"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <RowEnd>
              <GhostButton type="button" onClick={() => setMode("choose")}>
                뒤로
              </GhostButton>
              <PrimaryButton type="submit" disabled={busy} aria-busy={busy}>
                완료
              </PrimaryButton>
            </RowEnd>
          </form>
        )}

        {/* 3) 코드로 참여 */}
        {mode === "join" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
          >
            <Heading>강의 코드로 참여</Heading>
            <Label htmlFor="lecture-code">강의 코드</Label>
            <Input
              id="lecture-code"
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="예) A7F3B9"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              aria-describedby="code-help"
              required
            />
            <Help id="code-help">알파벳/숫자 6자리</Help>
            <RowEnd>
              <GhostButton type="button" onClick={() => setMode("choose")}>
                뒤로
              </GhostButton>
              <PrimaryButton type="submit" disabled={busy} aria-busy={busy}>
                참여
              </PrimaryButton>
            </RowEnd>
          </form>
        )}
      </Card>
    </Backdrop>
  );
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  z-index: 1000;
`;

const Card = styled.div`
  width: min(92vw, 720px);
  border-radius: 20px;
  padding: 3rem 2rem;
  background: linear-gradient(
    180deg,
    var(--c-white) 0%,
    color-mix(in srgb, var(--c-grayL) 12%, var(--c-white)) 100%
  );
  border: 1px solid color-mix(in srgb, var(--c-grayL) 70%, var(--c-white));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22), 0 2px 10px rgba(0, 0, 0, 0.06);

  html.hc & {
    border-color: var(--c-black);
  }
`;

const ChooseWrap = styled.div``;

const Heading = styled.p`
  ${fonts.bold32}
  margin: 0 0 2rem;
`;

const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  @media (min-width: 560px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ChoiceButton = styled.button`
  appearance: none;
  border-radius: 14px;
  padding: 2rem 1.2rem;
  text-align: left;
  background: color-mix(in srgb, var(--c-blueL) 12%, var(--c-white));
  border: 2px solid color-mix(in srgb, var(--c-blueL) 40%, var(--c-white));
  cursor: pointer;

  &:hover {
    background: color-mix(in srgb, var(--c-blueL) 18%, var(--c-white));
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 108, 230, 0.15);
  }

  &:active {
    background: color-mix(in srgb, var(--c-blueL) 25%, var(--c-white));
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const ChoiceTitle = styled.span`
  display: block;
  ${fonts.bold26}
  color: var(--c-black);
`;

const ChoiceDesc = styled.span`
  display: block;
  ${fonts.regular17};
  color: var(--c-grayD);
  margin-top: 0.25rem;
`;

const Label = styled.label`
  ${fonts.bold20}
  margin-bottom: 0.25rem;
  display: inline-block;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem 0.875rem;
  border-radius: 10px;
  border: 2px solid var(--c-grayL);
  ${fonts.regular20}
  margin-bottom: 0.5rem;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const Help = styled.span`
  color: #666;
  font-size: 0.875rem;
`;

const RowEnd = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 2rem;
`;

const BaseButton = styled.button`
  border-radius: 999px;
  padding: 0.625rem 1rem;
  ${fonts.regular17}
  border: 2px solid transparent;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const PrimaryButton = styled(BaseButton)`
  background: var(--c-blue);
  color: var(--c-white);
  width: 100%;
  ${fonts.regular20}

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const GhostButton = styled(BaseButton)`
  background: transparent;
  border-color: var(--c-grayL);
  color: var(--c-black);
  padding: 1rem;
  ${fonts.regular20}
  width: 100%;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const SrOnly = styled.h2`
  /* 스크린리더 전용 텍스트 */
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
