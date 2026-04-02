import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reset Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.text }]}>Enter Reset Token</Text>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>
          {email ? `Check backend console for the reset token for ${email}` : 'Enter the reset token from your backend console'}
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Reset Token</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={resetToken}
            onChangeText={setResetToken}
            placeholder="Paste reset token here"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="none"
            editable={!loading}
          />
          <Text style={[styles.helperText, { color: colors.mutedText }]}>
            Check your backend terminal/console for the token
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={colors.mutedText}
              secureTextEntry={!showNewPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <MaterialIcons
                name={showNewPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.mutedText}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Confirm New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.mutedText}
              secureTextEntry={!showConfirmPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <MaterialIcons
                name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.mutedText}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Reset Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 22,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 50,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 14,
    padding: 4,
  },
  helperText: {
    fontSize: 13,
    marginTop: 6,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});