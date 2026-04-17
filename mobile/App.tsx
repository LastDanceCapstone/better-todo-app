// App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, AppStateStatus, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { ThemeProvider, useThemePreference, useTheme } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import AccountDetailsScreen from './src/screens/AccountDetailsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CalendarSettingsScreen from './src/screens/CalendarSettingsScreen';
import NotificationCenterScreen from './src/screens/NotificationCenterScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import AccountSettingsScreen from './src/screens/AccountSettingsScreen';
import GeneralSettingsScreen from './src/screens/GeneralSettingsScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import FocusModeScreen from './src/screens/FocusModeScreen';
import { ApiError, getAuthToken, getTaskById, getTasks, markNotificationAsRead } from './src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  configureNotificationPresentation,
  syncPushNotificationRegistration,
} from './src/services/pushNotifications';
import { clearLocalAuthSession } from './src/utils/session';
import { logger } from './src/utils/logger';

const APP_CALENDAR_SYNC_ENABLED_KEY = 'prioritizeCalendarAppSyncEnabled';
const CALENDAR_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

type RootStackParamList = {
  Login: undefined;
  Main: any;
  TaskDetails: any;
  ResetPassword: { email?: string; token?: string } | undefined;
  VerifyEmail: { email?: string; code?: string } | undefined;
  CalendarSync: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  AccountSettings: undefined;
  GeneralSettings: undefined;
  Analytics: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const navigationRef = React.createRef<any>();

const FloatingCreateTabButton = ({
  onPress,
  accessibilityState,
  color,
  ringColor,
}: BottomTabBarButtonProps & { color: string; ringColor: string }) => {
  const selected = Boolean(accessibilityState?.selected);
  const buttonSize = 66;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Create task"
      accessibilityState={accessibilityState}
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        position: 'absolute',
        left: '50%',
        top: -16,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateX: -(buttonSize / 2) }],
      }}
    >
      <View
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color,
          borderWidth: 3,
          borderColor: ringColor,
          shadowColor: color,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: selected ? 0.28 : 0.22,
          shadowRadius: selected ? 18 : 14,
          elevation: selected ? 14 : 11,
        }}
      >
        <MaterialIcons name="add" size={34} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
};

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
      <MaterialIcons name={icon} size={22} color={color} />
    </Animated.View>
  );
};

const TabNavigator = ({ onLogout }: { onLogout: () => void }) => {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDark = currentTheme === 'dark';

  const tabBarBackgroundColor = isDark ? 'rgba(11, 18, 31, 0.98)' : 'rgba(251, 253, 255, 0.98)';
  const tabBarBorderColor = isDark ? 'rgba(88, 107, 140, 0.30)' : 'rgba(0, 74, 173, 0.10)';
  const sidePadding = Math.min(Math.max(width * 0.035, 12), 22);
  const createSlotWidth = Math.min(Math.max(width * 0.18, 72), 86);

  const tabBarStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: 0,
      height: 60 + (insets.bottom > 0 ? Math.min(insets.bottom, 10) : 6),
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      paddingTop: 3,
      paddingBottom: insets.bottom > 0 ? Math.min(insets.bottom, 8) : 4,
      paddingHorizontal: sidePadding,
      shadowOpacity: 0,
      elevation: 0,
    }),
    [insets.bottom, sidePadding]
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: any }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle,
        tabBarShowLabel: route.name !== 'Create',
        tabBarItemStyle: {
          flex: 1,
          paddingTop: 1,
          paddingBottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 96,
        },
        tabBarIconStyle: {
          marginBottom: 1,
          marginTop: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          lineHeight: 12,
          paddingBottom: 0,
          paddingTop: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => {
          const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            Home: 'home',
            Calendar: 'calendar-today',
            Focus: 'nights-stay',
            Account: 'account-circle',
          };

          if (route.name === 'Create') {
            return null;
          }

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
              backgroundColor: tabBarBackgroundColor,
              borderTopWidth: 1,
              borderColor: tabBarBorderColor,
              shadowColor: isDark ? '#000000' : '#9BB5E8',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: isDark ? 0.32 : 0.18,
              shadowRadius: 18,
              elevation: 12,
            }}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen
        name="Create"
        component={CreateTaskScreen}
        options={{
          tabBarLabel: () => null,
          tabBarItemStyle: {
            width: createSlotWidth,
            flex: 0,
            paddingTop: 1,
            paddingBottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarButton: (props) => (
            <FloatingCreateTabButton
              {...props}
              color={colors.primary}
              ringColor={isDark ? 'rgba(10, 17, 31, 0.96)' : 'rgba(255, 255, 255, 0.96)'}
            />
          ),
        }}
      />
      <Tab.Screen name="Focus" component={FocusModeScreen} />
      <Tab.Screen name="Account">
        {(props) => <AccountDetailsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  const { navigationTheme } = useThemePreference();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const reconcileIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconcileInFlightRef = useRef(false);
  const pendingNotificationPayloadRef = useRef<Record<string, unknown> | null>(null);
  const lastHandledNotificationIdentifierRef = useRef<string | null>(null);
  const pendingDeepLinkRouteRef = useRef<{ name: 'ResetPassword' | 'VerifyEmail'; params?: any } | null>(null);

  useEffect(() => {
    configureNotificationPresentation();
  }, []);

  const navigateFromNotificationPayload = useCallback(async (data?: Record<string, unknown>): Promise<boolean> => {
    if (!isAuthenticated || !isNavigationReady || !navigationRef.current) {
      return false;
    }

    const notificationId = typeof data?.notificationId === 'string' ? data.notificationId.trim() : '';
    if (notificationId.length > 0) {
      void markNotificationAsRead(notificationId).catch(() => {
        logger.warn('Failed to mark push notification as read');
      });
    }

    const taskId = typeof data?.taskId === 'string' ? data.taskId.trim() : '';
    if (taskId.length > 0) {
      try {
        await getTaskById(taskId);
        navigationRef.current.navigate('TaskDetails', { taskId });
        return true;
      } catch (error: any) {
        if (error instanceof ApiError && error.status === 404) {
          navigationRef.current.navigate('Notifications');
          return true;
        }

        logger.warn('Failed to open task from push payload');
        navigationRef.current.navigate('Notifications');
        return true;
      }
    }

    navigationRef.current.navigate('Notifications');
    return true;
  }, [isAuthenticated, isNavigationReady]);

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const identifier = response.notification.request.identifier;
    if (lastHandledNotificationIdentifierRef.current === identifier) {
      return;
    }

    lastHandledNotificationIdentifierRef.current = identifier;

    const rawData = response.notification.request.content.data;
    const data = rawData && typeof rawData === 'object'
      ? (rawData as Record<string, unknown>)
      : undefined;

    void (async () => {
      const handled = await navigateFromNotificationPayload(data);
      if (!handled) {
        pendingNotificationPayloadRef.current = data ?? {};
      }
    })();
  }, [navigateFromNotificationPayload]);

  const forceLogout = useCallback(async () => {
    await clearLocalAuthSession();
    setIsAuthenticated(false);
  }, []);

  const handleRequireReauth = useCallback(async (params?: { email?: string; message?: string }) => {
    await forceLogout();
    requestAnimationFrame(() => {
      navigationRef.current?.resetRoot({
        index: 0,
        routes: [
          {
            name: 'Login',
            params: {
              ...(params?.email ? { email: params.email } : {}),
              ...(params?.message ? { postResetMessage: params.message } : {}),
            },
          },
        ],
      });
    });
  }, [forceLogout]);

  const validateSession = useCallback(async (): Promise<boolean> => {
    const token = await getAuthToken();
    if (!token) {
      setIsAuthenticated(false);
      return false;
    }

    try {
      await getTasks();
      return true;
    } catch {
      await forceLogout();
      return false;
    }
  }, [forceLogout]);

  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        const validSession = await validateSession();
        setIsAuthenticated(validSession);
      } catch (error) {
        logger.error('Failed to restore auth session');
        await forceLogout();
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrapSession();
  }, [forceLogout, validateSession]);

  useEffect(() => {
    if (isBootstrapping || !isAuthenticated) {
      return;
    }

    void syncPushNotificationRegistration({ allowPrompt: false });
  }, [isAuthenticated, isBootstrapping]);

  useEffect(() => {
    const handleIncomingDeepLink = (url: string | null) => {
      if (!url) return;

      const parsed = Linking.parse(url);
      const params = (parsed.queryParams || {}) as Record<string, unknown>;
      const token = typeof params.token === 'string' ? params.token : undefined;
      const email = typeof params.email === 'string' ? params.email : undefined;
      const code = typeof params.code === 'string' ? params.code : undefined;

      let nextRoute: { name: 'ResetPassword' | 'VerifyEmail'; params?: any } | null = null;
      if (parsed.path === 'reset-password') {
        nextRoute = { name: 'ResetPassword', params: { token, email } };
      } else if (parsed.path === 'verify-email') {
        nextRoute = { name: 'VerifyEmail', params: { email, code } };
      }

      if (!nextRoute) {
        return;
      }

      if (!isNavigationReady || !navigationRef.current) {
        pendingDeepLinkRouteRef.current = nextRoute;
        return;
      }

      navigationRef.current.navigate(nextRoute.name, nextRoute.params);
    };

    void Linking.getInitialURL().then((url) => {
      handleIncomingDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleIncomingDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [isNavigationReady]);

  useEffect(() => {
    if (!isNavigationReady || !navigationRef.current || !pendingDeepLinkRouteRef.current) {
      return;
    }

    const pendingRoute = pendingDeepLinkRouteRef.current;
    pendingDeepLinkRouteRef.current = null;
    navigationRef.current.navigate(pendingRoute.name, pendingRoute.params);
  }, [isNavigationReady]);

  useEffect(() => {
    if (typeof Notifications.addNotificationResponseReceivedListener !== 'function') {
      return;
    }

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      }).catch(() => {
        logger.warn('Failed to read last notification response');
      });
    }

    return () => {
      responseSubscription.remove();
    };
  }, [handleNotificationResponse]);

  useEffect(() => {
    if (!isAuthenticated || !isNavigationReady) {
      return;
    }

    if (!pendingNotificationPayloadRef.current) {
      return;
    }

    const pendingPayload = pendingNotificationPayloadRef.current;
    void (async () => {
      const handled = await navigateFromNotificationPayload(pendingPayload);
      if (handled) {
        pendingNotificationPayloadRef.current = null;
      }
    })();
  }, [isAuthenticated, isNavigationReady, navigateFromNotificationPayload]);

  useEffect(() => {
    if (isBootstrapping || !isAuthenticated) {
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
        const hasValidSession = await validateSession();
        if (!hasValidSession) return;

        const enabled = (await AsyncStorage.getItem(APP_CALENDAR_SYNC_ENABLED_KEY)) === 'true';
        if (!enabled) return;

        // Lightweight periodic refresh; getTasks triggers reconcile via shared API hooks.
        await getTasks();
      } catch (error) {
        logger.warn('Calendar periodic reconcile failed');
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
        void syncPushNotificationRegistration({ allowPrompt: false });
      } else {
        stopInterval();
      }
    });

    startIntervalIfNeeded();
    void runPeriodicReconcile();
    void syncPushNotificationRegistration({ allowPrompt: false });

    return () => {
      appStateSubscription.remove();
      stopInterval();
    };
  }, [isAuthenticated, isBootstrapping, validateSession]);

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
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => {
        setIsNavigationReady(true);
      }}
    >
      <RootStack.Navigator
        initialRouteName={isAuthenticated ? 'Main' : 'Login'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {isAuthenticated ? (
          <>
            <RootStack.Screen name="Main">
              {() => (
                <TabNavigator
                  onLogout={() => {
                    setIsAuthenticated(false);
                  }}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="TaskDetails">
              {(props) => (
                <TaskDetailsScreen
                  {...props}
                  onUnauthorized={() => {
                    setIsAuthenticated(false);
                  }}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="CalendarSync" component={CalendarSettingsScreen} />
            <RootStack.Screen name="Notifications" component={NotificationCenterScreen} />
            <RootStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            <RootStack.Screen name="AccountSettings">
              {(props) => (
                <AccountSettingsScreen
                  {...props}
                  onLogout={() => {
                    setIsAuthenticated(false);
                  }}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="GeneralSettings" component={GeneralSettingsScreen} />
            <RootStack.Screen name="Analytics" component={AnalyticsScreen} />
            <RootStack.Screen
              name="ResetPassword"
            >
              {(props) => (
                <ResetPasswordScreen
                  {...props}
                  onPasswordResetSuccess={(params?: { email?: string; message?: string }) => {
                    void handleRequireReauth(params);
                  }}
                />
              )}
            </RootStack.Screen>
          </>
        ) : (
          <>
            <RootStack.Screen name="Login">
              {(props) => (
                <LoginScreen
                  {...props}
                  onAuthSuccess={() => {
                    setIsAuthenticated(true);
                  }}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="ResetPassword">
              {(props) => (
                <ResetPasswordScreen
                  {...props}
                  onPasswordResetSuccess={(params?: { email?: string; message?: string }) => {
                    void handleRequireReauth(params);
                  }}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="VerifyEmail">
              {(props) => (
                <VerifyEmailScreen
                  {...props}
                  onAuthSuccess={() => {
                    setIsAuthenticated(true);
                    requestAnimationFrame(() => {
                      navigationRef.current?.resetRoot({
                        index: 0,
                        routes: [{ name: 'Main', params: { screen: 'Home' } }],
                      });
                    });
                  }}
                />
              )}
            </RootStack.Screen>
          </>
        )}
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
