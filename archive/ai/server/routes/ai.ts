import { Router } from 'express';
import {
  analyzeDesign,
  evaluate,
  generateImage,
  stylize,
} from '../controllers/aiController';
import { requireAuth } from '../middleware/auth.js';

export const aiRoutes = Router();

// Every AI call is auth-gated. The controllers also run atomic credit
// consumption for the user-triggered endpoints (generate-image, stylize);
// analyze / evaluate are cheap auxiliary calls so we only gate on auth.
aiRoutes.use(requireAuth);

// POST /api/ai/generate-image — text → image. Consumes 1 credit.
aiRoutes.post('/generate-image', generateImage);

// POST /api/ai/analyze — image+text → AIAnalysis JSON (legacy v1).
aiRoutes.post('/analyze', analyzeDesign);

// POST /api/ai/stylize — image → stylised image + AnalysisV2 JSON.
// Consumes 1 credit.
aiRoutes.post('/stylize', stylize);

// POST /api/ai/evaluate — grid render + subject → confidence hint.
aiRoutes.post('/evaluate', evaluate);
