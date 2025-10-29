export type Role = "student" | "helper" | null;
export type Access = { fontScale: number; contrast: "base" | "hc" };
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
