import { fonts } from "@styles/fonts";
import styled from "styled-components";

export const SignupContainer = styled.div<{ $active?: boolean }>`
  width: 380px;
  height: 380px;
  padding: 51px 86px 32px 86px;
  border: 3px solid
    ${({ $active }) => ($active ? "var(--c-blue)" : "var(--c-grayD)")};
  background: ${({ $active }) => ($active ? "#EEF4FF" : "#fff")};
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 46px;
  ${fonts.medium32};
  color: black;
  cursor: pointer;
  border-radius: 20px;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-6px) scale(1.03);
    border-color: var(--c-blue);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }
  ${({ $active }) =>
    $active &&
    `
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(47,102,200,0.25);
    color: black;
  `}
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(47, 102, 200, 0.35);
  }

  img {
    width: 208px;
    height: 214px;
    transition: transform 0.25s ease;
  }
  &:hover img {
    transform: scale(1.05);
  }

  .helper {
    width: 269px;
    height: 196px;
  }
`;
