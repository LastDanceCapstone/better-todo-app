// app/home.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';

type TaskStatus = 'ACTIVE' | 'COMPLETED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate?: string; // YYYY-MM-DD
  status: TaskStatus;
  priority?: Priority;
};

// default demo tasks
const DEFAULT_TASKS: Task[] = [
  {
    id: '1',
    title: 'Complete Math Homework',
    description: 'Complete Homework 2 for Math Class.',
    dueDate: '2025-10-30',
    status: 'ACTIVE',
    priority: 'HIGH',
  },
  {
    id: '2',
    title: 'Grocery Run',
    description: 'Take the created grocery list and go shopping.',
    dueDate: '2025-10-31',
    status: 'ACTIVE',
    priority: 'MEDIUM',
  },
  {
    id: '3',
    title: 'Submit Research Proposal',
    description: 'Submit final draft of research proposal.',
    dueDate: '2025-11-04',
    status: 'ACTIVE',
    priority: 'LOW',
  },
];

// date helpers
const formatDueDate = (dueDate?: string) => {
  if (!dueDate) return 'No due date';

  const date = new Date(dueDate);
  if (isNaN(date.getTime())) return 'No due date';

  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `${diffDays} days left`;
};

const formatDisplayDate = (dueDate?: string) => {
  if (!dueDate) return 'No due date';

  const date = new Date(dueDate);
  if (isNaN(date.getTime())) return 'No due date';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function HomeScreen() {
  const params = useLocalSearchParams<{ email?: string }>();

  const [tab, setTab] = useState<TaskStatus>('ACTIVE');
  const [activeNav, setActiveNav] =
    useState<'Home' | 'Create' | 'Calendar' | 'Account'>('Home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userName, setUserName] = useState('User');

  // Load username
  useEffect(() => {
    const loadUser = async () => {
      try {
        if (params.email) {
          setUserName(params.email.split('@')[0]);
        } else {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed.firstName) {
              setUserName(parsed.firstName);
            }
          }
        }
      } catch (e) {
        console.log('Error loading user', e);
      }
    };
    loadUser();
  }, [params.email]);

  // Load tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const json = await AsyncStorage.getItem('tasks');
        if (json) {
          setTasks(JSON.parse(json));
        } else {
          setTasks(DEFAULT_TASKS);
          await AsyncStorage.setItem('tasks', JSON.stringify(DEFAULT_TASKS));
        }
      } catch (e) {
        console.error('Error loading tasks', e);
        Alert.alert('Error', 'Could not load tasks from storage.');
      }
    };
    loadTasks();
  }, []);

  const saveTasks = async (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
    } catch (e) {
      console.error('Error saving tasks', e);
      Alert.alert('Error', 'Could not save tasks.');
    }
  };

  const handleToggleStatus = (id: string) => {
    const updatedTasks: Task[] = tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            status: task.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE',
          }
        : task
    );
    saveTasks(updatedTasks);
  };

  const handleDeleteTask = (id: string) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updatedTasks = tasks.filter((t) => t.id !== id);
          saveTasks(updatedTasks);
        },
      },
    ]);
  };

  const filteredTasks = tasks.filter((t) =>
    tab === 'ACTIVE' ? t.status === 'ACTIVE' : t.status === 'COMPLETED'
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header (no 'home' title text at top) */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <MaterialIcons name="account-circle" size={48} color="#E0E0E0" />
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.greeting}>Hello!</Text>
            <Text style={styles.welcome}>{userName} 👋</Text>
            <Text style={styles.subtitle}>Let’s get things done today 💪</Text>
          </View>

          <TouchableOpacity
            style={styles.notificationsIcon}
            onPress={() => Alert.alert('Notifications', 'Notifications clicked!')}
          >
            <MaterialIcons name="notifications" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'ACTIVE' && styles.tabActive]}
          onPress={() => setTab('ACTIVE')}
        >
          <Text style={[styles.tabText, tab === 'ACTIVE' && styles.tabTextActive]}>
            Active ({tasks.filter((t) => t.status === 'ACTIVE').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'COMPLETED' && styles.tabActive]}
          onPress={() => setTab('COMPLETED')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'COMPLETED' && styles.tabTextActive,
            ]}
          >
            Completed ({tasks.filter((t) => t.status === 'COMPLETED').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task list / empty */}
      {filteredTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons
            name={tab === 'ACTIVE' ? 'assignment' : 'check-circle'}
            size={48}
            color="#ccc"
          />
          <Text style={styles.emptyText}>
            {tab === 'ACTIVE' ? 'No active tasks yet!' : 'No completed tasks yet!'}
          </Text>
          <Text style={styles.emptySubtext}>
            {tab === 'ACTIVE'
              ? 'Create your first task to get started.'
              : 'Complete some tasks to see them here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              {item.priority && (
                <View style={[styles.badge, styles[`priority${item.priority}`]]}>
                  <Text
                    style={[
                      styles.badgeText,
                      styles[`priorityText${item.priority}`],
                    ]}
                  >
                    {item.priority}
                  </Text>
                </View>
              )}

              <View>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskDescription}>
                  {item.description || 'No description'}
                </Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.taskFooter}>
                <View style={styles.footerLeft}>
                  <MaterialIcons name="access-time" size={16} color="grey" />
                  <Text style={styles.timeLeft}>
                    {formatDueDate(item.dueDate)}
                  </Text>
                </View>
                <Text style={styles.dueDate}>
                  Due: {formatDisplayDate(item.dueDate)}
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleToggleStatus(item.id)}
                >
                  <MaterialIcons
                    name={
                      item.status === 'ACTIVE'
                        ? 'check-circle-outline'
                        : 'undo'
                    }
                    size={18}
                    color="#2563EB"
                  />
                  <Text style={styles.actionText}>
                    {item.status === 'ACTIVE' ? 'Mark Done' : 'Make Active'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteTask(item.id)}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={18}
                    color="#DC2626"
                  />
                  <Text style={[styles.actionText, { color: '#DC2626' }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Home');
            router.replace('/home'); // stay on dashboard, not login
          }}
        >
          <MaterialIcons
            name="home"
            size={24}
            color={activeNav === 'Home' ? '#2563EB' : '#000000'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Home' && styles.navTextActive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Create');
            router.replace('/create');
          }}
        >
          <MaterialIcons
            name="add-circle"
            size={24}
            color={activeNav === 'Create' ? '#2563EB' : '#000000'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Create' && styles.navTextActive,
            ]}
          >
            Create
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Calendar');
            Alert.alert('Calendar', 'Calendar screen is not built yet.');
          }}
        >
          <MaterialIcons
            name="calendar-today"
            size={24}
            color={activeNav === 'Calendar' ? '#2563EB' : '#000000'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Calendar' && styles.navTextActive,
            ]}
          >
            Calendar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Account');
            Alert.alert('Account', 'Account screen is not built yet.');
          }}
        >
          <MaterialIcons
            name="person"
            size={24}
            color={activeNav === 'Account' ? '#2563EB' : '#000000'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Account' && styles.navTextActive,
            ]}
          >
            Account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: { flex: 1, marginLeft: 12, marginRight: 40 },
  greeting: { fontSize: 14, color: '#000000', marginBottom: 2 },
  welcome: { fontSize: 20, fontWeight: '700', color: '#000000' },
  subtitle: { fontSize: 11, color: '#000000', marginTop: 4 },
  notificationsIcon: { position: 'absolute', top: 8, right: 0, padding: 8 },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { color: '#000000', fontSize: 14 },
  tabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  taskTitle: { fontSize: 16, fontWeight: '700', color: '#000000' },
  taskDescription: { fontSize: 12, color: '#000000', marginTop: 4 },
  separator: { height: 1, backgroundColor: '#000000', marginVertical: 12 },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeLeft: { fontSize: 12, color: '#4B5563', marginLeft: 4 },
  dueDate: { fontSize: 12, color: '#4B5563' },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  priorityHIGH: { backgroundColor: 'rgba(255, 53, 53, 0.8)' },
  priorityMEDIUM: { backgroundColor: 'rgba(255, 184, 0, 0.8)' },
  priorityLOW: { backgroundColor: 'rgba(52, 211, 153, 0.8)' },
  priorityTextHIGH: { color: '#FFFFFF' },
  priorityTextMEDIUM: { color: '#FFFFFF' },
  priorityTextLOW: { color: '#FFFFFF' },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 12, color: '#000000', marginTop: 4 },
  navTextActive: { color: '#2563EB' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 16,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, color: '#2563EB' },
});
