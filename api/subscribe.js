import nodemailer from 'nodemailer';

// Durable lead capture for hiimalex.ai. Kit is dead — not used.
// Persistence paths, best-effort, independent:
//   1. Vercel KV    -> appends to a "leads" list so /api/leads can show them all (auto-wired by Vercel)
//   2. Gmail notify -> instant email to your inbox (only if GMAIL_USER + GMAIL_APP_PASSWORD set)
// Visitor ALWAYS gets the guide, regardless of whether any storage succeeds.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const email = ((req.body && req.body.email_address) || '').trim();
  const valid = email && /.+@.+\..+/.test(email);

  if (valid) {
    const record = { email, ts: new Date().toISOString(), source: 'hiimalex.ai free guide' };
    console.log('LEAD:', JSON.stringify(record)); // also lands in Vercel logs

    // --- Gmail notify ---
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (gmailUser && gmailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        });
        await transporter.sendMail({
          from: gmailUser,
          to: gmailUser,
          subject: `New lead: ${email}`,
          text: `Email: ${email}\nTime: ${record.ts}\nSource: ${record.source}`,
        });
      } catch (err) {
        console.error('Gmail notify failed:', err && err.message);
      }
    }

    // --- 2. Vercel KV (durable list) ---
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        await fetch(`${process.env.KV_REST_API_URL}/rpush/leads`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(JSON.stringify(record)),
        });
      } catch (err) {
        console.error('KV write failed:', err && err.message);
      }
    }
  } else {
    console.warn('Subscribe: invalid or missing email');
  }

  // Visitor always gets the guide.
  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
