import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';

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

export class ApiError extends Error {
	status: number;
	code?: string;
	issues?: string[];

	constructor(message: string, status: number, code?: string, issues?: string[]) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.issues = issues;
	}
}

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

export async function getAuthToken(): Promise<string | null> {
	return AsyncStorage.getItem('authToken');
}

export async function parseTask(text: string, timezone?: string): Promise<ParsedTaskResponse> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetch(`${API_BASE_URL}/api/ai/parse-task`, {
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

export async function createTask(payload: CreateTaskPayload): Promise<any> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetch(`${API_BASE_URL}/api/tasks`, {
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

	return responsePayload;
}

export async function getTasks(): Promise<Task[]> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetch(`${API_BASE_URL}/api/tasks`, {
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

	return Array.isArray(responsePayload?.tasks) ? responsePayload.tasks : [];
}

export async function deleteTaskById(taskId: string): Promise<void> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
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
}

export async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
	const token = await getAuthToken();
	if (!token) {
		throw new ApiError('No authentication token found. Please log in again.', 401, 'UNAUTHORIZED');
	}

	const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
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

	return responsePayload?.task as Task;
}

export default API_BASE_URL;
