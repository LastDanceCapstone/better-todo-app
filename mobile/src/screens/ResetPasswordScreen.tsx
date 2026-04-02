import React, { useState } from 'react';
import {
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

const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';

export default function ResetPasswordScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { email, token } = route.params || {};
  
  const [resetToken, setResetToken] = useState(token || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!resetToken.trim()) {
      Alert.alert('Error', 'Please enter the reset token');
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please enter and confirm your new password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetToken.trim(),
          newPassword,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        Alert.alert(
          'Error',
          `Server returned an error. Status: ${response.status}. Check backend logs.`
        );
        return;
      }

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success',
          'Your password has been reset successfully. You can now login with your new password.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to reset password');
      }
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert(
        'Error',
        error.message?.includes('JSON')
          ? 'Server returned invalid response. Make sure backend is running and endpoint exists.'
          : 'Failed to reset password. Please check your connection.'
      );
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
            onPress={() => navigation.goBack()}
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
              {email
                ? `Use the reset token generated for ${email}`
                : 'Use the reset token from your backend console.'}
            </Text>
          </View>
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
            disabled={loading}
            loading={loading}
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
});