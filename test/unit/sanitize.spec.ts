import { sanitizeCmsValue } from '@/modules/content/sanitize';

describe('sanitizeCmsValue', () => {
  it('strips <script>', () => {
    const dirty = '<p>hi</p><script>alert(1)</script>';
    const out = sanitizeCmsValue(dirty) as string;
    expect(out).not.toContain('script');
    expect(out).toContain('<p>hi</p>');
  });

  it('strips inline event handlers', () => {
    const dirty = '<a href="/" onclick="steal()">x</a>';
    const clean = sanitizeCmsValue(dirty) as string;
    expect(clean).not.toContain('onclick');
    expect(clean).toContain('href="/"');
  });

  it('rewrites <a> with safe rel/target', () => {
    const dirty = '<a href="https://example.com">x</a>';
    const clean = sanitizeCmsValue(dirty) as string;
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
    expect(clean).toContain('target="_blank"');
  });

  it('strips javascript: URLs from <a>', () => {
    const dirty = '<a href="javascript:alert(1)">x</a>';
    const clean = sanitizeCmsValue(dirty) as string;
    expect(clean).not.toContain('javascript:');
  });

  it('recurses into arrays and objects', () => {
    const input = {
      title: '<script>x</script>ok',
      list: ['<img onerror="1" src=x>hey', 'safe'],
      nested: { body: '<p><b>bold</b></p>' },
    };
    const out = sanitizeCmsValue(input) as {
      title: string;
      list: string[];
      nested: { body: string };
    };
    expect(out.title).toBe('ok');
    expect(out.list[0]).not.toContain('onerror');
    expect(out.list[1]).toBe('safe');
    expect(out.nested.body).toContain('<p>');
    expect(out.nested.body).toContain('<b>bold</b>');
  });

  it('preserves non-string primitives', () => {
    expect(sanitizeCmsValue(42)).toBe(42);
    expect(sanitizeCmsValue(null)).toBe(null);
    expect(sanitizeCmsValue(true)).toBe(true);
  });
});
