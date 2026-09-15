import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ageFromDob, normalizePhone, parseDob, signUpWithEmail, toIsoDate } from '@/lib/auth';
import { phoneInUse, upsertProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError('Please enter your full name.');
    if (!email.trim().includes('@')) return setError('Please enter a valid email.');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return setError('Please enter a valid phone number.');
    const dob = parseDob(day, month, year);
    if (!dob) return setError('Please enter a valid date of birth (DD MM YYYY).');
    const age = ageFromDob(dob);
    if (age < 18) return setError('You must be at least 18 years old to join Matcharound.');
    if (age > 100) return setError('Please check your date of birth.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    try {
      if (await phoneInUse(normalizedPhone)) {
        setError('This phone number is already used by another account.');
        return;
      }
      await signUpWithEmail(email, password);
      const uid = (await supabase?.auth.getUser())?.data.user?.id;
      if (uid) {
        await upsertProfile({
          id: uid,
          name: name.trim(),
          dob: toIsoDate(dob),
          age,
          phone: normalizedPhone,
          bio: '',
          job: '',
          city: '',
        });
      }
      // AuthGate routes into the app automatically once the session lands.
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes('confirm')) {
        Alert.alert('Almost there', 'Check your email to confirm your account, then sign in.');
        router.replace('/(auth)/sign-in');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>Free forever. You must be 18 or older.</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.muted}
          />

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

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+92 300 1234567"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Date of birth (18+ required)</Text>
          <View style={styles.dobRow}>
            <TextInput
              style={[styles.input, styles.dob]}
              value={day}
              onChangeText={setDay}
              placeholder="DD"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TextInput
              style={[styles.input, styles.dob]}
              value={month}
              onChangeText={setMonth}
              placeholder="MM"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TextInput
              style={[styles.input, styles.dobYear]}
              value={year}
              onChangeText={setYear}
              placeholder="YYYY"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.submit, busy && styles.dim]} onPress={onSubmit} disabled={busy}>
            <Text style={styles.submitText}>{busy ? 'Creating account…' : 'Join Matcharound'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 22, paddingBottom: 40 },
  back: { marginBottom: 6 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  sub: { color: colors.muted, marginTop: 6, marginBottom: 18 },
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
  dobRow: { flexDirection: 'row', gap: 10 },
  dob: { flex: 1, textAlign: 'center' },
  dobYear: { flex: 1.6, textAlign: 'center' },
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
