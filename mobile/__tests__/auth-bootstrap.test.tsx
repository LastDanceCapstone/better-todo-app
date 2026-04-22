import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import App from '../App';
import { getTasks, getUserProfile } from '../src/config/api';

jest.mock('../src/config/api', () => {
  const actual = jest.requireActual('../src/config/api');
  return {
    ...actual,
    getTasks: jest.fn(),
    getUserProfile: jest.fn(),
    deleteAuthToken: jest.fn(),
  };
});

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => <>{children}</>,
  DefaultTheme: { colors: { primary: '#004AAD', background: '#FFFFFF', card: '#FFFFFF', text: '#111827', border: '#E5E7EB', notification: '#FF4D4D' } },
  DarkTheme: { colors: { primary: '#004AAD', background: '#0B0F19', card: '#111827', text: '#F9FAFB', border: '#1F2937', notification: '#F87171' } },
  useTheme: () => ({ colors: { primary: '#004AAD', background: '#FFFFFF', card: '#FFFFFF', text: '#111827', border: '#E5E7EB', mutedText: '#6B7280', danger: '#FF4D4D', success: '#22C55E', notification: '#FF4D4D', surface: '#FFFFFF' } }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => <>{children}</>,
    Screen: ({ name, component: Component, children }: any) => {
      const { View } = require('react-native');
      const navigation = { addListener: jest.fn(() => jest.fn()), replace: jest.fn(), reset: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), goBack: jest.fn() };
      const route = { params: {} };
      return <View>{Component ? <Component navigation={navigation} route={route} /> : children?.({ navigation, route })}</View>;
    },
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: any) => <>{children}</>,
    Screen: ({ component: Component, children }: any) => {
      const { View } = require('react-native');
      const navigation = { addListener: jest.fn(() => jest.fn()), navigate: jest.fn() };
      const route = { params: {} };
      return <View>{Component ? <Component navigation={navigation} route={route} /> : children?.({ navigation, route })}</View>;
    },
  }),
}));

jest.mock('../src/screens/LoginScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Login Screen</Text>;
});
jest.mock('../src/screens/HomeScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Home Screen</Text>;
});
jest.mock('../src/screens/CreateTaskScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Create Screen</Text>;
});
jest.mock('../src/screens/TaskDetailsScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Task Details Screen</Text>;
});
jest.mock('../src/screens/AccountDetailsScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Account Screen</Text>;
});
jest.mock('../src/screens/ResetPasswordScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Reset Password Screen</Text>;
});
jest.mock('../src/screens/CalendarScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Calendar Screen</Text>;
});
jest.mock('../src/screens/CalendarSettingsScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Calendar Settings Screen</Text>;
});
jest.mock('../src/screens/NotificationCenterScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Notifications Screen</Text>;
});
jest.mock('../src/screens/NotificationSettingsScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Notification Settings Screen</Text>;
});
jest.mock('../src/screens/AccountSettingsScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Account Settings Screen</Text>;
});
jest.mock('../src/screens/GeneralSettingsScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>General Settings Screen</Text>;
});
jest.mock('../src/screens/AnalyticsScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Analytics Screen</Text>;
});
jest.mock('../src/screens/FocusModeScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Focus Screen</Text>;
});

describe('auth bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads authenticated state when a token exists', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token-present');
    (getTasks as jest.Mock).mockResolvedValue([]);
    (getUserProfile as jest.Mock).mockResolvedValue({
      id: 'user-1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      timezone: 'UTC',
      emailVerified: true,
      avatarUrl: null,
      authProvider: 'local',
      canResetPassword: true,
      isPrivateRelayEmail: false,
      createdAt: '2026-04-20T00:00:00.000Z',
    });

    const screen = render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Home Screen')).toBeTruthy();
    });
    expect(screen.queryByText('Login Screen')).toBeNull();
  });

  it('loads unauthenticated state when no token exists', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const screen = render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Login Screen')).toBeTruthy();
    });
    expect(getTasks).not.toHaveBeenCalled();
  });
});