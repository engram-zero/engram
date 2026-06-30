import { TREES, ROCKS, riverCenterZ } from '@/components/engram/map';
import type {
  EarthAgentState,
  EcosystemActivityState,
  FaunaAgentState,
  NatureZoneId,
  NatureZoneSnapshot,
  WorldState,
} from '@/lib/types';

export const NATURE_ZONES: Array<{ id: NatureZoneId; label: string }> = [
  { id: 'north_forest', label: 'North Forest' },
  { id: 'riverlands', label: 'Riverlands' },
  { id: 'east_hills', label: 'East Hills' },
  { id: 'south_fields', label: 'South Fields' },
  { id: 'west_grove', label: 'West Grove' },
];

export function zoneOfPoint(x: number, z: number): NatureZoneId {
  if (Math.abs(z - riverCenterZ(x)) < 8) return 'riverlands';
  if (z < -8) return 'north_forest';
  if (x > 10) return 'east_hills';
  if (x < -10) return 'west_grove';
  return 'south_fields';
}

export function computeNatureSnapshot(world: WorldState): NatureZoneSnapshot[] {
  const chopped = new Set(world.choppedTrees);
  const mined = new Set(world.minedRocks);
  const byZone = new Map<NatureZoneId, NatureZoneSnapshot>();

  for (const zone of NATURE_ZONES) {
    byZone.set(zone.id, {
      id: zone.id,
      label: zone.label,
      standingTrees: 0,
      choppedTrees: 0,
      intactRocks: 0,
      minedRocks: 0,
      parcelClaims: 0,
      playerBuilds: 0,
    });
  }

  TREES.forEach((tree, index) => {
    const zone = byZone.get(zoneOfPoint(tree.x, tree.z));
    if (!zone) return;
    const growth = world.treeGrowth[index];
    if (chopped.has(index) || (growth && growth.stage !== 'mature')) zone.choppedTrees += 1;
    else zone.standingTrees += 1;
  });

  ROCKS.forEach((rock, index) => {
    const zone = byZone.get(zoneOfPoint(rock.x, rock.z));
    if (!zone) return;
    if (mined.has(index)) zone.minedRocks += 1;
    else zone.intactRocks += 1;
  });

  for (const claim of world.parcelClaims) {
    const zone = byZone.get(zoneOfPoint(claim.x, claim.z));
    if (zone) zone.parcelClaims += 1;
  }
  for (const building of world.buildings) {
    const zone = byZone.get(zoneOfPoint(building.x, building.z));
    if (zone) zone.playerBuilds += 1;
  }

  return NATURE_ZONES.map((zone) => byZone.get(zone.id)!);
}

function earthRegrowthScore(earth: EarthAgentState, zoneId: NatureZoneId): number {
  const directive = earth.zones.find((zone) => zone.id === zoneId);
  if (!directive) return 50;
  const shareBoost = 0.35 + directive.regrowthShare * 0.65;
  return directive.fertility * shareBoost;
}

export function pickTreeToRegrow(choppedTrees: number[], earth?: EarthAgentState | null): number | null {
  if (!earth || choppedTrees.length === 0) return null;
  let bestIndex: number | null = null;
  let bestScore = -Infinity;

  for (const treeIndex of choppedTrees) {
    const tree = TREES[treeIndex];
    if (!tree) continue;
    const zoneId = zoneOfPoint(tree.x, tree.z);
    const score = earthRegrowthScore(earth, zoneId);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = treeIndex;
    }
  }

  return bestIndex;
}

export function pickRockToRespawn(minedRocks: number[], earth?: EarthAgentState | null): number | null {
  if (!earth || minedRocks.length === 0) return null;
  let bestIndex: number | null = null;
  let bestScore = -Infinity;

  for (const rockIndex of minedRocks) {
    const rock = ROCKS[rockIndex];
    if (!rock) continue;
    const zoneId = zoneOfPoint(rock.x, rock.z);
    const score = earthRegrowthScore(earth, zoneId);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = rockIndex;
    }
  }

  return bestIndex;
}

const ACTIVITY_COIN_REF = 200;
const RECENT_EXTRACTION_REF = 6;
const MIN_RESTOCK_CADENCE_MS = 1000 * 45;
const MAX_RESTOCK_CADENCE_MS = 1000 * 60 * 12;
export const ECOSYSTEM_ACTIVITY_FORMULA =
  'activityScore = clamp01(0.45*(playerCoin+treasuryCoin)/200 + 0.35*recentExtraction/6 + 0.20*depletedStock); cadence = base*(1.25 - 0.45*depletedStock)*(1 - 0.45*activityScore)';

function clamp01(value: number): number {
  return clampFloat(value, 0, 1);
}

function validIndexCount(indexes: number[], total: number): number {
  return new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0 && index < total)).size;
}

function restockCadenceMs(baseCadenceMs: number, stockPressure: number, activityScore: number, multiplier = 1): number {
  const safeBase = Number.isFinite(baseCadenceMs) && baseCadenceMs > 0 ? baseCadenceMs : 1000 * 60 * 4;
  const stockBrake = 1.25 - 0.45 * stockPressure;
  const activityBoost = 1 - 0.45 * activityScore;
  return clampInt(safeBase * stockBrake * activityBoost * multiplier, MIN_RESTOCK_CADENCE_MS, MAX_RESTOCK_CADENCE_MS);
}

export function computeEcosystemActivity(
  world: WorldState,
  previous?: EcosystemActivityState | null,
  baseCadenceMs = 1000 * 60 * 4
): EcosystemActivityState {
  const depletedTrees = validIndexCount(world.choppedTrees, TREES.length);
  const depletedRocks = validIndexCount(world.minedRocks, ROCKS.length);
  const treePressure = TREES.length > 0 ? depletedTrees / TREES.length : 0;
  const rockPressure = ROCKS.length > 0 ? depletedRocks / ROCKS.length : 0;
  const stockPressure = clamp01((treePressure + rockPressure) / 2);
  const previousTrees = previous?.depletedTrees ?? depletedTrees;
  const previousRocks = previous?.depletedRocks ?? depletedRocks;
  const recentExtraction = Math.max(0, depletedTrees - previousTrees) + Math.max(0, depletedRocks - previousRocks);
  const tokensInCirculation = Math.max(0, world.inventory.coin + (world.ecosystem?.treasury?.coin ?? 0));
  const tokenSignal = clamp01(tokensInCirculation / ACTIVITY_COIN_REF);
  const recentSignal = clamp01(recentExtraction / RECENT_EXTRACTION_REF);
  const activityScore = clamp01(tokenSignal * 0.45 + recentSignal * 0.35 + stockPressure * 0.2);
  const treeCadenceMs = restockCadenceMs(baseCadenceMs, stockPressure, activityScore);

  return {
    updatedAt: Date.now(),
    formulaVersion: 'prompt23-f4-v1',
    tokensInCirculation: Math.max(0, Math.round(tokensInCirculation)),
    depletedTrees,
    depletedRocks,
    recentExtraction,
    stockPressure,
    activityScore,
    treeCadenceMs,
    rockCadenceMs: restockCadenceMs(baseCadenceMs, stockPressure, activityScore, 1.35),
  };
}

export function fingerprintNature(world: WorldState): string {
  return [
    world.choppedTrees.length,
    Object.keys(world.treeGrowth).length,
    world.minedRocks.length,
    world.buildings.length,
    world.parcelClaims.length,
    world.inventory.coin,
    world.enemiesKilled,
  ].join(':');
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function dominantZoneBy<T extends { id: NatureZoneId }>(
  zones: T[],
  valueOf: (zone: T) => number
): NatureZoneId {
  return zones.reduce(
    (best, zone) => (valueOf(zone) > valueOf(best) ? zone : best),
    zones[0]
  ).id;
}
