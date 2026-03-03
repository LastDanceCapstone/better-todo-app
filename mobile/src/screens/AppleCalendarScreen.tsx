import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useTheme } from "../theme";
import {
  addEventToPrioritizeCalendar,
  deleteCalendarEvent,
  listUpcomingPrioritizeEvents,
  requestAppleCalendarPermission,
  type AppCalendarEvent,
} from "../services/appleCalendar";

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

  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [events, setEvents] = useState<AppCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Add-task modal simple input
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");

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

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function onAddTask() {
    const t = title.trim();
    if (!t) {
      Alert.alert("Missing title", "Type a task title first.");
      return;
    }

    const mins = Number(durationMinutes);
    if (!Number.isFinite(mins) || mins <= 0) {
      Alert.alert("Bad duration", "Enter duration in minutes (example: 60).");
      return;
    }

    try {
      setLoading(true);

      const start = new Date(`${selectedDate}T09:00:00`); // default 9am
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + mins);

      await addEventToPrioritizeCalendar({
        title: t,
        notes: "Created from Prioritize",
        startDate: start,
        endDate: end,
      });

      setTitle("");
      setDurationMinutes("60");
      setShowAdd(false);

      await refresh();
      Alert.alert("Added ✅", "Task added to Apple Calendar.");
    } catch (e: any) {
      Alert.alert("Add failed", e?.message ?? "Could not add event.");
    } finally {
      setLoading(false);
    }
  }

  function onDelete(eventId: string) {
    Alert.alert("Delete event?", "This removes it from Apple Calendar.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            await deleteCalendarEvent(eventId);
            await refresh();
          } catch (e: any) {
            Alert.alert("Delete failed", e?.message ?? "Could not delete event.");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
          Calendar
        </Text>
        <Text style={{ marginTop: 6, color: colors.mutedText }}>
          Month view → tap a date → add/view/delete tasks in Apple Calendar.
        </Text>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Pressable
            onPress={refresh}
            style={{
              flex: 1,
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

          <Pressable
            onPress={() => setShowAdd(true)}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              Add Task
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Month calendar */}
      <View style={{ paddingHorizontal: 12 }}>
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
      <View style={{ padding: 16, paddingTop: 10, flex: 1 }}>
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

                <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "flex-end" }}>
                  <Pressable
                    onPress={() => onDelete(e.id)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: "#C0392B",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Simple Add panel */}
      {showAdd ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
            Add task on {selectedDate}
          </Text>

          <Text style={{ marginTop: 10, color: colors.mutedText }}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Study orgo"
            placeholderTextColor={colors.mutedText}
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              color: colors.text,
            }}
          />

          <Text style={{ marginTop: 10, color: colors.mutedText }}>Duration (minutes)</Text>
          <TextInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
            placeholder="60"
            placeholderTextColor={colors.mutedText}
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              color: colors.text,
            }}
          />

          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <Pressable
              onPress={() => setShowAdd(false)}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={onAddTask}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}