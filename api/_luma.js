// Shared lookup for the next "Zero to AI" occurrence.
//
// Used by two routes that must never disagree with each other:
//   /webinar       302s the visitor to it
//   /next-webinar  returns it as JSON so the homepage can show the date
// Keeping one implementation means the button and the date above it can never
// point at different weeks.

const CALENDAR_ID = 'cal-kd2PhGmXRtOy4pa'; // Alex's personal Luma calendar
// The calendar also holds unrelated events, so occurrences are matched by title.
// This deliberately accepts BOTH the old "Zero to AI" name and any "... masterclass
// ..." title, so the series can be renamed on Luma without the redirect and the
// homepage countdown silently falling back to the profile page mid transition.
// If the series is ever renamed to something matching neither, update this first,
// deploy, and only then rename on Luma. Getting that order wrong breaks the only
// registration path on the site, and it fails silently.
const TITLE_MATCH = /zero to ai|masterclass/i;
const SLUG = /^[A-Za-z0-9_-]{3,40}$/; // validated before it reaches a URL

// Luma's public profile page, which always lists the upcoming occurrences.
export const FALLBACK = 'https://luma.com/user/usr-zFyZdIXNWsf3zfb';

export async function nextOccurrence() {
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
