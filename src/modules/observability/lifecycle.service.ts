import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/**
 * Surfaces app lifecycle transitions as structured log events.
 *
 * Nest invokes:
 *   - onApplicationBootstrap()  after all modules have finished initialising.
 *   - onApplicationShutdown(sig) when SIGTERM/SIGINT is received and
 *     enableShutdownHooks() is active (see main.ts). Nest then tears down
 *     modules in reverse order, closes the HTTP server, and ends the process.
 *
 * This lets operators match a `signal=SIGTERM` line in the logs to a clean
 * shutdown (followed by `event=shutdown_complete` from Nest's HTTP close)
 * instead of an ambiguous process exit.
 */
@Injectable()
export class LifecycleService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('Lifecycle');
  }

  onApplicationBootstrap(): void {
    this.logger.info(
      {
        event: 'bootstrap_complete',
        nodeVersion: process.version,
        pid: process.pid,
      },
      'Application bootstrapped',
    );
  }

  onApplicationShutdown(signal?: string): void {
    this.logger.warn(
      { event: 'shutdown_received', signal: signal ?? 'unknown' },
      `Shutdown signal received: ${signal ?? 'unknown'}`,
    );
  }
}
