/**
 * Arabic shaping + bidi reordering for pdf-lib.
 *
 * pdf-lib draws whatever glyphs the font provides at whatever code points the
 * string carries, in the string's byte order. Arabic in Unicode is stored in
 * *logical* order with non-connected base letters — a naïve draw shows
 * disconnected glyphs printed left-to-right. To render properly we:
 *
 *   1. Reshape the logical string so joining forms replace base letters
 *      (`convertArabic` from `arabic-reshaper` returns Presentation-Form-B
 *      code points).
 *   2. Ask `bidi-js` for embedding levels and the reorder segments needed to
 *      convert logical → visual order.
 *   3. Apply the reorder so the visual string is what pdf-lib should draw
 *      left-to-right.
 *
 * The output is safe to pass to `page.drawText(...)` with an embedded Arabic
 * font like Amiri.
 */
import reshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

const ARABIC_RANGE = /[؀-ۿﭐ-﷿ﹰ-﻿]/;

export function containsArabic(s: string): boolean {
  return typeof s === 'string' && ARABIC_RANGE.test(s);
}

/**
 * Shape + bidi-reorder a mixed Arabic/Latin/digits string for RTL rendering.
 * ASCII-only strings are returned unchanged.
 */
export function shapeForRtl(input: string): string {
  if (!input) return input;
  if (!containsArabic(input)) return input;

  const shaped = reshaper.convertArabic(input);
  const levels = bidi.getEmbeddingLevels(shaped, 'auto');
  const reorderSegments = bidi.getReorderSegments(shaped, levels);
  if (!reorderSegments || reorderSegments.length === 0) return shaped;

  const chars = Array.from(shaped);
  for (const seg of reorderSegments) {
    const [start, end] = seg;
    const slice = chars.slice(start, end + 1);
    slice.reverse();
    for (let i = 0; i < slice.length; i++) chars[start + i] = slice[i];
  }
  return chars.join('');
}
