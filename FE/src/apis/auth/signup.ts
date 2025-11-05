import { postNoResponse } from "@apis/instance";
import type { Access, Info, Role, TTS } from "src/features/signup/types";

export type SignupFlatRequest = {
  username: string;
  password: string;
  role: string;
  font: number;
  high_contrast: boolean;
  rate: string;
  voice: string;
};

const rateToLabel = (rate: number): string => {
  if (rate <= 0.95) return "느림";
  if (rate > 1.1) return "빠름";
  return "보통";
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
  rate: rateToLabel(tts.rate),
  voice: voiceToLabel(tts.voice),
});

export const signupApi = (payload: SignupFlatRequest): Promise<boolean> =>
  postNoResponse<SignupFlatRequest>("/api/auth/signup/", payload);
