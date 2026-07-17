// Default env for tests. Real integration tests can override before importing
// the module they exercise.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-please-do-not-use-in-prod';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4';
process.env.STORAGE_ROOT = process.env.STORAGE_ROOT || '/tmp/qasdiya-test-storage';
process.env.COPY_SIGNING_KEY =
  process.env.COPY_SIGNING_KEY ||
  '1111111111111111111111111111111111111111111111111111111111111111';
process.env.MAIL_DRIVER = 'log';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'qasdiya_test';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'qasdiya_test';
process.env.DB_DATABASE = process.env.DB_DATABASE || 'qasdiya_test';
