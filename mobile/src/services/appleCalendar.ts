import * as Calendar from "expo-calendar";

const APP_CALENDAR_TITLE = "Prioritize";

/** Stored in event notes to link a calendar event to an app task. */
export const TASK_ID_PREFIX = "prioritize_task_id:";

function notesWithTaskId(taskId: string): string {
  return `${TASK_ID_PREFIX}${taskId}`;
}

function parseTaskIdFromNotes(notes?: string | null): string | null {
  if (!notes || !notes.includes(TASK_ID_PREFIX)) return null;
  const start = notes.indexOf(TASK_ID_PREFIX) + TASK_ID_PREFIX.length;
  const end = notes.indexOf("\n", start);
  return end === -1 ? notes.slice(start).trim() : notes.slice(start, end).trim();
}

export type AppCalendarEventInput = {
  title: string;
  notes?: string;
  startDate: Date;
  endDate: Date;
};

export type AppCalendarEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string | null;
};

export async function requestAppleCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function getDefaultSourceIOS() {
  // iOS needs a "source" when creating a calendar
  const sources = await Calendar.getSourcesAsync();
  return (
    sources.find((s) => s.name === "iCloud") ??
    sources.find((s) => s.name === "Default") ??
    sources[0]
  );
}

/**
 * Creates (or finds) an "Prioritize" calendar and returns its ID.
 * Using a dedicated calendar prevents mixing with user's personal calendars.
 */
export async function getOrCreatePrioritizeCalendarId(): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === APP_CALENDAR_TITLE);
  if (existing?.id) return existing.id;

  if (process.env.EXPO_OS === "android") {
    // For Android, a local calendar creation needs different fields; Expo handles some cases,
    // but this project is focused on Apple Calendar (iOS).
    // We’ll still try to create a local calendar for completeness.
  }

  const source = await getDefaultSourceIOS();

  const newCalendarId = await Calendar.createCalendarAsync({
    title: APP_CALENDAR_TITLE,
    entityType: Calendar.EntityTypes.EVENT,
    color: "#1E90FF",
    sourceId: source?.id,
    source,
    name: APP_CALENDAR_TITLE,
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return newCalendarId;
}

export async function addEventToPrioritizeCalendar(
  input: AppCalendarEventInput
): Promise<string> {
  const ok = await requestAppleCalendarPermission();
  if (!ok) throw new Error("Calendar permission not granted.");

  const calendarId = await getOrCreatePrioritizeCalendarId();

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: input.title,
    notes: input.notes ?? "",
    startDate: input.startDate,
    endDate: input.endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return eventId;
}

export async function listUpcomingPrioritizeEvents(daysAhead = 14): Promise<AppCalendarEvent[]> {
  const ok = await requestAppleCalendarPermission();
  if (!ok) throw new Error("Calendar permission not granted.");

  const calendarId = await getOrCreatePrioritizeCalendarId();

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);

  const raw = await Calendar.getEventsAsync([calendarId], start, end);

  return raw
    .filter((e) => e.startDate && e.endDate)
    .map((e) => ({
      id: e.id,
      title: e.title ?? "(No title)",
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      notes: e.notes ?? null,
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const ok = await requestAppleCalendarPermission();
  if (!ok) throw new Error("Calendar permission not granted.");

  await Calendar.deleteEventAsync(eventId);
}

// ---------- Task sync: link app tasks (from API) to calendar events ----------

function dueAtToStartEnd(dueAtIso: string): { startDate: Date; endDate: Date } {
  const d = new Date(dueAtIso);
  const startDate = new Date(d);
  startDate.setSeconds(0, 0);
  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + 30);
  return { startDate, endDate };
}

/** List events in a wide range and return those that have a taskId in notes (synced from app tasks). */
export async function listSyncedTaskEvents(
  daysBack = 30,
  daysAhead = 400
): Promise<Array<AppCalendarEvent & { taskId: string }>> {
  const ok = await requestAppleCalendarPermission();
  if (!ok) throw new Error("Calendar permission not granted.");

  const calendarId = await getOrCreatePrioritizeCalendarId();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);

  const raw = await Calendar.getEventsAsync([calendarId], start, end);
  const result: Array<AppCalendarEvent & { taskId: string }> = [];

  for (const e of raw) {
    if (!e.startDate || !e.endDate) continue;
    const taskId = parseTaskIdFromNotes(e.notes ?? null);
    if (!taskId) continue;
    result.push({
      id: e.id,
      title: e.title ?? "(No title)",
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      notes: e.notes ?? null,
      taskId,
    });
  }

  return result.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/** Find calendar event id for a given app task id (by scanning notes). */
async function findEventIdByTaskId(taskId: string): Promise<string | null> {
  const events = await listSyncedTaskEvents(30, 400);
  const found = events.find((e) => e.taskId === taskId);
  return found?.id ?? null;
}

/**
 * Create a calendar event for an app task (so it shows on the device calendar).
 * Call after creating a task with a due date.
 */
export async function createEventForTask(
  taskId: string,
  title: string,
  dueAtIso: string
): Promise<string> {
  const ok = await requestAppleCalendarPermission();
  if (!ok) throw new Error("Calendar permission not granted.");

  const calendarId = await getOrCreatePrioritizeCalendarId();
  const { startDate, endDate } = dueAtToStartEnd(dueAtIso);

  const eventId = await Calendar.createEventAsync(calendarId, {
    title,
    notes: notesWithTaskId(taskId),
    startDate,
    endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return eventId;
}

/**
 * Update the calendar event for an app task (title/due date).
 * Call after updating a task that has a due date.
 */
export async function updateEventForTask(
  taskId: string,
  title: string,
  dueAtIso: string
): Promise<void> {
  const eventId = await findEventIdByTaskId(taskId);
  if (!eventId) {
    await createEventForTask(taskId, title, dueAtIso);
    return;
  }

  const { startDate, endDate } = dueAtToStartEnd(dueAtIso);
  await Calendar.updateEventAsync(eventId, {
    title,
    notes: notesWithTaskId(taskId),
    startDate,
    endDate,
  });
}

/**
 * Remove the calendar event linked to an app task.
 * Call after deleting a task or when the task no longer has a due date.
 */
export async function deleteEventForTask(taskId: string): Promise<void> {
  const eventId = await findEventIdByTaskId(taskId);
  if (eventId) await Calendar.deleteEventAsync(eventId);
}