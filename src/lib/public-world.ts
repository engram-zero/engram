'use client';

import { useSyncExternalStore } from 'react';
import { Contract, JsonRpcProvider, ZeroHash, decodeBytes32String, type EventLog } from 'ethers';
import type { NetworkType } from '@/app/providers';
import { downloadByRootHashAPI } from '@/lib/0g/downloader';
import { getNetworkConfig } from '@/lib/0g/network';
import { ENGRAM_REGISTRY_ABI } from '@/lib/registry/abi';
import { getRegistryAddress } from '@/lib/registry/registry';
import { PARCEL_REGISTRY_ABI } from '@/lib/registry/parcel-abi';
import { getParcelRegistryAddress } from '@/lib/registry/parcels';
import { normalizeWorldState, PARCEL_SIZE, parcelClaimCost, parcelTerrainForGrid, type Building, type DemonSiegeEvent, type ParcelClaim, type ParcelRentEvent, type RaidEvent, type RepairEvent } from '@/lib/world';

export type PublicRaidEvent = RaidEvent & { author: string };
export type PublicRepairEvent = RepairEvent & { author: string };
export type PublicDemonSiegeEvent = DemonSiegeEvent & { author: string };
export type PublicParcelClaim = ParcelClaim & { author: string };
export type PublicParcelRentEvent = ParcelRentEvent & { author: string };
export type PublicBuilding = Building & {
  owner: string;
  raidDamage?: number;
  repairHealing?: number;
  raidEvents?: PublicRaidEvent[];
  repairEvents?: PublicRepairEvent[];
  siegeEvents?: PublicDemonSiegeEvent[];
};
export interface PublicWorldOwner {
  owner: string;
  buildingCount: number;
  parcelCount: number;
}

interface PublicWorldState {
  buildings: PublicBuilding[];
  raidEvents: PublicRaidEvent[];
  repairEvents: PublicRepairEvent[];
  siegeEvents: PublicDemonSiegeEvent[];
  parcels: PublicParcelClaim[];
  parcelRentEvents: PublicParcelRentEvent[];
  owners: PublicWorldOwner[];
  loading: boolean;
}

const EMPTY_PUBLIC_WORLD: PublicWorldState = { buildings: [], raidEvents: [], repairEvents: [], siegeEvents: [], parcels: [], parcelRentEvents: [], owners: [], loading: false };
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

export function getPublicWorldSnapshot(): PublicWorldState {
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

function normalizeRoot(raw: unknown): string | null {
  return typeof raw === 'string' && /^0x[a-fA-F0-9]{64}$/.test(raw) && raw !== ZeroHash ? raw : null;
}

function parcelFromRegistryEvent(log: EventLog): PublicParcelClaim | null {
  try {
    const id = decodeBytes32String(String(log.args?.parcelId ?? ''));
    const owner = String(log.args?.owner ?? '').toLowerCase();
    const match = id.match(/^p:([-0-9]+):([-0-9]+)$/);
    if (!match || !/^0x[a-f0-9]{40}$/.test(owner)) return null;
    const gx = Number(match[1]);
    const gz = Number(match[2]);
    if (!Number.isInteger(gx) || !Number.isInteger(gz)) return null;
    const claim: PublicParcelClaim = {
      id,
      owner,
      author: owner,
      gx,
      gz,
      x: gx * PARCEL_SIZE,
      z: gz * PARCEL_SIZE,
      size: PARCEL_SIZE,
      claimCost: parcelClaimCost(gx, gz),
      commissionBps: Number(log.args?.commissionBps ?? 0),
      terrain: parcelTerrainForGrid(gx, gz),
      dataRoot: normalizeRoot(log.args?.dataRoot),
      at: Number(log.args?.at ?? 0) * 1000,
    };
    return claim;
  } catch {
    return null;
  }
}

async function downloadParcelData(owner: string, root: string | null | undefined, storageRpc: string): Promise<PublicParcelClaim | null> {
  const dataRoot = normalizeRoot(root);
  if (!dataRoot) return null;

  const [data, err] = await downloadByRootHashAPI(dataRoot, storageRpc);
  if (err || !data) return null;

  try {
    const raw = JSON.parse(new TextDecoder('utf-8').decode(data));
    if (raw?.kind !== 'engram-parcel') return null;
    const world = normalizeWorldState({ parcelClaims: [raw.parcel] });
    const parcel = world.parcelClaims.find((claim) => claim.owner === owner);
    return parcel ? { ...parcel, dataRoot, author: owner } : null;
  } catch {
    return null;
  }
}

async function downloadWorldData(
  owner: string,
  root: string,
  storageRpc: string
): Promise<{ buildings: PublicBuilding[]; raidEvents: PublicRaidEvent[]; repairEvents: PublicRepairEvent[]; siegeEvents: PublicDemonSiegeEvent[]; parcels: PublicParcelClaim[]; parcelRentEvents: PublicParcelRentEvent[] }> {
  const [data, err] = await downloadByRootHashAPI(root, storageRpc);
  if (err || !data) return { buildings: [], raidEvents: [], repairEvents: [], siegeEvents: [], parcels: [], parcelRentEvents: [] };

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
      siegeEvents: world.siegeEvents
        .filter((event) => event.owner === owner)
        .map((event) => ({ ...event, author: owner })),
      parcels: world.parcelClaims
        .filter((claim) => claim.owner === owner)
        .map((claim) => ({ ...claim, author: owner })),
      parcelRentEvents: world.parcelRentEvents
        .filter((event) => event.payer === owner)
        .map((event) => ({ ...event, author: owner })),
    };
  } catch {
    return { buildings: [], raidEvents: [], repairEvents: [], siegeEvents: [], parcels: [], parcelRentEvents: [] };
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
    siegeEvents: options.quiet ? state.siegeEvents : [],
    parcels: options.quiet ? state.parcels : [],
    parcelRentEvents: options.quiet ? state.parcelRentEvents : [],
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
    const parcelRegistry = getParcelRegistryAddress();
    const parcelContract = parcelRegistry ? new Contract(parcelRegistry, PARCEL_REGISTRY_ABI, provider) : null;
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - scanLookback());
    const [events, parcelEvents, parcelDataEvents] = await Promise.all([
      contract.queryFilter(contract.filters.RootUpdated(), fromBlock, 'latest'),
      parcelContract ? parcelContract.queryFilter(parcelContract.filters.ParcelClaimed(), fromBlock, 'latest') : Promise.resolve([]),
      parcelContract ? parcelContract.queryFilter(parcelContract.filters.ParcelDataUpdated(), fromBlock, 'latest') : Promise.resolve([]),
    ]);
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
    const siegeEvents = worlds.flatMap((world) => world.siegeEvents);
    const parcelRentEvents = worlds.flatMap((world) => world.parcelRentEvents);
    const registryById = new Map<string, PublicParcelClaim>();
    for (const event of [...parcelEvents, ...parcelDataEvents]
      .map((event) => parcelFromRegistryEvent(event as EventLog))
      .filter((parcel): parcel is PublicParcelClaim => !!parcel)
      .sort((a, b) => a.at - b.at)) {
      const previous = registryById.get(event.id);
      registryById.set(event.id, {
        ...(previous ?? event),
        ...event,
        dataRoot: event.dataRoot ?? previous?.dataRoot ?? null,
        at: previous?.at ?? event.at,
      });
    }
    const registryParcels = await Promise.all(Array.from(registryById.values()).map(async (parcel) => {
      const hydrated = await downloadParcelData(parcel.owner, parcel.dataRoot, storageRpc);
      return hydrated ? { ...parcel, ...hydrated, dataRoot: parcel.dataRoot ?? hydrated.dataRoot } : parcel;
    }));
    const parcelsById = new Map<string, PublicParcelClaim>();
    for (const parcel of registryParcels) parcelsById.set(parcel.id, parcel);
    for (const parcel of worlds.flatMap((world) => world.parcels)) {
      const onchain = parcelsById.get(parcel.id);
      if (!onchain) {
        parcelsById.set(parcel.id, parcel);
        continue;
      }
      if (onchain.owner === parcel.owner) {
        parcelsById.set(parcel.id, { ...onchain, ...parcel, dataRoot: onchain.dataRoot ?? parcel.dataRoot ?? null });
      }
    }
    const parcels = Array.from(parcelsById.values()).sort((a, b) => a.at - b.at);
    const onchainBuildings = worlds.flatMap((world) => world.buildings).filter((building) => building.owner !== excluded);
    const byOwnerAndPosition = new Set<string>();
    const counts = new Map<string, { buildingCount: number; parcelCount: number }>();
    for (const parcel of parcels) {
      if (parcel.owner === excluded) continue;
      const count = counts.get(parcel.owner) ?? { buildingCount: 0, parcelCount: 0 };
      count.parcelCount += 1;
      counts.set(parcel.owner, count);
    }
    const buildings = onchainBuildings.filter((building) => {
      const id = `${building.owner}:${building.type}:${building.x}:${building.z}:${building.rot}`;
      if (byOwnerAndPosition.has(id)) return false;
      byOwnerAndPosition.add(id);
      const count = counts.get(building.owner) ?? { buildingCount: 0, parcelCount: 0 };
      count.buildingCount += 1;
      counts.set(building.owner, count);
      return true;
    }).map((building) => {
      const eventsForBuilding = raidEvents
        .filter((event) => event.defender === building.owner && event.buildingId === building.id)
        .sort((a, b) => b.at - a.at);
      const repairsForBuilding = repairEvents
        .filter((event) => event.owner === building.owner && event.buildingId === building.id)
        .sort((a, b) => b.at - a.at);
      const siegesForBuilding = siegeEvents
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
        siegeEvents: siegesForBuilding,
      };
    });
    const owners = Array.from(counts.entries())
      .map(([owner, count]) => ({ owner, buildingCount: count.buildingCount, parcelCount: count.parcelCount }))
      .sort((a, b) => (b.buildingCount + b.parcelCount) - (a.buildingCount + a.parcelCount));

    console.info('[engram] public world refresh done', {
      wallets: entries.length,
      buildings: buildings.length,
      raidEvents: raidEvents.length,
      repairEvents: repairEvents.length,
      siegeEvents: siegeEvents.length,
      parcels: parcels.length,
      registryParcels: registryParcels.length,
      parcelDataEvents: parcelDataEvents.length,
      parcelRentEvents: parcelRentEvents.length,
    });
    setPublicWorld({ buildings, raidEvents, repairEvents, siegeEvents, parcels, parcelRentEvents, owners, loading: false });
  } catch (error) {
    console.warn('[engram] public world load failed:', error);
    setPublicWorld({ buildings: state.buildings, raidEvents: state.raidEvents, repairEvents: state.repairEvents, siegeEvents: state.siegeEvents, parcels: state.parcels, parcelRentEvents: state.parcelRentEvents, owners: state.owners, loading: false });
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
