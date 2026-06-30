'use client';

// ─── Engram memory layer (client-side, persisted on 0G Storage) ───────────────
//
// All of Aldenmoor's memory for one wallet lives in a SINGLE JSON document — the
// MemoryBundle { aldric, maren, sable } — stored on 0G Storage. One upload per
// save = one wallet signature per conversation. Sable can read the other NPCs'
// memory for free because it's all in the same document.
//
// 0G Storage is content-addressed: you can only fetch a document if you know its
// rootHash. Something must remember "the latest rootHash for this wallet". We
// read that 32-byte pointer from EngramRegistry when possible and keep
// localStorage as an instant cache/fallback. IMPORTANT: only the *pointer* is
// cached locally — the memory DATA itself lives entirely on 0G and is auditable
// by its rootHash.
//
// This module is browser-only (localStorage pointer cache; reads via fetch,
// writes via POST /api/save). It is never imported by the API server routes.

import { downloadByRootHashAPI } from '@/lib/0g/downloader';
import { getNetworkConfig } from '@/lib/0g/network';
import { debugInfo, debugWarn } from '@/lib/debug-log';
import { getRegistryAddress, readRootOnchain, writeRootOnchain } from '@/lib/registry/registry';
import { normalizeWorldState } from '@/lib/world';
import type { NetworkType } from '@/app/providers';
import {
  type MemoryBundle,
  type NPCMemory,
  type NPCName,
  type WorldState,
  defaultMemory,
} from '@/lib/types';

const NPC_NAMES: NPCName[] = ['aldric', 'maren', 'sable'];
const BUNDLE_VERSION = 1;

function getBundleNetworkType(networkType: NetworkType): NetworkType {
  // 0G's Standard storage indexer is currently deprecated/503ing; keep the
  // in-game memory/world bundle on Turbo so dialogue and saves remain reliable.
  if (networkType === 'standard') return 'turbo';
  return networkType;
}

// ─── rootHash pointer cache (localStorage) ────────────────────────────────────

function pointerKey(wallet: string): string {
  return `engram:bundleRoot:${wallet.toLowerCase()}`;
}

/** The 0G rootHash of this wallet's latest MemoryBundle, if we know it. */
export function getBundleRoot(wallet: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(pointerKey(wallet));
}

function setBundleRoot(wallet: string, rootHash: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(pointerKey(wallet), rootHash);
}

async function resolveBundleRoot(wallet: string, networkType: NetworkType): Promise<string | null> {
  const { l1Rpc } = getNetworkConfig(getBundleNetworkType(networkType));
  const onchainRoot = await readRootOnchain(wallet, l1Rpc);
  if (onchainRoot) {
    setBundleRoot(wallet, onchainRoot);
    return onchainRoot;
  }

  return getBundleRoot(wallet);
}

// ─── bundle helpers ───────────────────────────────────────────────────────────

function emptyBundle(wallet: string): MemoryBundle {
  return {
    version: BUNDLE_VERSION,
    wallet: wallet.toLowerCase(),
    npcs: {
      aldric: defaultMemory(),
      maren: defaultMemory(),
      sable: defaultMemory(),
    },
    updatedAt: Date.now(),
  };
}

/** Coerce an arbitrary parsed object into a well-formed MemoryBundle. */
function normalizeBundle(raw: any, wallet: string): MemoryBundle {
  const base = emptyBundle(wallet);
  if (!raw || typeof raw !== 'object') return base;
  for (const npc of NPC_NAMES) {
    const m = raw?.npcs?.[npc];
    if (m && typeof m === 'object') {
      base.npcs[npc] = {
        trust_level: clamp(Number(m.trust_level ?? 50), 0, 100),
        interaction_history: Array.isArray(m.interaction_history) ? m.interaction_history : [],
        emotional_state: typeof m.emotional_state === 'string' ? m.emotional_state : 'neutral',
        debts: Math.max(0, Number(m.debts ?? 0)),
        last_seen: typeof m.last_seen === 'number' ? m.last_seen : null,
      };
    }
  }
  if ('world' in raw) {
    base.world = normalizeWorldState(raw.world);
  }
  base.updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : base.updatedAt;
  return base;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function sameNpcMemory(a: NPCMemory, b: NPCMemory): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameWorldState(a: WorldState | undefined, b: WorldState): boolean {
  return JSON.stringify(normalizeWorldState(a)) === JSON.stringify(normalizeWorldState(b));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// ─── reads (no signature, just an HTTP fetch from 0G) ─────────────────────────

/**
 * Downloads this wallet's MemoryBundle from 0G Storage. Returns null on first
 * contact (no pointer cached yet, or the blob can't be fetched).
 */
export async function readBundle(
  wallet: string,
  networkType: NetworkType
): Promise<MemoryBundle | null> {
  const root = await resolveBundleRoot(wallet, networkType);
  if (!root) return null;

  return downloadBundle(root, wallet, networkType);
}

async function downloadBundle(
  root: string,
  wallet: string,
  networkType: NetworkType
): Promise<MemoryBundle | null> {
  const effectiveNetworkType = getBundleNetworkType(networkType);
  const { storageRpc } = getNetworkConfig(effectiveNetworkType);
  const [data, err] = await downloadByRootHashAPI(root, storageRpc);
  if (err || !data) {
    debugWarn('[engram] could not read bundle from 0G:', {
      requestedNetworkType: networkType,
      effectiveNetworkType,
      error: err?.message,
    });
    return null;
  }

  try {
    const text = new TextDecoder('utf-8').decode(data);
    return normalizeBundle(JSON.parse(text), wallet);
  } catch (e) {
    debugWarn('[engram] bundle parse failed:', e);
    return null;
  }
}

/**
 * Reads one NPC's memory. On first contact returns fresh defaults (the caller
 * persists them with the first writeMemory, so even the first meeting lands on 0G).
 */
export async function readMemory(
  wallet: string,
  npcName: NPCName,
  networkType: NetworkType
): Promise<NPCMemory> {
  const bundle = await readBundle(wallet, networkType);
  return bundle ? bundle.npcs[npcName] : defaultMemory();
}

/** All three NPC memories at once — powers Sable's cross-memory and the memory panel. */
export async function readAllMemories(
  wallet: string,
  networkType: NetworkType
): Promise<Record<NPCName, NPCMemory>> {
  let bundle: MemoryBundle | null = null;
  try {
    bundle = await withTimeout(readBundle(wallet, networkType), 8000, '0G memory read');
  } catch (error) {
    debugWarn('[engram] memory load timed out or failed; using defaults:', error);
  }
  return (bundle ?? emptyBundle(wallet)).npcs;
}

// ─── write (sponsored server-side upload to 0G) ───────────────────────────────

export interface WriteResult {
  rootHash: string;
  txHash: string;
  registryTxHash?: string;
  skipped?: boolean;
}

/**
 * Persists one NPC's updated memory to 0G Storage. Reads the current bundle,
 * replaces just this NPC's slice (preserving the others), and POSTs the whole
 * bundle to /api/save, which performs the actual 0G upload server-side.
 *
 * The 0G storage indexer/nodes don't send CORS headers, so the SDK can't run in
 * the browser. The server uploads with a sponsor wallet; the memory is still
 * keyed to the player's wallet address and content-addressed on 0G. We cache the
 * returned rootHash pointer and then best-effort anchor it in EngramRegistry for
 * cross-device recall.
 */
export async function writeMemory(
  wallet: string,
  npcName: NPCName,
  memory: NPCMemory,
  networkType: NetworkType
): Promise<WriteResult> {
  // Start from the current bundle (or a fresh one) and patch this NPC.
  const previousRoot = await resolveBundleRoot(wallet, networkType);
  const bundle = previousRoot
    ? (await downloadBundle(previousRoot, wallet, networkType)) ?? emptyBundle(wallet)
    : emptyBundle(wallet);
  const memoryChanged = !sameNpcMemory(bundle.npcs[npcName], memory);
  bundle.npcs[npcName] = memory;
  bundle.wallet = wallet.toLowerCase();
  bundle.version = BUNDLE_VERSION;
  if (memoryChanged) bundle.updatedAt = Date.now();

  return uploadBundleAndAnchor(wallet, networkType, bundle, previousRoot);
}

/**
 * Persists the gameplay world state to the same 0G bundle/root as NPC memory.
 * This is used by the WorldPersistence adapter so placed buildings, inventory,
 * and chopped trees become portable across browsers/devices without a separate
 * registry contract.
 */
export async function writeWorldState(
  wallet: string,
  world: WorldState,
  networkType: NetworkType
): Promise<WriteResult> {
  const nextWorld = normalizeWorldState(world);
  debugInfo('[engram] writeWorldState start', {
    wallet,
    networkType,
    buildings: nextWorld.buildings.length,
    choppedTrees: nextWorld.choppedTrees.length,
  });
  const previousRoot = await resolveBundleRoot(wallet, networkType);
  debugInfo('[engram] writeWorldState previous root', previousRoot);
  const bundle = previousRoot
    ? (await downloadBundle(previousRoot, wallet, networkType)) ?? emptyBundle(wallet)
    : emptyBundle(wallet);

  if (previousRoot && sameWorldState(bundle.world, nextWorld)) {
    debugInfo('[engram] writeWorldState no-op; world unchanged');
    return { rootHash: previousRoot, txHash: previousRoot, skipped: true };
  }

  bundle.wallet = wallet.toLowerCase();
  bundle.version = BUNDLE_VERSION;
  bundle.world = nextWorld;
  bundle.updatedAt = Date.now();

  return uploadBundleAndAnchor(wallet, networkType, bundle, previousRoot);
}

async function uploadBundleAndAnchor(
  wallet: string,
  networkType: NetworkType,
  bundle: MemoryBundle,
  previousRoot: string | null
): Promise<WriteResult> {
  const effectiveNetworkType = getBundleNetworkType(networkType);
  debugInfo('[engram] uploadBundleAndAnchor POST /api/save', {
    wallet,
    networkType,
    effectiveNetworkType,
    previousRoot,
    hasWorld: !!bundle.world,
    buildings: bundle.world?.buildings.length ?? 0,
  });
  // Hand the full bundle to the server, which writes it to 0G (no CORS in Node).
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: wallet, networkType: effectiveNetworkType, bundle }),
  });
  const data = await res.json().catch(() => ({}));
  debugInfo('[engram] uploadBundleAndAnchor /api/save response', {
    ok: res.ok,
    status: res.status,
    rootHash: data.rootHash,
    txHash: data.txHash,
    error: data.error,
    debug: data.debug,
  });
  if (!res.ok || !data.rootHash) {
    throw new Error(data.error || 'Save to 0G failed.');
  }

  setBundleRoot(wallet, data.rootHash);

  let registryTxHash: string | undefined;
  if (getRegistryAddress() && previousRoot?.toLowerCase() !== data.rootHash.toLowerCase()) {
    try {
      // Future: if storage writes stop being sponsored, collapse storage + registry
      // into one user confirmation via relayer/meta-tx or a unified 0G flow.
      debugInfo('[engram] anchoring root in EngramRegistry', data.rootHash);
      const registryTx = await writeRootOnchain(wallet, data.rootHash);
      registryTxHash = registryTx.txHash;
      debugInfo('[engram] registry root anchored', registryTx);
    } catch (error) {
      debugWarn('[engram] memory saved to 0G, but registry anchor failed:', error);
    }
  }

  return { rootHash: data.rootHash, txHash: data.txHash || data.rootHash, registryTxHash };
}
