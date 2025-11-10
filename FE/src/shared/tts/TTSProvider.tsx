import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type VoicePref = "female" | "male" | "auto";
type TriggerMode = "focus" | "none";

export type RateLabel = "느림" | "보통" | "빠름";
export type VoiceLabel = "여성" | "남성";

const rateLabelToNumber = (label: RateLabel): number =>
  label === "느림" ? 0.85 : label === "빠름" ? 1.15 : 1.0;

const voiceLabelToPref = (label: VoiceLabel): Exclude<VoicePref, "auto"> =>
  label === "여성" ? "female" : "male";

export type TTSSettings = {
  enabled: boolean;
  rate: number;
  pitch: number;
  volume: number;
  lang: string;
  voicePref: VoicePref;
  trigger: TriggerMode;
};

type TTSContextValue = {
  settings: TTSSettings;
  setSettings: (next: Partial<TTSSettings>) => void;
  speak: (
    text: string,
    opts?: Partial<Pick<TTSSettings, "rate" | "pitch" | "volume" | "lang">>
  ) => void;
  cancel: () => void;
  getPreferredVoice: () => SpeechSynthesisVoice | null;

  applyOptions: (arg: {
    rate?: number;
    voiceId?: Exclude<VoicePref, "auto">;
  }) => void;

  applyLabels: (arg: { rate?: RateLabel; voice?: VoiceLabel }) => void;
};

export const TTSContext = createContext<TTSContextValue | null>(null);

const DEFAULT: TTSSettings = {
  enabled: true,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  lang: "ko-KR",
  voicePref: "auto",
  trigger: "focus",
};

const STORAGE_KEY = "tts_settings_v1";

const loadSettings = (): TTSSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
};

const saveSettings = (s: TTSSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
};

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<TTSSettings>(() =>
    loadSettings()
  );
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const readyRef = useRef(false);

  const setSettings = useCallback((next: Partial<TTSSettings>) => {
    setSettingsState((prev) => {
      const merged = { ...prev, ...next };
      saveSettings(merged);
      return merged;
    });
  }, []);

  // 브라우저에서 Voice 로드 대기 (Chrome은 비동기)
  useEffect(() => {
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      readyRef.current = true;
    };
    load();
    if (typeof window !== "undefined") {
      window.speechSynthesis.onvoiceschanged = load;
    }
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const applyOptions = useCallback(
    (arg: { rate?: number; voiceId?: Exclude<VoicePref, "auto"> }) => {
      const next: Partial<TTSSettings> = {};
      if (typeof arg.rate === "number") next.rate = arg.rate;
      if (arg.voiceId) next.voicePref = arg.voiceId; // "female" | "male"
      if (Object.keys(next).length) setSettings(next);
    },
    [setSettings]
  );

  const applyLabels = useCallback(
    (arg: { rate?: RateLabel; voice?: VoiceLabel }) => {
      const next: Partial<TTSSettings> = {};
      if (arg.rate) next.rate = rateLabelToNumber(arg.rate);
      if (arg.voice) next.voicePref = voiceLabelToPref(arg.voice);
      if (Object.keys(next).length) setSettings(next);
    },
    [setSettings]
  );

  const getPreferredVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices.length) return null;

    // 언어 우선 필터 (ko-KR)
    const candidates = voices.filter((v) =>
      (v.lang || "").toLowerCase().startsWith(settings.lang.toLowerCase())
    );

    // 성별 추정 (브라우저가 성별 정보를 주지 않으므로 이름 휴리스틱)
    const femaleHint =
      /(female|sora|yuna|nara|suh|woman|girl|wavenet-[a-z]*-f)/i;
    const maleHint = /(male|minsu|jun|man|boy|wavenet-[a-z]*-m)/i;

    const pickByPref = (pref: VoicePref) => {
      if (pref === "auto") return candidates[0] || null;
      const hint = pref === "female" ? femaleHint : maleHint;
      const hit = candidates.find((v) => hint.test(v.name));
      return hit || candidates[0] || null;
    };

    // 후보가 없으면 전체에서라도 하나
    const chosen = pickByPref(settings.voicePref) || voices[0] || null;
    return chosen;
  }, [settings.lang, settings.voicePref]);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (
      text: string,
      opts?: Partial<Pick<TTSSettings, "rate" | "pitch" | "volume" | "lang">>
    ) => {
      if (!settings.enabled) return;
      if (!text?.trim()) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;

      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      const voice = getPreferredVoice();
      if (voice) u.voice = voice;

      u.lang = opts?.lang ?? settings.lang;
      u.rate = clamp(opts?.rate ?? settings.rate, 0.5, 2.0);
      u.pitch = clamp(opts?.pitch ?? settings.pitch, 0.0, 2.0);
      u.volume = clamp(opts?.volume ?? settings.volume, 0.0, 1.0);

      // iOS/Safari는 사용자 제스처 이후에만 재생 가능 → 최초 클릭 후부터 정상 동작
      window.speechSynthesis.speak(u);
    },
    [
      getPreferredVoice,
      settings.enabled,
      settings.lang,
      settings.pitch,
      settings.rate,
      settings.volume,
    ]
  );

  const value = useMemo<TTSContextValue>(
    () => ({
      settings,
      setSettings,
      speak,
      cancel,
      getPreferredVoice,
      applyOptions,
      applyLabels,
    }),
    [
      settings,
      setSettings,
      speak,
      cancel,
      getPreferredVoice,
      applyOptions,
      applyLabels,
    ]
  );

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
