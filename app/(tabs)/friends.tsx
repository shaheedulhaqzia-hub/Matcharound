import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useApp } from '@/context/AppContext';
import { normalizePhone } from '@/lib/auth';
import {
  distanceKm,
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingIds,
  findByPhones,
  formatLastSeen,
  respondToRequest,
  sendFriendRequest,
  type ContactMatch,
  type Friend,
  type FriendRequest,
} from '@/lib/friends';
import { colors, radius } from '@/lib/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const { userId, myCoords, refreshFriendBadge } = useApp();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [matchesFromContacts, setMatchesFromContacts] = useState<ContactMatch[] | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [f, r, out] = await Promise.all([
      fetchFriends(),
      fetchIncomingRequests(),
      fetchOutgoingIds(userId),
    ]);
    setFriends(f);
    setRequests(r);
    setSentIds(out);
    refreshFriendBadge();
  }, [userId, refreshFriendBadge]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000); // live km + online status refresh
    return () => clearInterval(timer);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const respond = async (req: FriendRequest, accept: boolean) => {
    setBusyId(req.id);
    try {
      await respondToRequest(req.id, accept);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', String(e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  };

  const scanContacts = async () => {
    if (!userId) return;
    setScanning(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Contacts permission needed',
          'Allow contact access to see which of your friends already use Matcharound.'
        );
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      const phones = new Set<string>();
      for (const contact of data) {
        for (const p of contact.phoneNumbers ?? []) {
          const normalized = p.number ? normalizePhone(p.number) : null;
          if (normalized) phones.add(normalized);
        }
      }
      const found = await findByPhones([...phones]);
      const friendIds = new Set(friends.map((f) => f.id));
      setMatchesFromContacts(found.filter((m) => !friendIds.has(m.id)));
    } catch (e: any) {
      Alert.alert('Could not scan contacts', String(e?.message ?? e));
    } finally {
      setScanning(false);
    }
  };

  const addFriend = async (personId: string) => {
    if (!userId) return;
    setBusyId(personId);
    try {
      await sendFriendRequest(userId, personId);
      setSentIds((prev) => [...prev, personId]);
    } catch (e: any) {
      Alert.alert('Could not send request', String(e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  };

  const shownMatches = useMemo(
    () => (matchesFromContacts ?? []).filter((m) => !onlineOnly || m.online),
    [matchesFromContacts, onlineOnly]
  );

  const mappableFriends = friends.filter((f) => f.lat != null && f.lng != null);

  const mapHtml = useMemo(() => {
    const markers = mappableFriends.map((f) => ({
      lat: f.lat,
      lng: f.lng,
      name: f.name.replace(/[<>&"']/g, ''),
      online: f.online,
    }));
    const centerLat = myCoords?.lat ?? markers[0]?.lat ?? 0;
    const centerLng = myCoords?.lng ?? markers[0]?.lng ?? 0;
    return `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>html,body,#map{margin:0;height:100%;background:#120a12}</style>
      </head><body><div id="map"></div><script>
        var map = L.map('map').setView([${centerLat}, ${centerLng}], 11);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '&copy; OpenStreetMap' }).addTo(map);
        ${myCoords ? `L.circleMarker([${myCoords.lat}, ${myCoords.lng}], {radius:9,color:'#e0426e',fillColor:'#e0426e',fillOpacity:1}).addTo(map).bindPopup('You');` : ''}
        var friends = ${JSON.stringify(markers)};
        friends.forEach(function(f){
          L.circleMarker([f.lat, f.lng], {
            radius: 8,
            color: f.online ? '#31c46b' : '#8a7d8f',
            fillColor: f.online ? '#31c46b' : '#8a7d8f',
            fillOpacity: 1
          }).addTo(map).bindPopup(f.name + (f.online ? ' — online' : ''));
        });
        if (friends.length) {
          var pts = friends.map(function(f){return [f.lat, f.lng];});
          ${myCoords ? `pts.push([${myCoords.lat}, ${myCoords.lng}]);` : ''}
          map.fitBounds(pts, { padding: [36, 36] });
        }
      </script></body></html>`;
  }, [mappableFriends, myCoords]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <Pressable style={styles.mapBtn} onPress={() => setShowMap(true)}>
          <Ionicons name="map" size={16} color={colors.text} />
          <Text style={styles.mapBtnText}>Map</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        {/* Incoming friend requests */}
        {requests.length ? (
          <>
            <Text style={styles.section}>Friend requests</Text>
            {requests.map((req) => (
              <View key={req.id} style={styles.row}>
                <Image source={{ uri: req.fromPhoto }} style={styles.avatar} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{req.fromName}</Text>
                  <Text style={styles.rowSub}>wants to be your friend</Text>
                </View>
                <Pressable
                  style={[styles.accept, busyId === req.id && styles.dim]}
                  onPress={() => respond(req, true)}
                  disabled={busyId === req.id}>
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                </Pressable>
                <Pressable
                  style={[styles.decline, busyId === req.id && styles.dim]}
                  onPress={() => respond(req, false)}
                  disabled={busyId === req.id}>
                  <Ionicons name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {/* My friends */}
        <Text style={styles.section}>My friends ({friends.length})</Text>
        {friends.length ? (
          friends.map((f) => {
            const km =
              myCoords && f.lat != null && f.lng != null
                ? distanceKm(myCoords.lat, myCoords.lng, f.lat, f.lng)
                : null;
            return (
              <Pressable key={f.id} style={styles.row} onPress={() => router.push(`/person/${f.id}`)}>
                <View>
                  <Image source={{ uri: f.photo }} style={styles.avatar} />
                  {f.online ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={[styles.rowSub, f.online && styles.onlineText]}>
                    {formatLastSeen(f.lastSeenAt)}
                  </Text>
                </View>
                {km != null ? (
                  <View style={styles.kmPill}>
                    <Ionicons name="navigate" size={12} color={colors.gold} />
                    <Text style={styles.kmText}>
                      {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.empty}>
            No friends yet. Find people from your contacts below, or send requests from profiles.
          </Text>
        )}

        {/* Find friends from contacts */}
        <Text style={styles.section}>Find friends</Text>
        <Pressable style={[styles.scanBtn, scanning && styles.dim]} onPress={scanContacts} disabled={scanning}>
          <Ionicons name="people" size={18} color={colors.white} />
          <Text style={styles.scanBtnText}>
            {scanning ? 'Checking your contacts…' : 'Find friends from my contacts'}
          </Text>
        </Pressable>

        {matchesFromContacts !== null ? (
          <>
            <View style={styles.onlineFilter}>
              <Text style={styles.onlineFilterText}>Show online people only</Text>
              <Switch
                value={onlineOnly}
                onValueChange={setOnlineOnly}
                trackColor={{ true: colors.accent, false: colors.line }}
                thumbColor={colors.white}
              />
            </View>
            {shownMatches.length ? (
              shownMatches.map((m) => (
                <View key={m.id} style={styles.row}>
                  <View>
                    <Image source={{ uri: m.photo }} style={styles.avatar} />
                    {m.online ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>{m.name}</Text>
                    <Text style={[styles.rowSub, m.online && styles.onlineText]}>
                      {m.online ? 'Online now' : m.city || 'On Matcharound'}
                    </Text>
                  </View>
                  {sentIds.includes(m.id) ? (
                    <Text style={styles.sentText}>Requested</Text>
                  ) : (
                    <Pressable
                      style={[styles.addBtn, busyId === m.id && styles.dim]}
                      onPress={() => addFriend(m.id)}
                      disabled={busyId === m.id}>
                      <Ionicons name="person-add" size={15} color={colors.white} />
                      <Text style={styles.addBtnText}>Add</Text>
                    </Pressable>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.empty}>
                {onlineOnly
                  ? 'None of your contacts are online right now.'
                  : 'None of your contacts are on Matcharound yet.'}
              </Text>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Friends map (free OpenStreetMap) */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <SafeAreaView style={styles.mapSafe} edges={['top']}>
          <View style={styles.mapHead}>
            <Text style={styles.mapTitle}>Friends map</Text>
            <Pressable onPress={() => setShowMap(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          {mappableFriends.length || myCoords ? (
            <WebView source={{ html: mapHtml }} style={styles.map} />
          ) : (
            <View style={styles.mapEmpty}>
              <Ionicons name="map-outline" size={40} color={colors.muted} />
              <Text style={styles.empty}>No friend locations to show yet.</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mapBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  scroll: { paddingBottom: 32 },
  section: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: 18,
    marginBottom: 8,
    padding: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bgElevated },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.card,
  },
  rowBody: { flex: 1 },
  rowName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rowSub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  onlineText: { color: colors.green, fontWeight: '600' },
  accept: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kmText: { color: colors.gold, fontWeight: '700', fontSize: 12 },
  empty: { color: colors.muted, marginHorizontal: 18, marginTop: 4, lineHeight: 20 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    marginHorizontal: 18,
    paddingVertical: 13,
  },
  scanBtnText: { color: colors.white, fontWeight: '800' },
  onlineFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 8,
  },
  onlineFilterText: { color: colors.text, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  sentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  dim: { opacity: 0.6 },
  mapSafe: { flex: 1, backgroundColor: colors.bg },
  mapHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  mapTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  map: { flex: 1 },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
