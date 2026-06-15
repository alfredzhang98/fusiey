import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Package, Plus, Minus, ArrowLeft, Palette, ShoppingCart } from 'lucide-react';
import { patternsApi, productsApi, type PatternSummary, type ProductItem, ApiError } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useCurrencyStore, formatPrice, regionPrice, isAvailable } from '../store/useCurrencyStore';
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import { imgFallback } from '../lib/utils';

// Only these three categories can be added to a custom-pattern order.
const ACCESSORY_CATS = ['beads', 'refill', 'tool'] as const;

/** Small pattern thumbnail with a dimensions fallback. */
function Thumb({ p }: { p: PatternSummary }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-full bg-paper-warm flex items-center justify-center font-pixel-mono text-ink-hint text-xs">
        {p.width}×{p.height}
      </div>
    );
  }
  return (
    <img src={patternsApi.thumbnailUrl(p.id)} alt={p.name} loading="lazy"
      className="w-full h-full object-contain bg-paper-warm" onError={() => setFailed(true)} />
  );
}

export function CustomOrderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currency = useCurrencyStore((s) => s.currency);
  const addItem = useCartStore((s) => s.addItem);

  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [accessories, setAccessories] = useState<ProductItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('pattern'));
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pats, prods] = await Promise.all([
          patternsApi.list({ page: 1, limit: 50 }),
          productsApi.list({ customisable: true, limit: 100 }),
        ]);
        setPatterns(pats.patterns);
        setAccessories(
          prods.products.filter(
            (p) => (ACCESSORY_CATS as readonly string[]).includes(p.category) && isAvailable(p, currency),
          ),
        );
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const selected = patterns.find((p) => p.id === selectedId) || null;
  const setQ = (id: string, n: number) => setQty((s) => ({ ...s, [id]: Math.max(0, n) }));

  const { total, count } = useMemo(() => {
    let total = 0; let count = 0;
    for (const a of accessories) {
      const n = qty[a.id] || 0;
      const price = regionPrice(a, currency);
      if (n > 0 && price != null) { total += price * n; count += n; }
    }
    return { total: Math.round(total * 100) / 100, count };
  }, [accessories, qty, currency]);

  // Group accessories by the three allowed categories (only non-empty groups).
  const groups = ACCESSORY_CATS
    .map((key) => ({
      meta: PRODUCT_CATEGORIES.find((c) => c.key === key)!,
      items: accessories.filter((a) => a.category === key),
    }))
    .filter((g) => g.items.length > 0);

  const [added, setAdded] = useState(false);
  const addToCart = (goCheckout: boolean) => {
    if (!selected || count === 0) return;
    // All accessories go into ONE order, bound to the chosen design (a "pack").
    for (const a of accessories) {
      const n = qty[a.id] || 0;
      if (n > 0) addItem(a, selected.id, selected.name, n);
    }
    if (goCheckout) {
      navigate('/checkout');
    } else {
      setQty({});
      setAdded(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-ink-hint">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /><span className="font-body">Loading…</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28">
      <Link to="/my-works" className="inline-flex items-center gap-2 font-cute font-semibold text-sm text-ink-hint hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to My Works
      </Link>
      <h1 className="font-cute font-bold text-ink text-3xl mb-1">Order a kit for your design</h1>
      <p className="font-body text-ink-hint text-sm mb-8">
        Pick one of your designs, then add the beads, refills and tools to make it. Your design is sent with the order.
      </p>

      {error && <p className="font-body text-red-600 mb-4">{error}</p>}

      {added && (
        <div className="mb-6 flex items-center justify-between gap-3 p-3 bg-mint/40 border-[2px] border-ink rounded-[12px]">
          <span className="font-cute font-semibold text-ink text-sm">Added to your cart ✓</span>
          <Link to="/checkout" className="fsy-btn fsy-btn-sm bg-cotton gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Go to checkout
          </Link>
        </div>
      )}

      {/* ── STEP 1 — choose a design ── */}
      {!selected ? (
        <section>
          <h2 className="font-cute font-bold text-ink text-lg mb-4">Step 1 · Choose your design</h2>
          {patterns.length === 0 ? (
            <div className="fsy-card text-center py-12">
              <Palette className="w-12 h-12 text-ink-hint mx-auto mb-3" />
              <p className="font-body text-ink-hint mb-4">You have no saved designs yet.</p>
              <Link to="/designer?new=1" className="fsy-btn fsy-btn-sm bg-cotton">Open the designer</Link>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
              {patterns.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="fsy-sticker group relative rounded-[14px] border-[2px] border-ink/30 hover:border-ink overflow-hidden transition-colors text-left bg-paper"
                >
                  <div className="aspect-square"><Thumb p={p} /></div>
                  <div className="p-3">
                    <p className="font-cute font-semibold text-ink text-sm truncate">{p.name}</p>
                    <p className="font-body text-ink-hint text-[11px] mt-0.5">{p.width}×{p.height} · tap to select</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* ── STEP 2 — design on the left, add-ons on the right ── */
        <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
          <aside className="lg:sticky lg:top-20 space-y-3">
            <p className="font-body text-[10px] uppercase tracking-[0.08em] text-ink-hint">Your design</p>
            <div className="rounded-[14px] border-[2px] border-ink overflow-hidden aspect-square bg-paper-warm"
              style={{ boxShadow: '3px 3px 0 0 var(--color-ink)' }}>
              <Thumb p={selected} />
            </div>
            <p className="font-cute font-bold text-ink text-sm">{selected.name}</p>
            <button onClick={() => setSelectedId(null)} className="fsy-btn fsy-btn-sm bg-paper gap-1.5 w-full justify-center">
              <ArrowLeft className="w-3.5 h-3.5" /> Change design
            </button>
          </aside>

          <main>
            <h2 className="font-cute font-bold text-ink text-lg mb-3">Step 2 · Add beads, refills &amp; tools</h2>
            {groups.length === 0 ? (
              <p className="font-body text-ink-hint text-sm">No add-ons are available right now — check back soon.</p>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <div key={g.meta.key}>
                    <h3 className="font-cute font-semibold text-ink-soft text-sm mb-2 inline-flex items-center gap-2">
                      <g.meta.icon className="w-4 h-4" /> {g.meta.label}
                    </h3>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {g.items.map((a) => {
                        const price = regionPrice(a, currency)!;
                        const n = qty[a.id] || 0;
                        const soldOut = a.stock === 0;
                        return (
                          <div key={a.id} className="flex items-center gap-3 bg-paper border-[2px] border-ink/25 rounded-[10px] p-2">
                            <div className="w-14 h-14 rounded-[8px] bg-paper-warm border border-ink/20 overflow-hidden shrink-0">
                              {a.images[0]
                                ? <img src={a.images[0]} alt={a.name} loading="lazy" onError={imgFallback} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-ink-hint" /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-cute font-semibold text-ink text-sm leading-tight line-clamp-2">{a.name}</p>
                              <p className="font-cute font-bold text-ink text-xs mt-0.5">{formatPrice(price, currency)}</p>
                            </div>
                            <div className="shrink-0">
                              {soldOut ? (
                                <span className="fsy-tag bg-ink-soft/20 text-ink-hint text-[8px]">Sold out</span>
                              ) : n > 0 ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setQ(a.id, n - 1)} className="w-6 h-6 rounded-full border border-ink/30 flex items-center justify-center hover:bg-butter/60"><Minus className="w-3 h-3" /></button>
                                  <span className="font-pixel-mono text-ink text-xs w-4 text-center">{n}</span>
                                  <button onClick={() => setQ(a.id, Math.min(a.stock, n + 1))} className="w-6 h-6 rounded-full border border-ink/30 flex items-center justify-center hover:bg-butter/60"><Plus className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => setQ(a.id, 1)} className="h-7 px-2.5 rounded-full border-[2px] border-ink bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold text-[11px] inline-flex items-center gap-0.5"><Plus className="w-3 h-3" /> Add</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {/* Sticky summary — only while picking add-ons */}
      {selected && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-sm border-t-[3px] border-ink">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0 font-body text-sm text-ink-soft">
              <span className="font-cute font-semibold text-ink">{selected.name}</span>
              <span className="text-ink-hint"> · {count} item{count === 1 ? '' : 's'} · </span>
              <span className="font-cute font-bold text-ink">{formatPrice(total, currency)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => addToCart(false)}
                disabled={count === 0}
                className="fsy-btn fsy-btn-sm bg-paper gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add to cart
              </button>
              <button
                onClick={() => addToCart(true)}
                disabled={count === 0}
                className="fsy-btn fsy-btn-sm bg-cotton gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" /> Checkout now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
