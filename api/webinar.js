// Permanent link to the NEXT "Zero to AI" webinar. Reached via the /webinar
// rewrite (vercel.json), so the site only ever links to hiimalex.ai/webinar.
//
// Why this exists: Luma has no per-series registration URL. Its recurrence
// feature clones the event, and every clone gets its own slug (yfz3te45,
// afv74cyc, ws7q20ov ...). Hard-coding any one of them means the site points at
// a past event a week later. This reads the calendar and forwards to whichever
// occurrence is next, so the link never goes stale and Luma keeps owning
// registration, reminders, the calendar invite and the Zoom link.

const CALENDAR_ID = 'cal-kd2PhGmXRtOy4pa'; // Alex's personal Luma calendar
const TITLE_MATCH = /zero to ai/i; // the calendar also holds unrelated events
const SLUG = /^[A-Za-z0-9_-]{3,40}$/; // validated before it reaches a Location header

// Luma's public profile page, which always lists the upcoming occurrences.
// Used when the calendar cannot be read, so a Luma outage costs a click
// rather than breaking the only registration path on the site.
const FALLBACK = 'https://luma.com/user/usr-zFyZdIXNWsf3zfb';

async function nextOccurrence() {
  const url =
    'https://api.luma.com/calendar/get-items' +
    `?calendar_api_id=${CALENDAR_ID}&period=future&pagination_limit=100`;

  // Luma screens some user agents: a default Python-urllib UA gets a 403 while
  // curl, an empty UA and this one all get a 200. Sending an identifiable UA
  // keeps the request attributable and off any scraper denylist.
  const r = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'hiimalex.ai/1.0 (+https://hiimalex.ai/webinar)',
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) return null;

  const body = await r.json();
  const entries = Array.isArray(body && body.entries) ? body.entries : [];
  const now = Date.now();

  const upcoming = entries
    .map((e) => (e && e.event) || null)
    .filter((ev) => ev && ev.visibility === 'public' && SLUG.test(String(ev.url || '')))
    .filter((ev) => TITLE_MATCH.test(String(ev.name || '')))
    // end_at, not start_at: someone clicking at 9:20 on a Wednesday should land
    // on the session already running, not on next week's.
    .filter((ev) => {
      const ends = Date.parse(ev.end_at || ev.start_at);
      return Number.isFinite(ends) && ends > now;
    })
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));

  return upcoming.length ? upcoming[0] : null;
}

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
