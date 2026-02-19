"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_PARSER_SYSTEM_PROMPT = exports.ParserOutputValidationError = exports.ProviderRequestError = exports.ParserConfigError = void 0;
exports.parseTaskText = parseTaskText;
const taskParserPrompt_1 = require("./taskParserPrompt");
Object.defineProperty(exports, "TASK_PARSER_SYSTEM_PROMPT", { enumerable: true, get: function () { return taskParserPrompt_1.TASK_PARSER_SYSTEM_PROMPT; } });
class ParserConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ParserConfigError';
    }
}
exports.ParserConfigError = ParserConfigError;
class ProviderRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProviderRequestError';
    }
}
exports.ProviderRequestError = ProviderRequestError;
class ParserOutputValidationError extends Error {
    constructor(issues) {
        super('Parsed task output failed validation');
        this.name = 'ParserOutputValidationError';
        this.issues = issues;
    }
}
exports.ParserOutputValidationError = ParserOutputValidationError;
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
    const keys = ['title', 'description', 'dueDate', 'priority', 'labels', 'subtasks'];
    for (const key of keys) {
        if (!(key in value)) {
            issues.push(`Missing required field: ${key}`);
        }
    }
    const title = value.title;
    if (!(title === null || typeof title === 'string')) {
        issues.push('title must be string or null');
    }
    const description = value.description;
    if (!(description === null || typeof description === 'string')) {
        issues.push('description must be string or null');
    }
    const dueDate = value.dueDate;
    if (!(dueDate === null || typeof dueDate === 'string')) {
        issues.push('dueDate must be string or null');
    }
    else if (typeof dueDate === 'string') {
        const isValidDate = !Number.isNaN(new Date(dueDate).valueOf());
        if (!isValidDate) {
            issues.push('dueDate must be an ISO date string when provided');
        }
    }
    const priority = value.priority;
    if (!(priority === null || priority === 'LOW' || priority === 'MEDIUM' || priority === 'HIGH')) {
        issues.push('priority must be one of LOW, MEDIUM, HIGH, or null');
    }
    const labels = value.labels;
    if (!(labels === null || (Array.isArray(labels) && labels.every((entry) => typeof entry === 'string')))) {
        issues.push('labels must be an array of strings or null');
    }
    const subtasks = value.subtasks;
    if (!(subtasks === null || (Array.isArray(subtasks) && subtasks.every((entry) => typeof entry === 'string')))) {
        issues.push('subtasks must be an array of strings or null');
    }
    if (issues.length > 0) {
        return { valid: false, issues };
    }
    return {
        valid: true,
        value: {
            title: value.title ?? null,
            description: value.description ?? null,
            dueDate: value.dueDate ?? null,
            priority: value.priority ?? null,
            labels: value.labels ?? null,
            subtasks: value.subtasks ?? null,
        },
    };
}
async function parseTaskWithOpenAI(text, timezone) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new ParserConfigError('Missing OPENAI_API_KEY');
    }
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const userContent = timezone
        ? `timezone=${timezone}\ntext=${text}`
        : `text=${text}`;
    let response;
    try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                    { role: 'system', content: taskParserPrompt_1.TASK_PARSER_SYSTEM_PROMPT },
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
    const parsed = parseJsonSafely(rawContent);
    const validation = validateParsedTask(parsed);
    if (!validation.valid) {
        throw new ParserOutputValidationError(validation.issues);
    }
    return validation.value;
}
async function parseTaskText(text, timezone) {
    if (typeof text !== 'string' || text.trim().length === 0) {
        throw new ParserOutputValidationError(['Input text must be a non-empty string']);
    }
    return parseTaskWithOpenAI(text, timezone);
}
