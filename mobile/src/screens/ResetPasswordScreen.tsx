import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import ScreenWrapper from '../components/ScreenWrapper';
import GlassCard from '../components/GlassCard';
import {
  getUserFriendlyErrorMessage,
  requestPasswordReset,
  submitPasswordReset,
  validatePasswordResetToken,
} from '../config/api';

type ResetPasswordScreenProps = {
  route: any;
  navigation: any;
  onPasswordResetSuccess?: (params?: { email?: string; message?: string }) => void;
};

export default function ResetPasswordScreen({ route, navigation, onPasswordResetSuccess }: ResetPasswordScreenProps) {
  const { colors } = useTheme();
  const { email, token } = route.params || {};
  
  const [resetToken, setResetToken] = useState(token || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValidationLoading, setTokenValidationLoading] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState(email || '');
  const [requestingReset, setRequestingReset] = useState(false);

  const finishAfterSuccess = (nextEmail?: string) => {
    const message = 'Password updated successfully. Please sign in again.';

    if (onPasswordResetSuccess) {
      onPasswordResetSuccess({
        ...(nextEmail ? { email: nextEmail } : {}),
        message,
      });
      return;
    }

    navigation.replace('Login', {
      ...(nextEmail ? { email: nextEmail } : {}),
      postResetMessage: message,
    });
  };

  useEffect(() => {
    const providedToken = String(token || '').trim();
    if (!providedToken) {
      return;
    }

    let cancelled = false;

    const runValidation = async () => {
      try {
        setTokenValidationLoading(true);
        const result = await validatePasswordResetToken(providedToken);
        if (!cancelled && result.email) {
          setResolvedEmail(result.email);
        }
      } catch {
        if (!cancelled) {
          Alert.alert('Invalid Link', 'This reset link is invalid or expired. Request a new reset email and try again.');
        }
      } finally {
        if (!cancelled) {
          setTokenValidationLoading(false);
        }
      }
    };

    void runValidation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRequestNewToken = async () => {
    const targetEmail = String(resolvedEmail || email || '').trim().toLowerCase();
    if (!targetEmail) {
      Alert.alert('Missing Email', 'Go back and enter your email to request a reset code.');
      return;
    }

    try {
      setRequestingReset(true);
      await requestPasswordReset(targetEmail);
      Alert.alert('Reset Sent', `A new reset code was sent to ${targetEmail}.`);
    } catch (error: unknown) {
      const message = getUserFriendlyErrorMessage(error, 'Unable to send reset email right now.');
      Alert.alert('Request Failed', message);
    } finally {
      setRequestingReset(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetToken.trim()) {
      Alert.alert('Error', 'Please enter the reset token');
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please enter and confirm your new password');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await submitPasswordReset(resetToken.trim(), newPassword);
      const normalizedEmail = String(resolvedEmail || email || '').trim().toLowerCase();
      Alert.alert(
        'Success',
        'Password updated successfully. Please sign in again.',
        [
          {
            text: 'Go to Sign In',
            onPress: () => finishAfterSuccess(normalizedEmail || undefined),
          },
        ]
      );
    } catch (error: unknown) {
      const message = getUserFriendlyErrorMessage(error, 'Failed to reset password. Please try again.');
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper scroll keyboardAware withHorizontalPadding={false}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login')}
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <Text style={[styles.title, { color: colors.text }]}>Reset your password</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}> 
            Enter your reset token and choose a new password to regain access.
          </Text>
        </View>

        <GlassCard style={styles.infoCard} elevated={false}>
          <View style={styles.infoRow}>
            <MaterialIcons name="info-outline" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedText }]}> 
              {resolvedEmail
                ? `Use the reset code sent to ${resolvedEmail}.`
                : 'Use the reset code from your password reset email.'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleRequestNewToken}
            disabled={requestingReset}
            style={styles.requestAnotherButton}
          >
            {requestingReset ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.requestAnotherText, { color: colors.primary }]}>Request another reset code</Text>
            )}
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.formCard}>
          <View style={styles.field}>
            <AppInput
              label="Reset Token"
              value={resetToken}
              onChangeText={setResetToken}
              placeholder="Paste reset token"
              autoCapitalize="none"
              editable={!loading}
              containerStyle={styles.inputContainer}
            />
          </View>

          <View style={styles.field}>
            <AppInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry={!showNewPassword}
              editable={!loading}
              rightIcon={(
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <MaterialIcons
                    name={showNewPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.mutedText}
                  />
                </TouchableOpacity>
              )}
              containerStyle={styles.inputContainer}
            />
          </View>

          <View style={styles.field}>
            <AppInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry={!showConfirmPassword}
              editable={!loading}
              rightIcon={(
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <MaterialIcons
                    name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.mutedText}
                  />
                </TouchableOpacity>
              )}
              containerStyle={styles.inputContainer}
            />
          </View>

          <AppButton
            title="Reset Password"
            onPress={handleResetPassword}
            disabled={loading || tokenValidationLoading}
            loading={loading || tokenValidationLoading}
            style={styles.button}
          />
        </GlassCard>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    minHeight: '100%',
  },
  heroSection: {
    marginTop: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoCard: {
    marginBottom: 12,
    borderRadius: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    marginLeft: 8,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  formCard: {
    borderRadius: 18,
  },
  field: {
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 0,
  },
  button: {
    marginTop: 2,
  },
  requestAnotherButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  requestAnotherText: {
    fontSize: 13,
    fontWeight: '700',
  },
});