import { postNoResponse } from "@apis/instance";
import type { Access, Info, Role, TTS } from "src/features/signup/types";

export type SignupFlatRequest = {
  username: string;
  password: string;
  role: string;
  font: number;
  high_contrast: boolean;
  rate: number;
  voice: string;
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
  voice: tts.voice,
});

export const signupApi = (payload: SignupFlatRequest): Promise<boolean> =>
  postNoResponse<SignupFlatRequest>("/api/auth/signup/", payload);
