import { ImageResponse } from '@vercel/og';
import { decodePayload } from './_payload.js';

export const config = { runtime: 'edge' };

// 1200x630 Automation Score card. Rendered by @vercel/og (satori) from plain
// object element trees, no JSX. Brand tokens match index.html.

const BG = '#0b0d10';
const ELEV = '#12161b';
const INK = '#f5f6f7';
const DIM = '#a8b0b8';
const LINE = '#1f262e';
const ACCENT = '#ff7a1a';

function el(type, style, children) {
  return { type, props: { style, children } };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const payload = decodePayload(url.searchParams.get('d') || '');
  if (!payload) {
    return new Response('Not found', { status: 404 });
  }
  const { s, r, v, p, n } = payload;

  const tree = el('div', {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    backgroundColor: BG, color: INK, padding: '56px 64px',
    fontFamily: 'sans-serif',
  }, [
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
      el('div', {
        display: 'flex', fontSize: 24, letterSpacing: 4, color: ACCENT, fontWeight: 700,
      }, 'AUTOMATION SCORE'),
      el('div', { display: 'flex', fontSize: 24, color: DIM }, r.toUpperCase()),
    ]),
    el('div', { display: 'flex', alignItems: 'baseline', marginTop: 28 }, [
      el('div', { display: 'flex', fontSize: 220, fontWeight: 800, lineHeight: 1, color: INK }, String(s)),
      el('div', { display: 'flex', fontSize: 90, fontWeight: 800, color: ACCENT, marginLeft: 8 }, '%'),
    ]),
    el('div', {
      display: 'flex', width: '100%', height: 22, backgroundColor: ELEV,
      borderRadius: 11, marginTop: 30, border: `1px solid ${LINE}`,
    }, [
      el('div', {
        display: 'flex', width: `${Math.max(2, s)}%`, height: '100%',
        backgroundColor: ACCENT, borderRadius: 11,
      }, undefined),
    ]),
    el('div', {
      display: 'flex', fontSize: 34, color: INK, marginTop: 34, lineHeight: 1.35,
    }, v),
    el('div', {
      display: 'flex', marginTop: 'auto', alignItems: 'center', justifyContent: 'space-between',
      borderTop: `1px solid ${LINE}`, paddingTop: 26,
    }, [
      el('div', { display: 'flex', fontSize: 26, color: DIM },
        `More automatable than ${p} of ${n} common roles`),
      el('div', { display: 'flex', fontSize: 26, color: ACCENT, fontWeight: 700 },
        'hiimalex.ai/score'),
    ]),
  ]);

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
