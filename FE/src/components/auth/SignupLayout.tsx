import type { ReactNode, RefObject } from "react";
import styled from "styled-components";
import { useContext } from "react";
import { TTSContext } from "@shared/tts/TTSProvider";

type SignupLayoutProps = {
  title: string;
  btn: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  onSubmit?: () => void;
  submitDisabled?: boolean;
  nextBtnRef?: RefObject<HTMLButtonElement | null>;
};

const SignupLayout = ({
  title,
  btn,
  children,
  header,
  footer,
  onSubmit,
  submitDisabled,
  nextBtnRef,
}: SignupLayoutProps) => {
  const tts = useContext(TTSContext);

  return (
    <Wrap>
      {header}
      <Title>{title}</Title>
      <Container>{children}</Container>
      {footer}
      <Btn
        ref={nextBtnRef}
        type="button"
        tabIndex={0}
        aria-disabled={submitDisabled ? "true" : "false"}
        onClick={() => {
          if (!submitDisabled) onSubmit?.();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !submitDisabled) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        onFocus={() => {
          tts?.speak("다음 버튼입니다.");
        }}
      >
        {btn}
      </Btn>
    </Wrap>
  );
};

export default SignupLayout;

/* styled */
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  margin: 0 auto;
  margin-top: 3rem;
`;

const Title = styled.h1`
  font-size: 1.8rem;
  font-weight: 800;
  text-align: center;
  margin-top: 0.25rem;
`;

const Container = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
`;

const Btn = styled.button`
  margin-top: 1rem;
  width: 28.125rem;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--c-white);
  background: var(--c-blue);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease-in-out;

  &[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;
