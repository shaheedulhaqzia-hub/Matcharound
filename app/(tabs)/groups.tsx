import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import {
  createGroup,
  listGroups,
  requestJoinGroup,
  type GroupCard,
} from '@/lib/groups';
import { colors, radius } from '@/lib/theme';

export default function GroupsScreen() {
  const router = useRouter();
  const { userId, refreshGroupBadge } = useApp();
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setGroups(await listGroups(query));
    refreshGroupBadge();
  }, [query, refreshGroupBadge]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your group a name.');
      return;
    }
    setBusy('create');
    try {
      const id = await createGroup(name, description, city);
      setShowCreate(false);
      setName('');
      setDescription('');
      setCity('');
      await load();
      router.push(`/group/${id}` as Href);
    } catch (e: any) {
      Alert.alert('Could not create group', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const onRequest = async (g: GroupCard) => {
    if (!userId) {
      Alert.alert('Sign in', 'Sign in to join groups.');
      return;
    }
    setBusy(g.id);
    try {
      await requestJoinGroup(g.id);
      await load();
      Alert.alert('Request sent', `The admin of ${g.name} will review your request.`);
    } catch (e: any) {
      Alert.alert('Could not send request', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const mine = groups.filter((g) => g.myRole);
  const discover = groups.filter((g) => !g.myRole);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <Pressable style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.createBtnText}>Create</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>Anyone can request to join. The admin must accept.</Text>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => setQuery(search.trim())}
        placeholder="Search groups by name or city"
        placeholderTextColor={colors.muted}
        returnKeyType="search"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }>
        {mine.length ? (
          <>
            <Text style={styles.section}>My groups</Text>
            {mine.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                busy={busy === g.id}
                onPress={() => router.push(`/group/${g.id}` as Href)}
              />
            ))}
          </>
        ) : null}

        <Text style={styles.section}>Discover</Text>
        {discover.length ? (
          discover.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              busy={busy === g.id}
              onPress={() => {
                if (g.myRequest === 'pending') {
                  Alert.alert('Waiting', 'The admin has not accepted your request yet.');
                  return;
                }
                onRequest(g);
              }}
              actionLabel={
                g.myRequest === 'pending'
                  ? 'Requested'
                  : g.myRequest === 'declined'
                    ? 'Request again'
                    : 'Request to join'
              }
            />
          ))
        ) : (
          <Text style={styles.empty}>
            No other groups yet. Create one and invite people nearby.
          </Text>
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>New group</Text>
              <Pressable onPress={() => setShowCreate(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Weekend hikers"
              placeholderTextColor={colors.muted}
              maxLength={60}
            />
            <Text style={styles.label}>City or area (optional)</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Lahore"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>About</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="What this group is for"
              placeholderTextColor={colors.muted}
              multiline
            />
            <Pressable
              style={[styles.submit, busy === 'create' && styles.dim]}
              onPress={onCreate}
              disabled={busy === 'create'}>
              <Text style={styles.submitText}>
                {busy === 'create' ? 'Creating…' : 'Create group'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function GroupRow({
  group,
  busy,
  onPress,
  actionLabel,
}: {
  group: GroupCard;
  busy: boolean;
  onPress: () => void;
  actionLabel?: string;
}) {
  return (
    <Pressable style={[styles.row, busy && styles.dim]} onPress={onPress} disabled={busy}>
      <View style={styles.iconBubble}>
        <Ionicons name="people" size={20} color={colors.gold} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{group.name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          {group.city ? ` · ${group.city}` : ''}
          {group.myRole === 'admin' && group.pendingCount
            ? ` · ${group.pendingCount} waiting`
            : ''}
        </Text>
      </View>
      {group.myRole ? (
        <View style={[styles.pill, group.myRole === 'admin' && styles.pillAdmin]}>
          <Text style={styles.pillText}>{group.myRole === 'admin' ? 'Admin' : 'Member'}</Text>
        </View>
      ) : (
        <Text style={styles.action}>{actionLabel}</Text>
      )}
    </Pressable>
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
  sub: { color: colors.muted, marginHorizontal: 18, marginTop: 4, marginBottom: 12 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createBtnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  search: {
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
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
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rowSub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  pill: {
    backgroundColor: colors.bgElevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillAdmin: { backgroundColor: colors.accentSoft },
  pillText: { color: colors.gold, fontWeight: '700', fontSize: 12 },
  action: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  empty: { color: colors.muted, marginHorizontal: 18, lineHeight: 20 },
  dim: { opacity: 0.6 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  label: { color: colors.gold, fontWeight: '700', fontSize: 13, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});
