/**
 * Single source of truth for runtime configuration.
 * Read via ConfigService.get<AppConfig['…']>('…'). Never call process.env directly
 * outside this file.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigin: string;
  appBaseUrl: string | null;
  uploadDir: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    synchronize: boolean;
    logging: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  googleVisionApiKey: string | null;
}

export default (): AppConfig => {
  const env = (process.env.NODE_ENV || 'development') as AppConfig['nodeEnv'];
  return {
    nodeEnv: env,
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    appBaseUrl: process.env.APP_BASE_URL || null,
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      name: process.env.DB_DATABASE || 'anaqat_iraq',
      synchronize: env !== 'production',
      logging: env === 'development',
    },
    jwt: {
      // Never provide a fallback here. Validation must enforce presence.
      secret: process.env.JWT_SECRET as string,
      expiresIn: process.env.JWT_EXPIRATION || '24h',
    },
    googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY || null,
  };
};
