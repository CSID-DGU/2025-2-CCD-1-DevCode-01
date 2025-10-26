// src/widgets/Nav/types.ts
export type NavVariant =
  | "auth" // 로그인/회원가입
  | "folder" // 폴더
  | "pre" // 수업 전
  | "live" // 수업 중
  | "post" // 수업 후
  | "exam"; // 시험

export type NavMeta = {
  variant: NavVariant;
  title?: string | ((params: Record<string, string>) => string);
};
