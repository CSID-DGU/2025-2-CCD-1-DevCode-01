import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import Portal from "@shared/ui/portal";
import { fonts } from "@styles/fonts";
import { patchSoundOption } from "@apis/nav/sound";
import {
  readRateFromLS,
  readVoiceFromLS,
  writeSoundToLS,
  SOUND_RATES,
  SOUND_VOICES,
  type SoundRate,
  type SoundVoice,
} from "@shared/a11y/soundOptions";
import { lockBodyScroll, unlockBodyScroll } from "@shared/ui/scrollLock";
import { TTSContext } from "@shared/tts/TTSProvider";

type HTMLAudioWithPitch = HTMLAudioElement & {
  preservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApplied?: (v: { rate: SoundRate; voice: SoundVoice }) => void;
};

const rateToPlayback: Record<SoundRate, number> = {
  느림: 0.85,
  보통: 1.0,
  빠름: 1.15,
};
const voiceToFile: Record<SoundVoice, string> = {
  여성: "/audio/tts/female.mp3",
  남성: "/audio/tts/male.mp3",
};

export default function SoundModal({ open, onClose, onApplied }: Props) {
  const tts = useContext(TTSContext);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioWithPitch | null>(null);

  const [rate, setRate] = useState<SoundRate>(() => readRateFromLS());
  const [voice, setVoice] = useState<SoundVoice>(() => readVoiceFromLS());

  const playback = useMemo(() => rateToPlayback[rate], [rate]);
  const file = useMemo(() => voiceToFile[voice], [voice]);

  /* ----- 모달 라이프사이클 ----- */
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open]);

  const stopAudio = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.src = "";
    audioRef.current = null;
  };

  const handleCancel = useCallback(() => {
    stopAudio();
    onClose();
  }, [onClose]);

  const onOverlayMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const card = cardRef.current;
    if (!card) return;
    if (!card.contains(e.target as Node)) handleCancel();
  };

  useEffect(() => () => stopAudio(), []);

  /* ----- 미리듣기 ----- */
  const play = () => {
    stopAudio();
    const a = new Audio(file) as HTMLAudioWithPitch;
    a.playbackRate = playback;
    a.preservesPitch = true;
    a.webkitPreservesPitch = true;
    audioRef.current = a;
    a.currentTime = 0;
    void a.play();
  };

  /* ----- 저장(PATCH + LS + TTSContext 반영) ----- */
  const handleSave = async () => {
    const ok = await patchSoundOption({ rate, voice });
    if (!ok) {
      alert("음성 설정 저장에 실패했습니다.");
      return;
    }
    writeSoundToLS(rate, voice);

    tts?.applyOptions?.({
      rate: playback, // number
      voiceId: voice === "여성" ? "female" : "male",
    });

    stopAudio();
    onApplied?.({ rate, voice });
    onClose();
  };

  if (!open) return null;

  return (
    <Portal>
      <Overlay role="presentation" onMouseDown={onOverlayMouseDown}>
        <Card
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sound-title"
          aria-describedby="sound-desc"
          tabIndex={-1}
        >
          <Header>
            <h2 id="sound-title">음성 설정</h2>
            <CloseBtn aria-label="닫기" title="닫기" onClick={handleCancel}>
              ×
            </CloseBtn>
          </Header>

          <Desc id="sound-desc">
            읽기 속도와 목소리를 선택하고 미리듣기로 확인하세요.
          </Desc>

          <Section>
            <SecTitle>속도</SecTitle>
            <Options role="radiogroup" aria-label="읽기 속도 선택">
              {SOUND_RATES.map((label) => (
                <Row key={label}>
                  <Radio
                    id={`rate-${label}`}
                    name="ttsRate"
                    value={label}
                    checked={rate === label}
                    onChange={() => setRate(label)}
                  />
                  <label htmlFor={`rate-${label}`}>{label}</label>
                </Row>
              ))}
            </Options>
          </Section>

          <Section>
            <SecTitle>목소리</SecTitle>
            <Options role="radiogroup" aria-label="목소리 선택">
              {SOUND_VOICES.map((label) => (
                <Row key={label}>
                  <Radio
                    id={`voice-${label}`}
                    name="ttsVoice"
                    value={label}
                    checked={voice === label}
                    onChange={() => setVoice(label)}
                  />
                  <label htmlFor={`voice-${label}`}>{label}</label>
                </Row>
              ))}
            </Options>
          </Section>

          <PreviewBar>
            <button
              type="button"
              onClick={play}
              aria-label="미리듣기 재생"
              title="미리듣기 재생"
            >
              ▶︎ 미리듣기
            </button>
            <button
              type="button"
              onClick={stopAudio}
              aria-label="정지"
              title="정지"
            >
              ■ 정지
            </button>
          </PreviewBar>

          <Footer>
            <Btn type="button" data-variant="ghost" onClick={handleCancel}>
              취소
            </Btn>
            <Btn type="button" onClick={handleSave}>
              적용하기
            </Btn>
          </Footer>
        </Card>
      </Overlay>
    </Portal>
  );
}

/* ---------- styled (A11yModal과 유사) ---------- */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: clamp(12px, 4vh, 24px);
  touch-action: none;
`;
const Card = styled.div`
  width: min(720px, 100%);
  max-width: calc(100vw - 32px);
  max-height: min(88vh, 100dvh - 48px);
  overflow: auto;
  border-radius: 20px;
  background: var(--c-white);
  color: var(--c-black);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  padding: 24px 28px 20px;
  border: 1px solid var(--c-black);
  &:focus-within {
    outline: 2px solid var(--c-blue);
    outline-offset: 2px;
  }
`;
const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  h2 {
    ${fonts.bold32};
    margin: 0;
  }
`;
const CloseBtn = styled.button`
  all: unset;
  cursor: pointer;
  ${fonts.bold26};
  line-height: 1;
  padding: 0 6px;
  &:hover {
    transform: scale(1.1);
  }
`;
const Desc = styled.p`
  ${fonts.regular17};
  margin: 0 0 14px;
  color: var(--c-grayD);
`;
const Section = styled.section`
  border: 1px solid var(--c-grayD);
  border-radius: 16px;
  padding: 16px;
  margin-top: 14px;
  background: #fff;
`;
const SecTitle = styled.h3`
  ${fonts.bold20};
  margin: 0 0 12px;
  color: black;
`;
const Options = styled.div`
  display: flex;
  gap: 12px;
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  ${fonts.medium24}
  color: black;
`;
const Radio = styled.input.attrs({ type: "radio" })`
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--c-yellowM);
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;
const PreviewBar = styled.div`
  margin-top: 14px;
  display: flex;
  gap: 8px;
  button {
    ${fonts.medium24};
    height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    cursor: pointer;
    border: 1px solid var(--c-blue);
    background: transparent;
    color: var(--c-blue);
  }
`;
const Footer = styled.div`
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;
const Btn = styled.button`
  ${fonts.medium24};
  height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  cursor: pointer;
  border: none;
  background: var(--c-blue);
  color: var(--c-white);
  &[data-variant="ghost"] {
    background: transparent;
    color: var(--c-blue);
    border: 2px solid var(--c-blue);
  }
  &:hover {
    opacity: 0.9;
  }
`;
