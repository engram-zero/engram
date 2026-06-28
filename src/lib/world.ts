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
import { BLOCK_SCALE_MAX, BLOCK_SCALE_MIN, BLOCK_UNIT, type RaidEvent, type ResourceType, type WalletRelation, type WorldState, type Building, type BuildingType } from '@/lib/types';

export type { RaidEvent, ResourceType, WalletRelation, WorldState, Building, BuildingType } from '@/lib/types';

/** How much wood the player can carry before they must use/drop some. Raised to
 * support AI-built structures and the pricier builds near the village centre. */
export const MAX_WOOD = 100;

/** BASE wood cost per building. The actual cost scales up the closer you build
 * to the village centre (computed in the scene); persistence is unaffected. */
export const BUILD_COST: Record<BuildingType, number> = { wall: 3, house: 10, block: 1 };
/** Collider radius for each building (kept in sync with the rendered footprint).
 * Blocks are decorative voxels — they don't collide (radius 0). */
export const BUILD_RADIUS: Record<BuildingType, number> = { wall: 0.9, house: 1.8, block: 0 };
const MAX_BUILD_COORD = 150;
const MAX_BLOCK_Y = 12;
const MAX_RAID_EVENTS = 120;
const RAID_EVENT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const EMPTY_WORLD: WorldState = {
  inventory: { wood: 0, stone: 0, coin: 0 },
  choppedTrees: [],
  minedRocks: [],
  buildings: [],
  enemiesKilled: 0,
  axeLevel: 0,
  repairKits: 0,
  raidEvents: [],
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

// ── Dynamic wood pricing (Phase 2) ────────────────────────────────────────────
// A relative market: wood's coin value rises with scarcity (fewer trees left on
// the map) and with coin inflation (the more coin the player hoards, the less
// each coin is worth). A symmetric multiplicative house spread means buying
// always costs HOUSE_SPREAD× the mid and selling pays mid ÷ HOUSE_SPREAD — the
// merchant profits on BOTH directions, so any round-trip loses value.
export const HOUSE_SPREAD = 1.3;
export const WOOD_BASE_PRICE = 3; // coin per wood at neutral scarcity & inflation
export const COIN_INFLATION_REF = 200; // coin balance at which inflation maxes out

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
export function woodQuote(world: WorldState, totalTrees: number): WoodQuote {
  const remaining = Math.max(0, totalTrees - world.choppedTrees.length);
  const forest = totalTrees > 0 ? remaining / totalTrees : 1; // 1 full → 0 clearcut
  const scarcity = 0.8 + 1.0 * (1 - forest); // 0.8 (abundant) → 1.8 (scarce)
  const inflation = 1 + Math.min(world.inventory.coin / COIN_INFLATION_REF, 1) * 0.5; // 1 → 1.5
  const mid = WOOD_BASE_PRICE * scarcity * inflation;
  const sell = Math.max(1, Math.round(mid / HOUSE_SPREAD));
  const haggleCeil = Math.max(sell, Math.round(mid)); // best negotiable = the fair mid
  const buy = Math.max(Math.round(mid * HOUSE_SPREAD), haggleCeil + 1); // strictly above haggle
  return { mid, sell, buy, haggleCeil };
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
    },
    choppedTrees,
    minedRocks,
    buildings: normalizeBuildings(p?.buildings),
    enemiesKilled: Math.max(0, Number(p?.enemiesKilled ?? 0)),
    axeLevel: Math.max(0, Math.round(Number(p?.axeLevel ?? 0))),
    repairKits: Math.max(0, Math.round(Number(p?.repairKits ?? 0))),
    raidEvents: normalizeRaidEvents(p?.raidEvents),
    relations: normalizeRelations(p?.relations),
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
    relations: { ...value.relations },
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
  state = applyLocalhostFreeBuild(next);
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

// ── Mining (stone) ── parallels tree chopping, against map.ts ROCKS. ───────────
export const MAX_STONE = 60;
/** Holds-to-mine before a rock is exhausted; yields ONE stone per fill. */
export const ROCK_MINES = 18;
export const STONE_PER_MINE = 1;
export const ROCK_STONE = ROCK_MINES * STONE_PER_MINE; // total stone per rock

const mined: Record<number, number> = {};

export function isMined(index: number): boolean {
  return state.minedRocks.includes(index);
}

export function stoneIsFull(): boolean {
  return state.inventory.stone >= MAX_STONE;
}

/** Extract one unit of stone from a rock (mirrors harvestTree). After ROCK_STONE
 * units the rock is exhausted and vanishes. No-op if already mined or full. */
export function harvestRock(index: number): { depleted: boolean; gained: boolean } {
  if (state.minedRocks.includes(index)) return { depleted: true, gained: false };
  if (state.inventory.stone >= MAX_STONE) return { depleted: false, gained: false };
  const units = (mined[index] = (mined[index] ?? 0) + 1);
  const depleted = units >= ROCK_MINES;
  commit({
    ...state,
    inventory: { ...state.inventory, stone: Math.min(MAX_STONE, state.inventory.stone + STONE_PER_MINE) },
    minedRocks: depleted ? [...state.minedRocks, index] : state.minedRocks,
  });
  return { depleted, gained: true };
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

export function raidDamageForWeapon(weaponLevel = 0): number {
  return RAID_BASE_DAMAGE + Math.max(0, Math.min(5, Math.round(weaponLevel))) * 6;
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
  const heal = useKit ? REPAIR_KIT_HEAL : REPAIR_WOOD_HEAL;

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

// ── React hooks ───────────────────────────────────────────────────────────────
export function useWorld(): WorldState {
  return useSyncExternalStore(subscribe, getWorld, () => EMPTY_WORLD);
}
