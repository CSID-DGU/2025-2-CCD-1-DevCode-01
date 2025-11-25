import styled from "styled-components";

type SpinnerProps = {
  className?: string;
  ariaLabel?: string;
  role?: string;
};

const Spinner = ({ className, ariaLabel, role }: SpinnerProps) => {
  return (
    <SpinnerWrap role={role} className={className} aria-label={ariaLabel}>
      <SpinnerIcon />
    </SpinnerWrap>
  );
};

const SpinnerWrap = styled.div`
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SpinnerIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 3px solid ${({ theme }) => theme.colors.base.white};
  border-top-color: ${({ theme }) => theme.colors.base.blue};
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export default Spinner;
