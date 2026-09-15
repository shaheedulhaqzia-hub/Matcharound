import { supabase } from './supabase';
import type { ChatMessage } from './types';

export type Conversation = {
  personId: string;
  name: string;
  photo: string;
  city: string;
  lastText: string;
  lastImage: boolean;
  lastAt: number;
  lastFromMe: boolean;
};

function rowToMessage(row: Record<string, any>, myId: string): ChatMessage {
  return {
    id: String(row.id),
    fromMe: String(row.from_id) === myId,
    text: String(row.text ?? ''),
    at: new Date(row.created_at).getTime(),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
  };
}

export async function fetchThread(myId: string, otherId: string): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, from_id, to_id, text, image_url, created_at')
    .or(
      `and(from_id.eq.${myId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${myId})`
    )
    .order('created_at', { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data.map((row) => rowToMessage(row, myId));
}

export async function sendChatMessage(
  myId: string,
  otherId: string,
  text: string,
  imageUrl?: string
): Promise<ChatMessage> {
  if (!supabase) throw new Error('Backend not configured');
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      from_id: myId,
      to_id: otherId,
      text: text.trim(),
      image_url: imageUrl ?? null,
    })
    .select('id, from_id, to_id, text, image_url, created_at')
    .single();
  if (error || !data) throw error ?? new Error('Send failed');
  return rowToMessage(data, myId);
}

export async function fetchConversations(): Promise<Conversation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_conversations');
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((r) => ({
    personId: String(r.person_id),
    name: String(r.name ?? ''),
    photo: String(r.photo ?? ''),
    city: String(r.city ?? ''),
    lastText: String(r.last_text ?? ''),
    lastImage: Boolean(r.last_image),
    lastAt: r.last_at ? new Date(r.last_at).getTime() : 0,
    lastFromMe: Boolean(r.last_from_me),
  }));
}

export function subscribeThread(
  myId: string,
  otherId: string,
  onMessage: (msg: ChatMessage) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`chat-${[myId, otherId].sort().join('-')}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => {
        const row = payload.new as Record<string, any>;
        const from = String(row.from_id);
        const to = String(row.to_id);
        if (
          (from === myId && to === otherId) ||
          (from === otherId && to === myId)
        ) {
          onMessage(rowToMessage(row, myId));
        }
      }
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
