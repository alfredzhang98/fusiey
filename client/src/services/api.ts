import { compressImage } from '../utils/imageCompress';

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

/** Multipart upload — must NOT set Content-Type (browser adds the boundary). */
async function uploadRequest<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (res.status === 204) return undefined as unknown as T;
  const data = (res.headers.get('content-type') || '').includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};
  if (!res.ok) throw new ApiError(res.status, data.error || `HTTP ${res.status}`, data);
  return data as T;
}

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
  hasPassword: boolean;
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
  updateProfile: (body: { name?: string; email?: string }) =>
    request<{ user: PublicUser }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Request a 6-digit password-reset code by email (always returns success). */
  forgotPassword: (email: string) =>
    request<{ success: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  /** Complete a reset with the emailed code + a new password. */
  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    request<{ success: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  refresh: () => request<void>('/auth/refresh', { method: 'POST' }),
};

// ──────────────────────────────────────────────────────────────────────
// Promo / marketing
// ──────────────────────────────────────────────────────────────────────

export const promoApi = {
  /** Sign up for the "10% off your first kit" code (homepage email capture). */
  welcome: (email: string) =>
    request<{ success: boolean }>('/promo/welcome', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

// ──────────────────────────────────────────────────────────────────────
// Site config (public reads)
// ──────────────────────────────────────────────────────────────────────

export interface ShippingRule { freeOver: number; fee: number }
export type ShippingConfig = { GBP: ShippingRule; USD: ShippingRule };

export interface SiteConfig {
  welcomeDiscountPercent: number;
  announcement: { enabled: boolean; text: string };
  tiktokUrl: string;
}

export const configApi = {
  /** Public shipping rules (free-shipping threshold + fee) per region. */
  shipping: () => request<ShippingConfig>('/config/shipping'),
  /** Public storefront settings (welcome %, announcement, TikTok URL). */
  site: () => request<SiteConfig>('/config/site'),
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
  thumbnail?: string | null; // not sent in list payloads — use the /thumbnail endpoint
  source: 'AI' | 'MANUAL' | 'OFFICIAL';
  isPurchased?: boolean;
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

export interface PatternPurchase {
  id: string;
  productId: string;
  name: string;
  fileUrl: string;
  fileType: 'pdf' | 'png';
  createdAt: string;
}

export const patternsApi = {
  create: (body: PatternCreateInput) =>
    request<{ pattern: PatternSummary }>('/patterns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  list: (params?: { page?: number; limit?: number; purchased?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.purchased !== undefined) qs.set('purchased', String(params.purchased));
    const query = qs.toString();
    return request<{ patterns: PatternSummary[]; total: number; page: number; totalPages: number }>(
      `/patterns${query ? `?${query}` : ''}`,
    );
  },
  /** Non-certified (download) pattern purchases shown in My Works. */
  purchases: () => request<{ purchases: PatternPurchase[] }>('/patterns/purchases'),
  /** URL of a pattern's cached thumbnail image (used as <img src>). */
  thumbnailUrl: (id: string) => `/api/patterns/${id}/thumbnail`,
  get: (id: string) => request<{ pattern: PatternDetail }>(`/patterns/${id}`),
  patch: (id: string, body: Partial<PatternCreateInput> & { version?: number }) =>
    request<{ pattern: PatternSummary }>(`/patterns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: string) => request<void>(`/patterns/${id}`, { method: 'DELETE' }),
};

// ──────────────────────────────────────────────────────────────────────
// Products (public + admin)
// ──────────────────────────────────────────────────────────────────────

export interface ProductItem {
  id: string;
  sku?: string | null;
  name: string;
  description: string;
  /** GBP retail price (VAT-incl). Always present — base + settlement currency. */
  priceGBP: number;
  /** USD retail price; null = product is not sold in the US region. */
  priceUSD: number | null;
  images: string[];
  category: string;
  stock: number;
  lowStockThreshold: number;
  isCustomisable: boolean;
  isDigital: boolean;
  isActive: boolean;
  tags: string[];
  // Pattern deliverables (pattern category only).
  isCertifiedPattern?: boolean;
  patternFileUrl?: string | null;   // admin responses only; null publicly
  patternFileType?: 'pdf' | 'png' | null;
  hasPatternData?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Certified-pattern JSON shape (matches the SavedPattern grid). */
export interface PatternData {
  name?: string;
  width: number;
  height: number;
  grid: Array<Array<{ colorId: string | null; originalColor?: string }>>;
  paletteId: string;
  beadSize?: number;
  thumbnail?: string;
}

export type ProductWriteBody = Partial<Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt' | 'hasPatternData'>> & {
  patternData?: PatternData | null;
};

export interface ProductListResponse {
  products: ProductItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const productsApi = {
  list: (params?: { page?: number; limit?: number; category?: string; tag?: string; sort?: string; search?: string; customisable?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.category) qs.set('category', params.category);
    if (params?.tag) qs.set('tag', params.tag);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.search) qs.set('search', params.search);
    if (params?.customisable) qs.set('customisable', 'true');
    const query = qs.toString();
    return request<ProductListResponse>(`/products${query ? `?${query}` : ''}`);
  },
  /** Admin listing — includes inactive (下架) products. */
  adminList: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<ProductListResponse>(`/products/admin${q ? `?${q}` : ''}`);
  },
  get: (id: string) => request<ProductItem>(`/products/${id}`),
  bestsellers: () => request<{ products: ProductItem[] }>('/products/bestsellers'),
  create: (body: ProductWriteBody) =>
    request<ProductItem>('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: ProductWriteBody) =>
    request<ProductItem>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  /** Permanently delete a product (and its pattern file). Blocked if it has orders. */
  permanentRemove: (id: string) => request<void>(`/products/${id}/permanent`, { method: 'DELETE' }),
  /** Upload a non-certified pattern deliverable (PDF or PNG). */
  uploadPatternFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return uploadRequest<{ url: string; type: 'pdf' | 'png' }>('/products/pattern-file', form);
  },
};

// ──────────────────────────────────────────────────────────────────────
// Media library (admin)
// ──────────────────────────────────────────────────────────────────────

export interface MediaFolder {
  id: string;
  category: string;
  code: string;
  name: string;
  assetCount?: number;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  folderId: string;
  url: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: string;
}

export const mediaApi = {
  listFolders: (category?: string) =>
    request<{ folders: MediaFolder[] }>(`/media/folders${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createFolder: (body: { category: string; code: string; name: string }) =>
    request<{ folder: MediaFolder }>('/media/folders', { method: 'POST', body: JSON.stringify(body) }),
  deleteFolder: (id: string) => request<void>(`/media/folders/${id}`, { method: 'DELETE' }),
  listAssets: (folderId: string) =>
    request<{ folder: MediaFolder; assets: MediaAsset[] }>(`/media/folders/${folderId}/assets`),
  uploadAssets: async (folderId: string, files: File[]) => {
    const form = new FormData();
    // Compress to ~1MB client-side before uploading.
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    compressed.forEach((f) => form.append('files', f));
    return uploadRequest<{ assets: MediaAsset[] }>(`/media/folders/${folderId}/assets`, form);
  },
  deleteAsset: (id: string) => request<void>(`/media/assets/${id}`, { method: 'DELETE' }),
};

// ──────────────────────────────────────────────────────────────────────
// Orders
// ──────────────────────────────────────────────────────────────────────

export interface OrderAddress {
  id?: string;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
}

export interface OrderItemDetail {
  id: string;
  productId: string;
  patternId?: string | null;
  quantity: number;
  unitPrice: number;
  customisation?: Record<string, string>;
  product?: { name: string; images: string[] };
}

export interface OrderDetail {
  id: string;
  userId: string;
  status: OrderStatusEnum;
  totalAmount: number;
  subtotalAmount?: number;
  discountAmount?: number;
  discountCode?: string | null;
  shippingAmount?: number;
  vatAmount?: number;
  currency: string;
  paymentMethod?: string | null;
  paymentId?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  cancelReason?: string | null;
  notes?: string | null;
  items: OrderItemDetail[];
  shippingAddress?: OrderAddress | null;
  user?: { name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatusEnum = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export interface OrderListResponse {
  orders: OrderDetail[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateOrderInput {
  items: { productId: string; patternId?: string; quantity: number; customisation?: Record<string, string> }[];
  shippingAddress: OrderAddress;
  notes?: string;
  paymentMethod: 'paypal' | 'stripe';
}

// ──────────────────────────────────────────────────────────────────────
// Payments — PayPal Standard Checkout
// ──────────────────────────────────────────────────────────────────────

export interface PaypalCheckoutInput {
  items: { productId: string; patternId?: string; quantity: number; customisation?: Record<string, string> }[];
  shippingAddress: OrderAddress;
  notes?: string;
  discountCode?: string;
}

export const paymentsApi = {
  /** Create a PayPal order; returns the PayPal order id for the JS SDK. */
  createPaypalOrder: (body: PaypalCheckoutInput) =>
    request<{ id: string }>('/payments/paypal/create-order', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Capture an approved PayPal order and persist the Fusiey order. */
  capturePaypalOrder: (body: PaypalCheckoutInput & { paypalOrderId: string }) =>
    request<{ order: OrderDetail }>('/payments/paypal/capture-order', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Check a discount code before paying; returns percentOff if valid. */
  validateDiscount: (code: string) =>
    request<{ valid: boolean; code: string; percentOff: number }>('/payments/validate-discount', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};

export const ordersApi = {
  create: (body: CreateOrderInput) =>
    request<OrderDetail>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  list: (params?: { page?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString();
    return request<OrderListResponse>(`/orders${query ? `?${query}` : ''}`);
  },
  get: (id: string) => request<OrderDetail>(`/orders/${id}`),
  updateStatus: (
    id: string,
    body: {
      status: OrderStatusEnum;
      trackingNumber?: string;
      carrier?: string;
      trackingUrl?: string;
      cancelReason?: string;
    },
  ) =>
    request<{ success: boolean }>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  cancel: (id: string) => request<void>(`/orders/${id}`, { method: 'DELETE' }),
};

// ──────────────────────────────────────────────────────────────────────
// Admin
// ──────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  stats: {
    totalOrders: number;
    /** Revenue grouped by currency (GBP/USD never summed together). */
    revenueByCurrency: { currency: string; total: number }[];
    totalUsers: number;
    totalProducts: number;
    ordersByStatus: Record<string, number>;
  };
  recentOrders: OrderDetail[];
}

export interface LedgerRow {
  id: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatusEnum;
  paid: boolean;
  paymentMethod: string;
  paymentId: string;
  items: string;
  subtotal: number;
  discountCode: string;
  discount: number;
  shipping: number;
  vat: number;
  total: number;
  currency: string;
  carrier: string;
  trackingNumber: string;
  cancelReason: string;
}

export interface LedgerTotals {
  currency: string;
  count: number;
  subtotal: number;
  discount: number;
  shipping: number;
  vat: number;
  total: number;
}

export interface LedgerResponse {
  rows: LedgerRow[];
  /** Totals grouped by currency (GBP/USD never summed together). */
  totals: LedgerTotals[];
  count: number;
  countedCount: number;
}

export interface LedgerQuery {
  from?: string;
  to?: string;
  status?: string;
}

function ledgerQs(params?: LedgerQuery) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.status) qs.set('status', params.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const adminApi = {
  dashboard: () => request<DashboardStats>('/admin/dashboard'),
  inventory: (lowStock?: boolean) => {
    const qs = lowStock ? '?lowStock=true' : '';
    return request<{ products: ProductItem[]; totalStock: number; lowStockCount: number }>(`/admin/inventory${qs}`);
  },
  updateStock: (id: string, stock: number, lowStockThreshold?: number) =>
    request<ProductItem>(`/admin/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock, lowStockThreshold }),
    }),
  ledger: (params?: LedgerQuery) =>
    request<LedgerResponse>(`/admin/orders/ledger${ledgerQs(params)}`),
  /** All site-config key/value pairs. */
  getConfig: () => request<Record<string, any>>('/admin/config'),
  /** Upsert a single site-config key. */
  saveConfig: (key: string, value: any) =>
    request<{ key: string; value: any }>('/admin/config', {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    }),
  /** Download the accounting ledger as a CSV file (triggers a browser save). */
  async exportLedgerCsv(params?: LedgerQuery) {
    const res = await fetch(`${API_BASE}/admin/orders/export.csv${ledgerQs(params)}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `fusiey-ledger-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
