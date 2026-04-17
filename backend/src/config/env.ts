import { logger } from '../utils/logger';

const loadDotEnvForLocal = () => {
  if (process.env.NODE_ENV !== 'production') {
    // Only load .env files outside production deployments.
    // In Railway production, variables should come from the platform environment.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv/config');
  }
};

loadDotEnvForLocal();

type AppEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  isProduction: boolean;
  PORT: number;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  WHISPER_MODEL: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  REQUIRE_S3_UPLOADS: boolean;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  SWAGGER_SERVER_URL?: string;
  RAILWAY_PUBLIC_DOMAIN?: string;
  RAILWAY_STATIC_URL?: string;
  FRONTEND_URL?: string;
  MOBILE_DEV_URL?: string;
  PRODUCTION_APP_URL?: string;
  CORS_ORIGINS: string[];
  MORNING_NOTIFICATION_CRON: string;
  EVENING_NOTIFICATION_CRON: string;
  DUE_SOON_NOTIFICATION_CRON: string;
  OVERDUE_NOTIFICATION_CRON: string;
};

const getRequired = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
};

const validateJwtSecret = (value: string): string => {
  const MIN_LENGTH = 32;
  if (value.length < MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_LENGTH} characters. Provided value is only ${value.length} characters.`,
    );
  }
  return value;
};

const parseNodeEnv = (): 'development' | 'production' | 'test' => {
  const raw = process.env.NODE_ENV?.trim();
  if (!raw) {
    return 'development';
  }
  if (raw === 'development' || raw === 'production' || raw === 'test') {
    return raw;
  }
  throw new Error(`Invalid NODE_ENV: ${raw}`);
};

const parsePort = (): number => {
  const raw = process.env.PORT?.trim();
  if (!raw) {
    return 3000;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return parsed;
};

const parseOptionalUrl = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
};

const validateS3Config = (required: boolean) => {
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.S3_BUCKET_NAME?.trim();

  const values = { region, accessKeyId, secretAccessKey, bucketName };
  const configuredCount = Object.values(values).filter((value) => Boolean(value)).length;

  if (required && configuredCount < 4) {
    throw new Error('Missing S3 upload configuration. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME.');
  }

  if (configuredCount > 0 && configuredCount < 4) {
    throw new Error('Incomplete S3 upload configuration. Provide all of AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME.');
  }

  return values;
};

const toCorsOrigin = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    // Fall through for host-only inputs like "example.com" or "localhost:3000".
  }

  const hostOnlyMatch = normalized.match(/^[a-zA-Z0-9.-]+(?::\d+)?$/);
  if (!hostOnlyMatch) {
    return null;
  }

  const isLocalHost = normalized.startsWith('localhost') || normalized.startsWith('127.0.0.1');
  return `${isLocalHost ? 'http' : 'https'}://${normalized}`;
};

const parseCorsOrigins = (isProduction: boolean): string[] => {
  const namedOriginsRaw = [
    parseOptionalUrl('FRONTEND_URL'),
    parseOptionalUrl('MOBILE_DEV_URL'),
    parseOptionalUrl('PRODUCTION_APP_URL'),
  ].filter((origin): origin is string => Boolean(origin));

  const platformOriginsRaw = [
    parseOptionalUrl('SWAGGER_SERVER_URL'),
    parseOptionalUrl('RAILWAY_PUBLIC_DOMAIN'),
    parseOptionalUrl('RAILWAY_STATIC_URL'),
  ].filter((origin): origin is string => Boolean(origin));

  const normalizedNamedOrigins = namedOriginsRaw
    .map((origin) => toCorsOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  const normalizedPlatformOrigins = platformOriginsRaw
    .map((origin) => toCorsOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  const legacyOrigins = (process.env.CORS_ORIGINS?.trim() || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => toCorsOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  const merged = Array.from(new Set([...normalizedNamedOrigins, ...normalizedPlatformOrigins, ...legacyOrigins]));

  if (merged.length === 0) {
    if (isProduction) {
      // Fail secure: no browser origins allowed until explicit allow-list is configured.
      // Mobile native clients (no Origin header) still work via the cors handler.
      logger.warn('[Config] No CORS browser origins configured in production. Browser-origin requests will be rejected.');
      return [];
    }
    // Development defaults: cover common local dev servers and Expo web.
    return [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:19000',
      'http://localhost:19006',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8081',
      'http://127.0.0.1:19000',
      'http://127.0.0.1:19006',
    ];
  }

  if (isProduction) {
    const insecureOrigin = merged.find((origin) => {
      try {
        const parsed = new URL(origin);
        return parsed.protocol !== 'https:';
      } catch {
        return true;
      }
    });

    if (insecureOrigin) {
      throw new Error(`Invalid insecure CORS origin in production: ${insecureOrigin}`);
    }
  }

  return merged;
};

const NODE_ENV = parseNodeEnv();
const isProduction = NODE_ENV === 'production';
const requireS3Uploads = parseBoolean(process.env.REQUIRE_S3_UPLOADS, isProduction);
const s3Config = validateS3Config(requireS3Uploads);

export const env: AppEnv = {
  NODE_ENV,
  isProduction,
  PORT: parsePort(),
  SENTRY_DSN: process.env.SENTRY_DSN?.trim(),
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT?.trim() || NODE_ENV,
  JWT_SECRET: validateJwtSecret(getRequired('JWT_SECRET')),
  DATABASE_URL: getRequired('DATABASE_URL'),
  GOOGLE_CLIENT_ID: getRequired('GOOGLE_CLIENT_ID'),
  OPENAI_API_KEY: getRequired('OPENAI_API_KEY'),
  OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
  WHISPER_MODEL: process.env.WHISPER_MODEL?.trim() || 'whisper-1',
  RESEND_API_KEY: getRequired('RESEND_API_KEY'),
  MAIL_FROM: getRequired('MAIL_FROM'),
  REQUIRE_S3_UPLOADS: requireS3Uploads,
  AWS_REGION: s3Config.region,
  AWS_ACCESS_KEY_ID: s3Config.accessKeyId,
  AWS_SECRET_ACCESS_KEY: s3Config.secretAccessKey,
  S3_BUCKET_NAME: s3Config.bucketName,
  SWAGGER_SERVER_URL: process.env.SWAGGER_SERVER_URL?.trim(),
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN?.trim(),
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL?.trim(),
  FRONTEND_URL: parseOptionalUrl('FRONTEND_URL'),
  MOBILE_DEV_URL: parseOptionalUrl('MOBILE_DEV_URL'),
  PRODUCTION_APP_URL: parseOptionalUrl('PRODUCTION_APP_URL'),
  CORS_ORIGINS: parseCorsOrigins(isProduction),
  // Minute-level polling enables per-user local-time delivery and exact offset reminders.
  MORNING_NOTIFICATION_CRON: process.env.MORNING_NOTIFICATION_CRON?.trim() || '* * * * *',
  EVENING_NOTIFICATION_CRON: process.env.EVENING_NOTIFICATION_CRON?.trim() || '* * * * *',
  DUE_SOON_NOTIFICATION_CRON: process.env.DUE_SOON_NOTIFICATION_CRON?.trim() || '* * * * *',
  OVERDUE_NOTIFICATION_CRON: process.env.OVERDUE_NOTIFICATION_CRON?.trim() || '* * * * *',
};

logger.info(`[Config] Environment loaded: ${env.NODE_ENV}`);
logger.info('[Config] Required environment variables validated.');
