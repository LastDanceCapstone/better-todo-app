import { TASK_PARSER_SYSTEM_PROMPT } from './taskParserPrompt';
import { env } from '../config/env';
import { logger } from '../utils/logger';

type ParserErrorCode =
  | 'PARSER_CONFIG_ERROR'
  | 'PROVIDER_REQUEST_ERROR'
  | 'PARSER_OUTPUT_VALIDATION_ERROR'
  | 'INTERNAL_SERVER_ERROR';

export type StructuredErrorResponse = {
  error: {
    code: ParserErrorCode;
    message: string;
  };
};

export type ParsedTask = {
  title: string | null;
  description: string | null;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  labels: string[] | null;
  subtasks: string[] | null;
};

class ParserBaseError extends Error {
  code: ParserErrorCode;

  constructor(code: ParserErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class ParserConfigError extends ParserBaseError {
  constructor(message: string) {
    super('PARSER_CONFIG_ERROR', message);
    this.name = 'ParserConfigError';
  }
}

export class ProviderRequestError extends ParserBaseError {
  constructor(message: string) {
    super('PROVIDER_REQUEST_ERROR', message);
    this.name = 'ProviderRequestError';
  }
}

export class ParserOutputValidationError extends ParserBaseError {
  issues: string[];

  constructor(issues: string[]) {
    super('PARSER_OUTPUT_VALIDATION_ERROR', 'Parsed task output failed validation');
    this.name = 'ParserOutputValidationError';
    this.issues = issues;
  }
}

let fetchImplementation: typeof fetch | null = null;

async function getFetchImplementation(): Promise<typeof fetch> {
  if (fetchImplementation) {
    return fetchImplementation;
  }

  if (typeof globalThis.fetch === 'function') {
    fetchImplementation = globalThis.fetch.bind(globalThis);
    return fetchImplementation;
  }

  const { fetch: undiciFetch } = await import('undici');
  fetchImplementation = undiciFetch as unknown as typeof fetch;
  return fetchImplementation;
}

export function formatParserError(error: unknown): StructuredErrorResponse {
  if (error instanceof ParserConfigError || error instanceof ProviderRequestError || error instanceof ParserOutputValidationError) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  };
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type ParseValidationResult =
  | { valid: true; value: ParsedTask }
  | { valid: false; issues: string[] };

const ALLOWED_KEYS = ['title', 'description', 'dueDate', 'priority', 'labels', 'subtasks'] as const;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_LABEL_LENGTH = 32;
const MAX_SUBTASK_LENGTH = 120;
const MAX_LIST_ITEMS = 20;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_NO_ZONE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?$/;

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day
  );
}

function isValidTimeParts(hour: number, minute: number, second: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

function isValidDueDateInput(value: string): boolean {
  const dateOnlyMatch = value.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return isValidDateParts(Number(year), Number(month), Number(day));
  }

  const noZoneMatch = value.match(DATETIME_NO_ZONE_PATTERN);
  if (noZoneMatch) {
    const [, year, month, day, hour, minute, second] = noZoneMatch;
    return (
      isValidDateParts(Number(year), Number(month), Number(day))
      && isValidTimeParts(Number(hour), Number(minute), Number(second ?? '0'))
    );
  }

  return !Number.isNaN(new Date(value).getTime());
}

function sanitizeList(
  input: unknown,
  field: 'labels' | 'subtasks',
  maxLength: number,
  issues: string[],
): string[] | null {
  if (input === null) return null;
  if (!Array.isArray(input)) {
    issues.push(`${field} must be an array of strings or null`);
    return null;
  }

  const dedupeSet = new Set<string>();
  const sanitized: string[] = [];

  for (const entry of input) {
    if (typeof entry !== 'string') {
      issues.push(`${field} must be an array of strings or null`);
      continue;
    }

    const cleaned = collapseWhitespace(entry);
    if (!cleaned) continue;

    if (cleaned.length > maxLength) {
      issues.push(`${field} entries must be at most ${maxLength} characters`);
      continue;
    }

    const dedupeKey = cleaned.toLowerCase();
    if (dedupeSet.has(dedupeKey)) continue;

    dedupeSet.add(dedupeKey);
    sanitized.push(cleaned);

    if (sanitized.length === MAX_LIST_ITEMS) break;
  }

  if (input.length > MAX_LIST_ITEMS) {
    issues.push(`${field} must contain at most ${MAX_LIST_ITEMS} items`);
  }

  return sanitized.length > 0 ? sanitized : null;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
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

  const parts = formatter.formatToParts(date);
  const valueMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      valueMap[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number(valueMap.year),
    Number(valueMap.month) - 1,
    Number(valueMap.day),
    Number(valueMap.hour),
    Number(valueMap.minute),
    Number(valueMap.second),
  );

  return (asUtc - date.getTime()) / 60000;
}

function zonedLocalToUtcIsoString(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): string {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
    utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000;
  }

  return new Date(utcMs).toISOString();
}

function normalizeDueDateOutput(value: string | null, timeZone: string): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = trimmed.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return zonedLocalToUtcIsoString(
      Number(year),
      Number(month),
      Number(day),
      23,
      59,
      0,
      timeZone,
    );
  }

  const noZoneDateTimeMatch = trimmed.match(DATETIME_NO_ZONE_PATTERN);
  if (noZoneDateTimeMatch) {
    const [, year, month, day, hour, minute, second] = noZoneDateTimeMatch;
    return zonedLocalToUtcIsoString(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? '0'),
      timeZone,
    );
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new ParserOutputValidationError(['dueDate must be an ISO date-time string when provided']);
  }

  return parsed.toISOString();
}

function normalizeOutput(parsedTask: ParsedTask, timeZone: string): { value: ParsedTask; appliedDefaultTime: boolean } {
  if (!parsedTask.dueDate) {
    return { value: parsedTask, appliedDefaultTime: false };
  }

  const trimmed = parsedTask.dueDate.trim();
  const appliedDefaultTime = DATE_ONLY_PATTERN.test(trimmed) || DATETIME_NO_ZONE_PATTERN.test(trimmed);

  return {
    value: {
      ...parsedTask,
      dueDate: normalizeDueDateOutput(parsedTask.dueDate, timeZone),
    },
    appliedDefaultTime,
  };
}

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateParsedTask(input: unknown): ParseValidationResult {
  const issues: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, issues: ['Output must be an object'] };
  }

  const value = input as Record<string, unknown>;

  for (const key of ALLOWED_KEYS) {
    if (!(key in value)) {
      issues.push(`Missing required field: ${key}`);
    }
  }

  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
      issues.push(`Unexpected field: ${key}`);
    }
  }

  const titleRaw = value.title;
  if (!(titleRaw === null || typeof titleRaw === 'string')) {
    issues.push('title must be string or null');
  }
  const title = typeof titleRaw === 'string' ? collapseWhitespace(titleRaw) : null;
  if (title && title.length > MAX_TITLE_LENGTH) {
    issues.push(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }

  const descriptionRaw = value.description;
  if (!(descriptionRaw === null || typeof descriptionRaw === 'string')) {
    issues.push('description must be string or null');
  }
  const description = typeof descriptionRaw === 'string' ? collapseWhitespace(descriptionRaw) : null;
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    issues.push(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }

  const dueDateRaw = value.dueDate;
  if (!(dueDateRaw === null || typeof dueDateRaw === 'string')) {
    issues.push('dueDate must be string or null');
  }
  const dueDate = typeof dueDateRaw === 'string' ? dueDateRaw.trim() : null;
  if (dueDate && !isValidDueDateInput(dueDate)) {
    issues.push('dueDate must be a valid ISO date-time, YYYY-MM-DD, or YYYY-MM-DDTHH:mm string when provided');
  }

  const priorityRaw = value.priority;
  if (!(priorityRaw === null || priorityRaw === 'LOW' || priorityRaw === 'MEDIUM' || priorityRaw === 'HIGH' || priorityRaw === 'URGENT')) {
    issues.push('priority must be one of LOW, MEDIUM, HIGH, URGENT, or null');
  }

  const labels = sanitizeList(value.labels, 'labels', MAX_LABEL_LENGTH, issues);
  const subtasks = sanitizeList(value.subtasks, 'subtasks', MAX_SUBTASK_LENGTH, issues);

  if (Array.isArray(labels) && labels.length > MAX_LIST_ITEMS) {
    issues.push(`labels must contain at most ${MAX_LIST_ITEMS} items`);
  }

  if (Array.isArray(subtasks) && subtasks.length > MAX_LIST_ITEMS) {
    issues.push(`subtasks must contain at most ${MAX_LIST_ITEMS} items`);
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    value: {
      title: title || null,
      description: description || null,
      dueDate: dueDate || null,
      priority: (priorityRaw as ParsedTask['priority']) ?? null,
      labels,
      subtasks,
    }
  };
}

function parseAndValidate(rawContent: string): ParseValidationResult {
  const parsed = parseJsonSafely(rawContent);

  if (parsed === null) {
    return { valid: false, issues: ['invalid JSON'] };
  }

  return validateParsedTask(parsed);
}

function buildUserContent(text: string, timezoneSafe: string, nowIso: string, nowInTimezone: string): string {
  return `timezone=${timezoneSafe}\nnowUtc=${nowIso}\nnowInTimezone=${nowInTimezone}\ntext=${text}`;
}

async function callOpenAI(model: string, systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = env.OPENAI_API_KEY;

  const fetchFn = await getFetchImplementation();

  let response: Response;
  try {
    response = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });
  } catch {
    throw new ProviderRequestError('Failed to reach AI provider');
  }

  if (!response.ok) {
    throw new ProviderRequestError(`AI provider request failed with status ${response.status}`);
  }

  const body = (await response.json()) as OpenAIChatCompletionResponse;
  const rawContent = body.choices?.[0]?.message?.content;

  if (!rawContent || typeof rawContent !== 'string') {
    throw new ProviderRequestError('AI provider returned empty response');
  }

  return rawContent;
}

async function parseTaskWithOpenAI(text: string, timezone?: string): Promise<ParsedTask> {
  const startedAt = Date.now();
  const model = env.OPENAI_MODEL;
  const now = new Date();
  const nowIso = now.toISOString();
  const timezoneSafe = timezone?.trim() || 'UTC';
  const textLength = text.trim().length;

  let retryUsed = false;
  let appliedDefaultTime = false;

  let nowInTimezone: string;
  try {
    nowInTimezone = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneSafe,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      weekday: 'long',
    }).format(now) + ' (local)';
  } catch {
    nowInTimezone = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      weekday: 'long',
    }).format(now) + ' (local)';
  }

  const userContent = buildUserContent(text, timezoneSafe, nowIso, nowInTimezone);

  try {
    const firstRawContent = await callOpenAI(model, TASK_PARSER_SYSTEM_PROMPT, userContent);
    let validation = parseAndValidate(firstRawContent);

    if (!validation.valid) {
      retryUsed = true;

      const retryUserContent = [
        'Original request context:',
        userContent,
        'Invalid model output:',
        firstRawContent,
        'Validation issues:',
        validation.issues.length > 0 ? validation.issues.join(' | ') : 'invalid JSON',
        'Return ONLY corrected JSON object with exactly the required keys.',
      ].join('\n\n');

      const retryRawContent = await callOpenAI(model, TASK_PARSER_SYSTEM_PROMPT, retryUserContent);
      validation = parseAndValidate(retryRawContent);
    }

    if (!validation.valid) {
      throw new ParserOutputValidationError(validation.issues);
    }

    const normalized = normalizeOutput(validation.value, timezoneSafe);
    appliedDefaultTime = normalized.appliedDefaultTime;

    return normalized.value;
  } finally {
    logger.info(
      `[ai.parse-task] model=${model} timezoneSafe=${timezoneSafe} textLength=${textLength} retryUsed=${retryUsed} appliedDefaultTime=${appliedDefaultTime} durationMs=${Date.now() - startedAt}`,
    );
  }
}

export async function parseTaskText(text: string, timezone?: string): Promise<ParsedTask> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new ParserOutputValidationError(['Input text must be a non-empty string']);
  }

  return parseTaskWithOpenAI(text, timezone);
}

export { TASK_PARSER_SYSTEM_PROMPT };