import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';

const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';

export type EditProfileUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
};

export default function EditProfileScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const userFromParams = route.params?.user as EditProfileUser | undefined;

  const [firstName, setFirstName] = useState(userFromParams?.firstName ?? '');
  const [lastName, setLastName] = useState(userFromParams?.lastName ?? '');
  const [email, setEmail] = useState(userFromParams?.email ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userFromParams) {
      setFirstName(userFromParams.firstName);
      setLastName(userFromParams.lastName);
      setEmail(userFromParams.email);
    }
  }, [userFromParams]);

  const handleSave = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      Alert.alert('Error', 'First name, last name, and email are required.');
      return;
    }

    const changes: Record<string, string> = {};
    if (trimmedFirst !== userFromParams?.firstName) changes.firstName = trimmedFirst;
    if (trimmedLast !== userFromParams?.lastName) changes.lastName = trimmedLast;
    if (trimmedEmail !== userFromParams?.email) changes.email = trimmedEmail;

    if (Object.keys(changes).length === 0) {
      navigation.goBack();
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Please log in again.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err?.error ?? `Request failed (${response.status}). Try again or check the backend is deployed with PATCH /api/user/profile.`;
        Alert.alert('Error', message);
        return;
      }

      const data = await response.json();
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      Alert.alert('Success', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      console.error(e);
      const message = e?.message?.includes('fetch') || e?.message?.includes('Network')
        ? 'Network error. Check your connection and that the backend is running.'
        : 'Failed to update profile. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>First name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="First name"
              placeholderTextColor={colors.mutedText}
              value={firstName}
              onChangeText={setFirstName}
              editable={!saving}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Last name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Last name"
              placeholderTextColor={colors.mutedText}
              value={lastName}
              onChangeText={setLastName}
              editable={!saving}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.mutedText}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!saving}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => navigation.goBack()}
              disabled={saving}
            >
              <Text style={[styles.cancelText, { color: colors.mutedText }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 40 },
  keyboard: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
