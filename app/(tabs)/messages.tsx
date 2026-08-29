import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { formatDistance } from '@/lib/people';
import { colors, radius } from '@/lib/theme';

export default function MessagesScreen() {
  const router = useRouter();
  const { messages, matches } = useApp();
  const threads = matches.filter((p) => (messages[p.id] ?? []).length > 0);
  const idle = matches.filter((p) => (messages[p.id] ?? []).length === 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Chat</Text>
      <Text style={styles.sub}>Typing, voice, and video — only with nearby matches.</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {threads.length === 0 && idle.length === 0 ? (
          <Text style={styles.empty}>Match with someone nearby to start typing.</Text>
        ) : null}
        {threads.map((person) => {
          const last = messages[person.id]?.at(-1);
          return (
            <Pressable key={person.id} style={styles.row} onPress={() => router.push(`/chat/${person.id}`)}>
              <Image source={{ uri: person.photo }} style={styles.avatar} />
              <View style={styles.meta}>
                <View style={styles.top}>
                  <Text style={styles.name}>{person.name}</Text>
                  <Text style={styles.dist}>{formatDistance(person.distanceKm)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {last?.fromMe ? 'You: ' : ''}
                  {last?.text}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {idle.length > 0 ? <Text style={styles.section}>Say hi</Text> : null}
        {idle.map((person) => (
          <Pressable key={person.id} style={styles.row} onPress={() => router.push(`/chat/${person.id}`)}>
            <Image source={{ uri: person.photo }} style={styles.avatar} />
            <View style={styles.meta}>
              <Text style={styles.name}>{person.name}</Text>
              <Text style={styles.preview}>Start a conversation · {formatDistance(person.distanceKm)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 8 },
  sub: { color: colors.muted, marginTop: 4, marginBottom: 16 },
  list: { paddingBottom: 24, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
  },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  meta: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { color: colors.text, fontWeight: '700', fontSize: 16 },
  dist: { color: colors.gold, fontSize: 12, fontWeight: '600' },
  preview: { color: colors.muted, marginTop: 4 },
  section: { color: colors.muted, marginTop: 10, fontWeight: '700' },
  empty: { color: colors.muted, marginTop: 40, textAlign: 'center' },
});
