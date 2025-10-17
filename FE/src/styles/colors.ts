export const colors = {
  base: {
    blue: "#1565C0",
    grayL: "#EDEDED",
    grayD: "#58616A",
    black: "#000000",
    white: "#FFFFFF",
  },

  hc: {
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
  blue: "yellow",
  grayL: "grayX",
  grayD: "beige",
  black: "white",
  white: "black",
};
