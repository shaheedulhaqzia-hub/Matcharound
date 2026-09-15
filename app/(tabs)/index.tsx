import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { formatDistance } from '@/lib/people';
import { colors, radius } from '@/lib/theme';
import type { Gender } from '@/lib/types';

const radii = [2, 5, 10, 25, 100, 500];

const showMeOptions: { value: Gender | null; label: string }[] = [
  { value: null, label: 'Everyone' },
  { value: 'woman', label: 'Women' },
  { value: 'man', label: 'Men' },
];

export default function NearbyScreen() {
  const router = useRouter();
  const {
    nearby,
    radiusKm,
    setRadiusKm,
    like,
    pass,
    filters,
    setFilters,
    locationLabel,
    setManualLocation,
    clearManualLocation,
  } = useApp();
  const [place, setPlace] = useState('Near you');
  const [showFilters, setShowFilters] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [minAge, setMinAge] = useState(String(filters.minAge));
  const [maxAge, setMaxAge] = useState(String(filters.maxAge));
  const [cityQuery, setCityQuery] = useState(filters.city);
  const [genderPick, setGenderPick] = useState<Gender | null>(filters.gender);
  const [searching, setSearching] = useState(false);
  const person = nearby[0];

  const openFilters = () => {
    setPlaceQuery('');
    setMinAge(String(filters.minAge));
    setMaxAge(String(filters.maxAge));
    setCityQuery(filters.city);
    setGenderPick(filters.gender);
    setShowFilters(true);
  };

  const applyFilters = async () => {
    const lo = Math.max(18, Math.min(99, Number(minAge) || 18));
    const hi = Math.max(lo, Math.min(120, Number(maxAge) || 99));
    setFilters({ gender: genderPick, minAge: lo, maxAge: hi, city: cityQuery.trim() });

    if (placeQuery.trim()) {
      setSearching(true);
      const found = await setManualLocation(placeQuery);
      setSearching(false);
      if (!found) {
        Alert.alert('Place not found', `Could not find "${placeQuery.trim()}". Try a city or country name.`);
        return;
      }
    }
    setShowFilters(false);
  };

  const resetFilters = () => {
    setFilters({ gender: null, minAge: 18, maxAge: 99, city: '' });
    clearManualLocation();
    setShowFilters(false);
  };

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
          <Text style={styles.sub}>People around {locationLabel ?? place}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.live}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>{nearby.length} nearby</Text>
          </View>
          <Pressable style={styles.filterBtn} onPress={openFilters} hitSlop={8}>
            <Ionicons name="options" size={20} color={colors.text} />
          </Pressable>
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

      {/* Pro search filters */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Search filters</Text>
                <Pressable onPress={() => setShowFilters(false)} hitSlop={10}>
                  <Ionicons name="close" size={24} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={styles.sheetLabel}>Location</Text>
              <Text style={styles.sheetHint}>
                {locationLabel
                  ? `Searching around: ${locationLabel}`
                  : 'Searching around your current location'}
              </Text>
              <TextInput
                style={styles.sheetInput}
                value={placeQuery}
                onChangeText={setPlaceQuery}
                placeholder="Change location — city or country"
                placeholderTextColor={colors.muted}
              />
              {locationLabel ? (
                <Pressable
                  style={styles.useGps}
                  onPress={() => {
                    clearManualLocation();
                    setPlaceQuery('');
                  }}>
                  <Ionicons name="navigate" size={15} color={colors.accent} />
                  <Text style={styles.useGpsText}>Use my current location</Text>
                </Pressable>
              ) : null}

              <Text style={styles.sheetLabel}>Show me</Text>
              <View style={styles.sheetChips}>
                {showMeOptions.map((opt) => {
                  const on = genderPick === opt.value;
                  return (
                    <Pressable
                      key={opt.label}
                      style={[styles.sheetChip, on && styles.sheetChipOn]}
                      onPress={() => setGenderPick(opt.value)}>
                      <Text style={[styles.sheetChipText, on && styles.sheetChipTextOn]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sheetLabel}>Age range</Text>
              <View style={styles.ageRow}>
                <TextInput
                  style={[styles.sheetInput, styles.ageInput]}
                  value={minAge}
                  onChangeText={setMinAge}
                  placeholder="18"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.ageDash}>to</Text>
                <TextInput
                  style={[styles.sheetInput, styles.ageInput]}
                  value={maxAge}
                  onChangeText={setMaxAge}
                  placeholder="99"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>

              <Text style={styles.sheetLabel}>City or area</Text>
              <TextInput
                style={styles.sheetInput}
                value={cityQuery}
                onChangeText={setCityQuery}
                placeholder="Only show people whose city contains…"
                placeholderTextColor={colors.muted}
              />

              <View style={styles.sheetActions}>
                <Pressable style={styles.sheetReset} onPress={resetFilters}>
                  <Text style={styles.sheetResetText}>Reset</Text>
                </Pressable>
                <Pressable
                  style={[styles.sheetApply, searching && { opacity: 0.6 }]}
                  onPress={applyFilters}
                  disabled={searching}>
                  <Text style={styles.sheetApplyText}>
                    {searching ? 'Finding place…' : 'Apply filters'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '86%',
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  sheetLabel: { color: colors.gold, fontWeight: '700', fontSize: 13, marginTop: 18, marginBottom: 6 },
  sheetHint: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  sheetInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  useGps: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  useGpsText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  sheetChips: { flexDirection: 'row', gap: 10 },
  sheetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  sheetChipText: { color: colors.muted, fontWeight: '700' },
  sheetChipTextOn: { color: colors.accent },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ageInput: { flex: 1, textAlign: 'center' },
  ageDash: { color: colors.muted, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 8 },
  sheetReset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetResetText: { color: colors.muted, fontWeight: '700' },
  sheetApply: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  sheetApplyText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
