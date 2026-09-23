import { nextOccurrence } from './_luma.js';

// JSON feed of the next "Zero to AI" occurrence, so the homepage can show a real
// date and a countdown instead of the vague "every Wednesday".
//
// A specific moment is what makes someone register today. A recurring series
// quietly tells the reader they can always catch the next one, which means they
// never book this one. The date comes from Luma rather than hardcoded copy, so
// it can never go stale.
//
// Shape on success: { ok: true, startAt, endAt, url, name, timezone }
// Shape when the calendar cannot be read: { ok: false }
// The page treats ok:false as "leave the static wording alone", so a Luma
// outage degrades to the old copy rather than to a broken or empty date.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const ev = await nextOccurrence();
    if (!ev) {
      res.status(200).send(JSON.stringify({ ok: false }));
      return;
    }
    res.status(200).send(
      JSON.stringify({
        ok: true,
        startAt: ev.start_at,
        endAt: ev.end_at,
        url: `https://luma.com/${ev.url}`,
        name: ev.name,
        timezone: ev.timezone || null,
      })
    );
  } catch {
    res.status(200).send(JSON.stringify({ ok: false }));
  }
}
