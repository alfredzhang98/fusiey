import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingBag, TrendingUp, Users, Loader2,
  Plus, Pencil, Trash2, CheckCircle, Truck, XCircle, Save, ArrowLeft, Clock,
  AlertTriangle, Receipt, Download, Settings as SettingsIcon,
  Images, Upload, Copy, RotateCcw, X, ArrowUp, ArrowDown, FileText,
  ChevronDown, Check,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  adminApi, productsApi, ordersApi, mediaApi,
  type ProductItem, type OrderDetail, type OrderStatusEnum, type DashboardStats,
  type LedgerResponse, type ShippingConfig, type MediaFolder, type MediaAsset,
  type PatternData, type ProductWriteBody,
} from '../services/api';
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import { PALETTES } from '../constants/palettes';
import { renderThumbnail } from '../utils/patternThumbnail';
import { cn } from '../lib/utils';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Tab = 'dashboard' | 'products' | 'orders' | 'accounting' | 'settings' | 'media';

/** Styled dropdown (replaces the plain native <select>). */
function FancySelect({ value, options, onChange, placeholder = 'Select…' }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 flex items-center justify-between gap-2 bg-paper-warm border-[2px] border-ink/25 hover:border-ink rounded-[10px] font-body text-sm text-ink outline-none transition-colors"
      >
        <span className={cn(!current && 'text-ink-hint')}>{current?.label ?? placeholder}</span>
        <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-paper border-[2px] border-ink rounded-[12px] p-1 overflow-hidden"
            style={{ boxShadow: '3px 3px 0 0 var(--color-ink)' }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] font-cute font-semibold text-sm text-left transition-colors',
                  value === o.value ? 'bg-butter text-ink' : 'text-ink hover:bg-butter/40',
                )}
              >
                {o.label}
                {value === o.value && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="text-ink-hint hover:text-ink transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-cute font-bold text-ink text-3xl">Admin</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {([
          { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { key: 'products', label: 'Products', icon: Package },
          { key: 'orders', label: 'Orders', icon: ShoppingBag },
          { key: 'media', label: 'Media', icon: Images },
          { key: 'accounting', label: 'Accounting', icon: Receipt },
          { key: 'settings', label: 'Settings', icon: SettingsIcon },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 font-cute font-semibold text-sm rounded-pill border-[2px] transition-colors',
              tab === key
                ? 'bg-ink text-paper border-ink'
                : 'bg-paper text-ink border-ink/30 hover:bg-butter/40',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'products' && <ProductManager />}
      {tab === 'orders' && <OrderManager />}
      {tab === 'media' && <MediaLibrary />}
      {tab === 'accounting' && <Accounting />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

// ─────────────────── Settings (shipping rules) ─────────────────────────────

function Settings() {
  const [cfg, setCfg] = useState<ShippingConfig>({
    GBP: { freeOver: 50, fee: 4.99 },
    USD: { freeOver: 65, fee: 6.99 },
  });
  // Store settings
  const [pct, setPct] = useState('10');
  const [annEnabled, setAnnEnabled] = useState(false);
  const [annText, setAnnText] = useState('');
  const [tiktok, setTiktok] = useState('');
  // Watermark
  const [wmEnabled, setWmEnabled] = useState(true);
  const [wmOpacity, setWmOpacity] = useState('12');
  const [wmStyle, setWmStyle] = useState<'diagonal' | 'tiled' | 'corner'>('diagonal');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy2, setBusy2] = useState(false);
  const [saved2, setSaved2] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const all = await adminApi.getConfig();
        if (all.shipping) setCfg((c) => ({
          GBP: { ...c.GBP, ...all.shipping.GBP },
          USD: { ...c.USD, ...all.shipping.USD },
        }));
        if (all.welcomeDiscountPercent != null) setPct(String(all.welcomeDiscountPercent));
        if (all.announcement) { setAnnEnabled(!!all.announcement.enabled); setAnnText(all.announcement.text || ''); }
        if (typeof all.tiktokUrl === 'string') setTiktok(all.tiktokUrl);
        if (all.watermark) {
          setWmEnabled(all.watermark.enabled !== false);
          if (all.watermark.opacity != null) setWmOpacity(String(all.watermark.opacity));
          if (all.watermark.style) setWmStyle(all.watermark.style);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (region: 'GBP' | 'USD', field: 'freeOver' | 'fee', value: string) => {
    const n = parseFloat(value);
    setCfg((c) => ({ ...c, [region]: { ...c[region], [field]: isNaN(n) ? 0 : n } }));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.saveConfig('shipping', cfg);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveStore = async () => {
    setBusy2(true);
    setError(null);
    try {
      await adminApi.saveConfig('welcomeDiscountPercent', Math.max(1, Math.min(100, parseInt(pct) || 10)));
      await adminApi.saveConfig('announcement', { enabled: annEnabled, text: annText.trim() });
      await adminApi.saveConfig('tiktokUrl', tiktok.trim());
      await adminApi.saveConfig('watermark', {
        enabled: wmEnabled,
        opacity: Math.max(1, Math.min(100, parseInt(wmOpacity) || 12)),
        style: wmStyle,
      });
      setSaved2(true);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy2(false);
    }
  };

  if (loading) return <Spinner />;

  const region = (key: 'GBP' | 'USD', sym: string, label: string) => (
    <div className="fsy-card space-y-3">
      <h3 className="font-cute font-bold text-ink text-base">{label}</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          Free shipping over ({sym})
          <input
            type="number" step="0.01" min="0"
            value={cfg[key].freeOver}
            onChange={(e) => setField(key, 'freeOver', e.target.value)}
            className="fsy-input"
          />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          Shipping fee ({sym})
          <input
            type="number" step="0.01" min="0"
            value={cfg[key].fee}
            onChange={(e) => setField(key, 'fee', e.target.value)}
            className="fsy-input"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl">
      {error && <p className="font-body text-red-600 text-sm">{error}</p>}

      {/* Shipping */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-ink" />
          <h2 className="font-cute font-bold text-ink text-xl">Shipping rules</h2>
        </div>
        <p className="font-body text-ink-hint text-sm">
          Free-shipping threshold + flat fee per region, in that region's own currency.
          Digital-only orders always ship free.
        </p>
        {region('GBP', '£', 'United Kingdom (GBP £)')}
        {region('USD', '$', 'United States (USD $)')}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="fsy-btn fsy-btn-sm bg-cotton gap-1.5 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {busy ? 'Saving…' : 'Save shipping'}
          </button>
          {saved && <span className="font-cute font-semibold text-mint text-sm">Saved ✓</span>}
        </div>
      </div>

      {/* Store settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-ink" />
          <h2 className="font-cute font-bold text-ink text-xl">Store settings</h2>
        </div>

        <div className="fsy-card space-y-4">
          <label className="flex flex-col gap-1 font-body text-xs text-ink-soft max-w-[200px]">
            Welcome discount (%)
            <input type="number" min="1" max="100" value={pct}
              onChange={(e) => { setPct(e.target.value); setSaved2(false); }} className="fsy-input" />
            <span className="text-ink-hint text-[11px]">First-kit code emailed from the homepage. Applies to new codes only.</span>
          </label>

          <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
            TikTok URL
            <input type="url" value={tiktok}
              onChange={(e) => { setTiktok(e.target.value); setSaved2(false); }} className="fsy-input"
              placeholder="https://www.tiktok.com/@fusiey" />
          </label>

          <div className="space-y-2">
            <label className="flex items-center gap-2 font-body text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={annEnabled}
                onChange={(e) => { setAnnEnabled(e.target.checked); setSaved2(false); }}
                className="w-4 h-4 accent-[color:var(--color-ink)]" />
              Show homepage announcement banner
            </label>
            <input type="text" value={annText} maxLength={300}
              onChange={(e) => { setAnnText(e.target.value); setSaved2(false); }} className="fsy-input"
              placeholder="e.g. Lunar New Year — orders ship from Feb 12" />
          </div>

          {/* Image watermark */}
          <div className="border-t border-ink/15 pt-4 space-y-3">
            <label className="flex items-center gap-2 font-body text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={wmEnabled}
                onChange={(e) => { setWmEnabled(e.target.checked); setSaved2(false); }}
                className="w-4 h-4 accent-[color:var(--color-ink)]" />
              Watermark uploaded product images
            </label>
            <p className="font-body text-[11px] text-ink-hint -mt-1">
              Applies the Fusiey logo to images uploaded in the Media library (not to pattern files). Existing images aren't changed.
            </p>
            {wmEnabled && (
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                  Opacity (%)
                  <input type="number" min="1" max="100" value={wmOpacity}
                    onChange={(e) => { setWmOpacity(e.target.value); setSaved2(false); }} className="fsy-input" />
                </label>
                <div className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                  Style
                  <FancySelect
                    value={wmStyle}
                    options={[
                      { value: 'diagonal', label: 'Centered diagonal' },
                      { value: 'tiled', label: 'Tiled' },
                      { value: 'corner', label: 'Corner' },
                    ]}
                    onChange={(v) => { setWmStyle(v as any); setSaved2(false); }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveStore} disabled={busy2} className="fsy-btn fsy-btn-sm bg-cotton gap-1.5 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {busy2 ? 'Saving…' : 'Save store settings'}
            </button>
            {saved2 && <span className="font-cute font-semibold text-mint text-sm">Saved ✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Accounting ledger ─────────────────────────────────────

const STATUS_OPTIONS: ('' | OrderStatusEnum)[] = [
  '', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
];

function Accounting() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = () => ({ from: from || undefined, to: to || undefined, status: status || undefined });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminApi.ledger(query()));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await adminApi.exportLedgerCsv(query());
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const sym = (c: string) => (c === 'USD' ? '$' : '£');
  const money = (n: number, c: string) => `${sym(c)}${n.toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="fsy-card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="fsy-input" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="fsy-input" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="fsy-input">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s || 'All'}</option>
            ))}
          </select>
        </label>
        <button onClick={load} className="fsy-btn fsy-btn-sm bg-cotton">Apply</button>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="fsy-btn fsy-btn-sm bg-mint gap-1.5 disabled:opacity-50 ml-auto"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export CSV
        </button>
      </div>

      {loading ? <Spinner /> : error ? <Error msg={error} /> : data && (
        <>
          {/* Totals per currency (excludes cancelled / refunded — never summed across currencies) */}
          {data.totals.length === 0 ? (
            <p className="font-body text-ink-hint text-sm">No counted revenue in this range.</p>
          ) : (
            data.totals.map((t) => (
              <div key={t.currency}>
                <h3 className="font-cute font-bold text-ink text-sm mb-2">
                  {t.currency} · {t.count} order{t.count === 1 ? '' : 's'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Net revenue', value: money(t.total, t.currency), bg: 'bg-mint' },
                    { label: 'Subtotal', value: money(t.subtotal, t.currency), bg: 'bg-butter' },
                    { label: 'Discounts', value: `−${money(t.discount, t.currency)}`, bg: 'bg-cotton' },
                    { label: 'Shipping', value: money(t.shipping, t.currency), bg: 'bg-sky-candy' },
                    { label: 'VAT (incl.)', value: money(t.vat, t.currency), bg: 'bg-lilac' },
                  ].map((c) => (
                    <div key={c.label} className="fsy-card flex flex-col gap-1">
                      <span className={cn('fsy-bead w-7 h-7 border-[2px] border-ink', c.bg)} />
                      <span className="font-pixel-mono text-ink text-lg">{c.value}</span>
                      <span className="font-body text-ink-hint text-[11px]">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <p className="font-body text-ink-hint text-xs">
            {data.countedCount} counted order{data.countedCount === 1 ? '' : 's'} ·
            {' '}{data.count} total in range (cancelled/refunded excluded from totals).
          </p>

          {/* Ledger table */}
          <div className="fsy-card overflow-x-auto">
            <table className="w-full text-left font-body text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b-[2px] border-ink/20 text-[10px] uppercase tracking-[0.06em] text-ink">
                  <th className="py-2 pr-3 font-extrabold">Order</th>
                  <th className="py-2 pr-3 font-extrabold">Date</th>
                  <th className="py-2 pr-3 font-extrabold">Customer</th>
                  <th className="py-2 pr-3 font-extrabold">Status</th>
                  <th className="py-2 pr-3 font-extrabold">Paid</th>
                  <th className="py-2 pr-3 font-extrabold text-right">Subtotal</th>
                  <th className="py-2 pr-3 font-extrabold">Code</th>
                  <th className="py-2 pr-3 font-extrabold text-right">Disc.</th>
                  <th className="py-2 pr-3 font-extrabold text-right">Ship</th>
                  <th className="py-2 pr-3 font-extrabold text-right">VAT</th>
                  <th className="py-2 pr-3 font-extrabold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-ink/10">
                    <td className="py-2 pr-3 font-pixel-mono">#{r.id.slice(-6).toUpperCase()}</td>
                    <td className="py-2 pr-3">{new Date(r.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className="py-2 pr-3 max-w-[160px] truncate" title={r.customerEmail}>{r.customerName || r.customerEmail}</td>
                    <td className="py-2 pr-3"><span className="fsy-tag text-[9px]">{r.status}</span></td>
                    <td className="py-2 pr-3">{r.paid ? '✓' : '—'}</td>
                    <td className="py-2 pr-3 text-right">{money(r.subtotal, r.currency)}</td>
                    <td className="py-2 pr-3 text-ink-hint">{r.discountCode || '—'}</td>
                    <td className="py-2 pr-3 text-right">{r.discount ? `−${money(r.discount, r.currency)}` : '—'}</td>
                    <td className="py-2 pr-3 text-right">{money(r.shipping, r.currency)}</td>
                    <td className="py-2 pr-3 text-right">{money(r.vat, r.currency)}</td>
                    <td className="py-2 pr-3 text-right font-cute font-bold">{money(r.total, r.currency)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr><td colSpan={11} className="py-6 text-center text-ink-hint">No orders in this range</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────── Dashboard ────────────────────────────────────────────

function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [d, inv] = await Promise.all([adminApi.dashboard(), adminApi.inventory()]);
        setData(d);
        setLowStock(
          inv.products.filter((p) => p.stock <= 10).sort((a, b) => a.stock - b.stock),
        );
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <Error msg={error} />;
  if (!data) return null;

  const { stats, recentOrders } = data;

  // Per-currency revenue (GBP/USD shown separately, never summed together).
  const revenueText = stats.revenueByCurrency.length === 0
    ? '£0.00'
    : stats.revenueByCurrency
        .map((r) => `${r.currency === 'USD' ? '$' : '£'}${r.total.toFixed(2)}`)
        .join('  ·  ');

  const cards = [
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, bg: 'bg-butter' },
    { label: 'Revenue', value: revenueText, icon: TrendingUp, bg: 'bg-mint' },
    { label: 'Users', value: stats.totalUsers, icon: Users, bg: 'bg-sky-candy' },
    { label: 'Products', value: stats.totalProducts, icon: Package, bg: 'bg-lilac' },
  ];

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="fsy-card flex flex-col gap-2">
            <div className={cn('fsy-bead w-10 h-10 border-[2px] border-ink flex items-center justify-center', c.bg)}>
              <c.icon className="w-5 h-5 text-ink" />
            </div>
            <span className="font-pixel-mono text-ink text-xl break-words leading-tight">{c.value}</span>
            <span className="font-body text-ink-hint text-xs">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Low-stock alert — products at or below 10 units */}
      {lowStock.length > 0 && (
        <div className="fsy-card border-[2px] border-cotton">
          <h3 className="font-cute font-bold text-ink text-lg mb-3 inline-flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#D9534F]" />
            Low stock — {lowStock.length} item{lowStock.length > 1 ? 's' : ''} at or below 10
          </h3>
          <div className="flex flex-col gap-2">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-paper-warm rounded-[10px] border border-ink/15">
                <span className="font-cute font-semibold text-ink text-sm truncate pr-3">{p.name}</span>
                <span className={cn('fsy-tag shrink-0', p.stock === 0 ? 'bg-cotton text-ink' : 'bg-butter')}>
                  {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order status breakdown */}
      {stats.ordersByStatus && Object.keys(stats.ordersByStatus).length > 0 && (
        <div className="fsy-card">
          <h3 className="font-cute font-bold text-ink text-lg mb-3">Orders by status</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.ordersByStatus).map(([status, count]) => (
              <span key={status} className="fsy-tag bg-butter">
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="fsy-card">
        <h3 className="font-cute font-bold text-ink text-lg mb-3">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body text-sm">
            <thead>
              <tr className="border-b-[2px] border-ink/20">
                <th className="py-2 pr-4 font-extrabold text-[10px] uppercase tracking-[0.08em] text-ink">Order</th>
                <th className="py-2 pr-4 font-extrabold text-[10px] uppercase tracking-[0.08em] text-ink">Customer</th>
                <th className="py-2 pr-4 font-extrabold text-[10px] uppercase tracking-[0.08em] text-ink">Status</th>
                <th className="py-2 pr-4 font-extrabold text-[10px] uppercase tracking-[0.08em] text-ink text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-ink/10">
                  <td className="py-2 pr-4 font-pixel-mono text-xs">#{o.id.slice(-6).toUpperCase()}</td>
                  <td className="py-2 pr-4">{o.user?.name || '-'}</td>
                  <td className="py-2 pr-4">
                    <span className="fsy-tag text-[9px]">{o.status}</span>
                  </td>
                  <td className="py-2 pr-4 text-right font-cute font-bold">{o.currency === 'USD' ? '$' : '£'}{o.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-ink-hint text-center">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Product Manager ──────────────────────────────────────

function ProductManager() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductItem | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);

  const fetchProducts = async () => {
    try {
      // Admin list includes inactive (下架) products.
      const res = await productsApi.adminList({ limit: 100 });
      setProducts(res.products);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await productsApi.remove(id); // soft-delete → 下架
      fetchProducts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const reactivate = async (p: ProductItem) => {
    try {
      await productsApi.update(p.id, { isActive: true });
      fetchProducts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Error msg={error} />;

  const active = products.filter((p) => p.isActive);
  const inactive = products.filter((p) => !p.isActive);

  const row = (p: ProductItem) => (
    <div key={p.id} className={cn('fsy-sticker bg-paper rounded-[14px] p-4 flex items-center gap-4', !p.isActive && 'opacity-70')}>
      <div className="w-14 h-14 rounded-[10px] bg-paper-warm border border-ink/30 overflow-hidden shrink-0">
        {p.images[0] ? (
          <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-6 h-6 text-ink-hint m-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-cute font-bold text-ink text-base truncate">{p.name}</h3>
          {p.sku && <span className="fsy-tag">{p.sku}</span>}
        </div>
        <p className="font-body text-ink-hint text-xs truncate">{p.description}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="font-cute font-bold text-ink text-sm">
            £{p.priceGBP.toFixed(2)}
            {p.priceUSD != null && <span className="text-ink-hint font-body"> · ${p.priceUSD.toFixed(2)}</span>}
          </span>
          <span className={cn('font-body text-xs', p.stock <= p.lowStockThreshold ? 'text-red-500' : 'text-ink-hint')}>
            Stock: {p.stock}
          </span>
          <span className="fsy-tag text-[9px]">{p.category}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setEditing(p)}
          title="Edit"
          className="w-9 h-9 rounded-full border border-ink/30 flex items-center justify-center hover:bg-butter/60 transition-colors"
        >
          <Pencil className="w-4 h-4 text-ink" />
        </button>
        {p.isActive ? (
          <button
            onClick={() => setDeleteTarget(p)}
            title="Unlist (hide from shop)"
            className="w-9 h-9 rounded-full border border-ink/30 flex items-center justify-center hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        ) : (
          <button
            onClick={() => reactivate(p)}
            title="Relist (show in shop)"
            className="w-9 h-9 rounded-full border border-ink/30 flex items-center justify-center hover:bg-mint/40 transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-ink" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-cute font-bold text-ink text-xl">Products</h2>
        <button
          onClick={() => setShowNew(true)}
          className="fsy-btn fsy-btn-sm bg-cotton gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* New / Edit form */}
      {(showNew || editing) && (
        <ProductForm
          initial={editing}
          onSaved={() => { setShowNew(false); setEditing(null); fetchProducts(); }}
          onCancel={() => { setShowNew(false); setEditing(null); }}
        />
      )}

      {products.length === 0 && (
        <p className="text-center text-ink-hint font-body py-12">No products yet</p>
      )}

      {/* Active (listed) products */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-cute font-bold text-ink-soft text-sm uppercase tracking-[0.06em]">
            Live in shop ({active.length})
          </h3>
          {active.map(row)}
        </section>
      )}

      {/* Unlisted (deactivated) products */}
      {inactive.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-cute font-bold text-ink-soft text-sm uppercase tracking-[0.06em] inline-flex items-center gap-2">
            <span className="fsy-tag bg-red-100 text-[9px]">Unlisted</span> Hidden from shop ({inactive.length})
          </h3>
          {inactive.map(row)}
        </section>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Unlist this product?"
        message={`"${deleteTarget?.name ?? ''}" will be hidden from the shop. You can relist it anytime from the Unlisted section.`}
        confirmLabel="Unlist"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─────────────────── Product Form ──────────────────────────────────────────

const MAX_IMAGES = 9;

function ProductForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: ProductItem | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [priceGBP, setPriceGBP] = useState(initial?.priceGBP?.toString() || '');
  const [priceUSD, setPriceUSD] = useState(initial?.priceUSD != null ? String(initial.priceUSD) : '');
  const [category, setCategory] = useState(initial?.category || 'kit-pattern');
  const [stock, setStock] = useState(initial?.stock?.toString() || '0');
  const [images, setImages] = useState<string[]>(initial?.images || []);
  const [urlInput, setUrlInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isCustomisable, setIsCustomisable] = useState(initial?.isCustomisable || false);
  const [tags, setTags] = useState(initial?.tags?.join(', ') || '');
  const [sku, setSku] = useState(initial?.sku || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pattern deliverables
  const [isCertified, setIsCertified] = useState(initial?.isCertifiedPattern || false);
  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [patternFile, setPatternFile] = useState<{ url: string; type: 'pdf' | 'png' } | null>(
    initial?.patternFileUrl ? { url: initial.patternFileUrl, type: (initial.patternFileType as any) || 'pdf' } : null,
  );
  const [patternMsg, setPatternMsg] = useState<string | null>(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const isPattern = category === 'pattern';
  // "Customisable" only makes sense for the add-on categories that appear in
  // the custom-kit order flow.
  const customisableEligible = ['beads', 'refill', 'tool'].includes(category);

  const addImages = (urls: string[]) => {
    setImages((prev) => {
      const merged = [...prev];
      for (const u of urls) {
        if (u && !merged.includes(u) && merged.length < MAX_IMAGES) merged.push(u);
      }
      return merged;
    });
  };
  const addFromUrlInput = () => {
    const urls = urlInput.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    addImages(urls);
    setUrlInput('');
  };
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));
  const moveImage = (i: number, dir: -1 | 1) => setImages((prev) => {
    const next = [...prev];
    const j = i + dir;
    if (j < 0 || j >= next.length) return prev;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const onCertifiedJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      let parsed: any;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        setPatternData(null);
        setError('Invalid pattern JSON: could not parse the file.');
        return;
      }
      if (!Array.isArray(parsed.grid) || !parsed.width || !parsed.height || !parsed.paletteId) {
        setPatternData(null);
        setError('Invalid pattern JSON: missing grid / width / height / paletteId.');
        return;
      }
      // Auto-render a thumbnail from the grid — stored for delivery (buyer's
      // My Works shows it instantly) and used as the default cover image.
      let dataUrl = '';
      try {
        const palette = PALETTES.find((p) => p.id === parsed.paletteId) || PALETTES[0];
        dataUrl = renderThumbnail(parsed, palette);
      } catch { /* ignore render failure */ }
      if (dataUrl) parsed.thumbnail = dataUrl;
      setPatternData(parsed);
      setError(null);
      setPatternMsg(`✓ ${parsed.name || 'pattern'} · ${parsed.width}×${parsed.height} · rendering cover…`);

      // Upload the rendered preview as the default first product image.
      if (dataUrl) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const coverFile = new File([blob], 'pattern-cover.png', { type: 'image/png' });
          const { url } = await productsApi.uploadPatternFile(coverFile);
          setImages((prev) => (prev.includes(url) ? prev : [url, ...prev].slice(0, MAX_IMAGES)));
          setPatternMsg(`✓ ${parsed.name || 'pattern'} · ${parsed.width}×${parsed.height} · cover added`);
        } catch {
          setPatternMsg(`✓ ${parsed.name || 'pattern'} · ${parsed.width}×${parsed.height}`);
        }
      }
    };
    reader.readAsText(file);
  };

  const onPatternFile = async (file: File) => {
    setPatternMsg('Uploading…');
    try {
      const res = await productsApi.uploadPatternFile(file);
      setPatternFile(res);
      setPatternMsg(`✓ ${res.type.toUpperCase()} uploaded`);
      setError(null);
    } catch (err: any) {
      setPatternMsg(null);
      setError(err.message || 'Upload failed');
    }
  };

  const handleSubmit = async () => {
    if (!name || !description || !priceGBP || images.length === 0) {
      setError('Name, description, GBP price, and at least one image are required.');
      return;
    }
    if (isPattern && isCertified && !patternData && !initial?.hasPatternData) {
      setError('Certified patterns need a pattern JSON file.');
      return;
    }
    if (isPattern && !isCertified && !patternFile) {
      setError('Non-certified patterns need a PDF or PNG file to deliver.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: ProductWriteBody = {
        name, description,
        priceGBP: parseFloat(priceGBP),
        // Blank USD = not sold in the US region (send null to clear it).
        priceUSD: priceUSD.trim() ? parseFloat(priceUSD) : null,
        category,
        stock: parseInt(stock) || 0,
        images,
        isCustomisable: customisableEligible ? isCustomisable : false,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        sku: sku || undefined,
      };
      if (isPattern) {
        body.isCertifiedPattern = isCertified;
        if (isCertified) {
          if (patternData) body.patternData = patternData; // only when (re)uploaded
          body.patternFileUrl = null;
          body.patternFileType = null;
        } else {
          body.patternData = null;
          if (patternFile) { body.patternFileUrl = patternFile.url; body.patternFileType = patternFile.type; }
        }
      } else {
        body.isCertifiedPattern = false;
      }
      if (initial) await productsApi.update(initial.id, body);
      else await productsApi.create(body);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fsy-card space-y-4">
      <h3 className="font-cute font-bold text-ink text-lg">
        {initial ? 'Edit Product' : 'New Product'}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft sm:col-span-2">
          Name *
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="fsy-input" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft sm:col-span-2">
          Description *
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="fsy-input min-h-[60px]" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          UK price (£) *
          <input type="number" step="0.01" min="0" value={priceGBP} onChange={(e) => setPriceGBP(e.target.value)} className="fsy-input" placeholder="19.90" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          US price ($)
          <input type="number" step="0.01" min="0" value={priceUSD} onChange={(e) => setPriceUSD(e.target.value)} className="fsy-input" placeholder="Leave blank = not sold in US" />
        </label>
        <p className="sm:col-span-2 -mt-2 font-body text-[11px] text-ink-hint leading-relaxed bg-paper-warm border border-ink/15 rounded-[8px] px-3 py-2">
          💡 Prices are set per region — no exchange-rate conversion. <strong>UK price (£) is required</strong>.
          Fill <strong>US price ($)</strong> only if you sell this item in the US — <strong>leave it blank to not list it in the US</strong>.
        </p>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          SKU
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="fsy-input" placeholder="optional, editable later" />
        </label>
        <div className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          Category
          <FancySelect
            value={category}
            options={PRODUCT_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
            onChange={setCategory}
          />
        </div>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          Stock
          <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="fsy-input" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft sm:col-span-2">
          Tags (comma-separated)
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="fsy-input" placeholder="featured, hot, beginner" />
        </label>
      </div>

      {/* Images (up to 9, first = primary) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-cute font-semibold text-ink text-sm">Images * ({images.length}/{MAX_IMAGES})</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPickerOpen(true)} disabled={images.length >= MAX_IMAGES}
              className="fsy-btn fsy-btn-sm bg-butter gap-1 disabled:opacity-50">
              <Images className="w-3.5 h-3.5" /> From library / upload
            </button>
          </div>
        </div>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={url + i} className="relative w-20 h-20 rounded-[10px] border-[2px] border-ink/30 overflow-hidden group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute top-0 left-0 bg-ink text-paper text-[8px] px-1 rounded-br">Primary</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => moveImage(i, -1)} className="text-paper px-1"><ArrowUp className="w-3 h-3" /></button>
                  <button type="button" onClick={() => moveImage(i, 1)} className="text-paper px-1"><ArrowDown className="w-3 h-3" /></button>
                  <button type="button" onClick={() => removeImage(i)} className="text-paper px-1"><X className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFromUrlInput(); } }}
            placeholder="Paste image URL(s) — space/comma separated" className="fsy-input flex-1 text-sm"
          />
          <button type="button" onClick={addFromUrlInput} disabled={!urlInput.trim() || images.length >= MAX_IMAGES}
            className="fsy-btn fsy-btn-sm bg-paper disabled:opacity-50">Add URL</button>
        </div>
      </div>

      {/* Customisable toggle — only for the custom-kit add-on categories */}
      {customisableEligible && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 font-body text-sm text-ink cursor-pointer">
            <input type="checkbox" checked={isCustomisable} onChange={(e) => setIsCustomisable(e.target.checked)}
              className="w-4 h-4 accent-[color:var(--color-ink)]" />
            Customisable add-on
          </label>
          <button type="button" onClick={() => setFlowOpen(true)}
            className="font-body text-[11px] text-ink underline decoration-dotted underline-offset-2 hover:text-cotton">
            what's this?
          </button>
        </div>
      )}

      {/* Pattern deliverable (pattern category only) */}
      {isPattern && (
        <div className="p-3 bg-lilac/30 border border-ink/20 rounded-[12px] space-y-3">
          <label className="flex items-center gap-2 font-cute font-semibold text-ink text-sm cursor-pointer">
            <input type="checkbox" checked={isCertified} onChange={(e) => setIsCertified(e.target.checked)}
              className="w-4 h-4 accent-[color:var(--color-ink)]" />
            Fusiey Certified pattern (delivers an editable copy to My Works)
          </label>
          {isCertified ? (
            <div className="space-y-1.5">
              <label className="fsy-btn fsy-btn-sm bg-paper gap-1.5 cursor-pointer w-fit">
                <Upload className="w-3.5 h-3.5" /> Upload pattern JSON
                <input type="file" accept="application/json,.json" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onCertifiedJson(e.target.files[0])} />
              </label>
              {(patternMsg || initial?.hasPatternData) && (
                <p className="font-body text-[11px] text-ink-soft">{patternMsg || '✓ Pattern JSON on file (upload to replace)'}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="fsy-btn fsy-btn-sm bg-paper gap-1.5 cursor-pointer w-fit">
                <FileText className="w-3.5 h-3.5" /> Upload pattern file (PDF or PNG)
                <input type="file" accept="application/pdf,image/png,.pdf,.png" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onPatternFile(e.target.files[0])} />
              </label>
              {patternFile && (
                <p className="font-body text-[11px] text-ink-soft">
                  ✓ <a href={patternFile.url} target="_blank" rel="noreferrer" className="underline">{patternFile.type.toUpperCase()} on file</a> (upload to replace)
                </p>
              )}
              {patternMsg && !patternFile && <p className="font-body text-[11px] text-ink-soft">{patternMsg}</p>}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-500 font-body text-xs">{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSubmit} disabled={busy} className="fsy-btn fsy-btn-sm bg-cotton gap-1.5">
          <Save className="w-4 h-4" />
          {busy ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
        <button onClick={onCancel} className="fsy-btn fsy-btn-sm bg-paper">Cancel</button>
      </div>

      {pickerOpen && (
        <MediaPicker
          remaining={MAX_IMAGES - images.length}
          onPick={(urls) => { addImages(urls); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {flowOpen && <CustomFlowInfo onClose={() => setFlowOpen(false)} />}
    </div>
  );
}

/** Explains what a "Customisable add-on" does, as a simple flowchart. */
function CustomFlowInfo({ onClose }: { onClose: () => void }) {
  const steps = [
    { n: '1', t: 'Customer opens My Works', d: 'Their saved bead designs.' },
    { n: '2', t: 'Clicks "Order a kit for my design"', d: 'Then picks one of their designs.' },
    { n: '3', t: 'Add-on selection page', d: 'Shows Customisable products from Bead Kits / Refills / Tools — this product appears here.' },
    { n: '4', t: 'Adds to cart & checks out', d: 'The chosen design is attached to the order.' },
    { n: '5', t: 'You see the design on the order', d: 'Admin → Orders shows the bound design so you can make/ship it.' },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/40" onClick={onClose}>
      <div className="bg-paper border-[3px] border-ink rounded-[16px] w-full max-w-md max-h-[85vh] overflow-y-auto p-5"
        style={{ boxShadow: '5px 5px 0 0 var(--color-ink)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cute font-bold text-ink text-lg">Customisable add-on</h3>
          <button onClick={onClose} className="text-ink-hint hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <p className="font-body text-ink-soft text-sm mb-4">
          Tick this to make a <strong>Bead Kit / Refill / Tool</strong> available as an add-on when a customer
          orders one of their own designs as a custom kit:
        </p>
        <div>
          {steps.map((s, i) => (
            <div key={s.n} className="relative flex gap-3 pb-5 last:pb-0">
              {/* continuous rail behind the circles (not after the last step) */}
              {i < steps.length - 1 && (
                <span className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-ink/25" aria-hidden="true" />
              )}
              <div className="relative z-10 fsy-bead w-7 h-7 border-[2px] border-ink bg-butter flex items-center justify-center shrink-0 font-pixel-mono text-ink text-xs">{s.n}</div>
              <div className="pt-0.5">
                <p className="font-cute font-bold text-ink text-sm">{s.t}</p>
                <p className="font-body text-ink-hint text-xs leading-snug">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Media folder/asset browser (shared logic) ─────────────

function useMediaBrowser(initialCategory: string) {
  const [category, setCategory] = useState(initialCategory);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [openFolder, setOpenFolder] = useState<MediaFolder | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolders = async (cat: string) => {
    setLoading(true); setError(null);
    try {
      const res = await mediaApi.listFolders(cat);
      setFolders(res.folders);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };
  const loadAssets = async (folder: MediaFolder) => {
    setOpenFolder(folder);
    try { setAssets((await mediaApi.listAssets(folder.id)).assets); }
    catch (err: any) { setError(err.message); }
  };
  useEffect(() => { loadFolders(category); setOpenFolder(null); setAssets([]); /* eslint-disable-next-line */ }, [category]);

  return {
    category, setCategory, folders, openFolder, setOpenFolder, assets, setAssets,
    loading, error, setError, loadFolders, loadAssets,
  };
}

function CategoryChips({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRODUCT_CATEGORIES.map((c) => (
        <button key={c.key} onClick={() => onChange(c.key)}
          className={cn('px-3 py-1.5 rounded-pill border-[2px] font-cute font-semibold text-xs transition-colors',
            value === c.key ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink border-ink/30 hover:bg-butter/40')}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────── Media Library tab ─────────────────────────────────────

function MediaLibrary() {
  const m = useMediaBrowser(PRODUCT_CATEGORIES[0].key);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(null);

  const createFolder = async () => {
    if (!code.trim() || !name.trim()) return;
    try {
      await mediaApi.createFolder({ category: m.category, code: code.trim(), name: name.trim() });
      setCode(''); setName('');
      m.loadFolders(m.category);
    } catch (err: any) { m.setError(err.message); }
  };
  const upload = async (files: FileList | null) => {
    if (!files || !m.openFolder) return;
    setUploading(true); m.setError(null);
    try {
      await mediaApi.uploadAssets(m.openFolder.id, Array.from(files));
      m.loadAssets(m.openFolder);
    } catch (err: any) { m.setError(err.message); } finally { setUploading(false); }
  };
  const copy = (url: string) => {
    navigator.clipboard?.writeText(window.location.origin + url).catch(() => {});
    setCopied(url); setTimeout(() => setCopied(null), 1200);
  };
  const removeAsset = async (id: string) => {
    try { await mediaApi.deleteAsset(id); if (m.openFolder) m.loadAssets(m.openFolder); }
    catch (err: any) { m.setError(err.message); }
  };
  const confirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const id = deleteFolderTarget.id;
    setDeleteFolderTarget(null);
    try { await mediaApi.deleteFolder(id); m.setOpenFolder(null); m.loadFolders(m.category); }
    catch (err: any) { m.setError(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Images className="w-5 h-5 text-ink" />
        <h2 className="font-cute font-bold text-ink text-xl">Media Library</h2>
      </div>
      <p className="font-body text-ink-hint text-sm">
        Organise product images by category → product folder (SKU + name). Upload here, then pick them when creating products.
        Recommended: square 1:1 JPG/PNG, ~1200×1200.
      </p>

      <CategoryChips value={m.category} onChange={m.setCategory} />

      {/* Create folder */}
      <div className="fsy-card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          SKU
          <input value={code} onChange={(e) => setCode(e.target.value)} className="fsy-input" placeholder="e.g. BD-001" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft flex-1 min-w-[160px]">
          Product name
          <input value={name} onChange={(e) => setName(e.target.value)} className="fsy-input" placeholder="Rainbow Bead Box" />
        </label>
        <button onClick={createFolder} disabled={!code.trim() || !name.trim()} className="fsy-btn fsy-btn-sm bg-cotton gap-1.5 disabled:opacity-50">
          <Plus className="w-4 h-4" /> New folder
        </button>
      </div>

      {m.error && <p className="font-body text-red-600 text-sm">{m.error}</p>}
      {m.loading ? <Spinner /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {m.folders.map((f) => (
            <button key={f.id} onClick={() => m.loadAssets(f)}
              className={cn('fsy-sticker bg-paper rounded-[12px] p-3 text-left', m.openFolder?.id === f.id && 'ring-2 ring-ink')}>
              <p className="font-cute font-bold text-ink text-sm truncate">{f.code} - {f.name}</p>
              <p className="font-pixel-mono text-ink-hint text-[10px]">SKU {f.code} · {f.assetCount ?? 0} imgs</p>
            </button>
          ))}
          {m.folders.length === 0 && <p className="text-ink-hint font-body text-sm col-span-full">No folders in this category yet.</p>}
        </div>
      )}

      {/* Open folder assets */}
      {m.openFolder && (
        <div className="fsy-card space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-cute font-bold text-ink">{m.openFolder.code} - {m.openFolder.name}</h3>
            <div className="flex gap-2">
              <label className="fsy-btn fsy-btn-sm bg-butter gap-1.5 cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload images
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
              </label>
              <button onClick={() => setDeleteFolderTarget(m.openFolder)} className="fsy-btn fsy-btn-sm bg-paper border-red-300 text-red-600 gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete folder
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {m.assets.map((a) => (
              <div key={a.id} className="relative w-24 h-24 rounded-[10px] border-[2px] border-ink/30 overflow-hidden group">
                <img src={a.url} alt={a.filename} className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => copy(a.url)} title="Copy URL" className="text-paper px-1.5 py-0.5"><Copy className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeAsset(a.id)} title="Delete" className="text-paper px-1.5 py-0.5"><X className="w-3.5 h-3.5" /></button>
                </div>
                {copied === a.url && <span className="absolute top-1 left-1 bg-mint text-ink text-[8px] px-1 rounded">copied</span>}
              </div>
            ))}
            {m.assets.length === 0 && <p className="text-ink-hint font-body text-sm">No images yet — upload some.</p>}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteFolderTarget}
        title="Delete this folder?"
        message={`"${deleteFolderTarget?.name ?? ''}" and all its images will be removed. Products still referencing these images will show broken links.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setDeleteFolderTarget(null)}
      />
    </div>
  );
}

// ─────────────────── Media Picker (modal, used by ProductForm) ──────────────

function MediaPicker({ remaining, onPick, onClose }: {
  remaining: number;
  onPick: (urls: string[]) => void;
  onClose: () => void;
}) {
  const m = useMediaBrowser(PRODUCT_CATEGORIES[0].key);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  const toggle = (url: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(url)) next.delete(url);
    else if (next.size < remaining) next.add(url);
    return next;
  });
  const upload = async (files: FileList | null) => {
    if (!files || !m.openFolder) return;
    setUploading(true); m.setError(null);
    try {
      const res = await mediaApi.uploadAssets(m.openFolder.id, Array.from(files));
      m.loadAssets(m.openFolder);
      // auto-select freshly uploaded (within remaining budget)
      setSelected((prev) => {
        const next = new Set(prev);
        for (const a of res.assets) if (next.size < remaining) next.add(a.url);
        return next;
      });
    } catch (err: any) { m.setError(err.message); } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/40" onClick={onClose}>
      <div className="bg-paper border-[3px] border-ink rounded-[16px] w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5 space-y-3"
        style={{ boxShadow: '5px 5px 0 0 var(--color-ink)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-cute font-bold text-ink text-lg">Pick images ({selected.size}/{remaining} left)</h3>
          <button onClick={onClose} className="text-ink-hint hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <CategoryChips value={m.category} onChange={m.setCategory} />
        {m.error && <p className="font-body text-red-600 text-sm">{m.error}</p>}

        {/* Folders */}
        <div className="flex flex-wrap gap-1.5">
          {m.folders.map((f) => (
            <button key={f.id} onClick={() => m.loadAssets(f)}
              className={cn('px-3 py-1.5 rounded-[10px] border-[2px] font-cute font-semibold text-xs',
                m.openFolder?.id === f.id ? 'bg-butter border-ink text-ink' : 'bg-paper border-ink/30 text-ink-hint hover:bg-butter/40')}>
              {f.code} - {f.name} <span className="font-pixel-mono">({f.assetCount ?? 0})</span>
            </button>
          ))}
          {m.folders.length === 0 && !m.loading && <p className="text-ink-hint font-body text-sm">No folders — create one in the Media tab first.</p>}
        </div>

        {m.openFolder && (
          <>
            <label className="fsy-btn fsy-btn-sm bg-butter gap-1.5 cursor-pointer w-fit">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload into "{m.openFolder.name}"
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {m.assets.map((a) => {
                const on = selected.has(a.url);
                return (
                  <button key={a.id} onClick={() => toggle(a.url)}
                    className={cn('relative w-20 h-20 rounded-[10px] border-[2px] overflow-hidden', on ? 'border-ink ring-2 ring-ink' : 'border-ink/30')}>
                    <img src={a.url} alt="" className="w-full h-full object-cover" />
                    {on && <span className="absolute top-1 right-1 bg-ink text-paper rounded-full w-4 h-4 flex items-center justify-center"><CheckCircle className="w-3 h-3" /></span>}
                  </button>
                );
              })}
              {m.assets.length === 0 && <p className="text-ink-hint font-body text-sm">No images in this folder yet.</p>}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="fsy-btn fsy-btn-sm bg-paper">Cancel</button>
          <button onClick={() => onPick([...selected])} disabled={selected.size === 0} className="fsy-btn fsy-btn-sm bg-cotton disabled:opacity-50">
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Order Manager ─────────────────────────────────────────

const ORDER_STATUS_FLOW: { status: OrderStatusEnum; icon: typeof CheckCircle }[] = [
  { status: 'PENDING',    icon: Clock },
  { status: 'CONFIRMED',  icon: CheckCircle },
  { status: 'PROCESSING', icon: Package },
  { status: 'SHIPPED',    icon: Truck },
  { status: 'DELIVERED',  icon: CheckCircle },
];

const CANCEL_REASONS = [
  'Out of stock',
  'Cannot ship to this address',
  'Payment issue',
  'Customer requested',
];

function OrderManager() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // CSV export controls
  const [exportStatus, setExportStatus] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await ordersApi.list();
        setOrders(res.orders);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await adminApi.exportLedgerCsv({
        status: exportStatus || undefined,
        from: exportFrom || undefined,
        to: exportTo || undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Error msg={error} />;

  const patchLocal = (id: string, patch: Partial<OrderDetail>) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  return (
    <div>
      <h2 className="font-cute font-bold text-ink text-xl mb-4">Orders ({orders.length})</h2>

      {/* Export toolbar — choose status + date range (default: all time) */}
      <div className="fsy-card flex flex-wrap items-end gap-3 mb-6">
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          Status
          <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)} className="fsy-input">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          From
          <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="fsy-input" />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
          To
          <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="fsy-input" />
        </label>
        <button onClick={exportCsv} disabled={exporting} className="fsy-btn fsy-btn-sm bg-mint gap-1.5 disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export CSV
        </button>
        <span className="font-body text-[11px] text-ink-hint">Leave dates empty for all time.</span>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} onPatch={patchLocal} />
        ))}
        {orders.length === 0 && (
          <p className="text-center text-ink-hint font-body py-12">No orders yet</p>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order, onPatch }: { order: OrderDetail; onPatch: (id: string, patch: Partial<OrderDetail>) => void }) {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState(order.carrier || '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl || '');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const sym = order.currency === 'USD' ? '$' : '£';

  const apply = async (status: OrderStatusEnum, extra?: Record<string, string>) => {
    setBusy(true);
    setActionError(null);
    try {
      await ordersApi.updateStatus(order.id, { status, ...extra });
      onPatch(order.id, { status, ...extra });
      if (status === 'CANCELLED') setCancelOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Could not update the order.');
    } finally {
      setBusy(false);
    }
  };

  // Collapsed preview: date, what's in it, and a "pack" label for custom orders.
  const itemUnits = order.items.reduce((s, i) => s + i.quantity, 0);
  const hasDesign = order.items.some((i) => i.patternId);
  const isPack = order.items.length > 1; // a single item isn't a "pack"
  const preview = hasDesign
    ? (isPack ? `Custom design pack · ${order.items.length} items` : 'Custom design')
    : order.items.length === 1
      ? (order.items[0].product?.name || '1 item')
      : `${order.items.length} items (${itemUnits} pcs)`;
  const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="fsy-sticker bg-paper rounded-[14px] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-butter/30 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-pixel-mono text-ink text-xs">#{order.id.slice(-6).toUpperCase()}</span>
            <span className="font-cute font-bold text-ink text-sm">{sym}{order.totalAmount.toFixed(2)}</span>
            <span className="fsy-tag text-[9px]">{order.status}</span>
            {hasDesign && <span className="fsy-tag bg-mint text-[9px]">design pack</span>}
          </div>
          <div className="font-body text-ink-hint text-[11px] mt-1 truncate">
            {dateStr} · {preview}{order.user?.name ? ` · ${order.user.name}` : ''}
          </div>
        </div>
        <span className="font-body text-ink-hint text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t-[2px] border-ink/20 pt-3">
          {/* Items */}
          <div className="space-y-2">
            {order.items.map((i) => (
              <div key={i.id} className="flex items-start gap-3">
                {i.patternId && (
                  <a href={`/api/patterns/${i.patternId}/thumbnail`} target="_blank" rel="noreferrer"
                    title="Customer's design — click to open full size" className="shrink-0">
                    <img src={`/api/patterns/${i.patternId}/thumbnail`} alt="design"
                      className="w-12 h-12 rounded-[8px] border-[2px] border-ink object-contain bg-paper-warm" />
                  </a>
                )}
                <div className="flex-1 flex justify-between text-sm font-body">
                  <span className="text-ink">
                    {i.product?.name || i.productId.slice(-6)}
                    {i.patternId && <span className="block text-ink text-[11px] font-cute font-semibold">★ Custom design attached</span>}
                  </span>
                  <span className="text-ink-hint whitespace-nowrap">×{i.quantity} · {sym}{i.unitPrice.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {order.shippingAddress && (
            <p className="font-body text-ink-hint text-xs">
              Ship to: {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.postcode}
            </p>
          )}

          {/* Accounting breakdown */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-body text-[11px] text-ink-hint pt-1">
            {order.subtotalAmount != null && <span>Subtotal {sym}{order.subtotalAmount.toFixed(2)}</span>}
            {!!order.discountAmount && (
              <span className="text-ink">Discount −{sym}{order.discountAmount.toFixed(2)}{order.discountCode ? ` (${order.discountCode})` : ''}</span>
            )}
            {order.shippingAmount != null && <span>Shipping {sym}{order.shippingAmount.toFixed(2)}</span>}
            {order.vatAmount != null && <span>VAT {sym}{order.vatAmount.toFixed(2)}</span>}
            <span className="font-semibold text-ink">Total {sym}{order.totalAmount.toFixed(2)}</span>
          </div>

          {order.cancelReason && (
            <p className="font-body text-red-600 text-xs">Cancelled: {order.cancelReason}</p>
          )}

          {actionError && (
            <p className="font-body text-red-600 text-xs bg-red-50 border border-red-200 rounded-[8px] px-2.5 py-1.5">
              {actionError}
            </p>
          )}

          {/* Status flow — terminal states (cancelled/refunded) lock the flow */}
          {order.status === 'REFUNDED' ? (
            <p className="font-body text-ink-hint text-xs pt-1">This order has been refunded — its status is final.</p>
          ) : order.status === 'CANCELLED' ? (
            <div className="space-y-2 pt-1">
              <p className="font-body text-ink-hint text-xs">
                Cancelled (stock restored). Refund the customer in PayPal, then mark it refunded.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => apply('REFUNDED')}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-cute font-semibold text-xs rounded-pill border-[2px] border-ink bg-mint text-ink hover:bg-mint/80 transition-colors disabled:opacity-60"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Mark refunded
                </button>
                <button
                  onClick={() => setCancelOpen((c) => !c)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-cute font-semibold text-xs rounded-pill border-[2px] border-ink/30 text-ink hover:bg-butter/40 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit reason
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {ORDER_STATUS_FLOW.map(({ status, icon: Icon }) => (
                <button
                  key={status}
                  onClick={() => apply(status)}
                  disabled={busy || order.status === status}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 font-cute font-semibold text-xs rounded-pill border-[2px] transition-colors',
                    order.status === status
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-paper text-ink border-ink/30 hover:bg-butter/40',
                    'disabled:cursor-default disabled:opacity-60',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {status.toLowerCase()}
                </button>
              ))}
              <button
                onClick={() => setCancelOpen((c) => !c)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-cute font-semibold text-xs rounded-pill border-[2px] border-red-300 text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                cancel
              </button>
            </div>
          )}

          {/* Cancel reason panel */}
          {cancelOpen && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] space-y-2">
              <p className="font-cute font-semibold text-ink text-xs">Cancellation reason (shown to customer)</p>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn('fsy-tag cursor-pointer', reason === r ? 'bg-cotton' : 'bg-paper')}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Or type a reason…"
                className="fsy-input text-sm w-full"
              />
              <button
                onClick={() => apply('CANCELLED', { cancelReason: reason.trim() })}
                disabled={busy || !reason.trim()}
                className="fsy-btn fsy-btn-sm bg-paper border-red-300 text-red-600 disabled:opacity-50"
              >
                Confirm cancellation
              </button>
            </div>
          )}

          {/* Tracking (optional, for physical shipments) */}
          <div className="p-3 bg-paper-warm border border-ink/15 rounded-[10px] space-y-2">
            <p className="font-cute font-semibold text-ink text-xs">Tracking (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" className="fsy-input text-sm" />
              <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking no." className="fsy-input text-sm" />
              <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="Tracking URL" className="fsy-input text-sm" />
            </div>
            <button
              onClick={() => apply(order.status, { trackingNumber, carrier, trackingUrl })}
              disabled={busy}
              className="fsy-btn fsy-btn-sm bg-butter"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save tracking'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────── Shared Utilities ──────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20 text-ink-hint">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      <span className="font-body">Loading…</span>
    </div>
  );
}

function Error({ msg }: { msg: string }) {
  return (
    <div className="text-center py-20">
      <p className="font-body text-red-600 mb-4">{msg}</p>
      <button onClick={() => window.location.reload()} className="fsy-btn fsy-btn-sm bg-paper">
        Retry
      </button>
    </div>
  );
}
