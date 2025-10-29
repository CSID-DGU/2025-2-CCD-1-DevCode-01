import { useState } from "react";
import SignupLayout from "src/components/auth/SignupLayout";
import Stepper from "src/components/auth/Step";
import * as s from "./Signup_style";
// import { useNavigate } from "react-router-dom";

const SignUp = () => {
  const [role, setRole] = useState<"student" | "helper" | null>(null);
  // const navigate = useNavigate();

  const handleKey = (
    e: React.KeyboardEvent,
    nextRole: "student" | "helper"
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setRole(nextRole);
    }
  };

  return (
    <SignupLayout
      title="사용자를 선택해주세요"
      btn="다음"
      header={
        <Stepper
          current={1}
          total={4}
          labels={["사용자 선택", "화면 크기·대비", "화면 읽기", "아이디·비번"]}
        />
      }
      onSubmit={() => {
        if (!role) return;
        console.log("다음 단계로 이동:", role);
        // navigate("/signup/2", { state: { role } });
      }}
      submitDisabled={!role}
    >
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
          aria-pressed={role === "helper"}
          onClick={() => setRole("helper")}
          onKeyDown={(e) => handleKey(e, "helper")}
          $active={role === "helper"}
        >
          <img
            className="helper"
            src="/img/login/helper.png"
            alt=""
            aria-hidden
          />
          <p>도우미</p>
        </s.SignupContainer>
      </div>
    </SignupLayout>
  );
};

export default SignUp;
