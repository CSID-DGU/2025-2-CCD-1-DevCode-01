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

export const LoginRightContaienr = styled.div``;
