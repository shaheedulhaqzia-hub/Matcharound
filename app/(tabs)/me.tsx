import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { signOut } from '@/lib/auth';
import { fetchMyPosts, updateProfileFields } from '@/lib/db';
import { moderateImage, type ModerationSource } from '@/lib/moderation';
import { me } from '@/lib/people';
import { colors, radius } from '@/lib/theme';
import type { Post } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';

export default function MeScreen() {
  const { authStatus, userId, profile, refreshProfile, markBanned } = useApp();
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [job, setJob] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const isDemo = authStatus === 'demo';
  const name = profile?.name || me.name;
  const age = profile?.age || me.age;
  const photo = profile?.photo || me.photo;
  const cover = profile?.coverUrl;

  const loadPosts = useCallback(async () => {
    if (userId) setMyPosts(await fetchMyPosts(userId));
  }, [userId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const changePhoto = async (kind: 'profile_photo' | 'cover_photo') => {
    if (!userId) {
      Alert.alert('Demo mode', 'Sign in to change your photos.');
      return;
    }
    const picked = await pickImage(kind === 'cover_photo' ? [16, 9] : [1, 1]);
    if (!picked) return;
    setBusy(kind);
    try {
      const verdict = await moderateImage(userId, picked.base64, kind as ModerationSource);
      if (verdict === 'banned') {
        markBanned();
        return;
      }
      const bucket = kind === 'cover_photo' ? 'covers' : 'avatars';
      const url = await uploadImage(bucket, userId, picked.base64);
      await updateProfileFields(
        userId,
        kind === 'cover_photo' ? { cover_url: url } : { photo: url }
      );
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Upload failed', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const startEdit = () => {
    setBio(profile?.bio ?? '');
    setJob(profile?.job ?? '');
    setCity(profile?.city ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!userId) return;
    setBusy('edit');
    try {
      await updateProfileFields(userId, { bio: bio.trim(), job: job.trim(), city: city.trim() });
      await refreshProfile();
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Cover photo */}
        <Pressable style={styles.cover} onPress={() => changePhoto('cover_photo')}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.coverEmpty}>
              <Ionicons name="image" size={26} color={colors.muted} />
              <Text style={styles.coverHint}>
                {busy === 'cover_photo' ? 'Uploading…' : 'Tap to add a cover photo'}
              </Text>
            </View>
          )}
          <View style={styles.coverBadge}>
            <Ionicons name="camera" size={14} color={colors.white} />
          </View>
        </Pressable>

        {/* Avatar + identity */}
        <View style={styles.identity}>
          <Pressable onPress={() => changePhoto('profile_photo')}>
            <Image source={{ uri: photo }} style={styles.avatar} />
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </Pressable>
          <Text style={styles.name}>
            {name}
            {age ? `, ${age}` : ''}
          </Text>
          {profile?.job || profile?.city ? (
            <Text style={styles.job}>
              {[profile?.job, profile?.city].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {busy === 'profile_photo' ? <Text style={styles.uploading}>Uploading photo…</Text> : null}
        </View>

        {/* Edit profile */}
        {editing ? (
          <View style={styles.editCard}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={bio}
              onChangeText={setBio}
              placeholder="A line about you"
              placeholderTextColor={colors.muted}
              multiline
            />
            <Text style={styles.label}>Job</Text>
            <TextInput
              style={styles.input}
              value={job}
              onChangeText={setJob}
              placeholder="What you do"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>Area</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Neighbourhood or city"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.editRow}>
              <Pressable style={styles.editCancel} onPress={() => setEditing(false)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editSave, busy === 'edit' && styles.dim]}
                onPress={saveEdit}
                disabled={busy === 'edit'}>
                <Text style={styles.editSaveText}>{busy === 'edit' ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.action} onPress={isDemo ? undefined : startEdit}>
            <Ionicons name="create" size={18} color={colors.text} />
            <Text style={styles.actionText}>{isDemo ? 'Sign in to edit profile' : 'Edit profile'}</Text>
          </Pressable>
        )}

        {/* My gallery */}
        <View style={styles.galleryHead}>
          <Text style={styles.galleryTitle}>My photos</Text>
          <Text style={styles.galleryCount}>{myPosts.length}</Text>
        </View>
        {myPosts.length ? (
          <FlatList
            data={myPosts}
            horizontal
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gallery}
            renderItem={({ item }) => (
              <Image source={{ uri: item.imageUrl }} style={styles.galleryImage} contentFit="cover" />
            )}
            scrollEnabled
          />
        ) : (
          <Text style={styles.galleryEmpty}>
            Photos you share on the Feed tab appear here and in your followers' feeds.
          </Text>
        )}

        {/* Sign out */}
        {!isDemo ? (
          <Pressable style={styles.signOut} onPress={() => signOut()}>
            <Ionicons name="log-out" size={18} color={colors.accent} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 32 },
  cover: {
    height: 150,
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverHint: { color: colors.muted, fontSize: 13 },
  coverBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { alignItems: 'center', marginTop: -44 },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: colors.bg,
    backgroundColor: colors.card,
  },
  avatarBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 10 },
  job: { color: colors.gold, marginTop: 4, fontWeight: '600' },
  bio: { color: colors.muted, textAlign: 'center', marginTop: 8, marginHorizontal: 30, lineHeight: 20 },
  uploading: { color: colors.accent, marginTop: 8, fontWeight: '600' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginHorizontal: 18,
    marginTop: 18,
    paddingVertical: 12,
  },
  actionText: { color: colors.text, fontWeight: '700' },
  editCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: 18,
    marginTop: 18,
    padding: 16,
  },
  label: { color: colors.gold, fontWeight: '700', fontSize: 12, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  editRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  editCancelText: { color: colors.muted, fontWeight: '700' },
  editSave: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  editSaveText: { color: colors.white, fontWeight: '800' },
  dim: { opacity: 0.6 },
  galleryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginTop: 26,
    marginBottom: 10,
  },
  galleryTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  galleryCount: { color: colors.muted, fontWeight: '700' },
  gallery: { paddingHorizontal: 18, gap: 10 },
  galleryImage: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.card },
  galleryEmpty: { color: colors.muted, marginHorizontal: 18, lineHeight: 20 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    marginHorizontal: 18,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  signOutText: { color: colors.accent, fontWeight: '700' },
});
