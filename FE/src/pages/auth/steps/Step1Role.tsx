import { useNavigate, useOutletContext } from "react-router-dom";
import * as s from "../Signup_style";
import { useSignup } from "src/features/signup/useSignup";
import { useEffect } from "react";

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

export default function Step1Role() {
  const { role, setRole } = useSignup();
  const navigate = useNavigate();
  const { setControls } = useOutletContext<ShellContext>();

  useEffect(() => {
    setControls({
      btn: "다음",
      onSubmit: () => {
        if (role) navigate("/signup/2");
      },
      submitDisabled: !role,
    });
  }, [role, navigate, setControls]);

  const handleKey = (
    e: React.KeyboardEvent,
    nextRole: "student" | "assistant"
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setRole(nextRole);
    }
  };

  return (
    <div style={{ display: "flex", gap: "2rem", justifyContent: "center" }}>
      <s.SignupContainer
        role="button"
        tabIndex={0}
        aria-pressed={role === "student"}
        onClick={() => setRole("student")}
        onKeyDown={(e) => handleKey(e, "student")}
        $active={role === "student"}
      >
        <img src="/img/login/student.png" alt="" aria-hidden />
        <p>장애 학우</p>
      </s.SignupContainer>

      <s.SignupContainer
        role="button"
        tabIndex={0}
        aria-pressed={role === "assistant"}
        onClick={() => setRole("assistant")}
        onKeyDown={(e) => handleKey(e, "assistant")}
        $active={role === "assistant"}
      >
        <img
          className="assistant"
          src="/img/login/helper.png"
          alt=""
          aria-hidden
        />
        <p>도우미</p>
      </s.SignupContainer>
    </div>
  );
}
