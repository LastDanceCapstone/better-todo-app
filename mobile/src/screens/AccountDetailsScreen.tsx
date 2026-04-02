import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image, Switch, Platform, ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, useThemePreference } from '../theme/ThemeProvider';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  cancelAllNotifications,
  requestNotificationPermission,
} from '../config/notifications';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export default function AccountDetailsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { themePreference, setThemePreference } = useThemePreference();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [reminderOn, setReminderOn] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadUser();
      loadAvatar();
    }, [])
  );

  const loadUser = async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } finally {
      setLoading(false);
    }
  };

  const loadAvatar = async () => {
    const saved = await AsyncStorage.getItem('userAvatar');
    if (saved) setAvatarUri(saved);
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (i) => {
          if (i === 1) takePhoto();
          else if (i === 2) pickImage();
          else if (i === 3) removeAvatar();
        }
      );
    } else {
      Alert.alert('Change Avatar', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        { text: 'Remove Photo', onPress: removeAvatar, style: 'destructive' },
      ]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await AsyncStorage.setItem('userAvatar', result.assets[0].uri);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Library permission required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await AsyncStorage.setItem('userAvatar', result.assets[0].uri);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const removeAvatar = async () => {
    await AsyncStorage.removeItem('userAvatar');
    setAvatarUri(null);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsOn(value);
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow notifications in your phone settings.');
        setNotificationsOn(false);
      }
    } else {
      await cancelAllNotifications();
      setReminderOn(false);
    }
  };

  const handleReminderToggle = async (value: boolean) => {
    setReminderOn(value);
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow notifications in your phone settings.');
        setReminderOn(false);
        return;
      }
      const id = await scheduleDailyReminder(9, 0);
      if (!id) {
        Alert.alert('Error', 'Could not schedule daily reminder.');
        setReminderOn(false);
      } else {
        Alert.alert('Daily Reminder Set ✅', 'You will be reminded every day at 9:00 AM!');
      }
    } else {
      await cancelDailyReminder();
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('user');
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const handleThemePress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Light', 'Dark', 'System'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) setThemePreference('light');
          else if (i === 2) setThemePreference('dark');
          else if (i === 3) setThemePreference('system');
        }
      );
    } else {
      Alert.alert('Theme', 'Choose theme', [
        { text: 'Light', onPress: () => setThemePreference('light') },
        { text: 'Dark', onPress: () => setThemePreference('dark') },
        { text: 'System', onPress: () => setThemePreference('system') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const getInitials = () => {
    if (!user) return '?';
    return `${user.firstName?.charAt(0)?.toUpperCase() ?? ''}${user.lastName?.charAt(0)?.toUpperCase() ?? ''}` || '?';
  };

  const themeLabel =
    themePreference === 'system' ? 'System' : themePreference === 'light' ? 'Light' : 'Dark';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar + Name */}
        <View style={[styles.avatarSection, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleAvatarPress} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarInitials, { color: '#fff' }]}>{getInitials()}</Text>
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="camera-alt" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.firstName} {user?.lastName}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedText }]}>{user?.email}</Text>
          <Text style={[styles.memberSince, { color: colors.mutedText }]}>
            Member since {user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : '—'}
          </Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { label: 'Tasks Created', value: '12' },
            { label: 'Completed', value: '8' },
            { label: 'Streak', value: '3 days' },
          ].map((s, i) => (
            <View key={i} style={[styles.statItem, i < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedText }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Preferences */}
        <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>PREFERENCES</Text>
        <View style={[styles.settingsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={handleThemePress}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <MaterialIcons name="palette" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
            <Text style={[styles.rowValue, { color: colors.mutedText }]}>{themeLabel}</Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.mutedText} />
          </TouchableOpacity>

          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <MaterialIcons name="notifications" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Notifications</Text>
            <Switch
              value={notificationsOn}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: colors.border, true: `${colors.primary}80` }}
              thumbColor={notificationsOn ? colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <MaterialIcons name="alarm" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Daily Reminder (9 AM)</Text>
            <Switch
              value={reminderOn}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.border, true: `${colors.primary}80` }}
              thumbColor={reminderOn ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* App */}
        <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>APP</Text>
        <View style={[styles.settingsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate('CalendarSync')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Calendar Sync</Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.mutedText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => Alert.alert('Privacy Policy', 'Your data stays on your device.')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy Policy</Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.mutedText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 0 }]}
            onPress={() => Alert.alert('App Version', 'Prioritize v1.0.0')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <MaterialIcons name="info" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>About</Text>
            <Text style={[styles.rowValue, { color: colors.mutedText }]}>v1.0.0</Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.mutedText} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.surface, borderColor: colors.danger }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialIcons name="logout" size={20} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  avatarSection: { alignItems: 'center', paddingVertical: 28, marginBottom: 12 },
  avatarContainer: { position: 'relative', marginBottom: 14 },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 34, fontWeight: '700' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  userEmail: { fontSize: 14, marginBottom: 6 },
  memberSince: { fontSize: 12 },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  sectionTitle: { fontSize: 12, fontWeight: '700', paddingHorizontal: 20, marginBottom: 8, letterSpacing: 0.5 },
  settingsList: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 13, fontWeight: '500', marginRight: 4 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, paddingVertical: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  logoutText: { fontSize: 16, fontWeight: '700' },
});