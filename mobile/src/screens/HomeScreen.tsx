import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Alert, ActivityIndicator, Image, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../theme/ThemeProvider';
import AnimatedTaskCard from '../components/AnimatedTaskCard';
import Mascot from '../components/Mascot';
import Confetti from '../components/Confetti';
import { getTasks, updateTask } from '../config/api';
import { sendTaskCompletedNotification } from '../config/notifications';

const { width, height } = Dimensions.get('window');

// ── Floating moving stars ──────────────────────────────────────────────────────
const NUM_STARS = 80;

function StarField() {
  const stars = useRef(
    Array.from({ length: NUM_STARS }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(Math.random() * height),
      opacity: new Animated.Value(Math.random() * 0.6 + 0.2),
      size: Math.random() * 2.5 + 0.8,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: Math.random() * 0.3 + 0.1,
      startX: Math.random() * width,
      startY: Math.random() * height,
    }))
  ).current;

  useEffect(() => {
    stars.forEach((star) => {
      const driftY = () => {
        star.y.setValue(-10);
        Animated.timing(star.y, {
          toValue: height + 10,
          duration: 8000 + Math.random() * 12000,
          useNativeDriver: true,
        }).start(driftY);
      };

      const driftX = () => {
        Animated.sequence([
          Animated.timing(star.x, {
            toValue: star.startX + (Math.random() - 0.5) * 60,
            duration: 4000 + Math.random() * 4000,
            useNativeDriver: true,
          }),
          Animated.timing(star.x, {
            toValue: star.startX,
            duration: 4000 + Math.random() * 4000,
            useNativeDriver: true,
          }),
        ]).start(driftX);
      };

      const twinkle = () => {
        Animated.sequence([
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.3 + 0.1,
            duration: 1000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.6 + 0.4,
            duration: 1000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ]).start(twinkle);
      };

      const delay = Math.random() * 6000;
      setTimeout(() => {
        driftY();
        driftX();
        twinkle();
      }, delay);
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: i % 5 === 0 ? '#93C5FD' : i % 7 === 0 ? '#FCD34D' : '#ffffff',
            opacity: star.opacity,
            transform: [
              { translateX: star.x },
              { translateY: star.y },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ── Shooting star ──────────────────────────────────────────────────────────────
function ShootingStar() {
  const x = useRef(new Animated.Value(-100)).current;
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shoot = () => {
      const startY = Math.random() * height * 0.5;
      x.setValue(-100);
      y.setValue(startY);
      opacity.setValue(0);

      Animated.sequence([
        Animated.delay(3000 + Math.random() * 8000),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(x, {
            toValue: width + 100,
            duration: 800 + Math.random() * 400,
            useNativeDriver: true,
          }),
          Animated.timing(y, {
            toValue: startY + 100,
            duration: 800 + Math.random() * 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(shoot);
    };

    shoot();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 80,
        height: 1.5,
        backgroundColor: '#fff',
        borderRadius: 2,
        opacity,
        transform: [
          { translateX: x },
          { translateY: y },
          { rotate: '20deg' },
        ],
      }}
      pointerEvents="none"
    />
  );
}

type Task = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  completedAt?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  userId: string;
  subtasks?: any[];
};

export default function HomeScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'TODO' | 'COMPLETED'>('TODO');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [mascotMood, setMascotMood] = useState<'idle' | 'happy' | 'celebrate'>('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMascot, setShowMascot] = useState(false);
  const mascotOpacity = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const getUserData = async () => {
      try {
        if (route?.params?.user) {
          setUser(route.params.user);
        } else {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) setUser(JSON.parse(storedUser));
        }
      } catch {}
    };
    getUserData();
  }, [route]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAvatar);
    return unsubscribe;
  }, [navigation]);

  const loadAvatar = async () => {
    try {
      const saved = await AsyncStorage.getItem('userAvatar');
      if (saved) setAvatarUri(saved);
    } catch {}
  };

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const fetched = await getTasks();
      setTasks(fetched as Task[]);
    } catch {
      Alert.alert('Error', 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  const showMascotCelebration = () => {
    setShowMascot(true);
    setMascotMood('celebrate');
    setShowConfetti(true);

    mascotOpacity.setValue(0);
    mascotScale.setValue(0.3);

    Animated.parallel([
      Animated.spring(mascotOpacity, { toValue: 1, useNativeDriver: true, friction: 8 }),
      Animated.spring(mascotScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();

    setTimeout(() => setMascotMood('happy'), 2000);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(mascotOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(mascotScale, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ]).start(() => {
        setShowMascot(false);
        setMascotMood('idle');
      });
    }, 4500);
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  ) => {
    try {
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : undefined;
      await updateTask(taskId, { status: newStatus, completedAt });
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, status: newStatus, completedAt } : t)
      );
      if (newStatus === 'COMPLETED') {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          await sendTaskCompletedNotification(task.title);
          showMascotCelebration();
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to update task.');
    }
  };

  const handleDelete = (taskId: string) => {
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => setTasks(prev => prev.filter(t => t.id !== taskId)),
      },
    ]);
  };

  useEffect(() => {
    fetchTasks();
    const unsubscribe = navigation.addListener('focus', fetchTasks);
    return unsubscribe;
  }, [navigation, fetchTasks]);

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    const diffDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays} days left`;
  };

  const formatDisplayDate = (dueDate?: string) => {
    if (!dueDate) return '';
    const d = new Date(dueDate);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  };

  const filteredTasks = tasks.filter(t =>
    tab === 'TODO'
      ? t.status === 'TODO' || t.status === 'IN_PROGRESS'
      : t.status === 'COMPLETED'
  );

  const activeCount = useMemo(() =>
    tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length, [tasks]);
  const completedCount = useMemo(() =>
    tasks.filter(t => t.status === 'COMPLETED').length, [tasks]);

  const getInitials = () => {
    if (!user) return '?';
    return `${user.firstName?.charAt(0)?.toUpperCase() ?? ''}${user.lastName?.charAt(0)?.toUpperCase() ?? ''}` || '?';
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#05071A' }]}>
        <StarField />
        <ShootingStar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>
            Loading your tasks...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: '#05071A' }]}>

        {/* Moving star field */}
        <StarField />

        {/* Shooting stars */}
        <ShootingStar />
        <ShootingStar />

        {/* Confetti */}
        <Confetti visible={showConfetti} onDone={() => setShowConfetti(false)} />

        {/* Mascot bottom left — only on task completion */}
        {showMascot && (
          <Animated.View
            style={[
              styles.mascotCorner,
              {
                opacity: mascotOpacity,
                transform: [{ scale: mascotScale }],
              },
            ]}
            pointerEvents="none"
          >
            <View style={[
              styles.speechBubble,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
              <Text style={[styles.mascotSpeechText, { color: colors.text }]}>
                {mascotMood === 'celebrate' ? '🎉 Great job!' : '😊 Keep it up!'}
              </Text>
              <View style={[styles.bubbleTail, { borderTopColor: colors.surface }]} />
            </View>
            <Mascot mood={mascotMood} size={90} />
          </Animated.View>
        )}

        {/* Header */}
        <View style={[styles.heroHeader, { backgroundColor: 'rgba(10,14,40,0.85)', borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.navigate('Account')} activeOpacity={0.7}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
                    {getInitials()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.greetingContainer}>
              <Text style={[styles.greeting, { color: 'rgba(255,255,255,0.5)' }]}>{getGreeting()}</Text>
              <Text style={[styles.welcome, { color: '#fff' }]}>
                {user?.firstName || 'User'} 👋
              </Text>
              <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.45)' }]}>
                Let's make progress today.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => Alert.alert('Notifications', 'No new notifications!')}
            >
              <MaterialIcons name="notifications" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsSection}>
          <View style={[styles.tabsContainer, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            {(['TODO', 'COMPLETED'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tab,
                  tab === t && [styles.tabActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, { color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
                  {t === 'TODO' ? 'Active' : 'Completed'}
                </Text>
                <Text style={[styles.tabCount, { color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)' }]}>
                  {t === 'TODO' ? activeCount : completedCount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: '#fff' }]}>Your Tasks</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Create')}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Task list or empty state */}
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: '#fff' }]}>
              {tab === 'TODO' ? 'No active tasks yet' : 'No completed tasks yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: 'rgba(255,255,255,0.45)' }]}>
              {tab === 'TODO'
                ? 'Tap + to create your first task'
                : 'Complete some tasks to see them here'}
            </Text>
            {tab === 'TODO' && (
              <TouchableOpacity
                style={[styles.primaryCta, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Create')}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  Create your first task
                </Text>
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
              <AnimatedTaskCard
                task={item}
                onPress={() => navigation.navigate('TaskDetails', { task: item })}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                formatDueDate={formatDueDate}
                formatDisplayDate={formatDisplayDate}
              />
            )}
          />
        )}

        {/* Bottom Nav */}
        <View style={[styles.bottomNav, { backgroundColor: 'rgba(10,14,40,0.92)', borderTopColor: 'rgba(255,255,255,0.08)' }]}>
          {[
            { name: 'Home', icon: 'home', screen: 'Home' },
            { name: 'Create', icon: 'add-circle', screen: 'Create' },
            { name: 'Calendar', icon: 'calendar-today', screen: 'Calendar' },
            { name: 'Account', icon: 'account-circle', screen: 'Account' },
          ].map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <MaterialIcons
                name={item.icon as any}
                size={26}
                color={item.screen === 'Home' ? colors.primary : 'rgba(255,255,255,0.45)'}
              />
              <Text style={[styles.navText, {
                color: item.screen === 'Home' ? colors.primary : 'rgba(255,255,255,0.45)',
              }]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '500' },

  mascotCorner: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    zIndex: 999,
    alignItems: 'flex-start',
  },
  speechBubble: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -10,
    left: 14,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  mascotSpeechText: { fontSize: 13, fontWeight: '700' },

  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: { flex: 1, marginLeft: 16 },
  greeting: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  welcome: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  tabsSection: { paddingHorizontal: 20, paddingVertical: 16 },
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
  tabActive: { elevation: 3 },
  tabText: { fontSize: 15, fontWeight: '600' },
  tabCount: { fontSize: 13, fontWeight: '600' },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  taskListContent: { paddingTop: 6, paddingBottom: 120 },

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

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});
