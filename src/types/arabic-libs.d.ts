declare module 'arabic-reshaper' {
  export function convertArabic(input: string): string;
  export function convertArabicBack(input: string): string;
  const _default: {
    convertArabic(input: string): string;
    convertArabicBack(input: string): string;
  };
  export default _default;
}

declare module 'bidi-js' {
  interface BidiApi {
    getEmbeddingLevels(
      text: string,
      dir?: 'ltr' | 'rtl' | 'auto',
    ): {
      paragraphs: Array<{ start: number; end: number; level: number }>;
      levels: Uint8Array;
    };
    getReorderSegments(
      text: string,
      levels: unknown,
    ): Array<[number, number]>;
  }
  const factory: () => BidiApi;
  export default factory;
}
