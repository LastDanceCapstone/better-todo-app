import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeVariant = 'light' | 'dark';

export type AppColors = {
  primary: string;
  background: string;
  card: string;
  surface: string;
  text: string;
  border: string;
  notification: string;
  mutedText: string;
  danger: string;
  success: string;
};

export type AppTheme = Theme & { colors: AppColors };

interface ThemeContextValue {
  themePreference: ThemePreference;
  setThemePreference: (next: ThemePreference) => void;
  currentTheme: ThemeVariant;
  navigationTheme: AppTheme;
  colors: AppColors;
}

const THEME_KEY = 'themePreference';

const lightColors: AppColors = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#111827',
  mutedText: '#6B7280',
  border: '#E5E7EB',
  primary: '#2563EB',
  danger: '#FF4D4D',
  success: '#22C55E',
  notification: '#FF4D4D',
};

const darkColors: AppColors = {
  background: '#0B0F19',
  surface: '#111827',
  card: '#1F2937',
  text: '#F9FAFB',
  mutedText: '#94A3B8',
  border: '#1F2937',
  primary: '#60A5FA',
  danger: '#F87171',
  success: '#34D399',
  notification: '#F87171',
};

const buildNavTheme = (variant: ThemeVariant): AppTheme => {
  const base = variant === 'dark' ? DarkTheme : DefaultTheme;
  const colors = variant === 'dark' ? darkColors : lightColors;
  return { ...base, colors: { ...base.colors, ...colors } } as AppTheme;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const resolveSystem = (): ThemeVariant =>
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [pref, setPrefState] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<ThemeVariant>(resolveSystem());

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPrefState(stored);
      }
    });
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const setThemePreference = useCallback((next: ThemePreference) => {
    setPrefState(next);
    AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const currentTheme: ThemeVariant = pref === 'system' ? systemTheme : pref;
  const colors = currentTheme === 'dark' ? darkColors : lightColors;
  const navigationTheme = useMemo(() => buildNavTheme(currentTheme), [currentTheme]);

  const value = useMemo(
    () => ({ themePreference: pref, setThemePreference, currentTheme, navigationTheme, colors }),
    [pref, setThemePreference, currentTheme, navigationTheme, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemePreference = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used inside ThemeProvider');
  return ctx;
};

export const useTheme = (): AppTheme & { colors: AppColors } => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx.navigationTheme;
};