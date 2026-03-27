// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { useTheme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SwipeableTaskCard from '../components/SwipeableTaskCard';
import { getTasks, updateTask } from '../config/api';

type Task = {
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
  subtasks?: Subtask[];
};

type Subtask = {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  taskId: string;
};

export default function HomeScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'TODO' | 'COMPLETED'>('TODO');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Get user data from route params or AsyncStorage
  useEffect(() => {
    const getUserData = async () => {
      try {
        // First try to get from route params (when coming from login)
        if (route?.params?.user) {
          setUser(route.params.user);
        } else {
          // Otherwise get from AsyncStorage
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (error) {
        console.error('Error getting user data:', error);
      }
    };

    getUserData();
  }, [route]);

  // Load avatar when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAvatar();
    });

    return unsubscribe;
  }, [navigation]);

  const loadAvatar = async () => {
    try {
      const savedAvatar = await AsyncStorage.getItem('userAvatar');
      if (savedAvatar) {
        setAvatarUri(savedAvatar);
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
    }
  };

  // Fetch tasks from backend
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const fetchedTasks = await getTasks();
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Network error fetching tasks:', error);
      Alert.alert('Error', 'Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    try {
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : null;
      // Use shared update helper so sync hooks stay centralized.
      await updateTask(taskId, { status: newStatus, completedAt });

      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: newStatus, completedAt: completedAt || undefined } : task
        )
      );

      Alert.alert(
        'Success',
        `Task ${newStatus === 'COMPLETED' ? 'completed' : 'updated'} successfully!`
      );
    } catch (error) {
      console.error('Error updating task status:', error);
      Alert.alert('Error', 'Failed to update task status');
    }
  };

  // Fetch tasks when component mounts and when screen comes into focus
  useEffect(() => {
    fetchTasks();
    
    // Add listener to refresh tasks when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTasks();
    });

    return unsubscribe;
  }, [navigation]);

  // Helper function to format due date
  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `${diffDays} days left`;
    }
  };

  // Helper function to format due date for display
  const formatDisplayDate = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    
    const date = new Date(dueDate);
    const formattedDate = date.toLocaleDateString(undefined, {
      month: 'short', 
      day: 'numeric' 
    });
    const formattedTime = date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${formattedDate} • ${formattedTime}`;
  };

  const filteredTasks = tasks.filter((t) =>
    tab === 'TODO'
      ? t.status === 'TODO' || t.status === 'IN_PROGRESS'
      : t.status === 'COMPLETED'
  );

  const getInitials = () => {
    if (!user) return '?';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const firstInitial = firstName.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}` || '?';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const { activeCount, completedCount } = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

    return {
      activeCount: active,
      completedCount: completed,
    };
  }, [tasks]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading your tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Hero Header */}
        <View style={[styles.heroHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.avatarTouchable}
              onPress={() => navigation.navigate('Account')}
              activeOpacity={0.7}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarInitials, { color: colors.surface }]}>{getInitials()}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.greetingContainer}>
              <Text style={[styles.greeting, { color: colors.mutedText }]}>{getGreeting()}</Text>
              <Text style={[styles.welcome, { color: colors.text }]}>{user?.firstName || 'User'} 👋</Text>
              <Text style={[styles.subtitle, { color: colors.mutedText }]}>Let's make progress today.</Text>
            </View>

            <TouchableOpacity
              style={[styles.notificationButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => alert('Notifications clicked!')}
              activeOpacity={0.7}
            >
              <MaterialIcons name="notifications" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        {/* Tabs */}
        <View style={[styles.tabsSection, { backgroundColor: colors.background }]}>
          <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'TODO' && [styles.tabActive, { backgroundColor: colors.primary, shadowColor: colors.primary }],
              ]}
              onPress={() => setTab('TODO')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.mutedText },
                  tab === 'TODO' && [styles.tabTextActive, { color: colors.surface }],
                ]}
              >
                Active
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: colors.mutedText },
                  tab === 'TODO' && [styles.tabCountActive, { color: colors.surface }],
                ]}
              >
                {activeCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'COMPLETED' && [styles.tabActive, { backgroundColor: colors.primary, shadowColor: colors.primary }],
              ]}
              onPress={() => setTab('COMPLETED')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.mutedText },
                  tab === 'COMPLETED' && [styles.tabTextActive, { color: colors.surface }],
                ]}
              >
                Completed
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: colors.mutedText },
                  tab === 'COMPLETED' && [styles.tabCountActive, { color: colors.surface }],
                ]}
              >
                {completedCount}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Tasks</Text>
        </View>

        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons
              name={tab === 'TODO' ? 'assignment' : 'check-circle'}
              size={56}
              color={colors.border}
            />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {tab === 'TODO' ? 'No active tasks yet' : 'No completed tasks yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedText }]}>
              {tab === 'TODO'
                ? 'Create your first task to get started'
                : 'Complete some tasks to see them here'}
            </Text>
            {tab === 'TODO' && (
              <TouchableOpacity
                style={[styles.primaryCta, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Create')}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryCtaText, { color: colors.surface }]}>Create your first task</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskListContent}
            refreshing={loading}
            onRefresh={fetchTasks}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <SwipeableTaskCard
                task={item}
                onPress={() => navigation.navigate('TaskDetails', { task: item })}
                onStatusChange={handleStatusChange}
                formatDueDate={formatDueDate}
                formatDisplayDate={formatDisplayDate}
              />
            )}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Main container
  container: { 
    flex: 1,
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },

  // Hero header
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  // Avatar - Larger (56x56) and more prominent
  avatarTouchable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
  },

  greetingContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 13,
    marginBottom: 2,
    fontWeight: '500',
  },
  welcome: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Notification button - Rounded with touch feedback
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Tabs
  tabsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
  },
  tabCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabCountActive: {
  },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Task list
  taskListContent: {
    paddingTop: 6,
    paddingBottom: 120,
  },

  // Empty state - Softer colors and better spacing
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: '400',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryCta: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
  },

});
