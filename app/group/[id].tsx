import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import {
  deleteGroup,
  fetchGroupMembers,
  fetchGroupPendingRequests,
  leaveGroup,
  listGroups,
  removeGroupMember,
  requestJoinGroup,
  respondJoinRequest,
  type GroupCard,
  type GroupJoinRequest,
  type GroupMember,
} from '@/lib/groups';
import { colors, radius } from '@/lib/theme';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId, refreshGroupBadge } = useApp();
  const [group, setGroup] = useState<GroupCard | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const all = await listGroups();
    const found = all.find((g) => g.id === id) ?? null;
    setGroup(found);
    if (found?.myRole) {
      setMembers(await fetchGroupMembers(id));
    } else {
      setMembers([]);
    }
    if (found?.myRole === 'admin') {
      setRequests(await fetchGroupPendingRequests(id));
    } else {
      setRequests([]);
    }
    refreshGroupBadge();
  }, [id, refreshGroupBadge]);

  useEffect(() => {
    load();
  }, [load]);

  const onRespond = async (req: GroupJoinRequest, accept: boolean) => {
    setBusy(req.id);
    try {
      await respondJoinRequest(req.id, accept);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update request', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const onJoin = async () => {
    if (!id) return;
    setBusy('join');
    try {
      await requestJoinGroup(id);
      await load();
      Alert.alert('Request sent', 'The admin will review your request.');
    } catch (e: any) {
      Alert.alert('Could not send request', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const onLeave = () => {
    if (!id) return;
    Alert.alert('Leave group?', 'You can request to join again later.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setBusy('leave');
          try {
            await leaveGroup(id);
            router.back();
          } catch (e: any) {
            Alert.alert('Could not leave', String(e?.message ?? e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert('Delete this group?', 'Everyone will be removed. This cannot be undone.', [
      { text: 'Keep group', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await deleteGroup(id);
            router.back();
          } catch (e: any) {
            Alert.alert('Could not delete', String(e?.message ?? e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const onRemove = (m: GroupMember) => {
    if (!id) return;
    Alert.alert(`Remove ${m.name}?`, 'They will need a new request to rejoin.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(m.id);
          try {
            await removeGroupMember(id, m.id);
            await load();
          } catch (e: any) {
            Alert.alert('Could not remove', String(e?.message ?? e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  if (!group) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.missing}>This group is no longer available.</Text>
      </SafeAreaView>
    );
  }

  const isAdmin = group.myRole === 'admin';
  const isMember = Boolean(group.myRole);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {group.city ? (
          <View style={styles.cityRow}>
            <Ionicons name="location" size={16} color={colors.gold} />
            <Text style={styles.city}>{group.city}</Text>
          </View>
        ) : null}
        {group.description ? <Text style={styles.desc}>{group.description}</Text> : null}
        <Text style={styles.meta}>
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          {isAdmin ? ' · you are the admin' : isMember ? ' · you are a member' : ''}
        </Text>

        {!isMember ? (
          <Pressable
            style={[styles.primary, busy === 'join' && styles.dim]}
            onPress={onJoin}
            disabled={busy === 'join' || group.myRequest === 'pending'}>
            <Text style={styles.primaryText}>
              {group.myRequest === 'pending'
                ? 'Waiting for admin'
                : group.myRequest === 'declined'
                  ? 'Request again'
                  : 'Request to join'}
            </Text>
          </Pressable>
        ) : null}

        {isAdmin && requests.length ? (
          <>
            <Text style={styles.section}>Join requests</Text>
            {requests.map((req) => (
              <View key={req.id} style={styles.row}>
                <Image source={{ uri: req.photo }} style={styles.avatar} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{req.name}</Text>
                  <Text style={styles.rowSub}>wants to join</Text>
                </View>
                <Pressable
                  style={[styles.accept, busy === req.id && styles.dim]}
                  onPress={() => onRespond(req, true)}
                  disabled={busy === req.id}>
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                </Pressable>
                <Pressable
                  style={[styles.decline, busy === req.id && styles.dim]}
                  onPress={() => onRespond(req, false)}
                  disabled={busy === req.id}>
                  <Ionicons name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {isMember ? (
          <>
            <Text style={styles.section}>Members</Text>
            {members.map((m) => (
              <Pressable
                key={m.id}
                style={styles.row}
                onPress={() => (m.id !== userId ? router.push(`/person/${m.id}`) : undefined)}>
                <View>
                  <Image source={{ uri: m.photo }} style={styles.avatar} />
                  {m.online ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>
                    {m.name}
                    {m.id === userId ? ' (you)' : ''}
                  </Text>
                  <Text style={[styles.rowSub, m.online && styles.onlineText]}>
                    {m.role === 'admin' ? 'Admin' : 'Member'}
                    {m.online ? ' · online' : m.city ? ` · ${m.city}` : ''}
                  </Text>
                </View>
                {isAdmin && m.id !== userId ? (
                  <Pressable onPress={() => onRemove(m)} hitSlop={8} disabled={busy === m.id}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={styles.empty}>
            Member list is visible after the admin accepts your request.
          </Text>
        )}

        {isMember && !isAdmin ? (
          <Pressable style={styles.leave} onPress={onLeave} disabled={busy === 'leave'}>
            <Text style={styles.leaveText}>{busy === 'leave' ? 'Leaving…' : 'Leave group'}</Text>
          </Pressable>
        ) : null}

        {isAdmin ? (
          <Pressable style={styles.leave} onPress={onDelete} disabled={busy === 'delete'}>
            <Text style={styles.leaveText}>
              {busy === 'delete' ? 'Deleting…' : 'Delete group'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  back: { margin: 18 },
  missing: { color: colors.muted, marginHorizontal: 18 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: 18, paddingBottom: 36 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  city: { color: colors.gold, fontWeight: '700' },
  desc: { color: colors.text, marginTop: 10, lineHeight: 22 },
  meta: { color: colors.muted, marginTop: 10, marginBottom: 16 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryText: { color: colors.white, fontWeight: '800' },
  section: { color: colors.gold, fontWeight: '800', fontSize: 14, marginTop: 18, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgElevated },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.card,
  },
  rowBody: { flex: 1 },
  rowName: { color: colors.text, fontWeight: '700' },
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
  remove: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  empty: { color: colors.muted, lineHeight: 20, marginTop: 8 },
  leave: { alignItems: 'center', marginTop: 24, paddingVertical: 12 },
  leaveText: { color: colors.muted, fontWeight: '600', textDecorationLine: 'underline' },
  dim: { opacity: 0.6 },
});
