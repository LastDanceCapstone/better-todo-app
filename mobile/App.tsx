import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useThemePreference } from './src/theme/ThemeProvider';

import PremiumLoginScreen from './src/screens/PremiumLoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CalendarSettingsScreen from './src/screens/CalendarSettingsScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import AccountDetailsScreen from './src/screens/AccountDetailsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { navigationTheme } = useThemePreference();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        setInitialRoute(token ? 'Home' : 'Login');
      } catch {
        setInitialRoute('Login');
      }
    };
    checkAuth();
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={PremiumLoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Create" component={CreateTaskScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="CalendarSync" component={CalendarSettingsScreen} />
        <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} />
        <Stack.Screen name="Account" component={AccountDetailsScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}
