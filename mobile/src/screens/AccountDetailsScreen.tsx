import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Calendar from 'expo-calendar';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, useThemePreference } from '../theme';
import {
  ApiError,
  getUserFriendlyErrorMessage,
  getUserProfile,
  type UserProfile,
  updateUserAvatar,
  uploadUserAvatarImage,
} from '../config/api';
import { disconnectCurrentPushInstallation } from '../services/pushNotifications';
import { clearLocalAuthSession } from '../utils/session';
import { logger } from '../utils/logger';
const APP_CALENDAR_STORAGE_KEY = 'prioritizeCalendarAppId';
const USER_AVATAR_CACHE_KEY = 'userAvatar';

interface SettingRow {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}

type AccountDetailsScreenProps = {
  navigation: any;
  onLogout?: () => void;
};

export default function AccountDetailsScreen({ navigation, onLogout }: AccountDetailsScreenProps) {
  const { colors } = useTheme();
  const { themePreference, setThemePreference } = useThemePreference();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarUpdating, setAvatarUpdating] = useState(false);
  const [calendarSyncOn, setCalendarSyncOn] = useState(false);
  const sanitizedAvatarUri = avatarUri?.trim() || null;

  useEffect(() => {
    fetchUserProfile();
    requestPermissions();
  }, []);

  const loadCalendarSyncStatus = async () => {
    try {
      const permission = await Calendar.getCalendarPermissionsAsync();
      if (permission.status !== 'granted') {
        setCalendarSyncOn(false);
        return;
      }

      const savedCalendarId = await AsyncStorage.getItem(APP_CALENDAR_STORAGE_KEY);
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

      const hasPrioritizeCalendar = calendars.some((calendar) => calendar.title === 'Prioritize');
      const hasSavedCalendar = savedCalendarId
        ? calendars.some((calendar) => calendar.id === savedCalendarId)
        : false;

      setCalendarSyncOn(hasPrioritizeCalendar || hasSavedCalendar);
    } catch {
      setCalendarSyncOn(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadCalendarSyncStatus();
    }, [])
  );

  const cacheAvatar = async (uri: string | null) => {
    try {
      const normalizedUri = uri?.trim() || null;
      if (normalizedUri) {
        await AsyncStorage.setItem(USER_AVATAR_CACHE_KEY, normalizedUri);
      } else {
        await AsyncStorage.removeItem(USER_AVATAR_CACHE_KEY);
      }
      setAvatarUri(normalizedUri);
      setAvatarLoadFailed(false);
    } catch (error) {
      logger.warn('Failed to cache avatar');
    }
  };

  const requestPermissions = async () => {
    // Request camera and media library permissions
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      logger.warn('Camera or library permissions not fully granted');
    }
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      // Show cached avatar immediately while the network request is in flight
      const cachedAvatar = await AsyncStorage.getItem(USER_AVATAR_CACHE_KEY);
      if (cachedAvatar) {
        setAvatarUri(cachedAvatar.trim());
        setAvatarLoadFailed(false);
      }
      const profile = await getUserProfile();
      setUser(profile);
      await cacheAvatar(profile.avatarUrl ?? null);
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          await AsyncStorage.setItem('user', JSON.stringify({ ...parsed, avatarUrl: profile.avatarUrl ?? null }));
        }
      } catch {}
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.');
        handleLogout();
        return;
      }

      logger.warn('Failed to fetch user profile');
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to load profile. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPress = () => {
    if (avatarUpdating) {
      return;
    }

    if (Platform.OS === 'ios') {
      // iOS Action Sheet
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          } else if (buttonIndex === 3) {
            removeAvatar();
          }
        }
      );
    } else {
      // Android Alert
      Alert.alert(
        'Change Avatar',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Library', onPress: pickImage },
          { text: 'Remove Photo', onPress: removeAvatar, style: 'destructive' },
        ]
      );
    }
  };

  const removeAvatar = async () => {
    try {
      setAvatarUpdating(true);
      const updatedUser = await updateUserAvatar(null);
      setUser(updatedUser);
      await cacheAvatar(null);
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          await AsyncStorage.setItem('user', JSON.stringify({ ...parsed, avatarUrl: null }));
        }
      } catch {}
    } catch (error: any) {
      logger.warn('Failed to remove avatar');
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to remove avatar. Please try again.'));
    } finally {
      setAvatarUpdating(false);
    }
  };

  const uploadAvatarAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    const previousUri = avatarUri;
    try {
      setAvatarUpdating(true);
      setAvatarUri(asset.uri);
      setAvatarLoadFailed(false);
      const updatedUser = await uploadUserAvatarImage({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      setUser(updatedUser);
      await cacheAvatar(updatedUser.avatarUrl ?? null);
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          await AsyncStorage.setItem('user', JSON.stringify({ ...parsed, avatarUrl: updatedUser.avatarUrl ?? null }));
        }
      } catch {}
    } catch (error: any) {
      logger.warn('Failed to upload avatar');
      setAvatarUri(previousUri);
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to upload avatar. Please try again.'));
    } finally {
      setAvatarUpdating(false);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatarAsset(result.assets[0]);
      }
    } catch (error) {
      logger.warn('Failed to take photo');
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatarAsset(result.assets[0]);
      }
    } catch (error) {
      logger.warn('Failed to pick image');
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectCurrentPushInstallation();
              await clearLocalAuthSession();
              if (onLogout) {
                onLogout();
              } else {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
              }
            } catch (error) {
              logger.warn('Failed to complete logout');
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (!user) return '?';
    const firstInitial = user.firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = user.lastName?.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}` || '?';
  };

  const themeLabel = themePreference === 'system'
    ? 'System'
    : themePreference === 'light'
      ? 'Light'
      : 'Dark';

  const handleThemePress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Light', 'Dark', 'System'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) setThemePreference('light');
          if (buttonIndex === 2) setThemePreference('dark');
          if (buttonIndex === 3) setThemePreference('system');
        }
      );
      return;
    }

    Alert.alert(
      'Theme',
      'Choose a theme mode',
      [
        { text: 'Light', onPress: () => setThemePreference('light') },
        { text: 'Dark', onPress: () => setThemePreference('dark') },
        { text: 'System', onPress: () => setThemePreference('system') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const settingRows: SettingRow[] = [
    {
      id: 'account',
      icon: 'person',
      label: 'Account',
      onPress: () => navigation.navigate('AccountSettings'),
    },
    {
      id: 'general',
      icon: 'settings',
      label: 'General',
      onPress: () => navigation.navigate('GeneralSettings'),
    },
    {
      id: 'calendar',
      icon: 'calendar-today',
      label: 'Calendar',
      onPress: () => navigation.navigate('CalendarSync'),
    },
    {
      id: 'theme',
      icon: 'palette',
      label: 'Theme',
      value: themeLabel,
      onPress: handleThemePress,
    },
    {
      id: 'notifications',
      icon: 'notifications',
      label: 'Notifications',
      onPress: () => navigation.navigate('NotificationSettings'),
    },
    {
      id: 'analytics',
      icon: 'insights',
      label: 'Analytics',
      onPress: () => navigation.navigate('Analytics'),
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.mutedText }]}>Failed to load profile</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchUserProfile}>
            <Text style={[styles.retryButtonText, { color: colors.surface }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: `${colors.border}CC`,
              shadowColor: '#000',
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Avatar Section */}
        <View
          style={[
            styles.avatarSection,
            {
              backgroundColor: colors.surface,
              borderColor: `${colors.border}D6`,
              shadowColor: '#000',
            },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
          >
            {sanitizedAvatarUri && !avatarLoadFailed ? (
              <Image
                source={{ uri: sanitizedAvatarUri }}
                style={styles.avatarImage}
                onError={() => {
                  if (__DEV__) {
                    logger.warn('Avatar image failed to load on Account screen');
                  }
                  setAvatarLoadFailed(true);
                }}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarInitials, { color: colors.surface }]}>{getInitials()}</Text>
              </View>
            )}
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
              {avatarUpdating ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <MaterialIcons name="camera-alt" size={16} color={colors.surface} />
              )}
            </View>
          </TouchableOpacity>

          <Text style={[styles.userName, { color: colors.text }]}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={[styles.userEmail, { color: colors.mutedText }]}>{user.email}</Text>
          <Text style={[styles.memberSince, { color: colors.mutedText }]}>
            Member since {new Date(user.createdAt).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </Text>
        </View>

        {/* Settings List */}
        <View style={styles.settingsSection}>
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>SETTINGS</Text>
          <View
            style={[
              styles.settingsList,
              {
                backgroundColor: colors.surface,
                borderColor: `${colors.border}D6`,
                shadowColor: '#000',
              },
            ]}
          >
            {settingRows.map((row, index) => (
              <TouchableOpacity
                key={row.id}
                style={[
                  styles.settingRow,
                  { borderBottomColor: colors.border },
                  index === settingRows.length - 1 && styles.settingRowLast,
                ]}
                onPress={row.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingRowLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: colors.background, borderColor: `${colors.border}CC` }]}> 
                    <MaterialIcons name={row.icon} size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{row.label}</Text>
                </View>
                <View style={styles.settingRowRight}>
                  {row.value ? (
                    <Text style={[styles.settingValue, { color: colors.mutedText }]}>{row.value}</Text>
                  ) : null}
                  <MaterialIcons name="chevron-right" size={24} color={colors.mutedText} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>


        {/* Logout Button */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.danger,
              shadowColor: colors.danger,
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialIcons name="logout" size={20} color={colors.danger} />
          <Text style={[styles.logoutButtonText, { color: colors.danger }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4E8FFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#000000',
  },
  headerSpacer: {
    width: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 18,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E5E5',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4E8FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4E8FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 25,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 3,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 7,
  },
  memberSince: {
    fontSize: 12,
    color: '#999999',
  },
  settingsSection: {
    paddingHorizontal: 16,
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666666',
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  settingsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  settingValue: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF4D4D',
    marginLeft: 8,
  },
  manageBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});