import { useState } from 'react';
import {
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

import { useApp } from '@/context/AppContext';
import { ageFromDob, normalizePhone, parseDob, toIsoDate } from '@/lib/auth';
import { phoneInUse, upsertProfile } from '@/lib/db';
import { colors, radius } from '@/lib/theme';
import type { Gender, InterestedIn } from '@/lib/types';

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'other', label: 'Other' },
];

const interestOptions: { value: InterestedIn; label: string }[] = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'everyone', label: 'Everyone' },
];

/** Social sign-ups land here: name, phone + date of birth are mandatory (18+). */
export default function CompleteProfileScreen() {
  const { userId, profile, refreshProfile } = useApp();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [interestedIn, setInterestedIn] = useState<InterestedIn>(
    profile?.interestedIn ?? 'everyone'
  );
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!userId) return;
    if (!name.trim()) return setError('Please enter your full name.');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return setError('Please enter a valid phone number.');
    if (!gender) return setError('Please select your gender.');
    const dob = parseDob(day, month, year);
    if (!dob) return setError('Please enter a valid date of birth (DD MM YYYY).');
    const age = ageFromDob(dob);
    if (age < 18) return setError('You must be at least 18 years old to use Matcharound.');
    if (age > 100) return setError('Please check your date of birth.');

    setBusy(true);
    try {
      if (await phoneInUse(normalizedPhone, userId)) {
        setError(
          'This phone number already belongs to another account. ' +
            'If that account is yours, sign in with it instead — you can link Google, Facebook and X to it in your profile.'
        );
        return;
      }
      await upsertProfile({
        id: userId,
        name: name.trim(),
        dob: toIsoDate(dob),
        age,
        phone: normalizedPhone,
        gender,
        interested_in: interestedIn,
        bio: profile?.bio ?? '',
        job: profile?.job ?? '',
        city: profile?.city ?? '',
      });
      await refreshProfile();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>One last step</Text>
          <Text style={styles.sub}>
            Matcharound is 18+. Add your name, phone number, gender and date of birth to continue.
          </Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.muted}
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

          <Text style={styles.label}>I am a</Text>
          <View style={styles.chipRow}>
            {genderOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.choice, gender === opt.value && styles.choiceOn]}
                onPress={() => setGender(opt.value)}>
                <Text style={[styles.choiceText, gender === opt.value && styles.choiceTextOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Interested in</Text>
          <View style={styles.chipRow}>
            {interestOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.choice, interestedIn === opt.value && styles.choiceOn]}
                onPress={() => setInterestedIn(opt.value)}>
                <Text
                  style={[styles.choiceText, interestedIn === opt.value && styles.choiceTextOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Date of birth</Text>
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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.submit, busy && styles.dim]} onPress={onSubmit} disabled={busy}>
            <Text style={styles.submitText}>{busy ? 'Saving…' : 'Continue'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 22, paddingBottom: 40 },
  chipRow: { flexDirection: 'row', gap: 10 },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  choiceOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceText: { color: colors.muted, fontWeight: '700' },
  choiceTextOn: { color: colors.accent },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 12 },
  sub: { color: colors.muted, marginTop: 8, lineHeight: 20 },
  label: { color: colors.gold, fontWeight: '700', fontSize: 13, marginTop: 16, marginBottom: 6 },
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
    marginTop: 24,
  },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  dim: { opacity: 0.6 },
});
