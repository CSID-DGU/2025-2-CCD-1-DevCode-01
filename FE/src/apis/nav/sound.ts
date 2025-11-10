import { patchNoResponse } from "@apis/instance";
import type { SoundRate, SoundVoice } from "@shared/a11y/soundOptions";

export type SoundOptionRequest = {
  rate: SoundRate; // "느림" | "보통" | "빠름"
  voice: SoundVoice; // "여성" | "남성"
};

export async function patchSoundOption(
  body: SoundOptionRequest
): Promise<boolean> {
  // 서버 라우트 명세에 맞춰 앞에 /api가 필요하면 "/api/auth/..."로 수정
  return patchNoResponse<SoundOptionRequest>("/auth/soundoption/", body);
}
