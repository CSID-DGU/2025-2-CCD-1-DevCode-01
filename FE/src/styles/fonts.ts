import { css } from "styled-components";

//TODO: 플젝 디자인시스템 맞게 수정
const fontGenerator = (
  weight: number,
  size: string,
  // lineHeight: string,
  fontFamily?: string
) => css`
  font-weight: ${weight};
  font-size: ${size};

  font-family: ${fontFamily ? `${fontFamily}` : ""};
`;

export const fonts = {
  // 예시
  title_b_30: fontGenerator(600, "30px", "nad"),
};
