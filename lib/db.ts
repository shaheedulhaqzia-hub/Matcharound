import { supabase } from './supabase';
import type { Person, Post, Profile, SearchFilters } from './types';

function rowToProfile(row: Record<string, any>): Profile {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    age: Number(row.age ?? 0),
    dob: row.dob ? String(row.dob) : null,
    phone: row.phone ? String(row.phone) : null,
    gender: row.gender ? (String(row.gender) as Profile['gender']) : null,
    interestedIn: (row.interested_in ? String(row.interested_in) : 'everyone') as Profile['interestedIn'],
    city: String(row.city ?? ''),
    bio: String(row.bio ?? ''),
    job: String(row.job ?? ''),
    photo: String(row.photo ?? ''),
    coverUrl: row.cover_url ? String(row.cover_url) : null,
    banned: Boolean(row.banned),
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data);
}

export async function upsertProfile(profile: {
  id: string;
  name: string;
  dob: string;
  age: number;
  phone?: string;
  gender?: string;
  interested_in?: string;
  bio?: string;
  job?: string;
  city?: string;
  photo?: string;
  cover_url?: string;
}): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
  if (error) {
    if (error.code === '23505' && String(error.message).includes('phone')) {
      throw new Error('This phone number is already used by another account.');
    }
    throw error;
  }
}

/** True when another account already uses this (normalized) phone number. */
export async function phoneInUse(phone: string, exceptUserId?: string): Promise<boolean> {
  if (!supabase) return false;
  let query = supabase.from('profiles').select('id').eq('phone', phone).limit(1);
  if (exceptUserId) query = query.neq('id', exceptUserId);
  const { data } = await query;
  return Boolean(data && data.length > 0);
}

export async function updateProfileFields(
  userId: string,
  fields: Record<string, unknown>
): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateLocation(userId: string, lat: number, lng: number): Promise<void> {
  if (!supabase) return;
  await supabase.from('profiles').update({ lat, lng, online: true }).eq('id', userId);
}

export async function fetchNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  filters?: SearchFilters
): Promise<Person[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('search_profiles', {
    user_lat: lat,
    user_lng: lng,
    radius_km: radiusKm,
    p_gender: filters?.gender ?? null,
    p_min_age: filters?.minAge ?? 18,
    p_max_age: filters?.maxAge ?? 120,
    p_city: filters?.city?.trim() || null,
  });
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    age: Number(row.age ?? 0),
    distanceKm: Number(row.distance_km ?? 0),
    city: String(row.city ?? ''),
    bio: String(row.bio ?? ''),
    job: String(row.job ?? ''),
    interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
    photo: String(row.photo ?? ''),
    online: Boolean(row.online),
  }));
}

export async function recordLike(likerId: string, likedId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('likes').upsert(
    { liker_id: likerId, liked_id: likedId },
    { onConflict: 'liker_id,liked_id', ignoreDuplicates: true }
  );
}

// ---------- Followers + gallery feed ----------

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();
  return Boolean(data);
}

export async function follow(followerId: string, followeeId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('follows').upsert(
    { follower_id: followerId, followee_id: followeeId },
    { onConflict: 'follower_id,followee_id', ignoreDuplicates: true }
  );
}

export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
}

export async function createPost(
  authorId: string,
  imageUrl: string,
  caption: string,
  moderation: 'checked_safe' | 'unchecked'
): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, image_url: imageUrl, caption, moderation });
  if (error) throw error;
}

/** Feed = my own posts + posts from everyone I follow. */
export async function fetchFeed(userId: string): Promise<Post[]> {
  if (!supabase) return [];
  const { data: followRows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);
  const authorIds = [userId, ...(followRows ?? []).map((r) => String(r.followee_id))];
  const { data, error } = await supabase
    .from('posts')
    .select('id, author_id, image_url, caption, created_at, profiles!posts_author_id_fkey(name, photo)')
    .in('author_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((row) => ({
    id: String(row.id),
    authorId: String(row.author_id),
    authorName: String(row.profiles?.name ?? ''),
    authorPhoto: String(row.profiles?.photo ?? ''),
    imageUrl: String(row.image_url),
    caption: String(row.caption ?? ''),
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function fetchMyPosts(userId: string): Promise<Post[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('id, author_id, image_url, caption, created_at')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((row) => ({
    id: String(row.id),
    authorId: String(row.author_id),
    authorName: '',
    authorPhoto: '',
    imageUrl: String(row.image_url),
    caption: String(row.caption ?? ''),
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function fetchLatestBanReason(userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('bans')
    .select('reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? String(data.reason) : null;
}
