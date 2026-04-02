import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { getUserProfile, updateUserProfile, UserProfile, ApiError } from '../config/api';

export default function AccountSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const isDirty =
    profile !== null &&
    (firstName.trim() !== (profile.firstName ?? '') ||
      lastName.trim() !== (profile.lastName ?? ''));

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserProfile();
      setProfile(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      Alert.alert('Validation', 'First name cannot be empty.');
      return;
    }
    if (!trimmedLast) {
      Alert.alert('Validation', 'Last name cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      const updated = await updateUserProfile({
        firstName: trimmedFirst,
        lastName: trimmedLast,
      });
      setProfile(updated);
      setFirstName(updated.firstName ?? '');
      setLastName(updated.lastName ?? '');
      // Brief success confirmation without blocking the user
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to save changes.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardConfirm = () => {
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Discard Changes', 'Keep Editing'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (index) => {
          if (index === 0) navigation.goBack();
        }
      );
    } else {
      Alert.alert('Discard Changes?', 'You have unsaved edits.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const formatMemberSince = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const shortId = (id: string) => `${id.slice(0, 8)}…`;

  const authProviderLabel =
    profile?.authProvider === 'google' ? 'Google' : 'Email & Password';
  const authProviderIcon: keyof typeof MaterialIcons.glyphMap =
    profile?.authProvider === 'google' ? 'g-mobiledata' : 'email';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.mutedText }]}>Failed to load profile</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={loadProfile}
          >
            <Text style={[styles.retryBtnText, { color: colors.surface }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleDiscardConfirm}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: isDirty ? colors.primary : colors.border },
          ]}
          onPress={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={[styles.saveBtnText, { color: isDirty ? colors.surface : colors.mutedText }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Editable Name Fields */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>NAME</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>First</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.mutedText}
              style={[styles.fieldInput, { color: colors.text }]}
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={100}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Last</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={colors.mutedText}
              style={[styles.fieldInput, { color: colors.text }]}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={isDirty ? handleSave : undefined}
              maxLength={100}
            />
          </View>
        </View>

        {/* Read-only Account Info */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow
            icon="email"
            label="Email"
            value={profile.email}
            colors={colors}
            hasBorder
          />
          <InfoRow
            icon="fingerprint"
            label="User ID"
            value={shortId(profile.id)}
            colors={colors}
            hasBorder
          />
          <InfoRow
            icon="event"
            label="Member Since"
            value={formatMemberSince(profile.createdAt)}
            colors={colors}
            hasBorder
          />
          <InfoRow
            icon={authProviderIcon}
            label="Sign-in Method"
            value={authProviderLabel}
            colors={colors}
            hasBorder={false}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
  hasBorder,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  colors: any;
  hasBorder: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        hasBorder && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.infoIconWrap, { backgroundColor: colors.background }]}>
        <MaterialIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={[styles.infoLabel, { color: colors.mutedText }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 64,
    alignItems: 'flex-start',
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    width: 52,
    fontSize: 14,
    fontWeight: '500',
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
});
