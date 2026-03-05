import * as Calendar from "expo-calendar";

const APP_CALENDAR_TITLE = "Prioritize";

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

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function getDefaultSourceIOS() {
  // iOS needs a "source" when creating a calendar
  const sources = await Calendar.getSourcesAsync();
  return sources.length
    ? (
    sources.find((s: { name?: string }) => s.name === "iCloud") ??
    sources.find((s: { name?: string }) => s.name === "Default") ??
    sources[0]
      )
    : undefined;
}

/**
 * Creates (or finds) an "Prioritize" calendar and returns its ID.
 * Using a dedicated calendar prevents mixing with user's personal calendars.
 */
export async function getOrCreatePrioritizeCalendarId(): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c: { title?: string; id?: string }) => c.title === APP_CALENDAR_TITLE);
  if (existing?.id) return existing.id;

  if (process.env.EXPO_OS === "android") {
    // For Android, a local calendar creation needs different fields; Expo handles some cases,
    // but this project is focused on Apple Calendar (iOS).
    // We’ll still try to create a local calendar for completeness.
  }

  const source = await getDefaultSourceIOS();
  const fallbackCalendar = calendars[0] as
    | {
        source?: Calendar.Source;
        sourceId?: string;
        ownerAccount?: string;
      }
    | undefined;

  if (!source && !fallbackCalendar?.source && !fallbackCalendar?.sourceId) {
    throw new Error("No calendar source available on this device.");
  }

  const newCalendarId = await Calendar.createCalendarAsync({
    title: APP_CALENDAR_TITLE,
    entityType: Calendar.EntityTypes.EVENT,
    color: "#1E90FF",
    sourceId: source?.id ?? fallbackCalendar?.sourceId,
    source: source ?? fallbackCalendar?.source,
    name: APP_CALENDAR_TITLE,
    ownerAccount: fallbackCalendar?.ownerAccount ?? "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return newCalendarId;
}

export async function addEventToPrioritizeCalendar(
  input: AppCalendarEventInput
): Promise<string> {
  const ok = await requestCalendarPermission();
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
  const ok = await requestCalendarPermission();
  if (!ok) throw new Error("Calendar permission not granted.");

  const calendarId = await getOrCreatePrioritizeCalendarId();

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);

  const raw = await Calendar.getEventsAsync([calendarId], start, end);

  return raw
    .filter((e: { startDate?: string | Date; endDate?: string | Date }) => e.startDate && e.endDate)
    .map((e: { id: string; title?: string; startDate: string | Date; endDate: string | Date; notes?: string | null }) => ({
      id: e.id,
      title: e.title ?? "(No title)",
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      notes: e.notes ?? null,
    }))
    .sort((a: AppCalendarEvent, b: AppCalendarEvent) => a.startDate.getTime() - b.startDate.getTime());
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const ok = await requestCalendarPermission();
  if (!ok) throw new Error("Calendar permission not granted.");

  await Calendar.deleteEventAsync(eventId);
}
