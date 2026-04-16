import * as Joi from 'joi';

/**
 * Boot-time validation for environment variables.
 *
 * Any missing / invalid value here terminates the process immediately with
 * a descriptive error — we explicitly refuse to start with silent fallbacks
 * for security-critical values (JWT_SECRET being the primary example).
 *
 * Production adds extra constraints via `when NODE_ENV === 'production'`:
 *  - CORS_ORIGIN must be an explicit list (no '*')
 *  - APP_BASE_URL must be set (used for generating public upload URLs)
 *  - DB_PASSWORD must not be the insecure default 'postgres'
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  CORS_ORIGIN: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .required()
        .pattern(/^(?!\*$).+/, 'non-wildcard CORS origin')
        .messages({
          'string.pattern.name':
            'CORS_ORIGIN must be an explicit comma-separated list in production, not "*"',
        }),
      otherwise: Joi.string().default('*'),
    }),
  APP_BASE_URL: Joi.string().uri().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  UPLOAD_DIR: Joi.string().default('uploads'),
  BODY_LIMIT: Joi.string().default('1mb'),

  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(120),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string()
    .allow('')
    .default('postgres')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().invalid('postgres', '').required().messages({
        'any.invalid':
          'DB_PASSWORD must not be the default "postgres" in production',
      }),
    }),
  DB_DATABASE: Joi.string().default('anaqat_iraq'),
  DB_SYNCHRONIZE: Joi.string().valid('true', 'false').optional(),
  DB_SSL: Joi.string().valid('true', 'false').default('false'),
  DB_SSL_REJECT_UNAUTHORIZED: Joi.string().valid('true', 'false').default('true'),

  // Security-critical: no default, no fallback. Must be supplied.
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRATION: Joi.string().default('24h'),

  GOOGLE_VISION_API_KEY: Joi.string().optional().allow(''),
});
