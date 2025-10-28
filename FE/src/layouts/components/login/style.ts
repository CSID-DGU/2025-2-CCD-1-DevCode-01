import { fonts } from "@styles/fonts";
import styled from "styled-components";

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

export const Label = styled.label`
  ${fonts.regular24}
  color: var(--c-grayD);
`;

export const Input = styled.input`
  padding: 22px 16px;
  border-radius: 10px;
  border: 1px solid var(--c-grayL);
  background-color: var(--c-white);
  ${fonts.regular20}
  color: var(--c-black);
  transition: 0.2s border-color;

  &:focus {
    border-color: var(--c-blueM);
    outline: none;
  }

  &::placeholder {
    color: var(--c-grayD);
    opacity: 0.6;
  }
`;
