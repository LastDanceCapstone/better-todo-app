import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import type { Task } from '../config/api';
import {
  getOrCreatePrioritizeCalendarId,
  getPrioritizeCalendarIdIfExists,
  requestCalendarPermission,
} from './calendarApp';

const TASK_EVENT_MAP_STORAGE_KEY = 'prioritizeCalendarTaskEventMapV1';
const DEFAULT_EVENT_DURATION_MINUTES = 45;

/*
QA checklist (dev build / native runtime):
1. Create a task with a valid due date and verify an event appears in Prioritize calendar.
2. Update the task title or due date and verify the existing event is updated.
3. Delete the task and verify the mapped event is removed.
4. Relaunch the app and verify reconciliation keeps mappings/events consistent.
5. Manually remove an event in Calendar app, then trigger reconcile and verify event recreation.
*/

type TaskEventMappingEntry = {
  eventId: string;
  calendarId: string;
  signature: string;
};

type TaskEventMapping = Record<string, TaskEventMappingEntry>;

export type SyncTaskAction = 'created' | 'updated' | 'unchanged' | 'recreated' | 'removed' | 'skipped';

export type SyncTaskResult = {
  taskId: string;
  action: SyncTaskAction;
  eventId?: string;
};

export type CalendarSyncSummary = {
  created: number;
  updated: number;
  unchanged: number;
  recreated: number;
  removed: number;
  skipped: number;
};

function emptySummary(): CalendarSyncSummary {
  return {
    created: 0,
    updated: 0,
    unchanged: 0,
    recreated: 0,
    removed: 0,
    skipped: 0,
  };
}

function parseDueDate(dueAt?: string | null): Date | null {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildTaskSignature(task: Task): string {
  const due = parseDueDate(task.dueAt);
  const dueIso = due ? due.toISOString() : 'none';
  return task.id + '|' + task.title + '|' + dueIso;
}

function buildEventInput(task: Task) {
  const startDate = parseDueDate(task.dueAt);
  if (!startDate) {
    if (task.dueAt) {
      console.warn('[CalendarSync] Invalid due date, skipping task sync for taskId=' + task.id);
    }
    return null;
  }

  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + DEFAULT_EVENT_DURATION_MINUTES);

  const notesParts: string[] = ['Synced from Prioritize', 'Task ID: ' + task.id];
  if (task.description) {
    notesParts.push('', task.description);
  }

  return {
    title: task.title,
    notes: notesParts.join('\n'),
    startDate,
    endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function dateEquals(left?: string | Date | null, right?: Date | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return new Date(left).getTime() === right.getTime();
}

async function loadTaskEventMapping(): Promise<TaskEventMapping> {
  const raw = await AsyncStorage.getItem(TASK_EVENT_MAP_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const mapping: TaskEventMapping = {};
    for (const [taskId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as TaskEventMappingEntry).eventId === 'string' &&
        typeof (value as TaskEventMappingEntry).calendarId === 'string' &&
        typeof (value as TaskEventMappingEntry).signature === 'string'
      ) {
        mapping[taskId] = value as TaskEventMappingEntry;
      }
    }

    return mapping;
  } catch {
    return {};
  }
}

async function saveTaskEventMapping(mapping: TaskEventMapping): Promise<void> {
  await AsyncStorage.setItem(TASK_EVENT_MAP_STORAGE_KEY, JSON.stringify(mapping));
}

async function getPrioritizeEventById(eventId: string): Promise<Calendar.Event | null> {
  try {
    const event = await Calendar.getEventAsync(eventId);
    return event ?? null;
  } catch {
    return null;
  }
}

async function deleteMappedEventIfPresent(
  entry: TaskEventMappingEntry,
  prioritizeCalendarId: string
): Promise<void> {
  const event = await getPrioritizeEventById(entry.eventId);
  if (!event) {
    console.warn('[CalendarSync] Mapped event not found during delete, eventId=' + entry.eventId);
    return;
  }
  if (event.calendarId !== prioritizeCalendarId) {
    console.warn('[CalendarSync] Refusing delete for non-Prioritize calendar eventId=' + entry.eventId);
    return;
  }

  try {
    await Calendar.deleteEventAsync(entry.eventId);
  } catch (error) {
    console.error('[CalendarSync] Failed deleting eventId=' + entry.eventId, error);
    throw error;
  }
}

async function syncTaskWithMapping(
  task: Task,
  mapping: TaskEventMapping,
  prioritizeCalendarId: string
): Promise<SyncTaskResult> {
  const taskId = task.id;
  const eventInput = buildEventInput(task);
  const existingMap = mapping[taskId];

  if (!eventInput) {
    if (existingMap) {
      await deleteMappedEventIfPresent(existingMap, prioritizeCalendarId);
      delete mapping[taskId];
      return { taskId, action: 'removed' };
    }

    return { taskId, action: 'skipped' };
  }

  const signature = buildTaskSignature(task);

  if (!existingMap) {
    let eventId = '';
    try {
      eventId = await Calendar.createEventAsync(prioritizeCalendarId, eventInput);
    } catch (error) {
      console.error('[CalendarSync] Failed creating calendar event for taskId=' + taskId, error);
      throw error;
    }
    mapping[taskId] = { eventId, calendarId: prioritizeCalendarId, signature };
    return { taskId, action: 'created', eventId };
  }

  const existingEvent = await getPrioritizeEventById(existingMap.eventId);
  const eventMissing = !existingEvent || existingEvent.calendarId !== prioritizeCalendarId;

  if (eventMissing) {
    if (existingMap && !existingEvent) {
      console.warn('[CalendarSync] Missing mapped event, recreating for taskId=' + taskId);
    }
    if (existingEvent && existingEvent.calendarId !== prioritizeCalendarId) {
      console.warn('[CalendarSync] Mapped event points to non-Prioritize calendar, recreating taskId=' + taskId);
    }

    let recreatedEventId = '';
    try {
      recreatedEventId = await Calendar.createEventAsync(prioritizeCalendarId, eventInput);
    } catch (error) {
      console.error('[CalendarSync] Failed recreating event for taskId=' + taskId, error);
      throw error;
    }

    mapping[taskId] = { eventId: recreatedEventId, calendarId: prioritizeCalendarId, signature };
    return { taskId, action: 'recreated', eventId: recreatedEventId };
  }

  const titleChanged = existingEvent.title !== eventInput.title;
  const startChanged = !dateEquals(existingEvent.startDate, eventInput.startDate);
  const endChanged = !dateEquals(existingEvent.endDate, eventInput.endDate);
  const notesChanged = (existingEvent.notes ?? '') !== eventInput.notes;
  const needsUpdate = titleChanged || startChanged || endChanged || notesChanged;

  if (needsUpdate) {
    try {
      await Calendar.updateEventAsync(existingMap.eventId, eventInput);
    } catch (error) {
      console.error('[CalendarSync] Failed updating eventId=' + existingMap.eventId, error);
      throw error;
    }

    mapping[taskId] = {
      eventId: existingMap.eventId,
      calendarId: prioritizeCalendarId,
      signature,
    };

    return { taskId, action: 'updated', eventId: existingMap.eventId };
  }

  mapping[taskId] = {
    eventId: existingMap.eventId,
    calendarId: prioritizeCalendarId,
    signature,
  };

  return { taskId, action: 'unchanged', eventId: existingMap.eventId };
}

function applyResultToSummary(summary: CalendarSyncSummary, result: SyncTaskResult): void {
  summary[result.action] += 1;
}

async function ensurePermissionAndCalendar(): Promise<string> {
  const ok = await requestCalendarPermission();
  if (!ok) {
    console.warn('[CalendarSync] Calendar permission denied. Sync skipped.');
    throw new Error('Calendar permission not granted.');
  }

  return getOrCreatePrioritizeCalendarId();
}

export async function syncTaskToCalendar(task: Task): Promise<SyncTaskResult> {
  try {
    const prioritizeCalendarId = await ensurePermissionAndCalendar();
    const mapping = await loadTaskEventMapping();
    const result = await syncTaskWithMapping(task, mapping, prioritizeCalendarId);
    await saveTaskEventMapping(mapping);
    return result;
  } catch (error) {
    console.error('[CalendarSync] syncTaskToCalendar failed for taskId=' + task.id, error);
    return { taskId: task.id, action: 'skipped' };
  }
}

export async function syncAllTasksToCalendar(tasks: Task[]): Promise<CalendarSyncSummary> {
  const summary = emptySummary();

  let prioritizeCalendarId = '';
  try {
    prioritizeCalendarId = await ensurePermissionAndCalendar();
  } catch {
    summary.skipped = tasks.length;
    return summary;
  }

  const mapping = await loadTaskEventMapping();

  for (const task of tasks) {
    try {
      const result = await syncTaskWithMapping(task, mapping, prioritizeCalendarId);
      applyResultToSummary(summary, result);
    } catch (error) {
      console.error('[CalendarSync] syncAll failed for taskId=' + task.id, error);
      summary.skipped += 1;
    }
  }

  await saveTaskEventMapping(mapping);
  return summary;
}

export async function removeTaskFromCalendar(taskId: string): Promise<boolean> {
  try {
    const mapping = await loadTaskEventMapping();
    const entry = mapping[taskId];
    if (!entry) {
      console.warn('[CalendarSync] Missing event mapping for deleted taskId=' + taskId);
      return false;
    }

    const permission = await requestCalendarPermission();
    if (!permission) {
      console.warn('[CalendarSync] Calendar permission denied during remove for taskId=' + taskId);
      return false;
    }

    const prioritizeCalendarId = await getPrioritizeCalendarIdIfExists();
    if (prioritizeCalendarId) {
      await deleteMappedEventIfPresent(entry, prioritizeCalendarId);
    }

    delete mapping[taskId];
    await saveTaskEventMapping(mapping);
    return true;
  } catch (error) {
    console.error('[CalendarSync] removeTaskFromCalendar failed for taskId=' + taskId, error);
    return false;
  }
}

export async function reconcileCalendarSync(tasks: Task[]): Promise<CalendarSyncSummary> {
  const summary = emptySummary();

  let prioritizeCalendarId = '';
  try {
    prioritizeCalendarId = await ensurePermissionAndCalendar();
  } catch {
    summary.skipped = tasks.length;
    return summary;
  }

  const mapping = await loadTaskEventMapping();

  const activeTaskIds = new Set<string>();

  for (const task of tasks) {
    activeTaskIds.add(task.id);
    try {
      const result = await syncTaskWithMapping(task, mapping, prioritizeCalendarId);
      applyResultToSummary(summary, result);
    } catch (error) {
      console.error('[CalendarSync] reconcile failed for taskId=' + task.id, error);
      summary.skipped += 1;
    }
  }

  for (const [taskId, entry] of Object.entries(mapping)) {
    if (activeTaskIds.has(taskId)) continue;

    try {
      await deleteMappedEventIfPresent(entry, prioritizeCalendarId);
      delete mapping[taskId];
      summary.removed += 1;
    } catch (error) {
      console.error('[CalendarSync] reconcile cleanup failed for taskId=' + taskId, error);
      summary.skipped += 1;
    }
  }

  await saveTaskEventMapping(mapping);
  return summary;
}
