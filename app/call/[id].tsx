import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

import { useApp } from '@/context/AppContext';
import {
  fetchCall,
  fetchSignals,
  sendSignal,
  setCallStatus,
  startCall,
  subscribeCallStatus,
  subscribeSignals,
  type CallSignal,
} from '@/lib/calls';
import { fetchPersonById } from '@/lib/db';
import { personById } from '@/lib/people';
import { colors } from '@/lib/theme';
import type { CallMode, Person } from '@/lib/types';

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export default function CallScreen() {
  const { id, mode, callId: existingCallId, incoming } = useLocalSearchParams<{
    id: string;
    mode?: CallMode;
    callId?: string;
    incoming?: string;
  }>();
  const router = useRouter();
  const { userId } = useApp();
  const isVideo = (mode ?? 'video') === 'video';
  const isCallee = incoming === '1';

  const [person, setPerson] = useState<Person | undefined>(personById(id ?? ''));
  const [status, setStatus] = useState<'ringing' | 'live' | 'ended'>('ringing');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(existingCallId ?? null);
  const makingOffer = useRef(false);
  const endedRef = useRef(false);

  useEffect(() => {
    const cached = personById(id ?? '');
    if (cached) setPerson(cached);
    else if (id) fetchPersonById(id).then((p) => p && setPerson(p));
  }, [id]);

  useEffect(() => {
    if (status !== 'live') return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [status]);

  useEffect(() => {
    if (!userId || !id) return;
    let unsubSignals = () => {};
    let unsubStatus = () => {};

    const hangup = async (next: 'ended' | 'declined' = 'ended') => {
      if (endedRef.current) return;
      endedRef.current = true;
      if (callIdRef.current) await setCallStatus(callIdRef.current, next);
      localRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      pcRef.current = null;
      setStatus('ended');
    };

    const applySignal = async (signal: CallSignal, pc: RTCPeerConnection) => {
      if (signal.fromId === userId) return;
      try {
        if (signal.kind === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as any));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (callIdRef.current) {
            await sendSignal(callIdRef.current, userId, 'answer', answer as any);
            await setCallStatus(callIdRef.current, 'live');
          }
          setStatus('live');
        } else if (signal.kind === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as any));
          if (callIdRef.current) await setCallStatus(callIdRef.current, 'live');
          setStatus('live');
        } else if (signal.kind === 'ice' && signal.payload) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.payload as any));
        }
      } catch {
        // late or duplicate signals are safe to ignore
      }
    };

    (async () => {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: 'user' } : false,
      });
      localRef.current = stream;
      setLocalUrl(stream.toURL());

      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      (pc as any).ontrack = (event: { streams: MediaStream[] }) => {
        const remote = event.streams[0];
        if (remote) setRemoteUrl(remote.toURL());
      };
      (pc as any).onicecandidate = (event: { candidate: any }) => {
        if (event.candidate && callIdRef.current && userId) {
          sendSignal(callIdRef.current, userId, 'ice', event.candidate.toJSON());
        }
      };
      (pc as any).onconnectionstatechange = () => {
        const state = (pc as any).connectionState;
        if (state === 'connected') setStatus('live');
        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          hangup('ended');
        }
      };

      let callId = existingCallId ?? null;
      if (!callId && !isCallee) {
        callId = await startCall(userId, id, isVideo ? 'video' : 'voice');
      }
      if (!callId) return;
      callIdRef.current = callId;

      unsubSignals = subscribeSignals(callId, (signal) => applySignal(signal, pc));
      unsubStatus = subscribeCallStatus(callId, (next) => {
        if (next === 'ended' || next === 'declined') hangup(next);
        if (next === 'live') setStatus('live');
      });

      const already = await fetchSignals(callId);
      for (const signal of already) await applySignal(signal, pc);

      if (!isCallee && !makingOffer.current) {
        makingOffer.current = true;
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        await sendSignal(callId, userId, 'offer', offer as any);
      } else if (isCallee) {
        const row = await fetchCall(callId);
        if (row?.status === 'ended' || row?.status === 'declined') hangup('ended');
      }
    })().catch(() => {
      setStatus('ended');
    });

    return () => {
      unsubSignals();
      unsubStatus();
      if (!endedRef.current) {
        endedRef.current = true;
        if (callIdRef.current) setCallStatus(callIdRef.current, 'ended');
      }
      localRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [userId, id, isVideo, isCallee, existingCallId]);

  useEffect(() => {
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, [muted]);

  useEffect(() => {
    localRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !cameraOff;
    });
  }, [cameraOff]);

  const clock = useMemo(() => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [seconds]);

  const endCall = () => {
    if (callIdRef.current) setCallStatus(callIdRef.current, 'ended');
    router.back();
  };

  if (!person) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>This person is no longer available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {isVideo && remoteUrl && !cameraOff ? (
        <RTCView streamURL={remoteUrl} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <Image source={{ uri: person.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={styles.dim} />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.top}>
          <Text style={styles.kind}>{isVideo ? 'Video call' : 'Voice call'}</Text>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.status}>
            {status === 'ringing' ? (isCallee ? 'Connecting…' : `Calling ${person.name}…`) : clock}
          </Text>
        </View>

        {isVideo && localUrl && !cameraOff ? (
          <RTCView streamURL={localUrl} style={styles.pip} objectFit="cover" mirror />
        ) : (
          <View style={styles.center}>
            <Image source={{ uri: person.photo }} style={styles.bigAvatar} />
            <Text style={styles.hint}>
              {status === 'ringing' ? 'Waiting for them to join' : muted ? 'You are muted' : 'On the line'}
            </Text>
          </View>
        )}

        <View style={styles.controls}>
          <Pressable style={styles.ctrl} onPress={() => setMuted((v) => !v)}>
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color={colors.white} />
            <Text style={styles.ctrlText}>{muted ? 'Unmute' : 'Mute'}</Text>
          </Pressable>
          {isVideo ? (
            <Pressable style={styles.ctrl} onPress={() => setCameraOff((v) => !v)}>
              <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={22} color={colors.white} />
              <Text style={styles.ctrlText}>{cameraOff ? 'Cam on' : 'Cam off'}</Text>
            </Pressable>
          ) : (
            <View style={styles.ctrl} />
          )}
          <Pressable style={[styles.ctrl, styles.end]} onPress={endCall}>
            <Ionicons name="call" size={22} color={colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.ctrlText}>End</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  missing: { color: colors.muted, textAlign: 'center' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,10,0.28)' },
  overlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 18 },
  top: { alignItems: 'center', paddingTop: 8 },
  kind: { color: colors.gold, fontWeight: '700', letterSpacing: 0.4 },
  name: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 6 },
  status: { color: colors.white, opacity: 0.8, marginTop: 4 },
  center: { alignItems: 'center', gap: 14 },
  bigAvatar: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  hint: { color: colors.white, fontSize: 16 },
  pip: {
    alignSelf: 'flex-end',
    width: 118,
    height: 168,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18,10,18,0.72)',
    borderRadius: 28,
    padding: 12,
    marginBottom: 10,
  },
  ctrl: { alignItems: 'center', justifyContent: 'center', width: 88, gap: 6, paddingVertical: 8 },
  ctrlText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  end: { backgroundColor: colors.accent, borderRadius: 22 },
});
