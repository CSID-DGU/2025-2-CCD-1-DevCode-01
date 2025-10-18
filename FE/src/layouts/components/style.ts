import styled from "styled-components";

export const NavWrapper = styled.nav`
  width: 100%;
  height: 48px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--c-blue);
  color: var(--c-white);
`;

export const ToggleButton = styled.button`
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--c-white);
  color: var(--c-black);
  cursor: pointer;

  /* 접근성: 키보드 포커스 */
  &:focus-visible {
    outline: 1px solid var(--c-white);
    outline-offset: 2px;
  }
`;
