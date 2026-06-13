import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

/** Friendly 404 — keeps the bead/sticker aesthetic instead of a blank page. */
export function NotFoundPage() {
  const beads = ['bg-cotton', 'bg-butter', 'bg-mint', 'bg-sky-candy', 'bg-lilac'];
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="flex justify-center gap-2 mb-6" aria-hidden="true">
        {beads.map((bg, i) => (
          <motion.div
            key={bg}
            className={cn('fsy-bead w-10 h-10 border-[2px] border-ink', bg)}
            style={{ boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <h1 className="font-cute font-bold text-ink text-5xl mb-2">404</h1>
      <h2 className="font-cute font-bold text-ink text-xl mb-3">Page not found</h2>
      <p className="font-body text-ink-hint mb-8">
        That bead rolled off the board — the page you're after doesn't exist.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <Link to="/" className="fsy-btn bg-cotton gap-2">
          <Home className="w-4 h-4" /> Home
        </Link>
        <Link to="/products" className="fsy-btn bg-paper gap-2">
          <Search className="w-4 h-4" /> Browse shop
        </Link>
      </div>
    </div>
  );
}
