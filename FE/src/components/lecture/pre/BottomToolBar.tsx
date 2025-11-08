import { TOOLBAR_GAP, TOOLBAR_H } from "@pages/class/pre/styles";
import { fonts } from "@styles/fonts";
import styled from "styled-components";

type Props = {
  canPrev: boolean;
  canNext: boolean;
  page: number;
  totalPages?: number;
  mode: "ocr" | "image";
  onPrev: () => void;
  onNext: () => void;
  onToggleMode: () => void;
  onStart: () => void;
  speak?: (msg: string) => void;
};

export default function BottomToolbar({
  canPrev,
  canNext,
  page,
  totalPages,
  mode,
  onPrev,
  onNext,
  onToggleMode,
  onStart,
  speak,
}: Props) {
  return (
    <Bar role="toolbar" aria-label="페이지 조작">
      <Group>
        <Btn
          onClick={() => {
            onPrev();
            speak?.("이전 페이지로 이동");
          }}
          onFocus={() => speak?.("이전 페이지 버튼")}
          disabled={!canPrev}
          aria-label="이전 페이지"
        >
          ‹
        </Btn>

        <Badge aria-label={`현재 페이지 ${page}`}>{page}</Badge>
        <Slash>/</Slash>
        <span aria-label="전체 페이지">{totalPages ?? "?"}</span>

        <Btn
          onClick={() => {
            onNext();
            speak?.("다음 페이지로 이동");
          }}
          onFocus={() => speak?.("다음 페이지 버튼")}
          disabled={!canNext}
          aria-label="다음 페이지"
        >
          ›
        </Btn>
      </Group>

      <Divider role="separator" aria-orientation="vertical" />

      <Group>
        <Btn
          onClick={() => {
            onToggleMode();
            speak?.(mode === "ocr" ? "원본 보기로 전환" : "본문 보기로 전환");
          }}
          onFocus={() => speak?.("보기 전환 버튼")}
          aria-pressed={mode === "image"}
          aria-label={mode === "ocr" ? "원본 보기로 전환" : "본문 보기로 전환"}
        >
          {mode === "ocr" ? "원본 보기" : "본문 보기"}
        </Btn>
      </Group>

      <Divider role="separator" aria-orientation="vertical" />

      <Group>
        <Primary
          type="button"
          onClick={() => {
            onStart();
            speak?.("강의가 시작되었습니다.");
          }}
          onFocus={() => speak?.("강의 시작 버튼")}
        >
          ▶ 강의시작
        </Primary>
      </Group>
    </Bar>
  );
}

/* styled */
const Bar = styled.div`
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
  background: var(--c-blue);
  color: var(--c-white);
  border-radius: 0.5rem;
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.12);
  z-index: 999;
  max-width: min(92vw, 720px);
  width: max-content;
`;
const Group = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;

  span {
    ${fonts.medium26};
  }
`;
const Divider = styled.div`
  width: 1px;
  height: 1.25rem;
  background: #ffffff55;
`;
const Btn = styled.button`
  border: 2px solid var(--c-white);
  ${fonts.medium26};
  background: transparent;
  color: var(--c-white);
  cursor: pointer;
  padding: 0.25rem 0.6rem;
  border-radius: 0.4rem;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 2px solid var(--c-white);
    outline-offset: 2px;
  }
`;
const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0 0.3rem;
  ${fonts.medium26};
`;
const Slash = styled.span`
  ${fonts.medium26};
`;
const Primary = styled.button`
  background: var(--c-blue);
  color: var(--c-white);
  padding: 0.35rem 0.8rem;
  border-radius: 0.5rem;
  border: 2px solid var(--c-white);
  ${fonts.medium26};
  cursor: pointer;
`;
