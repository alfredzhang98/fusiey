/**
 * Fusiey — Interactive primitives
 *
 * Scroll-linked parallax, 3D sticker tilt, sticker peel-in reveal,
 * top scroll-progress bar, and a cursor-following bead. All built on
 * existing Framer Motion — no new dependencies.
 *
 * Usage: mount <ScrollProgress />, <CursorBead />, <ParallaxBeads /> once
 * per page (typically at the top of the page component). Wrap card-like
 * elements in <FadeStickOn> and, if they're primary cards, <TiltCard>.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';

// =====================================================================
// ScrollProgress — thin butter bar across the top, fills as user scrolls.
// Fixed, zero-blur, plum border — fits the sticker aesthetic.
// =====================================================================
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 20, mass: 0.3 });
  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[6px] bg-butter border-b-[2px] border-ink origin-left z-[60] pointer-events-none"
      style={{ scaleX }}
    />
  );
}

// =====================================================================
// CursorBead — a plum-outlined cotton-pink bead that trails the cursor.
// Hidden on touch/mobile. Uses spring damping for satisfying lag.
// =====================================================================
export function CursorBead() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 300, damping: 25, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 300, damping: 25, mass: 0.4 });

  useEffect(() => {
    // Skip on touch devices — cursor followers are noise there.
    const isTouch =
      typeof window !== 'undefined' &&
      (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    if (isTouch) return;

    const move = (e: MouseEvent) => {
      x.set(e.clientX - 10);
      y.set(e.clientY - 10);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 w-5 h-5 rounded-full bg-cotton border-[2px] border-ink pointer-events-none z-[55] hidden md:block"
      style={{
        x: sx,
        y: sy,
        boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)',
      }}
    />
  );
}

// =====================================================================
// ParallaxBeads — a fixed layer of decorative beads behind the page,
// each translating at a different speed as the user scrolls. Extends
// the Hero's bead scatter across the whole page, weaving the brand
// motif into every section.
// =====================================================================
interface BeadSpec {
  x: string;      // CSS position (e.g. '5%')
  y: string;      // vertical start (e.g. '20%')
  size: number;   // px
  color: string;  // CSS var for a MARD-221 bead
  speed: number;  // parallax multiplier (0 = locked, 1 = 100vh per scroll unit)
}

const DEFAULT_BEADS: BeadSpec[] = [
  { x: '4%',  y: '110%', size: 56, color: 'var(--color-bead-E4)', speed: 0.25 },
  { x: '92%', y: '140%', size: 40, color: 'var(--color-bead-C3)', speed: 0.18 },
  { x: '8%',  y: '180%', size: 72, color: 'var(--color-bead-A4)', speed: 0.35 },
  { x: '88%', y: '220%', size: 48, color: 'var(--color-bead-B3)', speed: 0.22 },
  { x: '3%',  y: '260%', size: 36, color: 'var(--color-bead-D6)', speed: 0.30 },
  { x: '94%', y: '300%', size: 28, color: 'var(--color-bead-E7)', speed: 0.15 },
  { x: '6%',  y: '360%', size: 60, color: 'var(--color-bead-A11)', speed: 0.28 },
  { x: '90%', y: '400%', size: 44, color: 'var(--color-bead-D19)', speed: 0.20 },
  { x: '2%',  y: '460%', size: 32, color: 'var(--color-bead-C13)', speed: 0.32 },
  { x: '95%', y: '510%', size: 52, color: 'var(--color-bead-G1)', speed: 0.24 },
];

export function ParallaxBeads({ beads = DEFAULT_BEADS }: { beads?: BeadSpec[] }) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
    >
      {beads.map((b, i) => (
        <ParallaxBead key={i} {...b} />
      ))}
    </div>
  );
}

function ParallaxBead({ x, y, size, color, speed }: BeadSpec) {
  const { scrollY } = useScroll();
  // Scroll-linked vertical translate — each bead moves at a fraction of scroll.
  const dy = useTransform(scrollY, (v) => -v * speed);
  return (
    <motion.div
      className="absolute rounded-full border-[3px] border-ink"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: color,
        y: dy,
        boxShadow:
          '3px 3px 0 0 var(--color-ink), inset 1.5px 1.5px 0 rgba(255,255,255,0.55)',
        willChange: 'transform',
      }}
    />
  );
}

// =====================================================================
// FadeStickOn — replaces FadeInUp. Cards enter with a tiny rotation and
// offset, then spring-settle into place, like a sticker being pressed on.
// Uses once-per-element viewport trigger (no re-fire on scroll back).
// =====================================================================
export function FadeStickOn({
  children,
  delay = 0,
  rotate = -3,
  y = 40,
}: {
  children: ReactNode;
  delay?: number;
  rotate?: number;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, rotate, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        type: 'spring',
        stiffness: 140,
        damping: 14,
        mass: 0.6,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

// =====================================================================
// TiltCard — 3D perspective tilt driven by mouse position. Wrap any
// card-like element to give it trading-card / peel-sticker feel.
// =====================================================================
export function TiltCard({
  children,
  className = '',
  max = 6,
  perspective = 1000,
}: {
  children: ReactNode;
  className?: string;
  max?: number;       // max tilt angle in degrees
  perspective?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Spring-smooth the tilt so it doesn't snap.
  const sx = useSpring(x, { stiffness: 180, damping: 18, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 180, damping: 18, mass: 0.3 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div style={{ perspective: `${perspective}px` }} className={className}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
        className="h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

// =====================================================================
// Brand confetti palette — mirrors Fusiey's candy pastels. Feed to
// canvas-confetti for on-brand celebration bursts.
// =====================================================================
export const FUSIEY_CONFETTI_COLORS = [
  '#F7A5B8', // cotton
  '#FFF4C0', // butter
  '#B8DFCA', // mint
  '#AFDCEB', // sky
  '#E1B8DF', // lilac
  '#FDC6A9', // peach
];
