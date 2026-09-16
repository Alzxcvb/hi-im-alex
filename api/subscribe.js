const GFORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScU9XIiJYrDDp0v9H0oobnZj2mXQbO4qS8aBzVrcP4sNEvuJA/formResponse';
const GFORM_NAME_ENTRY = 'entry.42988216';
const GFORM_EMAIL_ENTRY = 'entry.1779722930';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function parseBody(req) {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (typeof req.body === 'object' && req.body) return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  if (ct.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

// Nothing is thrown away. Submissions that fail a check are still recorded,
// they are just labelled so the real signups stay countable and the honest
// number is always available: total submissions vs verified humans.
async function recordToGForm(name, email) {
  const params = new URLSearchParams();
  if (name) params.set(GFORM_NAME_ENTRY, name);
  params.set(GFORM_EMAIL_ENTRY, email);
  params.set('emailAddress', email);
  try {
    const gres = await fetch(GFORM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (hi-im-alex lead capture)',
      },
      body: params.toString(),
      redirect: 'manual',
    });
    console.log(JSON.stringify({ type: 'gform_result', status: gres.status, email }));
  } catch (err) {
    console.error('GForm submit failed:', err && err.message);
  }
}

async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Until the secret is set in Vercel, Turnstile is simply not enforced.
  if (!secret) return { enforced: false, ok: true };
  if (!token) return { enforced: true, ok: false, why: 'no token' };
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip) params.set('remoteip', ip);
    const r = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await r.json();
    return { enforced: true, ok: !!data.success, why: (data['error-codes'] || []).join(',') };
  } catch (err) {
    // A Cloudflare outage must not swallow a real signup.
    console.error('Turnstile verify failed open:', err && err.message);
    return { enforced: true, ok: true, why: 'verify threw, failed open' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const body = parseBody(req);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ua = String(req.headers['user-agent'] || '');
  const name = String(body.name || '').trim().slice(0, 150);
  const email = String(body.email_address || body.email || '').trim().slice(0, 200);

  const flags = [];

  // 1. Honeypot. The form ships a hidden field no human ever sees or fills.
  if (String(body.company_website || '').trim()) flags.push('honeypot');

  // 2. Same origin. A browser posting our own form sends these; a script usually does not.
  const host = String(req.headers.host || '');
  const origin = String(req.headers.origin || req.headers.referer || '');
  if (!origin) flags.push('no origin');
  else if (host && !origin.includes(host)) flags.push('foreign origin');

  // 3. Machine generated names: the August 2026 bot used ten random lowercase letters.
  if (/^[a-z]{8,12}$/.test(name)) flags.push('random name');

  // 4. Turnstile, once the secret exists in the environment.
  const ts = await turnstileOk(String(body['cf-turnstile-response'] || ''), ip);
  if (ts.enforced && !ts.ok) flags.push('turnstile: ' + ts.why);

  const validEmail = /.+@.+\..+/.test(email);
  if (!validEmail) {
    console.log(JSON.stringify({ type: 'lead_discarded', at: new Date().toISOString(), reason: 'unusable email', ip, ua }));
    res.writeHead(302, { Location: '/starter-guide.pdf' });
    res.end();
    return;
  }

  const suspected = flags.length > 0;

  console.log(JSON.stringify({
    type: suspected ? 'lead_flagged' : 'lead',
    at: new Date().toISOString(),
    name,
    email,
    ip,
    ua,
    flags,
    turnstile: ts.enforced ? 'enforced' : 'not enforced',
  }));

  // Flagged rows are kept, with the reason written into the name column so the
  // spreadsheet itself says which submissions are trustworthy.
  const recordedName = suspected ? `[FLAGGED ${flags.join(' + ')}] ${name}`.slice(0, 200) : name;
  await recordToGForm(recordedName, email);

  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
