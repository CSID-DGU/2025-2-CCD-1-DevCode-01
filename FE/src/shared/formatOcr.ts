// src/shared/formatOcr.ts (수정)
export function formatOcr(raw: string, bullet = "•"): string {
  if (!raw) return "";

  let s = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[\uF0A7\uF0FC\uF0D8]/g, bullet)
    .replace(/[●◇◆▪▫►▶▷❖]/g, bullet);

  s = s.replace(/^\s*([•\-–—])\s*/gm, `${bullet} `);

  const PARA = "<<<P>>>";
  s = s.replace(/\n{2,}/g, PARA);

  s = s.replace(new RegExp(PARA, "g"), "\n\n");
  s = s
    .replace(/ +([,.;:?!])/g, "$1")
    .replace(/\( +/g, "(") // '('은 escape 필요 (특수의미), 그대로 둠
    .replace(/ +\)/g, ")") // ')'는 escape 불필요하지만 두어도 안전
    .replace(/ {2,}/g, " ")
    .trim();

  return s;
}
