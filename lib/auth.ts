import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'google';

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

/**
 * Normalize a phone number to "+<digits>" (or plain digits when no +).
 * Returns null when it doesn't look like a real phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (trimmed.startsWith('+') ? '+' : '') + digits;
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
  return finishOAuthInBrowser(data.url, redirectTo);
}

/** Open the provider page in a browser and turn the redirect into a session. */
async function finishOAuthInBrowser(authUrl: string, redirectTo: string): Promise<boolean> {
  if (!supabase) throw new Error('Backend not configured');
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
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

// ---------- One account, many sign-in methods ----------

export type LinkedIdentity = { provider: string; email: string | null };

/** Which sign-in methods are attached to the current account. */
export async function getLinkedIdentities(): Promise<LinkedIdentity[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data?.identities) return [];
  return data.identities.map((i) => ({
    provider: String(i.provider),
    email: i.identity_data?.email ? String(i.identity_data.email) : null,
  }));
}

/**
 * Attach another sign-in method (Google / Facebook / X) to the CURRENT
 * account, so the user always has one single Matcharound account.
 */
export async function linkProvider(provider: SocialProvider): Promise<boolean> {
  if (!supabase) throw new Error('Backend not configured');
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No auth URL returned');
  return finishOAuthInBrowser(data.url, redirectTo);
}

/**
 * Let social sign-ups add a password, so they can also sign in with
 * email + password later.
 */
export async function setPassword(newPassword: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ---------- Passwordless: email OTP code (free) ----------

/** Email a 6-digit sign-in code (works for existing accounts). */
export async function requestEmailOtp(email: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

/** Verify the emailed code and sign in. */
export async function verifyEmailOtp(email: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
}

/** Permanently delete the signed-in user's account (store policy requirement). */
export async function deleteMyAccount(): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.rpc('delete_me');
  if (error) throw error;
  await supabase.auth.signOut();
}
