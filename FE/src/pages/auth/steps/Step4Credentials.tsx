import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useSignup } from "src/features/signup/useSignup";
import { signupApi, toSignupFlat } from "@apis/auth/signup";
import { fonts } from "@styles/fonts";

type ShellContext = {
  setControls: (
    c: Partial<{
      title: string;
      btn: string;
      onSubmit: () => void;
      submitDisabled: boolean;
    }>
  ) => void;
};

export default function Step4Account() {
  const { info, setInfo, access, tts, role } = useSignup();
  const navigate = useNavigate();
  const { setControls } = useOutletContext<ShellContext>();

  const [submitting, setSubmitting] = useState(false);

  const errLiveRef = useRef<HTMLParagraphElement>(null);

  const isValidUsername = (v: string) => v.trim().length >= 3;
  const isValidPassword = (v: string) => v.length >= 8;

  const valid = useMemo(
    () =>
      isValidUsername(info.username ?? "") &&
      isValidPassword(info.password ?? ""),
    [info.username, info.password]
  );

  useEffect(() => {
    setControls({
      title: "아이디와 비밀번호를 입력해주세요",
      btn: "회원가입",
      onSubmit: handleSubmit,
      submitDisabled: submitting || !valid,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, valid, info.username, info.password]);

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);

    try {
      const ok = await signupApi(
        toSignupFlat(role, access, tts, {
          username: (info.username ?? "").trim(),
          password: info.password ?? "",
        })
      );

      if (!ok) throw new Error("SIGNUP_FAILED");
      navigate("/login", { replace: true });
    } catch {
      alert("회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
      requestAnimationFrame(() => errLiveRef.current?.focus());
      setInfo({ password: "" });
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <Wrap>
      <Form role="form" aria-labelledby="signup-title">
        <Field>
          <Label htmlFor="username">아이디</Label>
          <Input
            id="username"
            type="text"
            placeholder="아이디를 입력하세요"
            value={info.username ?? ""}
            onChange={(e) => setInfo({ username: e.target.value })}
            onKeyDown={onKeyDown}
            aria-invalid={!isValidUsername(info.username ?? "")}
          />
        </Field>

        <Field>
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={info.password ?? ""}
            onChange={(e) => setInfo({ password: e.target.value })}
            onKeyDown={onKeyDown}
            aria-invalid={!isValidPassword(info.password ?? "")}
          />
          <Hint>비밀번호는 8자리 이상으로 설정해주세요.</Hint>
        </Field>
      </Form>
    </Wrap>
  );
}

const Wrap = styled.div`
  margin-top: 3.12rem;
  width: 100%;
  display: flex;
  justify-content: center;
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 28.125rem;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--c-grayD);
  ${fonts.medium26}
`;

const Input = styled.input`
  padding: 22px 16px;
  border-radius: 12px;
  border: 1px solid var(--c-grayD);
  background: var(--c-white);
  color: var(--c-black);
  ${fonts.regular20}
`;

const Hint = styled.p`
  font-size: 0.875rem;
  color: var(--c-gray8, #777);
  margin-top: -2px;
  ${fonts.regular20}
`;
