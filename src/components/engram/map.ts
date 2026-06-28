// ─── Engram — Aldenmoor map (single source of truth) ──────────────────────────
// Terrain elevation + every prop placement (cottages, trees, campfire) and the
// colliders derived from them live here, so the 3D scene and the first-person
// collision/height system never drift apart. Pure data + math — no React, no
// three scene graph — safe to import from anywhere.

import * as THREE from 'three';

// World dimensions. The player is fenced inside WORLD_RADIUS; the village square
// (NPCs, campfire) sits in a flat CLEARING so nobody stands on a slope; hills
// roll up outside it, out to the visible GROUND_RADIUS under the fog.
// The player can roam the whole terrain — the boundary now sits far out at the
// visible terrain edge (so you don't walk off the mesh into the void), not as a
// close invisible wall. For a truly endless world we'd stream terrain chunks.
export const GROUND_RADIUS = 140;
export const WORLD_RADIUS = GROUND_RADIUS - 8;
export const CLEARING_RADIUS = 9;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Layered sines → rolling hills. Deterministic, no noise dependency.
function hills(x: number, z: number): number {
  return (
    Math.sin(x * 0.16) * 1.2 +
    Math.cos(z * 0.14) * 1.1 +
    Math.sin((x + z) * 0.085) * 1.7 +
    Math.cos((x - z) * 0.12) * 0.8 +
    Math.sin(x * 0.05 + z * 0.045) * 2.4
  );
}
const HILLS_AT_ORIGIN = hills(0, 0);

/** Ground height at a world XZ. Flat (0) inside the clearing, rolling outside. */
export function getHeightAt(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const blend = smoothstep(CLEARING_RADIUS, CLEARING_RADIUS + 11, d);
  const h = hills(x, z) - HILLS_AT_ORIGIN;
  return Math.max(0, h) * blend * 0.85;
}

/** Surface normal at a world XZ (finite differences). Optional, for slope work. */
export function getGroundNormal(x: number, z: number, eps = 0.6): THREE.Vector3 {
  const hL = getHeightAt(x - eps, z);
  const hR = getHeightAt(x + eps, z);
  const hD = getHeightAt(x, z - eps);
  const hU = getHeightAt(x, z + eps);
  return new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CottageDef {
  x: number;
  z: number;
  body: string;
  roof: string;
  scale: number;
  rot: number;
}

export const COTTAGES: CottageDef[] = [
  { x: -10.4, z: -4.6, body: '#7a5a3a', roof: '#8a3a2a', scale: 1.95, rot: 0.22 },
  { x: -4.2, z: -10.8, body: '#6a4a32', roof: '#7a4a2a', scale: 1.72, rot: -0.32 },
  { x: 4.9, z: -10.1, body: '#7a5a3a', roof: '#5a3a6a', scale: 1.78, rot: 0.16 },
  { x: 11.2, z: -4.4, body: '#6a4a32', roof: '#8a3a2a', scale: 2.02, rot: -0.5 },
  { x: -12.4, z: 6.8, body: '#785536', roof: '#7a4a2a', scale: 1.76, rot: 0.62 },
  { x: 12.1, z: 7.4, body: '#6f4f33', roof: '#7a3a2a', scale: 1.84, rot: -0.7 },
];

export const CAMPFIRE: { x: number; z: number } = { x: 0, z: 2.6 };

export type TreeSpecies = 0 | 1 | 2; // 0 pine · 1 broadleaf · 2 bush

export interface TreeDef {
  x: number;
  z: number;
  scale: number;
  species: TreeSpecies;
  rot: number;
}

// Small deterministic PRNG so the forest is identical every run.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The creek's centre-line (z as a function of x). Shared with the renderer so the
// water ribbon and the tree-exclusion below use the exact same path.
export function riverCenterZ(x: number): number {
  return 24 + Math.sin(x * 0.045) * 15 + Math.cos(x * 0.11) * 4;
}
/** Distance (in z) from the river centre within which trees are not planted. */
export const RIVER_CLEAR = 5.5;

// Ring the village with a forest: dense enough to read as woods, anchored to the
// hills, never overlapping a cottage, the central clearing, or the river.
export const TREES: TreeDef[] = (() => {
  const rng = mulberry32(1337);
  const out: TreeDef[] = [];
  let tries = 0;
  while (out.length < 130 && tries < 3000) {
    tries++;
    const ang = rng() * Math.PI * 2;
    const rad = 11 + rng() * 46; // 11..57
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (COTTAGES.some((c) => Math.hypot(x - c.x, z - c.z) < c.scale * 2.6)) continue;
    if (Math.abs(z - riverCenterZ(x)) < RIVER_CLEAR) continue; // keep the creek clear
    const r = rng();
    const species: TreeSpecies = r < 0.55 ? 0 : r < 0.82 ? 1 : 2;
    out.push({ x, z, scale: 0.8 + rng() * 0.75, species, rot: rng() * Math.PI * 2 });
  }
  return out;
})();

export type OreKind = 'stone' | 'silver' | 'gold';

export interface RockDef {
  x: number;
  z: number;
  scale: number;
  rot: number;
  /** Which ore this outcrop yields. Most are stone; silver is rare, gold rarer. */
  ore: OreKind;
}

// Mineable stone outcrops — sparser than the forest, scattered through the hills
// away from the village core, the river, and the cottages. Same deterministic
// PRNG style so they're identical every run.
export const ROCKS: RockDef[] = (() => {
  const rng = mulberry32(7331);
  const out: RockDef[] = [];
  let tries = 0;
  while (out.length < 22 && tries < 3000) {
    tries++;
    const ang = rng() * Math.PI * 2;
    const rad = 16 + rng() * 40; // 16..56, out in the hills
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (COTTAGES.some((c) => Math.hypot(x - c.x, z - c.z) < c.scale * 2.6)) continue;
    if (Math.abs(z - riverCenterZ(x)) < RIVER_CLEAR) continue; // keep the creek clear
    if (TREES.some((t) => Math.hypot(x - t.x, z - t.z) < 1.6)) continue; // not inside a tree
    const o = rng();
    const ore: OreKind = o < 0.68 ? 'stone' : o < 0.9 ? 'silver' : 'gold'; // ~68% / 22% / 10%
    out.push({ x, z, scale: 0.9 + rng() * 0.7, rot: rng() * Math.PI * 2, ore });
  }
  return out;
})();

// ─── Colliders (derived — never hand-maintained) ──────────────────────────────

export interface Collider {
  x: number;
  z: number;
  r: number;
}

export const COLLIDERS: Collider[] = [
  { x: CAMPFIRE.x, z: CAMPFIRE.z, r: 1.0 },
  // Only trees the player can actually reach (inside the boundary) need a collider.
  ...TREES.filter((t) => Math.hypot(t.x, t.z) < WORLD_RADIUS + 2).map((t) => ({
    x: t.x,
    z: t.z,
    r: 0.45 * t.scale,
  })),
  // Rock outcrops the player can reach.
  ...ROCKS.filter((r) => Math.hypot(r.x, r.z) < WORLD_RADIUS + 2).map((r) => ({
    x: r.x,
    z: r.z,
    r: 0.6 * r.scale,
  })),
];
