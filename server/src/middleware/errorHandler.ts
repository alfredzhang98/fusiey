import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Upload errors (multer) — return a clear status instead of a generic 500.
  // Most common: a file exceeds the configured size limit (LIMIT_FILE_SIZE).
  if (err instanceof MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large for upload.' :
      err.code === 'LIMIT_FILE_COUNT' ? 'Too many files in one upload.' :
      err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Unexpected file field.' :
      'Upload failed.';
    console.error('[Upload error]', err.code, err.message);
    return res.status(status).json({ error: message });
  }

  console.error('[Error]', err.message);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
