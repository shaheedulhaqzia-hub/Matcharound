import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { personById } from '@/lib/people';
import { colors } from '@/lib/theme';
import type { CallMode } from '@/lib/types';

export default function CallScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: CallMode }>();
  const router = useRouter();
  const person = personById(id ?? '');
  const isVideo = (mode ?? 'video') === 'video';
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'live'>('connecting');

  useEffect(() => {
    if (isVideo && permission && !permission.granted) {
      requestPermission();
    }
  }, [isVideo, permission, requestPermission]);

  useEffect(() => {
    const connect = setTimeout(() => setStatus('live'), 1400);
    return () => clearTimeout(connect);
  }, []);

  useEffect(() => {
    if (status !== 'live') return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [status]);

  const clock = useMemo(() => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [seconds]);

  if (!person) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Call ended — this person is no longer nearby.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {isVideo && permission?.granted && !cameraOff ? (
        <CameraView style={StyleSheet.absoluteFill} facing={facing} mute={muted} />
      ) : (
        <Image source={{ uri: person.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={styles.dim} />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.top}>
          <Text style={styles.kind}>{isVideo ? 'Video call' : 'Voice call'}</Text>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.status}>{status === 'connecting' ? 'Connecting nearby…' : clock}</Text>
        </View>

        {!isVideo || cameraOff ? (
          <View style={styles.center}>
            <Image source={{ uri: person.photo }} style={styles.bigAvatar} />
            <Text style={styles.hint}>
              {status === 'connecting' ? `Calling ${person.name}` : muted ? 'You are muted' : 'On the line'}
            </Text>
          </View>
        ) : (
          <View style={styles.pip}>
            <Image source={{ uri: person.photo }} style={styles.pipImage} />
            <Text style={styles.pipLabel}>{person.name}</Text>
          </View>
        )}

        <View style={styles.controls}>
          <Pressable style={styles.ctrl} onPress={() => setMuted((v) => !v)}>
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color={colors.white} />
            <Text style={styles.ctrlText}>{muted ? 'Unmute' : 'Mute'}</Text>
          </Pressable>
          {isVideo ? (
            <>
              <Pressable style={styles.ctrl} onPress={() => setCameraOff((v) => !v)}>
                <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={22} color={colors.white} />
                <Text style={styles.ctrlText}>{cameraOff ? 'Cam on' : 'Cam off'}</Text>
              </Pressable>
              <Pressable style={styles.ctrl} onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}>
                <Ionicons name="camera-reverse" size={22} color={colors.white} />
                <Text style={styles.ctrlText}>Flip</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.ctrl} onPress={() => setSpeaker((v) => !v)}>
              <Ionicons name={speaker ? 'volume-high' : 'volume-mute'} size={22} color={colors.white} />
              <Text style={styles.ctrlText}>{speaker ? 'Speaker' : 'Earpiece'}</Text>
            </Pressable>
          )}
          <Pressable style={[styles.ctrl, styles.end]} onPress={() => router.back()}>
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
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,10,0.38)' },
  overlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 18 },
  top: { alignItems: 'center', paddingTop: 8 },
  kind: { color: colors.gold, fontWeight: '700', letterSpacing: 0.4 },
  name: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 6 },
  status: { color: colors.white, opacity: 0.8, marginTop: 4 },
  center: { alignItems: 'center', gap: 14 },
  bigAvatar: { width: 168, height: 168, borderRadius: 84, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
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
  pipImage: { width: '100%', height: '100%' },
  pipLabel: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18,10,18,0.72)',
    borderRadius: 28,
    padding: 12,
    marginBottom: 10,
  },
  ctrl: { alignItems: 'center', justifyContent: 'center', width: 68, gap: 6, paddingVertical: 8 },
  ctrlText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  end: { backgroundColor: colors.accent, borderRadius: 22 },
});
