import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { AuroraBackground } from '../components/AuroraBackground';
import confetti from 'canvas-confetti';
import { Sparkles, Leaf, Diamond, ArrowRight, Palette, Truck, ShieldCheck, Package, Box, Mail, MessageCircle, Upload, Star } from 'lucide-react';
import { FadeStickOn, FUSIEY_CONFETTI_COLORS } from '../components/interactive';
import { promoApi, configApi, ApiError, type SiteConfig } from '../services/api';

/** TikTok mark — simplified inline SVG (lucide has no TikTok icon). */
function TikTokIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.6 6.4c-1.4-.4-2.6-1.4-3.3-2.7-.3-.6-.5-1.2-.5-1.9h-3.2v13.1c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5c.3 0 .5 0 .8.1V9.2c-.3 0-.5-.1-.8-.1-3.2 0-5.7 2.6-5.7 5.7S6.9 20.6 10.1 20.6s5.7-2.6 5.7-5.7V9.3c1.3.9 2.8 1.4 4.4 1.4V7.5c-.2 0-.4-.1-.6-.1z" />
    </svg>
  );
}

/** Social strip at the very top — follow us on TikTok. */
function SocialStrip({ tiktokUrl }: { tiktokUrl?: string }) {
  return (
    <div className="bg-butter/75 px-3 sm:px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-5 gap-y-2">
        <span className="font-cute font-semibold text-ink text-xs sm:text-sm inline-flex items-center gap-1">
          <Sparkles className="w-4 h-4" />
          Follow along for daily pattern drops
        </span>
        <a
          href={tiktokUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fusiey on TikTok"
          className="fsy-tag hover:bg-cotton transition-colors duration-[120ms] cursor-pointer"
        >
          <TikTokIcon className="w-4 h-4" />
          <span className="leading-none">TikTok</span>
        </a>
      </div>
    </div>
  );
}

/** Newsletter signup — email + GDPR consent. Emails a discount code. */
function NewsletterForm({ percent = 10 }: { percent?: number }) {
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Please enter a valid email.');
      return;
    }
    if (!agreed) {
      setError('Please agree to our privacy policy.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await promoApi.welcome(email);
    } catch (err: any) {
      // Rate-limit / network errors shouldn't block the celebration — the
      // server is idempotent, so we surface a gentle message and still confirm.
      if (err instanceof ApiError && err.status === 429) {
        setError('You already claimed this recently — check your inbox.');
        setBusy(false);
        return;
      }
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message || 'Please enter a valid email.');
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setSubmitted(true);
    // 🎉 Brand-colored celebration burst. Two shots from opposite corners.
    const shoot = (origin: { x: number; y: number }) =>
      confetti({
        particleCount: 60,
        spread: 70,
        startVelocity: 45,
        origin,
        colors: FUSIEY_CONFETTI_COLORS,
        scalar: 0.9,
        disableForReducedMotion: true,
      });
    shoot({ x: 0.2, y: 0.7 });
    shoot({ x: 0.8, y: 0.7 });
  };

  if (submitted) {
    return (
      <div className="fsy-sticker inline-flex items-center gap-3 px-6 py-4 rounded-[16px] bg-butter max-w-lg mx-auto">
        <Sparkles className="w-5 h-5 text-ink" />
        <span className="font-cute font-semibold text-ink">
          Welcome to the club! Check your inbox for your {percent}% code.
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          type="email"
          placeholder="your@email.co.uk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="fsy-input flex-1"
          aria-label="Email address"
        />
        <button type="submit" disabled={busy} className="fsy-btn fsy-btn-lg bg-butter hover:bg-paper gap-2 whitespace-nowrap disabled:opacity-60">
          <Sparkles className="w-5 h-5" />
          {busy ? 'Sending…' : `Claim my ${percent}%`}
        </button>
      </div>
      <label className="inline-flex items-center gap-2 font-body text-sm text-ink cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="w-4 h-4 accent-[color:var(--color-ink)]"
        />
        <span>
          I agree to Fusiey's{' '}
          <a href="#privacy" className="underline decoration-[2px] underline-offset-2">privacy policy</a>.
        </span>
      </label>
      {error && (
        <p className="mt-2 font-body text-sm text-ink font-semibold">{error}</p>
      )}
    </form>
  );
}

/**
 * Horizontal candy-pastel gradient bar used as a soft section divider.
 * Fades to transparent at both ends so it doesn't feel like a hard rule.
 * Replaces the old 3px plum ink border-t dividers.
 */
function RainbowDivider() {
  return (
    <div
      aria-hidden="true"
      role="separator"
      className="h-1 w-full"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, #F7A5B8 18%, #FFF4C0 36%, #B8DFCA 52%, #AFDCEB 68%, #E1B8DF 85%, transparent 100%)',
      }}
    />
  );
}

/**
 * One large hero bead with two stacked motions:
 *  - Outer: scroll-linked vertical parallax (different speed per bead).
 *  - Inner: continuous idle float + subtle rotation.
 * CSS transforms on nested motion.divs compose, so the effects stack
 * cleanly without fighting each other.
 */
function FloatingBead({
  x, y, size, color, delay, scrollFactor,
}: {
  x: string; y: string; size: number; color: string;
  delay: number; scrollFactor: number;
}) {
  const { scrollY } = useScroll();
  // Travel up as user scrolls — more for "closer" (bigger) beads.
  const yOffset = useTransform(scrollY, [0, 900], [0, -260 * scrollFactor]);

  return (
    <motion.div
      aria-hidden="true"
      className="absolute"
      style={{ left: x, top: y, y: yOffset }}
    >
      <motion.div
        animate={{ y: [0, -8, 0, 6, 0], rotate: [0, 3, 0, -3, 0] }}
        transition={{
          duration: 7 + (scrollFactor * 4),
          delay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="fsy-bead border-[3px] border-ink"
        style={{
          // Responsive: reaches full size around 1024px viewport, halves
          // on the smallest phones. clamp clamps min/max, vw scales the middle.
          width: `clamp(${Math.round(size * 0.5)}px, ${(size * 0.1).toFixed(2)}vw, ${size}px)`,
          height: `clamp(${Math.round(size * 0.5)}px, ${(size * 0.1).toFixed(2)}vw, ${size}px)`,
          background: color,
          boxShadow:
            'var(--shadow-sticker), inset 1.5px 1.5px 0 rgba(255,255,255,0.55)',
        }}
      />
    </motion.div>
  );
}

function FadeInUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Eyebrow — small uppercase tag with VT323 */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="fsy-tag uppercase tracking-[0.08em]">{children}</span>
  );
}

export function HomePage() {
  const [site, setSite] = useState<SiteConfig | null>(null);
  useEffect(() => {
    configApi.site().then(setSite).catch(() => {});
  }, []);
  const pct = site?.welcomeDiscountPercent ?? 10;

  return (
    <div className="overflow-hidden bg-blush relative">
      {/* Page-level ambient aurora — fixed to viewport, visible on every
          section. Sections below must use semi-transparent backgrounds
          (/70-/80 alpha) to let the aurora bleed through. */}
      <AuroraBackground />
      {/*
          Global decorative layers moved INTO the Hero section:
          - ScrollDepthPegboard: background pegboard tile that zooms on scroll
          - HeroBeadField: interactive canvas particle beads
          ParallaxBeads / ScrollProgress / CursorBead exports still live in
          interactive.tsx but are unmounted (tree-shake out).
      */}

      {/* Content wrapper — preserves z-layering for Hero's stacked effects */}
      <div className="relative z-10">

      {/* ===== ANNOUNCEMENT BANNER (admin-configurable) ===== */}
      {site?.announcement?.enabled && site.announcement.text && (
        <div className="bg-ink text-paper px-4 py-2 text-center font-cute font-semibold text-xs sm:text-sm">
          {site.announcement.text}
        </div>
      )}

      {/* ===== SOCIAL STRIP ===== */}
      <SocialStrip tiktokUrl={site?.tiktokUrl} />

      {/* ===== HERO ===== */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-5 sm:px-8 py-14 sm:py-20 overflow-hidden">
        {/* 8 large sticker beads — sparse, idle-float + scroll-parallax.
            Closer/bigger beads get higher scrollFactor so they travel up
            faster than small ones (true parallax depth cue). */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
          {[
            { x: '6%',  y: '14%', size: 72, color: 'var(--color-bead-E4)',  delay: 0,   scrollFactor: 0.55 },
            { x: '90%', y: '22%', size: 56, color: 'var(--color-bead-C3)',  delay: 0.6, scrollFactor: 0.40 },
            { x: '10%', y: '78%', size: 84, color: 'var(--color-bead-A4)',  delay: 1.2, scrollFactor: 0.70 },
            { x: '88%', y: '74%', size: 64, color: 'var(--color-bead-B3)',  delay: 0.3, scrollFactor: 0.50 },
            { x: '3%',  y: '46%', size: 44, color: 'var(--color-bead-D6)',  delay: 0.9, scrollFactor: 0.30 },
            { x: '94%', y: '50%', size: 40, color: 'var(--color-bead-E7)',  delay: 1.5, scrollFactor: 0.25 },
            { x: '16%', y: '30%', size: 32, color: 'var(--color-bead-A11)', delay: 2.0, scrollFactor: 0.20 },
            { x: '82%', y: '90%', size: 48, color: 'var(--color-bead-D19)', delay: 0.4, scrollFactor: 0.35 },
          ].map((b, i) => (
            <FloatingBead key={i} {...b} />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Hero centerpiece — logo in sticker frame, wiggles on hover. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
            whileHover={{ rotate: [0, -4, 4, -2, 2, 0], transition: { duration: 0.6 } }}
            className="mb-8 inline-block cursor-pointer"
          >
            <div className="fsy-sticker inline-flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-[24px] bg-paper">
              <img src="/logo-hero.svg" alt="Fusiey" className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36" />
            </div>
          </motion.div>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8 flex justify-center"
          >
            <Eyebrow>
              <Sparkles className="w-4 h-4" /> Custom Perler Beads &amp; Starter Kits
            </Eyebrow>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-cute font-bold leading-[1.1] tracking-tight text-ink text-4xl sm:text-5xl md:text-7xl mb-5 sm:mb-6"
          >
            Design Your Own
            <br />
            <span className="inline-block relative mt-2 pb-2 sm:pb-3">
              <span className="relative z-10">Perler Beads</span>
              {/* Rainbow underline — 5-stop candy-pastel gradient, rounded
                  ends. Responsive thickness: thinner on phones, bolder on
                  desktop so it reads at every hero text size. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[5px] sm:h-[7px] md:h-[10px] rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, #F7A5B8 0%, #FFF4C0 25%, #B8DFCA 50%, #AFDCEB 75%, #E1B8DF 100%)',
                }}
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="font-body text-base sm:text-lg md:text-xl text-ink-soft max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          >
            Design your own perler bead patterns with our designer, or explore our curated starter kits with official designs and complete tool sets. Premium quality, shipped across the UK and USA.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/designer" className="fsy-btn fsy-btn-lg bg-cotton hover:bg-accent-hover gap-2 group">
              <Palette className="w-5 h-5" />
              Start Designing
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/products" className="fsy-btn fsy-btn-lg bg-paper hover:bg-butter gap-2 group">
              <Package className="w-5 h-5" />
              Shop Kits
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== COMMUNITY (coming-soon teaser) ===== */}
      <section className="px-5 sm:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div
            className="relative bg-lilac/50 border-[3px] border-ink rounded-[24px] p-8 sm:p-10 text-center overflow-hidden"
            style={{ boxShadow: '5px 5px 0 0 var(--color-ink)' }}
          >
            {/* floating beads decoration */}
            <div className="pointer-events-none absolute -top-3 -right-3 flex gap-1.5 opacity-70" aria-hidden="true">
              {['bg-cotton', 'bg-butter', 'bg-mint'].map((b) => (
                <div key={b} className={`fsy-bead w-7 h-7 border-[2px] border-ink ${b}`} />
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 fsy-tag bg-cotton mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Coming soon
            </span>
            <h2 className="font-cute font-bold text-ink text-2xl sm:text-3xl mb-3">
              Fusiey Community
            </h2>
            <p className="font-body text-ink-soft text-sm sm:text-base max-w-xl mx-auto mb-6">
              Share, discover and remix bead patterns. Soon you'll be able to open both
              community designs and official Fusiey patterns straight in the designer — drop
              one onto your canvas and make it your own.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { icon: Upload, label: 'Import community patterns' },
                { icon: Palette, label: 'Remix official patterns' },
                { icon: Star, label: 'Earn & spend points' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 bg-paper border-[2px] border-ink rounded-pill px-4 py-2 font-cute font-semibold text-ink text-sm"
                >
                  <Icon className="w-4 h-4" /> {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY FUSIEY (what's in every kit + brand values) =====
          Scope: everything the customer *gets* or the brand *stands for*.
          The "how to start" paths (Designer vs Official Patterns) belong to Step 1
          in HOW IT WORKS below, not here. */}
      <RainbowDivider />
      <section className="px-5 sm:px-8 py-16 sm:py-24 bg-cream/70">
        <div className="max-w-6xl mx-auto">
          <FadeInUp>
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <div className="flex justify-center mb-4"><Eyebrow>Why Fusiey</Eyebrow></div>
              <h2 className="font-cute font-bold text-ink text-3xl md:text-4xl mb-5">
                Crafted with care, designed to delight
              </h2>
              <p className="font-body text-ink-soft text-lg leading-relaxed">
                Fusiey is built around a simple idea: creative play should feel effortless. Every
                kit is carefully assembled with the beads, tools, and packaging we'd want for
                ourselves — thoughtfully made, gift-ready out of the box, and all at
                student-friendly prices.
              </p>
            </div>
          </FadeInUp>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Diamond, title: 'Premium Beads',    desc: 'Professional-grade plastic, vibrant after ironing, consistent size and finish.',        bg: 'bg-mint' },
              { icon: Package, title: 'Pegboard & Tools', desc: 'Pegboard, ironing paper, tweezers — every kit ships ready to create out of the box.',   bg: 'bg-sky-candy' },
              { icon: Leaf,    title: 'Eco-Friendly',     desc: 'Sustainably sourced materials and fully recyclable packaging, no unnecessary plastic.', bg: 'bg-lilac' },
              { icon: Box,     title: 'Gift-Ready Box',   desc: 'Beautiful sticker-style packaging that makes the unboxing part of the joy.',            bg: 'bg-peach-candy' },
            ].map((item, i) => (
              <FadeStickOn key={item.title} delay={0.08 * (i + 1)} rotate={i % 2 === 0 ? -3 : 3}>
                <div className="fsy-sticker group text-center p-6 rounded-[16px] bg-paper h-full">
                  <div
                    className={`fsy-bead w-12 h-12 border-[3px] border-ink ${item.bg} flex items-center justify-center mb-4 mx-auto`}
                    style={{ boxShadow: 'var(--shadow-sticker), inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }}
                  >
                    <item.icon className="w-6 h-6 text-ink" />
                  </div>
                  <h4 className="font-cute font-bold text-ink text-base mb-2">{item.title}</h4>
                  <p className="font-body text-ink-soft text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeStickOn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS (merged with operational trust facts) =====
          Each step now carries its own guarantee tags (shipping, returns,
          secure checkout). Replaces the separate TRUST STRIP section. */}
      <RainbowDivider />
      <section className="px-5 sm:px-8 py-16 sm:py-24 bg-paper-warm/70">
        <div className="max-w-6xl mx-auto">
          <FadeInUp>
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <div className="flex justify-center mb-4"><Eyebrow>How It Works</Eyebrow></div>
              <h2 className="font-cute font-bold text-ink text-3xl md:text-4xl mb-5">
                From idea to your door in 3 steps
              </h2>
              <p className="font-body text-ink-soft text-lg leading-relaxed">
                Simple to start, secure to buy, shipped from our dual CN/UK warehouses
                with honest returns — no surprises.
              </p>
            </div>
          </FadeInUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: Palette,
                bg: 'bg-cotton',
                title: 'Design or Choose',
                desc: 'Create a custom pattern with our designer, or pick from our curated collection of official Fusiey templates.',
                tags: ['Free to try'],
              },
              {
                step: '02',
                icon: ShieldCheck,
                bg: 'bg-sky-candy',
                title: 'Order',
                // TODO: payment gateway decision pending (Airwallex + PayPal planned).
                // Update tags below once the primary rail is confirmed.
                desc: 'Checkout with trusted payment partners. Card details never touch our servers, every order is encrypted end to end.',
                tags: ['Encrypted', 'Multiple methods'],
              },
              {
                step: '03',
                icon: Truck,
                bg: 'bg-peach-candy',
                title: 'Receive & Create',
                desc: 'Shipped from our China or UK warehouse — usually 7–14 days. Everything you need is in the box, ready to create.',
                tags: ['Free UK > £50', '30-day returns*'],
              },
            ].map((s, i) => (
              <FadeStickOn key={s.title} delay={0.1 * (i + 1)} rotate={i === 1 ? 3 : -3}>
                <div className="fsy-sticker bg-paper rounded-[16px] p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`fsy-bead w-14 h-14 border-[3px] border-ink ${s.bg} flex items-center justify-center`}
                      style={{ boxShadow: 'var(--shadow-sticker), inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }}
                    >
                      <s.icon className="w-7 h-7 text-ink" />
                    </div>
                    <span className="fsy-tag">{s.step}</span>
                  </div>
                  <h3 className="font-cute font-bold text-ink text-lg mb-2">{s.title}</h3>
                  <p className="font-body text-ink-soft text-sm leading-relaxed mb-4 flex-1">{s.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {s.tags.map((t) => (
                      <span key={t} className="fsy-tag">{t}</span>
                    ))}
                  </div>
                </div>
              </FadeStickOn>
            ))}
          </div>

          {/* Cross-cutting support promise + returns footnote */}
          <FadeInUp delay={0.5}>
            <div className="mt-10 flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-2 font-body text-ink-soft">
                <MessageCircle className="w-5 h-5" />
                <span>
                  Questions? Message us on WhatsApp or email — we reply within 24 hours.
                </span>
              </div>
              <p className="font-body text-xs text-ink-hint">
                * Non-custom, unopened items only. Custom designs are final sale.
              </p>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* ===== NEWSLETTER ===== */}
      <RainbowDivider />
      <section className="px-5 sm:px-8 py-16 sm:py-24 bg-paper/70">
        <FadeInUp>
          <div className="fsy-sticker max-w-4xl mx-auto relative overflow-hidden rounded-[24px] bg-cotton p-6 sm:p-12 md:p-16 text-center">
            {/* Decorative beads — hidden on mobile (overlap content in narrow
                widths). Corner placement only works when the banner has
                generous horizontal padding; restored from sm up. */}
            <div className="hidden sm:block absolute top-4  left-6  fsy-bead w-10 h-10 border-[3px] border-ink bg-butter"
                 style={{ boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }} />
            <div className="hidden sm:block absolute bottom-6 right-8 fsy-bead w-14 h-14 border-[3px] border-ink bg-mint"
                 style={{ boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }} />
            <div className="hidden sm:block absolute top-1/3 right-6 fsy-bead w-8  h-8  border-[3px] border-ink bg-sky-candy"
                 style={{ boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }} />
            <div className="hidden sm:block absolute bottom-8 left-10 fsy-bead w-7 h-7 border-[3px] border-ink bg-lilac"
                 style={{ boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }} />

            <div className="relative z-10">
              <div className="flex justify-center mb-4">
                <span className="fsy-tag uppercase tracking-[0.08em] bg-paper">
                  <Mail className="w-4 h-4" />
                  Join the Craft Club
                </span>
              </div>
              <h2 className="font-cute font-bold text-ink text-3xl md:text-4xl mb-4">
                Get {pct}% off your first kit
              </h2>
              <p className="font-body text-ink-soft text-lg mb-8 max-w-xl mx-auto">
                New patterns, seasonal drops, and the occasional bead meme — straight to your inbox.
                No spam, unsubscribe any time.
              </p>
              <NewsletterForm percent={pct} />
            </div>
          </div>
        </FadeInUp>
      </section>

      {/* ===== FOOTER ===== */}
      <RainbowDivider />
      <footer className="bg-paper-warm/80 px-5 sm:px-8 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo-main.svg" alt="Fusiey" className="h-10 w-10" />
                <img src="/logo-text.svg" alt="Fusiey" className="h-5" />
              </div>
              <p className="font-body text-sm text-ink-soft leading-relaxed">
                Custom perler bead art and starter kits. Designed with love, delivered across the UK and USA.
              </p>
            </div>

            <div>
              <h4 className="font-body font-extrabold text-ink text-sm uppercase tracking-[0.08em] mb-4">Shop</h4>
              <ul className="space-y-3">
                <li><Link to="/products" className="font-body text-sm text-ink-soft hover:text-ink hover:underline decoration-[2px] underline-offset-4">Starter Kits</Link></li>
                <li><Link to="/designer" className="font-body text-sm text-ink-soft hover:text-ink hover:underline decoration-[2px] underline-offset-4">Designer</Link></li>
                <li><Link to="/orders" className="font-body text-sm text-ink-soft hover:text-ink hover:underline decoration-[2px] underline-offset-4">My Orders</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-body font-extrabold text-ink text-sm uppercase tracking-[0.08em] mb-4">Company</h4>
              <ul className="space-y-3">
                <li><span className="font-body text-sm text-ink-hint">About Us</span></li>
                <li><span className="font-body text-sm text-ink-hint">Contact</span></li>
                <li><span className="font-body text-sm text-ink-hint">Blog</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-body font-extrabold text-ink text-sm uppercase tracking-[0.08em] mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><Link to="/legal/privacy" className="font-body text-sm text-ink-soft hover:text-ink hover:underline decoration-[2px] underline-offset-4">Privacy Policy</Link></li>
                <li><Link to="/legal/terms" className="font-body text-sm text-ink-soft hover:text-ink hover:underline decoration-[2px] underline-offset-4">Terms of Service</Link></li>
                <li><Link to="/legal/refunds" className="font-body text-sm text-ink-soft hover:text-ink hover:underline decoration-[2px] underline-offset-4">Refunds &amp; Returns</Link></li>
                <li><Link to="/legal/shipping" className="font-body text-sm text-ink-soft hover:text-ink hover:underline decoration-[2px] underline-offset-4">Shipping</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t-[3px] border-ink flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body text-sm text-ink-hint">&copy; 2026 Fusiey. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <span className="fsy-tag">UK</span>
              <span className="fsy-tag">USA</span>
            </div>
          </div>
        </div>
      </footer>

      </div>{/* /content z-10 wrapper */}
    </div>
  );
}
