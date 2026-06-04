import { Request, Response } from 'express';
import {
  analyzeDesignIntent,
  evaluateGrid as evaluateGridService,
  generateImageFromPrompt,
  stylizeImage as stylizeImageService,
} from '../services/geminiService';
import type { AnalysisV2 } from '../../../shared/types/index.js';
import {
  consumeGenerateCredit,
  InsufficientCredits,
  refundGenerateCredit,
} from '../services/credits.js';

// ──────────────────────────────────────────────────────────────────────
// Existing endpoints (text→image, legacy analyze)
// ──────────────────────────────────────────────────────────────────────

export async function generateImage(req: Request, res: Response) {
  const user = req.user!;
  try {
    const { prompt, paletteColors } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    // Atomic credit decrement. Throws InsufficientCredits if the user is
    // at 0 — caller gets 402 and can prompt the trade-points modal.
    const credits = await consumeGenerateCredit(user.id, 'AI_GENERATE_IMAGE');
    console.log('[AI] generateImage:', prompt, 'credits→', credits.generateCredits);

    try {
      const imageData = await generateImageFromPrompt(prompt, paletteColors);
      res.json({ image: imageData, credits });
    } catch (err: any) {
      // Refund on upstream failure so the user isn't penalised for our bug.
      await refundGenerateCredit(user.id, `generateImage: ${err.message}`);
      throw err;
    }
  } catch (error: any) {
    if (error instanceof InsufficientCredits) {
      return res.status(402).json({ error: 'Insufficient credits', kind: error.kind });
    }
    console.error('[AI] generateImage error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
}

export async function analyzeDesign(req: Request, res: Response) {
  try {
    const { prompt, imageData } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    console.log('[AI] analyzeDesign:', prompt);
    const analysis = await analyzeDesignIntent(prompt, imageData);
    res.json({ analysis });
  } catch (error: any) {
    console.error('[AI] analyzeDesign error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to analyze design' });
  }
}

// ──────────────────────────────────────────────────────────────────────
// v2: Stylize — image → styled image + analysis
// Always returns 200. On Gemini error, silently falls back to the input
// image + a defaultAnalysis so the client's Engine T still has something
// to chew on.
// ──────────────────────────────────────────────────────────────────────

function defaultAnalysisForFallback(userIntent?: string): AnalysisV2 {
  return {
    subject: userIntent || 'pattern',
    keyFeatures: [],
    paletteSubset: [],    // empty → Engine T falls back to full palette
    autoTools: {
      greyRemoval: false,
      outlineReinforce: false,
      colorSimplify: true,
      skinProtect: false,
      eyeEnhance: false,
      featureProtect: false,
    },
    tuningSeeds: { edgeBias: 0.35, minRegion: 3, mergeThreshold: 30, greyTolerance: 1.4 },
    notes: 'Fallback: AI stylize skipped or failed.',
  };
}

export async function stylize(req: Request, res: Response) {
  const user = req.user!;
  const started = Date.now();
  const {
    imageBase64,
    canvasSize,
    userIntent,
    paletteHexes,
  }: {
    imageBase64: string;
    canvasSize: number;
    userIntent?: string;
    paletteHexes: string[];
  } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64' });
  }

  try {
    const credits = await consumeGenerateCredit(user.id, 'AI_STYLIZE');
    console.log('[AI] stylize:', { canvasSize, hasIntent: !!userIntent, credits: credits.generateCredits });

    const result = await stylizeImageService({
      imageBase64,
      canvasSize: canvasSize || 50,
      userIntent,
      paletteHexes: paletteHexes || [],
    });

    // stylizeImageService never throws — it returns fallback=true. If BOTH
    // sub-calls failed, refund (user didn't get real value).
    if (!result.imageOk && !result.analysisOk) {
      await refundGenerateCredit(user.id, 'stylize: both sub-calls failed');
    }

    console.log('[AI] stylize ok:', { imageOk: result.imageOk, analysisOk: result.analysisOk });
    res.json({
      stylizedImageBase64: result.stylizedImageBase64,
      analysis: result.analysis,
      fallback: !result.imageOk || !result.analysisOk,
      credits,
      elapsedMs: Date.now() - started,
    });
  } catch (error: any) {
    if (error instanceof InsufficientCredits) {
      return res.status(402).json({ error: 'Insufficient credits', kind: error.kind });
    }
    console.error('[AI] stylize crashed unexpectedly:', error.message);
    res.json({
      stylizedImageBase64: imageBase64,
      analysis: defaultAnalysisForFallback(userIntent),
      fallback: true,
      elapsedMs: Date.now() - started,
    });
  }
}

// ──────────────────────────────────────────────────────────────────────
// v2: Evaluate — score a rendered grid
// ──────────────────────────────────────────────────────────────────────

export async function evaluate(req: Request, res: Response) {
  try {
    const { gridPngBase64, subject, currentTuning } = req.body;
    if (!gridPngBase64 || !subject) {
      return res.status(400).json({ error: 'Missing gridPngBase64 or subject' });
    }

    const result = await evaluateGridService({
      gridPngBase64,
      subject,
      currentTuning: currentTuning || {
        edgeBias: 0.35,
        minRegion: 3,
        mergeThreshold: 30,
        greyTolerance: 1.4,
      },
    });
    console.log('[AI] evaluate:', { confidence: result.confidence, issue: result.issue });
    res.json(result);
  } catch (error: any) {
    console.error('[AI] evaluate error:', error.message);
    // Non-fatal: send a neutral confidence so the orchestrator just stops retrying.
    res.json({
      confidence: 0.7,
      reason: `Evaluator error: ${error.message || 'unknown'}`,
    });
  }
}
