import { z } from 'zod';

// ============================================
// Bead Pattern Types (shared between client & server)
// ============================================

export const ColorSchema = z.object({
  id: z.string(),
  name: z.string(),
  hex: z.string(),
  code: z.string().optional(),
  brand: z.string().optional(),
  // Semantic markers — used by beadEngineV2 Stage 2/3 to gate candidates
  // per cell. All optional; unmarked palettes still work (just no guards).
  isSkin: z.boolean().optional(),  // natural-skin tones (E2, G1, G9 …)
  isGrey: z.boolean().optional(),  // neutral greys H2-H5 (not white/black)
  isInk: z.boolean().optional(),   // outline-suitable deep tones (H5, H7)
  isDark: z.boolean().optional(),  // L* < 40 (incl. ink)
});

export type Color = z.infer<typeof ColorSchema>;

export const PaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.array(ColorSchema),
});

export type Palette = z.infer<typeof PaletteSchema>;

export const GridCellSchema = z.object({
  colorId: z.string().nullable(),
  originalColor: z.string().optional(),
});

export type GridCell = z.infer<typeof GridCellSchema>;

export const PatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  grid: z.array(z.array(GridCellSchema)),
  paletteId: z.string(),
  beadSize: z.number(),
});

export type Pattern = z.infer<typeof PatternSchema>;

export const AIAnalysisSchema = z.object({
  subject: z.string(),
  style: z.string(),
  recommended_palette_family: z.string(),
  recommended_max_colors: z.number(),
  focus_regions: z.array(z.string()),
  simplification_rules: z.array(z.string()),
  notes: z.string(),
});

export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;

// ============================================
// BeadEngine v2 — Stylize + Analyze schemas
// ============================================

/** Numerical knobs Engine T consumes and Evaluator may tweak on retry. */
export const TuningSeedsSchema = z.object({
  edgeBias: z.number().min(0).max(1),          // Stage 1 mean/dominant mix
  minRegion: z.number().min(1).max(10),        // Stage 4 BFS threshold
  mergeThreshold: z.number().min(5).max(80),   // Stage 3 colour-merge LAB distance
  greyTolerance: z.number().min(0.8).max(3),   // Stage 2 non-grey preference factor
});
export type TuningSeeds = z.infer<typeof TuningSeedsSchema>;

/** Which post-processing passes should run. AI decides per image. */
export const AutoToolsSchema = z.object({
  greyRemoval: z.boolean(),
  outlineReinforce: z.boolean(),
  colorSimplify: z.boolean(),
  skinProtect: z.boolean(),
  eyeEnhance: z.boolean(),
  featureProtect: z.boolean(),
});
export type AutoTools = z.infer<typeof AutoToolsSchema>;

/** Normalised 0-1 bbox: [x, y, w, h]. */
export const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type BBox = z.infer<typeof BBoxSchema>;

/** Structured analysis produced by Gemini Stylize (or defaultAnalysis on fallback). */
export const AnalysisV2Schema = z.object({
  subject: z.string(),
  keyFeatures: z.array(z.string()).default([]),
  paletteSubset: z.array(z.string()),              // palette colour IDs
  skinBbox: BBoxSchema.optional(),
  eyeBboxes: z.array(BBoxSchema).optional(),
  focusRegions: z.array(z.string()).optional(),
  autoTools: AutoToolsSchema,
  tuningSeeds: TuningSeedsSchema,
  notes: z.string().default(''),
});
export type AnalysisV2 = z.infer<typeof AnalysisV2Schema>;

/** Stylize endpoint response — always 200, fallback flag signals degradation. */
export const StylizeResponseSchema = z.object({
  stylizedImageBase64: z.string(),
  analysis: AnalysisV2Schema,
  fallback: z.boolean(),
  elapsedMs: z.number(),
});
export type StylizeResponse = z.infer<typeof StylizeResponseSchema>;

/** Evaluator response. */
export const EvaluateResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  issue: z.enum([
    'too_grey',
    'fragmented',
    'lost_eyes',
    'weak_edges',
    'wrong_colors',
    'unrecognizable',
  ]).optional(),
  tuningHint: TuningSeedsSchema.partial().optional(),
  reason: z.string(),
});
export type EvaluateResponse = z.infer<typeof EvaluateResponseSchema>;

// ============================================
// User & Auth Types
// ============================================

export const UserRoleSchema = z.enum(['customer', 'admin', 'superadmin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  createdAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;

// ============================================
// Order Types
// ============================================

export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  patternId: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  customisation: z.record(z.string()).optional(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(OrderItemSchema),
  status: OrderStatusSchema,
  totalAmount: z.number(),
  currency: z.literal('GBP'),
  shippingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    county: z.string().optional(),
    postcode: z.string(),
    country: z.literal('GB'),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;

// ============================================
// Product Types
// ============================================

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  currency: z.literal('GBP'),
  images: z.array(z.string()),
  category: z.string(),
  stock: z.number(),
  isCustomisable: z.boolean(),
  tags: z.array(z.string()),
});

export type Product = z.infer<typeof ProductSchema>;

// ============================================
// Payment Types
// ============================================

export const PaymentMethodSchema = z.enum(['stripe', 'paypal']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStatusSchema = z.enum(['pending', 'succeeded', 'failed', 'refunded']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
