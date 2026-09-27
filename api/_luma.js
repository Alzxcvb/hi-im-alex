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

// PAUSED 2026-09-26. Alex is keeping the webinar but retiming it off Wednesday
// 9am Pacific, and had not picked the new slot yet. Every occurrence had zero
// registrants, so nothing was cancelled and nobody had to be told.
//
// While this is true:
//   /next-webinar  returns {ok:false}, so the homepage countdown and the sticky
//                  bar hide themselves and no date is ever shown
//   /webinar       stops sending anyone to Luma and lands them on the homepage
//                  notify form instead
//
// The 14 Luma occurrences are left untouched and still exist, so restarting is
// this flag plus the copy swap, not a rebuild. Set to false when a new time is
// live on the calendar.
export const PAUSED = true;

export async function nextOccurrence() {
  // One switch turns the whole series off everywhere at once, so the date shown
  // on the page and the event the button opens can never disagree about it.
  if (PAUSED) return null;

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
