import type { KeyboardEvent } from "react";
import * as S from "./style";

interface InputFieldProps {
  label: string;
  type?: string;
  value?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

const InputField = ({
  label,
  type = "text",
  value,
  placeholder,
  onChange,
  onKeyDown,
}: InputFieldProps) => {
  return (
    <S.Container>
      <S.Label>{label}</S.Label>
      <S.Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    </S.Container>
  );
};

export default InputField;
