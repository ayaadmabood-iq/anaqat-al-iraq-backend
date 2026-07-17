/**
 * Minimal user-agent parser — good enough for the download log (IRPB file 4
 * §6). Deliberately dependency-free so we do not pull `ua-parser-js` for one
 * cosmetic column. Returns null when the string is missing or unrecognised.
 */

export interface UaSummary {
  browser: string | null;
  os: string | null;
}

export function parseUserAgent(ua: string | null | undefined): UaSummary {
  if (!ua) return { browser: null, os: null };
  const s = ua.slice(0, 500);

  // Browser (order matters — Edg/OPR/Chrome overlap).
  let browser: string | null = null;
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/Firefox\//.test(s)) browser = 'Firefox';
  else if (/Chrome\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s)) browser = 'Safari';
  else if (/curl\//.test(s)) browser = 'curl';
  else if (/PostmanRuntime/.test(s)) browser = 'Postman';

  let os: string | null = null;
  if (/Windows NT/.test(s)) os = 'Windows';
  else if (/Android/.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS';
  else if (/Mac OS X/.test(s)) os = 'macOS';
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if (/Linux/.test(s)) os = 'Linux';

  return { browser, os };
}
