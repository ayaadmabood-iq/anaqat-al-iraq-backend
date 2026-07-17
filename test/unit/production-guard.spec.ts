import { evaluateProductionGuards } from '@/config/production-guard';

const okEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(48),
  COPY_SIGNING_KEY: 'a'.repeat(64),
  DOWNLOAD_URL_SECRET: 'z'.repeat(48),
  DB_PASSWORD: 'strong-secret',
  REDIS_URL: 'redis://localhost:6379/0',
  CORS_ORIGIN: 'https://qasdiya.example',
  MAIL_DRIVER: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  MAIL_FROM: 'no-reply@qasdiya.example',
});

describe('evaluateProductionGuards', () => {
  it('passes when every requirement is set', () => {
    const r = evaluateProductionGuards(okEnv());
    if (!r.ok) console.error(r.reasons);
    expect(r.ok).toBe(true);
  });

  it('is a no-op outside production', () => {
    expect(evaluateProductionGuards({ NODE_ENV: 'development' }).ok).toBe(true);
    expect(evaluateProductionGuards({}).ok).toBe(true);
  });

  it.each([
    ['JWT_SECRET', 'signs every access token'],
    ['COPY_SIGNING_KEY', 'signs every issued personal copy'],
    ['DOWNLOAD_URL_SECRET', 'signs short-TTL download URLs'],
    ['DB_PASSWORD', 'authenticates the app to PostgreSQL'],
    ['REDIS_URL', 'shares rate-limit counters'],
    ['MAIL_DRIVER', 'must be "smtp"'],
    ['SMTP_HOST', 'SMTP hostname'],
    ['SMTP_USER', 'SMTP username'],
    ['SMTP_PASS', 'SMTP password'],
    ['MAIL_FROM', 'From: header'],
  ])('refuses when %s is missing', (name, why) => {
    const env = okEnv();
    delete env[name];
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((rr) => rr.includes(name) && rr.includes(why))).toBe(true);
  });

  it('accepts COPY_SIGNING_KEY_FILE in lieu of COPY_SIGNING_KEY', () => {
    const env = okEnv();
    delete env.COPY_SIGNING_KEY;
    env.COPY_SIGNING_KEY_FILE = '/etc/qasdiya/copy.key';
    const r = evaluateProductionGuards(env);
    if (!r.ok) console.error(r.reasons);
    expect(r.ok).toBe(true);
  });

  it('refuses CORS_ORIGIN=*', () => {
    const env = okEnv();
    env.CORS_ORIGIN = '*';
    expect(evaluateProductionGuards(env).ok).toBe(false);
  });

  it('refuses CORS_ORIGIN empty', () => {
    const env = okEnv();
    env.CORS_ORIGIN = '';
    expect(evaluateProductionGuards(env).ok).toBe(false);
  });

  it('refuses a short JWT_SECRET', () => {
    const env = okEnv();
    env.JWT_SECRET = 'short';
    expect(evaluateProductionGuards(env).ok).toBe(false);
  });

  it('refuses a short DOWNLOAD_URL_SECRET', () => {
    const env = okEnv();
    env.DOWNLOAD_URL_SECRET = 'short';
    expect(evaluateProductionGuards(env).ok).toBe(false);
  });

  it('refuses DOWNLOAD_URL_SECRET equal to JWT_SECRET', () => {
    const env = okEnv();
    env.DOWNLOAD_URL_SECRET = env.JWT_SECRET;
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((rr) => rr.includes('must differ from JWT_SECRET'))).toBe(true);
  });

  it('refuses a non-hex or short COPY_SIGNING_KEY', () => {
    const env = okEnv();
    env.COPY_SIGNING_KEY = 'not-hex-!!!';
    expect(evaluateProductionGuards(env).ok).toBe(false);
    env.COPY_SIGNING_KEY = 'ab'.repeat(10);
    expect(evaluateProductionGuards(env).ok).toBe(false);
  });

  it('refuses DB_SYNCHRONIZE=true', () => {
    const env = okEnv();
    env.DB_SYNCHRONIZE = 'true';
    expect(evaluateProductionGuards(env).ok).toBe(false);
  });

  it('refuses MAIL_DRIVER=log in production', () => {
    const env = okEnv();
    env.MAIL_DRIVER = 'log';
    expect(evaluateProductionGuards(env).ok).toBe(false);
  });

  it('refuses DOWNLOADS_LEGACY_ENDPOINT=on in production', () => {
    const env = okEnv();
    env.DOWNLOADS_LEGACY_ENDPOINT = 'on';
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((rr) => rr.includes('DOWNLOADS_LEGACY_ENDPOINT'))).toBe(true);
  });
});
