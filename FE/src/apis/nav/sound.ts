import { patchNoResponse } from "@apis/instance";
import type { SoundRate, SoundVoice } from "@shared/a11y/soundOptions";

export type SoundOptionRequest = {
  rate: SoundRate;
  voice: SoundVoice;
};

export async function patchSoundOption(
  body: SoundOptionRequest
): Promise<boolean> {
  return patchNoResponse<SoundOptionRequest>("/auth/soundoption/", body);
}
