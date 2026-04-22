import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

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

const resolveEnvironment = (): string => {
  const explicit = process.env.EXPO_PUBLIC_APP_ENV?.trim();
  if (explicit) return explicit;

  const extraEnv = (Constants.expoConfig?.extra as any)?.appEnv;
  if (typeof extraEnv === 'string' && extraEnv.trim().length > 0) {
    return extraEnv.trim();
  }

  return __DEV__ ? 'development' : 'production';
};

export const initSentryMonitoring = (): void => {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: resolveEnvironment(),
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
    beforeSend(event) {
      const next = { ...event };
      next.extra = redactSensitive(next.extra) as Record<string, unknown> | undefined;
      next.user = next.user ? { ...next.user, ip_address: undefined } : next.user;
      if (next.request) {
        const headers = { ...(next.request.headers || {}) };
        delete (headers as any).authorization;
        delete (headers as any).Authorization;
        delete (headers as any).cookie;
        delete (headers as any).Cookie;
        next.request = {
          ...next.request,
          headers,
          data: redactSensitive((next.request as any).data),
        } as any;
      }
      return next;
    },
    beforeBreadcrumb(breadcrumb) {
      if (!breadcrumb.data) {
        return breadcrumb;
      }

      return {
        ...breadcrumb,
        data: redactSensitive(breadcrumb.data) as Record<string, unknown>,
      };
    },
  });
};

export { Sentry };
