import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { formatDistance } from '@/lib/people';
import { colors, radius } from '@/lib/theme';

const radii = [2, 5, 10, 25];

export default function NearbyScreen() {
  const router = useRouter();
  const { nearby, radiusKm, setRadiusKm, like, pass } = useApp();
  const [place, setPlace] = useState('Near you');
  const person = nearby[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const pos = await Location.getCurrentPositionAsync({});
      const geo = await Location.reverseGeocodeAsync(pos.coords);
      const first = geo[0];
      if (first && !cancelled) {
        setPlace(first.district || first.city || first.subregion || 'Near you');
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onLike = () => {
    if (!person) return;
    like(person.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('It’s a match', `${person.name} is ${formatDistance(person.distanceKm)}. Say hi?`, [
      { text: 'Keep browsing' },
      { text: 'Open chat', onPress: () => router.push(`/chat/${person.id}`) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Matcharound</Text>
          <Text style={styles.sub}>People around {place}</Text>
        </View>
        <View style={styles.live}>
          <View style={styles.dot} />
          <Text style={styles.liveText}>{nearby.length} nearby</Text>
        </View>
      </View>

      <View style={styles.radii}>
        {radii.map((km) => {
          const on = radiusKm === km;
          return (
            <Pressable
              key={km}
              onPress={() => setRadiusKm(km)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{km} km</Text>
            </Pressable>
          );
        })}
      </View>

      {person ? (
        <Pressable style={styles.cardWrap} onPress={() => router.push(`/person/${person.id}`)}>
          <Image source={{ uri: person.photo }} style={styles.photo} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(18,10,18,0.2)', 'rgba(18,10,18,0.92)']}
            style={styles.fade}
          />
          <View style={styles.meta}>
            {person.online ? (
              <View style={styles.online}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online now</Text>
              </View>
            ) : null}
            <Text style={styles.name}>
              {person.name}, {person.age}
            </Text>
            <Text style={styles.job}>{person.job}</Text>
            <View style={styles.distRow}>
              <Ionicons name="navigate" size={16} color={colors.gold} />
              <Text style={styles.dist}>{formatDistance(person.distanceKm)} · {person.city}</Text>
            </View>
            <Text style={styles.bio} numberOfLines={2}>
              {person.bio}
            </Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={42} color={colors.muted} />
          <Text style={styles.emptyTitle}>No one else in {radiusKm} km</Text>
          <Text style={styles.emptyBody}>Widen your radius to see more people around you.</Text>
        </View>
      )}

      {person ? (
        <View style={styles.actions}>
          <Pressable style={[styles.round, styles.pass]} onPress={() => pass(person.id)}>
            <Ionicons name="close" size={30} color={colors.text} />
          </Pressable>
          <Pressable style={[styles.round, styles.chat]} onPress={() => router.push(`/chat/${person.id}`)}>
            <Ionicons name="chatbubble" size={22} color={colors.white} />
          </Pressable>
          <Pressable style={[styles.round, styles.like]} onPress={onLike}>
            <Ionicons name="heart" size={28} color={colors.white} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  brand: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  sub: { color: colors.muted, marginTop: 4, fontSize: 14 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  liveText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  radii: { flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: colors.accent },
  cardWrap: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  photo: { ...StyleSheet.absoluteFill },
  fade: { ...StyleSheet.absoluteFill },
  meta: { position: 'absolute', left: 18, right: 18, bottom: 20 },
  online: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 8,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  onlineText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  name: { color: colors.white, fontSize: 32, fontWeight: '800' },
  job: { color: colors.white, opacity: 0.86, marginTop: 2, fontSize: 15 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dist: { color: colors.gold, fontWeight: '700', fontSize: 14 },
  bio: { color: colors.white, opacity: 0.88, marginTop: 8, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 18,
  },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pass: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chat: { backgroundColor: '#3A2A44', width: 52, height: 52, borderRadius: 26 },
  like: { backgroundColor: colors.accent },
});
