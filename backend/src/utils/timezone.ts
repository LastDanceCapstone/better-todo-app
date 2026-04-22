const TIMEZONE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = TIMEZONE_FORMATTER_CACHE.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  TIMEZONE_FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const normalizeTimeZone = (timeZone: string | null | undefined, fallback = 'UTC'): string => {
  const trimmed = typeof timeZone === 'string' ? timeZone.trim() : '';
  if (!trimmed) return fallback;
  return isValidTimeZone(trimmed) ? trimmed : fallback;
};

export const getTimeZoneDateParts = (date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} => {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type === 'literal') continue;
    values[part.type] = Number(part.value);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string): number => {
  const parts = getTimeZoneDateParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return (asUtc - date.getTime()) / 60000;
};

export const zonedLocalToUtcDate = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date => {
  const baseUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMs = baseUtc;

  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
    utcMs = baseUtc - offset * 60000;
  }

  return new Date(utcMs);
};

export const getLocalDateKey = (date: Date, timeZone: string): string => {
  const parts = getTimeZoneDateParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const isLocalTimeMatch = (
  date: Date,
  timeZone: string,
  hour: number,
  minute: number,
): boolean => {
  const parts = getTimeZoneDateParts(date, timeZone);
  return parts.hour === hour && parts.minute === minute;
};

export const getUtcRangeForLocalDateKey = (
  localDateKey: string,
  timeZone: string,
): { startUtc: Date; endUtc: Date } => {
  const [year, month, day] = localDateKey.split('-').map(Number);
  const startUtc = zonedLocalToUtcDate(year, month, day, 0, 0, 0, timeZone);
  const endUtc = zonedLocalToUtcDate(year, month, day, 23, 59, 59, timeZone);
  return { startUtc, endUtc };
};
