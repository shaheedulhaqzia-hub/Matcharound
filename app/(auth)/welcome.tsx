import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithProvider, type SocialProvider } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';

const socialButtons: { provider: SocialProvider; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { provider: 'google', label: 'Continue with Google', icon: 'logo-google' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const onSocial = async (provider: SocialProvider) => {
    setBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch (e) {
      Alert.alert(
        'Sign in unavailable',
        'This provider is not enabled yet. Use email sign up, or ask the operator to enable it in Supabase.'
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
        <Text style={styles.brand}>Matcharound</Text>
        <Text style={styles.tag}>Meet real people near you — chat, call, match.</Text>
      </View>

      <View style={styles.buttons}>
        {socialButtons.map((b) => (
          <Pressable
            key={b.provider}
            style={[styles.social, busy === b.provider && styles.dim]}
            disabled={busy !== null}
            onPress={() => onSocial(b.provider)}>
            <Ionicons name={b.icon} size={20} color={colors.text} />
            <Text style={styles.socialText}>{busy === b.provider ? 'Opening…' : b.label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.primary} onPress={() => router.push('/(auth)/sign-up')}>
          <Ionicons name="mail" size={18} color={colors.white} />
          <Text style={styles.primaryText}>Sign up with email</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(auth)/sign-in')} hitSlop={8}>
          <Text style={styles.signIn}>
            Already have an account? <Text style={styles.signInAccent}>Sign in</Text>
          </Text>
        </Pressable>
        <Text style={styles.age}>You must be 18 or older to use Matcharound.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 22, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: 48 },
  logo: { width: 132, height: 132, borderRadius: 32 },
  brand: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 16 },
  tag: { color: colors.muted, fontSize: 15, marginTop: 8, textAlign: 'center' },
  buttons: { gap: 10, marginBottom: 18 },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  socialText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  dim: { opacity: 0.55 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    marginTop: 4,
  },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  signIn: { color: colors.muted, textAlign: 'center', marginTop: 8 },
  signInAccent: { color: colors.accent, fontWeight: '700' },
  age: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
