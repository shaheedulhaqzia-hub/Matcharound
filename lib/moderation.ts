import { supabase } from './supabase';
import { uploadImage } from './upload';

/**
 * Nudity moderation pipeline.
 *
 * Every photo (chat image, gallery post, profile/cover photo) and periodic
 * video-call frames run through checkImage(). When nudity is detected:
 *   1. the offending image is saved to the PRIVATE 'moderation' bucket (proof),
 *   2. ban_me() marks the account banned (operator can review + unban),
 *   3. the user is signed out immediately.
 *
 * The detector is a free self-hosted NSFWJS server (see server/ + render.yaml).
 * Set EXPO_PUBLIC_MODERATION_URL to its base URL. If the detector is not
 * deployed or unreachable, images are allowed but marked 'unchecked' so the
 * operator can review them manually.
 */

const MODERATION_URL = process.env.EXPO_PUBLIC_MODERATION_URL ?? '';

export type ModerationResult = {
  checked: boolean;
  nude: boolean;
  score: number;
};

export type ModerationSource =
  | 'chat_image'
  | 'gallery_image'
  | 'profile_photo'
  | 'cover_photo'
  | 'video_call_frame';

export async function checkImage(base64: string): Promise<ModerationResult> {
  // 1st choice: the 'moderate-image' Supabase Edge Function (free, no card).
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('moderate-image', {
        body: { imageBase64: base64 },
      });
      if (!error && data && typeof data.nude === 'boolean') {
        return { checked: true, nude: data.nude, score: Number(data.score ?? 0) };
      }
    } catch {
      // fall through to the optional self-hosted detector
    }
  }
  // 2nd choice: optional self-hosted NSFWJS server (server/ folder).
  if (!MODERATION_URL) return { checked: false, nude: false, score: 0 };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(`${MODERATION_URL.replace(/\/$/, '')}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { checked: false, nude: false, score: 0 };
    const json = (await res.json()) as { nude?: boolean; score?: number };
    return { checked: true, nude: Boolean(json.nude), score: Number(json.score ?? 0) };
  } catch {
    return { checked: false, nude: false, score: 0 };
  }
}

/**
 * Save proof, then auto-ban the current user.
 * The session stays alive so the app can show the "account banned" screen;
 * RLS blocks all posting/liking/following for banned accounts.
 */
export async function banCurrentUser(
  userId: string,
  source: ModerationSource,
  proofBase64: string,
  score: number
): Promise<void> {
  if (!supabase) return;
  let proofPath: string | null = null;
  try {
    proofPath = await uploadImage('moderation', userId, proofBase64);
  } catch {
    proofPath = null; // ban proceeds even if the proof upload fails
  }
  await supabase.rpc('ban_me', {
    p_reason: 'Nudity detected automatically',
    p_source: source,
    p_proof_path: proofPath,
    p_score: score,
  });
}

export type ModerationVerdict = 'safe' | 'banned' | 'unchecked';

/**
 * Run the full pipeline for one image.
 * Returns 'banned' when the user was auto-banned (caller must stop everything).
 */
export async function moderateImage(
  userId: string,
  base64: string,
  source: ModerationSource
): Promise<ModerationVerdict> {
  const result = await checkImage(base64);
  if (result.checked && result.nude) {
    await banCurrentUser(userId, source, base64, result.score);
    return 'banned';
  }
  return result.checked ? 'safe' : 'unchecked';
}
