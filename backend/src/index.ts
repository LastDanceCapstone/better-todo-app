import './monitoring/sentry';
import app from './app';
import { initNotificationScheduler } from './jobs/notificationScheduler';
import { env } from './config/env';
import { logger } from './utils/logger';

const PORT = env.PORT;

initNotificationScheduler();

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`[Server] Running in ${env.NODE_ENV} mode on port ${PORT}`);
  if (!env.isProduction) {
    logger.info(`Local access: http://localhost:${PORT}`);
    logger.info(`API docs: http://localhost:${PORT}/api/docs`);
  }
});
