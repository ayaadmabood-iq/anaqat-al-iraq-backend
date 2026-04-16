/**
 * Single source of truth for runtime configuration.
 * Read via ConfigService.get<AppConfig['…']>('…'). Never call process.env directly
 * outside this file.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];          // already parsed; '*' only kept in dev
  appBaseUrl: string | null;
  uploadDir: string;
  bodyLimit: string;              // e.g. '1mb'
  throttle: {
    ttlSeconds: number;
    limit: number;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    synchronize: boolean;
    logging: boolean;
    ssl: boolean;
    sslRejectUnauthorized: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  googleVisionApiKey: string | null;
}

export default (): AppConfig => {
  const env = (process.env.NODE_ENV || 'development') as AppConfig['nodeEnv'];

  const rawOrigin = process.env.CORS_ORIGIN || (env === 'production' ? '' : '*');
  const corsOrigins = rawOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    nodeEnv: env,
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigins,
    appBaseUrl: process.env.APP_BASE_URL || null,
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    bodyLimit: process.env.BODY_LIMIT || '1mb',
    throttle: {
      ttlSeconds: parseInt(process.env.THROTTLE_TTL || '60', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '120', 10),
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      name: process.env.DB_DATABASE || 'anaqat_iraq',
      // Production never runs synchronize — migrations are the only schema path.
      synchronize: env !== 'production' && process.env.DB_SYNCHRONIZE !== 'false',
      logging: env === 'development',
      ssl: process.env.DB_SSL === 'true',
      sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
    jwt: {
      // No fallback here on purpose. validationSchema requires it.
      secret: process.env.JWT_SECRET as string,
      expiresIn: process.env.JWT_EXPIRATION || '24h',
    },
    googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY || null,
  };
};
