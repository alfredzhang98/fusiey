import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus, ShoppingCart, Loader2, Sparkles, ChevronDown, Flame, Search, X, Star } from 'lucide-react';
import { productsApi, type ProductItem } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { PRODUCT_TABS, HOT_TAB } from '../constants/productCategories';
import { HeroCarousel } from '../components/HeroCarousel';
import { useCurrencyStore, formatPrice, regionPrice, isAvailable } from '../store/useCurrencyStore';
import { cn } from '../lib/utils';

export function ProductsPage() {
  const [activeTab, setActiveTab] = useState<string>('hot');
  const [grid, setGrid] = useState<ProductItem[]>([]);
  const [featured, setFeatured] = useState<ProductItem[]>([]);
  const [best, setBest] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState('newest');
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState(''); // debounced search term

  const addItem = useCartStore((s) => s.addItem);
  const itemCount = useCartStore((s) => s.itemCount());
  const currency = useCurrencyStore((s) => s.currency);

  const isHot = activeTab === 'hot';
  const searching = query.length > 0;
  const activeMeta = PRODUCT_TABS.find((t) => t.key === activeTab) ?? HOT_TAB;

  // Hide products not sold in the visitor's region (no price for this currency).
  const visibleGrid = grid.filter((p) => isAvailable(p, currency));
  const visibleFeatured = featured.filter((p) => isAvailable(p, currency));
  const visibleBest = best.filter((p) => isAvailable(p, currency));

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (searching) {
          const res = await productsApi.list({ search: query, sort, limit: 48 });
          if (!cancelled) { setFeatured([]); setGrid(res.products); }
        } else if (isHot) {
          const [feat, hot, bestRes] = await Promise.all([
            productsApi.list({ tag: 'featured', limit: 8 }),
            productsApi.list({ tag: 'hot', limit: 24 }),
            productsApi.bestsellers(),
          ]);
          if (!cancelled) {
            setFeatured(feat.products);
            setGrid(hot.products);
            setBest(bestRes.products);
          }
        } else {
          const res = await productsApi.list({ category: activeTab, sort, limit: 48 });
          if (!cancelled) {
            setFeatured([]);
            setGrid(res.products);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, sort, isHot, query, searching]);

  const handleAdd = (p: ProductItem) => {
    addItem(p);
    setAdded((s) => ({ ...s, [p.id]: true }));
    setTimeout(() => setAdded((s) => ({ ...s, [p.id]: false })), 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-cute font-bold text-ink text-3xl">Shop</h1>
          <p className="font-body text-ink-hint text-sm mt-1">{activeMeta.blurb}</p>
        </div>
        <Link to="/checkout" className="fsy-btn fsy-btn-sm bg-cotton gap-2 self-start shrink-0">
          <ShoppingCart className="w-4 h-4" />
          Cart ({itemCount})
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-hint pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full h-11 pl-11 pr-10 font-body text-sm text-ink bg-paper border-[2px] border-ink rounded-pill placeholder:text-ink-hint outline-none focus:bg-butter/20 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-ink-hint hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile tab chips */}
      <div className="lg:hidden -mx-4 px-4 mb-6 flex gap-2 overflow-x-auto pb-1">
        {PRODUCT_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-pill border-[2px] border-ink font-cute font-semibold text-sm transition-colors',
                activeTab === t.key ? 'bg-cotton text-ink' : 'bg-paper text-ink-hint hover:bg-butter/60',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Hot carousel — hidden while searching */}
          {isHot && !searching && !loading && !error && visibleFeatured.length > 0 && (
            <div className="mb-8">
              <HeroCarousel slides={visibleFeatured} />
            </div>
          )}

          {/* Section heading + sort */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="font-cute font-bold text-ink text-xl inline-flex items-center gap-2">
              {searching
                ? `Results for “${query}”`
                : isHot
                  ? (<><Flame className="w-5 h-5 text-[#E5703A]" /> Trending now</>)
                  : activeMeta.label}
            </h2>
            {(!isHot || searching) && (
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-9 pl-3 pr-8 bg-paper border-[2px] border-ink rounded-pill font-cute font-semibold text-sm text-ink outline-none appearance-none cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="price-asc">Price: Low → High</option>
                  <option value="price-desc">Price: High → Low</option>
                  <option value="name">Name A–Z</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-hint pointer-events-none" />
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20 text-ink-hint">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="font-body">Loading products…</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-20">
              <p className="font-body text-red-600 mb-4">{error}</p>
              <button onClick={() => window.location.reload()} className="fsy-btn fsy-btn-sm bg-paper">Retry</button>
            </div>
          )}

          {!loading && !error && visibleGrid.length === 0 && (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-ink-hint mx-auto mb-4" />
              <p className="font-cute font-bold text-ink text-xl mb-2">Nothing here yet</p>
              <p className="font-body text-ink-hint">We're stocking up this category — check back soon!</p>
            </div>
          )}

          {!loading && !error && visibleGrid.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {visibleGrid.map((p) => (
                <div key={p.id} className="fsy-sticker group flex flex-col bg-paper rounded-[16px] overflow-hidden">
                  <Link to={`/products/${p.id}`} className="shrink-0">
                    <div className="aspect-square bg-paper-warm overflow-hidden">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-ink-hint" />
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-col flex-1 p-4 gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags?.includes('hot') && (
                        <span className="fsy-tag bg-cotton"><Flame className="w-3 h-3" /> Hot</span>
                      )}
                      {p.isCustomisable && (
                        <span className="fsy-tag bg-butter"><Sparkles className="w-3 h-3" /> Customisable</span>
                      )}
                      {p.stock <= 5 && p.stock > 0 && (
                        <span className="fsy-tag bg-peach-candy">Low stock</span>
                      )}
                      {p.stock === 0 && (
                        <span className="fsy-tag bg-ink-soft/20 text-ink-hint">Sold out</span>
                      )}
                    </div>

                    <h3 className="font-cute font-bold text-ink text-base leading-snug">{p.name}</h3>
                    <p className="font-body text-ink-hint text-xs line-clamp-2 leading-relaxed flex-1">{p.description}</p>

                    <div className="flex items-center justify-between mt-1">
                      <span className="font-cute font-bold text-ink text-lg">{formatPrice(regionPrice(p, currency)!, currency)}</span>
                      <button
                        onClick={() => handleAdd(p)}
                        disabled={p.stock === 0}
                        className={cn(
                          'h-9 px-4 rounded-pill border-[2px] border-ink font-cute font-semibold text-xs flex items-center gap-1.5 transition-all',
                          added[p.id] ? 'bg-mint text-ink' : 'bg-cotton hover:bg-accent-hover text-ink',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                        )}
                      >
                        {added[p.id] ? 'Added ✓' : (<><Plus className="w-3.5 h-3.5" /> Add</>)}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Best sellers — recommendation by units sold (Hot tab only) */}
          {isHot && !searching && !loading && visibleBest.length > 0 && (
            <div className="mt-10">
              <h2 className="font-cute font-bold text-ink text-xl inline-flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-[#E5A300]" /> Best sellers
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                {visibleBest.map((p) => (
                  <Link
                    key={p.id}
                    to={`/products/${p.id}`}
                    className="shrink-0 w-40 fsy-sticker bg-paper rounded-[14px] overflow-hidden group"
                  >
                    <div className="aspect-square bg-paper-warm overflow-hidden">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-ink-hint" /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-cute font-semibold text-ink text-xs truncate">{p.name}</p>
                      <p className="font-cute font-bold text-ink text-sm mt-1">{formatPrice(regionPrice(p, currency)!, currency)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Desktop right-hand category tabs */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-20 flex flex-col gap-1.5">
            <h3 className="font-body font-extrabold text-ink-hint text-[10px] uppercase tracking-[0.08em] px-3 mb-1">
              Browse
            </h3>
            {PRODUCT_TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] font-cute font-semibold text-sm transition-colors text-left border-[2px]',
                    active
                      ? 'bg-cotton border-ink text-ink'
                      : 'bg-paper border-transparent text-ink-hint hover:bg-butter/50 hover:text-ink',
                  )}
                  style={active ? { boxShadow: '2px 2px 0 0 var(--color-ink)' } : undefined}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', t.key === 'hot' && active && 'text-[#E5703A]')} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
