import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'google' | 'facebook' | 'twitter';

export function ageFromDob(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Parse DD / MM / YYYY inputs. Returns null when invalid. */
export function parseDob(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < 1900 || y > new Date().getFullYear()) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * OAuth sign-in (Google / Facebook / X) through Supabase.
 * Each provider must be enabled once in the Supabase dashboard
 * (Authentication -> Providers) with its own free developer app.
 */
export async function signInWithProvider(provider: SocialProvider) {
  if (!supabase) throw new Error('Backend not configured');
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No auth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return false;

  const returned = new URL(result.url);
  const code = returned.searchParams.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return true;
  }
  const fragment = new URLSearchParams(returned.hash.replace(/^#/, ''));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return true;
  }
  return false;
}
