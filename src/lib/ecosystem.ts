import { TREES, ROCKS, riverCenterZ } from '@/components/engram/map';
import type {
  EarthAgentState,
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
    if (chopped.has(index)) zone.choppedTrees += 1;
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

export function pickTreeToRegrow(choppedTrees: number[], earth?: EarthAgentState | null): number | null {
  if (!earth || choppedTrees.length === 0) return null;
  const fertility = new Map(earth.zones.map((zone) => [zone.id, zone.fertility]));
  let bestIndex: number | null = null;
  let bestScore = -Infinity;

  for (const treeIndex of choppedTrees) {
    const tree = TREES[treeIndex];
    if (!tree) continue;
    const zoneId = zoneOfPoint(tree.x, tree.z);
    const score = fertility.get(zoneId) ?? 50;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = treeIndex;
    }
  }

  return bestIndex;
}

export function fingerprintNature(world: WorldState): string {
  return [
    world.choppedTrees.length,
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
