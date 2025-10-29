export const SIGNUP_STEPS = [
  { path: "1", title: "사용자 선택" },
  { path: "2", title: "화면 크기·대비" },
  { path: "3", title: "화면 읽기" },
  { path: "4", title: "아이디·비번" },
] as const;

export type StepIndex = 1 | 2 | 3 | 4;
export const firstStep: StepIndex = 1;
export const lastStep: StepIndex = 4;
