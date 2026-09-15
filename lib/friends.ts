import { supabase } from './supabase';

export type Friend = {
  id: string;
  name: string;
  photo: string;
  city: string;
  lat: number | null;
  lng: number | null;
  online: boolean;
  lastSeenAt: number | null; // ms epoch; rendered in the viewer's local time
};

export type FriendRequest = {
  id: string;
  fromId: string;
  fromName: string;
  fromPhoto: string;
  createdAt: number;
};

export type ContactMatch = {
  id: string;
  name: string;
  photo: string;
  city: string;
  phone: string;
  online: boolean;
};

/** Straight-line distance in km between two GPS points (haversine). */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Last seen" in the viewer's own timezone / language. */
export function formatLastSeen(lastSeenAt: number | null): string {
  if (!lastSeenAt) return 'Last seen: unknown';
  const diffMin = Math.floor((Date.now() - lastSeenAt) / 60000);
  if (diffMin < 2) return 'Online now';
  if (diffMin < 60) return `Last seen ${diffMin} min ago`;
  const d = new Date(lastSeenAt);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Last seen today at ${time}`;
  return `Last seen ${d.toLocaleDateString()} at ${time}`;
}

/** Keep presence + position fresh (called every minute while app is open). */
export async function heartbeat(lat?: number, lng?: number): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('heartbeat', { p_lat: lat ?? null, p_lng: lng ?? null });
}

export async function fetchFriends(): Promise<Friend[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_friends');
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    photo: String(r.photo ?? ''),
    city: String(r.city ?? ''),
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    online: Boolean(r.online),
    lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).getTime() : null,
  }));
}

/** Incoming pending friend requests, newest first. */
export async function fetchIncomingRequests(_userId?: string): Promise<FriendRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('incoming_friend_requests');
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((r) => ({
    id: String(r.id),
    fromId: String(r.from_id),
    fromName: String(r.name ?? ''),
    fromPhoto: String(r.photo ?? ''),
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export type FriendshipState = 'none' | 'pending' | 'friends';

export async function friendshipStatus(meId: string, otherId: string): Promise<FriendshipState> {
  if (!supabase) return 'none';
  const { data } = await supabase
    .from('friend_requests')
    .select('from_id, to_id, status')
    .or(
      `and(from_id.eq.${meId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${meId})`
    )
    .in('status', ['pending', 'accepted'])
    .limit(2);
  if (!data?.length) return 'none';
  if (data.some((r) => r.status === 'accepted')) return 'friends';
  return 'pending';
}

/** IDs I already sent a request to (pending or accepted). */
export async function fetchOutgoingIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('friend_requests')
    .select('to_id, status')
    .eq('from_id', userId)
    .in('status', ['pending', 'accepted']);
  return (data ?? []).map((r) => String(r.to_id));
}

export async function sendFriendRequest(fromId: string, toId: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase
    .from('friend_requests')
    .upsert(
      { from_id: fromId, to_id: toId, status: 'pending' },
      { onConflict: 'from_id,to_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function respondToRequest(
  requestId: string,
  accept: boolean
): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

/** Which of these (normalized) phone numbers belong to Matcharound users? */
export async function findByPhones(phones: string[]): Promise<ContactMatch[]> {
  if (!supabase || !phones.length) return [];
  const { data, error } = await supabase.rpc('find_by_phones', { p_phones: phones });
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    photo: String(r.photo ?? ''),
    city: String(r.city ?? ''),
    phone: String(r.phone ?? ''),
    online: Boolean(r.online),
  }));
}
