//전역 상태 관리자

export type Mode = "base" | "hc";

export const getMode = (): Mode => {
  const raw = localStorage.getItem("high_contrast");
  return raw === "true" ? "hc" : "base";
};

export const setMode = (mode: Mode) => {
  localStorage.setItem("high_contrast", mode === "hc" ? "true" : "false");
  applyMode(mode);
  window.dispatchEvent(new CustomEvent("modechange", { detail: mode }));
};

export const toggleMode = () => {
  const next = getMode() === "base" ? "hc" : "base";
  setMode(next);
};

export const applyMode = (mode: Mode) => {
  document.documentElement.classList.toggle("hc", mode === "hc");
};

// 앱 시작 시 저장된 모드 반영
export const initMode = () => applyMode(getMode());

// 다른 탭에서도 모드 동기화
window.addEventListener("storage", (e) => {
  if (e.key === "mode" && e.newValue) applyMode(e.newValue as Mode);
});
