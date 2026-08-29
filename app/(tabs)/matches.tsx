import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { formatDistance } from '@/lib/people';
import { colors, radius } from '@/lib/theme';

export default function MatchesScreen() {
  const router = useRouter();
  const { matches } = useApp();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Nearby matches</Text>
      <Text style={styles.sub}>Only people you liked around you.</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {matches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyBody}>Like someone nearby to start a chat, voice, or video call.</Text>
          </View>
        ) : (
          matches.map((person) => (
            <Pressable key={person.id} style={styles.row} onPress={() => router.push(`/person/${person.id}`)}>
              <Image source={{ uri: person.photo }} style={styles.avatar} />
              <View style={styles.meta}>
                <Text style={styles.name}>
                  {person.name}, {person.age}
                </Text>
                <Text style={styles.dist}>{formatDistance(person.distanceKm)}</Text>
              </View>
              <View style={styles.icons}>
                <Pressable style={styles.iconBtn} onPress={() => router.push(`/call/${person.id}?mode=voice`)}>
                  <Ionicons name="call" size={18} color={colors.white} />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => router.push(`/call/${person.id}?mode=video`)}>
                  <Ionicons name="videocam" size={18} color={colors.white} />
                </Pressable>
                <Pressable style={[styles.iconBtn, styles.chat]} onPress={() => router.push(`/chat/${person.id}`)}>
                  <Ionicons name="chatbubble" size={16} color={colors.white} />
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 8 },
  sub: { color: colors.muted, marginTop: 4, marginBottom: 16 },
  list: { paddingBottom: 24, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    gap: 12,
  },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  meta: { flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  dist: { color: colors.gold, marginTop: 3, fontWeight: '600' },
  icons: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3A2A44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chat: { backgroundColor: colors.accent },
  empty: { paddingTop: 80, alignItems: 'center' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 280 },
});
