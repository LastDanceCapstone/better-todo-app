import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import ScreenWrapper from "../components/ScreenWrapper";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import StatCard from "../components/StatCard";
import TaskCard from "../components/TaskCard";
import theme from "../theme/theme";

type Task = {
  id: string;
  title: string;
  category: string;
  completed: boolean;
};

export default function DashboardScreen() {
  const [taskText, setTaskText] = useState("");
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", title: "Study biology notes", category: "Study", completed: false },
    { id: "2", title: "Finish app UI polish", category: "Project", completed: true },
    { id: "3", title: "Plan tomorrow tasks", category: "Planning", completed: false },
  ]);

  const activeCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks]
  );

  const completedCount = useMemo(
    () => tasks.filter((t) => t.completed).length,
    [tasks]
  );

  const addTask = () => {
    if (!taskText.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: taskText,
      category: "General",
      completed: false,
    };

    setTasks((prev) => [newTask, ...prev]);
    setTaskText("");
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleComplete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    );
  };

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.name}>Prioritize Dashboard</Text>
          </View>

          <TouchableOpacity style={styles.profileCircle}>
            <Text style={styles.profileText}>D</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Stay Ahead, Stay Organized</Text>
          <Text style={styles.heroSubtitle}>
            Manage your day beautifully and keep your tasks in control.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Active" value={activeCount} />
          <StatCard label="Completed" value={completedCount} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Task</Text>
          <AppInput
            label="Task Title"
            placeholder="Enter your task..."
            value={taskText}
            onChangeText={setTaskText}
          />
          <AppButton title="Add Task" onPress={addTask} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Tasks</Text>

          {tasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              activeOpacity={0.9}
              onPress={() => toggleComplete(task.id)}
            >
              <TaskCard
                title={task.title}
                category={task.category}
                completed={task.completed}
                onDelete={() => deleteTask(task.id)}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  greeting: {
    color: theme.colors.subtext,
    fontSize: theme.fontSize.sm,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: "800",
    marginTop: 2,
  },
  profileCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.card2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  profileText: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: theme.fontSize.md,
  },
  heroCard: {
    backgroundColor: theme.colors.card2,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: "800",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: theme.colors.subtext,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: "800",
    marginBottom: theme.spacing.md,
  },
});