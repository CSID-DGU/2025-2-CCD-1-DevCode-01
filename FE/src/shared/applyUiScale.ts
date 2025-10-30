const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const isFirefox = () => navigator.userAgent.toLowerCase().includes("firefox");

/**
 * UI 글로벌 배율 적용 (50% ~ 200%)
 * - Chromium/Safari: CSS zoom 사용 (여백/스크롤 안정적)
 * - Firefox: zoom 미지원 → 고정 래퍼 + transform(scale) fallback
 */

export function applyUiScale(pct: number): void {
  const pctClamped = clamp(pct, 100, 200);
  const scale = pctClamped / 100;

  const docEl = document.documentElement;
  const zoomRoot = document.getElementById("zoom-root");

  const ff = isFirefox();

  // Firefox용: transform 스케일을 쓰는 래퍼 사용
  if (ff) {
    // 1) Chromium에서 남아있을 수 있는 zoom 제거
    document.body.style.removeProperty("zoom");

    // 2) CSS 변수로 스케일 전달
    docEl.style.setProperty("--ui-scale", String(scale));

    // 3) 래퍼 클래스 토글
    zoomRoot?.classList.add("app-zoom");

    // 원복(100%)이면 깨끗하게 정리
    if (pctClamped === 100) {
      docEl.style.removeProperty("--ui-scale");
      zoomRoot?.classList.remove("app-zoom");
    }
    return;
  }

  // Chromium/Safari: zoom 사용(타입 안전하게 setProperty)
  if (pctClamped === 100) {
    // 원복
    document.body.style.removeProperty("zoom");
    docEl.style.removeProperty("--ui-scale");
    zoomRoot?.classList.remove("app-zoom");
  } else {
    document.body.style.setProperty("zoom", `${pctClamped}%`);
    // 혹시 이전에 Firefox fallback이 켜져 있었다면 해제
    docEl.style.removeProperty("--ui-scale");
    zoomRoot?.classList.remove("app-zoom");
  }
}
