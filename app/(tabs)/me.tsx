import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { me } from '@/lib/people';
import { colors, radius } from '@/lib/theme';

export default function MeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Your profile</Text>
      <View style={styles.card}>
        <Image source={{ uri: me.photo }} style={styles.photo} />
        <Text style={styles.name}>
          {me.name}, {me.age}
        </Text>
        <Text style={styles.job}>{me.job} · {me.city}</Text>
        <Text style={styles.bio}>{me.bio}</Text>
      </View>
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Local demo</Text>
        <Text style={styles.noteBody}>
          Nearby people, chat typing, voice, and video are running on this device. A live backend
          can be wired later for real-time matching and calls.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 18,
    alignItems: 'center',
  },
  photo: { width: 140, height: 140, borderRadius: 70, marginBottom: 14 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  job: { color: colors.gold, marginTop: 4, fontWeight: '600' },
  bio: { color: colors.muted, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  note: {
    marginTop: 18,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteTitle: { color: colors.text, fontWeight: '700', marginBottom: 6 },
  noteBody: { color: colors.muted, lineHeight: 20 },
});
