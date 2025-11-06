import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useState, useMemo, useRef, useCallback } from "react";
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

export type ShellContext = {
  setControls: (c: Partial<Controls>) => void;
  focusNext: () => void;
};

function shallowEqual(a: Partial<Controls>, b: Partial<Controls>) {
  const ka = Object.keys(a) as (keyof Controls)[];
  const kb = Object.keys(b) as (keyof Controls)[];
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function Guarded() {
  const loc = useLocation();
  const { role } = useSignup();
  const stepNo = Number(/\/signup\/(\d)/.exec(loc.pathname)?.[1] ?? 1);

  const [controls, _setControls] = useState<Controls>({});
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);

  const setControls = useCallback((c: Partial<Controls>) => {
    _setControls((prev) => {
      const next = { ...prev, ...c };
      return shallowEqual(prev, next) ? prev : next;
    });
  }, []);

  const header = useMemo(
    () => <Stepper current={stepNo} total={4} labels={TITLES} />,
    [stepNo]
  );

  if (stepNo >= 2 && !role) return <Navigate to="/signup/1" replace />;

  const displayTitle = controls.title ?? TITLES[stepNo - 1];

  return (
    <SignupLayout
      title={displayTitle}
      btn={controls.btn ?? "다음"}
      header={header}
      onSubmit={controls.onSubmit}
      submitDisabled={!!controls.submitDisabled}
      nextBtnRef={nextBtnRef}
    >
      <Outlet
        context={
          {
            setControls,
            focusNext: () => nextBtnRef.current?.focus(),
          } satisfies ShellContext
        }
      />
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
