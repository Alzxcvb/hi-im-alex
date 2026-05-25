// Reads the durable lead list from Vercel KV.
// If KV isn't configured yet, leads still arrive via Gmail notify — check the inbox.

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    res.status(200).send('<pre>KV not configured. Leads are delivered to your inbox via Gmail notify.</pre>');
    return;
  }

  try {
    const r = await fetch(`${url}/lrange/leads/0/-1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    const items = (data && data.result) || [];
    if (!items.length) {
      res.status(200).send('<pre>(no leads yet)</pre>');
      return;
    }
    const rows = items
      .map((s) => {
        try { const o = JSON.parse(s); return `${o.ts}  ${o.email}`; }
        catch { return s; }
      })
      .join('\n');
    res.status(200).send(`<pre>${items.length} leads\n\n${rows}</pre>`);
  } catch (err) {
    res.status(200).send(`<pre>Error reading leads: ${err && err.message}</pre>`);
  }
}
