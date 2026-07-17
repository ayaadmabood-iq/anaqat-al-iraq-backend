import { evaluateProductionGuards } from '@/config/production-guard';

const okEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(48),
  COPY_SIGNING_KEY: 'a'.repeat(64),
  DB_PASSWORD: 'strong-secret',
  REDIS_URL: 'redis://localhost:6379/0',
  CORS_ORIGIN: 'https://qasdiya.example',
});

describe('evaluateProductionGuards', () => {
  it('passes when every requirement is set', () => {
    expect(evaluateProductionGuards(okEnv()).ok).toBe(true);
  });

  it('is a no-op outside production', () => {
    expect(evaluateProductionGuards({ NODE_ENV: 'development' }).ok).toBe(true);
    expect(evaluateProductionGuards({}).ok).toBe(true);
  });

  it.each([
    ['JWT_SECRET', 'signs every access token'],
    ['COPY_SIGNING_KEY', 'signs every issued personal copy'],
    ['DB_PASSWORD', 'authenticates the app to PostgreSQL'],
    ['REDIS_URL', 'shares rate-limit counters'],
  ])('refuses when %s is missing', (name, why) => {
    const env = okEnv();
    delete env[name];
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((rr) => rr.includes(name) && rr.includes(why.slice(0, 10)))).toBe(true);
  });

  it('accepts COPY_SIGNING_KEY_FILE in lieu of COPY_SIGNING_KEY', () => {
    const env = okEnv();
    delete env.COPY_SIGNING_KEY;
    env.COPY_SIGNING_KEY_FILE = '/etc/qasdiya/copy.key';
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(true);
  });

  it('refuses CORS_ORIGIN=*', () => {
    const env = okEnv();
    env.CORS_ORIGIN = '*';
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((rr) => rr.includes('CORS_ORIGIN'))).toBe(true);
  });

  it('refuses CORS_ORIGIN empty', () => {
    const env = okEnv();
    env.CORS_ORIGIN = '';
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
  });

  it('refuses a short JWT_SECRET', () => {
    const env = okEnv();
    env.JWT_SECRET = 'short';
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((rr) => rr.includes('JWT_SECRET'))).toBe(true);
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
    const r = evaluateProductionGuards(env);
    expect(r.ok).toBe(false);
  });
});
