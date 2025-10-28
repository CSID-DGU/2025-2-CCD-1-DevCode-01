import { css } from "styled-components";

const fontGenerator = (
  weight: number,
  size: string,
  // lineHeight: string,
  fontFamily?: string
) => css`
  font-weight: ${weight};
  font-size: ${size};

  font-family: ${fontFamily ? `${fontFamily}` : "Pretendard GOV Variable"};
`;

export const fonts = {
  //title
  title: fontGenerator(500, "64px"),

  // Regular
  regular32: fontGenerator(400, "32px"),
  regular17: fontGenerator(400, "17px"),

  // Medium
  medium32: fontGenerator(500, "32px"),
  medium24: fontGenerator(500, "24px"),

  // Bold
  bold32: fontGenerator(700, "32px"),
};
