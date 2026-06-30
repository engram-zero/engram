import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { reserve } from '@/lib/ratelimit';
import type { AiItem, AiItemRarity, AiItemStat, AiItemType, ForgeResponse } from '@/lib/types';

export const runtime = 'nodejs';

const MODEL = process.env.ENGRAM_MODEL || 'claude-sonnet-4-6';
const MAX_PROMPT_LEN = 260;
const MAX_TOKENS = 650;
const MAX_ITEMS = 1;
const PRICE_IN = Number(process.env.ENGRAM_PRICE_IN || 3);
const PRICE_OUT = Number(process.env.ENGRAM_PRICE_OUT || 15);
const STAT_LIMITS: Record<AiItemStat, { min: number; max: number }> = {
  woodYield: { min: 1, max: 5 },
  miningYield: { min: 1, max: 4 },
  combatDamage: { min: 2, max: 18 },
  moveSpeed: { min: 0.02, max: 0.18 },
  maxHp: { min: 5, max: 45 },
};
const VALUE_LIMIT = { min: 12, max: 260 };

const serverKey = process.env.ANTHROPIC_API_KEY;
const serverAnthropic = serverKey ? new Anthropic({ apiKey: serverKey }) : null;

function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function usdCost(inTok: number, outTok: number): number {
  return (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT;
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const s = fence ? fence[1] : text;
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}

function cleanText(raw: unknown, fallback: string, max: number): string {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  return (value || fallback).slice(0, max);
}

function cleanType(raw: unknown, prompt: string): AiItemType {
  if (raw === 'tool' || raw === 'weapon' || raw === 'trinket') return raw;
  const p = prompt.toLowerCase();
  if (p.match(/sword|blade|spear|bow|weapon|arma|espada|lanza|arco/)) return 'weapon';
  if (p.match(/ring|amulet|charm|trinket|anillo|amuleto|talism/)) return 'trinket';
  return 'tool';
}

function cleanStat(raw: unknown, type: AiItemType, prompt: string): AiItemStat {
  if (raw === 'woodYield' || raw === 'miningYield' || raw === 'combatDamage' || raw === 'moveSpeed' || raw === 'maxHp') return raw;
  const p = prompt.toLowerCase();
  if (type === 'weapon' || p.match(/damage|demon|enemy|daño|dano|arma|fight/)) return 'combatDamage';
  if (p.match(/pick|mine|mining|ore|pico|minar|mena/)) return 'miningYield';
  if (p.match(/speed|swift|boots|velocidad|rápid|rapid/)) return 'moveSpeed';
  if (p.match(/hp|health|armor|armour|vida|salud|coraza/)) return 'maxHp';
  return 'woodYield';
}

function cleanRarity(raw: unknown, magnitude: number, stat: AiItemStat): AiItemRarity {
  if (raw === 'common' || raw === 'uncommon' || raw === 'rare') return raw;
  const { min, max } = STAT_LIMITS[stat];
  const t = (magnitude - min) / Math.max(0.001, max - min);
  return t > 0.72 ? 'rare' : t > 0.36 ? 'uncommon' : 'common';
}

function clampMagnitude(stat: AiItemStat, raw: unknown): number {
  const { min, max } = STAT_LIMITS[stat];
  const n = Number(raw);
  const value = Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  return stat === 'moveSpeed' ? Math.round(value * 1000) / 1000 : Math.round(value);
}

function estimatedValue(stat: AiItemStat, magnitude: number, rarity: AiItemRarity): number {
  const { min, max } = STAT_LIMITS[stat];
  const power = (magnitude - min) / Math.max(0.001, max - min);
  const rarityBoost = rarity === 'rare' ? 95 : rarity === 'uncommon' ? 45 : 0;
  return Math.max(VALUE_LIMIT.min, Math.min(VALUE_LIMIT.max, Math.round(24 + power * 130 + rarityBoost)));
}

function stableId(owner: string, prompt: string, item: Omit<AiItem, 'id'>): string {
  const hash = createHash('sha256')
    .update(JSON.stringify({ owner: owner.toLowerCase(), prompt, name: item.name, type: item.type, stat: item.stat, magnitude: item.magnitude, createdAt: item.createdAt }))
    .digest('hex')
    .slice(0, 18);
  return `forge:${hash}`;
}

function normalizeItems(raw: unknown, owner: string, prompt: string, fallback = false): AiItem[] {
  const arr = Array.isArray(raw) ? raw : (raw as { items?: unknown })?.items;
  const source = Array.isArray(arr) ? arr : [];
  return source.slice(0, MAX_ITEMS).map((entry, index) => {
    const p = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const type = cleanType(p.type, prompt);
    const stat = cleanStat(p.stat, type, prompt);
    const magnitude = clampMagnitude(stat, p.magnitude);
    const rarity = cleanRarity(p.rarity, magnitude, stat);
    const createdAt = Date.now() + index;
    const itemNoId: Omit<AiItem, 'id'> = {
      owner: owner.toLowerCase(),
      name: cleanText(p.name, type === 'weapon' ? 'Oathbound Blade' : type === 'trinket' ? 'Wayfarer Charm' : 'Rootwise Tool', 48),
      type,
      stat,
      magnitude,
      rarity,
      estimatedCoinValue: Math.max(VALUE_LIMIT.min, Math.min(VALUE_LIMIT.max, Math.round(Number(p.estimatedCoinValue ?? estimatedValue(stat, magnitude, rarity))))),
      prompt,
      lore: cleanText(p.lore, 'A bounded item forged from a player prompt and persisted in 0G.', 180),
      fallback,
      createdAt,
    };
    return { id: stableId(owner, prompt, itemNoId), ...itemNoId };
  });
}

function fallbackItem(owner: string, prompt: string): AiItem[] {
  const type = cleanType(undefined, prompt);
  const stat = cleanStat(undefined, type, prompt);
  const magnitude = stat === 'moveSpeed' ? 0.04 : stat === 'maxHp' ? 12 : stat === 'combatDamage' ? 5 : 2;
  return normalizeItems([{ type, stat, magnitude, rarity: 'common', name: type === 'weapon' ? 'Steady Iron' : 'Practical Engram Tool' }], owner, prompt, true);
}

const SYSTEM = `You forge bounded game items for Aldenmoor. Return STRICT JSON only:
{"items":[{"name":"short fantasy item name","type":"tool|weapon|trinket","stat":"woodYield|miningYield|combatDamage|moveSpeed|maxHp","magnitude":number,"rarity":"common|uncommon|rare","estimatedCoinValue":number,"lore":"one short sentence"}]}
Rules:
- Exactly one item.
- Match the player's prompt, but keep it balanced. No infinite, legendary, god-mode, or real-money claims.
- Stat bounds: woodYield 1..5, miningYield 1..4, combatDamage 2..18, moveSpeed 0.02..0.18, maxHp 5..45.
- estimatedCoinValue must be 12..260 in-game coin.
- Prefer tool for axes/picks, weapon for combat, trinket for passive speed/HP.
JSON only, no prose.`;

export async function POST(req: Request) {
  let body: { walletAddress?: unknown; prompt?: unknown; apiKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const walletAddress = isAddress(body.walletAddress) ? body.walletAddress.toLowerCase() : '';
  if (!walletAddress) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'Describe the item to forge.' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_LEN) return NextResponse.json({ error: `Keep it under ${MAX_PROMPT_LEN} characters.` }, { status: 413 });

  const rl = reserve([`forge:${clientIp(req)}`, `forge:${walletAddress}`]);
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment.', retryAfter: rl.retryAfter }, { status: 429 });

  const byoKey = typeof body.apiKey === 'string' && body.apiKey.trim().startsWith('sk-') ? body.apiKey.trim() : null;
  const client = byoKey ? new Anthropic({ apiKey: byoKey }) : serverAnthropic;
  if (!client) {
    const items = fallbackItem(walletAddress, prompt);
    return NextResponse.json({ items, fallback: true, costUsd: 0 } satisfies ForgeResponse);
  }

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const items = normalizeItems(JSON.parse(extractJson(text)), walletAddress, prompt);
    const costUsd = usdCost(resp.usage.input_tokens, resp.usage.output_tokens);
    if (items.length === 0) return NextResponse.json({ items: fallbackItem(walletAddress, prompt), fallback: true, costUsd } satisfies ForgeResponse);
    return NextResponse.json({ items, costUsd, byo: !!byoKey } satisfies ForgeResponse);
  } catch {
    const items = fallbackItem(walletAddress, prompt);
    return NextResponse.json({ items, fallback: true, costUsd: 0 } satisfies ForgeResponse);
  }
}
