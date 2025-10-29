import type { ReactNode } from "react";
import styled from "styled-components";

type SignupLayoutProps = {
  title: string;
  btn: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  onSubmit?: () => void;
  submitDisabled?: boolean;
};

const SignupLayout = ({
  title,
  btn,
  children,
  header,
  footer,
  onSubmit,
  submitDisabled,
}: SignupLayoutProps) => {
  return (
    <Wrap>
      {header}
      <Title>{title}</Title>
      <Container>{children}</Container>
      {footer}
      <Btn type="button" onClick={onSubmit} disabled={submitDisabled}>
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
  gap: 1.25rem;
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
  &:hover {
    background: var(--c-blue);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
