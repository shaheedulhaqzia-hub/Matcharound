// Matcharound nudity detection — Supabase Edge Function (free, no card).
//
// Calls Hugging Face's free NSFW image classifier. Requires one secret:
//   HF_TOKEN = a free "Read" token from https://huggingface.co/settings/tokens
//
// Deploy (no CLI needed): Supabase Dashboard -> Edge Functions -> Deploy new
// function -> "Via Editor" -> name it exactly  moderate-image  -> paste this
// file -> Deploy. Then add HF_TOKEN under Edge Functions -> Secrets.
//
// POST { imageBase64: "<jpeg base64>" }
//   -> { nude: boolean, score: number, scores: Record<string, number> }

const HF_MODEL = 'Falconsai/nsfw_image_detection';
const HF_URLS = [
  `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
  `https://api-inference.huggingface.co/models/${HF_MODEL}`,
];
const NSFW_THRESHOLD = 0.7;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/^data:image\/\w+;base64,/, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const token = Deno.env.get('HF_TOKEN');
    if (!token) {
      return Response.json({ error: 'HF_TOKEN secret not set' }, { status: 500, headers: corsHeaders });
    }
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return Response.json({ error: 'imageBase64 required' }, { status: 400, headers: corsHeaders });
    }
    const bytes = base64ToBytes(imageBase64);

    let lastError = 'unreachable';
    for (const url of HF_URLS) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
      });
      if (!res.ok) {
        lastError = `${res.status} ${await res.text()}`;
        continue;
      }
      const predictions = (await res.json()) as { label: string; score: number }[];
      const scores: Record<string, number> = {};
      for (const p of predictions) scores[p.label] = Number(p.score.toFixed(4));
      const nsfwScore = scores['nsfw'] ?? 0;
      return Response.json(
        {
          nude: nsfwScore >= NSFW_THRESHOLD,
          score: nsfwScore,
          scores,
        },
        { headers: corsHeaders }
      );
    }
    return Response.json({ error: lastError }, { status: 502, headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500, headers: corsHeaders });
  }
});
