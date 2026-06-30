import type { ParcelClaim, ParcelResourceNode, ParcelResourceRarity, StoredResourceType } from '@/lib/types';

type ParcelSeed = Pick<ParcelClaim, 'id' | 'gx' | 'gz' | 'terrain'>;

const RESOURCE_RARITY: Record<StoredResourceType, ParcelResourceRarity> = {
  wood: 'common',
  stone: 'uncommon',
  silver: 'rare',
  gold: 'legendary',
};

const RESOURCE_HP: Record<StoredResourceType, number> = {
  wood: 3,
  stone: 4,
  silver: 5,
  gold: 6,
};

const RESOURCE_RADIUS: Record<StoredResourceType, number> = {
  wood: 0.55,
  stone: 0.58,
  silver: 0.5,
  gold: 0.48,
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedType(rand: number, terrain: ParcelSeed['terrain']): StoredResourceType {
  const groveBoost = terrain === 'grove' ? 0.1 : 0;
  const quarryBoost = terrain === 'quarry' ? 0.1 : 0;
  const woodCutoff = 0.58 + groveBoost - quarryBoost;
  const stoneCutoff = woodCutoff + 0.31 + quarryBoost * 0.55;
  const silverCutoff = stoneCutoff + 0.09;
  if (rand < woodCutoff) return 'wood';
  if (rand < stoneCutoff) return 'stone';
  if (rand < silverCutoff) return 'silver';
  return 'gold';
}

function amountFor(type: StoredResourceType, roll: number): number {
  if (type === 'wood') return roll > 0.78 ? 3 : roll > 0.34 ? 2 : 1;
  if (type === 'stone') return roll > 0.82 ? 2 : 1;
  return 1;
}

function clampLocal(value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.max(-7.2, Math.min(7.2, Math.round(safe * 100) / 100));
}

export function generateParcelLootPack(parcel: ParcelSeed): ParcelResourceNode[] {
  const random = rng(hashString(`${parcel.id}:${parcel.gx}:${parcel.gz}:${parcel.terrain}:loot-v1`));
  const countRoll = random();
  const count = countRoll > 0.92 ? 5 : countRoll > 0.68 ? 4 : countRoll > 0.2 ? 3 : 2;
  const nodes: ParcelResourceNode[] = [];
  const rareSeen = new Set<StoredResourceType>();

  for (let i = 0; i < count; i++) {
    let type = weightedType(random(), parcel.terrain);
    // Preserve Prompt 23 scarcity: at most one silver and one gold node per parcel.
    if ((type === 'silver' || type === 'gold') && rareSeen.has(type)) type = random() > 0.45 ? 'stone' : 'wood';
    if (type === 'silver' || type === 'gold') rareSeen.add(type);

    const angle = random() * Math.PI * 2;
    const dist = 2.2 + random() * 5.4;
    const localX = clampLocal(Math.cos(angle) * dist);
    const localZ = clampLocal(Math.sin(angle) * dist);
    const amount = amountFor(type, random());
    nodes.push({
      id: `${parcel.id}:loot:${i}`,
      type,
      rarity: RESOURCE_RARITY[type],
      localX,
      localZ,
      amount,
      hp: RESOURCE_HP[type] * amount,
      radius: RESOURCE_RADIUS[type],
    });
  }

  // Always include at least one entry resource so a fresh claim never feels empty.
  if (!nodes.some((node) => node.type === 'wood' || node.type === 'stone')) {
    nodes[0] = {
      ...nodes[0],
      type: parcel.terrain === 'quarry' ? 'stone' : 'wood',
      rarity: parcel.terrain === 'quarry' ? 'uncommon' : 'common',
      amount: 1,
      hp: parcel.terrain === 'quarry' ? RESOURCE_HP.stone : RESOURCE_HP.wood,
      radius: parcel.terrain === 'quarry' ? RESOURCE_RADIUS.stone : RESOURCE_RADIUS.wood,
    };
  }

  return nodes;
}

export function normalizeParcelLootPack(parcel: ParcelSeed, raw: unknown): ParcelResourceNode[] {
  if (!Array.isArray(raw)) return generateParcelLootPack(parcel);
  const fallback = generateParcelLootPack(parcel);
  const fallbackById = new Map(fallback.map((node) => [node.id, node]));
  const out: ParcelResourceNode[] = [];

  for (let i = 0; i < raw.length && out.length < 6; i++) {
    const value = raw[i];
    if (!value || typeof value !== 'object') continue;
    const p = value as Record<string, unknown>;
    const id = typeof p.id === 'string' && p.id.startsWith(`${parcel.id}:loot:`) ? p.id : `${parcel.id}:loot:${i}`;
    const type = p.type === 'stone' || p.type === 'silver' || p.type === 'gold' || p.type === 'wood'
      ? p.type
      : fallbackById.get(id)?.type ?? 'wood';
    out.push({
      id,
      type,
      rarity: RESOURCE_RARITY[type],
      localX: clampLocal(Number(p.localX ?? fallbackById.get(id)?.localX ?? 0)),
      localZ: clampLocal(Number(p.localZ ?? fallbackById.get(id)?.localZ ?? 0)),
      amount: Math.max(1, Math.min(type === 'wood' ? 3 : type === 'stone' ? 2 : 1, Math.round(Number(p.amount ?? 1)))),
      hp: Math.max(1, Math.min(24, Math.round(Number(p.hp ?? RESOURCE_HP[type])))),
      radius: Math.max(0.25, Math.min(0.9, Number(p.radius ?? RESOURCE_RADIUS[type]))),
    });
  }

  return out.length > 0 ? out : fallback;
}
