import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Alert } from 'react-native';

import {
  fetchLatestBanReason,
  fetchNearby,
  fetchProfile,
  recordLike,
  theyLikedMe,
  updateLocation,
} from '@/lib/db';
import { fetchIncomingRequests, heartbeat } from '@/lib/friends';
import { fetchAdminPendingCount } from '@/lib/groups';
import { people, setLivePeople } from '@/lib/people';
import { supabase } from '@/lib/supabase';
import type { AuthStatus, ChatMessage, Person, Profile, SearchFilters } from '@/lib/types';

const defaultFilters: SearchFilters = { gender: null, minAge: 18, maxAge: 99, city: '' };

type AppState = {
  authStatus: AuthStatus;
  userId: string | null;
  profile: Profile | null;
  banReason: string | null;
  refreshProfile: () => Promise<void>;
  markBanned: () => void;
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  filters: SearchFilters;
  setFilters: (f: SearchFilters) => void;
  /** Label of the manually chosen place, or null when using real GPS. */
  locationLabel: string | null;
  /** Search from a typed place (city / country). Returns false when not found. */
  setManualLocation: (query: string) => Promise<boolean>;
  /** Go back to searching around the real GPS position. */
  clearManualLocation: () => void;
  /** Real GPS position of this user (null until permission granted). */
  myCoords: { lat: number; lng: number } | null;
  /** Incoming pending friend requests (drives tab badge + notifications). */
  pendingFriendRequests: number;
  refreshFriendBadge: () => Promise<void>;
  /** Join requests waiting on groups I admin. */
  pendingGroupRequests: number;
  refreshGroupBadge: () => Promise<void>;
  passedIds: string[];
  matchedIds: string[];
  nearby: Person[];
  matches: Person[];
  like: (id: string) => Promise<boolean>;
  pass: (id: string) => void;
  messages: Record<string, ChatMessage[]>;
  sendMessage: (personId: string, text: string, imageUrl?: string) => void;
  addIncoming: (personId: string, text: string) => void;
};

const AppContext = createContext<AppState | null>(null);

const starterChats: Record<string, ChatMessage[]> = {
  p1: [
    {
      id: 'm0',
      fromMe: false,
      text: 'Hey — you are basically around the corner. Coffee this week?',
      at: Date.now() - 1000 * 60 * 40,
    },
  ],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [manualPlace, setManualPlace] = useState<{ lat: number; lng: number; label: string } | null>(
    null
  );
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [directory, setDirectory] = useState<Person[]>(people);
  const [radiusKm, setRadiusKm] = useState(10);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [pendingGroupRequests, setPendingGroupRequests] = useState(0);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});

  const applySession = useCallback(async (sessionUserId: string | null) => {
    if (!sessionUserId) {
      setUserId(null);
      setProfile(null);
      setAuthStatus('signedOut');
      return;
    }
    setUserId(sessionUserId);
    const p = await fetchProfile(sessionUserId);
    setProfile(p);
    if (p?.banned) {
      setBanReason(await fetchLatestBanReason(sessionUserId));
      setAuthStatus('banned');
      return;
    }
    if (!p || !p.dob || !p.phone || !p.gender) {
      setAuthStatus('needsProfile');
      return;
    }
    setAuthStatus('ready');
  }, []);

  // Auth bootstrap + live session changes.
  useEffect(() => {
    if (!supabase) {
      setAuthStatus('demo');
      setMatchedIds(['p1']);
      setMessages(starterChats);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) applySession(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    if (userId) await applySession(userId);
  }, [userId, applySession]);

  const markBanned = useCallback(() => {
    setAuthStatus('banned');
    if (userId) fetchLatestBanReason(userId).then(setBanReason);
  }, [userId]);

  // Real GPS location -> save to profile, used for matching.
  useEffect(() => {
    if (authStatus !== 'ready' || !userId) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const pos = await Location.getCurrentPositionAsync({});
      if (cancelled) return;
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      updateLocation(userId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus, userId]);

  // Search from the manually chosen place, or the real GPS position.
  const center = manualPlace ?? coords;

  // Nearby people ranked by true distance (demo list stays as fallback).
  useEffect(() => {
    if (!center) return;
    fetchNearby(center.lat, center.lng, Math.max(500, radiusKm), filters)
      .then((list) => {
        if (list.length || manualPlace || filters !== defaultFilters) setDirectory(list);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, radiusKm, filters]);

  // Presence heartbeat: online + last seen + live position, every minute.
  useEffect(() => {
    if (authStatus !== 'ready' || !userId) return;
    let cancelled = false;
    const beat = async () => {
      try {
        const pos = await Location.getLastKnownPositionAsync();
        if (cancelled) return;
        if (pos) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        await heartbeat(pos?.coords.latitude, pos?.coords.longitude);
      } catch {
        // offline is fine; next beat retries
      }
    };
    beat();
    const timer = setInterval(beat, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authStatus, userId]);

  const refreshFriendBadge = useCallback(async () => {
    if (!userId) return;
    const reqs = await fetchIncomingRequests();
    setPendingFriendRequests(reqs.length);
  }, [userId]);

  const refreshGroupBadge = useCallback(async () => {
    if (!userId) return;
    setPendingGroupRequests(await fetchAdminPendingCount());
  }, [userId]);

  // Friend request notifications: badge count + realtime in-app alert.
  useEffect(() => {
    if (authStatus !== 'ready' || !userId || !supabase) return;
    refreshFriendBadge();
    const channel = supabase
      .channel('friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
          filter: `to_id=eq.${userId}`,
        },
        () => {
          setPendingFriendRequests((n) => n + 1);
          Alert.alert('New friend request', 'Someone wants to be your friend. See the Friends tab.');
        }
      )
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [authStatus, userId, refreshFriendBadge]);

  useEffect(() => {
    if (authStatus !== 'ready' || !userId || !supabase) return;
    refreshGroupBadge();
    const channel = supabase
      .channel('group-join-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_join_requests' },
        async () => {
          const next = await fetchAdminPendingCount();
          setPendingGroupRequests((prev) => {
            if (next > prev) {
              Alert.alert(
                'Group join request',
                'Someone asked to join a group you admin. Open the Groups tab to accept or decline.'
              );
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [authStatus, userId, refreshGroupBadge]);

  const setManualLocation = useCallback(async (query: string): Promise<boolean> => {
    const q = query.trim();
    if (!q) return false;
    try {
      const results = await Location.geocodeAsync(q);
      const first = results[0];
      if (!first) return false;
      setManualPlace({ lat: first.latitude, lng: first.longitude, label: q });
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearManualLocation = useCallback(() => setManualPlace(null), []);

  useEffect(() => {
    setLivePeople(directory);
  }, [directory]);

  const nearby = useMemo(
    () =>
      directory.filter(
        (p) => p.distanceKm <= radiusKm && !passedIds.includes(p.id) && !matchedIds.includes(p.id)
      ),
    [directory, radiusKm, passedIds, matchedIds]
  );

  const matches = useMemo(
    () => directory.filter((p) => matchedIds.includes(p.id)),
    [directory, matchedIds]
  );

  const like = async (id: string) => {
    if (matchedIds.includes(id)) return false;
    if (!userId) {
      setMatchedIds((prev) => [...prev, id]);
      return true;
    }
    await recordLike(userId, id);
    const mutual = await theyLikedMe(userId, id);
    if (mutual) {
      setMatchedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return true;
    }
    return false;
  };

  const pass = (id: string) => {
    setPassedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const sendMessage = (personId: string, text: string, imageUrl?: string) => {
    const trimmed = text.trim();
    if (!trimmed && !imageUrl) return;
    const next: ChatMessage = {
      id: `${personId}-${Date.now()}`,
      fromMe: true,
      text: trimmed,
      at: Date.now(),
      imageUrl,
    };
    setMessages((prev) => ({
      ...prev,
      [personId]: [...(prev[personId] ?? []), next],
    }));
  };

  const addIncoming = (personId: string, text: string) => {
    const next: ChatMessage = {
      id: `${personId}-in-${Date.now()}`,
      fromMe: false,
      text,
      at: Date.now(),
    };
    setMessages((prev) => ({
      ...prev,
      [personId]: [...(prev[personId] ?? []), next],
    }));
  };

  const value = useMemo(
    () => ({
      authStatus,
      userId,
      profile,
      banReason,
      refreshProfile,
      markBanned,
      radiusKm,
      setRadiusKm,
      filters,
      setFilters,
      locationLabel: manualPlace?.label ?? null,
      setManualLocation,
      clearManualLocation,
      myCoords: coords,
      pendingFriendRequests,
      refreshFriendBadge,
      pendingGroupRequests,
      refreshGroupBadge,
      passedIds,
      matchedIds,
      nearby,
      matches,
      like,
      pass,
      messages,
      sendMessage,
      addIncoming,
    }),
    [
      authStatus,
      userId,
      profile,
      banReason,
      refreshProfile,
      markBanned,
      radiusKm,
      filters,
      manualPlace,
      setManualLocation,
      clearManualLocation,
      coords,
      pendingFriendRequests,
      refreshFriendBadge,
      pendingGroupRequests,
      refreshGroupBadge,
      passedIds,
      matchedIds,
      nearby,
      matches,
      messages,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
