import { supabase } from './supabase';
import type { CallMode } from './types';

export type LiveCall = {
  id: string;
  fromId: string;
  toId: string;
  mode: CallMode;
  status: 'ringing' | 'live' | 'ended' | 'declined';
};

export type CallSignal = {
  id: string;
  fromId: string;
  kind: 'offer' | 'answer' | 'ice';
  payload: Record<string, any>;
};

function rowToCall(row: Record<string, any>): LiveCall {
  return {
    id: String(row.id),
    fromId: String(row.from_id),
    toId: String(row.to_id),
    mode: (row.mode === 'voice' ? 'voice' : 'video') as CallMode,
    status: String(row.status) as LiveCall['status'],
  };
}

export async function startCall(fromId: string, toId: string, mode: CallMode): Promise<string> {
  if (!supabase) throw new Error('Backend not configured');
  const { data, error } = await supabase
    .from('calls')
    .insert({ from_id: fromId, to_id: toId, mode, status: 'ringing' })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Could not start call');
  return String(data.id);
}

export async function fetchCall(callId: string): Promise<LiveCall | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('calls').select('*').eq('id', callId).maybeSingle();
  if (error || !data) return null;
  return rowToCall(data);
}

export async function setCallStatus(
  callId: string,
  status: LiveCall['status']
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('calls')
    .update({
      status,
      ended_at: status === 'ended' || status === 'declined' ? new Date().toISOString() : null,
    })
    .eq('id', callId);
}

export async function sendSignal(
  callId: string,
  fromId: string,
  kind: CallSignal['kind'],
  payload: Record<string, any>
): Promise<void> {
  if (!supabase) return;
  await supabase.from('call_signals').insert({
    call_id: callId,
    from_id: fromId,
    kind,
    payload,
  });
}

export async function fetchSignals(callId: string): Promise<CallSignal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('call_signals')
    .select('id, from_id, kind, payload')
    .eq('call_id', callId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    fromId: String(r.from_id),
    kind: r.kind as CallSignal['kind'],
    payload: (r.payload ?? {}) as Record<string, any>,
  }));
}

export function subscribeSignals(
  callId: string,
  onSignal: (signal: CallSignal) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`call-signals-${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `call_id=eq.${callId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, any>;
        onSignal({
          id: String(row.id),
          fromId: String(row.from_id),
          kind: row.kind,
          payload: row.payload ?? {},
        });
      }
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

export function subscribeIncomingCalls(
  userId: string,
  onCall: (call: LiveCall) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`incoming-calls-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'calls',
        filter: `to_id=eq.${userId}`,
      },
      (payload) => {
        const call = rowToCall(payload.new as Record<string, any>);
        if (call.status === 'ringing') onCall(call);
      }
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

export function subscribeCallStatus(
  callId: string,
  onStatus: (status: LiveCall['status']) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`call-status-${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${callId}`,
      },
      (payload) => {
        onStatus(String((payload.new as Record<string, any>).status) as LiveCall['status']);
      }
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
