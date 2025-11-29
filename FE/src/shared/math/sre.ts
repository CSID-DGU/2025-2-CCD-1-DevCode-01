type SreEngine = {
  setupEngine?: (options: Record<string, unknown>) => void;
  toSpeech?: (mathml: string) => string;
};

function getSreFromWindow(): SreEngine | null {
  const w = window as unknown as { SRE?: SreEngine; sre?: SreEngine };
  return w.SRE ?? w.sre ?? null;
}

let sreInitialized = false;

async function waitForSre(
  maxWaitMs = 5000,
  intervalMs = 100
): Promise<SreEngine | null> {
  const start = Date.now();

  const existing = getSreFromWindow();
  if (existing) return existing;

  return new Promise((resolve) => {
    const tick = () => {
      const sre = getSreFromWindow();

      if (sre) {
        resolve(sre);
        return;
      }

      if (Date.now() - start >= maxWaitMs) {
        console.warn("[waitForSre] SRE를 지정 시간 안에 찾지 못했습니다.");
        resolve(null);
        return;
      }

      setTimeout(tick, intervalMs);
    };

    tick();
  });
}

// MathML → 영어 음성 문자열

export async function mathmlToSpeech(mathml: string): Promise<string> {
  const sre = await waitForSre();

  console.log("[mathmlToSpeech] SRE after wait:", sre);

  if (!sre || typeof sre.toSpeech !== "function") {
    console.warn(
      "[mathmlToSpeech] SRE 엔진을 찾을 수 없습니다. MathML 그대로 사용"
    );
    return mathml;
  }

  if (!sreInitialized && typeof sre.setupEngine === "function") {
    try {
      sre.setupEngine({
        locale: "en",
        domain: "mathspeak",
        style: "default",
      });
      sreInitialized = true;
    } catch (e) {
      console.error("[mathmlToSpeech] SRE setupEngine 실패:", e);
    }
  }

  try {
    return sre.toSpeech!(mathml);
  } catch (e) {
    console.error("[mathmlToSpeech] SRE toSpeech 실패:", e);
    return mathml;
  }
}
