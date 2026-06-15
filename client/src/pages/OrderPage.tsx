import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Truck, CheckCircle, XCircle, Clock,
  Loader2, ChevronDown, ChevronUp, ShoppingBag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ordersApi, type OrderDetail, type OrderStatusEnum } from '../services/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { cn, imgFallback } from '../lib/utils';

const STATUS_CONFIG: Record<OrderStatusEnum, { label: string; icon: typeof Package; bg: string }> = {
  PENDING:    { label: 'Pending',    icon: Clock,         bg: 'bg-butter' },
  CONFIRMED:  { label: 'Confirmed',  icon: CheckCircle,   bg: 'bg-sky-candy' },
  PROCESSING: { label: 'Processing', icon: Package,       bg: 'bg-sky-candy' },
  SHIPPED:    { label: 'Shipped',    icon: Truck,         bg: 'bg-mint' },
  DELIVERED:  { label: 'Delivered',  icon: CheckCircle,   bg: 'bg-mint' },
  CANCELLED:  { label: 'Cancelled',  icon: XCircle,       bg: 'bg-ink-soft/20' },
  REFUNDED:   { label: 'Refunded',   icon: XCircle,       bg: 'bg-ink-soft/20' },
};

const ORDERED_STATUSES: OrderStatusEnum[] = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED',
];

const FINISHED_STATUSES: OrderStatusEnum[] = ['DELIVERED', 'CANCELLED', 'REFUNDED'];
const isActiveStatus = (s: OrderStatusEnum) => !FINISHED_STATUSES.includes(s);

function StatusBadge({ status }: { status: OrderStatusEnum }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className={cn('fsy-tag gap-1', c.bg)}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

export function OrderPage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cancelId, setCancelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ordersApi.list();
        if (!cancelled) {
          setOrders(res.orders);
          // Active orders open by default; finished/cancelled ones collapse.
          const init: Record<string, boolean> = {};
          res.orders.forEach((o) => { init[o.id] = isActiveStatus(o.status); });
          setExpanded(init);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const confirmCancel = async () => {
    if (!cancelId) return;
    const id = cancelId;
    setCancelId(null);
    try {
      await ordersApi.cancel(id);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: 'CANCELLED' as OrderStatusEnum } : o)),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to cancel');
    }
  };

  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 flex items-center justify-center text-ink-hint">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span className="font-body">Loading orders…</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="font-body text-red-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="fsy-btn fsy-btn-sm bg-paper">
          Retry
        </button>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────
  if (orders.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 text-ink-hint mx-auto mb-4" />
        <h2 className="font-cute font-bold text-ink text-2xl mb-2">No orders yet</h2>
        <p className="font-body text-ink-hint mb-6">
          Head to the designer to create a custom pattern, or browse our products.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/designer" className="fsy-btn bg-cotton">Designer</Link>
          <Link to="/products" className="fsy-btn bg-paper">Products</Link>
        </div>
      </div>
    );
  }

  // ── Order List ───────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-cute font-bold text-ink text-3xl mb-8">My Orders</h1>

      <div className="space-y-4">
        {orders.map((order) => {
          const isOpen = expanded[order.id];
          const currentIdx = ORDERED_STATUSES.indexOf(order.status);

          return (
            <div
              key={order.id}
              className="fsy-sticker bg-paper rounded-[16px] overflow-hidden"
            >
              {/* Summary row — always visible */}
              <button
                onClick={() => toggle(order.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-butter/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-butter border-[2px] border-ink flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-ink" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-cute font-semibold text-ink text-sm truncate">
                      Order #{order.id.slice(-8).toUpperCase()}
                      {order.items.some((i) => i.patternId) && order.items.length > 1 && (
                        <span className="ml-2 fsy-tag bg-mint text-[9px] align-middle">design pack</span>
                      )}
                    </p>
                    <p className="font-body text-ink-hint text-xs truncate">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {' · '}
                      {order.items.some((i) => i.patternId) && order.items.length > 1
                        ? `Custom design pack · ${order.items.length} items`
                        : order.items.length === 1
                          ? (order.items[0].product?.name || '1 item')
                          : `${order.items.length} items`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-cute font-bold text-ink text-sm">
                    {order.currency === 'USD' ? '$' : '£'}{order.totalAmount.toFixed(2)}
                  </span>
                  <StatusBadge status={order.status} />
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-ink-hint" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-ink-hint" />
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 pb-5 space-y-4 border-t-[2px] border-ink/20 pt-4">
                      {/* Cancellation notice */}
                      {order.status === 'CANCELLED' && (
                        <div className="p-3 bg-cotton/30 border border-ink/30 rounded-[10px] font-body text-ink text-sm">
                          <span className="font-semibold">This order was cancelled.</span>
                          {order.cancelReason && <> Reason: {order.cancelReason}</>}
                        </div>
                      )}

                      {/* Status timeline */}
                      {order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
                        <div>
                          <span className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">
                            Status
                          </span>
                          <div className="flex items-center gap-1 mt-2">
                            {ORDERED_STATUSES.map((s, i) => {
                              const done = i <= currentIdx;
                              const active = i === currentIdx;
                              return (
                                <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
                                  <div
                                    className={cn(
                                      'w-3 h-3 rounded-full border-2 transition-colors',
                                      done
                                        ? 'bg-ink border-ink'
                                        : 'bg-paper border-ink/30',
                                      active && 'ring-2 ring-cotton',
                                    )}
                                  />
                                  {i < ORDERED_STATUSES.length - 1 && (
                                    <div
                                      className={cn(
                                        'flex-1 h-[2px]',
                                        done ? 'bg-ink' : 'bg-ink/20',
                                      )}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between mt-1">
                            {ORDERED_STATUSES.map((s) => (
                              <span
                                key={s}
                                className="font-body text-[9px] text-ink-hint capitalize"
                              >
                                {s.toLowerCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Items */}
                      <div>
                        <span className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">
                          Items
                        </span>
                        <div className="mt-2 space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-2 bg-paper-warm rounded-[10px] border border-ink/20"
                            >
                              <div className="w-10 h-10 rounded-[6px] bg-paper border border-ink/30 overflow-hidden shrink-0">
                                {item.product?.images?.[0] && (
                                  <img src={item.product.images[0]} alt="" onError={imgFallback} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-cute font-semibold text-ink text-sm truncate">
                                  {item.product?.name || item.productId.slice(-6)}
                                </p>
                                {item.patternId && (
                                  <p className="font-body text-ink-hint text-[10px]">
                                    Custom design attached
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-pixel-mono text-ink text-xs">
                                  ×{item.quantity}
                                </span>
                                <p className="font-cute font-bold text-ink text-sm">
                                  {order.currency === 'USD' ? '$' : '£'}{(item.unitPrice * item.quantity).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Shipping */}
                      {order.shippingAddress && (
                        <div>
                          <span className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">
                            Shipping to
                          </span>
                          <p className="font-body text-ink-soft text-sm mt-1">
                            {order.shippingAddress.line1}
                            {order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}
                            <br />
                            {order.shippingAddress.city}
                            {order.shippingAddress.county && `, ${order.shippingAddress.county}`}
                            <br />
                            {order.shippingAddress.postcode}, UK
                          </p>
                          {(order.carrier || order.trackingNumber || order.trackingUrl) && (
                            <div className="mt-2 flex flex-col gap-1">
                              {(order.carrier || order.trackingNumber) && (
                                <p className="font-pixel-mono text-ink text-xs bg-butter inline-block px-2 py-0.5 rounded w-fit">
                                  {order.carrier ? `${order.carrier} · ` : ''}{order.trackingNumber}
                                </p>
                              )}
                              {order.trackingUrl && (
                                <a
                                  href={order.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-cute font-semibold text-ink text-xs underline decoration-[2px] underline-offset-2 w-fit"
                                >
                                  Track your parcel →
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {order.status === 'PENDING' && (
                        <div className="pt-2 border-t-[2px] border-ink/20">
                          <button
                            onClick={() => setCancelId(order.id)}
                            className="fsy-btn fsy-btn-sm bg-paper text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Cancel Order
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!cancelId}
        title="Cancel this order?"
        message="This will cancel your order. If it's already been paid, we'll process a refund."
        confirmLabel="Cancel order"
        onConfirm={confirmCancel}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
}
