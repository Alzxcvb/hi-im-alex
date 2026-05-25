import fs from 'fs';

const LEADS_FILE = '/tmp/leads.txt';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const email = ((req.body && req.body.email_address) || '').trim();
  if (email && /.+@.+\..+/.test(email)) {
    const line = `${new Date().toISOString()} ${email}\n`;
    try { fs.appendFileSync(LEADS_FILE, line); } catch (e) { console.error(e); }
    console.log('LEAD:', email);
  }

  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
