import * as S from "./style";

interface InputFieldProps {
  label: string;
  type?: string;
  value?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputField = ({
  label,
  type = "text",
  value,
  placeholder,
  onChange,
}: InputFieldProps) => {
  return (
    <S.Container>
      <S.Label>{label}</S.Label>
      <S.Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
    </S.Container>
  );
};

export default InputField;
