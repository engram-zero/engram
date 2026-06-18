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
import type { ResourceType, WorldState, Building, BuildingType } from '@/lib/types';

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

export const EMPTY_WORLD: WorldState = { inventory: { wood: 0, stone: 0, coin: 0 }, choppedTrees: [], buildings: [] };

function normalizeBuildings(raw: unknown): Building[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Building => !!b && (b.type === 'wall' || b.type === 'house' || b.type === 'block') && typeof b.x === 'number' && typeof b.z === 'number')
    .map((b) => {
      const base: Building = { type: b.type, x: b.x, z: b.z, rot: typeof b.rot === 'number' ? b.rot : 0 };
      if (b.type === 'block') {
        base.y = typeof b.y === 'number' ? b.y : 0;
        base.scale = typeof b.scale === 'number' ? b.scale : 0.6;
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
  };
}

function cloneWorldState(value: WorldState = EMPTY_WORLD): WorldState {
  return {
    inventory: { ...value.inventory },
    choppedTrees: [...value.choppedTrees],
    buildings: value.buildings.map((b) => ({ ...b })),
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
  state = await persistence.load(addr);
  emit();
}

export function getWorld(): WorldState {
  return state;
}

export function getWorldWallet(): string | null {
  return wallet;
}

async function commit(next: WorldState) {
  state = next;
  emit();
  if (wallet) {
    try {
      await persistence.save(wallet, next);
    } catch (e) {
      console.warn('[engram] world save failed:', e);
    }
  }
}

export function addResource(type: ResourceType, amount: number) {
  return commit({ ...state, inventory: { ...state.inventory, [type]: Math.max(0, state.inventory[type] + amount) } });
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

/** Wood units a full tree yields (extracted one unit at a time while chopping). */
export const TREE_WOOD = 5;

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
  const depleted = units >= TREE_WOOD;
  commit({
    ...state,
    inventory: { ...state.inventory, wood: Math.min(MAX_WOOD, state.inventory.wood + 1) },
    choppedTrees: depleted ? [...state.choppedTrees, index] : state.choppedTrees,
  });
  return { depleted, gained: true };
}

// ── Building ──────────────────────────────────────────────────────────────────

/** Place a structure if the player can afford it (deducts `cost` wood). The
 * caller computes `cost` (it scales with distance to the centre); defaults to the
 * base cost. Returns success. */
export function placeBuilding(b: Building, cost: number = BUILD_COST[b.type]): boolean {
  if (state.inventory.wood < cost) return false;
  commit({
    ...state,
    inventory: { ...state.inventory, wood: state.inventory.wood - cost },
    buildings: [...state.buildings, b],
  });
  return true;
}

/** Demolish a building by index, refunding half its wood (capped). */
export function removeBuilding(index: number) {
  if (index < 0 || index >= state.buildings.length) return;
  const refund = Math.floor(BUILD_COST[state.buildings[index].type] / 2);
  commit({
    ...state,
    inventory: { ...state.inventory, wood: Math.min(MAX_WOOD, state.inventory.wood + refund) },
    buildings: state.buildings.filter((_, i) => i !== index),
  });
}

// ── React hooks ───────────────────────────────────────────────────────────────
export function useWorld(): WorldState {
  return useSyncExternalStore(subscribe, getWorld, () => EMPTY_WORLD);
}
