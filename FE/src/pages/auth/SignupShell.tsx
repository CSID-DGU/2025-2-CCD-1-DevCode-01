import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import SignupLayout from "src/components/auth/SignupLayout";
import Stepper from "src/components/auth/Step";
import { SignupProvider } from "src/features/signup/SignupProvider";
import { useSignup } from "src/features/signup/useSignup";

const TITLES = [
  "사용자를 선택해주세요",
  "화면 크기와 화면 대비를 설정해주세요",
  "화면 읽기 속도와 목소리를 설정해주세요",
  "아이디와 비밀번호를 입력해주세요",
];

type Controls = {
  title?: string;
  btn?: string;
  onSubmit?: () => void;
  submitDisabled?: boolean;
};

function Guarded() {
  const loc = useLocation();
  const { role, access, tts, info } = useSignup();

  const stepNo = Number(/\/signup\/(\d)/.exec(loc.pathname)?.[1] ?? 1);

  useEffect(() => {
    console.groupCollapsed(`📦 Signup Progress | Step ${stepNo}`);
    console.log("▶ role:", role);
    console.log("▶ access:", access);
    console.log("▶ tts:", tts);
    console.log("▶ info:", info);
    console.groupEnd();
  }, [stepNo, role, access, tts, info]);

  const [controls, setControls] = useState<Controls>({});

  const header = useMemo(
    () => <Stepper current={stepNo} total={4} labels={TITLES} />,
    [stepNo]
  );

  if (stepNo >= 2 && !role) return <Navigate to="/signup/1" replace />;

  const displayTitle = controls.title ?? TITLES[stepNo - 1];

  return (
    <SignupLayout
      title={displayTitle}
      btn={controls.btn ?? ""}
      header={header}
      onSubmit={controls.onSubmit}
      submitDisabled={controls.submitDisabled}
    >
      <Outlet context={{ setControls }} />
    </SignupLayout>
  );
}

export default function SignupShell() {
  return (
    <SignupProvider>
      <Guarded />
    </SignupProvider>
  );
}
