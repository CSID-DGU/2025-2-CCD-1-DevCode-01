import styled from "styled-components";
import { fonts } from "@styles/fonts";
import type { FormEvent } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export const EditTitleBar = ({ value, onChange, onSave, onCancel }: Props) => {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <EditBar onSubmit={submit}>
      <TitleInput
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        aria-label="강의명 편집"
        placeholder="강의명을 입력하세요"
      />
      <ChipContainer>
        <Chip type="button" onClick={onCancel} $ghost>
          취소
        </Chip>
        <Chip type="submit">저장</Chip>
      </ChipContainer>
    </EditBar>
  );
};

const EditBar = styled.form`
  margin-top: 4px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 1rem;
  border-radius: 12px;
  background: white;
  border: 1px solid var(--c-grayL);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
`;

const TitleInput = styled.input`
  width: 100%;
  border: 2px solid var(--c-grayL);
  border-radius: 10px;
  padding: 10px 12px;
  ${fonts.regular24}
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const ChipContainer = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 0.5rem;
`;

const Chip = styled.button<{ $ghost?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  ${fonts.regular20}
  border-radius: 999px;
  padding: 10px 14px;
  border: 2px solid
    ${({ $ghost }) => ($ghost ? "var(--c-grayL)" : "transparent")};
  background: ${({ $ghost }) => ($ghost ? "var(--c-white)" : "var(--c-blue)")};
  color: ${({ $ghost }) => ($ghost ? "var(--c-black)" : "var(--c-white)")};
  cursor: pointer;
  &:hover {
    filter: ${({ $ghost }) =>
      $ghost ? "brightness(0.98)" : "brightness(0.96)"};
  }
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;
