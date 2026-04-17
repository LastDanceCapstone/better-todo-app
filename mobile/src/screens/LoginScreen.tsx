import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { ApiError, API_BASE_URL, getUserFriendlyErrorMessage, saveAuthToken } from '../config/api';
import { useTheme, useThemePreference } from '../theme';
import { getGoogleErrorMessage, getGoogleSignInConfigurationIssue, signInWithGoogle } from '../config/googleSignIn';
import { logger } from '../utils/logger';

type Palette = {
  background: readonly [string, string];
  logoTagline: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;
  inputShadow: string;
  primaryButton: readonly [string, string];
  helperText: string;
  secondaryBar: string;
  secondaryBorder: string;
  secondaryText: string;
};

const lightPalette: Palette = {
  background: ['#FFFFFF', '#BDD0FF'],
  logoTagline: '#121826',
  inputBackground: 'rgba(255,255,255,0.72)',
  inputBorder: 'rgba(17,24,39,0.08)',
  inputText: '#111827',
  placeholder: 'rgba(17,24,39,0.52)',
  inputShadow: '#0B1221',
  primaryButton: ['#2B44E7', '#111427'],
  helperText: '#0F172A',
  secondaryBar: 'rgba(255,255,255,0.66)',
  secondaryBorder: 'rgba(17,24,39,0.08)',
  secondaryText: '#0F172A',
};

const darkPalette: Palette = {
  background: ['#000000', '#3533CD'],
  logoTagline: '#F8FAFC',
  inputBackground: 'rgba(255,255,255,0.16)',
  inputBorder: 'rgba(255,255,255,0.24)',
  inputText: '#F8FAFC',
  placeholder: 'rgba(248,250,252,0.70)',
  inputShadow: '#000000',
  primaryButton: ['rgba(221, 87, 137, 0.9)', 'rgba(238, 154, 90, 0.9)'],
  helperText: '#F8FAFC',
  secondaryBar: 'rgba(255,255,255,0.20)',
  secondaryBorder: 'rgba(255,255,255,0.24)',
  secondaryText: '#F8FAFC',
};

type AuthInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address';
  rightIcon?: React.ReactNode;
  palette: Palette;
  compact?: boolean;
};

const GradientLayer = ({
  start,
  end,
  top,
  bottom,
}: {
  start: { x: string; y: string };
  end: { x: string; y: string };
  top: string;
  bottom: string;
}) => {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        <SvgLinearGradient id="authGradient" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#authGradient)" />
    </Svg>
  );
};

const ButtonGradientFill = ({ top, bottom }: { top: string; bottom: string }) => (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
    <Defs>
      <SvgLinearGradient id="authButtonGradient" x1="0" y1="0.5" x2="1" y2="0.5">
        <Stop offset="0" stopColor={top} />
        <Stop offset="1" stopColor={bottom} />
      </SvgLinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#authButtonGradient)" />
  </Svg>
);

const DarkButtonGradientFill = () => (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
    <Defs>
      <SvgLinearGradient id="darkButtonGradient" x1="0" y1="0.5" x2="1" y2="0.5">
        <Stop offset="0" stopColor="rgba(238, 154, 90, 0.9)" />
        <Stop offset="1" stopColor="rgba(221, 87, 137, 0.9)" />
      </SvgLinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkButtonGradient)" />
  </Svg>
);

const AuthInput = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  rightIcon,
  palette,
  compact = false,
}: AuthInputProps) => {
  return (
    <TouchableOpacity
      activeOpacity={1}
      style={[
        styles.inputShell,
        {
          backgroundColor: palette.inputBackground,
          borderColor: palette.inputBorder,
          shadowColor: palette.inputShadow,
          height: compact ? 48 : 52,
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.placeholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={false}
        style={[styles.input, { color: palette.inputText }]}
      />
      {rightIcon ? <View style={styles.inputRightIcon}>{rightIcon}</View> : null}
    </TouchableOpacity>
  );
};

type LoginScreenProps = {
  navigation: any;
  route?: any;
  onAuthSuccess?: () => void;
};

export default function LoginScreen({ navigation, route, onAuthSuccess }: LoginScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentTheme, setThemePreference } = useThemePreference();
  const { width } = useWindowDimensions();
  const isDark = currentTheme === 'dark';
  const palette = isDark ? darkPalette : lightPalette;
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
  const googleConfigIssue = getGoogleSignInConfigurationIssue();

  React.useEffect(() => {
    const prefilledEmail = typeof route?.params?.email === 'string'
      ? route.params.email.trim().toLowerCase()
      : '';
    const postResetMessage = typeof route?.params?.postResetMessage === 'string'
      ? route.params.postResetMessage.trim()
      : '';

    if (prefilledEmail) {
      setFormData((prev) => ({ ...prev, email: prefilledEmail }));
    }

    if (postResetMessage) {
      Alert.alert('Password Updated', postResetMessage);
      navigation.setParams?.({ postResetMessage: undefined });
    }
  }, [navigation, route?.params?.email, route?.params?.postResetMessage]);

  const completeAuthSuccess = async (data: any, successMessage: string) => {
    await saveAuthToken(data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    if (data.user?.avatarUrl) {
      await AsyncStorage.setItem('userAvatar', data.user.avatarUrl);
    } else {
      await AsyncStorage.removeItem('userAvatar');
    }

    if (onAuthSuccess) {
      onAuthSuccess();
      return;
    }

    Alert.alert('Success', successMessage, [
      {
        text: 'OK',
        onPress: () =>
          navigation.replace('Main', {
            screen: 'Home',
            params: {
              email: data.user?.email,
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

  const performTimedRequest = async (url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleForgotPassword = async () => {
    const email = formData.email.trim();

    if (!email || !validateEmail(email)) {
      Alert.alert('Error', 'Please enter your email first');
      return;
    }

    try {
      const response = await performTimedRequest(`${API_BASE_URL}/api/forgot-password`, {
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
        const apiMessage =
          isJson && typeof payload?.error === 'string'
            ? payload.error
            : isJson && typeof payload?.message === 'string'
            ? payload.message
            : 'Unable to send reset email right now.';

        throw new ApiError(apiMessage, response.status);
        return;
      }

      Alert.alert(
        'Reset Sent',
        'Check your email for the reset code and link.',
        [
          {
            text: 'Open Reset Screen',
            onPress: () => navigation.navigate('ResetPassword', { email }),
          },
        ]
      );
    } catch (error: unknown) {
      Alert.alert(
        'Unable to Send Reset Email',
        getUserFriendlyErrorMessage(error, 'Unable to send reset email right now.')
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

    if (!formData.password || formData.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000); // 15 second timeout

      const response = await (async () => {
        try {
          return await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      })();

      const rawText = await response.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!isLogin && response.status === 202 && data?.requiresEmailVerification) {
        Alert.alert('Verify Your Email', 'We sent a verification code to your email. Enter it to finish signup.', [
          {
            text: 'Continue',
            onPress: () => navigation.navigate('VerifyEmail', { email: data?.email || formData.email.trim().toLowerCase() }),
          },
        ]);
      } else if (response.ok) {
        await completeAuthSuccess(data, isLogin ? 'Login successful!' : 'Registration successful!');
      } else if (response.status === 403 && data?.code === 'EMAIL_NOT_VERIFIED') {
        Alert.alert(
          'Email Not Verified',
          'Verify your email before signing in.',
          [
            {
              text: 'Verify Now',
              onPress: () => navigation.navigate('VerifyEmail', { email: data?.email || formData.email.trim().toLowerCase() }),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        const apiMessage =
          (typeof data?.error === 'string' && data.error) ||
          (typeof data?.message === 'string' && data.message) ||
          'Unable to complete your request right now.';

        logger.warn(`Authentication failed: HTTP ${response.status}`);
        throw new ApiError(apiMessage, response.status, data?.code);
      }
    } catch (error: unknown) {
      logger.warn('Authentication request failed');

      Alert.alert(
        isLogin ? 'Sign-In Failed' : 'Sign-Up Failed',
        getUserFriendlyErrorMessage(
          error,
          isLogin ? 'Unable to sign in right now. Please try again.' : 'Unable to create your account right now. Please try again.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleContinue = async () => {
    if (isSubmitting || isGoogleSubmitting) {
      return;
    }

    if (googleConfigIssue) {
      Alert.alert('Google Sign-In Unavailable', googleConfigIssue);
      return;
    }

    setIsGoogleSubmitting(true);

    try {
      // Replaced expo-auth-session browser OAuth with native SDK on iOS to avoid
      // redirect URI failures and ensure stable token retrieval in dev builds.
      const { idToken } = await signInWithGoogle();

      const response = await performTimedRequest(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const rawText = await response.text();

      // Attempt JSON parse — backend may return HTML on 404/500 pages.
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        logger.error('[Google Auth] Non-JSON response received');
        Alert.alert('Google Sign-In Failed', 'Server error. Please try again later.');
        return;
      }

      if (!response.ok) {
        const apiMessage =
          typeof data?.error === 'string' && data.error.length > 0
            ? data.error
            : typeof data?.message === 'string' && data.message.length > 0
            ? data.message
            : 'Unable to continue with Google right now.';
        logger.warn('[Google Auth] Authentication failed');
        Alert.alert('Google Sign-In Failed', getUserFriendlyErrorMessage(new ApiError(apiMessage, response.status)));
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
    <View style={styles.container}>
      <GradientLayer
        start={{ x: '0', y: '0' }}
        end={{ x: '0', y: '1' }}
        top={palette.background[0]}
        bottom={palette.background[1]}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={() => setThemePreference(isDark ? 'light' : 'dark')}
          activeOpacity={0.9}
          style={[
            styles.themeToggle,
            {
              top: insets.top + 6,
              backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(17,24,39,0.08)',
              borderColor: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(17,24,39,0.12)',
            },
          ]}
        >
          <MaterialIcons
            name={isDark ? 'light-mode' : 'dark-mode'}
            size={18}
            color={isDark ? '#FFFFFF' : '#111827'}
          />
        </TouchableOpacity>

        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.topSection}>
            <Image
              source={
                isDark
                  ? require('../components/logo/prioritize-dark.png')
                  : require('../components/logo/prioritize-light.png')
              }
              resizeMode="contain"
              style={[
                styles.logo,
                {
                  width: Math.min(width * 1.76, 700),
                  height: Math.min(width * 0.88, 348),
                },
              ]}
            />
            <Text style={[styles.tagline, { color: palette.logoTagline }]}>Organize your tasks, prioritize your life</Text>
          </View>

          <View style={styles.formSection}>
            {!isLogin ? (
              <View style={styles.nameRow}>
                <View style={styles.nameInput}>
                  <AuthInput
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                    placeholder="First Name"
                    autoCapitalize="words"
                    palette={palette}
                    compact
                  />
                </View>
                <View style={styles.nameInput}>
                  <AuthInput
                    value={formData.lastName}
                    onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                    placeholder="Last Name"
                    autoCapitalize="words"
                    palette={palette}
                    compact
                  />
                </View>
              </View>
            ) : null}

            <AuthInput
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="Email"
              keyboardType="email-address"
              palette={palette}
            />

            <View style={styles.stackGap} />

            <AuthInput
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              placeholder="Password"
              secureTextEntry={!showPassword}
              palette={palette}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={palette.placeholder}
                  />
                </TouchableOpacity>
              }
            />

            {!isLogin ? (
              <>
                <View style={styles.stackGap} />
                <AuthInput
                  value={formData.confirmPassword}
                  onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                  placeholder="Confirm Password"
                  secureTextEntry={!showPassword}
                  palette={palette}
                />
              </>
            ) : null}

            {isLogin ? (
              <TouchableOpacity style={styles.forgotRow} onPress={handleForgotPassword}>
                <Text style={[styles.forgotText, { color: palette.helperText }]}>Forgot Password?</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleSubmit}
              disabled={isAuthBusy}
              style={[styles.primaryButton, isAuthBusy ? styles.primaryDisabled : null]}
            >
              {isDark ? (
                <View style={styles.primaryButtonFill}>
                  <DarkButtonGradientFill />
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                  )}
                </View>
              ) : (
                <View style={styles.primaryButtonFill}>
                  <ButtonGradientFill top={palette.primaryButton[0]} bottom={palette.primaryButton[1]} />
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleGoogleContinue}
              disabled={isAuthBusy || Boolean(googleConfigIssue)}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: palette.secondaryBar,
                  borderColor: palette.secondaryBorder,
                },
                isAuthBusy || googleConfigIssue ? styles.primaryDisabled : null,
              ]}
            >
              {isGoogleSubmitting ? (
                <ActivityIndicator color={palette.secondaryText} />
              ) : (
                <>
                  <MaterialIcons name="g-translate" size={20} color={palette.secondaryText} />
                  <Text style={[styles.secondaryButtonText, { color: palette.secondaryText }]}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {googleConfigIssue ? (
              <Text style={[styles.googleConfigHint, { color: palette.helperText }]}>Google Sign-In requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in environment config.</Text>
            ) : null}

            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleText, { color: palette.helperText }]}> 
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text style={[styles.toggleLink, { color: colors.primary }]}> 
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardWrap: {
    flex: 1,
  },
  themeToggle: {
    position: 'absolute',
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 30,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 6,
  },
  logo: {
    marginTop: 0,
  },
  tagline: {
    marginTop: 0,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  formSection: {
    marginTop: 0,
  },
  stackGap: {
    height: 8,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  nameInput: {
    flex: 1,
  },
  inputShell: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  inputRightIcon: {
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 4,
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 2,
    width: '100%',
    height: 52,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonFill: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.30)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  secondaryButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  googleConfigHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toggleLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryDisabled: {
    opacity: 0.6,
  },
});