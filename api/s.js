import { decodePayload, escHtml } from './_payload.js';

// Share landing page for an Automation Score result. Reached via the /s rewrite
// (vercel.json). The whole result travels in ?d= (base64url JSON), so this page
// is stateless. OG tags point at /api/card for the unfurl image.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const d = String(req.query && req.query.d ? req.query.d : '');
  const payload = decodePayload(d);
  if (!payload) {
    res.writeHead(302, { Location: '/score' });
    res.end();
    return;
  }

  const { s, r, v, p, n } = payload;
  const host = String(req.headers.host || 'hiimalex.ai');
  const base = `https://${host}`;
  const cardUrl = `${base}/api/card?d=${encodeURIComponent(d)}`;
  const pageUrl = `${base}/s?d=${encodeURIComponent(d)}`;

  const title = `Automation Score: ${s}%`;
  const description = `${v} More automatable than ${p} of ${n} common roles. Get your own score in 60 seconds.`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} · ${escHtml(r)}</title>
<meta name="description" content="${escHtml(description)}">
<meta name="robots" content="noindex">
<meta property="og:title" content="${escHtml(title)} for ${escHtml(r)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escHtml(pageUrl)}">
<meta property="og:image" content="${escHtml(cardUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)} for ${escHtml(r)}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${escHtml(cardUrl)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E">
<style>
  :root{--bg:#0b0d10;--bg-elev:#12161b;--ink:#f5f6f7;--ink-dim:#a8b0b8;--line:#1f262e;--accent:#ff7a1a;--accent-soft:#ffb37a;--radius:14px;
  --font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased;line-height:1.55}
  a{color:var(--accent-soft);text-decoration:none}
  .wrap{max-width:640px;margin:0 auto;padding:40px 24px 64px;text-align:center}
  .brand{font-size:14px;color:var(--ink-dim);margin-bottom:28px}
  .brand a{color:var(--ink-dim)}
  .card-img{width:100%;max-width:600px;border-radius:var(--radius);border:1px solid var(--line);display:block;margin:0 auto}
  h1{font-size:clamp(26px,5vw,36px);letter-spacing:-.02em;margin:28px 0 8px;font-weight:800}
  .sub{color:var(--ink-dim);margin:0 0 28px;font-size:16px}
  .btn{display:inline-flex;align-items:center;gap:8px;padding:16px 26px;border-radius:10px;font-weight:600;font-size:16px;border:1px solid transparent;cursor:pointer}
  .btn-primary{background:var(--accent);color:#0b0d10}
  .btn-primary:hover{background:var(--accent-soft)}
  .micro{font-size:13px;color:var(--ink-dim);margin-top:14px}
</style>
</head>
<body>
<div class="wrap">
  <p class="brand"><a href="/">👋 Hi, I'm Alex</a> · hiimalex.ai</p>
  <img class="card-img" src="${escHtml(cardUrl)}" alt="Automation Score ${s}% for ${escHtml(r)}" width="1200" height="630">
  <h1>How much of <em>your</em> work can AI already do?</h1>
  <p class="sub">Someone scored ${s}%. Paste your job description or list what fills your week, and find out where you land. Free, 60 seconds, no signup.</p>
  <a class="btn btn-primary" href="/score">Get your Automation Score →</a>
  <p class="micro">Want AI doing that work for you instead? <a href="https://calendly.com/hiimalexllc/quickstart" target="_blank" rel="noopener">Book a Quick Start for $200 →</a></p>
</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
}
