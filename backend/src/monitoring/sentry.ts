import * as Sentry from '@sentry/node';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const SENSITIVE_KEY_PATTERN = /password|token|authorization|secret|api[_-]?key|prompt|input|text/i;

const redactSensitive = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitive(entry));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactSensitive(nested);
    }
    return result;
  }

  return value;
};

const sentryEnabled = Boolean(env.SENTRY_DSN) && env.NODE_ENV !== 'test';

if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    sendDefaultPii: false,
    beforeSend(event) {
      const next = { ...event };
      if (next.request) {
        const headers = { ...(next.request.headers || {}) };
        delete headers.authorization;
        delete headers.Authorization;
        delete headers.cookie;
        delete headers.Cookie;
        next.request = {
          ...next.request,
          headers,
          data: redactSensitive(next.request.data),
        };
      }
      next.extra = redactSensitive(next.extra) as Record<string, unknown> | undefined;
      return next;
    },
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error('Unhandled promise rejection');
    Sentry.captureException(error);
  });

  process.on('uncaughtExceptionMonitor', (error) => {
    Sentry.captureException(error);
  });

  logger.info('[Monitoring] Sentry initialized.');
} else {
  logger.warn('[Monitoring] Sentry disabled. Set SENTRY_DSN to enable crash monitoring.');
}

export const captureException = (error: unknown): void => {
  if (!sentryEnabled) return;
  const normalized = error instanceof Error ? error : new Error('Unknown exception');
  Sentry.captureException(normalized);
};
