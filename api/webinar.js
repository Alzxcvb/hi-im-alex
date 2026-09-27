import { nextOccurrence, FALLBACK } from './_luma.js';

// Permanent link to the NEXT "Zero to AI" webinar. Reached via the /webinar
// rewrite (vercel.json), so the site only ever links to hiimalex.ai/webinar.
//
// Why this exists: Luma has no per-series registration URL. Its recurrence
// feature clones the event, and every clone gets its own slug (yfz3te45,
// afv74cyc, ws7q20ov ...). Hard-coding any one of them means the site points at
// a past event a week later. This reads the calendar and forwards to whichever
// occurrence is next, so the link never goes stale and Luma keeps owning
// registration, reminders, the calendar invite and the Zoom link.

export default async function handler(req, res) {
  let target = FALLBACK;
  let source = 'fallback';

  try {
    const ev = await nextOccurrence();
    if (ev) {
      target = `https://luma.com/${ev.url}`;
      source = 'api';
    }
  } catch {
    // Any failure (timeout, shape change, Luma down) falls through to the
    // profile page. This route must never return an error to a visitor.
  }

  // Cached at the edge so a homepage click does not hit Luma every time, and so
  // a brief Luma failure stays invisible. 5 minutes is far shorter than the
  // weekly cadence, so a rescheduled event is picked up quickly.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  // Vercel Hobby runtime logs expire after an hour. This header is how the
  // redirect can be verified later with a plain `curl -I`.
  res.setHeader('X-Webinar-Source', source);
  // 302, never 301: a browser caches a permanent redirect and would keep
  // sending a repeat visitor to an event that has already happened.
  res.writeHead(302, { Location: target });
  res.end();
}
