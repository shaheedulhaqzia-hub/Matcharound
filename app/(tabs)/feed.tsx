import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { createPost, fetchFeed } from '@/lib/db';
import { moderateImage } from '@/lib/moderation';
import { colors, radius } from '@/lib/theme';
import type { Post } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';

function timeAgo(ts: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function FeedScreen() {
  const { userId, profile, markBanned, authStatus } = useApp();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setPosts(await fetchFeed(userId));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onShare = async () => {
    if (!userId) {
      Alert.alert('Demo mode', 'Sign in to share photos with your followers.');
      return;
    }
    const picked = await pickImage();
    if (!picked) return;
    setPosting(true);
    try {
      // Nudity check FIRST — a flagged photo bans the account with saved proof.
      const verdict = await moderateImage(userId, picked.base64, 'gallery_image');
      if (verdict === 'banned') {
        markBanned();
        return;
      }
      const url = await uploadImage('gallery', userId, picked.base64);
      await createPost(userId, url, '', verdict === 'safe' ? 'checked_safe' : 'unchecked');
      await load();
    } catch (e: any) {
      Alert.alert('Could not post', String(e?.message ?? e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <Pressable style={[styles.share, posting && styles.dim]} onPress={onShare} disabled={posting}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.shareText}>{posting ? 'Posting…' : 'Share photo'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        contentContainerStyle={posts.length ? styles.list : styles.emptyWrap}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="images" size={44} color={colors.muted} />
            <Text style={styles.emptyTitle}>
              {authStatus === 'demo' ? 'Sign in to see the feed' : 'Nothing here yet'}
            </Text>
            <Text style={styles.emptyBody}>
              Photos you share appear in your followers' feeds. Follow people from their profile to
              see their photos here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.post}>
            <View style={styles.postHead}>
              <Image
                source={{ uri: item.authorPhoto || profile?.photo || undefined }}
                style={styles.avatar}
              />
              <Text style={styles.author}>{item.authorId === userId ? 'You' : item.authorName}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Image source={{ uri: item.imageUrl }} style={styles.photo} contentFit="cover" />
            {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  shareText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  dim: { opacity: 0.6 },
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 18 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { color: colors.text, fontWeight: '800', fontSize: 17 },
  emptyBody: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  post: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bgElevated },
  author: { color: colors.text, fontWeight: '700', flex: 1 },
  time: { color: colors.muted, fontSize: 12 },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: colors.bgElevated },
  caption: { color: colors.text, padding: 12, lineHeight: 20 },
});
