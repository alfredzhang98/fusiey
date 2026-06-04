/**
 * Replicate API client — currently used for one job only:
 * background removal via 851-labs/background-remover (RMBG-2.0).
 *
 * Replicate's `run()` blocks until the model returns. RMBG-2.0 finishes in
 * 2-5 seconds typically, well within our existing ~15s stylize budget, so we
 * do NOT need a webhook. The total Generate-Pattern flow becomes:
 *
 *   Gemini stylize (~10-15s)  →  Replicate RMBG (~3-5s)  →  Engine T (<1s)
 *
 * If REPLICATE_API_TOKEN is not set we silently degrade — `removeBackground`
 * throws and the caller keeps the white-background image (client-side
 * flood-fill heuristic still runs as fallback).
 */
import Replicate from 'replicate';

// Pinned model + version to keep behaviour reproducible across deploys.
// (Replicate model strings include the version hash after the colon.)
const RMBG_MODEL =
  '851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc' as const;

let cached: Replicate | null = null;

function getClient(): Replicate {
  if (cached) return cached;
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not set');
  }
  cached = new Replicate({ auth: token });
  return cached;
}

export function isReplicateAvailable(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

/**
 * Strip the background of `imageBase64` (data URL or raw base64) and return
 * a transparent-background PNG as a base64 data URL.
 *
 * Throws on:
 *   - missing API token
 *   - network / Replicate failure
 *   - unexpected output shape
 *
 * Caller is expected to catch and degrade (keep original image).
 */
export async function removeBackground(imageBase64: string): Promise<string> {
  const client = getClient();

  // Replicate accepts http(s) URL or base64 data URI in `image`. We pass the
  // data URI directly to avoid an extra hosting round-trip.
  const dataUri = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  const output = await client.run(RMBG_MODEL, {
    input: {
      image: dataUri,
      format: 'png',
      reverse: false,        // false = remove background (keep subject)
      threshold: 0,          // 0 = use model's default soft alpha
      background_type: 'rgba', // emit transparent PNG
    },
  });

  // Replicate JS SDK >= 1.0 returns either a string URL or a FileOutput
  // wrapper depending on the model. Handle both shapes.
  const url = await extractUrl(output);
  if (!url) {
    throw new Error(`Unexpected Replicate output shape: ${JSON.stringify(output).slice(0, 200)}`);
  }

  // Fetch the result and re-encode as base64 — keeps the rest of the
  // pipeline decoupled from any specific URL host.
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch RMBG result (${res.status} ${res.statusText})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function extractUrl(output: unknown): Promise<string | null> {
  if (!output) return null;
  if (typeof output === 'string') return output;
  // FileOutput-like (has a .url() method or thenable url())
  const obj = output as { url?: unknown };
  if (typeof obj.url === 'function') {
    const u = (obj.url as () => unknown)();
    return typeof u === 'string' ? u : (await Promise.resolve(u)) as string;
  }
  if (typeof obj.url === 'string') return obj.url;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}
