import { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useSignup } from "src/features/signup/useSignup";
import {
  SPEED,
  VOICES,
  type SpeedKey,
  type VoiceId,
  rateToSpeedKey,
  speedKeyToRate,
} from "src/config/ttsConfig";
import type { TTS } from "src/features/signup/types";

type ShellContext = {
  setControls: (
    c: Partial<{
      title: string;
      btn: string;
      onSubmit: () => void;
      submitDisabled: boolean;
    }>
  ) => void;
};

export default function Step3TTS() {
  const navigate = useNavigate();
  const { tts, setTts } = useSignup();
  const { setControls } = useOutletContext<ShellContext>();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setControls({
      title: "화면 읽기 속도와 목소리를 설정해주세요",
      btn: "다음",
      onSubmit: () => navigate("/signup/4"),
      submitDisabled: false,
    });
  }, [navigate, setControls]);

  useEffect(() => {
    const patch: Partial<TTS> = {};
    if (!tts.voice) patch.voice = "female";
    if (typeof tts.rate !== "string") patch.rate = "1.0";
    if (Object.keys(patch).length) setTts(patch);
  }, [tts.voice, tts.rate, setTts]);

  const voiceId = useMemo<VoiceId>(() => {
    const found = VOICES.find((v) => v.id === tts.voice)?.id;
    return (found ?? "female") as VoiceId;
  }, [tts.voice]);

  const speedKey = useMemo<SpeedKey>(
    () => rateToSpeedKey(tts.rate ?? "1.0"),
    [tts.rate]
  );

  const playVoice = (v: VoiceId, rateStr: string) => {
    const url = `/audio/tts/${v}.mp3`; // /public/audio/tts/(female|male).mp3으로 세팅 필요

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    const a = new Audio(url);
    const pr = Number.isFinite(parseFloat(rateStr)) ? parseFloat(rateStr) : 1.0;
    a.playbackRate = pr;

    a.preservesPitch = true;
    // @ts-expect-error - 사파리/크롬 구버전용
    a.webkitPreservesPitch = true;

    audioRef.current = a;
    a.currentTime = 0;
    void a.play().catch((e) => {
      if (import.meta.env.DEV) console.warn("Audio play failed:", e, url);
    });
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const onPickRate = (key: SpeedKey) => {
    const rateStr = String(speedKeyToRate(key));
    setTts({ rate: rateStr });
    playVoice(voiceId, rateStr);
  };

  const onPickVoice = (id: VoiceId) => {
    setTts({ voice: id });
    playVoice(id, tts.rate ?? "1.0");
  };

  return (
    <Wrap role="region" aria-label="음성 설정">
      <Cols>
        {/* 속도 */}
        <Group aria-labelledby="tts-speed-title">
          <Title id="tts-speed-title">속도</Title>
          <Options role="radiogroup" aria-label="읽기 속도 선택">
            {SPEED.map((opt) => (
              <Row key={opt.key} htmlFor={`rate-${opt.key}`}>
                <Radio
                  id={`rate-${opt.key}`}
                  name="ttsRate"
                  value={opt.key}
                  checked={speedKey === opt.key}
                  onChange={() => onPickRate(opt.key)}
                />
                <Label>{opt.label}</Label>
              </Row>
            ))}
          </Options>
        </Group>

        {/* 목소리 */}
        <Group aria-labelledby="tts-voice-title">
          <Title id="tts-voice-title">목소리</Title>
          <Options role="radiogroup" aria-label="목소리 선택">
            {VOICES.map((opt) => (
              <Row key={opt.id} htmlFor={`voice-${opt.id}`}>
                <Radio
                  id={`voice-${opt.id}`}
                  name="ttsVoice"
                  value={opt.id}
                  checked={voiceId === opt.id}
                  onChange={() => onPickVoice(opt.id)}
                />
                <Label>{opt.label}</Label>
              </Row>
            ))}
          </Options>
        </Group>
      </Cols>
    </Wrap>
  );
}

/* ---------------- styled ---------------- */
const Wrap = styled.div`
  max-width: 920px;
  margin: 0 auto;
  padding-top: 48px;
`;
const Cols = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;
const Group = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const Title = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--c-black);
`;
const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;
const Row = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
`;
const Radio = styled.input.attrs({ type: "radio" })`
  appearance: auto;
  -webkit-appearance: auto;
  width: 20px;
  height: 20px;
  accent-color: var(--c-radio-accent, var(--c-blue));
  cursor: pointer;

  &:focus-visible {
    outline: 5px solid var(--c-blue);
    outline-offset: 2px;

    html.hc & {
      outline-color: var(--c-yellowM);
    }
  }
`;
const Label = styled.span`
  font-size: 1rem;
  color: var(--c-black);
`;
