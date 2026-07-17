import { parseUserAgent } from '@/modules/downloads/user-agent';

describe('parseUserAgent', () => {
  it.each<[string, { browser: string | null; os: string | null }]>([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      { browser: 'Chrome', os: 'Windows' },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      { browser: 'Safari', os: 'macOS' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 12; Pixel 6) Firefox/121.0',
      { browser: 'Firefox', os: 'Android' },
    ],
    ['curl/8.0', { browser: 'curl', os: null }],
    ['PostmanRuntime/7.36.0', { browser: 'Postman', os: null }],
    ['', { browser: null, os: null }],
  ])('parses %s', (ua, expected) => {
    expect(parseUserAgent(ua)).toEqual(expected);
  });
});
