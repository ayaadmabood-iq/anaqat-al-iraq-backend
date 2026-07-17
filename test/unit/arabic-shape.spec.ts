import { containsArabic, shapeForRtl } from '@/modules/fingerprint/arabic-shape';

describe('containsArabic', () => {
  it('true for Arabic text', () => {
    expect(containsArabic('السلام عليكم')).toBe(true);
  });
  it('false for Latin', () => {
    expect(containsArabic('Hello world')).toBe(false);
    expect(containsArabic('')).toBe(false);
  });
  it('true for mixed text', () => {
    expect(containsArabic('Hello السلام')).toBe(true);
  });
});

describe('shapeForRtl', () => {
  it('returns ASCII strings unchanged', () => {
    expect(shapeForRtl('order QSD-1')).toBe('order QSD-1');
  });

  it('reshapes a simple Arabic word', () => {
    const out = shapeForRtl('مرحبا');
    // Presentation-Form-B glyphs replace the base letters.
    expect(out).not.toBe('مرحبا');
    expect(out.length).toBeGreaterThan(0);
  });

  it('produces a stable output for the same input', () => {
    const a = shapeForRtl('د. إياد محمد عبود');
    const b = shapeForRtl('د. إياد محمد عبود');
    expect(a).toBe(b);
  });

  it('handles Arabic + Latin mixed strings without throwing', () => {
    const out = shapeForRtl('د. إياد محمد <example@qasdiya.local>');
    expect(out.length).toBeGreaterThan(0);
    // The email address survives intact somewhere in the visual string.
    expect(out).toMatch(/example@qasdiya\.local|lacal\.aydsaq@elpmaxe/);
  });

  it('is safe on the empty string', () => {
    expect(shapeForRtl('')).toBe('');
  });
});
