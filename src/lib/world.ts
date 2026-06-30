'use client';

// ─── Engram player world-state (inventory + chopped trees) ────────────────────
//
// This is the CLIENT-side gameplay state: what the player has gathered and what
// they've changed in the world. It is intentionally split from the persistence
// layer by the `WorldPersistence` seam below.
//
// OWNERSHIP / COORDINATION (see docs/COORDINATION.md):
//   - Gameplay (this file, tree-chopping, inventory HUD): owned by the world/UI dev.
//   - PERSISTENCE of WorldState (wood/coins/built things) to 0G or an on-chain
//     contract: owned by **martelaxe**. Implement a `WorldPersistence` and register
//     it with `setWorldPersistence(...)`. Do NOT change the gameplay store API —
//     just swap the persistence. The default below is localStorage (works today,
//     NOT cross-device, NOT on-chain).

import { useSyncExternalStore } from 'react';
import { BLOCK_SCALE_MAX, BLOCK_SCALE_MIN, BLOCK_UNIT, type DemonSiegeEvent, type EcosystemState, type OreType, type ParcelClaim, type ParcelRentEvent, type RaidEvent, type RepairEvent, type ResourceType, type WalletRelation, type WorldState, type Building, type BuildingType } from '@/lib/types';

export type { DemonSiegeEvent, EcosystemState, OreType, ParcelClaim, ParcelRentEvent, RaidEvent, RepairEvent, ResourceType, WalletRelation, WorldState, Building, BuildingType } from '@/lib/types';

/** How much wood the player can carry before they must use/drop some. Raised to
 * support AI-built structures and the pricier builds near the village centre. */
export const MAX_WOOD = 100;

/** BASE wood cost per building. The actual cost scales up the closer you build
 * to the village centre (computed in the scene); persistence is unaffected. */
export const BUILD_COST: Record<BuildingType, number> = { wall: 6, house: 24, block: 0.1 };
/** Collider radius for each building (kept in sync with the rendered footprint).
 * Blocks are decorative voxels — they don't collide (radius 0). */
export const BUILD_RADIUS: Record<BuildingType, number> = { wall: 0.9, house: 1.8, block: 0 };
const MAX_BUILD_COORD = 150;
const MAX_BLOCK_Y = 12;
const MAX_RAID_EVENTS = 120;
const MAX_REPAIR_EVENTS = 160;
const MAX_DEMON_SIEGE_EVENTS = 160;
const MAX_PARCEL_CLAIMS = 48;
const MAX_PARCEL_RENT_EVENTS = 160;
const MAX_DEPLETED_PARCEL_RESOURCES = 512;
const RAID_EVENT_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const REPAIR_EVENT_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const DEMON_SIEGE_EVENT_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export const EMPTY_WORLD: WorldState = {
  inventory: { wood: 0, stone: 0, coin: 0, silver: 0, gold: 0 },
  choppedTrees: [],
  minedRocks: [],
  buildings: [],
  enemiesKilled: 0,
  axeLevel: 0,
  repairKits: 0,
  raidEvents: [],
  repairEvents: [],
  siegeEvents: [],
  parcelClaims: [],
  parcelRentEvents: [],
  parcelRentCollected: [],
  depletedParcelResources: [],
  ecosystem: undefined,
  relations: {},
};

// ── Market (Aldric) ───────────────────────────────────────────────────────────
// House-edge spread: the BUY price (player buys a resource with coin) is always
// higher than the SELL price (player sells a resource for coin), so any
// round-trip loses value — the merchant always wins. BUY must also clear the
// haggle hard ceiling (see /api/npc MAX_WOOD_PRICE = 5) so a great negotiation
// still can't be arbitraged against the buy-back. Prices are static in Phase 1;
// Phase 2 makes the wood `mid` dynamic (tree scarcity × coin inflation).
export interface ResourcePrice {
  /** Coin the player RECEIVES per unit when selling to Aldric. */
  sell: number;
  /** Coin the player PAYS per unit when buying from Aldric. */
  buy: number;
}
export const MARKET: Partial<Record<ResourceType, ResourcePrice>> = {
  // Wood is priced dynamically via woodQuote(); this is a fallback. Stone uses a
  // static quote for now (buy > sell keeps the house edge), and can get its own
  // dynamic model later. Stone is rarer than wood, so it's worth more.
  wood: { sell: 2, buy: 6 },
  stone: { sell: 4, buy: 9 },
  silver: { sell: 12, buy: 26 },
  gold: { sell: 30, buy: 66 },
};

/** Cost in coin of the one-time "sharper axe" upgrade (2× wood per chop). */
export const AXE_UPGRADE_COST = 70;
/** Cost in coin of one sapling (regrows one felled tree). */
export const SAPLING_COST = 5;
/** Cost in coin of one repair kit. */
export const REPAIR_KIT_COST = 12;
/** Wood spent by any repair action. Repair kits boost the same wood repair. */
export const REPAIR_WOOD_COST = 2;
/** HP restored by a wood-only repair. */
export const REPAIR_WOOD_HEAL = 30;
/** HP restored when a repair kit is consumed with the wood repair. */
export const REPAIR_KIT_HEAL = 60;
/** Public-world hostile raid cost/damage. Future weapon upgrades can scale these. */
export const RAID_STONE_COST = 2;
export const RAID_BASE_DAMAGE = 18;
export const RAID_COOLDOWN_MS = 1000 * 60 * 10;
export const DEMON_SIEGE_DAMAGE = 4;
export const DEMON_SIEGE_COOLDOWN_MS = 1000 * 15;
export const DEMON_SIEGE_WINDOW_MS = 1000 * 60 * 10;
export const DEMON_SIEGE_WINDOW_DAMAGE_CAP = 24;
export const DEMON_SIEGE_SAFE_PHASE_MS = 1000 * 60 * 2;
export const PARCEL_SIZE = 18;
export const PARCEL_MIN_RADIUS = 26;
export const PARCEL_BUILD_RENT_COIN = 2;
export const PARCEL_GATHER_RENT_COIN = 1;
export const PARCEL_COMMISSION_BPS = 1200;
export const PARCEL_BASE_WORLD_RADIUS = 132;
export const PARCEL_HARD_WORLD_RADIUS = 260;

// ── Dynamic wood pricing (Phase 2) ────────────────────────────────────────────
// A relative market: wood's coin value rises with scarcity (fewer trees left on
// the map) and with coin inflation (the more coin the player hoards, the less
// each coin is worth). A symmetric multiplicative house spread means buying
// always costs HOUSE_SPREAD× the mid and selling pays mid ÷ HOUSE_SPREAD — the
// merchant profits on BOTH directions, so any round-trip loses value.
export const HOUSE_SPREAD = 1.3;
export const WOOD_BASE_PRICE = 3; // coin per wood at neutral scarcity & inflation
export const COIN_INFLATION_REF = 200; // coin balance at which inflation maxes out

// Prompt 23 (economy) — Phase 1: ONE scarcity-driven pricing primitive for every
// resource. Price = base × scarcity × coin-inflation, with the house spread. The
// "treasury" is the world's remaining minable supply (trees/rocks left, which live
// in the 0G world bundle), so prices respond to how much has been extracted.
export const RESOURCE_BASE_PRICE: Record<'wood' | 'stone' | 'silver' | 'gold', number> = {
  wood: 3, stone: 4.5, silver: 13, gold: 33,
};

export interface WoodQuote {
  /** Fair mid price (coin/unit) before the house spread. */
  mid: number;
  /** Coin the player RECEIVES per unit on a quick sale (mid ÷ spread). */
  sell: number;
  /** Coin the player PAYS per unit to buy (mid × spread, always > any haggle). */
  buy: number;
  /** Most Aldric will pay per unit even when haggled hard (≈ the fair mid). */
  haggleCeil: number;
}

/**
 * Live wood quote for this player's world. `totalTrees` is passed in (from
 * map.ts TREES.length) to keep this module decoupled from the heavy scene graph.
 */
/** The shared scarcity→price primitive. `fractionRemaining` is supply left in the
 * world (1 = untouched, 0 = exhausted); `coinBalance` drives inflation. */
export function quoteFromScarcity(basePrice: number, fractionRemaining: number, coinBalance: number): WoodQuote {
  const frac = Math.max(0, Math.min(1, fractionRemaining));
  const scarcity = 0.8 + 1.0 * (1 - frac); // 0.8 (abundant) → 1.8 (scarce)
  const inflation = 1 + Math.min(coinBalance / COIN_INFLATION_REF, 1) * 0.5; // 1 → 1.5
  const mid = basePrice * scarcity * inflation;
  const sell = Math.max(1, Math.round(mid / HOUSE_SPREAD));
  const haggleCeil = Math.max(sell, Math.round(mid)); // best negotiable = the fair mid
  const buy = Math.max(Math.round(mid * HOUSE_SPREAD), haggleCeil + 1); // strictly above haggle
  return { mid, sell, buy, haggleCeil };
}

export function woodQuote(world: WorldState, totalTrees: number): WoodQuote {
  const remaining = Math.max(0, totalTrees - world.choppedTrees.length);
  const forest = totalTrees > 0 ? remaining / totalTrees : 1; // 1 full → 0 clearcut
  return quoteFromScarcity(RESOURCE_BASE_PRICE.wood, forest, world.inventory.coin);
}

/** Live ore quote: scarcity = fraction of that ore's rock outcrops still unmined. */
export function oreQuote(world: WorldState, ore: OreType, totalOfOre: number, minedOfOre: number): WoodQuote {
  const remaining = Math.max(0, totalOfOre - minedOfOre);
  const frac = totalOfOre > 0 ? remaining / totalOfOre : 1;
  return quoteFromScarcity(RESOURCE_BASE_PRICE[ore], frac, world.inventory.coin);
}

/** Prompt 23 F4: the treasury ask is derived from live mid, but kept below resale
 * so paid mining can back minerals without creating a buy-low/sell-high exploit. */
export function miningCostFromQuote(quote: WoodQuote): number {
  // Mining = buying the ore from the world treasury. Price it at the fair MID:
  // strictly ABOVE the resale price (quote.sell) so you can't mine-then-sell for a
  // free-coin pump that drains the treasury, yet BELOW Aldric's buy price (mid ×
  // spread) so mining still beats buying.
  return Math.max(quote.sell + 1, Math.round(quote.mid));
}

export function isLocalhostFreeBuildWallet(addr: string | null = wallet): boolean {
  // Hard disable for now to allow proper testing of gathering and building locally
  return false;
}

function applyLocalhostFreeBuild(state: WorldState, addr: string | null = wallet): WorldState {
  if (!isLocalhostFreeBuildWallet(addr)) return state;
  return {
    ...state,
    inventory: { ...state.inventory, wood: MAX_WOOD, stone: MAX_STONE, coin: Math.max(state.inventory.coin, 999) },
    axeLevel: Math.max(state.axeLevel, 1),
    repairKits: Math.max(state.repairKits, 99),
  };
}

function cleanId(raw: unknown, fallback: string): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^[a-zA-Z0-9:_-]{1,96}$/.test(value) ? value : fallback;
}

function legacyBuildingId(b: Building, index: number): string {
  const parts = [
    'legacy',
    index,
    b.type,
    Math.round(b.x * 10),
    Math.round(b.z * 10),
    Math.round((b.rot ?? 0) * 100),
    Math.round((b.y ?? 0) * 10),
    Math.round((b.scale ?? 0) * 100),
  ];
  return parts.join(':');
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBuildings(raw: unknown): Building[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Building =>
      !!b &&
      (b.type === 'wall' || b.type === 'house' || b.type === 'block') &&
      typeof b.x === 'number' &&
      typeof b.z === 'number' &&
      Number.isFinite(b.x) &&
      Number.isFinite(b.z) &&
      Math.abs(b.x) <= MAX_BUILD_COORD &&
      Math.abs(b.z) <= MAX_BUILD_COORD
    )
    .map((b, index) => {
      const base: Building = {
        id: cleanId((b as any).id, legacyBuildingId(b, index)),
        type: b.type,
        x: b.x,
        z: b.z,
        rot: typeof b.rot === 'number' && Number.isFinite(b.rot) ? b.rot : 0,
        woodCost: typeof b.woodCost === 'number' ? Math.max(0, Math.round(b.woodCost)) : undefined,
      };

      let defaultHp = 50;
      if (b.type === 'house') defaultHp = 150;
      if (b.type === 'wall') defaultHp = 80;

      base.maxHp = typeof (b as any).maxHp === 'number' && Number.isFinite((b as any).maxHp) ? Math.max(1, Math.min(300, Math.round((b as any).maxHp))) : defaultHp;
      base.hp = typeof (b as any).hp === 'number' && Number.isFinite((b as any).hp) ? Math.max(0, Math.min(base.maxHp, Math.round((b as any).hp))) : base.maxHp;

      if (b.type === 'block') {
        base.y = typeof b.y === 'number' && Number.isFinite(b.y) ? Math.max(0, Math.min(MAX_BLOCK_Y, b.y)) : 0;
        base.scale = typeof b.scale === 'number' && Number.isFinite(b.scale) ? Math.max(BLOCK_SCALE_MIN, Math.min(BLOCK_SCALE_MAX, b.scale)) : BLOCK_UNIT;
        base.color = typeof b.color === 'string' ? b.color : '#8a6a4a';
      }
      return base;
    });
}

function normalizeRelations(raw: unknown): Record<string, WalletRelation> {
  if (!raw || typeof raw !== 'object') return {};
  const relations: Record<string, WalletRelation> = {};
  for (const [wallet, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = wallet.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(key)) continue;
    if (value === 'allied' || value === 'hostile') relations[key] = value;
  }
  return relations;
}

function normalizeRaidEvents(raw: unknown): RaidEvent[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const events: RaidEvent[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const p = value as Record<string, unknown>;
    const attacker = typeof p.attacker === 'string' ? p.attacker.toLowerCase() : '';
    const defender = typeof p.defender === 'string' ? p.defender.toLowerCase() : '';
    if (!/^0x[a-f0-9]{40}$/.test(attacker) || !/^0x[a-f0-9]{40}$/.test(defender)) continue;
    const at = Math.round(Number(p.at ?? 0));
    if (!Number.isFinite(at) || at <= 0 || at > now + 1000 * 60 * 10) continue;
    if (now - at > RAID_EVENT_TTL_MS) continue;
    const damage = Math.max(1, Math.min(60, Math.round(Number(p.damage ?? RAID_BASE_DAMAGE))));
    const stoneCost = Math.max(0, Math.min(20, Math.round(Number(p.stoneCost ?? RAID_STONE_COST))));
    const weaponLevel = Math.max(0, Math.min(5, Math.round(Number(p.weaponLevel ?? 0))));
    events.push({
      id: cleanId(p.id, createId('raid')),
      attacker,
      defender,
      buildingId: cleanId(p.buildingId, ''),
      damage,
      stoneCost,
      weaponLevel,
      at,
    });
  }
  return events.filter((event) => event.buildingId).sort((a, b) => b.at - a.at).slice(0, MAX_RAID_EVENTS);
}

function normalizeRepairEvents(raw: unknown): RepairEvent[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const events: RepairEvent[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const p = value as Record<string, unknown>;
    const repairer = typeof p.repairer === 'string' ? p.repairer.toLowerCase() : '';
    const owner = typeof p.owner === 'string' ? p.owner.toLowerCase() : '';
    if (!/^0x[a-f0-9]{40}$/.test(repairer) || !/^0x[a-f0-9]{40}$/.test(owner)) continue;
    const at = Math.round(Number(p.at ?? 0));
    if (!Number.isFinite(at) || at <= 0 || at > now + 1000 * 60 * 10) continue;
    if (now - at > REPAIR_EVENT_TTL_MS) continue;
    const heal = Math.max(1, Math.min(120, Math.round(Number(p.heal ?? REPAIR_WOOD_HEAL))));
    const woodCost = Math.max(0, Math.min(20, Math.round(Number(p.woodCost ?? REPAIR_WOOD_COST))));
    events.push({
      id: cleanId(p.id, createId('repair')),
      repairer,
      owner,
      buildingId: cleanId(p.buildingId, ''),
      heal,
      woodCost,
      kitUsed: Boolean(p.kitUsed),
      at,
    });
  }
  return events.filter((event) => event.buildingId).sort((a, b) => b.at - a.at).slice(0, MAX_REPAIR_EVENTS);
}

function normalizeDemonSiegeEvents(raw: unknown): DemonSiegeEvent[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const events: DemonSiegeEvent[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const p = value as Record<string, unknown>;
    const owner = typeof p.owner === 'string' ? p.owner.toLowerCase() : '';
    if (!/^0x[a-f0-9]{40}$/.test(owner)) continue;
    const at = Math.round(Number(p.at ?? 0));
    if (!Number.isFinite(at) || at <= 0 || at > now + 1000 * 60 * 10) continue;
    if (now - at > DEMON_SIEGE_EVENT_TTL_MS) continue;
    const windowStartedAt = Math.round(Number(p.windowStartedAt ?? demonSiegeWindowStart(at)));
    const rawZone = typeof p.zone === 'string' ? p.zone : undefined;
    const zone = rawZone && ['north_forest', 'riverlands', 'east_hills', 'south_fields', 'west_grove'].includes(rawZone)
      ? rawZone as DemonSiegeEvent['zone']
      : undefined;
    events.push({
      id: cleanId(p.id, createId('siege')),
      owner,
      buildingId: cleanId(p.buildingId, ''),
      damage: Math.max(1, Math.min(DEMON_SIEGE_DAMAGE, Math.round(Number(p.damage ?? DEMON_SIEGE_DAMAGE)))),
      at,
      windowStartedAt,
      zone,
      source: 'demon',
      capped: Boolean(p.capped),
    });
  }
  return events.filter((event) => event.buildingId).sort((a, b) => b.at - a.at).slice(0, MAX_DEMON_SIEGE_EVENTS);
}

export function parcelGridAt(x: number, z: number): { gx: number; gz: number } {
  return { gx: Math.round(x / PARCEL_SIZE), gz: Math.round(z / PARCEL_SIZE) };
}

export function parcelIdFromGrid(gx: number, gz: number): string {
  return `p:${gx}:${gz}`;
}

export function parcelIdAt(x: number, z: number): string {
  const { gx, gz } = parcelGridAt(x, z);
  return parcelIdFromGrid(gx, gz);
}

export function parcelGridCenter(gx: number, gz: number): { x: number; z: number } {
  return { x: gx * PARCEL_SIZE, z: gz * PARCEL_SIZE };
}

function parseParcelId(id: string): { gx: number; gz: number } | null {
  const match = id.match(/^p:([-0-9]+):([-0-9]+)$/);
  if (!match) return null;
  const gx = Number(match[1]);
  const gz = Number(match[2]);
  return Number.isInteger(gx) && Number.isInteger(gz) ? { gx, gz } : null;
}

export function parcelCellIntersectsBase(gx: number, gz: number): boolean {
  const { x, z } = parcelGridCenter(gx, gz);
  const half = PARCEL_SIZE / 2;
  const nearestX = Math.max(x - half, Math.min(0, x + half));
  const nearestZ = Math.max(z - half, Math.min(0, z + half));
  return Math.hypot(nearestX, nearestZ) <= PARCEL_BASE_WORLD_RADIUS;
}

function parcelWithinHardLimit(gx: number, gz: number): boolean {
  const { x, z } = parcelGridCenter(gx, gz);
  return Math.hypot(x, z) <= PARCEL_HARD_WORLD_RADIUS;
}

function normalizedClaimedIds(claimedIds: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const id of claimedIds) {
    const parsed = parseParcelId(id);
    if (parsed) out.add(parcelIdFromGrid(parsed.gx, parsed.gz));
  }
  return out;
}

export function parcelIsClaimable(gx: number, gz: number, claimedIds: Iterable<string> = []): boolean {
  const id = parcelIdFromGrid(gx, gz);
  const claimed = normalizedClaimedIds(claimedIds);
  if (claimed.has(id)) return false;
  if (parcelCellIntersectsBase(gx, gz)) return false;
  if (!parcelWithinHardLimit(gx, gz)) return false;

  const neighbors = [
    [gx + 1, gz],
    [gx - 1, gz],
    [gx, gz + 1],
    [gx, gz - 1],
  ] as const;
  return neighbors.some(([nx, nz]) => parcelCellIntersectsBase(nx, nz) || claimed.has(parcelIdFromGrid(nx, nz)));
}

export function frontierClaimableCells(claimedIds: Iterable<string> = []): { gx: number; gz: number }[] {
  const claimed = normalizedClaimedIds(claimedIds);
  const candidates = new Set<string>();
  const maxGrid = Math.ceil(PARCEL_HARD_WORLD_RADIUS / PARCEL_SIZE);

  for (let gx = -maxGrid; gx <= maxGrid; gx++) {
    for (let gz = -maxGrid; gz <= maxGrid; gz++) {
      if (!parcelCellIntersectsBase(gx, gz)) continue;
      for (const [nx, nz] of [[gx + 1, gz], [gx - 1, gz], [gx, gz + 1], [gx, gz - 1]] as const) {
        const id = parcelIdFromGrid(nx, nz);
        if (!claimed.has(id)) candidates.add(id);
      }
    }
  }

  for (const id of claimed) {
    const parsed = parseParcelId(id);
    if (!parsed) continue;
    for (const [nx, nz] of [[parsed.gx + 1, parsed.gz], [parsed.gx - 1, parsed.gz], [parsed.gx, parsed.gz + 1], [parsed.gx, parsed.gz - 1]] as const) {
      const nextId = parcelIdFromGrid(nx, nz);
      if (!claimed.has(nextId)) candidates.add(nextId);
    }
  }

  return Array.from(candidates)
    .map((id) => parseParcelId(id))
    .filter((cell): cell is { gx: number; gz: number } => !!cell && parcelIsClaimable(cell.gx, cell.gz, claimed))
    .sort((a, b) => Math.hypot(a.gx, a.gz) - Math.hypot(b.gx, b.gz) || a.gx - b.gx || a.gz - b.gz);
}

export function worldExtentForClaims(claims: Pick<ParcelClaim, 'x' | 'z' | 'size'>[] = []): { minX: number; maxX: number; minZ: number; maxZ: number; radius: number } {
  let minX = -PARCEL_BASE_WORLD_RADIUS;
  let maxX = PARCEL_BASE_WORLD_RADIUS;
  let minZ = -PARCEL_BASE_WORLD_RADIUS;
  let maxZ = PARCEL_BASE_WORLD_RADIUS;
  let radius = PARCEL_BASE_WORLD_RADIUS;
  for (const claim of claims) {
    const half = claim.size / 2;
    minX = Math.min(minX, claim.x - half);
    maxX = Math.max(maxX, claim.x + half);
    minZ = Math.min(minZ, claim.z - half);
    maxZ = Math.max(maxZ, claim.z + half);
    radius = Math.max(radius, Math.hypot(claim.x, claim.z) + half);
  }
  return { minX, maxX, minZ, maxZ, radius };
}

export function cellLabel(gx: number, gz: number): string {
  const offset = Math.ceil(PARCEL_BASE_WORLD_RADIUS / PARCEL_SIZE);
  let col = gx + offset;
  let label = '';
  do {
    const rem = ((col % 26) + 26) % 26;
    label = String.fromCharCode(65 + rem) + label;
    col = Math.floor(col / 26) - 1;
  } while (col >= 0);
  return `${label}${gz + offset + 1}`;
}

export function parcelClaimCost(gx: number, gz: number): number {
  const distance = Math.hypot(gx, gz);
  return Math.max(12, Math.round(18 + distance * 5));
}

export function parcelTerrainForGrid(gx: number, gz: number): ParcelClaim['terrain'] {
  const n = Math.abs((gx * 73856093) ^ (gz * 19349663));
  if (n % 7 === 0) return 'quarry';
  if (n % 3 === 0) return 'grove';
  return 'meadow';
}

function normalizeTerrain(raw: unknown): ParcelClaim['terrain'] {
  return raw === 'grove' || raw === 'quarry' ? raw : 'meadow';
}

function normalizeBytes32(raw: unknown): string | null {
  return typeof raw === 'string' && /^0x[a-fA-F0-9]{64}$/.test(raw) ? raw : null;
}

function normalizeParcelClaims(raw: unknown): ParcelClaim[] {
  if (!Array.isArray(raw)) return [];
  const claims: ParcelClaim[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const p = value as Record<string, unknown>;
    const owner = typeof p.owner === 'string' ? p.owner.toLowerCase() : '';
    if (!/^0x[a-f0-9]{40}$/.test(owner)) continue;
    const gx = Math.max(-12, Math.min(12, Math.round(Number(p.gx ?? 0))));
    const gz = Math.max(-12, Math.min(12, Math.round(Number(p.gz ?? 0))));
    const id = parcelIdFromGrid(gx, gz);
    const x = gx * PARCEL_SIZE;
    const z = gz * PARCEL_SIZE;
    if (Math.hypot(x, z) < PARCEL_MIN_RADIUS || !parcelWithinHardLimit(gx, gz)) continue;
    const at = Math.round(Number(p.at ?? 0));
    claims.push({
      id,
      owner,
      gx,
      gz,
      x,
      z,
      size: PARCEL_SIZE,
      claimCost: Math.max(0, Math.min(999, Math.round(Number(p.claimCost ?? parcelClaimCost(gx, gz))))),
      commissionBps: Math.max(0, Math.min(5000, Math.round(Number(p.commissionBps ?? PARCEL_COMMISSION_BPS)))),
      terrain: normalizeTerrain(p.terrain),
      dataRoot: normalizeBytes32(p.dataRoot),
      dataTxHash: normalizeBytes32(p.dataTxHash),
      at: Number.isFinite(at) && at > 0 ? at : Date.now(),
    });
  }
  const seen = new Set<string>();
  return claims
    .sort((a, b) => a.at - b.at)
    .filter((claim) => {
      if (seen.has(claim.id)) return false;
      seen.add(claim.id);
      return true;
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_PARCEL_CLAIMS);
}

function normalizeParcelRentEvents(raw: unknown): ParcelRentEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: ParcelRentEvent[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const p = value as Record<string, unknown>;
    const payer = typeof p.payer === 'string' ? p.payer.toLowerCase() : '';
    const owner = typeof p.owner === 'string' ? p.owner.toLowerCase() : '';
    if (!/^0x[a-f0-9]{40}$/.test(payer) || !/^0x[a-f0-9]{40}$/.test(owner)) continue;
    const action = p.action === 'gather' ? 'gather' : 'build';
    const at = Math.round(Number(p.at ?? 0));
    events.push({
      id: cleanId(p.id, createId('rent')),
      payer,
      owner,
      parcelId: cleanId(p.parcelId, ''),
      action,
      coin: Math.max(1, Math.min(99, Math.round(Number(p.coin ?? PARCEL_BUILD_RENT_COIN)))),
      at: Number.isFinite(at) && at > 0 ? at : Date.now(),
    });
  }
  return events.filter((event) => event.parcelId).sort((a, b) => b.at - a.at).slice(0, MAX_PARCEL_RENT_EVENTS);
}

function normalizeCollectedRentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((id) => cleanId(id, '')).filter(Boolean))).slice(0, MAX_PARCEL_RENT_EVENTS);
}

function normalizeParcelResourceIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((id) => cleanId(id, '')).filter(Boolean))).slice(0, MAX_DEPLETED_PARCEL_RESOURCES);
}

function normalizeTreasury(raw: unknown, baseUpdatedAt: number): NonNullable<EcosystemState['treasury']> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const oreRaw = p.orePurchased && typeof p.orePurchased === 'object' ? p.orePurchased as Record<string, unknown> : {};
  return {
    updatedAt: Math.max(0, Math.round(Number(p.updatedAt ?? baseUpdatedAt))) || baseUpdatedAt,
    coin: Math.max(0, Math.round(Number(p.coin ?? 0))),
    paidMiningRevenue: Math.max(0, Math.round(Number(p.paidMiningRevenue ?? p.coin ?? 0))),
    paidMiningCount: Math.max(0, Math.round(Number(p.paidMiningCount ?? 0))),
    orePurchased: {
      stone: Math.max(0, Math.round(Number(oreRaw.stone ?? 0))),
      silver: Math.max(0, Math.round(Number(oreRaw.silver ?? 0))),
      gold: Math.max(0, Math.round(Number(oreRaw.gold ?? 0))),
    },
  };
}

function normalizeEcosystem(raw: unknown): EcosystemState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, any>;
  const updatedAt = Number(p.updatedAt);
  const baseUpdatedAt = Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
  const sourceFingerprint = typeof p.sourceFingerprint === 'string' ? p.sourceFingerprint : undefined;

  const earthRaw = p.earth && typeof p.earth === 'object' ? p.earth : undefined;
  const earth = earthRaw
    ? {
        updatedAt: Math.max(0, Math.round(Number(earthRaw.updatedAt ?? baseUpdatedAt))) || baseUpdatedAt,
        cadenceMs: Math.max(15000, Math.min(1000 * 60 * 30, Math.round(Number(earthRaw.cadenceMs ?? 1000 * 60 * 4)))),
        nextGrowthAt: Math.max(0, Math.round(Number(earthRaw.nextGrowthAt ?? 0))),
        nextRockAt: Math.max(0, Math.round(Number(earthRaw.nextRockAt ?? 0))) || undefined,
        dominantZone: cleanNatureZoneId(earthRaw.dominantZone),
        zones: normalizeEarthZones(earthRaw.zones),
        summary: typeof earthRaw.summary === 'string' ? earthRaw.summary : 'The soil shifts quietly beneath Aldenmoor.',
      }
    : undefined;

  const faunaRaw = p.fauna && typeof p.fauna === 'object' ? p.fauna : undefined;
  const fauna = faunaRaw
    ? {
        updatedAt: Math.max(0, Math.round(Number(faunaRaw.updatedAt ?? baseUpdatedAt))) || baseUpdatedAt,
        spawnIntervalMs: Math.max(15000, Math.min(1000 * 60 * 8, Math.round(Number(faunaRaw.spawnIntervalMs ?? 1000 * 60 * 2)))),
        calmDelayMs: Math.max(0, Math.min(1000 * 60 * 10, Math.round(Number(faunaRaw.calmDelayMs ?? 20000)))),
        maxEnemies: Math.max(1, Math.min(24, Math.round(Number(faunaRaw.maxEnemies ?? 8)))),
        speedMultiplier: Math.max(0.6, Math.min(2.2, Number(faunaRaw.speedMultiplier ?? 1))),
        dominantZone: cleanNatureZoneId(faunaRaw.dominantZone),
        mood: faunaRaw.mood === 'hostile' || faunaRaw.mood === 'neutral' ? faunaRaw.mood : 'wary',
        zones: normalizeFaunaZones(faunaRaw.zones),
        summary: typeof faunaRaw.summary === 'string' ? faunaRaw.summary : 'The fauna circles the map edge, waiting for weakness.',
      }
    : undefined;

  const activityRaw = p.activity && typeof p.activity === 'object' ? p.activity : undefined;
  const activity = activityRaw
    ? {
        updatedAt: Math.max(0, Math.round(Number(activityRaw.updatedAt ?? baseUpdatedAt))) || baseUpdatedAt,
        formulaVersion: typeof activityRaw.formulaVersion === 'string' ? activityRaw.formulaVersion : 'prompt23-f4-v1',
        tokensInCirculation: Math.max(0, Math.round(Number(activityRaw.tokensInCirculation ?? 0))),
        depletedTrees: Math.max(0, Math.round(Number(activityRaw.depletedTrees ?? 0))),
        depletedRocks: Math.max(0, Math.round(Number(activityRaw.depletedRocks ?? 0))),
        recentExtraction: Math.max(0, Math.round(Number(activityRaw.recentExtraction ?? 0))),
        stockPressure: Math.max(0, Math.min(1, Number(activityRaw.stockPressure ?? 0))),
        activityScore: Math.max(0, Math.min(1, Number(activityRaw.activityScore ?? 0))),
        treeCadenceMs: Math.max(1000 * 45, Math.min(1000 * 60 * 12, Math.round(Number(activityRaw.treeCadenceMs ?? 1000 * 60 * 4)))),
        rockCadenceMs: Math.max(1000 * 45, Math.min(1000 * 60 * 12, Math.round(Number(activityRaw.rockCadenceMs ?? 1000 * 60 * 6)))),
      }
    : undefined;

  const treasury = normalizeTreasury(p.treasury, baseUpdatedAt);

  if (!earth && !fauna && !activity && !treasury) return undefined;
  return { updatedAt: baseUpdatedAt, sourceFingerprint, earth, fauna, activity, treasury };
}

function cleanNatureZoneId(raw: unknown): 'north_forest' | 'riverlands' | 'east_hills' | 'south_fields' | 'west_grove' {
  return raw === 'riverlands' || raw === 'east_hills' || raw === 'south_fields' || raw === 'west_grove' ? raw : 'north_forest';
}

function normalizeEarthZones(raw: unknown): NonNullable<NonNullable<EcosystemState['earth']>['zones']> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((zone) => zone && typeof zone === 'object')
    .map((zone) => {
      const z = zone as Record<string, any>;
      return {
        id: cleanNatureZoneId(z.id),
        fertility: Math.max(0, Math.min(100, Math.round(Number(z.fertility ?? 50)))),
        regrowthShare: Math.max(0, Math.min(1, Number(z.regrowthShare ?? 0.2))),
        note: typeof z.note === 'string' ? z.note : 'The soil holds steady.',
      };
    });
}

function normalizeFaunaZones(raw: unknown): NonNullable<NonNullable<EcosystemState['fauna']>['zones']> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((zone) => zone && typeof zone === 'object')
    .map((zone) => {
      const z = zone as Record<string, any>;
      return {
        id: cleanNatureZoneId(z.id),
        demeanor: z.demeanor === 'hostile' || z.demeanor === 'neutral' ? z.demeanor : 'wary',
        spawnWeight: Math.max(0, Math.min(1, Number(z.spawnWeight ?? 0.2))),
        note: typeof z.note === 'string' ? z.note : 'Tracks gather and disperse without warning.',
      };
    });
}

export function normalizeWorldState(raw: unknown): WorldState {
  const p = raw && typeof raw === 'object' ? (raw as any) : {};
  const intIndexSet = (raw: unknown): number[] =>
    Array.isArray(raw)
      ? Array.from(new Set<number>(raw.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0)))
      : [];
  const choppedTrees = intIndexSet(p?.choppedTrees);
  const minedRocks = intIndexSet(p?.minedRocks);

  return {
    inventory: {
      wood: Math.max(0, Number(p?.inventory?.wood ?? 0)),
      stone: Math.max(0, Number(p?.inventory?.stone ?? 0)),
      coin: Math.max(0, Number(p?.inventory?.coin ?? 0)),
      silver: Math.max(0, Number(p?.inventory?.silver ?? 0)),
      gold: Math.max(0, Number(p?.inventory?.gold ?? 0)),
    },
    choppedTrees,
    minedRocks,
    buildings: normalizeBuildings(p?.buildings),
    enemiesKilled: Math.max(0, Number(p?.enemiesKilled ?? 0)),
    axeLevel: Math.max(0, Math.round(Number(p?.axeLevel ?? 0))),
    repairKits: Math.max(0, Math.round(Number(p?.repairKits ?? 0))),
    raidEvents: normalizeRaidEvents(p?.raidEvents),
    repairEvents: normalizeRepairEvents(p?.repairEvents),
    siegeEvents: normalizeDemonSiegeEvents(p?.siegeEvents),
    parcelClaims: normalizeParcelClaims(p?.parcelClaims),
    parcelRentEvents: normalizeParcelRentEvents(p?.parcelRentEvents),
    parcelRentCollected: normalizeCollectedRentIds(p?.parcelRentCollected),
    depletedParcelResources: normalizeParcelResourceIds(p?.depletedParcelResources),
    ecosystem: normalizeEcosystem(p?.ecosystem),
    relations: normalizeRelations(p?.relations),
    savedAt: Number.isFinite(Number(p?.savedAt)) ? Number(p?.savedAt) : 0,
  };
}

export function cloneWorldState(value: WorldState = EMPTY_WORLD): WorldState {
  return {
    inventory: { ...value.inventory },
    choppedTrees: [...value.choppedTrees],
    minedRocks: [...value.minedRocks],
    buildings: value.buildings.map((b) => ({ ...b })),
    enemiesKilled: value.enemiesKilled,
    axeLevel: value.axeLevel,
    repairKits: value.repairKits,
    raidEvents: value.raidEvents.map((event) => ({ ...event })),
    repairEvents: value.repairEvents.map((event) => ({ ...event })),
    siegeEvents: value.siegeEvents.map((event) => ({ ...event })),
    parcelClaims: value.parcelClaims.map((claim) => ({ ...claim })),
    parcelRentEvents: value.parcelRentEvents.map((event) => ({ ...event })),
    parcelRentCollected: [...value.parcelRentCollected],
    depletedParcelResources: [...value.depletedParcelResources],
    ecosystem: value.ecosystem
      ? {
          ...value.ecosystem,
          earth: value.ecosystem.earth
            ? {
                ...value.ecosystem.earth,
                zones: value.ecosystem.earth.zones.map((zone) => ({ ...zone })),
              }
            : undefined,
          fauna: value.ecosystem.fauna
            ? {
                ...value.ecosystem.fauna,
                zones: value.ecosystem.fauna.zones.map((zone) => ({ ...zone })),
              }
            : undefined,
          activity: value.ecosystem.activity ? { ...value.ecosystem.activity } : undefined,
          treasury: value.ecosystem.treasury
            ? {
                ...value.ecosystem.treasury,
                orePurchased: { ...value.ecosystem.treasury.orePurchased },
              }
            : undefined,
        }
      : undefined,
    relations: { ...value.relations },
    savedAt: value.savedAt,
  };
}

// ── Persistence seam (martelaxe owns the 0G/on-chain implementation) ──────────
export interface WorldPersistence {
  load(wallet: string): Promise<WorldState>;
  save(wallet: string, state: WorldState): Promise<void>;
}

function key(wallet: string) {
  return `engram:world:${wallet.toLowerCase()}`;
}

/**
 * DEFAULT persistence = localStorage. Works now, but is local-only (not on 0G,
 * not cross-device). martelaxe: replace via setWorldPersistence() with a 0G /
 * contract-backed implementation (wood balance, coins, built structures).
 */
export const localWorldPersistence: WorldPersistence = {
  async load(wallet) {
    if (typeof window === 'undefined') return cloneWorldState();
    try {
      const raw = window.localStorage.getItem(key(wallet));
      if (!raw) return cloneWorldState();
      return normalizeWorldState(JSON.parse(raw));
    } catch {
      return cloneWorldState();
    }
  },
  async save(wallet, state) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key(wallet), JSON.stringify(state));
  },
};

let persistence: WorldPersistence = localWorldPersistence;
/** martelaxe: call once at startup to back the world state with 0G / a contract. */
export function setWorldPersistence(p: WorldPersistence) {
  persistence = p;
}

// ── Reactive store (dependency-free) ──────────────────────────────────────────
let state: WorldState = { ...EMPTY_WORLD };
let wallet: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Load this wallet's world state through the persistence seam. */
export async function initWorld(addr: string): Promise<void> {
  wallet = addr;
  state = applyLocalhostFreeBuild(await persistence.load(addr), addr);
  emit();
}

export function getWorld(): WorldState {
  return state;
}

export function getWorldWallet(): string | null {
  return wallet;
}

async function commit(next: WorldState) {
  // Stamp the mutation time so load() can prefer the newer of the local draft vs a
  // (possibly stale) 0G bundle — no extra wallet signature, no autosave needed.
  state = applyLocalhostFreeBuild({ ...next, savedAt: Date.now() });
  emit();
  if (wallet) {
    try {
      await persistence.save(wallet, state);
    } catch (e) {
      console.warn('[engram] world save failed:', e);
    }
  }
}

export function replaceWorldState(next: WorldState) {
  return commit(next);
}

export function setEcosystemState(ecosystem: EcosystemState | undefined) {
  return commit({ ...state, ecosystem });
}

export function addResource(type: ResourceType, amount: number) {
  return commit({ ...state, inventory: { ...state.inventory, [type]: Math.max(0, state.inventory[type] + amount) } });
}

export function recordEnemyKill() {
  return commit({ ...state, enemiesKilled: state.enemiesKilled + 1 });
}

/** Chop a tree (by its TREES index): mark it chopped + grant wood (capped at
 * MAX_WOOD). No-op if already chopped or already carrying the max. */
export function chopTree(index: number, woodYield = 3) {
  if (state.choppedTrees.includes(index)) return;
  if (state.inventory.wood >= MAX_WOOD) return; // can't carry more
  const wood = Math.min(MAX_WOOD, state.inventory.wood + woodYield);
  return commit({
    ...state,
    inventory: { ...state.inventory, wood },
    choppedTrees: [...state.choppedTrees, index],
  });
}

export function isChopped(index: number): boolean {
  return state.choppedTrees.includes(index);
}

/** True when the player can't carry any more wood. */
export function woodIsFull(): boolean {
  return state.inventory.wood >= MAX_WOOD;
}

// ── Mining (ores) ── parallels tree chopping, against map.ts ROCKS. Each rock is
// a vein of stone, silver, or gold; mining yields that ore. ────────────────────
export const MAX_STONE = 60;
export const MAX_SILVER = 40;
export const MAX_GOLD = 24;
/** Carry cap per ore (rarer metals carry less). */
export const ORE_MAX: Record<OreType, number> = { stone: MAX_STONE, silver: MAX_SILVER, gold: MAX_GOLD };
/** Holds-to-mine before a rock is exhausted; yields ONE unit of its ore per fill. */
export const ROCK_MINES = 18;
export const STONE_PER_MINE = 1;
export const ROCK_STONE = ROCK_MINES * STONE_PER_MINE; // total units per rock

const mined: Record<number, number> = {};

export function isMined(index: number): boolean {
  return state.minedRocks.includes(index);
}

/** True when the player can't carry any more of this ore. */
export function oreIsFull(ore: OreType): boolean {
  return state.inventory[ore] >= ORE_MAX[ore];
}

/** Back-compat: stone-specific full check. */
export function stoneIsFull(): boolean {
  return oreIsFull('stone');
}

export function parcelResourceKey(parcelId: string, nodeIndex: number): string {
  return `parcel:${parcelId}:${Math.max(0, Math.round(nodeIndex))}`;
}

export function isParcelResourceDepleted(resourceId: string): boolean {
  return state.depletedParcelResources.includes(resourceId);
}

export function harvestParcelResource(resourceId: string, type: Extract<ResourceType, 'wood' | 'stone'>): boolean {
  if (!resourceId || isParcelResourceDepleted(resourceId)) return false;
  const cap = type === 'wood' ? MAX_WOOD : MAX_STONE;
  if (state.inventory[type] >= cap) return false;
  commit({
    ...state,
    inventory: { ...state.inventory, [type]: Math.min(cap, state.inventory[type] + 1) },
    depletedParcelResources: [resourceId, ...state.depletedParcelResources].slice(0, MAX_DEPLETED_PARCEL_RESOURCES),
  });
  return true;
}

function addMiningTreasuryPayment(ecosystem: EcosystemState | undefined, ore: OreType, coin: number): EcosystemState {
  const now = Date.now();
  const previous = ecosystem?.treasury;
  const orePurchased = {
    stone: previous?.orePurchased.stone ?? 0,
    silver: previous?.orePurchased.silver ?? 0,
    gold: previous?.orePurchased.gold ?? 0,
  };
  orePurchased[ore] += STONE_PER_MINE;
  return {
    ...(ecosystem ?? { updatedAt: now }),
    updatedAt: now,
    treasury: {
      updatedAt: now,
      coin: (previous?.coin ?? 0) + coin,
      paidMiningRevenue: (previous?.paidMiningRevenue ?? 0) + coin,
      paidMiningCount: (previous?.paidMiningCount ?? 0) + 1,
      orePurchased,
    },
  };
}

type HarvestRockOptions = {
  paidMining?: boolean;
  cost?: number;
};

/** Extract one unit of `ore` from a rock (mirrors harvestTree). After ROCK_MINES
 * fills the rock is exhausted and vanishes. No-op if already mined or that ore is
 * full. The caller passes the rock's ore (from map.ts ROCKS[index].ore). */
export function harvestRock(index: number, ore: OreType = 'stone', options: HarvestRockOptions = {}): { depleted: boolean; gained: boolean; paid?: boolean; cost?: number; reason?: string } {
  if (state.minedRocks.includes(index)) return { depleted: true, gained: false };
  if (state.inventory[ore] >= ORE_MAX[ore]) return { depleted: false, gained: false };
  const cost = options.paidMining ? Math.max(1, Math.round(Number(options.cost ?? 0))) : 0;
  if (cost > 0 && state.inventory.coin < cost) {
    return {
      depleted: false,
      gained: false,
      paid: true,
      cost,
      reason: `Need ${cost} coin to extract ${ore}.`,
    };
  }
  const units = (mined[index] = (mined[index] ?? 0) + 1);
  const depleted = units >= ROCK_MINES;
  commit({
    ...state,
    inventory: {
      ...state.inventory,
      coin: cost > 0 ? Math.max(0, state.inventory.coin - cost) : state.inventory.coin,
      [ore]: Math.min(ORE_MAX[ore], state.inventory[ore] + STONE_PER_MINE),
    },
    minedRocks: depleted ? [...state.minedRocks, index] : state.minedRocks,
    ecosystem: cost > 0 ? addMiningTreasuryPayment(state.ecosystem, ore, cost) : state.ecosystem,
  });
  return { depleted, gained: true, paid: cost > 0, cost: cost || undefined };
}

/** Each fill of the chop bar grants ONE unit of wood (like the original pacing);
 * the tree is felled after TREE_CHOPS fills, so a full tree yields 20 wood but
 * takes ~4x longer than before to chop down. */
export const TREE_CHOPS = 20;
export const WOOD_PER_CHOP = 1;
export const TREE_WOOD = TREE_CHOPS * WOOD_PER_CHOP; // 20

// Transient per-tree extraction progress (not persisted — only the final
// "chopped" state matters for the world; partial harvest resets on reload).
const harvested: Record<number, number> = {};

/**
 * Extract ONE unit of wood from a tree (called each time the player holds the
 * chop key long enough). After TREE_WOOD units the tree is fully chopped and
 * vanishes. No-op (gained:false) if already chopped or the player is full.
 */
export function harvestTree(index: number): { depleted: boolean; gained: boolean } {
  if (state.choppedTrees.includes(index)) return { depleted: true, gained: false };
  if (state.inventory.wood >= MAX_WOOD) return { depleted: false, gained: false };
  const units = (harvested[index] = (harvested[index] ?? 0) + 1);
  const depleted = units >= TREE_CHOPS;
  // Sharper axe (bought from Aldric) doubles the wood gained per chop.
  const yieldPerChop = WOOD_PER_CHOP * (state.axeLevel >= 1 ? 2 : 1);
  commit({
    ...state,
    inventory: { ...state.inventory, wood: Math.min(MAX_WOOD, state.inventory.wood + yieldPerChop) },
    choppedTrees: depleted ? [...state.choppedTrees, index] : state.choppedTrees,
  });
  return { depleted, gained: true };
}

// ── Market actions (coin sinks bought from Aldric) ────────────────────────────
// These mutate world state only; the CLIENT deducts/sees coin via addResource and
// records the interaction in Aldric's memory (so spending also builds trust and
// persists to 0G with Leave & save), mirroring the sell/haggle flow.

/** Regrow one felled tree (the most recently chopped). Returns false if the
 * forest is already whole. The caller charges {@link SAPLING_COST} coin. */
export function replantTree(): boolean {
  if (state.choppedTrees.length === 0) return false;
  commit({ ...state, choppedTrees: state.choppedTrees.slice(0, -1) });
  return true;
}

/** Buy the one-time sharper-axe upgrade. Returns false if already owned. The
 * caller charges {@link AXE_UPGRADE_COST} coin. */
export function upgradeAxe(): boolean {
  if (state.axeLevel >= 1) return false;
  commit({ ...state, axeLevel: 1 });
  return true;
}

/** Add bought wood to the inventory (capped at MAX_WOOD). Returns the units
 * actually received (may be less than requested if near the cap). The caller
 * charges `units × MARKET.wood.buy` coin for the units received. */
export function receiveBoughtWood(units: number): number {
  const room = Math.max(0, MAX_WOOD - state.inventory.wood);
  const got = Math.max(0, Math.min(Math.floor(units), room));
  if (got <= 0) return 0;
  commit({ ...state, inventory: { ...state.inventory, wood: state.inventory.wood + got } });
  return got;
}

export function addRepairKits(amount: number) {
  const next = Math.max(0, state.repairKits + Math.round(amount));
  return commit({ ...state, repairKits: next });
}

// ── Player relations ─────────────────────────────────────────────────────────

export function relationForWallet(targetWallet: string): WalletRelation {
  return state.relations[targetWallet.toLowerCase()] ?? 'neutral';
}

export function setWalletRelation(targetWallet: string, relation: WalletRelation): boolean {
  const key = targetWallet.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(key)) return false;
  const nextRelations = { ...state.relations };
  if (relation === 'neutral') {
    delete nextRelations[key];
  } else {
    nextRelations[key] = relation;
  }
  commit({ ...state, relations: nextRelations });
  return true;
}

export function getOwnedParcelAt(x: number, z: number, claims: ParcelClaim[] = state.parcelClaims): ParcelClaim | null {
  const id = parcelIdAt(x, z);
  return claims.find((claim) => claim.id === id) ?? null;
}

export function previewParcelClaimAt(x: number, z: number, occupiedParcelIds: string[] = []): { ok: boolean; reason?: string; claim?: ParcelClaim } {
  const owner = wallet?.toLowerCase();
  if (!owner) return { ok: false, reason: 'Connect a wallet first.' };
  const { gx, gz } = parcelGridAt(x, z);
  const id = parcelIdFromGrid(gx, gz);
  const cx = gx * PARCEL_SIZE;
  const cz = gz * PARCEL_SIZE;
  const radius = Math.hypot(cx, cz);
  if (radius < PARCEL_MIN_RADIUS) return { ok: false, reason: 'Claim outside the village core.' };
  if (state.parcelClaims.some((claim) => claim.id === id) || occupiedParcelIds.includes(id)) {
    return { ok: false, reason: 'That parcel is already claimed.' };
  }
  if (!parcelIsClaimable(gx, gz, [...state.parcelClaims.map((claim) => claim.id), ...occupiedParcelIds])) {
    return { ok: false, reason: "Only the frontier grows — claim a square next to the map's edge." };
  }
  if (state.parcelClaims.length >= MAX_PARCEL_CLAIMS) return { ok: false, reason: 'Parcel claim cap reached.' };
  const claimCost = parcelClaimCost(gx, gz);
  const freeBuild = isLocalhostFreeBuildWallet();
  if (!freeBuild && state.inventory.coin < claimCost) return { ok: false, reason: `Need ${claimCost} coin to claim this parcel.` };
  const claim: ParcelClaim = {
    id,
    owner,
    gx,
    gz,
    x: cx,
    z: cz,
    size: PARCEL_SIZE,
    claimCost,
    commissionBps: PARCEL_COMMISSION_BPS,
    terrain: parcelTerrainForGrid(gx, gz),
    at: Date.now(),
  };
  return { ok: true, claim };
}

export function commitParcelClaim(claim: ParcelClaim): { ok: boolean; reason?: string; claim?: ParcelClaim } {
  const owner = wallet?.toLowerCase();
  if (!owner) return { ok: false, reason: 'Connect a wallet first.' };
  if (claim.owner !== owner) return { ok: false, reason: 'Cannot commit another wallet parcel.' };
  if (state.parcelClaims.some((existing) => existing.id === claim.id)) return { ok: false, reason: 'That parcel is already claimed.' };
  const freeBuild = isLocalhostFreeBuildWallet();
  commit({
    ...state,
    inventory: { ...state.inventory, coin: freeBuild ? state.inventory.coin : Math.max(0, state.inventory.coin - claim.claimCost) },
    parcelClaims: [claim, ...state.parcelClaims].slice(0, MAX_PARCEL_CLAIMS),
  });
  return { ok: true, claim };
}

export function claimParcelAt(x: number, z: number, occupiedParcelIds: string[] = []): { ok: boolean; reason?: string; claim?: ParcelClaim } {
  const preview = previewParcelClaimAt(x, z, occupiedParcelIds);
  if (!preview.ok || !preview.claim) return preview;
  return commitParcelClaim(preview.claim);
}

export function recordParcelRentEvent(owner: string, parcelId: string, action: ParcelRentEvent['action'] = 'build', coin = PARCEL_BUILD_RENT_COIN): { ok: boolean; reason?: string; event?: ParcelRentEvent } {
  const payer = wallet?.toLowerCase();
  const target = owner.toLowerCase();
  if (!payer) return { ok: false, reason: 'Connect a wallet first.' };
  if (!/^0x[a-f0-9]{40}$/.test(target)) return { ok: false, reason: 'Invalid parcel owner.' };
  if (payer === target) return { ok: true };
  if (!parcelId) return { ok: false, reason: 'Missing parcel id.' };
  const amount = Math.max(1, Math.min(99, Math.round(coin)));
  const freeBuild = isLocalhostFreeBuildWallet();
  if (!freeBuild && state.inventory.coin < amount) return { ok: false, reason: `Need ${amount} coin rent for this parcel.` };
  const event: ParcelRentEvent = {
    id: createId('rent'),
    payer,
    owner: target,
    parcelId,
    action,
    coin: amount,
    at: Date.now(),
  };
  commit({
    ...state,
    inventory: { ...state.inventory, coin: freeBuild ? state.inventory.coin : Math.max(0, state.inventory.coin - amount) },
    parcelRentEvents: [event, ...state.parcelRentEvents].slice(0, MAX_PARCEL_RENT_EVENTS),
  });
  return { ok: true, event };
}

export function collectParcelRentIncome(events: ParcelRentEvent[]): { collected: number; count: number } {
  const owner = wallet?.toLowerCase();
  if (!owner) return { collected: 0, count: 0 };
  const already = new Set(state.parcelRentCollected);
  const payable = events.filter((event) => event.owner === owner && event.payer !== owner && !already.has(event.id));
  if (payable.length === 0) return { collected: 0, count: 0 };
  const collected = payable.reduce((sum, event) => sum + Math.max(0, Math.round(event.coin)), 0);
  commit({
    ...state,
    inventory: { ...state.inventory, coin: state.inventory.coin + collected },
    parcelRentCollected: [...payable.map((event) => event.id), ...state.parcelRentCollected].slice(0, MAX_PARCEL_RENT_EVENTS),
  });
  return { collected, count: payable.length };
}

export function demonSiegeWindowStart(at = Date.now()): number {
  return Math.floor(at / DEMON_SIEGE_WINDOW_MS) * DEMON_SIEGE_WINDOW_MS;
}

export function demonSiegeStatus(at = Date.now()): {
  open: boolean;
  windowStartedAt: number;
  nextOpenAt: number;
  damagePerHit: number;
  damageCap: number;
  cooldownMs: number;
} {
  const windowStartedAt = demonSiegeWindowStart(at);
  const phase = at - windowStartedAt;
  const open = phase >= DEMON_SIEGE_SAFE_PHASE_MS;
  return {
    open,
    windowStartedAt,
    nextOpenAt: open ? windowStartedAt + DEMON_SIEGE_WINDOW_MS + DEMON_SIEGE_SAFE_PHASE_MS : windowStartedAt + DEMON_SIEGE_SAFE_PHASE_MS,
    damagePerHit: DEMON_SIEGE_DAMAGE,
    damageCap: DEMON_SIEGE_WINDOW_DAMAGE_CAP,
    cooldownMs: DEMON_SIEGE_COOLDOWN_MS,
  };
}

export function latestDemonSiegeAgainst(owner: string, buildingId: string): DemonSiegeEvent | null {
  const target = owner.toLowerCase();
  return state.siegeEvents
    .filter((event) => event.owner === target && event.buildingId === buildingId)
    .sort((a, b) => b.at - a.at)[0] ?? null;
}

export function demonSiegeDamageInWindow(owner: string, windowStartedAt: number): number {
  const target = owner.toLowerCase();
  return state.siegeEvents
    .filter((event) => event.owner === target && event.windowStartedAt === windowStartedAt)
    .reduce((sum, event) => sum + event.damage, 0);
}

export function recordDemonSiegeHit(
  buildingIndex: number,
  options: { zone?: DemonSiegeEvent['zone'] } = {}
): { ok: boolean; reason?: string; event?: DemonSiegeEvent; building?: Building; nextOpenAt?: number } {
  const owner = wallet?.toLowerCase();
  if (!owner) return { ok: false, reason: 'Connect a wallet before demon sieges can be recorded.' };
  const built = state.buildings[buildingIndex];
  if (!built) return { ok: false, reason: 'Missing building.' };
  const maxHp = built.maxHp ?? built.hp ?? 0;
  const hp = built.hp ?? maxHp;
  if (!built.id || maxHp <= 0 || hp <= 0) return { ok: false, reason: 'This building is already a repairable ruin.' };

  const now = Date.now();
  const status = demonSiegeStatus(now);
  if (!status.open) return { ok: false, reason: 'Village wards are holding for this window.', nextOpenAt: status.nextOpenAt };

  const previous = latestDemonSiegeAgainst(owner, built.id);
  if (previous && now - previous.at < DEMON_SIEGE_COOLDOWN_MS) {
    return { ok: false, reason: 'Demon siege cooldown is still active.' };
  }

  const windowDamage = demonSiegeDamageInWindow(owner, status.windowStartedAt);
  const remaining = Math.max(0, DEMON_SIEGE_WINDOW_DAMAGE_CAP - windowDamage);
  if (remaining <= 0) {
    return { ok: false, reason: 'Demon damage cap reached for this window.' };
  }

  const damage = Math.max(1, Math.min(DEMON_SIEGE_DAMAGE, remaining, hp));
  const nextBuilding = { ...built, maxHp, hp: Math.max(0, hp - damage) };
  const event: DemonSiegeEvent = {
    id: createId('siege'),
    owner,
    buildingId: built.id,
    damage,
    at: now,
    windowStartedAt: status.windowStartedAt,
    zone: options.zone,
    source: 'demon',
    capped: damage < DEMON_SIEGE_DAMAGE || remaining <= DEMON_SIEGE_DAMAGE,
  };
  const newBuildings = [...state.buildings];
  newBuildings[buildingIndex] = nextBuilding;
  commit({
    ...state,
    buildings: newBuildings,
    siegeEvents: [event, ...state.siegeEvents].slice(0, MAX_DEMON_SIEGE_EVENTS),
  });
  return { ok: true, event, building: nextBuilding };
}

export function raidDamageForWeapon(weaponLevel = 0): number {
  return RAID_BASE_DAMAGE + Math.max(0, Math.min(5, Math.round(weaponLevel))) * 6;
}

export function repairHealForInventory(value: WorldState = state): number {
  return value.repairKits > 0 ? REPAIR_KIT_HEAL : REPAIR_WOOD_HEAL;
}

export function latestRaidAgainst(defender: string, buildingId: string): RaidEvent | null {
  const target = defender.toLowerCase();
  return state.raidEvents
    .filter((event) => event.defender === target && event.buildingId === buildingId)
    .sort((a, b) => b.at - a.at)[0] ?? null;
}

export function recordRaidEvent(defender: string, buildingId: string): { ok: boolean; reason?: string; event?: RaidEvent } {
  const attacker = wallet?.toLowerCase();
  const target = defender.toLowerCase();
  if (!attacker) return { ok: false, reason: 'Connect a wallet first.' };
  if (!/^0x[a-f0-9]{40}$/.test(target)) return { ok: false, reason: 'Invalid defender wallet.' };
  if (attacker === target) return { ok: false, reason: 'Cannot raid your own buildings.' };
  if (relationForWallet(target) !== 'hostile') return { ok: false, reason: 'Mark this wallet Hostile before raiding.' };
  if (!buildingId) return { ok: false, reason: 'Missing building id.' };
  const freeBuild = isLocalhostFreeBuildWallet();
  if (!freeBuild && state.inventory.stone < RAID_STONE_COST) return { ok: false, reason: `Need ${RAID_STONE_COST} stone to raid.` };
  const previous = latestRaidAgainst(target, buildingId);
  const now = Date.now();
  if (previous && now - previous.at < RAID_COOLDOWN_MS) {
    const mins = Math.ceil((RAID_COOLDOWN_MS - (now - previous.at)) / 60000);
    return { ok: false, reason: `Raid cooldown: ${mins} min.` };
  }

  const event: RaidEvent = {
    id: createId('raid'),
    attacker,
    defender: target,
    buildingId,
    damage: raidDamageForWeapon(0),
    stoneCost: RAID_STONE_COST,
    weaponLevel: 0,
    at: now,
  };
  const raidEvents = [event, ...state.raidEvents].slice(0, MAX_RAID_EVENTS);
  commit({
    ...state,
    inventory: { ...state.inventory, stone: freeBuild ? MAX_STONE : Math.max(0, state.inventory.stone - RAID_STONE_COST) },
    raidEvents,
  });
  return { ok: true, event };
}

export function recordRepairEvent(owner: string, buildingId: string, requestedHeal?: number): { ok: boolean; reason?: string; event?: RepairEvent } {
  const repairer = wallet?.toLowerCase();
  const target = owner.toLowerCase();
  if (!repairer) return { ok: false, reason: 'Connect a wallet first.' };
  if (!/^0x[a-f0-9]{40}$/.test(target)) return { ok: false, reason: 'Invalid building owner.' };
  if (!buildingId) return { ok: false, reason: 'Missing building id.' };
  if (repairer !== target && relationForWallet(target) !== 'allied') {
    return { ok: false, reason: 'Mark this wallet Ally before repairing their buildings.' };
  }

  const freeBuild = isLocalhostFreeBuildWallet();
  if (!freeBuild && state.inventory.wood < REPAIR_WOOD_COST) return { ok: false, reason: `Need ${REPAIR_WOOD_COST} wood to repair.` };

  const kitUsed = state.repairKits > 0;
  const maxHeal = kitUsed ? REPAIR_KIT_HEAL : REPAIR_WOOD_HEAL;
  const heal = Math.max(0, Math.min(maxHeal, Math.round(Number(requestedHeal ?? maxHeal))));
  if (heal <= 0) return { ok: false, reason: 'This building is already fully maintained.' };

  const event: RepairEvent = {
    id: createId('repair'),
    repairer,
    owner: target,
    buildingId,
    heal,
    woodCost: REPAIR_WOOD_COST,
    kitUsed,
    at: Date.now(),
  };
  const repairEvents = [event, ...state.repairEvents].slice(0, MAX_REPAIR_EVENTS);
  commit({
    ...state,
    inventory: { ...state.inventory, wood: freeBuild ? MAX_WOOD : Math.max(0, state.inventory.wood - REPAIR_WOOD_COST) },
    repairKits: kitUsed ? Math.max(0, state.repairKits - 1) : state.repairKits,
    repairEvents,
  });
  return { ok: true, event };
}

// ── Building ──────────────────────────────────────────────────────────────────

/** Place a structure if the player can afford it (deducts `cost` wood). The
 * caller computes `cost` (it scales with distance to the centre); defaults to the
 * base cost. Returns success. */
export function placeBuilding(b: Building, cost: number = BUILD_COST[b.type]): boolean {
  const freeBuild = isLocalhostFreeBuildWallet();
  if (!freeBuild && state.inventory.wood < cost) return false;

  let maxHp = 50;
  if (b.type === 'house') maxHp = 150;
  if (b.type === 'wall') maxHp = 80;

  const nextBuilding: Building = { ...b, id: b.id ?? createId('build'), woodCost: freeBuild ? 0 : cost, hp: maxHp, maxHp };
  commit({
    ...state,
    inventory: { ...state.inventory, wood: freeBuild ? MAX_WOOD : state.inventory.wood - cost },
    buildings: [...state.buildings, nextBuilding],
  });
  return true;
}

/** Demolish a building by index, refunding half its wood (capped). */
export function removeBuilding(index: number) {
  if (index < 0 || index >= state.buildings.length) return;
  const built = state.buildings[index];
  const refundBase = built.woodCost ?? BUILD_COST[built.type];
  const refund = Math.max(0, Math.floor(refundBase * 0.5));
  commit({
    ...state,
    inventory: { ...state.inventory, wood: Math.min(MAX_WOOD, state.inventory.wood + refund) },
    buildings: state.buildings.filter((_, i) => i !== index),
  });
}

/** Damage a building by index. At 0 HP it remains as a ruined repairable shell. */
export function damageBuilding(index: number, amount: number) {
  if (index < 0 || index >= state.buildings.length) return;
  const built = state.buildings[index];
  if (built.hp === undefined) return;

  const newBuildings = [...state.buildings];
  newBuildings[index] = { ...built, hp: Math.max(0, built.hp - amount) };
  commit({
    ...state,
    buildings: newBuildings,
  });
}

/** Spend wood to restore HP on a damaged building; a repair kit boosts the heal. */
export function repairBuilding(index: number): boolean {
  if (index < 0 || index >= state.buildings.length) return false;
  const built = state.buildings[index];
  const maxHp = built.maxHp ?? built.hp ?? 0;
  const hp = built.hp ?? maxHp;
  if (maxHp <= 0 || hp >= maxHp) return false;
  const freeBuild = isLocalhostFreeBuildWallet();
  if (!freeBuild && state.inventory.wood < REPAIR_WOOD_COST) return false;
  const useKit = state.repairKits > 0;
  const heal = repairHealForInventory(state);

  const newBuildings = [...state.buildings];
  newBuildings[index] = {
    ...built,
    maxHp,
    hp: Math.min(maxHp, hp + heal),
  };
  commit({
    ...state,
    inventory: { ...state.inventory, wood: freeBuild ? MAX_WOOD : Math.max(0, state.inventory.wood - REPAIR_WOOD_COST) },
    repairKits: useKit ? Math.max(0, state.repairKits - 1) : state.repairKits,
    buildings: newBuildings,
  });
  return true;
}

/** Hybrid HP — repair EVERY block of an AI build's named cluster for one repair cost
 * (a structure is fixed as a unit, not block-by-block). */
export function repairCluster(clusterId: string): boolean {
  const blocks = state.buildings.filter((b) => b.clusterId === clusterId);
  if (blocks.length === 0) return false;
  const anyDamaged = blocks.some((b) => (b.hp ?? b.maxHp ?? 0) < (b.maxHp ?? b.hp ?? 0));
  if (!anyDamaged) return false;
  const freeBuild = isLocalhostFreeBuildWallet();
  if (!freeBuild && state.inventory.wood < REPAIR_WOOD_COST) return false;
  const useKit = state.repairKits > 0;
  const newBuildings = state.buildings.map((b) =>
    b.clusterId === clusterId ? { ...b, maxHp: b.maxHp ?? b.hp ?? 0, hp: b.maxHp ?? b.hp ?? 0 } : b
  );
  commit({
    ...state,
    inventory: { ...state.inventory, wood: freeBuild ? MAX_WOOD : Math.max(0, state.inventory.wood - REPAIR_WOOD_COST) },
    repairKits: useKit ? Math.max(0, state.repairKits - 1) : state.repairKits,
    buildings: newBuildings,
  });
  return true;
}

/** Demolish a whole cluster, refunding half its total wood cost. */
export function removeCluster(clusterId: string): { removed: number } {
  const blocks = state.buildings.filter((b) => b.clusterId === clusterId);
  if (blocks.length === 0) return { removed: 0 };
  const refundBase = blocks.reduce((sum, b) => sum + (b.woodCost ?? BUILD_COST[b.type]), 0);
  const refund = Math.max(0, Math.floor(refundBase * 0.5));
  commit({
    ...state,
    inventory: { ...state.inventory, wood: Math.min(MAX_WOOD, state.inventory.wood + refund) },
    buildings: state.buildings.filter((b) => b.clusterId !== clusterId),
  });
  return { removed: blocks.length };
}

// ── React hooks ───────────────────────────────────────────────────────────────
export function useWorld(): WorldState {
  return useSyncExternalStore(subscribe, getWorld, () => EMPTY_WORLD);
}
