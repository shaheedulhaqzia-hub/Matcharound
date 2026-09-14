/**
 * Matcharound moderation server — free nudity detection with NSFWJS.
 *
 * POST /moderate  { imageBase64: "<jpeg base64>" }
 *   -> { nude: boolean, score: number, scores: { Porn, Hentai, Sexy, Neutral, Drawing } }
 *
 * Runs on Render's free plan (see render.yaml at the repo root).
 * Pure-JS TensorFlow build: no native binaries, slower (~1-3s/image) but reliable.
 */
const express = require('express');
const tf = require('@tensorflow/tfjs');
const nsfwjs = require('nsfwjs');
const Jimp = require('jimp');

const PORT = process.env.PORT || 3000;

// Thresholds: Porn/Hentai are hard violations; Sexy alone needs to be extreme.
const PORN_THRESHOLD = 0.6;
const SEXY_THRESHOLD = 0.92;

let modelPromise = null;
function getModel() {
  if (!modelPromise) modelPromise = nsfwjs.load();
  return modelPromise;
}

async function imageToTensor(buffer) {
  const image = await Jimp.read(buffer);
  image.resize(224, 224);
  const values = new Int32Array(224 * 224 * 3);
  let i = 0;
  image.scan(0, 0, 224, 224, function (x, y, idx) {
    values[i++] = this.bitmap.data[idx];
    values[i++] = this.bitmap.data[idx + 1];
    values[i++] = this.bitmap.data[idx + 2];
  });
  return tf.tensor3d(values, [224, 224, 3], 'int32');
}

const app = express();
app.use(express.json({ limit: '25mb' }));

app.get('/', async (_req, res) => {
  res.json({ ok: true, service: 'matcharound-moderation' });
});

app.post('/moderate', async (req, res) => {
  const { imageBase64 } = req.body ?? {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 required' });
  }
  let tensor = null;
  try {
    const model = await getModel();
    const buffer = Buffer.from(imageBase64, 'base64');
    tensor = await imageToTensor(buffer);
    const predictions = await model.classify(tensor);
    const scores = {};
    for (const p of predictions) scores[p.className] = Number(p.probability.toFixed(4));
    const porn = (scores.Porn ?? 0) + (scores.Hentai ?? 0);
    const sexy = scores.Sexy ?? 0;
    const nude = porn >= PORN_THRESHOLD || sexy >= SEXY_THRESHOLD;
    const score = Math.max(porn, sexy);
    res.json({ nude, score: Number(score.toFixed(4)), scores });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  } finally {
    if (tensor) tensor.dispose();
  }
});

app.listen(PORT, () => {
  console.log(`Matcharound moderation listening on :${PORT}`);
  getModel().then(
    () => console.log('NSFW model loaded'),
    (e) => console.error('Model load failed', e)
  );
});
