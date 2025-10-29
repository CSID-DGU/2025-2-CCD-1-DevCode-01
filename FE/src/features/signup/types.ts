export type Role = "student" | "assistant";
export type Access = { font: number; high_contrast: boolean };
export type TTS = { voice: string; rate: number };
export type Info = { username: string; password: string };

export type SignupCtx = {
  role: Role;
  setRole: (v: Role) => void;

  access: Access;
  setAccess: (p: Partial<Access>) => void;

  tts: TTS;
  setTts: (p: Partial<TTS>) => void;

  info: Info;
  setInfo: (p: Partial<Info>) => void;
};
