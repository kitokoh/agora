import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { buildApp } from './app.js';
import { initObservability } from '@agora/observability';

const config = loadConfig();
const logger = createLogger(config);

const observability = initObservability({
  serviceName: 'agora-api',
  serviceVersion: '0.1.0',
  environment: config.APP_ENV,
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
  exportOnlyInProduction: true,
  isProduction: config.NODE_ENV === 'production' || config.NODE_ENV === 'staging',
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const app = await buildApp({ logger, config });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'graceful shutdown started');

    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await Promise.allSettled([observability.shutdown(), app.close()]);
      logger.info('graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'uncaught exception');
    void shutdown('uncaughtException');
  });

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (err) {
    logger.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
