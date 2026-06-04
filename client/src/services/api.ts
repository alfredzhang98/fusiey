import type {
  AnalysisV2,
  Color,
  EvaluateResponse,
  StylizeResponse,
  TuningSeeds,
} from '../types';

const API_BASE = '/api';

/** Thrown by `request()` on non-2xx responses. Carries status so callers
 *  can branch on 401 (show login) / 402 (show credit modal) / 409, etc. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // send/receive httpOnly auth cookies
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) return undefined as unknown as T;
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};

  if (!res.ok) {
    throw new ApiError(res.status, data.error || `HTTP ${res.status}`, data);
  }
  return data as T;
}

// ──────────────────────────────────────────────────────────────────────
// Legacy endpoints — still used for text→image generation when the user
// provides only a prompt and no uploaded image.
// ──────────────────────────────────────────────────────────────────────

export async function generateImage(prompt: string, paletteColors?: Color[]) {
  return request<{ image: string }>('/ai/generate-image', {
    method: 'POST',
    body: JSON.stringify({ prompt, paletteColors }),
  });
}

export async function analyzeDesign(prompt: string, imageData?: string) {
  return request<{ analysis: unknown }>('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({ prompt, imageData }),
  });
}

// ──────────────────────────────────────────────────────────────────────
// v2 pipeline endpoints
// ──────────────────────────────────────────────────────────────────────

export type StyleKey = 'cartoon' | 'pixel-realistic';

export interface StylizeArgs {
  imageBase64: string;          // data URL or raw base64
  style: StyleKey;
  canvasSize: number;           // 50 for now
  userIntent?: string;
  paletteHexes: string[];       // hex list passed as a soft constraint to Gemini
}

/**
 * Agent S — Gemini image-edit + structured analysis.
 * Server always returns 200; on failure `fallback === true` and
 * `stylizedImageBase64` is the original input image.
 */
export function stylizeImage(args: StylizeArgs) {
  return request<StylizeResponse>('/ai/stylize', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export interface EvaluateArgs {
  gridPngBase64: string;
  subject: string;
  currentTuning: TuningSeeds;
}

/**
 * Agent E — score a rendered grid against the original subject.
 * Used by the retry orchestrator; on Gemini error the server returns
 * a neutral 0.7 confidence so the loop just exits.
 */
export function evaluateGrid(args: EvaluateArgs) {
  return request<EvaluateResponse>('/ai/evaluate', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

// Convenience re-export so ControlPanel only imports from one place.
export type { AnalysisV2, EvaluateResponse, StylizeResponse, TuningSeeds };

// ──────────────────────────────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPERADMIN';
  generateCredits: number;
  communityPoints: number;
  avatarUrl: string | null;
  emailVerified: boolean;
  namingCounter: number;
  createdAt: string;
  updatedAt: string;
}

export const authApi = {
  register: (body: { email: string; password: string; name: string }) =>
    request<{ user: PublicUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ user: PublicUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  google: (credential: string) =>
    request<{ user: PublicUser }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  me: () => request<{ user: PublicUser }>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

// ──────────────────────────────────────────────────────────────────────
// Patterns
// ──────────────────────────────────────────────────────────────────────

export interface PatternSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  paletteId: string;
  thumbnail: string | null;
  source: 'AI' | 'MANUAL';
  isPublished: boolean;
  publishedAt: string | null;
  downloadCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatternDetail extends PatternSummary {
  grid: Array<Array<{ colorId: string | null; originalColor?: string }>>;
  beadSize: number;
  aiImageData: string | null;
  stats: any;
  version: number;
}

export interface PatternCreateInput {
  name?: string;
  width: number;
  height: number;
  grid: PatternDetail['grid'];
  paletteId: string;
  beadSize?: number;
  thumbnail?: string;
  source?: 'AI' | 'MANUAL';
  aiImageData?: string;
  stats?: any;
}

export const patternsApi = {
  create: (body: PatternCreateInput) =>
    request<{ pattern: PatternSummary }>('/patterns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  list: () => request<{ patterns: PatternSummary[] }>('/patterns'),
  get: (id: string) => request<{ pattern: PatternDetail }>(`/patterns/${id}`),
  patch: (id: string, body: Partial<PatternCreateInput> & { version?: number }) =>
    request<{ pattern: PatternSummary }>(`/patterns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: string) => request<void>(`/patterns/${id}`, { method: 'DELETE' }),
};
