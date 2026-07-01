import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  clampFloat,
  clampInt,
  computeNatureSnapshot,
  dominantZoneBy,
  NATURE_ZONES,
} from '@/lib/ecosystem';
import type {
  EarthAgentRequest,
  EarthAgentResponse,
  EarthZoneDirective,
  EcosystemState,
  FaunaAgentRequest,
  FaunaAgentResponse,
  FaunaZoneDirective,
  NatureAgentSnapshot,
  NatureZoneSnapshot,
  WorldState,
} from '@/lib/types';

const MODEL = process.env.ENGRAM_MODEL || 'claude-sonnet-4-6';
const GEMINI_MODEL = process.env.ENGRAM_GEMINI_MODEL || 'gemini-1.5-flash';

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const googleKey = process.env.GOOGLE_API_KEY;
const FAUNA_SPAWN_INTERVAL_MIN_MS = 1000 * 60 * 2;
const FAUNA_SPAWN_INTERVAL_MAX_MS = 1000 * 60 * 6;

const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const genAI = googleKey ? new GoogleGenerativeAI(googleKey) : null;

/**
 * Compact nature-agent payload contract.
 * Includes only fields Earth/Fauna actually use:
 * - `snapshot`: zone ecological counts for trees, rocks, parcels and builds.
 * - `counters`: global pressure signals used by prompts/fallbacks.
 * - `ecosystem`: persisted nature memory/activity/treasury needed for cadence.
 * It intentionally omits full inventories, buildings, parcel lists, events, items,
 * memories, and other growing WorldState arrays that do not affect these agents.
 */
export function buildNatureAgentSnapshot(world: WorldState, ecosystem: EcosystemState | undefined = world.ecosystem): NatureAgentSnapshot {
  return {
    version: 'nature-agent-compact-v1',
    snapshot: computeNatureSnapshot(world),
    counters: {
      choppedTrees: world.choppedTrees.length,
      minedRocks: world.minedRocks.length,
      playerBuilds: world.buildings.length,
      parcelClaims: world.parcelClaims.length,
      playerCoin: Math.max(0, Math.round(world.inventory.coin)),
      enemiesKilled: Math.max(0, Math.round(world.enemiesKilled)),
    },
    ecosystem,
  };
}

function resolveNatureAgentSnapshot(input: EarthAgentRequest | FaunaAgentRequest): NatureAgentSnapshot {
  if (input.agentSnapshot?.version === 'nature-agent-compact-v1' && Array.isArray(input.agentSnapshot.snapshot)) {
    return input.agentSnapshot;
  }
  if (input.world) {
    return buildNatureAgentSnapshot(input.world, input.current ?? input.world.ecosystem);
  }
  const fallbackSnapshot = Array.isArray(input.snapshot) ? input.snapshot : NATURE_ZONES.map((zone) => ({
    id: zone.id,
    label: zone.label,
    standingTrees: 0,
    choppedTrees: 0,
    intactRocks: 0,
    minedRocks: 0,
    parcelClaims: 0,
    playerBuilds: 0,
  }));
  return {
    version: 'nature-agent-compact-v1',
    snapshot: fallbackSnapshot,
    counters: {
      choppedTrees: fallbackSnapshot.reduce((sum, zone) => sum + zone.choppedTrees, 0),
      minedRocks: fallbackSnapshot.reduce((sum, zone) => sum + zone.minedRocks, 0),
      playerBuilds: fallbackSnapshot.reduce((sum, zone) => sum + zone.playerBuilds, 0),
      parcelClaims: fallbackSnapshot.reduce((sum, zone) => sum + zone.parcelClaims, 0),
      playerCoin: 0,
      enemiesKilled: 0,
    },
    ecosystem: input.current,
  };
}

function communityCadenceMultiplier(input: NatureAgentSnapshot): number {
  const multiplier = input.ecosystem?.communityActivity?.regenCadenceMultiplier;
  return clampFloat(typeof multiplier === 'number' ? multiplier : 1, 0.75, 1);
}

function zoneDigest(snapshot: NatureZoneSnapshot[]): string {
  return snapshot
    .map(
      (zone) =>
        `${zone.label}: standingTrees=${zone.standingTrees}, choppedTrees=${zone.choppedTrees}, intactRocks=${zone.intactRocks}, minedRocks=${zone.minedRocks}, parcelClaims=${zone.parcelClaims}, playerBuilds=${zone.playerBuilds}`
    )
    .join('\n');
}

function safeParse(text: string): any {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return JSON.parse(start >= 0 && end >= start ? text.slice(start, end + 1) : text);
  } catch {
    return null;
  }
}

async function runAI(system: string, userContent: string): Promise<any | null> {
  if (anthropic) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: userContent }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return safeParse(text);
  }

  if (genAI) {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: system,
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800 },
    });
    const result = await model.generateContent(userContent);
    return safeParse(result.response.text());
  }

  return null;
}

function fallbackEarth(compact: NatureAgentSnapshot): EarthAgentResponse {
  const pressure = compact.counters.choppedTrees + compact.counters.playerBuilds * 0.7 + compact.counters.parcelClaims * 1.4;
  const zones: EarthZoneDirective[] = compact.snapshot.map((zone) => {
    const totalTrees = zone.standingTrees + zone.choppedTrees;
    const depletion = totalTrees > 0 ? zone.choppedTrees / totalTrees : 0;
    const quarryWeight = zone.minedRocks * 0.12;
    const claimWeight = zone.parcelClaims * 0.05 + zone.playerBuilds * 0.02;
    const fertility = clampInt(84 - depletion * 42 - quarryWeight * 10 - claimWeight * 100 + (zone.id === 'riverlands' ? 8 : zone.id === 'west_grove' ? 5 : 0), 22, 92);
    return {
      id: zone.id,
      fertility,
      regrowthShare: clampFloat(fertility / 100, 0.12, 0.92),
      note:
        zone.id === 'riverlands'
          ? 'The soaked banks keep feeding new roots.'
          : depletion > 0.45
            ? 'The soil is tired and asks for a slower hand.'
            : 'The ground still carries enough life to recover.',
    };
  });
  const dominantZone = dominantZoneBy(zones, (zone) => zone.fertility);
  const cadenceMs = clampInt(1000 * 60 * (6 - Math.min(3.2, pressure / 35)) * communityCadenceMultiplier(compact), 1000 * 60 * 2, 1000 * 60 * 8);
  return {
    earth: {
      updatedAt: Date.now(),
      cadenceMs,
      nextGrowthAt: Date.now() + cadenceMs,
      dominantZone,
      zones,
      summary:
        dominantZone === 'riverlands'
          ? 'Earth favors the riverbanks tonight; roots there recover first.'
          : `Earth leans toward ${dominantZone.replace('_', ' ')} and slows regrowth where the player has over-harvested.`,
    },
  };
}

function fallbackFauna(compact: NatureAgentSnapshot): FaunaAgentResponse {
  const harvestPressure = compact.counters.choppedTrees + compact.counters.minedRocks * 1.4 + compact.counters.enemiesKilled * 1.8;
  const mood = harvestPressure > 65 ? 'hostile' : harvestPressure > 24 ? 'wary' : 'neutral';
  const zones: FaunaZoneDirective[] = compact.snapshot.map((zone) => {
    const disturbance = zone.playerBuilds * 0.18 + zone.parcelClaims * 0.15 + zone.minedRocks * 0.12 + zone.choppedTrees * 0.08;
    const canopy = zone.standingTrees * 0.035 + zone.intactRocks * 0.04;
    const spawnWeight = clampFloat(canopy - disturbance + (zone.id === 'east_hills' ? 0.18 : zone.id === 'north_forest' ? 0.14 : 0.04), 0.05, 0.95);
    return {
      id: zone.id,
      demeanor: disturbance > canopy ? 'hostile' : mood,
      spawnWeight,
      note:
        disturbance > canopy
          ? 'Tracks tighten here; the herd feels chased.'
          : 'The fauna circles this zone without committing to a charge.',
    };
  });
  const dominantZone = dominantZoneBy(zones, (zone) => zone.spawnWeight);
  return {
    fauna: {
      updatedAt: Date.now(),
      spawnIntervalMs: clampInt(1000 * 60 * (mood === 'hostile' ? 2.1 : mood === 'wary' ? 2.8 : 3.6), FAUNA_SPAWN_INTERVAL_MIN_MS, FAUNA_SPAWN_INTERVAL_MAX_MS),
      calmDelayMs: mood === 'hostile' ? 12000 : mood === 'wary' ? 18000 : 26000,
      maxEnemies: mood === 'hostile' ? 12 : mood === 'wary' ? 8 : 5,
      speedMultiplier: mood === 'hostile' ? 1.24 : mood === 'wary' ? 1.08 : 0.92,
      dominantZone,
      mood,
      zones,
      summary:
        mood === 'neutral'
          ? 'Fauna stays cautious and mostly skirts the village.'
          : `Fauna thickens around ${dominantZone.replace('_', ' ')} and reacts to how hard the player is pushing the land.`,
    },
  };
}

function normalizeEarth(raw: any, fallback: EarthAgentResponse, cadenceMultiplier = 1): EarthAgentResponse {
  const zones = Array.isArray(raw?.zones) ? raw.zones : fallback.earth.zones;
  const normalizedZones: EarthZoneDirective[] = zones
    .map((zone: any, index: number) => ({
      id: NATURE_ZONES[index]?.id ?? fallback.earth.zones[index]?.id ?? 'north_forest',
      fertility: clampInt(zone?.fertility ?? fallback.earth.zones[index]?.fertility ?? 50, 0, 100),
      regrowthShare: clampFloat(zone?.regrowthShare ?? fallback.earth.zones[index]?.regrowthShare ?? 0.2, 0, 1),
      note: typeof zone?.note === 'string' ? zone.note : fallback.earth.zones[index]?.note ?? 'The ground keeps its own counsel.',
    }))
    .slice(0, NATURE_ZONES.length);
  const dominantZone = fallback.earth.zones.find((zone) => zone.id === raw?.dominantZone)?.id ?? dominantZoneBy(normalizedZones, (zone) => zone.fertility);
  const cadenceMs = clampInt(raw?.cadenceMs !== undefined ? raw.cadenceMs * cadenceMultiplier : fallback.earth.cadenceMs, 1000 * 60 * 2, 1000 * 60 * 8);
  return {
    earth: {
      updatedAt: Date.now(),
      cadenceMs,
      nextGrowthAt: Date.now() + cadenceMs,
      dominantZone,
      zones: normalizedZones,
      summary: typeof raw?.summary === 'string' ? raw.summary : fallback.earth.summary,
    },
  };
}

function normalizeFauna(raw: any, fallback: FaunaAgentResponse): FaunaAgentResponse {
  const zones = Array.isArray(raw?.zones) ? raw.zones : fallback.fauna.zones;
  const normalizedZones: FaunaZoneDirective[] = zones
    .map((zone: any, index: number) => ({
      id: NATURE_ZONES[index]?.id ?? fallback.fauna.zones[index]?.id ?? 'north_forest',
      demeanor: zone?.demeanor === 'hostile' || zone?.demeanor === 'neutral' ? zone.demeanor : 'wary',
      spawnWeight: clampFloat(zone?.spawnWeight ?? fallback.fauna.zones[index]?.spawnWeight ?? 0.2, 0, 1),
      note: typeof zone?.note === 'string' ? zone.note : fallback.fauna.zones[index]?.note ?? 'Tracks blur before dawn.',
    }))
    .slice(0, NATURE_ZONES.length);
  return {
    fauna: {
      updatedAt: Date.now(),
      spawnIntervalMs: clampInt(raw?.spawnIntervalMs ?? fallback.fauna.spawnIntervalMs, FAUNA_SPAWN_INTERVAL_MIN_MS, FAUNA_SPAWN_INTERVAL_MAX_MS),
      calmDelayMs: clampInt(raw?.calmDelayMs ?? fallback.fauna.calmDelayMs, 10000, 1000 * 60 * 8),
      maxEnemies: clampInt(raw?.maxEnemies ?? fallback.fauna.maxEnemies, 2, 16),
      speedMultiplier: clampFloat(raw?.speedMultiplier ?? fallback.fauna.speedMultiplier, 0.75, 1.6),
      dominantZone:
        fallback.fauna.zones.find((zone) => zone.id === raw?.dominantZone)?.id ?? dominantZoneBy(normalizedZones, (zone) => zone.spawnWeight),
      mood: raw?.mood === 'hostile' || raw?.mood === 'neutral' ? raw.mood : 'wary',
      zones: normalizedZones,
      summary: typeof raw?.summary === 'string' ? raw.summary : fallback.fauna.summary,
    },
  };
}

export async function runEarthAgent(input: EarthAgentRequest): Promise<EarthAgentResponse> {
  const compact = resolveNatureAgentSnapshot(input);
  const fallback = fallbackEarth(compact);
  const system = `You are Agente Tierra, the AI steward of Aldenmoor's ecology.
Return strict JSON with:
{
  "cadenceMs": number,
  "dominantZone": "north_forest" | "riverlands" | "east_hills" | "south_fields" | "west_grove",
  "summary": string,
  "zones": [{ "fertility": 0-100, "regrowthShare": 0-1, "note": string }]
}
You are not writing lore for its own sake. You are tuning live simulation parameters.
Higher fertility = faster tree recovery. RegrowthShare should be higher where the soil should heal next.
Stay grounded in the snapshot and keep the world feeling alive, not RTS-generic.`;
  const userContent = `Wallet: ${input.walletAddress}
World: choppedTrees=${compact.counters.choppedTrees}, minedRocks=${compact.counters.minedRocks}, playerBuilds=${compact.counters.playerBuilds}, parcelClaims=${compact.counters.parcelClaims}, coin=${compact.counters.playerCoin}, communitySignal=${compact.ecosystem?.communityActivity?.communitySignal ?? 0}, regenCadenceMultiplier=${compact.ecosystem?.communityActivity?.regenCadenceMultiplier ?? 1}
Zone snapshot:
${zoneDigest(compact.snapshot)}`;

  try {
    const raw = await runAI(system, userContent);
    return raw ? normalizeEarth(raw, fallback, communityCadenceMultiplier(compact)) : fallback;
  } catch {
    return fallback;
  }
}

export async function runFaunaAgent(input: FaunaAgentRequest): Promise<FaunaAgentResponse> {
  const compact = resolveNatureAgentSnapshot(input);
  const fallback = fallbackFauna(compact);
  const system = `You are Agente Fauna, the AI steward of Aldenmoor's animal pressure.
Return strict JSON with:
{
  "spawnIntervalMs": number,
  "calmDelayMs": number,
  "maxEnemies": number,
  "speedMultiplier": number,
  "dominantZone": "north_forest" | "riverlands" | "east_hills" | "south_fields" | "west_grove",
  "mood": "hostile" | "wary" | "neutral",
  "summary": string,
  "zones": [{ "demeanor": "hostile" | "wary" | "neutral", "spawnWeight": 0-1, "note": string }]
}
You are tuning a living simulation, not writing flavor text. Fewer spawns and lower speed feel safer; higher values mean harsher wildlife pressure.`;
  const userContent = `Wallet: ${input.walletAddress}
World: choppedTrees=${compact.counters.choppedTrees}, minedRocks=${compact.counters.minedRocks}, enemiesKilled=${compact.counters.enemiesKilled}, playerBuilds=${compact.counters.playerBuilds}
Zone snapshot:
${zoneDigest(compact.snapshot)}`;

  try {
    const raw = await runAI(system, userContent);
    return raw ? normalizeFauna(raw, fallback) : fallback;
  } catch {
    return fallback;
  }
}
