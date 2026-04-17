import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CreateTaskScreen from '../src/screens/CreateTaskScreen';
import HomeScreen from '../src/screens/HomeScreen';
import { createTask, getAuthToken, getTasks, updateTask, getUnreadNotificationCount, deleteAuthToken } from '../src/config/api';

jest.mock('../src/config/api', () => ({
  ...jest.requireActual('../src/config/api'),
  createTask: jest.fn(),
  getAuthToken: jest.fn(),
  getTasks: jest.fn(),
  updateTask: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  deleteAuthToken: jest.fn(),
}));

jest.mock('../src/theme', () => ({
  useTheme: () => ({ colors: { primary: '#004AAD', background: '#FFFFFF', surface: '#FFFFFF', text: '#111827', border: '#E5E7EB', mutedText: '#6B7280', danger: '#FF4D4D', success: '#22C55E', notification: '#FF4D4D', card: '#FFFFFF' } }),
  useThemePreference: () => ({ currentTheme: 'light', navigationTheme: { colors: { primary: '#004AAD', background: '#FFFFFF' } }, setThemePreference: jest.fn() }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children ?? null,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('expo-av', () => ({
  Audio: {
    getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
    Recording: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock('../src/components/AppInput', () => {
  return (props: any) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
      />
    );
  };
});

jest.mock('../src/components/AppButton', () => ({ title, onPress }: any) => {
  const { Pressable, Text } = require('react-native');
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  );
});

jest.mock('../src/components/SwipeableTaskCard', () => ({ task, onStatusChange }: any) => {
  const { Pressable, Text } = require('react-native');
  return (
    <Pressable onPress={() => onStatusChange(task.id, 'COMPLETED')}>
      <Text>{task.title}</Text>
      <Text>Complete {task.id}</Text>
    </Pressable>
  );
});

jest.mock('../src/components/NotificationBell', () => () => {
  const { Text } = require('react-native');
  return <Text>Bell</Text>;
});
jest.mock('../src/components/Confetti', () => ({ Confetti: () => null }));
jest.mock('../src/hooks/useCompletionCelebration', () => ({
  useCompletionCelebration: () => ({ isCelebrating: false, triggerCelebration: jest.fn() }),
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => children,
}));

describe('mobile task flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUnreadNotificationCount as jest.Mock).mockResolvedValue(0);
  });

  it('creates a task through the create flow', async () => {
    const navigation = { navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => jest.fn()), setParams: jest.fn() };
    (getAuthToken as jest.Mock).mockResolvedValue('token-present');
    (createTask as jest.Mock).mockResolvedValue({ task: { id: 'task-1' } });

    const screen = render(<CreateTaskScreen navigation={navigation} route={{ params: {} }} />);

    fireEvent.changeText(screen.getByLabelText('Task Title'), 'Ship minimal tests');
    await act(async () => {
      fireEvent.press(screen.getAllByText('Create Task')[1]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Ship minimal tests' })
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Task Title').props.value).toBe('');
    });
  });

  it('updates task state through the home flow without crashing', async () => {
    const navigation = { addListener: jest.fn(() => jest.fn()), reset: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
    const route = { params: {} };
    (getTasks as jest.Mock).mockResolvedValue([
      {
        id: 'task-1',
        title: 'Existing task',
        description: '',
        dueAt: null,
        completedAt: null,
        statusChangedAt: null,
        status: 'TODO',
        priority: 'MEDIUM',
        createdAt: '2026-04-11T10:00:00.000Z',
        updatedAt: '2026-04-11T10:00:00.000Z',
        userId: 'user-1',
        subtasks: [],
      },
    ]);
    (updateTask as jest.Mock).mockResolvedValue({ id: 'task-1', status: 'COMPLETED' });

    const screen = render(<HomeScreen navigation={navigation} route={route} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Existing task')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Complete task-1'));
    });

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({ status: 'COMPLETED' }));
    });

    await waitFor(() => {
      expect(screen.getByText('No active tasks yet')).toBeTruthy();
    }, { timeout: 1000 });

    expect(deleteAuthToken).not.toHaveBeenCalled();
  });
});