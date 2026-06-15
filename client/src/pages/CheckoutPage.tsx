import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Minus, Plus, Trash2, ShoppingCart, ArrowLeft,
  Loader2, CreditCard, MapPin, CheckCircle, Tag, BookMarked, AlertTriangle,
} from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore, unitPriceFor } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCurrencyStore, formatPrice, vatPortion } from '../store/useCurrencyStore';
import { paymentsApi, patternsApi, configApi, ApiError, type ShippingConfig } from '../services/api';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

interface AddressForm {
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
}

const emptyAddress: AddressForm = { line1: '', line2: '', city: '', county: '', postcode: '' };

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, subtotal, clearCart, itemCount } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const currency = useCurrencyStore((s) => s.currency);
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [boughtPattern, setBoughtPattern] = useState(false);
  const [ownedPatternIds, setOwnedPatternIds] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});

  // ── Discount code ──────────────────────────────────────────────────
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [percentOff, setPercentOff] = useState(0);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Per-region shipping rules come from admin config (with safe defaults).
  const [shippingCfg, setShippingCfg] = useState<ShippingConfig>({
    GBP: { freeOver: 50, fee: 4.99 },
    USD: { freeOver: 65, fee: 6.99 },
  });
  useEffect(() => {
    configApi.shipping().then(setShippingCfg).catch(() => { /* keep defaults */ });
  }, []);

  // Patterns the user already owns — to warn against paying for a duplicate.
  useEffect(() => {
    if (!user) { setOwnedPatternIds(new Set()); return; }
    patternsApi.owned()
      .then((r) => setOwnedPatternIds(new Set(r.productIds)))
      .catch(() => { /* non-blocking */ });
  }, [user]);

  // Pattern lines in the cart the user has already purchased.
  const ownedInCart = items.filter((i) => i.category === 'pattern' && ownedPatternIds.has(i.productId));

  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Items not sold in the active region (no price for this currency).
  const unavailable = items.filter((i) => unitPriceFor(i, currency) == null);
  // Digital-only cart (e.g. patterns) needs no shipping address — this is what
  // lets international (e.g. US) customers buy a pattern.
  const allDigital = items.length > 0 && items.every((i) => i.category === 'pattern');
  // Ship-to country follows the region/currency (USD → US, GBP → UK).
  const country: 'GB' | 'US' = currency === 'USD' ? 'US' : 'GB';
  const isUS = country === 'US';
  const sub = subtotal(currency);
  const discountAmount = round2(sub * (percentOff / 100));
  const discountedGoods = round2(sub - discountAmount);
  const ship = shippingCfg[currency];
  const shipping = discountedGoods >= ship.freeOver ? 0 : ship.fee;
  const total = round2(discountedGoods + shipping);

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      const res = await paymentsApi.validateDiscount(code);
      setAppliedCode(res.code);
      setPercentOff(res.percentOff);
    } catch (err: any) {
      setAppliedCode(null);
      setPercentOff(0);
      setCodeError(err instanceof ApiError ? err.message : 'Could not apply that code.');
    } finally {
      setCodeBusy(false);
    }
  };

  const removeCode = () => {
    setAppliedCode(null);
    setPercentOff(0);
    setCodeInput('');
    setCodeError(null);
  };

  const validateAddress = (): boolean => {
    const errors: Partial<Record<keyof AddressForm, string>> = {};
    if (!address.line1.trim()) errors.line1 = 'Required';
    if (!address.city.trim()) errors.city = 'Required';
    if (!address.postcode.trim()) errors.postcode = 'Required';
    const ukPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    const usZip = /^\d{5}(-\d{4})?$/;
    if (address.postcode.trim()) {
      if (isUS && !usZip.test(address.postcode.trim())) {
        errors.postcode = 'Invalid US ZIP code (e.g. 90210)';
      } else if (!isUS && !ukPostcode.test(address.postcode.trim())) {
        errors.postcode = 'Invalid UK postcode (e.g. SW1A 1AA)';
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Shared cart + address payload for the PayPal create/capture calls. */
  const buildPayload = () => ({
    items: items.map((i) => ({
      productId: i.productId,
      patternId: i.patternId,
      quantity: i.quantity,
    })),
    // Digital-only orders ship nothing, so we send no address.
    shippingAddress: allDigital ? undefined : {
      line1: address.line1.trim(),
      line2: address.line2.trim() || undefined,
      city: address.city.trim(),
      county: address.county.trim() || undefined,
      postcode: address.postcode.trim().toUpperCase(),
      country,
    },
    notes: notes.trim() || undefined,
    discountCode: appliedCode || undefined,
    currency,
  });

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  /** Admin only — place a free test order without paying. */
  const handleFreeOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = buildPayload();
      // Convenience: for physical test orders, fill a default address if blank.
      if (!allDigital && !payload.shippingAddress?.line1) {
        payload.shippingAddress = isUS
          ? { line1: 'Admin test address', line2: undefined, city: 'New York', county: 'NY', postcode: '10001', country: 'US' }
          : { line1: 'Admin test address', line2: undefined, city: 'London', county: undefined, postcode: 'SW1A 1AA', country: 'GB' };
      }
      const hadPattern = items.some((i) => i.category === 'pattern');
      await paymentsApi.freeOrder(payload);
      setBoughtPattern(hadPattern);
      clearCart();
      setSuccess(true);
      setTimeout(() => navigate(hadPattern ? '/my-works' : '/orders'), 2200);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Could not place the test order.');
    } finally {
      setBusy(false);
    }
  };

  /** Called after PayPal approves — capture the payment and persist the order. */
  const handleApprove = async (paypalOrderId: string) => {
    setBusy(true);
    setError(null);
    try {
      const hadPattern = items.some((i) => i.category === 'pattern');
      await paymentsApi.capturePaypalOrder({ ...buildPayload(), paypalOrderId });
      setBoughtPattern(hadPattern);
      clearCart();
      setSuccess(true);
      setTimeout(() => navigate(hadPattern ? '/my-works' : '/orders'), 2200);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Payment went through but we could not save your order — please contact support.');
    } finally {
      setBusy(false);
    }
  };

  // ── Success state ───────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="fsy-bead w-20 h-20 border-[3px] border-ink bg-mint flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-10 h-10 text-ink" />
        </motion.div>
        <h2 className="font-cute font-bold text-ink text-2xl mb-2">Order placed!</h2>
        {boughtPattern ? (
          <>
            <p className="font-body text-ink-soft mb-2">
              Your pattern has been added to <strong>My Works</strong> — download it there anytime.
            </p>
            <p className="font-body text-ink-hint text-sm mb-6">Taking you to My Works…</p>
            <Link to="/my-works" className="fsy-btn bg-cotton gap-2">
              <BookMarked className="w-4 h-4" /> Go to My Works
            </Link>
          </>
        ) : (
          <p className="font-body text-ink-hint mb-6">
            Redirecting to your orders…
          </p>
        )}
      </div>
    );
  }

  // ── Empty cart ──────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <ShoppingCart className="w-16 h-16 text-ink-hint mx-auto mb-4" />
        <h2 className="font-cute font-bold text-ink text-2xl mb-2">Your cart is empty</h2>
        <p className="font-body text-ink-hint mb-6">
          Add some products to get started.
        </p>
        <Link to="/products" className="fsy-btn bg-cotton gap-2">
          Browse Products
        </Link>
      </div>
    );
  }

  // ── Checkout form ───────────────────────────────────────────────────
  const fieldClass = (field: keyof AddressForm) =>
    `fsy-input ${validationErrors[field] ? 'border-red-500 focus:bg-red-50' : ''}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/products"
        className="inline-flex items-center gap-2 font-cute font-semibold text-sm text-ink-hint hover:text-ink mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Continue shopping
      </Link>

      <h1 className="font-cute font-bold text-ink text-3xl mb-8">Checkout</h1>

      <div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: address + notes */}
          <div className="lg:col-span-3 space-y-6">
            {/* Shipping Address — physical orders only; digital needs none */}
            {!allDigital ? (
            <div className="fsy-card space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-5 h-5 text-ink" />
                <h2 className="font-cute font-bold text-ink text-lg">Shipping Address</h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                  Address Line 1 *
                  <input
                    type="text"
                    value={address.line1}
                    onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                    className={fieldClass('line1')}
                    placeholder="123 High Street"
                  />
                  {validationErrors.line1 && <span className="text-red-500">{validationErrors.line1}</span>}
                </label>
                <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                  Address Line 2
                  <input
                    type="text"
                    value={address.line2}
                    onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                    className="fsy-input"
                    placeholder="Floor, flat, or building name"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                    City *
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                      className={fieldClass('city')}
                      placeholder="London"
                    />
                    {validationErrors.city && <span className="text-red-500">{validationErrors.city}</span>}
                  </label>
                  <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                    {isUS ? 'State' : 'County'}
                    <input
                      type="text"
                      value={address.county}
                      onChange={(e) => setAddress((a) => ({ ...a, county: e.target.value }))}
                      className="fsy-input"
                      placeholder={isUS ? 'NY' : 'Greater London'}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                  {isUS ? 'ZIP code *' : 'Postcode *'}
                  <input
                    type="text"
                    value={address.postcode}
                    onChange={(e) => setAddress((a) => ({ ...a, postcode: e.target.value.toUpperCase() }))}
                    className={fieldClass('postcode')}
                    placeholder={isUS ? '90210' : 'SW1A 1AA'}
                    maxLength={10}
                  />
                  {validationErrors.postcode && <span className="text-red-500">{validationErrors.postcode}</span>}
                </label>
              </div>
            </div>
            ) : (
              <div className="fsy-card flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-ink shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-cute font-bold text-ink text-lg">Digital delivery</h2>
                  <p className="font-body text-ink-hint text-sm mt-0.5">
                    No shipping needed — your pattern lands in My Works right after checkout.
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="fsy-card space-y-3">
              <h2 className="font-cute font-bold text-ink text-lg">Order Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions? (optional)"
                className="w-full min-h-[80px] p-3.5 font-body text-sm text-ink bg-paper border-[2px] border-ink rounded-[12px] placeholder:text-ink-hint resize-none outline-none focus:bg-butter transition-colors"
              />
            </div>
          </div>

          {/* Right: order summary */}
          <div className="lg:col-span-2">
            <div className="fsy-card space-y-4 sticky top-20">
              <div className="flex items-center justify-between">
                <h2 className="font-cute font-bold text-ink text-lg">Order Summary</h2>
                <span className="font-pixel-mono text-ink-hint text-sm">{itemCount()} items</span>
              </div>

              {/* Item list */}
              <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div
                      key={item.key}
                      layout
                      exit={{ opacity: 0, x: -20 }}
                      className="flex gap-3 p-3 bg-paper-warm rounded-[12px] border border-ink/20"
                    >
                      <div className="w-14 h-14 rounded-[8px] bg-paper border border-ink/30 overflow-hidden shrink-0">
                        {item.productImage && (
                          <img src={item.productImage} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-cute font-semibold text-ink text-sm truncate">
                          {item.productName}
                        </p>
                        {item.patternName && (
                          <p className="font-body text-ink-hint text-[10px] truncate">
                            Design: {item.patternName}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.key, item.quantity - 1)}
                              className="w-6 h-6 rounded-full border border-ink/30 flex items-center justify-center hover:bg-butter/60 transition-colors"
                            >
                              <Minus className="w-3 h-3 text-ink" />
                            </button>
                            <span className="font-pixel-mono text-ink text-xs w-5 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.key, item.quantity + 1)}
                              className="w-6 h-6 rounded-full border border-ink/30 flex items-center justify-center hover:bg-butter/60 transition-colors"
                            >
                              <Plus className="w-3 h-3 text-ink" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-cute font-bold text-ink text-sm">
                              {unitPriceFor(item, currency) == null
                                ? <span className="text-red-500 text-xs font-body">Not in your region</span>
                                : formatPrice(unitPriceFor(item, currency)! * item.quantity, currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeItem(item.key)}
                              className="text-ink-hint hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Discount code */}
              <div className="border-t-[2px] border-ink/20 pt-3">
                {appliedCode ? (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-mint/40 border border-ink/20 rounded-[10px]">
                    <span className="font-cute font-semibold text-ink text-sm inline-flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      {appliedCode} · {percentOff}% off
                    </span>
                    <button
                      type="button"
                      onClick={removeCode}
                      className="text-ink-hint hover:text-red-500 text-xs font-semibold underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }}
                        placeholder="Discount code"
                        className="fsy-input flex-1 text-sm uppercase"
                      />
                      <button
                        type="button"
                        onClick={applyCode}
                        disabled={codeBusy || !codeInput.trim()}
                        className="fsy-btn fsy-btn-sm bg-butter whitespace-nowrap disabled:opacity-50"
                      >
                        {codeBusy ? '…' : 'Apply'}
                      </button>
                    </div>
                    {codeError && <p className="mt-1.5 font-body text-[11px] text-red-600">{codeError}</p>}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="border-t-[2px] border-ink/20 pt-3 space-y-2 font-body text-sm">
                <div className="flex justify-between text-ink-soft">
                  <span>Subtotal</span>
                  <span>{formatPrice(sub, currency)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-ink font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Discount ({percentOff}%)
                    </span>
                    <span className="font-semibold">−{formatPrice(discountAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-ink-soft">
                  <span>Shipping</span>
                  <span>
                    {shipping === 0 ? (
                      <span className="text-mint font-semibold">FREE</span>
                    ) : (
                      formatPrice(shipping, currency)
                    )}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-ink-hint text-[11px]">
                    Free shipping on orders over {formatPrice(ship.freeOver, currency)}
                  </p>
                )}
                <div className="flex justify-between font-cute font-bold text-ink text-lg border-t-[2px] border-ink/20 pt-3">
                  <span>Total</span>
                  <span>{formatPrice(total, currency)}</span>
                </div>
                {currency === 'GBP' && (
                  <p className="text-ink-hint text-[11px] text-right">
                    Includes VAT (20%): {formatPrice(vatPortion(total), currency)}
                  </p>
                )}
              </div>

              {/* Payment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-ink" />
                  <span className="font-cute font-semibold text-ink text-sm">Pay with PayPal</span>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-cotton/30 border border-ink/40 rounded-[10px] text-ink font-body text-xs font-semibold">
                    {error}
                  </div>
                )}

                {unavailable.length > 0 && (
                  <div className="p-3 bg-cotton/30 border border-ink/40 rounded-[10px] text-ink font-body text-xs">
                    Some items aren't available in your region ({currency}). Remove them to continue.
                  </div>
                )}

                {ownedInCart.length > 0 && (
                  <div className="p-3 bg-butter/60 border-[2px] border-ink/30 rounded-[10px] text-ink font-body text-xs space-y-1.5">
                    <p className="font-cute font-semibold inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> You already own these patterns
                    </p>
                    <p className="text-ink-soft">
                      {ownedInCart.map((i) => i.productName).join(', ')} — already in your{' '}
                      <Link to="/my-works" className="underline font-semibold">My Works</Link>.
                      Checking out again will charge you for a duplicate.
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={handleFreeOrder}
                      disabled={busy || unavailable.length > 0}
                      className="fsy-btn fsy-btn-lg w-full bg-mint gap-2 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Place test order (admin · free)
                    </button>
                    <p className="font-body text-ink-hint text-[11px] text-center">
                      Admin only — skips payment, tags the order as a test, and doesn't touch stock.
                    </p>
                  </div>
                )}

                {!user ? (
                  <Link
                    to={`/login?next=${encodeURIComponent('/checkout')}`}
                    className="fsy-btn fsy-btn-lg bg-cotton hover:bg-accent-hover w-full"
                  >
                    Sign in to pay
                  </Link>
                ) : !PAYPAL_CLIENT_ID ? (
                  <p className="p-3 bg-butter/60 border border-ink/20 rounded-[12px] text-center font-body text-ink-hint text-xs">
                    PayPal isn't configured yet. Add VITE_PAYPAL_CLIENT_ID and restart.
                  </p>
                ) : (
                  <div className="relative">
                    <PayPalScriptProvider
                      key={currency}
                      options={{ clientId: PAYPAL_CLIENT_ID, currency, intent: 'capture', locale: currency === 'USD' ? 'en_US' : 'en_GB' }}
                    >
                      <PayPalButtons
                        style={{ layout: 'vertical', shape: 'pill', color: 'gold', label: 'paypal' }}
                        disabled={busy || unavailable.length > 0}
                        forceReRender={[total, currency]}
                        createOrder={async () => {
                          setError(null);
                          if (!allDigital && !validateAddress()) {
                            setError('Please complete your shipping address first.');
                            throw new Error('invalid-address');
                          }
                          const { id } = await paymentsApi.createPaypalOrder(buildPayload());
                          return id;
                        }}
                        onApprove={async (data) => { await handleApprove(data.orderID); }}
                        onError={() => setError((prev) => prev || 'Payment could not be completed. Please try again.')}
                      />
                    </PayPalScriptProvider>
                    {busy && (
                      <div className="absolute inset-0 bg-paper/70 backdrop-blur-sm flex items-center justify-center rounded-[12px]">
                        <span className="inline-flex items-center gap-2 font-cute font-semibold text-ink text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> Finishing your order…
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="font-body text-ink-hint text-[11px] text-center">
                  Secure checkout via PayPal — pay with your PayPal balance or any card.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
