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

export type ResourceType = 'wood' | 'stone' | 'coin';

/** How much wood the player can carry before they must use/drop some. */
export const MAX_WOOD = 20;

export interface WorldState {
  inventory: Record<ResourceType, number>;
  /** Indices (into map.ts TREES) of trees the player has chopped. */
  choppedTrees: number[];
}

export const EMPTY_WORLD: WorldState = { inventory: { wood: 0, stone: 0, coin: 0 }, choppedTrees: [] };

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
    if (typeof window === 'undefined') return { ...EMPTY_WORLD };
    try {
      const raw = window.localStorage.getItem(key(wallet));
      if (!raw) return { ...EMPTY_WORLD };
      const p = JSON.parse(raw);
      return {
        inventory: {
          wood: Math.max(0, Number(p?.inventory?.wood ?? 0)),
          stone: Math.max(0, Number(p?.inventory?.stone ?? 0)),
          coin: Math.max(0, Number(p?.inventory?.coin ?? 0)),
        },
        choppedTrees: Array.isArray(p?.choppedTrees) ? p.choppedTrees.filter((n: unknown) => Number.isInteger(n)) : [],
      };
    } catch {
      return { ...EMPTY_WORLD };
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
    inventory: { ...state.inventory, wood: Math.min(MAX_WOOD, state.inventory.wood + 1) },
    choppedTrees: depleted ? [...state.choppedTrees, index] : state.choppedTrees,
  });
  return { depleted, gained: true };
}

// ── React hooks ───────────────────────────────────────────────────────────────
export function useWorld(): WorldState {
  return useSyncExternalStore(subscribe, getWorld, () => EMPTY_WORLD);
}
