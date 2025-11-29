export type OcrSegmentType = "text" | "code" | "math";

export type OcrSegment =
  | { type: "text"; content: string }
  | { type: "code"; content: string }
  | { type: "math"; content: string };
