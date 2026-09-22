// Shared PayPal helpers. Filename starts with an underscore so Vercel does not
// route it as an endpoint.
//
// NOTHING here runs until the two environment variables exist. No PayPal
// account was touched to write this: it is built entirely from PayPal's public
// developer documentation, and it stays completely inert until Alex plugs in
// his own credentials.
//
// Required environment variables (set in Vercel, never in the repo):
//   PAYPAL_CLIENT_ID      from developer.paypal.com, app credentials
//   PAYPAL_CLIENT_SECRET  same screen. SECRET. Never commit, never paste in chat.
//   PAYPAL_ENV            "sandbox" (default) or "live"

export const CURRENCY = 'USD';

// The price list lives HERE, on the server, on purpose.
// The browser only ever sends an offer key like "quickstart". If the amount came
// from the page, anyone could edit it in dev tools and buy a $300 session for $1.
export const OFFERS = {
  quickstart: {
    amount: '300.00',
    name: 'Claude Quick Start Session',
    description: 'One call, up to 90 minutes. AI installed and set up on your computer, one real task handled, cheat sheet, 7 days of follow up.',
  },
  'agent-build': {
    amount: '1000.00',
    name: 'The Agent Build',
    description: 'Designed, built and handed over working, plus a live handover session and 30 days of email support.',
  },
};

export function isConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function apiBase() {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

// Exchanges the client id and secret for a short lived access token.
export async function accessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal credentials are not set');

  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // Deliberately does not echo the response body: it can carry account detail.
    throw new Error(`PayPal auth failed with status ${res.status}`);
  }
  return data.access_token;
}

// Card fields need a client token on top of the client id. This is what the
// browser uses to render PayPal's hosted card inputs inside our own page, which
// is how the card data reaches PayPal without ever touching our server. That is
// the whole reason this stays out of PCI scope.
export async function clientToken(token) {
  const res = await fetch(`${apiBase()}/v1/identity/generate-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en_US',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.client_token) {
    throw new Error(`PayPal client token failed with status ${res.status}`);
  }
  return data.client_token;
}

export function readJson(req) {
  if (typeof req.body === 'object' && req.body) return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  try { return JSON.parse(raw); } catch { return {}; }
}

// Same origin guard, matching the one on the lead form endpoint. A bot hammering
// order creation costs nothing directly, but it makes the logs useless.
export function sameOrigin(req) {
  const host = String(req.headers.host || '');
  const origin = String(req.headers.origin || req.headers.referer || '');
  if (!host || !origin) return false;
  return origin.includes(host);
}
