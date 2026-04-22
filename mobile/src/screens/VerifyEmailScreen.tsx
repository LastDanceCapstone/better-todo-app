import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import { getUserFriendlyErrorMessage, resendEmailVerification, saveAuthToken, verifyEmailCode } from '../config/api';
import { useTheme } from '../theme';

export default function VerifyEmailScreen({ route, navigation, onAuthSuccess }: any) {
  const { colors } = useTheme();
  const prefilledEmail = useMemo(() => {
    const raw = route?.params?.email;
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  }, [route?.params?.email]);

  const prefilledCode = useMemo(() => {
    const raw = route?.params?.code;
    return typeof raw === 'string' ? raw.trim() : '';
  }, [route?.params?.code]);

  const [email, setEmail] = useState(prefilledEmail);
  const [code, setCode] = useState(prefilledCode);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  useEffect(() => {
    if (prefilledCode) {
      setCode(prefilledCode);
    }
  }, [prefilledCode]);

  const handleVerify = async () => {
    if (loading || resending) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      Alert.alert('Error', 'Enter the email you signed up with.');
      return;
    }

    if (normalizedCode.length < 6) {
      Alert.alert('Error', 'Enter the 6-digit verification code from your email.');
      return;
    }

    try {
      setLoading(true);
      const response = await verifyEmailCode(normalizedEmail, normalizedCode);

      await saveAuthToken(response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      if (response.user?.avatarUrl) {
        await AsyncStorage.setItem('userAvatar', response.user.avatarUrl);
      } else {
        await AsyncStorage.removeItem('userAvatar');
      }

      if (onAuthSuccess) {
        await onAuthSuccess(response.user);
        return;
      }

      Alert.alert('Success', 'Email verified. You are now signed in.', [
        {
          text: 'Continue',
          onPress: () => navigation.replace('Main', { screen: 'Home' }),
        },
      ]);
    } catch (error: unknown) {
      const message = getUserFriendlyErrorMessage(error, 'Unable to verify email. Please try again.');
      Alert.alert('Verification Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading || resending) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      Alert.alert('Error', 'Enter your email to resend the verification code.');
      return;
    }

    try {
      setResending(true);
      await resendEmailVerification(normalizedEmail);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error: unknown) {
      const message = getUserFriendlyErrorMessage(error, 'Unable to resend code right now.');
      Alert.alert('Resend Failed', message);
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenWrapper scroll keyboardAware>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Verify your email</Text>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>Enter the verification code from your inbox to activate your account.</Text>

        <AppInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading && !resending}
          containerStyle={styles.inputSpacing}
        />

        <AppInput
          label="Verification Code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          editable={!loading && !resending}
          placeholder="6-digit code"
          containerStyle={styles.inputSpacing}
        />

        <AppButton
          title={loading ? 'Verifying...' : 'Verify & Sign In'}
          onPress={handleVerify}
          disabled={loading || resending}
          style={styles.primaryButton}
        />

        <TouchableOpacity
          onPress={handleResend}
          disabled={loading || resending}
          style={styles.secondaryButton}
        >
          {resending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Resend Code</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
          <Text style={[styles.footerText, { color: colors.mutedText }]}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  inputSpacing: {
    marginBottom: 10,
  },
  primaryButton: {
    marginTop: 8,
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footerLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
