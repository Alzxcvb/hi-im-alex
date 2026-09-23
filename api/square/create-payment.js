import {
  isConfigured, apiBase, authHeaders, OFFERS, CURRENCY,
  toMinorUnits, readJson, sameOrigin,
} from './_lib.js';
import { randomUUID } from 'node:crypto';

// POST /api/square/create-payment   { offer, token, email? }
//
// Square's card flow is one step, unlike PayPal's create-then-capture: the
// browser tokenizes the card with Square's own SDK (so the card number never
// reaches this server, which is what keeps the site out of PCI scope) and posts
// only the resulting single use token here.
//
// Square's dashboard is the system of record for what was actually charged.
// Vercel Hobby runtime logs expire after an hour, so do not rely on them.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: 'Bad origin' });
    return;
  }
  if (!isConfigured()) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const body = readJson(req);
  const offerKey = String(body.offer || '');
  const sourceId = String(body.token || '');

  // The browser sends an offer KEY, never an amount. The price is looked up here
  // so nobody can edit dev tools and buy the $300 session for a dollar.
  const offer = Object.prototype.hasOwnProperty.call(OFFERS, offerKey) ? OFFERS[offerKey] : null;
  if (!offer) {
    res.status(400).json({ error: 'unknown_offer' });
    return;
  }
  // Square's card tokens are opaque; validate shape before forwarding.
  if (!sourceId || sourceId.length > 1024 || !/^[A-Za-z0-9_\-:.]+$/.test(sourceId)) {
    res.status(400).json({ error: 'bad_token' });
    return;
  }

  const email = typeof body.email === 'string' && body.email.length <= 254 ? body.email : undefined;

  let amount;
  try {
    amount = toMinorUnits(offer.amount);
  } catch {
    res.status(500).json({ error: 'catalogue_error' });
    return;
  }

  // Generated server side and capped at Square's documented 45 character limit.
  // A client supplied key would let a caller replay someone else's charge.
  const idempotencyKey = randomUUID().slice(0, 45);

  try {
    const r = await fetch(`${apiBase()}/v2/payments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        source_id: sourceId,
        amount_money: { amount, currency: CURRENCY },
        location_id: process.env.SQUARE_LOCATION_ID,
        note: offer.name.slice(0, 500),
        reference_id: offerKey.slice(0, 40),
        ...(email ? { buyer_email_address: email } : {}),
        autocomplete: true,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data.payment) {
      // Square error bodies can carry account detail, so they are logged server
      // side and never echoed to the browser. The buyer gets a generic failure
      // and the email fallback, which is always better than a raw API dump.
      const first = (data.errors && data.errors[0]) || {};
      console.error('[square:create-payment]', r.status, first.category, first.code);
      res.status(502).json({ error: 'payment_failed' });
      return;
    }

    const p = data.payment;
    res.status(200).json({
      ok: true,
      id: p.id,
      status: p.status,
      amount: offer.amount,
      offer: offerKey,
    });
  } catch (err) {
    console.error('[square:create-payment]', err && err.message);
    res.status(502).json({ error: 'payment_failed' });
  }
}
