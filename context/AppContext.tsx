import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { people } from '@/lib/people';
import type { ChatMessage, Person } from '@/lib/types';

type AppState = {
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  passedIds: string[];
  matchedIds: string[];
  nearby: Person[];
  matches: Person[];
  like: (id: string) => boolean;
  pass: (id: string) => void;
  messages: Record<string, ChatMessage[]>;
  sendMessage: (personId: string, text: string) => void;
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
  const [radiusKm, setRadiusKm] = useState(10);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<string[]>(['p1']);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(starterChats);

  const nearby = useMemo(
    () =>
      people.filter(
        (p) => p.distanceKm <= radiusKm && !passedIds.includes(p.id) && !matchedIds.includes(p.id)
      ),
    [radiusKm, passedIds, matchedIds]
  );

  const matches = useMemo(
    () => people.filter((p) => matchedIds.includes(p.id)),
    [matchedIds]
  );

  const like = (id: string) => {
    if (matchedIds.includes(id)) return false;
    setMatchedIds((prev) => [...prev, id]);
    return true;
  };

  const pass = (id: string) => {
    setPassedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const sendMessage = (personId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next: ChatMessage = {
      id: `${personId}-${Date.now()}`,
      fromMe: true,
      text: trimmed,
      at: Date.now(),
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
    [radiusKm, passedIds, matchedIds, nearby, matches, messages]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
