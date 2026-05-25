const GFORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScU9XIiJYrDDp0v9H0oobnZj2mXQbO4qS8aBzVrcP4sNEvuJA/formResponse';
const GFORM_ENTRY = 'entry.1779722930';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const email = ((req.body && req.body.email_address) || '').trim();
  if (email && /.+@.+\..+/.test(email)) {
    console.log('LEAD:', email);
    const body = new URLSearchParams({ [GFORM_ENTRY]: email }).toString();
    fetch(GFORM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }).catch(err => console.error('GForm submit failed:', err && err.message));
  }

  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
