import { BASELINE } from './_baseline.js';

const MODEL = 'claude-haiku-4-5';
const MAX_INPUT_CHARS = 4000;
const MIN_INPUT_CHARS = 20;

const ALLOWED_ORIGINS = /^https?:\/\/(localhost(:\d+)?|hiimalex\.ai|www\.hiimalex\.ai|[a-z0-9-]+\.vercel\.app)$/i;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    error: { type: 'string' },
    role_label: { type: 'string' },
    score: { type: 'integer' },
    verdict: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          pct: { type: 'integer' },
          how: { type: 'string' },
        },
        required: ['task', 'pct', 'how'],
        additionalProperties: false,
      },
    },
    human: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'error', 'role_label', 'score', 'verdict', 'tasks', 'human'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You score how automatable a person's work is with today's AI tools (Claude, Claude Code, ChatGPT, and similar). The user pastes a job description or a plain list of what they, or their business, do all day.

Scoring rubric:
- Identify the 4 to 8 main recurring tasks in the input.
- For each task, estimate pct: the percentage of that task AI can already do today with realistic setup effort, 0 to 100.
- score: the overall 0 to 100 number, a time weighted average across tasks. Judge weights from how much of a typical week each task consumes.
- Calibration anchors on this exact rubric: data entry clerk scores 93, marketing manager scores 55, plumber scores 7.
- Physical, in person, licensed, or high trust interpersonal work scores low. Text, data, scheduling, drafting, reporting, and inbox work scores high.

Output rules:
- verdict: one punchy sentence, second person, at most 120 characters, naming the role and the standout finding. Make it specific enough that a person would argue about it in public. No insults, no doom.
- how: for each task, one short clause naming the tool or method that automates it today.
- human: 2 to 4 short items describing what genuinely stays human in this work.
- role_label: a 2 to 5 word label for the role or business.
- Never use hyphen, en dash, or em dash characters anywhere in any output text. Use commas or periods instead.
- Never include names of real employers or real people in outputs.
- If the input does not describe work (random text, a recipe, abuse), set ok to false, error to one short sentence asking for a job description or a list of work tasks, score to 0, and tasks and human to empty arrays.
- Otherwise set ok to true and error to an empty string.`;

function parseBody(req) {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (typeof req.body === 'object' && req.body) return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  if (ct.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanText(v, maxLen) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[–—]/g, ', ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGINS.test(origin)) {
    res.status(403).json({ ok: false, error: 'Origin not allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ ok: false, error: 'Scoring is not configured yet. Try again soon.' });
    return;
  }

  const body = parseBody(req);
  const text = String(body.text || '').trim();
  if (text.length < MIN_INPUT_CHARS) {
    res.status(400).json({ ok: false, error: 'Give me a bit more to work with. Paste a job description or list what fills your week.' });
    return;
  }
  if (text.length > MAX_INPUT_CHARS) {
    res.status(400).json({ ok: false, error: `That is too long. Keep it under ${MAX_INPUT_CHARS} characters.` });
    return;
  }

  let apiRes;
  try {
    apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [{ role: 'user', content: text }],
      }),
    });
  } catch (err) {
    console.error(JSON.stringify({ type: 'score_fetch_error', message: err && err.message }));
    res.status(502).json({ ok: false, error: 'The scoring engine did not respond. Try again in a minute.' });
    return;
  }

  if (!apiRes.ok) {
    const detail = await apiRes.text().catch(() => '');
    console.error(JSON.stringify({ type: 'score_api_error', status: apiRes.status, detail: detail.slice(0, 500) }));
    res.status(502).json({ ok: false, error: 'The scoring engine had a hiccup. Try again in a minute.' });
    return;
  }

  const data = await apiRes.json();
  if (data.stop_reason === 'refusal') {
    res.status(400).json({ ok: false, error: 'I could not score that input. Paste a job description or a list of work tasks.' });
    return;
  }

  const textBlock = Array.isArray(data.content) ? data.content.find((b) => b.type === 'text') : null;
  let result;
  try {
    result = JSON.parse(textBlock.text);
  } catch {
    console.error(JSON.stringify({ type: 'score_parse_error', content: JSON.stringify(data.content).slice(0, 500) }));
    res.status(502).json({ ok: false, error: 'The scoring engine returned something unreadable. Try again.' });
    return;
  }

  if (!result.ok) {
    res.status(400).json({ ok: false, error: cleanText(result.error, 200) || 'Paste a job description or a list of work tasks.' });
    return;
  }

  const score = clampInt(result.score, 0, 100, 0);
  const roleLabel = cleanText(result.role_label, 60) || 'Your work';
  const verdict = cleanText(result.verdict, 140) || `Your work scores ${score} out of 100 for automation with current AI tools.`;
  const tasks = (Array.isArray(result.tasks) ? result.tasks : []).slice(0, 8).map((t) => ({
    task: cleanText(t.task, 120),
    pct: clampInt(t.pct, 0, 100, 0),
    how: cleanText(t.how, 160),
  })).filter((t) => t.task);
  const human = (Array.isArray(result.human) ? result.human : []).slice(0, 5)
    .map((h) => cleanText(h, 100)).filter(Boolean);

  const below = BASELINE.filter((b) => b.score < score).length;
  const n = BASELINE.length;

  const share = Buffer.from(
    JSON.stringify({ s: score, r: roleLabel, v: verdict, p: below, n }),
    'utf8'
  ).toString('base64url');

  console.log(JSON.stringify({
    type: 'score',
    at: new Date().toISOString(),
    score,
    role: roleLabel,
    input_chars: text.length,
    tokens_in: data.usage && data.usage.input_tokens,
    tokens_out: data.usage && data.usage.output_tokens,
    ip: req.headers['x-forwarded-for'] || '',
  }));

  res.status(200).json({ ok: true, score, role_label: roleLabel, verdict, tasks, human, below, n, share });
}
