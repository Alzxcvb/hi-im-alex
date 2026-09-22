import { isConfigured, accessToken, clientToken, CURRENCY, OFFERS } from './_lib.js';

// GET /api/paypal/config
//
// The page calls this first. If payments are not configured yet it returns
// { configured: false } and the page quietly shows the email fallback instead
// of a broken card form. That is the important property: an unconfigured site
// must never look broken to a visitor.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');

  if (!isConfigured()) {
    res.status(200).json({ configured: false });
    return;
  }

  try {
    const token = await accessToken();
    const ct = await clientToken(token);
    res.status(200).json({
      configured: true,
      clientId: process.env.PAYPAL_CLIENT_ID, // public by design, safe in the page
      clientToken: ct,
      currency: CURRENCY,
      env: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
      offers: Object.fromEntries(
        Object.entries(OFFERS).map(([k, v]) => [k, { amount: v.amount, name: v.name }])
      ),
    });
  } catch (err) {
    console.error('[paypal:config]', err && err.message);
    // Fail closed: the page falls back to email rather than showing a dead form.
    res.status(200).json({ configured: false, error: 'paypal_unavailable' });
  }
}
