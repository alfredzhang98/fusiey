/**
 * PayPal Standard Checkout — server side.
 *
 * We talk to the PayPal Orders v2 REST API directly with fetch (no SDK):
 *   1. getAccessToken  — OAuth2 client-credentials grant
 *   2. createOrder     — create an order for a given amount, returns its id
 *   3. captureOrder    — capture an approved order, returns the capture result
 *
 * Credentials + mode come from env (read lazily so dotenv is loaded first):
 *   PAYPAL_MODE = sandbox | live   PAYPAL_CLIENT_ID   PAYPAL_SECRET
 */

function apiBase(): string {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function isPaypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}

async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new Error('PayPal credentials are not configured');

  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface PaypalOrder {
  id: string;
  status: string;
}

/** Create a CAPTURE-intent order for `amount` in `currency`. */
export async function createPaypalOrder(amount: number, currency = 'GBP'): Promise<PaypalOrder> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        { amount: { currency_code: currency, value: amount.toFixed(2) } },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create-order failed (${res.status}): ${text}`);
  }
  return (await res.json()) as PaypalOrder;
}

export interface PaypalCapture {
  status: string;
  captureId: string | null;
  raw: any;
}

/** Capture a previously-approved order. Returns status + capture id. */
export async function capturePaypalOrder(orderId: string): Promise<PaypalCapture> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const raw = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`PayPal capture failed (${res.status}): ${JSON.stringify(raw)}`);
  }
  const captureId =
    raw?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
  return { status: raw.status, captureId, raw };
}
