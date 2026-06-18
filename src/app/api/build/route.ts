// ─── /api/build ──────────────────────────────────────────────────────────────
// AI construction: turn a text description into a small set of buildings the
// client can place. The model returns offsets (dx,dz) from the player's origin.
// The max_tokens cap bounds BOTH the structure size and the API spend; a user may
// pass their OWN Anthropic key (BYO) so heavy use is on them. With no key at all
// there's a deterministic fallback so the feature still works. Keys never persist.

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { reserve } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const MODEL = process.env.ENGRAM_MODEL || 'claude-sonnet-4-6';
const MAX_PROMPT_LEN = 300;
const MAX_PIECES = 24;
const COORD_LIMIT = 18; // dx/dz clamp from origin
const MAX_TOKENS = 1000; // caps structure size + spend

type AIBuilding = { type: 'wall' | 'house'; dx: number; dz: number; rot: number };

const serverKey = process.env.ANTHROPIC_API_KEY;
const serverAnthropic = serverKey ? new Anthropic({ apiKey: serverKey }) : null;

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const s = fence ? fence[1] : text;
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}

function clampCoord(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, Math.round(x * 10) / 10));
}

function normalize(raw: unknown): AIBuilding[] {
  const arr = Array.isArray(raw) ? raw : (raw as { buildings?: unknown })?.buildings;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((b): b is { type: 'wall' | 'house'; dx: unknown; dz: unknown; rot: unknown } => !!b && (b.type === 'wall' || b.type === 'house'))
    .slice(0, MAX_PIECES)
    .map((b) => ({
      type: b.type,
      dx: clampCoord(b.dx),
      dz: clampCoord(b.dz),
      rot: Number.isFinite(Number(b.rot)) ? Number(b.rot) : 0,
    }));
}

const SYSTEM = `You design small medieval village structures for a low-poly game.
The player builds exactly what you return. Output STRICT JSON only:
{"buildings":[{"type":"wall"|"house","dx":<number>,"dz":<number>,"rot":<radians>}]}
Rules:
- dx,dz are offsets in world units from the player, who is at 0,0 (range about -16..16).
- "wall" is a 1.8m fence segment; "house" is a 2.4x2 cottage.
- Use "rot" (radians) to orient walls so they line up into walls/enclosures.
- Be COHERENT to the request and modest: fewer, well-placed pieces beat many. Max ${MAX_PIECES}.
- JSON only, no prose.`;

// Works with no API key so the button does something on a fresh clone.
function fallback(): AIBuilding[] {
  return [
    { type: 'house', dx: 0, dz: 0, rot: 0 },
    { type: 'wall', dx: -4, dz: -4, rot: 0 },
    { type: 'wall', dx: 0, dz: -4, rot: 0 },
    { type: 'wall', dx: 4, dz: -4, rot: 0 },
    { type: 'wall', dx: -4, dz: 4, rot: 0 },
    { type: 'wall', dx: 0, dz: 4, rot: 0 },
    { type: 'wall', dx: 4, dz: 4, rot: 0 },
    { type: 'wall', dx: -4, dz: 0, rot: Math.PI / 2 },
    { type: 'wall', dx: 4, dz: 0, rot: Math.PI / 2 },
  ];
}

export async function POST(req: Request) {
  let body: { prompt?: unknown; apiKey?: unknown };
  try {
    body = (await req.json()) as { prompt?: unknown; apiKey?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'Describe what to build.' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_LEN) {
    return NextResponse.json({ error: `Keep it under ${MAX_PROMPT_LEN} characters.` }, { status: 413 });
  }

  const byoKey = typeof body.apiKey === 'string' && body.apiKey.trim().startsWith('sk-') ? body.apiKey.trim() : null;

  const rl = reserve([`build:${clientIp(req)}`]);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Slow down a moment.', retryAfter: rl.retryAfter }, { status: 429 });
  }

  const client = byoKey ? new Anthropic({ apiKey: byoKey }) : serverAnthropic;
  if (!client) {
    return NextResponse.json({ buildings: fallback(), fallback: true });
  }

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const buildings = normalize(JSON.parse(extractJson(text)));
    if (buildings.length === 0) return NextResponse.json({ buildings: fallback(), fallback: true });
    return NextResponse.json({ buildings });
  } catch {
    const error = byoKey ? 'Your API key was rejected or the request failed.' : 'AI build failed — using a default layout.';
    return NextResponse.json({ error, buildings: fallback(), fallback: true });
  }
}
