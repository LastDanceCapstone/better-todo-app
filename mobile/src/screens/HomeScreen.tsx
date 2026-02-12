// src/screens/HomeScreen.tsx
<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SwipeableTaskCard from '../components/SwipeableTaskCard';

// Update the API base URL to match your current IP
const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';
=======
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540

type Task = {
  id: string;
  title: string;
<<<<<<< HEAD
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
  const [tab, setTab] = useState<'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>('TODO');
  const [activeNav, setActiveNav] = useState('Home');
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
      
      // Get token from AsyncStorage
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found. Please log in again.');
        return;
      }

      console.log('Fetching tasks with token:', token.substring(0, 20) + '...');

      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Tasks response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Tasks data received:', data);
        setTasks(data.tasks || []);
      } else {
        const errorData = await response.json();
        console.error('Tasks fetch error:', errorData);
        
        if (response.status === 401) {
          Alert.alert('Session Expired', 'Please log in again.');
          // Could navigate back to login here
        } else {
          Alert.alert('Error', errorData.error || 'Failed to load tasks');
        }
      }
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
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        return;
      }

      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : null;

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, completedAt }),
      });

      if (response.ok) {
        // Update local state
        setTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === taskId ? { ...task, status: newStatus, completedAt: completedAt || undefined } : task
          )
        );
        
        Alert.alert(
          'Success',
          `Task ${newStatus === 'COMPLETED' ? 'completed' : 'updated'} successfully!`
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to update task');
      }
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
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const filteredTasks = tasks.filter((t) =>
    tab === 'TODO' ? t.status === 'TODO' : t.status === 'COMPLETED'
  );

  const getInitials = () => {
    if (!user) return '?';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const firstInitial = firstName.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}` || '?';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header - More card-like with subtle shadow, no harsh black border */}
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            {/* Avatar - Slightly larger (56x56) */}
            <TouchableOpacity
              style={styles.avatarTouchable}
              onPress={() => {
                setActiveNav('Account');
                navigation.navigate('AccountDetails');
              }}
              activeOpacity={0.7}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{getInitials()}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Greeting text - Better spacing */}
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>Hello!</Text>
              <Text style={styles.welcome}>{user?.firstName || 'User'} 👋</Text>
            </View>

            {/* Notification icon - Rounded button with touch feedback */}
            <TouchableOpacity 
              style={styles.notificationButton} 
              onPress={() => alert('Notifications clicked!')}
              activeOpacity={0.7}
            >
              <MaterialIcons name="notifications" size={22} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs - Modern pill-style segmented control */}
        <View style={styles.tabsSection}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, tab === 'TODO' && styles.tabActive]}
              onPress={() => setTab('TODO')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === 'TODO' && styles.tabTextActive]}>
                Active
              </Text>
              <Text style={[styles.tabCount, tab === 'TODO' && styles.tabCountActive]}>
                {tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, tab === 'COMPLETED' && styles.tabActive]}
              onPress={() => setTab('COMPLETED')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === 'COMPLETED' && styles.tabTextActive]}>
                Completed
              </Text>
              <Text style={[styles.tabCount, tab === 'COMPLETED' && styles.tabCountActive]}>
                {tasks.filter(t => t.status === 'COMPLETED').length}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Task List - Consistent spacing, breathing room */}
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons 
              name={tab === 'TODO' ? "assignment" : "check-circle"} 
              size={56} 
              color="#D1D5DB" 
            />
            <Text style={styles.emptyText}>
              {tab === 'TODO' ? 'No active tasks yet' : 'No completed tasks yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {tab === 'TODO' 
                ? 'Create your first task to get started' 
                : 'Complete some tasks to see them here'}
            </Text>
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

        {/* Bottom Navigation - Softer shadow, better spacing, muted colors */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveNav('Home')}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="home"
              size={26}
              color={activeNav === 'Home' ? '#2563EB' : '#6B7280'}
            />
            <Text style={[styles.navText, activeNav === 'Home' && styles.navTextActive]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              setActiveNav('Create');
              navigation.navigate('CreateTask');
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="add-circle"
              size={26}
              color={activeNav === 'Create' ? '#2563EB' : '#6B7280'}
            />
            <Text style={[styles.navText, activeNav === 'Create' && styles.navTextActive]}>
              Create
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveNav('Calendar')}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="calendar-today"
              size={26}
              color={activeNav === 'Calendar' ? '#2563EB' : '#6B7280'}
            />
            <Text style={[styles.navText, activeNav === 'Calendar' && styles.navTextActive]}>
              Calendar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              setActiveNav('Account');
              navigation.navigate('AccountDetails');
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="account-circle"
              size={26}
              color={activeNav === 'Account' ? '#2563EB' : '#6B7280'}
            />
            <Text style={[styles.navText, activeNav === 'Account' && styles.navTextActive]}>
              Account
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
=======
  description: string;
  due?: string;
  status: 'ACTIVE' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  timeLeft?: string;
};

const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: 'Complete Math Homework',
    description: 'Complete Homework 2 for Math Class.',
    due: 'Oct 31',
    status: 'ACTIVE',
    priority: 'HIGH',
    timeLeft: '2 days left',
  },
  {
    id: '2',
    title: 'Grocery Run',
    description: 'Take the created grocery list and go shopping.',
    due: 'Nov 1',
    status: 'ACTIVE',
    priority: 'MEDIUM',
    timeLeft: '3 days left',
  },
  {
    id: '3',
    title: 'Submit Research Proposal',
    description: 'Submit final draft of research proposal.',
    due: 'Nov 5',
    status: 'ACTIVE',
    priority: 'LOW',
    timeLeft: '7 days left',
  },
  {
    id: '4',
    title: 'Clean Completed Tasks',
    description: 'Clean up completed tasks.',
    due: 'Oct 29',
    status: 'COMPLETED',
    priority: 'LOW',
    timeLeft: 'Overdue',
  },
];

export default function HomeScreen() {
  const [tab, setTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [activeNav, setActiveNav] = useState('Home'); // State to track active navigation tab

  const filteredTasks = MOCK_TASKS.filter((t) =>
    tab === 'ACTIVE' ? t.status === 'ACTIVE' : t.status === 'COMPLETED'
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.welcome}>Welcome back, London 👋</Text>
          <Text style={styles.subtitle}>Let’s get things done today 💪</Text>
        </View>

        {/* Notifications Icon */}
        <TouchableOpacity style={styles.notificationsIcon} onPress={() => alert('Notifications clicked!')}>
          <MaterialIcons name="notifications" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'ACTIVE' && styles.tabActive]}
          onPress={() => setTab('ACTIVE')}
        >
          <Text style={[styles.tabText, tab === 'ACTIVE' && styles.tabTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'COMPLETED' && styles.tabActive]}
          onPress={() => setTab('COMPLETED')}
        >
          <Text style={[styles.tabText, tab === 'COMPLETED' && styles.tabTextActive]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
            {/* Priority Tag */}
            {item.priority && (
              <View style={[styles.badge, styles[`priority${item.priority}`]]}>
                <Text style={[styles.badgeText, styles[`priorityText${item.priority}`]]}>
                  {item.priority}
                </Text>
              </View>
            )}

            {/* Task Content */}
            <View>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.taskDescription}>{item.description}</Text>
            </View>

            {/* Black Line */}
            <View style={styles.separator} />

            {/* Bottom Section */}
            <View style={styles.taskFooter}>
              <View style={styles.footerLeft}>
                <MaterialIcons name="access-time" size={16} color="grey" />
                <Text style={styles.timeLeft}>{item.timeLeft}</Text>
              </View>
              <Text style={styles.dueDate}>Due Date: {item.due}</Text>
            </View>
          </View>
        )}
      />

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveNav('Home')}
        >
          <MaterialIcons
            name="home"
            size={24}
            color={activeNav === 'Home' ? '#2563EB' : '#000000'} // Change color based on active state
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Home' && styles.navTextActive, // Change text color based on active state
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveNav('Create')}
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
          onPress={() => setActiveNav('Calendar')}
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
          onPress={() => setActiveNav('Account')}
        >
          <MaterialIcons
            name="account-circle"
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
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  // Main container
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },

  // Header - Card-like with subtle shadow, more compact
  headerContainer: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
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
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Greeting section - Better spacing and alignment
  greetingContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '500',
  },
  welcome: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  
  // Notification button - Rounded with touch feedback
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs - Modern pill-style segmented control
  tabsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabCountActive: {
    color: '#DBEAFE',
  },

  // Task list - Consistent spacing and breathing room
  taskListContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },

  // Empty state - Softer colors and better spacing
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Bottom navigation - Softer shadow, better height and spacing
=======
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    position: 'relative', // Allows absolute positioning of the notifications icon
  },
  titleContainer: {
    marginRight: 40, // Add space to avoid overlap with the notifications icon
  },
  welcome: { fontSize: 20, fontWeight: '700', color: '#000000' },
  subtitle: { fontSize: 11, color: '#000000', marginTop: 4 },
  notificationsIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F2F2F2',
  },
  tabActive: { backgroundColor: '#4E8FFF' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#000000' },
  tabTextActive: { color: '#FFFFFF' },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative', // Required for absolute positioning of priority tags
  },
  taskTitle: { fontSize: 16, fontWeight: '700', color: '#000000' },
  taskDescription: { fontSize: 12, color: '#000000', marginTop: 4 },
  separator: {
    height: 1,
    backgroundColor: '#000000',
    marginVertical: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLeft: { fontSize: 12, color: 'grey', marginLeft: 4 },
  dueDate: { fontSize: 12, fontWeight: 'bold', color: '#000000' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF', // Default text color for badges
  },
  priorityHIGH: { backgroundColor: 'rgba(255, 53, 53, 0.3)' },
  priorityMEDIUM: { backgroundColor: 'rgba(255, 184, 0, 0.3)' },
  priorityLOW: { backgroundColor: 'rgba(0, 200, 83, 0.3)' },
  priorityTextHIGH: { color: '#FF4D4D' },
  priorityTextMEDIUM: { color: '#FFB800' },
  priorityTextLOW: { color: '#00C853' },
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
<<<<<<< HEAD
    height: 72,
=======
    height: 85,
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
<<<<<<< HEAD
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.04)',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  navTextActive: {
    color: '#2563EB',
  },
=======
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.15)',
  },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 12, color: '#000000', marginTop: 4 },
  navTextActive: { color: '#2563EB' }, // Active text color
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
});
