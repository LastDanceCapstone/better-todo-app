import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../theme";
import {
  createEventForTask,
  deleteEventForTask,
  listSyncedTaskEvents,
  listUpcomingPrioritizeEvents,
  requestAppleCalendarPermission,
  updateEventForTask,
  type AppCalendarEvent,
} from "../services/appleCalendar";
import { API_BASE_URL, getAuthToken } from "../config/api";

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function AppleCalendarScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [events, setEvents] = useState<AppCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      setLoading(true);
      const ok = await requestAppleCalendarPermission();
      if (!ok) {
        Alert.alert("Permission needed", "Please allow Calendar permission in Settings.");
        return;
      }
      const list = await listUpcomingPrioritizeEvents(60); // next 60 days
      setEvents(list);
    } catch (e: any) {
      Alert.alert("Calendar error", e?.message ?? "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  /** Sync app tasks (from API) to the Prioritize calendar: create/update events for tasks with due dates, remove events for deleted tasks. */
  async function syncFromTasksToCalendar() {
    const ok = await requestAppleCalendarPermission();
    if (!ok) return;

    const token = await getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const tasks: Array<{ id: string; title: string; dueAt?: string | null; status?: string }> = data.tasks ?? [];

      const taskIdsToKeepOnCalendar = new Set<string>();
      for (const task of tasks) {
        const active = task.status !== "COMPLETED" && task.status !== "CANCELLED";
        if (task.dueAt && active) {
          taskIdsToKeepOnCalendar.add(task.id);
          await updateEventForTask(task.id, task.title, task.dueAt);
        }
      }

      const synced = await listSyncedTaskEvents(30, 400);
      for (const ev of synced) {
        if (!taskIdsToKeepOnCalendar.has(ev.taskId)) {
          await deleteEventForTask(ev.taskId);
        }
      }
    } catch (_) {
      // Ignore sync errors (e.g. network); calendar still shows existing events
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      syncFromTasksToCalendar().then(() => refresh());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const selectedDayEvents = useMemo(() => {
    const target = new Date(`${selectedDate}T00:00:00`);
    return events.filter((e) => sameDay(e.startDate, target));
  }, [events, selectedDate]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    // mark selected date
    marks[selectedDate] = {
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: "white",
    };

    // mark dates with events (dots)
    for (const e of events) {
      const key = toISODate(e.startDate);
      if (!marks[key]) marks[key] = {};
      marks[key].marked = true;
      marks[key].dotColor = colors.primary;
    }

    return marks;
  }, [events, selectedDate, colors.primary]);

  const horizontalPadding = Math.max(16, insets.left, insets.right);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
          Calendar
        </Text>
        <Text style={{ marginTop: 6, color: colors.mutedText }}>
          Tasks with due dates sync here. Tap a date to view events.
        </Text>

        <Pressable
          onPress={refresh}
          style={{
            marginTop: 12,
            backgroundColor: colors.surface,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
          disabled={loading}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {loading ? "Loading..." : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {/* Month calendar */}
      <View style={{ paddingHorizontal: horizontalPadding }}>
        <Calendar
          markedDates={markedDates}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          theme={{
            calendarBackground: colors.background,
            dayTextColor: colors.text,
            monthTextColor: colors.text,
            textDisabledColor: colors.mutedText,
            todayTextColor: colors.primary,
            arrowColor: colors.text,
          }}
        />
      </View>

      {/* Events list for selected day */}
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 10, paddingBottom: 16, flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
          {selectedDate} — Tasks
        </Text>

        <ScrollView style={{ marginTop: 10 }}>
          {selectedDayEvents.length === 0 ? (
            <Text style={{ color: colors.mutedText }}>No tasks on this day.</Text>
          ) : (
            selectedDayEvents.map((e) => (
              <View
                key={e.id}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>{e.title}</Text>
                <Text style={{ color: colors.mutedText, marginTop: 4 }}>
                  {e.startDate.toLocaleTimeString()} → {e.endDate.toLocaleTimeString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}