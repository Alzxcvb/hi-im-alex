// Shared helpers for the Automation Score share payload.
// The share URL carries the whole result as base64url JSON (?d=...), so there is
// no storage. The payload is attacker controllable: everything read out of it
// must be clamped and escaped before rendering.

export function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

function clampInt(v, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function cleanText(v, maxLen) {
  if (typeof v !== 'string') return '';
  // Strip control chars, collapse whitespace, remove dash characters per copy rules.
  return v
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[–—]/g, ', ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

// Decode and validate ?d= into {s, r, v, p, n} or null.
// s = score 0..100, r = role label, v = verdict, p = baseline roles scored below, n = baseline size.
export function decodePayload(d) {
  if (typeof d !== 'string' || d.length < 4 || d.length > 1200) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(d)) return null;
  let obj;
  try {
    obj = JSON.parse(b64urlDecode(d));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const s = clampInt(obj.s, 0, 100);
  const n = clampInt(obj.n, 1, 500);
  if (s === null || n === null) return null;
  const p = clampInt(obj.p, 0, n);
  if (p === null) return null;
  const r = cleanText(obj.r, 60);
  const v = cleanText(obj.v, 140);
  if (!r || !v) return null;
  return { s, r, v, p, n };
}

export function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
