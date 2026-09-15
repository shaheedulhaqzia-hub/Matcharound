import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://eiejjiywdxtqunwcfugy.supabase.co';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_-Ag-hHqeAOf8MtchjMmwOg_ELf1EOWe';

export const supabaseReady = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseReady
  ? createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: {
        headers: {
          apikey: key,
        },
      },
    })
  : null;
