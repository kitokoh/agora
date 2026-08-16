import { pino, type Logger } from 'pino';
import type { AppConfig } from './config.js';

/**
 * Create the structured pino logger for the API.
 *
 * - JSON output in all environments (no PII, per AGENTS.md §6).
 * - Pretty-printed transport in local development only.
 * - Request correlation is handled by Fastify's `genReqId` (see app.ts);
 *   every log line carries the request id automatically.
 */
export function createLogger(config: Pick<AppConfig, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  const base = {
    service: 'agora-api',
    env: config.NODE_ENV,
  };

  if (config.NODE_ENV === 'development') {
    return pino({
      level: config.LOG_LEVEL,
      base,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
    });
  }

  return pino({ level: config.LOG_LEVEL, base });
}
