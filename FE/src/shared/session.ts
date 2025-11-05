import { applyUiScale } from "@shared/applyUiScale";

export const LS_KEYS = {
  access: "access",
  refresh: "refresh",
  role: "role",
  font: "font",
  high_contrast: "high_contrast",
  username: "username",
} as const;

type SaveSessionParams = {
  access: string;
  refresh: string;
  role: string;
  font: number;
  high_contrast: boolean;
  username: string;
};

export function saveSessionFromLogin(p: SaveSessionParams) {
  localStorage.setItem(LS_KEYS.access, p.access);
  localStorage.setItem(LS_KEYS.refresh, p.refresh);
  localStorage.setItem(LS_KEYS.role, p.role);
  localStorage.setItem(LS_KEYS.font, String(p.font));
  localStorage.setItem(LS_KEYS.high_contrast, String(p.high_contrast));
  localStorage.setItem(LS_KEYS.username, p.username);

  applyUiScale(p.font);

  const root = document.documentElement;
  const isHcOn = root.classList.contains("hc");
  if (p.high_contrast && !isHcOn) root.classList.add("hc");
  if (!p.high_contrast && isHcOn) root.classList.remove("hc");
}

export const getRole = () => localStorage.getItem(LS_KEYS.role);
export const getAccessToken = () => localStorage.getItem(LS_KEYS.access);
export const getFont = () => Number(localStorage.getItem(LS_KEYS.font) ?? 125);
export const getHighContrast = () =>
  localStorage.getItem(LS_KEYS.high_contrast) === "true";

export function clearSession() {
  Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
  applyUiScale(125);
  document.documentElement.classList.remove("hc");
}
