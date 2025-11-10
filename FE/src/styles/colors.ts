export const colors = {
  base: {
    blue: "#1565C0",
    blueL: "#AED4FF",
    blueM: "#006CE6",
    blueD: "#00369B",
    grayL: "#EDEDED",
    grayD: "#58616A",
    black: "#000000",
    white: "#FFFFFF",
  },

  hc: {
    yellowL: "#FFF6BF",
    yellowM: "#FFD000",
    yellowD: "#CC9A00",
    yellow: "#FFEE90",
    grayX: "#323232",
    beige: "#EAE6E0",
    white: "#FFFFFF",
    black: "#000000",
  },
} as const;

export const contrastMap: Record<
  keyof typeof colors.base,
  keyof typeof colors.hc
> = {
  blueL: "yellowL",
  blueM: "yellowM",
  blueD: "yellowD",
  blue: "yellow",
  grayL: "grayX",
  grayD: "beige",
  black: "white",
  white: "black",
};
