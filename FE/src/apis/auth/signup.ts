import { postNoResponse } from "@apis/instance";
import type { Access, Info, Role, TTS } from "src/features/signup/types";

export type SignupFlatRequest = {
  username: string;
  password: string;
  role: string;
  font: string;
  high_contrast: boolean;
  rate: string;
  voice: string;
};

const voiceToLabel = (voice: string): string => {
  if (voice === "male") return "남성";
  return "여성";
};

export const toSignupFlat = (
  role: Role,
  access: Access,
  tts: TTS,
  info: Info
): SignupFlatRequest => ({
  username: info.username,
  password: info.password,
  role,
  font: access.font,
  high_contrast: access.high_contrast,
  rate: tts.rate,
  voice: voiceToLabel(tts.voice),
});

export const signupApi = (payload: SignupFlatRequest): Promise<boolean> =>
  postNoResponse<SignupFlatRequest>("/auth/signup/", payload);
