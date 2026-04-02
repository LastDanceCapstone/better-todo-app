import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeProvider';
import { loginUser, registerUser } from '../config/api';

export default function PremiumLoginScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (mode === 'signup') {
      if (!firstName.trim()) {
        Alert.alert('Missing fields', 'Please enter your first name.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password mismatch', 'Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Weak password', 'Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      let token, user;

      if (mode === 'login') {
        const result = await loginUser(email.trim(), password);
        token = result.token;
        user = result.user;
      } else {
        const result = await registerUser(
          firstName.trim(),
          lastName.trim(),
          email.trim(),
          password
        );
        token = result.token;
        user = result.user;
      }

      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home', params: { user } }],
      });
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoText}>P</Text>
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>Prioritize</Text>
            <Text style={[styles.tagline, { color: colors.mutedText }]}>Stay organized. Stay ahead.</Text>
          </View>

          {/* Tab switcher */}
          <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tabBtn, mode === 'login' && { backgroundColor: colors.primary }]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.tabBtnText, { color: mode === 'login' ? '#fff' : colors.mutedText }]}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, mode === 'signup' && { backgroundColor: colors.primary }]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.tabBtnText, { color: mode === 'signup' ? '#fff' : colors.mutedText }]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {mode === 'login' ? 'Welcome back 👋' : 'Create your account'}
            </Text>

            {mode === 'signup' && (
              <>
                <Text style={[styles.label, { color: colors.mutedText }]}>First Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="First name"
                  placeholderTextColor={colors.mutedText}
                  value={firstName}
                  onChangeText={setFirstName}
                  editable={!loading}
                />
                <Text style={[styles.label, { color: colors.mutedText }]}>Last Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Last name"
                  placeholderTextColor={colors.mutedText}
                  value={lastName}
                  onChangeText={setLastName}
                  editable={!loading}
                />
              </>
            )}

            <Text style={[styles.label, { color: colors.mutedText }]}>Email *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedText}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={[styles.label, { color: colors.mutedText }]}>Password *</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, paddingRight: 60 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Text style={{ color: colors.mutedText, fontSize: 13 }}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {mode === 'signup' && (
              <>
                <Text style={[styles.label, { color: colors.mutedText }]}>Confirm Password *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.mutedText}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>{mode === 'login' ? 'Log In' : 'Create Account'}</Text>
              }
            </TouchableOpacity>

            {mode === 'login' && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ResetPassword', {})}
                style={styles.forgot}
              >
                <Text style={{ color: colors.mutedText, fontSize: 14 }}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Switch mode */}
          <TouchableOpacity
            onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ alignItems: 'center', marginTop: 20 }}
          >
            <Text style={{ color: colors.mutedText, fontSize: 14 }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  hero: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  appName: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  tagline: { fontSize: 15 },
  tabRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnText: { fontSize: 14, fontWeight: '700' },
  card: { borderRadius: 20, padding: 24, borderWidth: 1 },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 14 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  button: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgot: { alignItems: 'center', marginTop: 14 },
});