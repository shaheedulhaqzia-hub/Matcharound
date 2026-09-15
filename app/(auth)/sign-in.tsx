import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestEmailOtp, verifyEmailOtp } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');

  const onSendCode = async () => {
    setError(null);
    if (!email.trim().includes('@')) return setError('Please enter your email first.');
    setBusy(true);
    try {
      await requestEmailOtp(email);
      setOtpSent(true);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(
        msg.toLowerCase().includes('signups')
          ? 'No account found with this email. Please sign up first.'
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const onVerifyCode = async () => {
    setError(null);
    if (code.trim().length < 6) return setError('Enter the 6-digit code from your email.');
    setBusy(true);
    try {
      await verifyEmailOtp(email, code);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>We’ll email you a 6-digit code. No phone or WhatsApp codes.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!otpSent}
          />

          {otpSent ? (
            <>
              <Text style={styles.label}>Code from your email</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="6-digit code"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {otpSent ? (
            <Pressable
              style={[styles.submit, busy && styles.dim]}
              onPress={onVerifyCode}
              disabled={busy}>
              <Text style={styles.submitText}>{busy ? 'Checking…' : 'Verify code'}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.submit, busy && styles.dim]}
              onPress={onSendCode}
              disabled={busy}>
              <Text style={styles.submitText}>{busy ? 'Sending…' : 'Email me a code'}</Text>
            </Pressable>
          )}

          {otpSent ? (
            <Pressable
              style={styles.switchMode}
              onPress={() => {
                setOtpSent(false);
                setCode('');
                setError(null);
              }}>
              <Text style={styles.switchModeText}>Use a different email</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 22 },
  back: { marginBottom: 6 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  sub: { color: colors.muted, marginTop: 8, marginBottom: 8, lineHeight: 20 },
  label: { color: colors.gold, fontWeight: '700', fontSize: 13, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: colors.accent, marginTop: 14, fontWeight: '600' },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  dim: { opacity: 0.6 },
  switchMode: { alignItems: 'center', marginTop: 18 },
  switchModeText: { color: colors.gold, fontWeight: '700' },
});
