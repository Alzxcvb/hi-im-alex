import { isConfigured, accessToken, apiBase, readJson, sameOrigin, CURRENCY, OFFERS } from './_lib.js';

// POST /api/paypal/create-order   body: { offer: "quickstart" }
//
// Returns { id } which the browser hands to the PayPal card fields.
// The price is looked up here from the server side catalogue. The browser never
// sends an amount, so it cannot choose one.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isConfigured()) {
    res.status(503).json({ error: 'Payments are not configured yet' });
    return;
  }
  if (!sameOrigin(req)) {
    console.log(JSON.stringify({ type: 'paypal_bad_origin', at: new Date().toISOString(), ip: req.headers['x-forwarded-for'] || '' }));
    res.status(403).json({ error: 'Bad origin' });
    return;
  }

  const body = readJson(req);
  const key = String(body.offer || '').trim();
  const offer = OFFERS[key];
  if (!offer) {
    res.status(400).json({ error: 'Unknown offer' });
    return;
  }

  try {
    const token = await accessToken();
    const r = await fetch(`${apiBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: offer.name,
          amount: {
            currency_code: CURRENCY,
            value: offer.amount,
          },
        }],
        application_context: {
          brand_name: "Hi, I'm Alex",
          shipping_preference: 'NO_SHIPPING', // it is a consulting call, not a parcel
          user_action: 'PAY_NOW',
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.id) {
      console.error('[paypal:create-order] status', r.status, data && data.name);
      res.status(502).json({ error: 'Could not create the order' });
      return;
    }

    console.log(JSON.stringify({
      type: 'paypal_order_created',
      at: new Date().toISOString(),
      orderId: data.id,
      offer: key,
      amount: offer.amount,
    }));

    res.status(200).json({ id: data.id });
  } catch (err) {
    console.error('[paypal:create-order]', err && err.message);
    res.status(502).json({ error: 'Could not create the order' });
  }
}
