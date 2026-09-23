// Shared Square helpers. Filename starts with an underscore so Vercel does not
// route it as an endpoint.
//
// NOTHING here runs until the environment variables exist. No Square account was
// created or touched to write this: it is built entirely from Square's public
// developer documentation, and it stays completely inert until Alex plugs in his
// own credentials. Same rule as the PayPal integration.
//
// Square is the designated second card rail, chosen in
// tasks/payment-rails-after-stripe.md: "Add a second card rail: Square, so a
// single account decision never takes you to zero again." It is independent of
// Stripe, which is the whole point.
//
// Required environment variables (set in Vercel, never in the repo):
//   SQUARE_ACCESS_TOKEN   Square dashboard, Credentials. SECRET. Never commit.
//   SQUARE_APP_ID         same screen. Public by design, it goes in the page.
//   SQUARE_LOCATION_ID    Locations screen. Public by design.
//   SQUARE_ENV            "sandbox" (default) or "live"
//
// To switch the whole site from PayPal to Square, set the four above plus
// PAYMENT_PROVIDER=square, then redeploy. Nothing else changes.

export { OFFERS, CURRENCY } from '../pay/_catalogue.js';

// Square pins the API contract to a dated version. Verified against the
// CreatePayment reference on 2026-09-23.
export const SQUARE_VERSION = '2026-09-16';

export function isConfigured() {
  return Boolean(
    process.env.SQUARE_ACCESS_TOKEN &&
    process.env.SQUARE_APP_ID &&
    process.env.SQUARE_LOCATION_ID
  );
}

export function isLive() {
  return process.env.SQUARE_ENV === 'live';
}

// Verified 2026-09-23: these are two genuinely different hosts, both answering
// 401 unauthenticated. A summary claiming sandbox shares the production host was
// wrong, so this is checked rather than assumed.
export function apiBase() {
  return isLive()
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

// The browser loads a different SDK build per environment.
export function sdkUrl() {
  return isLive()
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js';
}

export function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    'Square-Version': SQUARE_VERSION,
    'Content-Type': 'application/json',
  };
}

// Square takes the amount as an integer in the smallest currency unit, while the
// shared catalogue stores a decimal string like "300.00". Converting through a
// string split rather than a float multiply, because 19.99 * 100 is 1998.9999...
// in binary floating point and would silently undercharge by a cent.
export function toMinorUnits(decimalString) {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(decimalString).trim());
  if (!m) throw new Error('unparseable amount in catalogue');
  const whole = m[1];
  const frac = (m[2] || '').padEnd(2, '0');
  return Number(whole) * 100 + Number(frac);
}

export function readJson(req) {
  if (typeof req.body === 'object' && req.body) return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  try { return JSON.parse(raw); } catch { return {}; }
}

// Same origin guard.
//
// Deliberately NOT the `origin.includes(host)` substring check used by the
// PayPal endpoints. That form is too loose: any origin merely CONTAINING the
// host passes it, so https://hiimalex.ai.evil.com is accepted for host
// hiimalex.ai. Here the origin is parsed and its host compared exactly.
// The same weakness exists in api/paypal/_lib.js and is reported to Alex rather
// than changed here, because that path is currently taking real money and the
// impact there is log noise rather than funds at risk: the price always comes
// from the server catalogue, so a forged origin still cannot change an amount.
export function sameOrigin(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const raw = String(req.headers.origin || req.headers.referer || '');
  if (!host || !raw) return false;
  let originHost;
  try { originHost = new URL(raw).host.toLowerCase(); } catch { return false; }
  return originHost === host;
}
