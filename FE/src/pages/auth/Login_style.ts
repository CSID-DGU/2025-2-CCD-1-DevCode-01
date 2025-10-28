import { fonts } from "@styles/fonts";
import styled from "styled-components";

export const LoginWrapper = styled.div`
  display: flex;
  width: 100%;
  overflow: hidden;
`;

export const LoginLeftContainer = styled.div`
  display: flex;
  width: 50%;
  overflow: hidden;
  position: relative;

  img {
    position: absolute;
    width: 100%;
    height: 100vh;
  }

  h1 {
    ${fonts.title}
    position: absolute;
    color: var(--c-grayD);
    display: flex;
    left: 4vw;
    top: 45vh;
    transform: translateY(-50%);
  }
`;

export const LoginLeftBg = styled.div`
  display: flex;
  width: 100%;
  background: linear-gradient(
    90deg,
    var(--c-blueL) 0%,
    var(--c-blueM) 50%,
    var(--c-blueD) 89%
  );
  opacity: 0.4;
`;

export const LoginRightContaienr = styled.div`
  width: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  h1 {
    ${fonts.title2};
    color: var(--c-black);
  }
`;

export const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 3.12rem;
  gap: 1.88rem;

  button {
    display: flex;
    width: 450px;
    height: 68px;
    padding: 22px 193px;
    justify-content: center;
    align-items: center;
    background-color: var(--c-blue);
    color: var(--c-white);
    border-radius: 12px;
    ${fonts.regular24}
  }
`;

export const SignupContainer = styled.section`
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 20px;
  ${fonts.regular20};

  p {
    color: var(--c-black);
  }

  .signup {
    color: var(--c-blue);
    cursor: pointer;
  }
`;
