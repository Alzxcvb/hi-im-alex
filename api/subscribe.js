const GFORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScU9XIiJYrDDp0v9H0oobnZj2mXQbO4qS8aBzVrcP4sNEvuJA/formResponse';
const GFORM_NAME_ENTRY = 'entry.42988216';
const GFORM_EMAIL_ENTRY = 'entry.1779722930';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const body = parseBody(req);
  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email_address || body.email || '').trim().slice(0, 200);
  const validEmail = /.+@.+\..+/.test(email);

  console.log(JSON.stringify({
    type: 'lead',
    at: new Date().toISOString(),
    name,
    email,
    ip: req.headers['x-forwarded-for'] || '',
    ua: req.headers['user-agent'] || '',
  }));

  if (validEmail) {
    const params = new URLSearchParams();
    if (name) params.set(GFORM_NAME_ENTRY, name);
    params.set(GFORM_EMAIL_ENTRY, email);
    params.set('emailAddress', email);
    fetch(GFORM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }).catch(err => console.error('GForm submit failed:', err && err.message));
  }

  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
