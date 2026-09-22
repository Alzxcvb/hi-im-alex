import { isConfigured, accessToken, apiBase, readJson, sameOrigin } from './_lib.js';

// POST /api/paypal/capture-order   body: { orderID: "..." }
//
// Takes the money. PayPal's own dashboard is the system of record for every
// transaction, which matters here because Vercel's Hobby plan only keeps runtime
// logs for one hour. If these logs are ever gone, reconcile against PayPal, not
// against this endpoint.
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
    res.status(403).json({ error: 'Bad origin' });
    return;
  }

  const body = readJson(req);
  const orderID = String(body.orderID || '').trim();
  // PayPal order ids are short alphanumeric strings. Reject anything else rather
  // than pasting arbitrary user input into a URL.
  if (!/^[A-Za-z0-9-]{5,40}$/.test(orderID)) {
    res.status(400).json({ error: 'Bad order id' });
    return;
  }

  try {
    const token = await accessToken();
    const r = await fetch(`${apiBase()}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      // A declined card lands here. PayPal puts the reason in details[0].issue,
      // which the page turns into something a human can act on.
      const issue = (data && data.details && data.details[0] && data.details[0].issue) || 'UNKNOWN';
      console.log(JSON.stringify({
        type: 'paypal_capture_failed',
        at: new Date().toISOString(),
        orderId: orderID,
        status: r.status,
        issue,
      }));
      res.status(r.status === 422 ? 402 : 502).json({ error: 'Payment was not completed', issue });
      return;
    }

    const unit = data.purchase_units && data.purchase_units[0];
    const cap = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
    const payer = data.payer || {};

    console.log(JSON.stringify({
      type: 'paypal_capture_ok',
      at: new Date().toISOString(),
      orderId: orderID,
      captureId: cap && cap.id,
      status: data.status,
      amount: cap && cap.amount && cap.amount.value,
      currency: cap && cap.amount && cap.amount.currency_code,
      payerEmail: payer.email_address,
      payerName: [payer.name && payer.name.given_name, payer.name && payer.name.surname].filter(Boolean).join(' '),
    }));

    res.status(200).json({
      status: data.status,
      captureId: cap && cap.id,
      amount: cap && cap.amount && cap.amount.value,
      payerEmail: payer.email_address,
    });
  } catch (err) {
    console.error('[paypal:capture-order]', err && err.message);
    // If this throws AFTER PayPal took the money, the money is still taken.
    // Always reconcile against the PayPal dashboard before re-charging anyone.
    res.status(502).json({ error: 'Payment could not be confirmed' });
  }
}
