import { useContrastMode } from "@shared/useContrastMode";

export const useContrastImage = (basePath: string) => {
  const { isHC } = useContrastMode();

  // 파일명 규칙: base는 .png, 고대비는 -hc.png
  const src = isHC ? `${basePath}-hc.png` : `${basePath}.png`;

  return src;
};
