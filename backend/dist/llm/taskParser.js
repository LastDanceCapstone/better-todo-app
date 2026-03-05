"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_PARSER_SYSTEM_PROMPT = exports.ParserOutputValidationError = exports.ProviderRequestError = exports.ParserConfigError = void 0;
exports.formatParserError = formatParserError;
exports.parseTaskText = parseTaskText;
const taskParserPrompt_1 = require("./taskParserPrompt");
Object.defineProperty(exports, "TASK_PARSER_SYSTEM_PROMPT", { enumerable: true, get: function () { return taskParserPrompt_1.TASK_PARSER_SYSTEM_PROMPT; } });
class ParserBaseError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
class ParserConfigError extends ParserBaseError {
    constructor(message) {
        super('PARSER_CONFIG_ERROR', message);
        this.name = 'ParserConfigError';
    }
}
exports.ParserConfigError = ParserConfigError;
class ProviderRequestError extends ParserBaseError {
    constructor(message) {
        super('PROVIDER_REQUEST_ERROR', message);
        this.name = 'ProviderRequestError';
    }
}
exports.ProviderRequestError = ProviderRequestError;
class ParserOutputValidationError extends ParserBaseError {
    constructor(issues) {
        super('PARSER_OUTPUT_VALIDATION_ERROR', 'Parsed task output failed validation');
        this.name = 'ParserOutputValidationError';
        this.issues = issues;
    }
}
exports.ParserOutputValidationError = ParserOutputValidationError;
let fetchImplementation = null;
async function getFetchImplementation() {
    if (fetchImplementation) {
        return fetchImplementation;
    }
    if (typeof globalThis.fetch === 'function') {
        fetchImplementation = globalThis.fetch.bind(globalThis);
        return fetchImplementation;
    }
    const { fetch: undiciFetch } = await Promise.resolve().then(() => __importStar(require('undici')));
    fetchImplementation = undiciFetch;
    return fetchImplementation;
}
function formatParserError(error) {
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
const ALLOWED_KEYS = ['title', 'description', 'dueDate', 'priority', 'labels', 'subtasks'];
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_LABEL_LENGTH = 32;
const MAX_SUBTASK_LENGTH = 120;
const MAX_LIST_ITEMS = 20;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_NO_ZONE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?$/;
function collapseWhitespace(value) {
    return value.trim().replace(/\s+/g, ' ');
}
function isValidDateParts(year, month, day) {
    if (month < 1 || month > 12)
        return false;
    if (day < 1 || day > 31)
        return false;
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (candidate.getUTCFullYear() === year
        && candidate.getUTCMonth() === month - 1
        && candidate.getUTCDate() === day);
}
function isValidTimeParts(hour, minute, second) {
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}
function isValidDueDateInput(value) {
    const dateOnlyMatch = value.match(DATE_ONLY_PATTERN);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return isValidDateParts(Number(year), Number(month), Number(day));
    }
    const noZoneMatch = value.match(DATETIME_NO_ZONE_PATTERN);
    if (noZoneMatch) {
        const [, year, month, day, hour, minute, second] = noZoneMatch;
        return (isValidDateParts(Number(year), Number(month), Number(day))
            && isValidTimeParts(Number(hour), Number(minute), Number(second ?? '0')));
    }
    return !Number.isNaN(new Date(value).getTime());
}
function sanitizeList(input, field, maxLength, issues) {
    if (input === null)
        return null;
    if (!Array.isArray(input)) {
        issues.push(`${field} must be an array of strings or null`);
        return null;
    }
    const dedupeSet = new Set();
    const sanitized = [];
    for (const entry of input) {
        if (typeof entry !== 'string') {
            issues.push(`${field} must be an array of strings or null`);
            continue;
        }
        const cleaned = collapseWhitespace(entry);
        if (!cleaned)
            continue;
        if (cleaned.length > maxLength) {
            issues.push(`${field} entries must be at most ${maxLength} characters`);
            continue;
        }
        const dedupeKey = cleaned.toLowerCase();
        if (dedupeSet.has(dedupeKey))
            continue;
        dedupeSet.add(dedupeKey);
        sanitized.push(cleaned);
        if (sanitized.length === MAX_LIST_ITEMS)
            break;
    }
    if (input.length > MAX_LIST_ITEMS) {
        issues.push(`${field} must contain at most ${MAX_LIST_ITEMS} items`);
    }
    return sanitized.length > 0 ? sanitized : null;
}
function getTimeZoneOffsetMinutes(date, timeZone) {
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
    const valueMap = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            valueMap[part.type] = part.value;
        }
    }
    const asUtc = Date.UTC(Number(valueMap.year), Number(valueMap.month) - 1, Number(valueMap.day), Number(valueMap.hour), Number(valueMap.minute), Number(valueMap.second));
    return (asUtc - date.getTime()) / 60000;
}
function zonedLocalToUtcIsoString(year, month, day, hour, minute, second, timeZone) {
    let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
    for (let index = 0; index < 3; index += 1) {
        const offset = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
        utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60000;
    }
    return new Date(utcMs).toISOString();
}
function normalizeDueDateOutput(value, timeZone) {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const dateOnlyMatch = trimmed.match(DATE_ONLY_PATTERN);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return zonedLocalToUtcIsoString(Number(year), Number(month), Number(day), 23, 59, 0, timeZone);
    }
    const noZoneDateTimeMatch = trimmed.match(DATETIME_NO_ZONE_PATTERN);
    if (noZoneDateTimeMatch) {
        const [, year, month, day, hour, minute, second] = noZoneDateTimeMatch;
        return zonedLocalToUtcIsoString(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second ?? '0'), timeZone);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        throw new ParserOutputValidationError(['dueDate must be an ISO date-time string when provided']);
    }
    return parsed.toISOString();
}
function normalizeOutput(parsedTask, timeZone) {
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
function parseJsonSafely(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function validateParsedTask(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { valid: false, issues: ['Output must be an object'] };
    }
    const value = input;
    for (const key of ALLOWED_KEYS) {
        if (!(key in value)) {
            issues.push(`Missing required field: ${key}`);
        }
    }
    for (const key of Object.keys(value)) {
        if (!ALLOWED_KEYS.includes(key)) {
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
            priority: priorityRaw ?? null,
            labels,
            subtasks,
        }
    };
}
function parseAndValidate(rawContent) {
    const parsed = parseJsonSafely(rawContent);
    if (parsed === null) {
        return { valid: false, issues: ['invalid JSON'] };
    }
    return validateParsedTask(parsed);
}
function buildUserContent(text, timezoneSafe, nowIso, nowInTimezone) {
    return `timezone=${timezoneSafe}\nnowUtc=${nowIso}\nnowInTimezone=${nowInTimezone}\ntext=${text}`;
}
async function callOpenAI(model, systemPrompt, userContent) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new ParserConfigError('Missing OPENAI_API_KEY');
    }
    const fetchFn = await getFetchImplementation();
    let response;
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
    }
    catch {
        throw new ProviderRequestError('Failed to reach AI provider');
    }
    if (!response.ok) {
        throw new ProviderRequestError(`AI provider request failed with status ${response.status}`);
    }
    const body = (await response.json());
    const rawContent = body.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
        throw new ProviderRequestError('AI provider returned empty response');
    }
    return rawContent;
}
async function parseTaskWithOpenAI(text, timezone) {
    const startedAt = Date.now();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const now = new Date();
    const nowIso = now.toISOString();
    const timezoneSafe = timezone?.trim() || 'UTC';
    const textLength = text.trim().length;
    let retryUsed = false;
    let appliedDefaultTime = false;
    let nowInTimezone;
    try {
        nowInTimezone = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezoneSafe,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            weekday: 'long',
        }).format(now);
    }
    catch {
        nowInTimezone = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            weekday: 'long',
        }).format(now);
    }
    const userContent = buildUserContent(text, timezoneSafe, nowIso, nowInTimezone);
    try {
        const firstRawContent = await callOpenAI(model, taskParserPrompt_1.TASK_PARSER_SYSTEM_PROMPT, userContent);
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
            const retryRawContent = await callOpenAI(model, taskParserPrompt_1.TASK_PARSER_SYSTEM_PROMPT, retryUserContent);
            validation = parseAndValidate(retryRawContent);
        }
        if (!validation.valid) {
            throw new ParserOutputValidationError(validation.issues);
        }
        const normalized = normalizeOutput(validation.value, timezoneSafe);
        appliedDefaultTime = normalized.appliedDefaultTime;
        return normalized.value;
    }
    finally {
        console.info(`[ai.parse-task] model=${model} timezoneSafe=${timezoneSafe} textLength=${textLength} retryUsed=${retryUsed} appliedDefaultTime=${appliedDefaultTime} durationMs=${Date.now() - startedAt}`);
    }
}
async function parseTaskText(text, timezone) {
    if (typeof text !== 'string' || text.trim().length === 0) {
        throw new ParserOutputValidationError(['Input text must be a non-empty string']);
    }
    return parseTaskWithOpenAI(text, timezone);
}
