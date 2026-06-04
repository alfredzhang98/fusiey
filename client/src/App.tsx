import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X, Home, Palette, Package, BookMarked, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from './lib/utils';
import { useAuthStore } from './store/useAuthStore';

const NAV_ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/designer', label: 'Designer', icon: Palette },
  { path: '/products', label: 'Products', icon: Package },
];

// Shown only when logged in — inserted after the public nav items.
const AUTH_NAV_ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/my-works', label: 'My Works', icon: BookMarked },
];

export default function App() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, fetchMe, logout } = useAuthStore();

  // Rehydrate user from cookie on first mount.
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const navItems = user ? [...NAV_ITEMS, ...AUTH_NAV_ITEMS] : NAV_ITEMS;

  // Close mobile drawer when route changes.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll while drawer is open on mobile.
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-blush font-body text-ink selection:bg-butter selection:text-ink">
      {/* =====================================================================
          Navigation — sticker-styled sticky header.
          Desktop (md+): logo + inline nav + Sign In / Get Started.
          Mobile (<md):  logo + hamburger. Drawer slides down with full menu.
          ===================================================================== */}
      <nav className="sticky top-0 z-50 bg-paper-warm/90 backdrop-blur-sm border-b-[3px] border-ink">
        <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 lg:px-10">
          {/* Left: logo + desktop nav */}
          <div className="flex items-center gap-4 lg:gap-8">
            <Link to="/" className="shrink-0" aria-label="Fusiey home">
              <img src="/logo-main.svg" alt="Fusiey" className="h-8 sm:h-9 md:h-10" />
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 font-cute font-semibold text-sm rounded-pill transition-colors whitespace-nowrap',
                      active ? 'bg-butter border-[2px] border-ink text-ink' : 'text-ink hover:bg-butter/60',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: auth on desktop, hamburger on mobile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                {/* Credits badge — little sparkle chip */}
                <div
                  className="hidden md:inline-flex items-center gap-1 h-8 px-3 bg-butter border-[2px] border-ink rounded-pill font-pixel-mono text-xs text-ink"
                  title={`${user.generateCredits} AI generations · ${user.communityPoints} community points`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {user.generateCredits}
                </div>
                <span className="hidden md:inline font-cute font-semibold text-sm text-ink max-w-[140px] truncate">
                  {user.name}
                </span>
                <button
                  onClick={() => logout()}
                  className="hidden md:inline-flex items-center font-cute font-semibold text-sm text-ink-hint hover:text-ink hover:underline decoration-[2px] underline-offset-4 px-2 py-2"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden md:inline-flex items-center font-cute font-semibold text-sm text-ink hover:underline decoration-[2px] underline-offset-4 px-3 py-2 whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="fsy-btn fsy-btn-sm bg-cotton hover:bg-accent-hover whitespace-nowrap hidden md:inline-flex"
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile hamburger — wrapped so md:hidden on the wrapper wins
                over .fsy-btn's display: inline-flex. */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-pill border-[2px] border-ink bg-paper text-ink hover:bg-butter transition-colors"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer — slide down under the nav bar */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden border-t-[3px] border-ink bg-paper-warm"
            >
              <div className="flex flex-col gap-1 p-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'inline-flex items-center gap-3 px-4 py-3 font-cute font-semibold text-base rounded-md border-[2px] transition-colors',
                        active ? 'bg-butter border-ink text-ink' : 'border-transparent text-ink hover:bg-butter/60',
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
                <div className="pt-3 mt-2 border-t-[2px] border-ink/20 flex flex-col gap-2">
                  <Link
                    to="/login"
                    className="fsy-btn bg-paper w-full justify-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="fsy-btn bg-cotton w-full justify-center"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Page Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
