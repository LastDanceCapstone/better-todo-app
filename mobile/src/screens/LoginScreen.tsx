import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { API_BASE_URL } from '../config/api';
import { getGoogleErrorMessage, signInWithGoogle } from '../config/googleSignIn';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import ScreenWrapper from '../components/ScreenWrapper';
import GlassCard from '../components/GlassCard';

export default function LoginScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const isAuthBusy = isSubmitting || isGoogleSubmitting;

  const completeAuthSuccess = async (data: any, successMessage: string) => {
    await AsyncStorage.setItem('authToken', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    Alert.alert('Success', successMessage, [
      {
        text: 'OK',
        onPress: () =>
          navigation.replace('Main', {
            screen: 'Home',
            params: {
              email: data.user?.email,
              token: data.token,
              user: data.user,
            },
          }),
      },
    ]);
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleForgotPassword = async () => {
    const email = formData.email.trim();

    if (!email || !validateEmail(email)) {
      Alert.alert('Error', 'Please enter your email first');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 404) {
          Alert.alert(
            'Reset Endpoint Not Deployed',
            'The backend at this URL does not have /api/forgot-password yet. You can continue to Reset Password and use a token from backend console.',
            [
              {
                text: 'Continue',
                onPress: () => navigation.navigate('ResetPassword', { email }),
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }

        const errorMessage =
          isJson && payload?.error
            ? payload.error
            : `Failed to request reset token (Status ${response.status})`;

        Alert.alert('Error', errorMessage);
        return;
      }

      Alert.alert(
        'Success',
        'Check your email or backend console for the reset token',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ResetPassword', { email }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message?.includes('Network')
          ? 'Failed to connect. Please check your internet and try again.'
          : 'Failed to request reset token'
      );
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isGoogleSubmitting) {
      return;
    }

    // Validation
    if (!formData.email || !validateEmail(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (!isLogin) {
      if (!formData.firstName || !formData.lastName) {
        Alert.alert('Error', 'Please enter your full name');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const payload = isLogin 
        ? { 
            email: formData.email, 
            password: formData.password 
          }
        : {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            password: formData.password
          };

      console.log('Making request to:', `${API_BASE_URL}${endpoint}`);
      console.log('Payload:', payload);

      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout - aborting');
        controller.abort();
      }, 15000); // 15 second timeout

      console.log('About to make fetch request...');

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Response received!');
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        await completeAuthSuccess(data, isLogin ? 'Login successful!' : 'Registration successful!');
      } else {
        Alert.alert('Error', data.error || 'Something went wrong');
      }
    } catch (error: any) {
      console.error('Network error details:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error.name === 'AbortError') {
        Alert.alert(
          'Timeout Error',
          'Request timed out after 15 seconds. This usually means:\n\n1. Backend server is not running\n2. Wrong IP address\n3. Firewall is blocking the connection'
        );
      } else if (error.message.includes('Network request failed')) {
        Alert.alert(
          'Connection Error',
          `Cannot connect to server at ${API_BASE_URL}\n\nPlease check:\n\n1. Backend is running on port 3000\n2. You\'re on the same WiFi network\n3. Windows Firewall allows port 3000\n4. IP address is correct (${API_BASE_URL})`
        );
      } else if (error.message.includes('fetch')) {
        Alert.alert(
          'Network Error',
          `Fetch failed: ${error.message}\n\nThis usually indicates a connectivity issue.`
        );
      } else {
        Alert.alert('Error', `Unexpected error: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleContinue = async () => {
    if (isSubmitting || isGoogleSubmitting) {
      return;
    }

    setIsGoogleSubmitting(true);

    try {
      // Replaced expo-auth-session browser OAuth with native SDK on iOS to avoid
      // redirect URI failures and ensure stable token retrieval in dev builds.
      const { idToken } = await signInWithGoogle();

      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      console.log('[Google Auth] status:', response.status);
      console.log('[Google Auth] content-type:', response.headers.get('content-type'));

      const rawText = await response.text();

      // Attempt JSON parse — backend may return HTML on 404/500 pages.
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error('[Google Auth] Non-JSON response received:', rawText.slice(0, 500));
        Alert.alert('Google Sign-In Failed', 'Server error. Please try again later.');
        return;
      }

      if (!response.ok) {
        const message =
          typeof data?.error === 'string' && data.error.length > 0
            ? data.error
            : `Unable to authenticate with Google (HTTP ${response.status}).`;
        console.error('[Google Auth] Error response:', data);
        Alert.alert('Google Sign-In Failed', message);
        return;
      }

      await completeAuthSuccess(data, 'Login successful!');
    } catch (error: any) {
      Alert.alert('Google Sign-In Failed', getGoogleErrorMessage(error));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <ScreenWrapper withHorizontalPadding={false}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <MaterialIcons name="check-circle" size={42} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Prioritize</Text>
            <Text style={[styles.subtitle, { color: colors.mutedText }]}> 
              {isLogin ? 'Welcome back. Let\'s keep your day organized.' : 'Create your account and start planning with clarity.'}
            </Text>
          </View>

          {/* Form Card */}
          <GlassCard style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}> 
              {isLogin ? 'Sign In' : 'Create Account'}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}> 
              {isLogin 
                ? 'Use your account details to continue.' 
                : 'Set up your profile to get started.'}
            </Text>

            {/* Name Fields (Registration only) */}
            {!isLogin && (
              <View style={styles.nameRow}>
                <View style={styles.nameInput}>
                  <AppInput
                    label="First Name"
                    placeholder="John"
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({...formData, firstName: text})}
                    autoCapitalize="words"
                    containerStyle={styles.authInputContainer}
                  />
                </View>
                <View style={styles.nameInput}>
                  <AppInput
                    label="Last Name"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChangeText={(text) => setFormData({...formData, lastName: text})}
                    autoCapitalize="words"
                    containerStyle={styles.authInputContainer}
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <AppInput
              label="Email"
              placeholder="you@example.com"
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text})}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.formGroup}
            />

            {/* Password */}
            <View style={styles.formGroup}>
              <AppInput
                label="Password"
                placeholder="••••••••"
                value={formData.password}
                onChangeText={(text) => setFormData({...formData, password: text})}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                rightIcon={(
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <MaterialIcons
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color={colors.mutedText}
                    />
                  </TouchableOpacity>
                )}
                containerStyle={styles.authInputContainer}
              />
            </View>

            {/* Confirm Password (Registration only) */}
            {!isLogin && (
              <AppInput
                label="Confirm Password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                containerStyle={styles.formGroup}
              />
            )}

            {/* Forgot Password (Login only) */}
            {isLogin && (
              <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
                <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {/* Submit Button */}
            <AppButton
              title={isLogin ? 'Sign In' : 'Create Account'}
              onPress={handleSubmit}
              disabled={isAuthBusy}
              loading={isSubmitting}
              style={styles.submitButton}
            />

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedText }]}>or continue with</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <AppButton
              title="Continue with Google"
              onPress={handleGoogleContinue}
              disabled={isAuthBusy}
              loading={isGoogleSubmitting}
              leftIcon={<MaterialIcons name="g-translate" size={20} color={colors.text} />}
              variant="outline"
              style={styles.googleButton}
              textStyle={{ color: colors.text }}
            />

            {/* Toggle Login/Register */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleText, { color: colors.mutedText }]}> 
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text style={[styles.toggleLink, { color: colors.primary }]}> 
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* Footer */}
          <Text style={[styles.footer, { color: colors.mutedText }]}> 
            © 2025 Last Dance Team
          </Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  pageContainer: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoContainer: {
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 18,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  nameInput: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  authInputContainer: {
    marginBottom: 0,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginTop: -2,
    marginBottom: 12,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  googleButton: {
    marginTop: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  toggleText: {
    fontSize: 14,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 18,
  },
});