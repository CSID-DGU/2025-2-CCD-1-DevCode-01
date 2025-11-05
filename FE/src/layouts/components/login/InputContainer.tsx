import type { KeyboardEvent } from "react";
import * as S from "./style";

interface InputFieldProps {
  label: string;
  type?: string;
  value?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;

  /** ✅ 추가: 포커스/블러 이벤트 (TTS용) */
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const InputField = ({
  label,
  type = "text",
  value,
  placeholder,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
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
        onFocus={onFocus} // ✅ 포커스 이벤트 전달
        onBlur={onBlur} // ✅ 블러 이벤트 전달
      />
    </S.Container>
  );
};

export default InputField;
