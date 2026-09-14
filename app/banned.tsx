import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { signOut } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';

export default function BannedScreen() {
  const { banReason } = useApp();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-half" size={54} color={colors.accent} />
        </View>
        <Text style={styles.title}>Account suspended</Text>
        <Text style={styles.reason}>{banReason ?? 'Your account was suspended by our safety system.'}</Text>
        <Text style={styles.note}>
          Nudity is not allowed on Matcharound. Evidence of the violation has been saved and a
          human moderator will review your case. If this was a mistake, the review will restore
          your account.
        </Text>
        <Pressable style={styles.signOut} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  reason: { color: colors.gold, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  note: { color: colors.muted, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  signOut: {
    marginTop: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 40,
  },
  signOutText: { color: colors.text, fontWeight: '700' },
});
