import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export type PickedImage = { base64: string; uri: string };

export async function pickImage(aspect?: [number, number]): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect,
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  return { base64: asset.base64 as string, uri: asset.uri };
}

/** Upload a base64 JPEG to a storage bucket. Returns the public URL. */
export async function uploadImage(
  bucket: 'avatars' | 'covers' | 'gallery' | 'chat-images' | 'moderation',
  userId: string,
  base64: string
): Promise<string> {
  if (!supabase) throw new Error('Backend not configured');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, decode(base64), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  if (bucket === 'moderation') return path; // private bucket: return the object path only
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
