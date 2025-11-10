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
  title2: fontGenerator(700, "36px"),

  // Regular
  regular32: fontGenerator(400, "32px"),
  regular24: fontGenerator(400, "24px"),
  regular20: fontGenerator(400, "20px"),
  regular17: fontGenerator(400, "17px"),

  // Medium
  medium32: fontGenerator(500, "32px"),
  medium26: fontGenerator(500, "26px"),
  medium24: fontGenerator(500, "24px"),

  // Bold
  bold32: fontGenerator(700, "32px"),
  bold26: fontGenerator(700, "26px"),
  bold20: fontGenerator(700, "20px"),
};
