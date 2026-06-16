import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { orderRoutes } from './routes/order';
import { productRoutes } from './routes/product';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { patternRoutes } from './routes/patterns';
import { paymentRoutes } from './routes/payments';
import { promoRoutes } from './routes/promo';
import { geoRoutes } from './routes/geo';
import { configRoutes } from './routes/config';
import { mediaRoutes } from './routes/media';
import { UPLOAD_DIR } from './lib/storage';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Behind nginx (Baota/Tencent) the real client IP arrives via X-Forwarded-For.
// Trust the first proxy hop so req.ip + rate limiting + geo lookup are correct.
app.set('trust proxy', 1);

// Security headers (HSTS, noSniff, frameguard, etc.). CSP and cross-origin
// resource policy are relaxed so third-party scripts/images (PayPal, Google,
// product image hosts) keep working — tighten with a CSP allowlist later.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(requestLogger);

// Rate limits — tight on auth (brute-force); lenient elsewhere. Per-IP.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — please wait a moment.' },
});

// Promo signup — tight per-IP cap so the "10% off" form can't be used to
// blast discount emails at arbitrary inboxes.
const promoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later.' },
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promo', promoLimiter, promoRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/config', configRoutes);
app.use('/api/media', mediaRoutes);

// Admin-uploaded files (product images, pattern downloads). Served in dev + prod.
// Filenames are content-unique, so a long immutable cache is safe (Cloudflare CDN).
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[Fusiey] Server running on http://localhost:${PORT}`);
});

// Behind nginx/Cloudflare, Node's default 5s keep-alive lets the upstream reuse
// a connection Node has just closed → intermittent reset surfacing as a 502/520.
// Keep our keep-alive LONGER than the proxy's, with headersTimeout slightly
// above keepAliveTimeout (Node requires this ordering).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

export default app;
