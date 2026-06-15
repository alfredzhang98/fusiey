import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Package } from 'lucide-react';
import type { ProductItem } from '../services/api';
import { useCurrencyStore, formatPrice, regionPrice } from '../store/useCurrencyStore';
import { cn, imgFallback } from '../lib/utils';

const SLIDE_BG = ['bg-cotton', 'bg-butter', 'bg-mint', 'bg-lilac', 'bg-sky-candy'];

/**
 * Auto-rotating hero banner for the Hot tab — one slide per featured product.
 * Pauses nothing fancy; just a 5s timer that resets on manual navigation.
 */
export function HeroCarousel({ slides }: { slides: ProductItem[] }) {
  const [idx, setIdx] = useState(0);
  const currency = useCurrencyStore((s) => s.currency);
  const n = slides.length;

  const go = useCallback((next: number) => setIdx((p) => (p + next + n) % n), [n]);

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setIdx((p) => (p + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n, idx]);

  if (n === 0) return null;

  return (
    <div
      className="relative rounded-[20px] border-[2px] border-ink overflow-hidden"
      style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
    >
      {/* Slides stacked; active one fades in. Fixed height keeps layout stable. */}
      <div className="relative h-[260px] sm:h-[300px]">
        {slides.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'absolute inset-0 flex transition-opacity duration-500',
              SLIDE_BG[i % SLIDE_BG.length],
              i === idx ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none',
            )}
          >
            {/* Copy */}
            <div className="flex-1 flex flex-col justify-center gap-3 p-6 sm:p-10 min-w-0">
              <span className="self-start fsy-tag bg-paper/80">★ Featured</span>
              <h2 className="font-cute font-bold text-ink text-2xl sm:text-4xl leading-tight line-clamp-2">
                {p.name}
              </h2>
              <p className="font-body text-ink-soft text-sm sm:text-base line-clamp-2 max-w-md">
                {p.description}
              </p>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-cute font-bold text-ink text-2xl">{formatPrice(regionPrice(p, currency) ?? p.priceGBP, currency)}</span>
                <Link
                  to={`/products/${p.id}`}
                  className="inline-flex items-center gap-2 h-11 px-5 bg-paper hover:bg-paper-warm text-ink font-cute font-semibold rounded-pill border-[2px] border-ink transition-colors"
                  style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
                >
                  Shop now <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            {/* Image */}
            <div className="hidden sm:block w-[44%] shrink-0 border-l-[2px] border-ink/15">
              {p.images[0] ? (
                <img src={p.images[0]} alt={p.name} onError={imgFallback} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-ink/30" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Arrows */}
      {n > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-paper/90 border-[2px] border-ink flex items-center justify-center hover:bg-paper transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-ink" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-paper/90 border-[2px] border-ink flex items-center justify-center hover:bg-paper transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-ink" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {slides.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  'h-2 rounded-full border border-ink transition-all',
                  i === idx ? 'w-5 bg-ink' : 'w-2 bg-paper/80',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
