// ─── /api/build ──────────────────────────────────────────────────────────────
// AI construction: turn a text description into a small set of buildings the
// client can place. The model returns offsets (dx,dz) from the player's origin.
// The max_tokens cap bounds BOTH the structure size and the API spend; a user may
// pass their OWN Anthropic key (BYO) so heavy use is on them. With no key at all
// there's a deterministic fallback so the feature still works. Keys never persist.

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { reserve } from '@/lib/ratelimit';
import { BLOCK_SCALE_MAX, BLOCK_SCALE_MIN, BLOCK_UNIT } from '@/lib/types';

export const runtime = 'nodejs';

const MODEL = process.env.ENGRAM_MODEL || 'claude-sonnet-4-6';
const MAX_PROMPT_LEN = 300;
const MAX_PIECES = 96; // smaller voxels need more pieces to sculpt nicely
const COORD_LIMIT = 18; // dx/dz clamp from origin
const MAX_TOKENS = 1500; // caps structure size + spend

// Claude Sonnet 4.6 pricing (USD per 1M tokens). Override per model via env.
const PRICE_IN = Number(process.env.ENGRAM_PRICE_IN || 3);
const PRICE_OUT = Number(process.env.ENGRAM_PRICE_OUT || 15);
function usdCost(inTok: number, outTok: number): number {
  return (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT;
}

type AIBuilding = {
  type: 'wall' | 'house' | 'block';
  dx: number;
  dz: number;
  rot: number;
  dy?: number;
  color?: string;
  scale?: number;
};

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
  const clamped = Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, x));
  return Math.round(clamped / BLOCK_UNIT) * BLOCK_UNIT;
}

function hexColor(c: unknown): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim() : '#8a6a4a';
}

function normalize(raw: unknown): AIBuilding[] {
  const arr = Array.isArray(raw) ? raw : (raw as { buildings?: unknown })?.buildings;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((b): b is Record<string, unknown> => !!b && (b.type === 'wall' || b.type === 'house' || b.type === 'block'))
    .slice(0, MAX_PIECES)
    .map((b) => {
      const piece: AIBuilding = {
        type: b.type as AIBuilding['type'],
        dx: clampCoord(b.dx),
        dz: clampCoord(b.dz),
        rot: Number.isFinite(Number(b.rot)) ? Number(b.rot) : 0,
      };
      if (b.type === 'block') {
        piece.dy = Math.round(Math.max(0, Math.min(12, Number(b.dy) || 0)) / BLOCK_UNIT) * BLOCK_UNIT;
        piece.scale = Math.max(BLOCK_SCALE_MIN, Math.min(BLOCK_SCALE_MAX, Math.round((Number(b.scale) || BLOCK_UNIT) / BLOCK_UNIT) * BLOCK_UNIT));
        piece.color = hexColor(b.color);
      }
      return piece;
    });
}

const SYSTEM = `You design structures for a low-poly village game. The player builds exactly
what you return. Output STRICT JSON only:
{"buildings":[{"type":"block"|"wall"|"house","dx":<n>,"dz":<n>,"rot":<radians>,"dy":<n>,"color":"#rrggbb","scale":<n>}]}
Coordinates: dx,dz are offsets in world units from the player at 0,0 (range about -16..16).
Pieces:
- "block": a small COLOURED CUBE — the main tool. Stack and colour MANY blocks (like voxels/LEGO)
  to sculpt ANYTHING the player asks (trees, statues, towers, animals, signs, fountains). Per block:
  "dy" = height above ground (0..12, stack upward in fine steps), "scale" = cube size (${BLOCK_SCALE_MIN}..${BLOCK_SCALE_MAX}),
  "color" = hex. Use multiples of ${BLOCK_UNIT} for dx, dz, dy and scale so cubes sit flush edge-to-edge without gaps.
  Never place one block inside another; build by touching faces, not overlapping volumes. (wall/house ignore dy/color/scale.)
- "wall": a 1.8m fence segment (use "rot" to line them into fences/enclosures).
- "house": a 2.4x2 cottage.
Guidance: prefer BLOCKS for anything that isn't literally a fence or a plain house. Example — a tree:
a vertical column of brown blocks (dy 0..2) topped with a cluster of green blocks (dy 2..4) around it.
Be coherent and reasonably compact. Max ${MAX_PIECES} pieces. JSON only, no prose.`;

// Works with no API key so the button does something on a fresh clone: a little
// voxel tree, to show blocks off.
function fallback(): AIBuilding[] {
  const out: AIBuilding[] = [];
  for (let i = 0; i < 7; i++) out.push({ type: 'block', dx: 0, dz: 0, rot: 0, dy: i * BLOCK_UNIT, scale: BLOCK_UNIT, color: '#6b4a2a' });
  const leaves: [number, number][] = [
    [0, 0], [BLOCK_UNIT, 0], [-BLOCK_UNIT, 0], [0, BLOCK_UNIT], [0, -BLOCK_UNIT], [BLOCK_UNIT, BLOCK_UNIT], [-BLOCK_UNIT, -BLOCK_UNIT], [BLOCK_UNIT, -BLOCK_UNIT], [-BLOCK_UNIT, BLOCK_UNIT],
  ];
  for (const [dx, dz] of leaves) {
    out.push({ type: 'block', dx, dz, rot: 0, dy: 7 * BLOCK_UNIT, scale: BLOCK_UNIT, color: '#3f7a3a' });
    out.push({ type: 'block', dx, dz, rot: 0, dy: 8 * BLOCK_UNIT, scale: BLOCK_UNIT, color: '#48903f' });
  }
  return out;
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
    return NextResponse.json({ buildings: fallback(), fallback: true, costUsd: 0 });
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
    const costUsd = usdCost(resp.usage.input_tokens, resp.usage.output_tokens);
    const buildings = normalize(JSON.parse(extractJson(text)));
    if (buildings.length === 0) return NextResponse.json({ buildings: fallback(), fallback: true, costUsd });
    return NextResponse.json({ buildings, costUsd, byo: !!byoKey });
  } catch {
    const error = byoKey ? 'Your API key was rejected or the request failed.' : 'AI build failed — using a default layout.';
    return NextResponse.json({ error, buildings: fallback(), fallback: true, costUsd: 0 });
  }
}
