// src/screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Update the API base URL to match your current IP
const API_BASE_URL = 'http://100.100.209.29:3000';

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  status: 'ACTIVE' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
};

export default function HomeScreen({ route, navigation }: any) {
  const [tab, setTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [activeNav, setActiveNav] = useState('Home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

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

  // Fetch tasks when component mounts
  useEffect(() => {
    fetchTasks();
  }, []);

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

  // Get welcome message
  const welcomeMessage = user 
    ? `Welcome back, ${user.firstName} 👋` 
    : 'Welcome back 👋';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#4E8FFF" />
          <Text style={{ marginTop: 16, fontSize: 16 }}>Loading your tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <MaterialIcons name="account-circle" size={48} color="#E0E0E0" />
          </View>
          
          {/* Title Container */}
          <View style={styles.titleContainer}>
            <Text style={styles.greeting}>Hello!</Text>
            <Text style={styles.welcome}>{user?.firstName || 'User'} 👋</Text>
          </View>

          {/* Notifications Icon */}
          <TouchableOpacity 
            style={styles.notificationsIcon} 
            onPress={() => alert('Notifications clicked!')}
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
            Active ({tasks.filter(t => t.status === 'ACTIVE').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'COMPLETED' && styles.tabActive]}
          onPress={() => setTab('COMPLETED')}
        >
          <Text style={[styles.tabText, tab === 'COMPLETED' && styles.tabTextActive]}>
            Completed ({tasks.filter(t => t.status === 'COMPLETED').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons 
            name={tab === 'ACTIVE' ? "assignment" : "check-circle"} 
            size={48} 
            color="#ccc" 
          />
          <Text style={styles.emptyText}>
            {tab === 'ACTIVE' ? 'No active tasks yet!' : 'No completed tasks yet!'}
          </Text>
          <Text style={styles.emptySubtext}>
            {tab === 'ACTIVE' ? 'Create your first task to get started.' : 'Complete some tasks to see them here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshing={loading}
          onRefresh={fetchTasks}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.taskCard}
              onPress={() => navigation.navigate('TaskDetails', { task: item })}
              activeOpacity={0.7}
            >
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
                <Text style={styles.taskDescription}>
                  {item.description || 'No description'}
                </Text>
              </View>

              {/* Black Line */}
              <View style={styles.separator} />

              {/* Bottom Section */}
              <View style={styles.taskFooter}>
                <View style={styles.footerLeft}>
                  <MaterialIcons name="access-time" size={16} color="grey" />
                  <Text style={styles.timeLeft}>{formatDueDate(item.dueDate)}</Text>
                </View>
                <Text style={styles.dueDate}>
                  Due: {formatDisplayDate(item.dueDate)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Bottom Navigation - Same as before */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveNav('Home')}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
  },
  avatarContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12, 
  },
  greeting: { 
    fontSize: 14, 
    color: '#000000', 
    marginBottom: 2 
  },
  welcome: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#000000' 
  },
  subtitle: { fontSize: 11, color: '#000000', marginTop: 4 },
  notificationsIcon: {
    padding: 8, 
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
    color: '#FFFFFF',
  },
  priorityHIGH: { backgroundColor: 'rgba(255, 53, 53, 0.3)' },
  priorityMEDIUM: { backgroundColor: 'rgba(255, 184, 0, 0.3)' },
  priorityLOW: { backgroundColor: 'rgba(0, 200, 83, 0.3)' },
  priorityTextHIGH: { color: '#FF4D4D' },
  priorityTextMEDIUM: { color: '#FFB800' },
  priorityTextLOW: { color: '#00C853' },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.15)',
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
});
