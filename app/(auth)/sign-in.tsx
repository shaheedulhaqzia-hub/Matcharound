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

import { signInWithEmail } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      // AuthGate routes into the app automatically.
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

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={colors.muted}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.submit, busy && styles.dim]} onPress={onSubmit} disabled={busy}>
            <Text style={styles.submitText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 22 },
  back: { marginBottom: 6 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: 12 },
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
});
