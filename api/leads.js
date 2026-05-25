import fs from 'fs';

const LEADS_FILE = '/tmp/leads.txt';

export default function handler(req, res) {
  try {
    const data = fs.readFileSync(LEADS_FILE, 'utf8');
    res.status(200).send(`<pre>${data || '(no leads yet)'}</pre>`);
  } catch {
    res.status(200).send('<pre>(no leads yet)</pre>');
  }
}
