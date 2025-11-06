import { useNavigate, useOutletContext } from "react-router-dom";
import * as s from "../Signup_style";
import { useSignup } from "src/features/signup/useSignup";
import { useEffect, useContext, useRef, useState, useCallback } from "react";
import { TTSContext } from "@shared/tts/TTSProvider";
import type { ShellContext } from "../SignupShell";

export default function Step1Role() {
  const { role, setRole } = useSignup();
  const navigate = useNavigate();
  const { setControls, focusNext } = useOutletContext<ShellContext>();
  const tts = useContext(TTSContext);

  const [hasSpokenIntro, setHasSpokenIntro] = useState(false);
  const studentRef = useRef<HTMLDivElement | null>(null);
  const assistantRef = useRef<HTMLDivElement | null>(null);

  const onSubmit = useCallback(() => {
    if (role) navigate("/signup/2");
  }, [role, navigate]);

  useEffect(() => {
    setControls({
      btn: "다음",
      onSubmit,
      submitDisabled: !role,
    });
  }, [setControls, onSubmit, role]);

  const handleFirstFocus = () => {
    if (!hasSpokenIntro) {
      tts?.speak(
        "사용자를 선택해주세요. 장애 학우 또는 도우미 중 하나를 선택하세요."
      );
      setHasSpokenIntro(true);
    }
  };

  const choose = (nextRole: "student" | "assistant") => {
    setRole(nextRole);
    localStorage.setItem("role", nextRole);
    tts?.speak(
      nextRole === "student"
        ? "장애 학우를 선택했습니다. 다음 버튼을 클릭해주세요."
        : "도우미를 선택했습니다. 다음 버튼을 클릭해주세요."
    );
    requestAnimationFrame(() => focusNext());
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "2rem",
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      <s.SignupContainer
        ref={studentRef}
        role="button"
        tabIndex={0}
        aria-pressed={role === "student"}
        aria-label="장애 학우 버튼"
        onFocus={() => {
          handleFirstFocus();
          tts?.speak("장애 학우 버튼");
        }}
        onClick={() => choose("student")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose("student");
          }
        }}
        $active={role === "student"}
      >
        <img src="/img/login/student.png" alt="" aria-hidden />
        <p>장애 학우</p>
      </s.SignupContainer>

      <s.SignupContainer
        ref={assistantRef}
        role="button"
        tabIndex={0}
        aria-pressed={role === "assistant"}
        aria-label="도우미 버튼"
        onFocus={() => {
          handleFirstFocus();
          tts?.speak("도우미 버튼");
        }}
        onClick={() => choose("assistant")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose("assistant");
          }
        }}
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
