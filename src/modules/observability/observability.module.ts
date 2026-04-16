import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { AppConfig } from '@/config/configuration';
import { LifecycleService } from './lifecycle.service';
import { MetricsController } from './metrics.controller';

/**
 * Centralises structured logging (pino), lifecycle hooks, and /metrics.
 *
 * pino is wired as Nest's application logger in main.ts, so every existing
 * `new Logger(...)` call in the codebase keeps working — only the output
 * format changes (JSON in production, pretty in development).
 *
 * Per-request logs:
 *   - x-request-id header is honoured; otherwise a UUID is generated.
 *   - `req.id` is attached to every log line produced during the request.
 *   - /healthz and /metrics are excluded from autoLogging to keep signal high.
 *   - Authorization / Cookie headers are redacted before logging.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<AppConfig['nodeEnv']>('nodeEnv');
        const isProd = env === 'production';
        const isTest = env === 'test';
        /**
         * Intentionally no `transport:` target.
         *
         * pino's transport option spawns a worker thread. When SIGTERM
         * arrives, Nest tears down modules and exits before the worker
         * can flush its buffer, so the LifecycleService shutdown log
         * would be lost in dev exactly when operators need it most.
         *
         * We emit line-delimited JSON directly to stdout from the main
         * thread. Pipe through `pino-pretty` at the shell for readable
         * local output:  `npm run start:dev | pino-pretty`.
         */
        return {
          pinoHttp: {
            level: isProd ? 'info' : isTest ? 'silent' : 'debug',
            genReqId: (req, res) => {
              const incoming = req.headers['x-request-id'];
              const id =
                (typeof incoming === 'string' && incoming) || randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            customProps: (req: any) => ({
              requestId: req.id,
            }),
            // Keep logs focused: don't emit one-line-per-healthcheck noise.
            autoLogging: {
              ignore: (req) =>
                req.url === '/healthz' || req.url === '/metrics',
            },
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
              err: (err) => ({
                type: err.type,
                message: err.message,
                stack: isProd ? undefined : err.stack,
              }),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["set-cookie"]',
                'res.headers["set-cookie"]',
                '*.password',
                '*.passwordHash',
                '*.access_token',
              ],
              remove: false,
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [LifecycleService],
})
export class ObservabilityModule {}
