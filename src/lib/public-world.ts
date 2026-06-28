'use client';

import { useSyncExternalStore } from 'react';
import { Contract, JsonRpcProvider, type EventLog } from 'ethers';
import type { NetworkType } from '@/app/providers';
import { downloadByRootHashAPI } from '@/lib/0g/downloader';
import { getNetworkConfig } from '@/lib/0g/network';
import { ENGRAM_REGISTRY_ABI } from '@/lib/registry/abi';
import { getRegistryAddress } from '@/lib/registry/registry';
import { normalizeWorldState, type Building, type RaidEvent, type RepairEvent } from '@/lib/world';

export type PublicRaidEvent = RaidEvent & { author: string };
export type PublicRepairEvent = RepairEvent & { author: string };
export type PublicBuilding = Building & {
  owner: string;
  raidDamage?: number;
  repairHealing?: number;
  raidEvents?: PublicRaidEvent[];
  repairEvents?: PublicRepairEvent[];
};
export interface PublicWorldOwner {
  owner: string;
  buildingCount: number;
}

interface PublicWorldState {
  buildings: PublicBuilding[];
  raidEvents: PublicRaidEvent[];
  repairEvents: PublicRepairEvent[];
  owners: PublicWorldOwner[];
  loading: boolean;
}

const EMPTY_PUBLIC_WORLD: PublicWorldState = { buildings: [], raidEvents: [], repairEvents: [], owners: [], loading: false };
const listeners = new Set<() => void>();
let state = EMPTY_PUBLIC_WORLD;
let lastKey = '';

/**
 * Public-world discovery always scans Turbo, regardless of the player's network
 * toggle. Writes default to Turbo (see docs/STATUS.md gotcha #4: Standard and Turbo
 * are independent storage networks), so reading bundles from Standard would silently
 * show no builds. The registry/L1 RPC is shared across networks, so only the storage
 * endpoint matters here. This keeps everyone's builds visible to judges consistently.
 */
const PUBLIC_WORLD_NETWORK: NetworkType = 'turbo';

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): PublicWorldState {
  return state;
}

function setPublicWorld(next: PublicWorldState) {
  state = next;
  emit();
}

function scanLookback(): number {
  const value = Number(process.env.NEXT_PUBLIC_PUBLIC_WORLD_BLOCK_LOOKBACK ?? 300_000);
  return Number.isFinite(value) && value > 0 ? value : 300_000;
}

async function downloadWorldData(
  owner: string,
  root: string,
  storageRpc: string
): Promise<{ buildings: PublicBuilding[]; raidEvents: PublicRaidEvent[]; repairEvents: PublicRepairEvent[] }> {
  const [data, err] = await downloadByRootHashAPI(root, storageRpc);
  if (err || !data) return { buildings: [], raidEvents: [], repairEvents: [] };

  try {
    const raw = JSON.parse(new TextDecoder('utf-8').decode(data));
    const world = normalizeWorldState(raw?.world);
    return {
      buildings: world.buildings.map((building) => ({ ...building, owner })),
      raidEvents: world.raidEvents
        .filter((event) => event.attacker === owner)
        .map((event) => ({ ...event, author: owner })),
      repairEvents: world.repairEvents
        .filter((event) => event.repairer === owner)
        .map((event) => ({ ...event, author: owner })),
    };
  } catch {
    return { buildings: [], raidEvents: [], repairEvents: [] };
  }
}

/**
 * Loads read-only buildings from other wallets by scanning EngramRegistry events.
 * This makes player construction discoverable without a second registry, because
 * each RootUpdated event already reveals wallet -> latest 0G bundle root.
 */
export async function initPublicWorld(
  _networkType: NetworkType,
  currentWallet?: string | null,
  options: { force?: boolean; quiet?: boolean } = {}
): Promise<void> {
  const registry = getRegistryAddress();
  if (!registry) return;

  // Always scan Turbo (see PUBLIC_WORLD_NETWORK); the player's toggle (_networkType)
  // must not change which builds are discoverable.
  const key = `${PUBLIC_WORLD_NETWORK}:${currentWallet?.toLowerCase() ?? ''}`;
  if (!options.force && key === lastKey && state.buildings.length > 0) return;
  lastKey = key;
  setPublicWorld({
    buildings: options.quiet ? state.buildings : [],
    raidEvents: options.quiet ? state.raidEvents : [],
    repairEvents: options.quiet ? state.repairEvents : [],
    owners: options.quiet ? state.owners : [],
    loading: true,
  });

  try {
    console.info('[engram] public world refresh start', {
      networkType: PUBLIC_WORLD_NETWORK,
      currentWallet,
      force: !!options.force,
    });
    const { l1Rpc, storageRpc } = getNetworkConfig(PUBLIC_WORLD_NETWORK);
    const provider = new JsonRpcProvider(l1Rpc);
    const contract = new Contract(registry, ENGRAM_REGISTRY_ABI, provider);
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - scanLookback());
    const events = await contract.queryFilter(contract.filters.RootUpdated(), fromBlock, 'latest');
    const latestRoots = new Map<string, string>();
    const excluded = currentWallet?.toLowerCase();

    for (const event of events) {
      const log = event as EventLog;
      const owner = String(log.args?.wallet ?? '').toLowerCase();
      const root = String(log.args?.root ?? '');
      if (!owner || !root) continue;
      latestRoots.set(owner, root);
    }

    const entries = Array.from(latestRoots.entries()).slice(-32);
    const worlds = await Promise.all(entries.map(([owner, root]) => downloadWorldData(owner, root, storageRpc)));
    const raidEvents = worlds.flatMap((world) => world.raidEvents);
    const repairEvents = worlds.flatMap((world) => world.repairEvents);
    const onchainBuildings = worlds.flatMap((world) => world.buildings).filter((building) => building.owner !== excluded);
    const byOwnerAndPosition = new Set<string>();
    const counts = new Map<string, number>();
    const buildings = onchainBuildings.filter((building) => {
      const id = `${building.owner}:${building.type}:${building.x}:${building.z}:${building.rot}`;
      if (byOwnerAndPosition.has(id)) return false;
      byOwnerAndPosition.add(id);
      counts.set(building.owner, (counts.get(building.owner) ?? 0) + 1);
      return true;
    }).map((building) => {
      const eventsForBuilding = raidEvents
        .filter((event) => event.defender === building.owner && event.buildingId === building.id)
        .sort((a, b) => b.at - a.at);
      const repairsForBuilding = repairEvents
        .filter((event) => event.owner === building.owner && event.buildingId === building.id)
        .sort((a, b) => b.at - a.at);
      const raidDamage = eventsForBuilding.reduce((sum, event) => sum + event.damage, 0);
      const repairHealing = repairsForBuilding.reduce((sum, event) => sum + event.heal, 0);
      const maxHp = Math.max(1, building.maxHp ?? building.hp ?? 1);
      const hp = Math.max(0, Math.min(maxHp, (building.hp ?? maxHp) - raidDamage + repairHealing));
      return {
        ...building,
        hp,
        maxHp,
        raidDamage,
        repairHealing,
        raidEvents: eventsForBuilding,
        repairEvents: repairsForBuilding,
      };
    });
    const owners = Array.from(counts.entries())
      .map(([owner, buildingCount]) => ({ owner, buildingCount }))
      .sort((a, b) => b.buildingCount - a.buildingCount);

    console.info('[engram] public world refresh done', {
      wallets: entries.length,
      buildings: buildings.length,
      raidEvents: raidEvents.length,
      repairEvents: repairEvents.length,
    });
    setPublicWorld({ buildings, raidEvents, repairEvents, owners, loading: false });
  } catch (error) {
    console.warn('[engram] public world load failed:', error);
    setPublicWorld({ buildings: state.buildings, raidEvents: state.raidEvents, repairEvents: state.repairEvents, owners: state.owners, loading: false });
  }
}

export function startPublicWorldPolling(
  networkType: NetworkType,
  currentWallet?: string | null,
  intervalMs = 60_000
): () => void {
  if (typeof window === 'undefined') return () => {};

  let stopped = false;
  const refresh = () => {
    if (stopped) return;
    void initPublicWorld(networkType, currentWallet, { force: true, quiet: true });
  };

  refresh();
  const id = window.setInterval(refresh, intervalMs);
  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}

export function usePublicWorld(): PublicWorldState {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_PUBLIC_WORLD);
}
