import * as Joi from 'joi';

/**
 * Boot-time validation for environment variables.
 *
 * Any missing / invalid value here terminates the process immediately with
 * a descriptive error — we explicitly refuse to start with silent fallbacks
 * for security-critical values (JWT_SECRET being the primary example).
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  CORS_ORIGIN: Joi.string().default('*'),
  APP_BASE_URL: Joi.string().uri().optional().allow(''),
  UPLOAD_DIR: Joi.string().default('uploads'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default('postgres'),
  DB_DATABASE: Joi.string().default('anaqat_iraq'),

  // Security-critical: no default, no fallback. Must be supplied.
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRATION: Joi.string().default('24h'),

  GOOGLE_VISION_API_KEY: Joi.string().optional().allow(''),
});
