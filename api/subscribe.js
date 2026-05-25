// Vercel serverless function for the lead-magnet form on hiimalex.ai.
// The form (index.html) POSTs `email_address` here. We:
//   1. Save the email durably (Vercel KV / Upstash REST if configured),
//   2. Always fall back to a log line so nothing is ever silently lost,
//   3. Redirect the visitor straight to the guide PDF.
//
// Why not just write a file? Vercel serverless has an ephemeral filesystem — a
// file written here disappears on the next invocation. Durable storage needs a
// store. Connect a Vercel KV store to the project and KV_REST_API_URL /
// KV_REST_API_TOKEN get injected automatically; until then, every lead still
// lands in the function logs.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const email = ((req.body && req.body.email_address) || '').trim();
  const valid = email && /.+@.+\..+/.test(email);

  if (valid) {
    const record = JSON.stringify({
      email,
      ts: new Date().toISOString(),
      ua: req.headers['user-agent'] || '',
      ref: req.headers['referer'] || ''
    });

    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (url && token) {
      try {
        // Append to a Redis list "leads" via Upstash REST (no npm deps needed).
        const r = await fetch(`${url}/rpush/leads/${encodeURIComponent(record)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) console.error('KV save non-OK:', r.status, '| LEAD:', record);
      } catch (err) {
        console.error('KV save failed:', err && err.message, '| LEAD:', record);
      }
    } else {
      // No store connected yet — capture it in the function logs at minimum.
      console.log('LEAD:', record);
    }
  } else {
    console.warn('Subscribe: invalid or missing email');
  }

  // Visitor always gets the guide, regardless of save outcome.
  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
