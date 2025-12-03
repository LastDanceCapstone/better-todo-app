// src/screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SwipeableTaskCard from '../components/SwipeableTaskCard';

// Update the API base URL to match your current IP
const API_BASE_URL = 'http://100.100.66.131:3000';

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  status: 'ACTIVE' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
  subtasks?: Array<{ id: string; title: string; isCompleted: boolean }>;
};

export default function HomeScreen({ route, navigation }: any) {
  const [tab, setTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
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
  const handleStatusChange = async (taskId: string, newStatus: 'ACTIVE' | 'COMPLETED') => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === taskId ? { ...task, status: newStatus } : task
          )
        );
        
        Alert.alert(
          'Success',
          `Task ${newStatus === 'COMPLETED' ? 'completed' : 'reactivated'} successfully!`
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
    tab === 'ACTIVE' ? t.status === 'ACTIVE' : t.status === 'COMPLETED'
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
              style={[styles.tab, tab === 'ACTIVE' && styles.tabActive]}
              onPress={() => setTab('ACTIVE')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === 'ACTIVE' && styles.tabTextActive]}>
                Active
              </Text>
              <Text style={[styles.tabCount, tab === 'ACTIVE' && styles.tabCountActive]}>
                {tasks.filter(t => t.status === 'ACTIVE').length}
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
              name={tab === 'ACTIVE' ? "assignment" : "check-circle"} 
              size={56} 
              color="#D1D5DB" 
            />
            <Text style={styles.emptyText}>
              {tab === 'ACTIVE' ? 'No active tasks yet' : 'No completed tasks yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {tab === 'ACTIVE' 
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
  );
}

const styles = StyleSheet.create({
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
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
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
});
