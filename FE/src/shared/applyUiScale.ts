const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const isFirefox = () => navigator.userAgent.toLowerCase().includes("firefox");

type CSSWithZoom = CSSStyleDeclaration & { zoom: string };

export function applyUiScale(pct: number): void {
  const pctClamped = clamp(pct, 100, 400);
  const scale = pctClamped / 100;

  const zoomRoot = document.getElementById("zoom-root");
  const docEl = document.documentElement;
  if (!zoomRoot) return;

  docEl.style.setProperty("--ui-scale", String(scale));

  const bodyStyle = document.body.style as CSSWithZoom;

  if (isFirefox()) {
    zoomRoot.style.transformOrigin = "top left";
    zoomRoot.style.transform = `scale(${scale})`;
    zoomRoot.style.width = `${100 / scale}%`;
    zoomRoot.style.minHeight = `${100 / scale}dvh`;

    bodyStyle.zoom = "";
  } else {
    (zoomRoot.style as CSSWithZoom).zoom = `${pctClamped}%`;

    bodyStyle.zoom = "";
  }
}
