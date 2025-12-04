import type { ReactNode, RefObject } from "react";
import styled from "styled-components";
import { useContext } from "react";
import { TTSContext } from "@shared/tts/TTSProvider";
import { useNavigate } from "react-router-dom";
import { fonts } from "@styles/fonts";

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
  const navigate = useNavigate();

  const handleSignupClick = () => {
    navigate("/login");
  };

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
      </Btn>{" "}
      <p
        className="login"
        onFocus={() => {
          tts?.speak("로그인 이동");
        }}
        onClick={handleSignupClick}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleSignupClick()}
      >
        로그인 하러가기
      </p>
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

  .login {
    margin-bottom: 1rem;
    ${fonts.medium24}
    border-bottom: 1px solid black;

    &:focus-visible {
      outline: 5px solid var(--c-blue);
      outline-offset: 2px;
    }
  }
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
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;
  }
`;
