import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { useTheme as useNavigationTheme } from '@react-navigation/native';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeVariant = 'light' | 'dark';

interface ThemeTokens {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  primary: string;
  danger: string;
  success: string;
}

interface ThemeContextValue {
  themePreference: ThemePreference;
  setThemePreference: (nextPreference: ThemePreference) => void;
  currentTheme: ThemeVariant;
  navigationTheme: Theme;
}

const THEME_PREFERENCE_KEY = 'themePreference';

const lightTokens: ThemeTokens = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#111827',
  mutedText: '#6B7280',
  border: '#E5E7EB',
  primary: '#2563EB',
  danger: '#FF4D4D',
  success: '#22C55E',
};

const darkTokens: ThemeTokens = {
  background: '#0B0F19',
  surface: '#111827',
  text: '#F9FAFB',
  mutedText: '#94A3B8',
  border: '#1F2937',
  primary: '#60A5FA',
  danger: '#F87171',
  success: '#34D399',
};

const createNavigationTheme = (variant: ThemeVariant): Theme => {
  const baseTheme = variant === 'dark' ? DarkTheme : DefaultTheme;
  const tokens = variant === 'dark' ? darkTokens : lightTokens;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: tokens.primary,
      background: tokens.background,
      card: tokens.surface,
      text: tokens.text,
      border: tokens.border,
      notification: tokens.danger,
      surface: tokens.surface,
      mutedText: tokens.mutedText,
      danger: tokens.danger,
      success: tokens.success,
    },
  } as Theme;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const resolveSystemTheme = (): ThemeVariant =>
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<ThemeVariant>(resolveSystemTheme());

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemePreferenceState(stored);
        }
      } catch (error) {
        console.warn('Failed to load theme preference', error);
      }
    };

    loadPreference();
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => subscription.remove();
  }, []);

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    setThemePreferenceState(nextPreference);
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextPreference).catch((error) =>
      console.warn('Failed to save theme preference', error)
    );
  }, []);

  const currentTheme: ThemeVariant = themePreference === 'system' ? systemTheme : themePreference;
  const navigationTheme = useMemo(() => createNavigationTheme(currentTheme), [currentTheme]);

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference,
      currentTheme,
      navigationTheme,
    }),
    [themePreference, setThemePreference, currentTheme, navigationTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemePreference = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemePreference must be used within ThemeProvider');
  }
  return context;
};

export type AppColors = {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
  surface: string;
  mutedText: string;
  danger: string;
  success: string;
};

export type AppTheme = Theme & { colors: AppColors };

export const useTheme = (): AppTheme => {
  return useNavigationTheme() as AppTheme;
};
