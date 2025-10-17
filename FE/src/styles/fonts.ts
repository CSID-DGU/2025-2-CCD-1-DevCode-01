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
  // Regular
  regular_32: fontGenerator(400, "32px"),

  // Medium
  medium_32: fontGenerator(500, "32px"),

  // Bold
  bold_32: fontGenerator(700, "32px"),
};
