/**
 * AuroraBackground — continuously drifting pastel light blobs.
 *
 * Four large soft-edged colored circles (cotton / butter / mint / lilac)
 * each travel their own slow orbit with different durations and phases.
 * Heavy CSS blur + transparent overlap creates a dreamy aurora-like
 * ambient glow that never stops flowing — no scroll required.
 *
 * Placed absolute inside the Hero section (z-0). Floating beads sit
 * above at z-1, content at z-10. No pointer events.
 */
import { motion } from 'motion/react';

type Blob = {
  color: string;
  size: string;     // CSS size (vw units work best — scales with viewport)
  left: string;     // starting left position (% of hero)
  top: string;      // starting top position
  duration: number; // seconds per loop
  delay: number;    // phase offset
  xPath: string[];  // translate-X keyframes (% of own width)
  yPath: string[];  // translate-Y keyframes
};

const BLOBS: Blob[] = [
  {
    color: '#F7A5B8', // cotton — warm pink
    size: '48vw',
    left: '-10%',
    top: '-5%',
    duration: 10,
    delay: 0,
    xPath: ['0%', '50%', '20%', '0%'],
    yPath: ['0%', '30%', '50%', '0%'],
  },
  {
    color: '#FFF4C0', // butter — highlight yellow
    size: '52vw',
    left: '55%',
    top: '-10%',
    duration: 13,
    delay: 2,
    xPath: ['0%', '-30%', '10%', '0%'],
    yPath: ['0%', '40%', '20%', '0%'],
  },
  {
    color: '#B8DFCA', // mint — green
    size: '46vw',
    left: '-5%',
    top: '50%',
    duration: 11,
    delay: 4,
    xPath: ['0%', '40%', '70%', '0%'],
    yPath: ['0%', '-25%', '15%', '0%'],
  },
  {
    color: '#E1B8DF', // lilac — purple
    size: '44vw',
    left: '50%',
    top: '55%',
    duration: 12,
    delay: 3,
    xPath: ['0%', '30%', '-20%', '0%'],
    yPath: ['0%', '-40%', '-10%', '0%'],
  },
];

/**
 * @param fixed When true (default), mounts as viewport-fixed so the aurora
 * is visible behind every section as the user scrolls. When false, behaves
 * like an absolute-positioned decoration scoped to the parent (legacy).
 */
export function AuroraBackground({ fixed = true }: { fixed?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 overflow-hidden pointer-events-none z-0`}
    >
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: b.left,
            top: b.top,
            background: b.color,
            // Blur via CSS var so mobile can drop to a cheaper value.
            // Default (desktop) = 90px; mobile override in index.css.
            filter: 'blur(var(--aurora-blur, 90px))',
            opacity: 0.55,
            willChange: 'transform',
          }}
          animate={{ x: b.xPath, y: b.yPath }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
