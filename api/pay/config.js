import * as paypal from '../paypal/_lib.js';
import * as square from '../square/_lib.js';

// GET /api/pay/config
//
// The single question the checkout page asks: "who is taking the money today,
// and what do I need to render their card form?"
//
// Switching rails is one environment variable:
//   PAYMENT_PROVIDER=paypal   (default, current live rail)
//   PAYMENT_PROVIDER=square   (the backup rail)
// plus that provider's own credentials. No code change, no redeploy of anything
// but the env var.
//
// If the preferred provider is not usable it falls through to the other one when
// that one IS configured, so a single account suspension cannot take the site to
// zero. That was the actual lesson of the Stripe termination. The response always
// names the provider that answered, so a silent switch is still a visible one.
//
// Returns { configured: false } when neither rail is usable, and the page then
// shows the email fallback rather than a dead card form.

function preferred() {
  const p = String(process.env.PAYMENT_PROVIDER || 'paypal').toLowerCase();
  return p === 'square' ? 'square' : 'paypal';
}

async function paypalConfig() {
  if (!paypal.isConfigured()) return null;
  const token = await paypal.accessToken();
  const ct = await paypal.clientToken(token);
  return {
    configured: true,
    provider: 'paypal',
    clientId: process.env.PAYPAL_CLIENT_ID, // public by design
    clientToken: ct,
    currency: paypal.CURRENCY,
    env: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
    offers: publicOffers(paypal.OFFERS),
  };
}

async function squareConfig() {
  if (!square.isConfigured()) return null;
  // No network call needed: Square's browser SDK takes the application id and
  // location id directly, both of which are public by design.
  return {
    configured: true,
    provider: 'square',
    appId: process.env.SQUARE_APP_ID,
    locationId: process.env.SQUARE_LOCATION_ID,
    sdkUrl: square.sdkUrl(),
    currency: square.CURRENCY,
    env: square.isLive() ? 'live' : 'sandbox',
    offers: publicOffers(square.OFFERS),
  };
}

function publicOffers(offers) {
  return Object.fromEntries(
    Object.entries(offers).map(([k, v]) => [k, { amount: v.amount, name: v.name }])
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');

  const order = preferred() === 'square' ? ['square', 'paypal'] : ['paypal', 'square'];

  for (const name of order) {
    try {
      const cfg = name === 'square' ? await squareConfig() : await paypalConfig();
      if (cfg) {
        // Tells the page (and anyone debugging with curl) whether the rail that
        // answered was the intended one or the automatic fallback.
        res.status(200).json({ ...cfg, preferred: preferred() });
        return;
      }
    } catch (err) {
      // Never echo a provider error body: it can carry account detail.
      console.error('[pay:config]', name, err && err.message);
    }
  }

  res.status(200).json({ configured: false, preferred: preferred() });
}
