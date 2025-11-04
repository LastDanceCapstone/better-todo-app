// src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

type Task = {
  id: string;
  title: string;
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
  );
}

const styles = StyleSheet.create({
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
  navTextActive: { color: '#2563EB' }, // Active text color
});
