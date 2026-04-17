import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	reconcileCalendarSync,
	removeTaskFromCalendar,
	syncTaskToCalendar,
} from '../services/calendarSync';
import {
	deleteAuthToken,
	getAuthToken,
	saveAuthToken,
} from '../utils/authStorage';
import { logger } from '../utils/logger';

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const getHostname = (value: string): string => {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return '';
	}
};

const isValidAbsoluteUrl = (value: string): boolean => {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:';
	} catch {
		return false;
	}
};

const isLocalOrLanHost = (hostname: string): boolean => {
	if (!hostname) return true;
	if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
	if (hostname.startsWith('192.168.')) return true;
	if (hostname.startsWith('10.')) return true;
	if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
	return false;
};

if (!rawApiBaseUrl) {
	throw new Error('Missing EXPO_PUBLIC_API_URL. Set it in mobile/.env or EAS environment variables.');
}

if (!isValidAbsoluteUrl(rawApiBaseUrl)) {
	throw new Error('Invalid EXPO_PUBLIC_API_URL. It must be a valid absolute URL.');
}

if (!__DEV__) {
	if (!rawApiBaseUrl.startsWith('https://')) {
		throw new Error('Invalid EXPO_PUBLIC_API_URL for release runtime. HTTPS is required.');
	}

	const hostname = getHostname(rawApiBaseUrl);
	if (isLocalOrLanHost(hostname)) {
		throw new Error('Invalid EXPO_PUBLIC_API_URL for release runtime. Localhost/LAN endpoints are not allowed.');
	}
}

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');
const APP_CALENDAR_SYNC_ENABLED_KEY = 'prioritizeCalendarAppSyncEnabled';

export type ParsedTaskResponse = {
	title: string | null;
	description: string | null;
	dueDate: string | null;
	priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
	labels: string[] | null;
	subtasks: string[] | null;
};

export type CreateTaskPayload = {
	title: string;
	description?: string;
	priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
	status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
	dueAt?: string;
};

export type UpdateTaskPayload = {
	title?: string;
	description?: string;
	priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
	status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
	dueAt?: string | null;
	completedAt?: string | null;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type Subtask = {
	id: string;
	title: string;
	description?: string;
	status: TaskStatus;
	completedAt?: string | null;
	createdAt: string;
	updatedAt: string;
	taskId: string;
};

export type Task = {
	id: string;
	title: string;
	description?: string;
	dueAt?: string | null;
	completedAt?: string | null;
	statusChangedAt?: string | null;
	status: TaskStatus;
	priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
	createdAt: string;
	updatedAt: string;
	userId: string;
	subtasks?: Subtask[];
};

const URL_OR_HOST_PATTERN = /(https?:\/\/|www\.|\.up\.railway\.app|localhost|\b(?:\d{1,3}\.){3}\d{1,3}\b|:\d{2,5}\b)/i;
const TECHNICAL_ERROR_PATTERN = /(failed to fetch|network request failed|econnrefused|enotfound|typeerror|unexpected token|stack|timeout of|xmlhttprequest|socket|fetch\s+failed|http\s*\d{3})/i;

function looksTechnicalOrSensitive(message: string): boolean {
	const value = message.trim();
	if (!value) return true;
	return URL_OR_HOST_PATTERN.test(value) || TECHNICAL_ERROR_PATTERN.test(value);
}

function normalizeApiMessage(message: string | undefined, status: number, code?: string): string {
	const trimmed = (message || '').trim();

	if (status === 0) {
		return 'Check your internet connection and try again.';
	}

	if (status === 401) {
		if (trimmed.toLowerCase().includes('invalid email') || trimmed.toLowerCase().includes('invalid password')) {
			return 'Invalid email or password.';
		}
		return 'Your session has expired. Please sign in again.';
	}

	if (status === 403) {
		return 'You do not have permission to do that.';
	}

	if (status === 404) {
		return 'The requested item is unavailable.';
	}

	if (status === 408 || status === 502 || status === 503 || status === 504) {
		return 'Service is temporarily unavailable. Please try again shortly.';
	}

	if (status === 429) {
		return 'Too many requests. Please try again later.';
	}

	if (status >= 500) {
		return 'Service is temporarily unavailable. Please try again shortly.';
	}

	if (!trimmed || looksTechnicalOrSensitive(trimmed)) {
		if (status === 400 || status === 422) {
			return 'Please review your input and try again.';
		}
		return 'Something went wrong. Please try again.';
	}

	return trimmed;
}

export function getUserFriendlyErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
	if (error instanceof ApiError) {
		return normalizeApiMessage(error.message, error.status, error.code);
	}

	if (error instanceof Error) {
		const lower = error.message.toLowerCase();
		if (lower.includes('abort') || lower.includes('timed out') || lower.includes('timeout')) {
			return 'Service is temporarily unavailable. Please try again shortly.';
		}
		if (looksTechnicalOrSensitive(error.message)) {
			return 'Check your internet connection and try again.';
		}
	}

	return fallback;
}

export class ApiError extends Error {
	status: number;
	code?: string;
	issues?: string[];

	constructor(message: string, status: number, code?: string, issues?: string[]) {
		super(normalizeApiMessage(message, status, code));
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.issues = issues;
	}
}

const API_REQUEST_TIMEOUT_MS = 15000;

function extractApiErrorDetails(payload: any): { message: string; code?: string; issues?: string[] } {
	const structuredError = payload?.error;

	if (structuredError && typeof structuredError === 'object') {
		return {
			message: structuredError.message || 'Request failed',
			code: structuredError.code,
			issues: Array.isArray(payload?.issues) ? payload.issues : undefined,
		};
	}

	if (typeof structuredError === 'string') {
		return {
			message: structuredError,
			issues: Array.isArray(payload?.issues) ? payload.issues : undefined,
		};
	}

	return {
		message: 'Request failed',
		issues: Array.isArray(payload?.issues) ? payload.issues : undefined,
	};
}

function normalizeUnknownErrorToApiError(error: unknown): ApiError {
	if (error instanceof ApiError) {
		return error;
	}

	if (error instanceof Error) {
		const lowerMessage = error.message.toLowerCase();
		if (lowerMessage.includes('timed out') || error.name === 'AbortError') {
			return new ApiError(
				'Service is temporarily unavailable. Please try again shortly.',
				408,
				'NETWORK_TIMEOUT',
			);
		}

		return new ApiError(
			'Check your internet connection and try again.',
			0,
			'NETWORK_ERROR',
		);
	}

	return new ApiError('Something went wrong. Please try again.', 0, 'NETWORK_ERROR');
}

async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

	try {
		return await fetch(`${API_BASE_URL}${path}`, {
			...init,
			signal: controller.signal,
		});
	} catch (error) {
		throw normalizeUnknownErrorToApiError(error);
	} finally {
		clearTimeout(timeout);
	}
}

export { getAuthToken, saveAuthToken, deleteAuthToken };

async function isCalendarSyncEnabled(): Promise<boolean> {
	return (await AsyncStorage.getItem(APP_CALENDAR_SYNC_ENABLED_KEY)) === 'true';
}

// Synchronous guard — prevents concurrent calendar sync operations (e.g. two
// simultaneous getTasks() calls both spawning reconcileCalendarSync), which
// would read the same task-event mapping, both create calendar events, and
// produce orphaned duplicates that never get cleaned up.
let calendarSyncInFlight = false;

async function runBestEffortCalendarSync(label: string, job: () => Promise<void>): Promise<void> {
	// Check the flag synchronously (before any await) so two calls in the same
	// event-loop tick are correctly serialised — the second will see the flag
	// already set by the first and exit immediately.
	if (calendarSyncInFlight) {
		return;
	}
	calendarSyncInFlight = true;

	try {
		if (!(await isCalendarSyncEnabled())) {
			return;
		}
		await job();
	} catch (error) {
		logger.warn('[CalendarSync] ' + label + ' failed');
	} finally {
		calendarSyncInFlight = false;
	}
}

export async function parseTask(text: string, timezone?: string): Promise<ParsedTaskResponse> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/ai/parse-task`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ text, timezone }),
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return payload as ParsedTaskResponse;
}

function inferAudioMimeTypeFromUri(uri: string): string {
	const normalized = uri.toLowerCase();
	if (normalized.endsWith('.m4a')) return 'audio/m4a';
	if (normalized.endsWith('.mp4')) return 'audio/mp4';
	if (normalized.endsWith('.mp3') || normalized.endsWith('.mpeg')) return 'audio/mpeg';
	if (normalized.endsWith('.wav')) return 'audio/wav';
	if (normalized.endsWith('.webm')) return 'audio/webm';
	if (normalized.endsWith('.ogg')) return 'audio/ogg';
	return 'audio/m4a';
}

export async function transcribeAudio(audioUri: string): Promise<{ text: string }> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const fileName = audioUri.split('/').pop() || `recording-${Date.now()}.m4a`;
	const mimeType = inferAudioMimeTypeFromUri(fileName);

	const formData = new FormData();
	formData.append('file', {
		uri: audioUri,
		name: fileName,
		type: mimeType,
	} as any);

	const response = await fetchWithTimeout(`/api/ai/transcribe`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: formData,
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	if (!payload || typeof payload.text !== 'string') {
		throw new ApiError('Invalid transcription response', 502, 'INVALID_TRANSCRIPTION_RESPONSE');
	}

	return { text: payload.text };
}

export async function createTask(payload: CreateTaskPayload): Promise<any> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/tasks`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const responsePayload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(responsePayload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	// Best-effort auto sync hook after successful create.
	if (responsePayload?.task?.id) {
		void runBestEffortCalendarSync('create task', async () => {
			await syncTaskToCalendar(responsePayload.task as Task);
		});
	}

	return responsePayload;
}

export async function getTasks(): Promise<Task[]> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/tasks`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
	});

	const responsePayload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(responsePayload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	const tasks = Array.isArray(responsePayload?.tasks) ? responsePayload.tasks : [];

	// Best-effort reconcile hook on task list load.
	void runBestEffortCalendarSync('reconcile tasks', async () => {
		await reconcileCalendarSync(tasks);
	});

	return tasks;
}

export async function getTaskById(taskId: string): Promise<Task> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/tasks/${taskId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
	});

	const responsePayload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(responsePayload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return responsePayload?.task as Task;
}

export async function deleteTaskById(taskId: string): Promise<void> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/tasks/${taskId}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		let payload: any = null;
		try {
			payload = await response.json();
		} catch {
			payload = null;
		}
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	// Best-effort cleanup hook after successful delete.
	void runBestEffortCalendarSync('delete task', async () => {
		await removeTaskFromCalendar(taskId);
	});
}

export async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/tasks/${taskId}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const responsePayload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(responsePayload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	const updatedTask = responsePayload?.task as Task;

	// Best-effort auto sync hook after successful update.
	if (updatedTask?.id) {
		void runBestEffortCalendarSync('update task', async () => {
			await syncTaskToCalendar(updatedTask);
		});
	}

	return updatedTask;
}

export type UpdateSubtaskPayload = {
	title?: string;
	description?: string;
	status?: TaskStatus;
	completedAt?: string | null;
};

export async function createSubtaskForTask(
	taskId: string,
	payload: { title: string; description?: string; status?: TaskStatus }
): Promise<Subtask> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/tasks/${taskId}/subtasks`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const responsePayload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(responsePayload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return responsePayload?.subtask as Subtask;
}

export async function updateSubtaskById(subtaskId: string, payload: UpdateSubtaskPayload): Promise<{
	subtask: Subtask;
	task?: Task | null;
}> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/subtasks/${subtaskId}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const responsePayload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(responsePayload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return {
		subtask: responsePayload?.subtask as Subtask,
		task: responsePayload?.task as Task | null,
	};
}

export async function deleteSubtaskById(subtaskId: string): Promise<void> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/subtasks/${subtaskId}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		let responsePayload: any = null;
		try {
			responsePayload = await response.json();
		} catch {
			responsePayload = null;
		}
		const details = extractApiErrorDetails(responsePayload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}
}

export type NotificationType =
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'
  | 'MORNING_OVERVIEW'
  | 'EVENING_REVIEW';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
	taskId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  userId: string;
};

export type NotificationSettings = {
	pushEnabled: boolean;
	morningOverview: boolean;
	eveningReview: boolean;
	dueSoonNotifications: boolean;
	overdueNotifications: boolean;
};

export type PushDeviceRegistrationPayload = {
	installationId: string;
	expoPushToken: string;
	platform: 'ios' | 'android';
	deviceName?: string;
	appVersion?: string;
	timezone?: string;
};

export type AvatarUploadSession = {
	uploadUrl: string;
	fileKey: string;
	avatarUrl: string;
	headers: Record<string, string>;
	expiresInSeconds: number;
	maxFileSizeBytes: number;
};

export async function getNotifications(): Promise<Notification[]> {
  const token = await getAuthToken();
  if (!token) {
    throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
  }

  const response = await fetchWithTimeout(`/api/notifications`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const details = extractApiErrorDetails(payload);
    throw new ApiError(details.message, response.status, details.code, details.issues);
  }

  return Array.isArray(payload?.notifications) ? payload.notifications : [];
}

export async function getUnreadNotificationCount(): Promise<number> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/notifications/unread-count`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return typeof payload?.unreadCount === 'number' ? payload.unreadCount : 0;
}

export async function markNotificationAsRead(notificationId: string): Promise<Notification> {
  const token = await getAuthToken();
  if (!token) {
    throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
  }

  const response = await fetchWithTimeout(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const details = extractApiErrorDetails(payload);
    throw new ApiError(details.message, response.status, details.code, details.issues);
  }

  return payload?.notification as Notification;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/notification-settings`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return payload?.settings as NotificationSettings;
}

export async function updateNotificationSettings(
	patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/notification-settings`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(patch),
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return payload?.settings as NotificationSettings;
}

export async function registerPushDevice(payload: PushDeviceRegistrationPayload): Promise<void> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/notification-devices/register`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const result = await response.json();
	if (!response.ok) {
		const details = extractApiErrorDetails(result);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}
}

export async function unregisterPushDevice(installationId: string): Promise<void> {
	const token = await getAuthToken();
	if (!token) {
		return;
	}

	const response = await fetchWithTimeout(`/api/notification-devices/unregister`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ installationId }),
	});

	if (!response.ok) {
		let payload: any = null;
		try {
			payload = await response.json();
		} catch {
			payload = null;
		}
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}
}

export type UserProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
	timezone: string;
	emailVerified: boolean;
  avatarUrl: string | null;
  authProvider: 'local' | 'google';
  createdAt: string;
};

export async function getUserProfile(): Promise<UserProfile> {
  const token = await getAuthToken();
  if (!token) {
    throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
  }

  const response = await fetchWithTimeout(`/api/user/profile`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const details = extractApiErrorDetails(payload);
    throw new ApiError(details.message, response.status, details.code, details.issues);
  }

  return payload?.user as UserProfile;
}

export async function updateUserProfile(data: {
  firstName?: string;
  lastName?: string;
}): Promise<UserProfile> {
  const token = await getAuthToken();
  if (!token) {
    throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
  }

  const response = await fetchWithTimeout(`/api/user/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await response.json();

  if (!response.ok) {
    const details = extractApiErrorDetails(payload);
    throw new ApiError(details.message, response.status, details.code, details.issues);
  }

  return payload?.user as UserProfile;
}

export async function requestAvatarUpload(data: {
	fileName: string;
	mimeType: string;
	fileSize: number;
}): Promise<AvatarUploadSession> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/uploads/avatar/presign`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return payload as AvatarUploadSession;
}

export async function updateUserAvatar(fileKey: string | null): Promise<UserProfile> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/user/profile/avatar`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ fileKey }),
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return payload?.user as UserProfile;
}

export async function deleteAccount(): Promise<void> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/user/delete`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}));
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code);
	}
}

export async function uploadUserAvatarImage(data: {
	uri: string;
	fileName?: string | null;
	mimeType?: string | null;
}): Promise<UserProfile> {
	const fileResponse = await fetch(data.uri);
	const fileBlob = await fileResponse.blob();
	const mimeType = data.mimeType || fileBlob.type || 'image/jpeg';
	const extension = mimeType.includes('/') ? mimeType.split('/')[1] : 'jpg';
	const fileName = data.fileName?.trim() || `avatar-${Date.now()}.${extension}`;
	const uploadSession = await requestAvatarUpload({
		fileName,
		mimeType,
		fileSize: fileBlob.size,
	});

	const uploadResponse = await fetch(uploadSession.uploadUrl, {
		method: 'PUT',
		headers: uploadSession.headers,
		body: fileBlob,
	});

	if (!uploadResponse.ok) {
		throw new ApiError('Failed to upload avatar image', uploadResponse.status || 500, 'UPLOAD_FAILED');
	}

	return updateUserAvatar(uploadSession.fileKey);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const details = extractApiErrorDetails(payload);
    throw new ApiError(details.message, response.status, details.code, details.issues);
  }
}

export async function validatePasswordResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
	const encoded = encodeURIComponent(token.trim());
	const response = await fetchWithTimeout(`/api/reset-password/validate?token=${encoded}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	});

	let payload: any = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return {
		valid: Boolean(payload?.valid),
		email: typeof payload?.email === 'string' ? payload.email : undefined,
	};
}

export async function submitPasswordReset(token: string, newPassword: string): Promise<void> {
	const response = await fetchWithTimeout(`/api/reset-password`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			token,
			newPassword,
		}),
	});

	let payload: any = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}
}

type AuthResponse = {
	message: string;
	token: string;
	user: {
		id: string;
		firstName: string | null;
		lastName: string | null;
		email: string;
		avatarUrl: string | null;
	};
};

export async function verifyEmailCode(email: string, code: string): Promise<AuthResponse> {
	const response = await fetchWithTimeout(`/api/email-verification/verify`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ email, code }),
	});

	let payload: any = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return payload as AuthResponse;
}

export async function resendEmailVerification(email: string): Promise<void> {
	const response = await fetchWithTimeout(`/api/email-verification/resend`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ email }),
	});

	let payload: any = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}
}

export type FocusSessionPayload = {
	taskId?: string;
	startedAt: string;
	endedAt: string;
	plannedDurationSeconds: number;
	actualDurationSeconds: number;
	completed: boolean;
	interrupted: boolean;
};

export async function recordFocusSession(payload: FocusSessionPayload): Promise<void> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetchWithTimeout(`/api/analytics/focus-sessions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	let result: any = null;
	try {
		result = await response.json();
	} catch {
		result = null;
	}

	if (!response.ok) {
		const details = extractApiErrorDetails(result);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}
}

export type AnalyticsPeriod = 'day' | 'week';

export type AnalyticsTrendPoint = {
	periodStart: string;
	label: string;
	count: number;
};

export type ProductivityAnalytics = {
	range: {
		startDate: string;
		endDate: string;
		period: AnalyticsPeriod;
	};
	overview: {
		totalCreated: number;
		totalCompleted: number;
		completionRate: number;
	};
	tasksByStatus: {
		TODO: number;
		IN_PROGRESS: number;
		COMPLETED: number;
		CANCELLED: number;
	};
	tasksByPriority: {
		LOW: number;
		MEDIUM: number;
		HIGH: number;
		URGENT: number;
	};
	trends: {
		created: AnalyticsTrendPoint[];
		completed: AnalyticsTrendPoint[];
	};
	productivity: {
		avgCompletionTimeHours: number | null;
		tasksCompletedInRange: number;
		tasksPerPeriod: AnalyticsTrendPoint[];
	};
	overdue: {
		overdueCount: number;
		onTimeCount: number;
		lateCount: number;
	};
};

export type GetAnalyticsOptions = {
	startDate?: string;
	endDate?: string;
	period?: AnalyticsPeriod;
};

export async function getProductivityAnalytics(options: GetAnalyticsOptions = {}): Promise<ProductivityAnalytics> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const query = new URLSearchParams();
	if (options.startDate) query.set('startDate', options.startDate);
	if (options.endDate) query.set('endDate', options.endDate);
	if (options.period) query.set('period', options.period);
	const queryString = query.toString();
	const path = queryString.length > 0
		? `${API_BASE_URL}/api/analytics/productivity?${queryString}`
		: `${API_BASE_URL}/api/analytics/productivity`;

	const response = await fetch(path, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
	});

	const payload = await response.json();

	if (!response.ok) {
		const details = extractApiErrorDetails(payload);
		throw new ApiError(details.message, response.status, details.code, details.issues);
	}

	return payload as ProductivityAnalytics;
}

export default API_BASE_URL;
