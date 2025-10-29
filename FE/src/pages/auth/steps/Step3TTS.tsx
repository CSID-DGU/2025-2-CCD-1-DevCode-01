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

  // 1. 상단 버튼/제목 세팅
  useEffect(() => {
    setControls({
      title: "화면 읽기 속도와 목소리를 설정해주세요",
      btn: "다음",
      onSubmit: () => navigate("/signup/4"),
      submitDisabled: false,
    });
  }, [navigate, setControls]);

  // 2. 기본값 세팅
  useEffect(() => {
    const patch: Partial<TTS> = {};
    if (!tts.voice) patch.voice = "female";
    if (typeof tts.rate !== "number") patch.rate = 1.0;
    if (Object.keys(patch).length) setTts(patch);
  }, [tts.voice, tts.rate, setTts]);

  // 3. 현재 선택값 계산
  const voiceId = useMemo<VoiceId>(() => {
    const found = VOICES.find((v) => v.id === tts.voice)?.id;
    return (found ?? "female") as VoiceId;
  }, [tts.voice]);

  const speedKey = useMemo<SpeedKey>(
    () => rateToSpeedKey(tts.rate ?? 1.0),
    [tts.rate]
  );

  // 4. 단일 파일 + playbackRate 방식
  // 파일은 /public/audio/tts/<voiceId>.mp3 하나씩만 있으면 됨.
  const playVoice = (v: VoiceId, rate: number) => {
    const url = `/audio/tts/${v}.mp3`;

    // 재생 중지 및 교체
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const a = new Audio(url);
    a.playbackRate = rate;

    // 피치 유지 (속도 변경 시 음정 왜곡 방지)
    a.preservesPitch = true;
    // @ts-expect-error vendor prop
    a.webkitPreservesPitch = true;

    audioRef.current = a;
    a.currentTime = 0;
    void a.play().catch((e) => {
      if (import.meta.env.DEV) console.warn("Audio play failed:", e, url);
    });
  };

  const onPickRate = (key: SpeedKey) => {
    const rate = SPEED.find((s) => s.key === key)?.rate ?? 1.0;
    setTts({ rate });
    playVoice(voiceId, rate);
  };

  const onPickVoice = (id: VoiceId) => {
    setTts({ voice: id });
    playVoice(id, tts.rate ?? 1.0);
  };

  return (
    <Wrap>
      <Cols>
        {/* 속도 */}
        <Group>
          <Title>속도</Title>
          <Options>
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
        <Group>
          <Title>목소리</Title>
          <Options>
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
`;
const Group = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const Title = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
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
`;
const Label = styled.span`
  font-size: 1rem;
`;
