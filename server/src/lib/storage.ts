/**
 * Local-disk file storage for admin uploads (product images + pattern files).
 *
 * Files live under UPLOAD_DIR (default <repoRoot>/uploads) and are served by
 * Express at `/uploads/...`. In production set UPLOAD_DIR to a path OUTSIDE the
 * deploy tree (e.g. /var/fusiey/uploads) so re-clones/redeploys don't wipe it.
 *
 * Stored URLs are always the relative public path `/uploads/...` so they work
 * behind any host/CDN (Cloudflare). Filenames are content-unique (random
 * suffix) so a CDN can cache them immutably — never reuse a name for new bytes.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');

/** Absolute root of the upload store. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(repoRoot, 'uploads');

/** Make a path segment filesystem-safe (lowercase slug, no traversal). */
export function slug(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

/** Random short token to make filenames content-unique. */
function token(): string {
  return crypto.randomBytes(6).toString('hex');
}

/** Build a collision-safe filename: <slug-of-original>-<token>.<ext>. */
export function safeFilename(originalName: string, fallbackExt = ''): string {
  const ext = (path.extname(originalName) || fallbackExt).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const base = slug(path.basename(originalName, path.extname(originalName)));
  return `${base}-${token()}${ext}`;
}

/** Ensure a directory exists (recursive). Returns the absolute path. */
export function ensureDir(absDir: string): string {
  fs.mkdirSync(absDir, { recursive: true });
  return absDir;
}

/** Absolute dir for a product media folder: uploads/products/<category>/<code>. */
export function productFolderDir(category: string, code: string): string {
  return path.join(UPLOAD_DIR, 'products', slug(category), slug(code));
}

/** Absolute dir for a pattern file: uploads/patterns/<key>. */
export function patternFolderDir(key: string): string {
  return path.join(UPLOAD_DIR, 'patterns', slug(key));
}

/** Convert an absolute path under UPLOAD_DIR to its public `/uploads/...` URL. */
export function publicUrl(absPath: string): string {
  const rel = path.relative(UPLOAD_DIR, absPath).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

/** Resolve a stored `/uploads/...` URL back to an absolute path (for deletes). */
export function absFromPublicUrl(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null;
  const rel = url.slice('/uploads/'.length);
  const abs = path.resolve(UPLOAD_DIR, rel);
  // Guard against path traversal — must stay inside UPLOAD_DIR.
  if (!abs.startsWith(UPLOAD_DIR)) return null;
  return abs;
}
