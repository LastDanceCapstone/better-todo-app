import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export const requestCalendarPermission = async (): Promise<boolean> => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
};

export const getOrCreatePrioritizeCalendarId = async (): Promise<string> => {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === 'Prioritize');
  if (existing) return existing.id;

  const defaultCalendar =
    Platform.OS === 'ios'
      ? await Calendar.getDefaultCalendarAsync()
      : calendars.find((c) => c.accessLevel === 'owner');

  if (!defaultCalendar) throw new Error('No writable calendar found');

  return Calendar.createCalendarAsync({
    title: 'Prioritize',
    color: '#2563EB',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (defaultCalendar as any).source?.id,
    source: (defaultCalendar as any).source ?? { name: 'Prioritize', type: 'LOCAL' },
    name: 'Prioritize',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
};

export const addEventToPrioritizeCalendar = async (event: {
  title: string;
  notes?: string;
  startDate: Date;
  endDate: Date;
}): Promise<string> => {
  const calId = await getOrCreatePrioritizeCalendarId();
  return Calendar.createEventAsync(calId, {
    title: event.title,
    notes: event.notes,
    startDate: event.startDate,
    endDate: event.endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
};

export const listUpcomingPrioritizeEvents = async (daysAhead = 60) => {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'granted') return [];
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const cal = calendars.find((c) => c.title === 'Prioritize');
    if (!cal) return [];
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);
    const events = await Calendar.getEventsAsync([cal.id], start, end);
    return events.map((e) => ({
      title: e.title,
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
    }));
  } catch {
    return [];
  }
};