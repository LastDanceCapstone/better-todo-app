// App.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, AppStateStatus, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeProvider, useThemePreference, useTheme } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import AccountDetailsScreen from './src/screens/AccountDetailsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CalendarSettingsScreen from './src/screens/CalendarSettingsScreen';
import NotificationCenterScreen from './src/screens/NotificationCenterScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import AccountSettingsScreen from './src/screens/AccountSettingsScreen';
import GeneralSettingsScreen from './src/screens/GeneralSettingsScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import { getTasks } from './src/config/api';

const APP_CALENDAR_SYNC_ENABLED_KEY = 'prioritizeCalendarAppSyncEnabled';
const CALENDAR_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

type RootStackParamList = {
  Login: undefined;
  Main: any;
  TaskDetails: any;
  ResetPassword: { email?: string; token?: string } | undefined;
  CalendarSync: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  AccountSettings: undefined;
  GeneralSettings: undefined;
  Analytics: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const AnimatedTabIcon = ({
  focused,
  icon,
  color,
}: {
  focused: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.08 : 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.75,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, opacity, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <MaterialIcons name={icon} size={24} color={color} />
    </Animated.View>
  );
};

const TabNavigator = () => {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const isDark = currentTheme === 'dark';

  const tabBarBackgroundColor = colors.surface;
  const tabBarBorderColor = colors.border;

  const tabBarStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: 16,
      right: 16,
      bottom: 12,
      height: 62,
      borderRadius: 22,
      backgroundColor: tabBarBackgroundColor,
      borderWidth: 1,
      borderColor: tabBarBorderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 14,
    }),
    [tabBarBackgroundColor, tabBarBorderColor]
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: any }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle,
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) =>
          focused ? (
            <Text
              style={{
                marginTop: 2,
                fontSize: 11,
                fontWeight: '600',
                color,
              }}
            >
              {route.name}
            </Text>
          ) : null,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => {
          const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            Home: 'home',
            Create: 'add-circle',
            Calendar: 'calendar-today',
            Account: 'account-circle',
          };

          return (
            <AnimatedTabIcon
              focused={focused}
              icon={iconMap[route.name]}
              color={color}
            />
          );
        },
        tabBarBackground: () => (
          <View
            style={{
              flex: 1,
              borderRadius: 22,
              backgroundColor: tabBarBackgroundColor,
            }}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Create" component={CreateTaskScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Account" component={AccountDetailsScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { navigationTheme } = useThemePreference();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState<'Login' | 'Main'>('Login');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const reconcileIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconcileInFlightRef = useRef(false);

  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          // Use shared task loader so reconcile can run on app launch when enabled.
          await getTasks();
          setInitialRouteName('Main');
        } else {
          setInitialRouteName('Login');
        }
      } catch (error) {
        console.error('Failed to restore auth session:', error);
        await AsyncStorage.multiRemove(['authToken', 'user']);
        setInitialRouteName('Login');
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrapSession();
  }, []);

  useEffect(() => {
    if (isBootstrapping || initialRouteName !== 'Main') {
      if (reconcileIntervalRef.current) {
        clearInterval(reconcileIntervalRef.current);
        reconcileIntervalRef.current = null;
      }
      return;
    }

    const runPeriodicReconcile = async () => {
      if (appStateRef.current !== 'active') return;
      if (reconcileInFlightRef.current) return;

      reconcileInFlightRef.current = true;
      try {
        const enabled = (await AsyncStorage.getItem(APP_CALENDAR_SYNC_ENABLED_KEY)) === 'true';
        if (!enabled) return;

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        // Lightweight periodic refresh; getTasks triggers reconcile via shared API hooks.
        await getTasks();
      } catch (error) {
        console.error('[CalendarSync] Periodic reconcile failed:', error);
      } finally {
        reconcileInFlightRef.current = false;
      }
    };

    const startIntervalIfNeeded = () => {
      if (reconcileIntervalRef.current || appStateRef.current !== 'active') return;
      reconcileIntervalRef.current = setInterval(() => {
        void runPeriodicReconcile();
      }, CALENDAR_RECONCILE_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (!reconcileIntervalRef.current) return;
      clearInterval(reconcileIntervalRef.current);
      reconcileIntervalRef.current = null;
    };

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        startIntervalIfNeeded();
        void runPeriodicReconcile();
      } else {
        stopInterval();
      }
    });

    startIntervalIfNeeded();
    void runPeriodicReconcile();

    return () => {
      appStateSubscription.remove();
      stopInterval();
    };
  }, [isBootstrapping, initialRouteName]);

  if (isBootstrapping) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: navigationTheme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={navigationTheme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Main" component={TabNavigator} />
        <RootStack.Screen name="TaskDetails" component={TaskDetailsScreen} />
        <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <RootStack.Screen name="CalendarSync" component={CalendarSettingsScreen} />
        <RootStack.Screen name="Notifications" component={NotificationCenterScreen} />
        <RootStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <RootStack.Screen name="AccountSettings" component={AccountSettingsScreen} />
        <RootStack.Screen name="GeneralSettings" component={GeneralSettingsScreen} />
        <RootStack.Screen name="Analytics" component={AnalyticsScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
