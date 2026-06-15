import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Minus, Plus, ShoppingCart, Check, Loader2,
  Package, Sparkles, Flame, Truck,
} from 'lucide-react';
import { productsApi, configApi, type ProductItem, type ShippingConfig } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import { useCurrencyStore, formatPrice, vatPortion, regionPrice } from '../store/useCurrencyStore';
import { cn, imgFallback } from '../lib/utils';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const itemCount = useCartStore((s) => s.itemCount());
  const currency = useCurrencyStore((s) => s.currency);

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [shippingCfg, setShippingCfg] = useState<ShippingConfig>({
    GBP: { freeOver: 50, fee: 4.99 },
    USD: { freeOver: 65, fee: 6.99 },
  });

  useEffect(() => {
    configApi.shipping().then(setShippingCfg).catch(() => { /* keep defaults */ });
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const p = await productsApi.get(id);
        if (!cancelled) { setProduct(p); setImgIdx(0); setQty(1); }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Product not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleAdd = () => {
    if (!product) return;
    addItem(product, undefined, undefined, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-ink-hint">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span className="font-body">Loading…</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <Package className="w-16 h-16 text-ink-hint mx-auto mb-4" />
        <h2 className="font-cute font-bold text-ink text-2xl mb-2">Product not found</h2>
        <p className="font-body text-ink-hint mb-6">It may have sold out or been removed.</p>
        <Link to="/products" className="fsy-btn bg-cotton gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to shop
        </Link>
      </div>
    );
  }

  const category = PRODUCT_CATEGORIES.find((c) => c.key === product.category);
  const price = regionPrice(product, currency);
  const available = price != null;
  const soldOut = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const ship = {
    freeOver: formatPrice(shippingCfg[currency].freeOver, currency),
    fee: formatPrice(shippingCfg[currency].fee, currency),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 font-cute font-semibold text-sm text-ink-hint hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to shop
        </Link>
        <Link to="/checkout" className="fsy-btn fsy-btn-sm bg-paper gap-2">
          <ShoppingCart className="w-4 h-4" /> Cart ({itemCount})
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="aspect-square rounded-[20px] border-[2px] border-ink overflow-hidden bg-paper-warm" style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}>
            {product.images[imgIdx] ? (
              <img src={product.images[imgIdx]} alt={product.name} onError={imgFallback} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-ink-hint" />
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={cn(
                    'w-16 h-16 rounded-[10px] border-[2px] overflow-hidden transition-colors',
                    i === imgIdx ? 'border-ink' : 'border-ink/20 hover:border-ink',
                  )}
                >
                  <img src={src} alt="" onError={imgFallback} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <span className="fsy-tag bg-butter inline-flex items-center gap-1">
                <category.icon className="w-3 h-3" /> {category.label}
              </span>
            )}
            {product.tags?.includes('hot') && (
              <span className="fsy-tag bg-cotton inline-flex items-center gap-1">
                <Flame className="w-3 h-3" /> Hot
              </span>
            )}
            {product.isCustomisable && (
              <span className="fsy-tag bg-mint inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Customisable
              </span>
            )}
          </div>

          <h1 className="font-cute font-bold text-ink text-3xl leading-tight">{product.name}</h1>

          <div>
            {available ? (
              <>
                <div className="font-cute font-bold text-ink text-3xl">{formatPrice(price!, currency)}</div>
                <div className="font-body text-ink-hint text-[11px] mt-1">
                  Incl. VAT (20%): {formatPrice(vatPortion(price!), currency)}
                </div>
              </>
            ) : (
              <div className="font-cute font-bold text-ink-hint text-lg">Not available in your region</div>
            )}
          </div>

          {/* Stock */}
          <div className="font-body text-sm">
            {soldOut ? (
              <span className="text-red-600 font-semibold">Sold out</span>
            ) : lowStock ? (
              <span className="text-[#C77] font-semibold">Only {product.stock} left — order soon!</span>
            ) : (
              <span className="text-mint font-semibold inline-flex items-center gap-1">
                <Check className="w-4 h-4" /> In stock
              </span>
            )}
          </div>

          <p className="font-body text-ink-soft text-sm leading-relaxed whitespace-pre-line">
            {product.description}
          </p>

          {/* Quantity + add to cart */}
          {!soldOut && available && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 p-1 bg-paper border-[2px] border-ink rounded-pill">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-butter/60 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4 text-ink" />
                </button>
                <span className="font-pixel-mono text-ink text-sm w-8 text-center">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-butter/60 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4 text-ink" />
                </button>
              </div>
              <button
                onClick={handleAdd}
                className={cn(
                  'fsy-btn fsy-btn-lg flex-1 gap-2',
                  added ? 'bg-mint' : 'bg-cotton hover:bg-accent-hover',
                )}
              >
                {added ? (<><Check className="w-5 h-5" /> Added to cart</>) : (<><ShoppingCart className="w-5 h-5" /> Add to cart</>)}
              </button>
            </div>
          )}

          {added && (
            <button
              onClick={() => navigate('/checkout')}
              className="fsy-btn bg-paper w-full"
            >
              Go to checkout →
            </button>
          )}

          {/* Shipping note */}
          <div className="flex items-center gap-2 mt-2 p-3 bg-paper-warm border border-ink/20 rounded-[12px] font-body text-ink-hint text-xs">
            <Truck className="w-4 h-4 shrink-0" />
            Free shipping on orders over {ship.freeOver} — otherwise {ship.fee}.
          </div>
        </div>
      </div>
    </div>
  );
}
