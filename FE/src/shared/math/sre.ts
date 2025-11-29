let sreInitialized = false;

function ensureSRE() {
  const sre = window.SRE;

  if (!sre) {
    console.warn(
      "[SRE] SRE 전역 객체가 없습니다. sre_browser.js 로드 여부 확인 필요"
    );
    return null;
  }

  if (!sreInitialized) {
    try {
      sre.setupEngine({
        locale: "en",
        domain: "mathspeak",
        style: "default",
      });
      sreInitialized = true;
    } catch (e) {
      console.error("[SRE] setupEngine 실패:", e);
    }
  }

  return sre;
}

/** MathML -> 영어 speech 문자열 */
export function mathmlToSpeech(mathml: string): string {
  const sre = ensureSRE();
  if (!sre) {
    return mathml;
  }

  try {
    return sre.toSpeech(mathml);
  } catch (e) {
    console.error("[SRE] toSpeech 실패:", e);
    return mathml;
  }
}
