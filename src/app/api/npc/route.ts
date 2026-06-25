// ─── /api/npc ─────────────────────────────────────────────────────────────────
// Server-side dialogue engine. Receives the player's message + the NPC's current
// memory (read from 0G on the client), injects that memory into the NPC's persona
// system prompt, asks an AI for an in-character turn, applies the AI's memory
// delta, and returns { response, options, memory, delta }. The CLIENT persists
// the returned memory back to 0G when the conversation ends (one signature).
//
// Provider selection (automatic fallback, in priority order):
//   1. ANTHROPIC_API_KEY → Claude (claude-sonnet-4-6)
//   2. GOOGLE_API_KEY    → Gemini (gemini-1.5-flash, free tier)
//   3. neither           → deterministic hardcoded text fallback
// The system prompt and JSON response contract are identical for both models —
// only the API client differs. API keys live only here; they never reach the browser.

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { reserve } from '@/lib/ratelimit';
import { getNPC } from '@/lib/npcs';
import type {
  NPCChatRequest,
  NPCChatResponse,
  NPCMemory,
  MemoryUpdate,
  NPCName,
  TradeOffer,
  TradeDecision,
} from '@/lib/types';

export const runtime = 'nodejs';

const MODEL = process.env.ENGRAM_MODEL || 'claude-sonnet-4-6';
const GEMINI_MODEL = process.env.ENGRAM_GEMINI_MODEL || 'gemini-1.5-flash';

// A player turn is a sentence or two; anything longer is junk or an attempt to
// blow up token cost. Reject before it reaches the model.
const MAX_MESSAGE_LEN = 500;

// Haggling economics (Aldric, sell side). The "fair" price mirrors the fixed-sale
// price in the client; MAX is the hardest ceiling Aldric will ever pay per unit,
// and ABUSIVE marks an ask so greedy it costs the player trust.
const FAIR_WOOD_PRICE = 2;
const MAX_WOOD_PRICE = 5;
const ABUSIVE_WOOD_PRICE = 6;
const MAX_OFFER_QTY = 9999;

// Best-effort client IP (Vercel sets x-forwarded-for). Used as a second rate-limit
// key so one wallet can't be swapped freely to dodge the per-wallet cap.
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const googleKey = process.env.GOOGLE_API_KEY;

const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const genAI = googleKey ? new GoogleGenerativeAI(googleKey) : null;

const isAddress = (w: unknown): w is string =>
  typeof w === 'string' && /^0x[a-fA-F0-9]{40}$/.test(w);

function clamp(n: unknown, lo: number, hi: number): number {
  const x = Math.round(Number(n) || 0);
  return Math.max(lo, Math.min(hi, x));
}

// Build the final system prompt: inject this player's memory (and, for Sable,
// what the other NPCs know) into the persona template.
function buildSystem(npcName: NPCName, memory: NPCMemory, crossMemory?: NPCChatRequest['crossMemory'], enemiesKilled: number = 0): string {
  const npc = getNPC(npcName)!;
  let prompt = npc.systemPrompt.replace('{MEMORY_JSON}', JSON.stringify(memory, null, 2));

  prompt = prompt.replace('{ENEMIES_KILLED}', enemiesKilled.toString());

  if (prompt.includes('{CROSS_MEMORY}')) {
    const lines = crossMemory
      ? Object.entries(crossMemory)
          .map(([name, m]) =>
            m
              ? `- ${name}: trust ${m.trust_level}/100, mood "${m.emotional_state}", debts ${m.debts}.`
              : null
          )
          .filter(Boolean)
          .join('\n')
      : '';
    prompt = prompt.replace('{CROSS_MEMORY}', lines || '- (you have heard nothing about them yet)');
  }
  return prompt;
}

// Pull the first JSON object out of the model's text.
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start === -1 || end === -1 ? text : text.slice(start, end + 1);
}

interface AITurn {
  dialogue: string;
  options: string[];
  memory_update: MemoryUpdate;
  /** Present only when the model was asked to settle a trade offer. */
  trade?: TradeDecision;
}

function normalizeTurn(raw: any, npcName: string): AITurn {
  const out = raw && typeof raw === 'object' ? raw : {};
  const upd = out.memory_update && typeof out.memory_update === 'object' ? out.memory_update : {};
  let options: string[] = Array.isArray(out.options) ? out.options.filter((o: any) => typeof o === 'string') : [];
  options = options.slice(0, 4);
  if (options.length < 3) {
    options = [...options, 'Tell me more.', 'I should go.', 'What do you make of me?'].slice(0, 3);
  }
  const rawTrade = out.trade && typeof out.trade === 'object' ? out.trade : undefined;
  return {
    dialogue:
      typeof out.dialogue === 'string' && out.dialogue.trim()
        ? out.dialogue.trim()
        : `${npcName} regards you in silence.`,
    options,
    memory_update: {
      trust_delta: clamp(upd.trust_delta, -20, 20),
      emotional_state:
        typeof upd.emotional_state === 'string' && upd.emotional_state.trim()
          ? upd.emotional_state.trim().toLowerCase()
          : undefined,
      debts_delta: clamp(upd.debts_delta, -999, 999),
      summary:
        typeof upd.summary === 'string' && upd.summary.trim() ? upd.summary.trim() : 'Spoke with the traveller.',
    },
    // Loosely carried through; the route does the authoritative clamp against the
    // actual offer (the model can't be trusted to respect the asked price/qty).
    trade: rawTrade
      ? {
          accepted: !!rawTrade.accepted,
          agreedPricePerUnit: Number(rawTrade.agreedPricePerUnit) || 0,
          quantity: Number(rawTrade.quantity) || 0,
        }
      : undefined,
  };
}

// Sanitise a player-supplied offer; returns null if it isn't a usable wood sale.
function sanitizeOffer(offer: unknown): TradeOffer | null {
  if (!offer || typeof offer !== 'object') return null;
  const o = offer as Record<string, unknown>;
  if (o.resource !== 'wood') return null;
  const quantity = clamp(o.quantity, 1, MAX_OFFER_QTY);
  const pricePerUnit = clamp(o.pricePerUnit, 0, 999);
  if (quantity < 1) return null;
  return { resource: 'wood', quantity, pricePerUnit };
}

// The negotiation rules appended to Aldric's system prompt when an offer is live.
function negotiationInstruction(offer: TradeOffer, trust: number): string {
  const total = offer.quantity * offer.pricePerUnit;
  return `
# ACTIVE TRADE OFFER (the player is SELLING wood; you are buying)
The player offers ${offer.quantity} wood at ${offer.pricePerUnit} coin per unit (total ${total} coin).
Your fair reference price is ${FAIR_WOOD_PRICE} coin/unit; you will NEVER pay more than
${MAX_WOOD_PRICE} coin/unit, no matter what. Their trust in your ledger is ${trust}/100.
Decide in character:
- A fair or low ask (≤ ${FAIR_WOOD_PRICE}): accept happily; trust rises a little.
- A slightly high ask: counter with a price between ${FAIR_WOOD_PRICE} and ${MAX_WOOD_PRICE} and accept at that counter.
- An abusive ask (≥ ${ABUSIVE_WOOD_PRICE} coin/unit) or any attempt to cheat: refuse; trust falls; call out the gouging.
- Reward loyal sellers (high trust) with a slightly more generous price.
Include a "trade" field in your JSON alongside the usual fields:
  "trade": { "accepted": <true|false>, "agreedPricePerUnit": <integer coin you will pay, ≤ ${offer.pricePerUnit} and ≤ ${MAX_WOOD_PRICE}>, "quantity": <integer ≤ ${offer.quantity}> }
Your spoken dialogue MUST match the verdict: name the agreed price if you accept (or your counter), or your refusal if you reject.`;
}

// Deterministic settlement: used when no AI key is set, or when the model
// forgot to return a usable trade. Aldric is greedy but fair.
function decideTradeFallback(offer: TradeOffer, trust: number): { trade: TradeDecision; summary: string; dialogue: string; trustDelta: number; mood: string } {
  const loyal = trust >= 70;
  const maxPay = loyal ? FAIR_WOOD_PRICE + 2 : FAIR_WOOD_PRICE + 1; // 4 / 3
  const asked = offer.pricePerUnit;
  if (asked >= ABUSIVE_WOOD_PRICE) {
    return {
      trade: { accepted: false, agreedPricePerUnit: 0, quantity: 0 },
      summary: `Refused a gouging offer of ${asked} coin/wood.`,
      dialogue: `Aldric snorts and pushes the ledger shut. "${asked} coin a log? Do I look like a fool? Come back with an honest number."`,
      trustDelta: -3,
      mood: 'affronted',
    };
  }
  const agreed = Math.min(asked, maxPay);
  const counter = agreed < asked;
  const total = agreed * offer.quantity;
  return {
    trade: { accepted: true, agreedPricePerUnit: agreed, quantity: offer.quantity },
    summary: `Bought ${offer.quantity} wood at ${agreed} coin/unit${counter ? ' (countered down)' : ''}.`,
    dialogue: counter
      ? `Aldric weighs the timber. "I'll not pay ${asked}. ${agreed} a log, ${total} coin for the lot — take it or leave it." He counts out the coin.`
      : `Aldric nods. "${agreed} a log, fair enough. ${total} coin for ${offer.quantity} wood." He counts it into your palm.`,
    trustDelta: asked <= FAIR_WOOD_PRICE ? 2 : 1,
    mood: loyal ? 'warm' : 'pleased',
  };
}

// Clamp the model's trade verdict to the real offer: never pay above the asked
// price or the hard ceiling, never buy more than offered.
function clampTrade(trade: TradeDecision | undefined, offer: TradeOffer): TradeDecision | undefined {
  if (!trade) return undefined;
  if (!trade.accepted) return { accepted: false, agreedPricePerUnit: 0, quantity: 0 };
  const ceiling = Math.min(offer.pricePerUnit, MAX_WOOD_PRICE);
  const agreedPricePerUnit = clamp(trade.agreedPricePerUnit, 1, ceiling);
  const quantity = clamp(trade.quantity || offer.quantity, 1, offer.quantity);
  return { accepted: true, agreedPricePerUnit, quantity };
}

// Apply the AI's delta onto the memory and stamp the interaction.
function applyUpdate(memory: NPCMemory, update: MemoryUpdate, playerLine: string): NPCMemory {
  return {
    trust_level: clamp(memory.trust_level + update.trust_delta, 0, 100),
    debts: Math.max(0, memory.debts + (update.debts_delta || 0)),
    emotional_state: update.emotional_state || memory.emotional_state,
    last_seen: Date.now(),
    interaction_history: [
      ...memory.interaction_history,
      {
        at: Date.now(),
        player: playerLine || '(approached)',
        summary: update.summary,
        trust_delta: update.trust_delta,
      },
    ].slice(-50),
  };
}

async function runClaude(system: string, userContent: string, npcName: string): Promise<AITurn> {
  const resp = await anthropic!.messages.create({
    model: MODEL,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    return normalizeTurn(JSON.parse(extractJson(text)), npcName);
  } catch {
    return normalizeTurn({ dialogue: text }, npcName);
  }
}

// Same persona system prompt + JSON contract as Claude — only the client changes.
// Gemini's free tier makes this a zero-cost option for collaborators.
async function runGemini(system: string, userContent: string, npcName: string): Promise<AITurn> {
  const model = genAI!.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: system,
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800 },
  });
  const result = await model.generateContent(userContent);
  const text = result.response.text();
  try {
    return normalizeTurn(JSON.parse(extractJson(text)), npcName);
  } catch {
    return normalizeTurn({ dialogue: text }, npcName);
  }
}

// Minimal in-character fallback so the UI is clickable before any key is set.
function fallbackTurn(npcName: NPCName, memory: NPCMemory, message: string): AITurn {
  const npc = getNPC(npcName)!;
  const seen = memory.interaction_history.length > 0;
  const warm = memory.trust_level >= 60;
  const greet = seen ? (warm ? 'Ah, you again — good.' : 'You. I remember you.') : 'A new face in Aldenmoor.';
  return normalizeTurn(
    {
      dialogue: `${greet} ${message ? `"${message}" — noted.` : `What brings you to ${npc.name}?`} (set ANTHROPIC_API_KEY or GOOGLE_API_KEY for real dialogue)`,
      memory_update: { trust_delta: 0, emotional_state: memory.emotional_state, debts_delta: 0, summary: seen ? 'Exchanged a few words again.' : 'Met for the first time.' },
    },
    npc.name
  );
}

export async function POST(req: Request) {
  let body: NPCChatRequest;
  try {
    body = (await req.json()) as NPCChatRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { walletAddress, npcName, message, memory, crossMemory, enemiesKilled } = body;
  // Haggling only applies to Aldric; ignore offers aimed at anyone else.
  const offer = npcName === 'aldric' ? sanitizeOffer(body.offer) : null;

  if (!isAddress(walletAddress)) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  if (!getNPC(npcName)) return NextResponse.json({ error: 'Unknown NPC.' }, { status: 400 });
  if (!memory || typeof memory !== 'object') return NextResponse.json({ error: 'Missing memory object.' }, { status: 400 });

  // Reject oversized messages before they reach the model (cost / abuse guard).
  if (typeof message === 'string' && message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LEN} characters).` },
      { status: 413 }
    );
  }

  // Rate limit per wallet AND per IP. A blocked request consumes neither budget.
  const rl = reserve([`w:${walletAddress.toLowerCase()}`, `ip:${clientIp(req)}`]);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Aldenmoor needs a breath. Try again shortly.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const offerLine = offer
    ? `The player offers to sell ${offer.quantity} wood at ${offer.pricePerUnit} coin per unit. Haggle and settle it.`
    : '';
  const userContent =
    message && message.trim()
      ? `The player says/does: "${message.trim()}"${offerLine ? `\n${offerLine}` : ''}`
      : offerLine || 'The player has just approached you. Greet them.';

  try {
    let system = buildSystem(npcName, memory, crossMemory, enemiesKilled);
    if (offer) system += '\n' + negotiationInstruction(offer, memory.trust_level);
    const npcDisplayName = getNPC(npcName)!.name;
    const hasAI = !!anthropic || !!genAI;
    let turn = anthropic
      ? await runClaude(system, userContent, npcDisplayName)
      : genAI
        ? await runGemini(system, userContent, npcDisplayName)
        : fallbackTurn(npcName, memory, message || '');

    // Resolve the trade. The model's verdict is authoritative when present (clamped
    // to the real offer); otherwise fall back to deterministic settlement so the
    // sale still works without an AI key or when the model omits `trade`.
    let trade: TradeDecision | undefined;
    if (offer) {
      trade = clampTrade(turn.trade, offer);
      if (!trade) {
        const fb = decideTradeFallback(offer, memory.trust_level);
        trade = fb.trade;
        // Only overwrite the dialogue/memory when the model gave us nothing useful
        // (no AI, or AI returned no trade) — keep a real model reply if we had one.
        if (!hasAI) {
          turn = {
            ...turn,
            dialogue: fb.dialogue,
            memory_update: { trust_delta: fb.trustDelta, emotional_state: fb.mood, debts_delta: 0, summary: fb.summary },
          };
        }
      }
    }

    const updated = applyUpdate(memory, turn.memory_update, message || (offer ? `Offered ${offer.quantity} wood at ${offer.pricePerUnit} coin/unit.` : ''));

    const payload: NPCChatResponse = {
      response: turn.dialogue,
      options: turn.options,
      memory: updated,
      delta: turn.memory_update,
      ...(trade ? { trade } : {}),
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[api/npc]', err);
    return NextResponse.json(
      { error: 'Dialogue failed.', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
