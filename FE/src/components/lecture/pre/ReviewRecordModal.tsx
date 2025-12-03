import { useFocusSpeak } from "@shared/tts/useFocusSpeak";
import { fonts } from "@styles/fonts";
import { useRef } from "react";
import { useModalFocusTrap } from "src/hooks/useModalFocusTrap";
import styled from "styled-components";

type Props = {
  open: boolean;
  onClose: () => void;
  onReview: () => void;
  onContinue: () => void;
};

export default function ReviewRecordModal({
  open,
  onClose,
  onReview,
  onContinue,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const titleRef = useRef<HTMLParagraphElement | null>(null);

  const { handleKeyDown } = useModalFocusTrap({
    open,
    containerRef: dialogRef,
    initialFocusRef: titleRef,
    onClose,
  });

  const recordText = useFocusSpeak({
    text: "수업 기록이 있습니다.",
  });

  const reviewDocs = useFocusSpeak({
    text: "복습하기",
  });

  const continueDocs = useFocusSpeak({
    text: "이어서 학습하기",
  });

  if (!open) return null;

  return (
    <Backdrop role="dialog" aria-modal="true" onClick={onClose}>
      <Card
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        aria-label="수업 기록 안내"
        onKeyDown={handleKeyDown}
      >
        <IconCircle src="/img/lecture/check.png" aria-hidden="true" />

        <Title tabIndex={0} ref={titleRef} {...recordText}>
          수업 기록이 있습니다!
        </Title>

        <Divider />

        <ButtonRow>
          <ActionButton type="button" onClick={onReview} {...reviewDocs}>
            복습 하기
          </ActionButton>
          <VerticalDivider />
          <ActionButton type="button" onClick={onContinue} {...continueDocs}>
            이어서{"\n"}학습하기
          </ActionButton>
        </ButtonRow>
      </Card>
    </Backdrop>
  );
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
`;

const Card = styled.div`
  width: 600px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.base.white};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  padding: 24px 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const IconCircle = styled.img`
  width: 86px;
  height: 86px;
`;

const Title = styled.p`
  margin: 12px;
  ${fonts.title2}
  color: ${({ theme }) => theme.colors.base.black};

  &:focus-visible {
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const Divider = styled.hr`
  width: 100%;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.base.blue};
  margin: 0;
`;

const ButtonRow = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1px 1fr;
  align-items: stretch;
  margin-top: 0;
`;

const ActionButton = styled.button`
  border: none;
  background: transparent;
  padding: 14px 0 16px;
  ${fonts.medium26}
  color: ${({ theme }) => theme.colors.base.blue};
  cursor: pointer;
  white-space: pre-line;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
  text-align: center;

  &:focus-visible {
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const VerticalDivider = styled.div`
  width: 1px;
  background: ${({ theme }) => theme.colors.base.blue};
`;
