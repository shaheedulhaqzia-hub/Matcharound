import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { formatDistance, personById } from '@/lib/people';
import { colors, radius } from '@/lib/theme';

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { like, matches } = useApp();
  const person = personById(id ?? '');

  if (!person) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>This person is no longer nearby.</Text>
      </SafeAreaView>
    );
  }

  const matched = matches.some((m) => m.id === person.id);

  return (
    <View style={styles.root}>
      <Image source={{ uri: person.photo }} style={styles.hero} contentFit="cover" />
      <LinearGradient colors={['transparent', colors.bg]} style={styles.fade} />
      <SafeAreaView style={styles.overlay} edges={['top']}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </Pressable>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.name}>
          {person.name}, {person.age}
        </Text>
        <Text style={styles.job}>{person.job}</Text>
        <View style={styles.distRow}>
          <Ionicons name="navigate" size={16} color={colors.gold} />
          <Text style={styles.dist}>
            {formatDistance(person.distanceKm)} · {person.city}
          </Text>
        </View>
        <Text style={styles.bio}>{person.bio}</Text>
        <View style={styles.tags}>
          {person.interests.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          {!matched ? (
            <Pressable
              style={styles.primary}
              onPress={() => {
                like(person.id);
                router.push(`/chat/${person.id}`);
              }}>
              <Ionicons name="heart" size={18} color={colors.white} />
              <Text style={styles.primaryText}>Match & chat</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primary} onPress={() => router.push(`/chat/${person.id}`)}>
              <Ionicons name="chatbubble" size={18} color={colors.white} />
              <Text style={styles.primaryText}>Open chat</Text>
            </Pressable>
          )}
          <View style={styles.callRow}>
            <Pressable style={styles.secondary} onPress={() => router.push(`/call/${person.id}?mode=voice`)}>
              <Ionicons name="call" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>Voice</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => router.push(`/call/${person.id}?mode=video`)}>
              <Ionicons name="videocam" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>Video</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  missing: { color: colors.muted, textAlign: 'center' },
  hero: { height: 420, width: '100%' },
  fade: { position: 'absolute', left: 0, right: 0, top: 280, height: 160 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  back: {
    marginLeft: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingBottom: 40, marginTop: -40 },
  name: { color: colors.text, fontSize: 32, fontWeight: '800' },
  job: { color: colors.muted, marginTop: 4, fontSize: 16 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  dist: { color: colors.gold, fontWeight: '700' },
  bio: { color: colors.text, marginTop: 16, lineHeight: 22, fontSize: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: { color: colors.text, fontWeight: '600' },
  actions: { marginTop: 24, gap: 12 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  callRow: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: colors.text, fontWeight: '700' },
});
