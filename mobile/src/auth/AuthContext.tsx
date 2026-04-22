import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '../config/api';

type AuthContextValue = {
  user: UserProfile | null;
  setAuthenticatedUser: (user: UserProfile | null) => Promise<void>;
  mergeAuthenticatedUser: (patch: Partial<UserProfile>) => Promise<void>;
  clearAuthenticatedUser: () => Promise<void>;
};

const AUTH_USER_STORAGE_KEY = 'user';
const USER_AVATAR_CACHE_KEY = 'userAvatar';

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistAuthenticatedUser(user: UserProfile | null): Promise<void> {
  if (!user) {
    if (typeof AsyncStorage.multiRemove === 'function') {
      await AsyncStorage.multiRemove([AUTH_USER_STORAGE_KEY, USER_AVATAR_CACHE_KEY]);
      return;
    }

    await Promise.all([
      AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY),
      AsyncStorage.removeItem(USER_AVATAR_CACHE_KEY),
    ]);
    return;
  }

  await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));

  if (user.avatarUrl) {
    await AsyncStorage.setItem(USER_AVATAR_CACHE_KEY, user.avatarUrl);
  } else {
    await AsyncStorage.removeItem(USER_AVATAR_CACHE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const userRef = useRef<UserProfile | null>(null);

  const setAuthenticatedUser = useCallback(async (nextUser: UserProfile | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
    await persistAuthenticatedUser(nextUser);
  }, []);

  const mergeAuthenticatedUser = useCallback(async (patch: Partial<UserProfile>) => {
    const current = userRef.current;
    if (!current) {
      return;
    }

    const nextUser = { ...current, ...patch };
    userRef.current = nextUser;
    setUser(nextUser);
    await persistAuthenticatedUser(nextUser);
  }, []);

  const clearAuthenticatedUser = useCallback(async () => {
    userRef.current = null;
    setUser(null);
    await persistAuthenticatedUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    setAuthenticatedUser,
    mergeAuthenticatedUser,
    clearAuthenticatedUser,
  }), [clearAuthenticatedUser, mergeAuthenticatedUser, setAuthenticatedUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}