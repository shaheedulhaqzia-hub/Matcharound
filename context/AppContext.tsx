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

import {
  fetchLatestBanReason,
  fetchNearby,
  fetchProfile,
  recordLike,
  updateLocation,
} from '@/lib/db';
import { people, setLivePeople } from '@/lib/people';
import { supabase } from '@/lib/supabase';
import type { AuthStatus, ChatMessage, Person, Profile } from '@/lib/types';

type AppState = {
  authStatus: AuthStatus;
  userId: string | null;
  profile: Profile | null;
  banReason: string | null;
  refreshProfile: () => Promise<void>;
  markBanned: () => void;
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  passedIds: string[];
  matchedIds: string[];
  nearby: Person[];
  matches: Person[];
  like: (id: string) => boolean;
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
  const [directory, setDirectory] = useState<Person[]>(people);
  const [radiusKm, setRadiusKm] = useState(10);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<string[]>(['p1']);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(starterChats);

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
    if (!p || !p.dob) {
      setAuthStatus('needsProfile');
      return;
    }
    setAuthStatus('ready');
  }, []);

  // Auth bootstrap + live session changes.
  useEffect(() => {
    if (!supabase) {
      setAuthStatus('demo');
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

  // Nearby people ranked by true distance (demo list stays as fallback).
  useEffect(() => {
    if (!coords) return;
    fetchNearby(coords.lat, coords.lng, 200)
      .then((list) => {
        if (list.length) setDirectory(list);
      })
      .catch(() => {});
  }, [coords]);

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

  const like = (id: string) => {
    if (userId) recordLike(userId, id).catch(() => {});
    if (matchedIds.includes(id)) return false;
    setMatchedIds((prev) => [...prev, id]);
    return true;
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
