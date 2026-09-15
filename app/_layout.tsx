import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { AppProvider, useApp } from '@/context/AppContext';
import { bioAuthenticate, isBioLockEnabled } from '@/lib/biolock';
import { setCallStatus, subscribeIncomingCalls } from '@/lib/calls';
import { fetchPersonById } from '@/lib/db';
import { colors } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.accent,
    text: colors.text,
    border: colors.line,
  },
};

/** Routes users based on auth state: welcome, complete profile, banned, or app. */
function AuthGate() {
  const { authStatus } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'loading') return;
    const first = segments[0] as string | undefined;
    const inAuth = first === '(auth)';
    if (authStatus === 'signedOut' && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (authStatus === 'needsProfile' && first !== 'complete-profile') {
      router.replace('/complete-profile');
    } else if (authStatus === 'banned' && first !== 'banned') {
      router.replace('/banned');
    } else if (
      (authStatus === 'ready' || authStatus === 'demo') &&
      (inAuth || first === 'complete-profile' || first === 'banned')
    ) {
      router.replace('/(tabs)');
    }
  }, [authStatus, segments, router]);

  return null;
}

/** Rings the callee when someone starts a live voice or video call. */
function IncomingCallWatcher() {
  const { userId, authStatus } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (authStatus !== 'ready' || !userId) return;
    return subscribeIncomingCalls(userId, async (call) => {
      const person = await fetchPersonById(call.fromId);
      const name = person?.name ?? 'Someone';
      Alert.alert(
        call.mode === 'video' ? 'Incoming video call' : 'Incoming voice call',
        `${name} is calling you.`,
        [
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => setCallStatus(call.id, 'declined'),
          },
          {
            text: 'Accept',
            onPress: () =>
              router.push(
                `/call/${call.fromId}?mode=${call.mode}&callId=${call.id}&incoming=1` as Href
              ),
          },
        ]
      );
    });
  }, [authStatus, userId, router]);

  return null;
}

/** Fingerprint / face quick-unlock overlay (shown once per app open when enabled). */
function BioLockGate() {
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    isBioLockEnabled().then((enabled) => setLocked(enabled ? true : false));
  }, []);

  useEffect(() => {
    if (locked) tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked === true]);

  const tryUnlock = async () => {
    const ok = await bioAuthenticate();
    if (ok) setLocked(false);
  };

  if (!locked) return null;
  return (
    <View style={lockStyles.overlay}>
      <Ionicons name="finger-print" size={64} color={colors.accent} />
      <Text style={lockStyles.title}>Matcharound is locked</Text>
      <Pressable style={lockStyles.btn} onPress={tryUnlock}>
        <Text style={lockStyles.btnText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    zIndex: 1000,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 13,
  },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AppProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <AuthGate />
        <IncomingCallWatcher />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="complete-profile" options={{ animation: 'fade' }} />
          <Stack.Screen name="banned" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="group/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen
            name="call/[id]"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
        </Stack>
        <BioLockGate />
      </ThemeProvider>
    </AppProvider>
  );
}
