import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';

// ─── Auth Token ───────────────────────────────────────────────────────────────

export const getAuthToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem('authToken');
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type Task = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  completedAt?: string;
  statusChangedAt?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  userId: string;
  subtasks?: SubTask[];
};

export type SubTask = {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  taskId: string;
};

export type ParsedTaskResponse = {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subtasks?: string[];
};

// ─── ApiError ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  issues?: string[];

  constructor(message: string, status: number, issues?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const authHeaders = async () => {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res: Response) => {
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data?.error || data?.message || 'Something went wrong',
      res.status,
      data?.issues
    );
  }
  return data;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginUser = async (
  email: string,
  password: string
): Promise<{ token: string; user: any }> => {
  const res = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
};

export const registerUser = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<{ token: string; user: any }> => {
  const res = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password }),
  });
  return handleResponse(res);
};

export const getUserProfile = async (): Promise<{ user: any }> => {
  const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  return handleResponse(res);
};

export const forgotPassword = async (email: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
};

export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  return handleResponse(res);
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const getTasks = async (): Promise<Task[]> => {
  const res = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await handleResponse(res);
  return data.tasks ?? [];
};

export const createTask = async (
  taskData: Partial<Task>
): Promise<{ task: Task }> => {
  const res = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(taskData),
  });
  return handleResponse(res);
};

export const updateTask = async (
  id: string,
  data: Partial<Task>
): Promise<Task> => {
  const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  const result = await handleResponse(res);
  return result.task ?? result;
};

export const deleteTaskById = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  return handleResponse(res);
};

// ─── AI Parse ─────────────────────────────────────────────────────────────────

export const parseTask = async (
  input: string,
  timezone: string
): Promise<ParsedTaskResponse> => {
  const res = await fetch(`${API_BASE_URL}/api/ai/parse-task`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ input, timezone }),
  });
  return handleResponse(res);
};