import React, { useState, useCallback } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import {
  deleteAccount,
  getUserFriendlyErrorMessage,
  getUserProfile,
  updateUserProfile,
  requestPasswordReset,
  UserProfile,
  ApiError,
} from '../config/api';
import { useAuth } from '../auth/AuthContext';
import { isAuthExitInProgress } from '../auth/authExitState';

type AccountSettingsScreenProps = {
  navigation: any;
  onLogout?: () => Promise<void> | void;
  onSessionExpired?: () => Promise<void> | void;
};

export default function AccountSettingsScreen({ navigation, onLogout, onSessionExpired }: AccountSettingsScreenProps) {
  const { colors } = useTheme();
  const { setAuthenticatedUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      await setAuthenticatedUser(data);
      setProfile(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (!isAuthExitInProgress()) {
          await onSessionExpired?.();
        }
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

    if (!profile) {
      return;
    }

    const updatePayload: { firstName?: string | null; lastName?: string | null } = {};
    if (trimmedFirst !== (profile.firstName ?? '')) {
      updatePayload.firstName = trimmedFirst.length > 0 ? trimmedFirst : null;
    }
    if (trimmedLast !== (profile.lastName ?? '')) {
      updatePayload.lastName = trimmedLast.length > 0 ? trimmedLast : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return;
    }

    try {
      setSaving(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      const updated = await updateUserProfile(updatePayload);
      await setAuthenticatedUser(updated);
      setProfile(updated);
      setFirstName(updated.firstName ?? '');
      setLastName(updated.lastName ?? '');
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (!isAuthExitInProgress()) {
          await onSessionExpired?.();
        }
        return;
      }
      const message = getUserFriendlyErrorMessage(error, 'Failed to save changes.');
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This action is permanent and will delete all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteLoading(true);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
              await deleteAccount();
              if (onLogout) {
                await onLogout();
              } else {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
              }
            } catch (error) {
              if (error instanceof ApiError && error.status === 401) {
                if (!isAuthExitInProgress()) {
                  await onSessionExpired?.();
                }
                return;
              }
              Alert.alert('Error', 'Unable to delete account. Please try again.');
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;

    try {
      setResetLoading(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      await requestPasswordReset(profile.email);
      Alert.alert(
        'Reset Email Sent',
        `A password reset code was sent to ${profile.email}.`,
        [
          {
            text: 'Use Reset Screen',
            onPress: () => navigation.navigate('ResetPassword', { email: profile.email }),
          },
          { text: 'OK' },
        ]
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (!isAuthExitInProgress()) {
          await onSessionExpired?.();
        }
        return;
      }
      const message = getUserFriendlyErrorMessage(error, 'Failed to send reset email. Please try again.');
      Alert.alert('Error', message);
    } finally {
      setResetLoading(false);
    }
  };

  const formatMemberSince = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const shortId = (id: string) => `${id.slice(0, 8)}…`;
  const emailLabel = profile?.isPrivateRelayEmail ? 'Apple private email' : 'Email';

  const authProviderLabel =
    profile?.authProvider === 'apple'
      ? 'Sign in with Apple'
      : profile?.authProvider === 'google'
      ? 'Google'
      : 'Email & Password';
  const authProviderIcon: keyof typeof MaterialIcons.glyphMap =
    profile?.authProvider === 'apple'
      ? 'phone-iphone'
      : profile?.authProvider === 'google'
      ? 'g-mobiledata'
      : 'email';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
          <View style={styles.headerBtn} />
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
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.mutedText }]}>Failed to load profile</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={loadProfile}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleDiscardConfirm}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
        <TouchableOpacity
          style={[
            styles.saveChip,
            { backgroundColor: isDirty ? colors.primary : 'transparent' },
          ]}
          onPress={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.saveChipText, { color: isDirty ? '#FFFFFF' : colors.mutedText }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* PROFILE — editable name fields */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>PROFILE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.fieldIconWrap, { backgroundColor: colors.background }]}>
              <MaterialIcons name="person" size={17} color={colors.primary} />
            </View>
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
            <View style={[styles.fieldIconWrap, { backgroundColor: colors.background }]}>
              <MaterialIcons name="person-outline" size={17} color={colors.primary} />
            </View>
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

        {/* ACCOUNT — read-only info */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow icon="email" label={emailLabel} value={profile.email} colors={colors} hasBorder />
          <InfoRow
            icon="event"
            label="Member Since"
            value={formatMemberSince(profile.createdAt)}
            colors={colors}
            hasBorder
          />
          <InfoRow
            icon={authProviderIcon}
            label="Sign-in"
            value={authProviderLabel}
            colors={colors}
            hasBorder
          />
          <InfoRow
            icon="fingerprint"
            label="User ID"
            value={shortId(profile.id)}
            colors={colors}
            hasBorder={false}
          />
        </View>

        {/* SECURITY */}
        {profile.canResetPassword ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>SECURITY</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleResetPassword}
                disabled={resetLoading}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: `${colors.primary}18` }]}>
                  <MaterialIcons name="lock-reset" size={20} color={colors.primary} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>Reset Password</Text>
                  <Text style={[styles.actionSub, { color: colors.mutedText }]}>
                    We'll send a secure reset link to your email.
                  </Text>
                </View>
                {resetLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialIcons name="chevron-right" size={20} color={colors.mutedText} />
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>SECURITY</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={styles.actionRow}>
                <View style={[styles.actionIconWrap, { backgroundColor: `${colors.primary}18` }]}> 
                  <MaterialIcons
                    name={profile.authProvider === 'apple' ? 'phone-iphone' : 'lock-outline'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>Password Reset</Text>
                  <Text style={[styles.actionSub, { color: colors.mutedText }]}> 
                    {profile.authProvider === 'apple'
                      ? 'This account uses Sign in with Apple.'
                      : 'This account signs in with Google and does not use a password.'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* DANGER ZONE */}
        <Text style={[styles.sectionLabel, { color: colors.danger }]}>DANGER ZONE</Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: `${colors.danger}40`,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: `${colors.danger}18` }]}>
              {deleteLoading ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <MaterialIcons name="delete-forever" size={20} color={colors.danger} />
              )}
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete Account</Text>
              <Text style={[styles.actionSub, { color: colors.mutedText }]}>
                Permanently remove your account and all data.
              </Text>
            </View>
            {!deleteLoading && (
              <MaterialIcons name="chevron-right" size={20} color={colors.danger} />
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
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
      <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
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
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
  },
  saveChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  fieldIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    width: 42,
    fontSize: 13,
    fontWeight: '600',
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
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionSub: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
});
