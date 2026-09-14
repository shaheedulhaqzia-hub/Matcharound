import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { AppProvider, useApp } from '@/context/AppContext';
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
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen
            name="call/[id]"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
        </Stack>
      </ThemeProvider>
    </AppProvider>
  );
}
