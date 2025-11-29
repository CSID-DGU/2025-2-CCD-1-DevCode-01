export {};

declare global {
  interface Window {
    MathJax?: {
      tex2mml: (latex: string) => string;
    };

    SRE?: {
      setupEngine: (opts: {
        locale: string;
        domain?: string;
        style?: string;
      }) => void;
      toSpeech: (mathml: string) => string;
    };
  }
}
