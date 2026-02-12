// App.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemeProvider, useThemePreference, useTheme } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import AccountDetailsScreen from './src/screens/AccountDetailsScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const CalendarPlaceholderScreen = () => {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Calendar</Text>
      <Text style={{ marginTop: 8, color: colors.mutedText }}>Coming soon</Text>
    </View>
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
      <Tab.Screen name="Calendar" component={CalendarPlaceholderScreen} />
      <Tab.Screen name="Account" component={AccountDetailsScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { navigationTheme } = useThemePreference();

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Main" component={TabNavigator} />
        <RootStack.Screen name="TaskDetails" component={TaskDetailsScreen} />
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
