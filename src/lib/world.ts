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
import { BLOCK_UNIT, type ResourceType, type WorldState, type Building, type BuildingType } from '@/lib/types';

export type { ResourceType, WorldState, Building, BuildingType } from '@/lib/types';

/** How much wood the player can carry before they must use/drop some. Raised to
 * support AI-built structures and the pricier builds near the village centre. */
export const MAX_WOOD = 100;

/** BASE wood cost per building. The actual cost scales up the closer you build
 * to the village centre (computed in the scene); persistence is unaffected. */
export const BUILD_COST: Record<BuildingType, number> = { wall: 3, house: 10, block: 1 };
/** Collider radius for each building (kept in sync with the rendered footprint).
 * Blocks are decorative voxels — they don't collide (radius 0). */
export const BUILD_RADIUS: Record<BuildingType, number> = { wall: 0.9, house: 1.8, block: 0 };

export const EMPTY_WORLD: WorldState = { inventory: { wood: 0, stone: 0, coin: 0 }, choppedTrees: [], buildings: [], enemiesKilled: 0, axeLevel: 0 };

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
  // Static fallback; wood is priced dynamically via woodQuote(). Future resources
  // (e.g. stone) can sit here as fixed quotes until they get their own model.
  wood: { sell: 2, buy: 6 },
};

/** Cost in coin of the one-time "sharper axe" upgrade (2× wood per chop). */
export const AXE_UPGRADE_COST = 70;
/** Cost in coin of one sapling (regrows one felled tree). */
export const SAPLING_COST = 5;

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

const LOCALHOST_FREE_BUILD_WALLETS = new Set([
  '0xc77b3982d324c6e812119eea7dc94f0a856da59e',
]);

export function isLocalhostFreeBuildWallet(addr: string | null = wallet): boolean {
  if (!addr || typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  return isLocalhost && LOCALHOST_FREE_BUILD_WALLETS.has(addr.toLowerCase());
}

function applyLocalhostFreeBuild(state: WorldState, addr: string | null = wallet): WorldState {
  if (!isLocalhostFreeBuildWallet(addr)) return state;
  return {
    ...state,
    inventory: { ...state.inventory, wood: MAX_WOOD },
  };
}

function normalizeBuildings(raw: unknown): Building[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Building => !!b && (b.type === 'wall' || b.type === 'house' || b.type === 'block') && typeof b.x === 'number' && typeof b.z === 'number')
    .map((b) => {
      const base: Building = {
        type: b.type,
        x: b.x,
        z: b.z,
        rot: typeof b.rot === 'number' ? b.rot : 0,
        woodCost: typeof b.woodCost === 'number' ? Math.max(0, Math.round(b.woodCost)) : undefined,
      };

      let defaultHp = 50;
      if (b.type === 'house') defaultHp = 150;
      if (b.type === 'wall') defaultHp = 80;

      base.maxHp = typeof (b as any).maxHp === 'number' ? (b as any).maxHp : defaultHp;
      base.hp = typeof (b as any).hp === 'number' ? (b as any).hp : base.maxHp;

      if (b.type === 'block') {
        base.y = typeof b.y === 'number' ? b.y : 0;
        base.scale = typeof b.scale === 'number' ? b.scale : BLOCK_UNIT;
        base.color = typeof b.color === 'string' ? b.color : '#8a6a4a';
      }
      return base;
    });
}

export function normalizeWorldState(raw: unknown): WorldState {
  const p = raw && typeof raw === 'object' ? (raw as any) : {};
  const choppedTrees: number[] = Array.isArray(p?.choppedTrees)
    ? Array.from(new Set<number>(p.choppedTrees
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isInteger(n) && n >= 0)))
    : [];

  return {
    inventory: {
      wood: Math.max(0, Number(p?.inventory?.wood ?? 0)),
      stone: Math.max(0, Number(p?.inventory?.stone ?? 0)),
      coin: Math.max(0, Number(p?.inventory?.coin ?? 0)),
    },
    choppedTrees,
    buildings: normalizeBuildings(p?.buildings),
    enemiesKilled: Math.max(0, Number(p?.enemiesKilled ?? 0)),
    axeLevel: Math.max(0, Math.round(Number(p?.axeLevel ?? 0))),
  };
}

export function cloneWorldState(value: WorldState = EMPTY_WORLD): WorldState {
  return {
    inventory: { ...value.inventory },
    choppedTrees: [...value.choppedTrees],
    buildings: value.buildings.map((b) => ({ ...b })),
    enemiesKilled: value.enemiesKilled,
    axeLevel: value.axeLevel,
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

  const nextBuilding: Building = { ...b, woodCost: freeBuild ? 0 : cost, hp: maxHp, maxHp };
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

/** Damage a building by index, optionally removing it if destroyed. */
export function damageBuilding(index: number, amount: number) {
  if (index < 0 || index >= state.buildings.length) return;
  const built = state.buildings[index];
  if (built.hp === undefined) return;
  
  const newHp = built.hp - amount;
  if (newHp <= 0) {
    commit({
      ...state,
      buildings: state.buildings.filter((_, i) => i !== index),
    });
  } else {
    const newBuildings = [...state.buildings];
    newBuildings[index] = { ...built, hp: newHp };
    commit({
      ...state,
      buildings: newBuildings,
    });
  }
}

// ── React hooks ───────────────────────────────────────────────────────────────
export function useWorld(): WorldState {
  return useSyncExternalStore(subscribe, getWorld, () => EMPTY_WORLD);
}
