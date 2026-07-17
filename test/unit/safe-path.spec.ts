import { safeJoin, safeFilename } from '@/modules/common/safe-path';
import { BadRequestException } from '@nestjs/common';

describe('safeJoin', () => {
  const root = '/tmp/qasdiya-test-root';

  it.each(['', '..', '../etc/passwd', '/etc/passwd', 'ok/../../x', 'x\\y', 'null\0byte'])(
    'rejects %j',
    (p) => {
      expect(() => safeJoin(root, p as string)).toThrow(BadRequestException);
    },
  );

  it('accepts a normal relative path', () => {
    const out = safeJoin(root, 'book/master.pdf');
    expect(out).toBe(`${root}/book/master.pdf`);
  });
});

describe('safeFilename', () => {
  it('strips path separators and control chars', () => {
    expect(safeFilename('a/b\\c\nd')).toBe('abcd');
  });
  it('falls back on empty input', () => {
    expect(safeFilename('')).toBe('download.pdf');
    expect(safeFilename('   ')).toBe('download.pdf');
  });
  it('caps length', () => {
    expect(safeFilename('x'.repeat(500)).length).toBeLessThanOrEqual(128);
  });
});
