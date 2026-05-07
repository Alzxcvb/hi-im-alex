// Vercel serverless function: receives the lead-magnet form post from
// hiimalex.ai, forwards the email to Kit (server-to-server, no CORS),
// then redirects the visitor to the guide page.
//
// Form on the site posts to /api/subscribe with `email_address`.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  // Vercel auto-parses url-encoded and JSON bodies into req.body
  const email = (req.body && req.body.email_address || '').trim();
  if (!email || !email.includes('@')) {
    res.status(400).send('Invalid email');
    return;
  }

  // Forward to Kit's public form endpoint.
  // Same endpoint the embedded Kit form uses; no auth required.
  try {
    await fetch('https://app.kit.com/forms/9414472/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'hiimalex.ai/lead-magnet'
      },
      body: new URLSearchParams({ email_address: email }).toString()
    });
  } catch (err) {
    // Don't block the visitor on a Kit hiccup — log and continue to the guide.
    console.error('Kit forward failed:', err && err.message);
  }

  // Send the visitor straight to the PDF — instant deliverable.
  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
