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
// cache that 32-byte pointer in localStorage. IMPORTANT: only the *pointer* is
// local — the memory DATA itself lives entirely on 0G and is auditable by its
// rootHash. True cross-device recall would replace this pointer cache with an
// on-chain registry / 0G-KV lookup (documented as next step).
//
// This module is browser-only (localStorage pointer cache; reads via fetch,
// writes via POST /api/save). It is never imported by the API server routes.

import { downloadByRootHashAPI } from '@/lib/0g/downloader';
import { getNetworkConfig } from '@/lib/0g/network';
import type { NetworkType } from '@/app/providers';
import {
  type MemoryBundle,
  type NPCMemory,
  type NPCName,
  defaultMemory,
} from '@/lib/types';

const NPC_NAMES: NPCName[] = ['aldric', 'maren', 'sable'];
const BUNDLE_VERSION = 1;

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
  base.updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : base.updatedAt;
  return base;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
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
  const root = getBundleRoot(wallet);
  if (!root) return null;

  const { storageRpc } = getNetworkConfig(networkType);
  const [data, err] = await downloadByRootHashAPI(root, storageRpc);
  if (err || !data) {
    console.warn('[engram] could not read bundle from 0G:', err?.message);
    return null;
  }

  try {
    const text = new TextDecoder('utf-8').decode(data);
    return normalizeBundle(JSON.parse(text), wallet);
  } catch (e) {
    console.warn('[engram] bundle parse failed:', e);
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
  const bundle = (await readBundle(wallet, networkType)) ?? emptyBundle(wallet);
  return bundle.npcs;
}

// ─── write (sponsored server-side upload to 0G) ───────────────────────────────

export interface WriteResult {
  rootHash: string;
  txHash: string;
}

/**
 * Persists one NPC's updated memory to 0G Storage. Reads the current bundle,
 * replaces just this NPC's slice (preserving the others), and POSTs the whole
 * bundle to /api/save, which performs the actual 0G upload server-side.
 *
 * The 0G storage indexer/nodes don't send CORS headers, so the SDK can't run in
 * the browser. The server uploads with a sponsor wallet; the memory is still
 * keyed to the player's wallet address and content-addressed on 0G. We cache the
 * returned rootHash pointer so this bundle can be read back next session.
 */
export async function writeMemory(
  wallet: string,
  npcName: NPCName,
  memory: NPCMemory,
  networkType: NetworkType
): Promise<WriteResult> {
  // Start from the current bundle (or a fresh one) and patch this NPC.
  const bundle = (await readBundle(wallet, networkType)) ?? emptyBundle(wallet);
  bundle.npcs[npcName] = memory;
  bundle.wallet = wallet.toLowerCase();
  bundle.version = BUNDLE_VERSION;
  bundle.updatedAt = Date.now();

  // Hand the full bundle to the server, which writes it to 0G (no CORS in Node).
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: wallet, networkType, bundle }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.rootHash) {
    throw new Error(data.error || 'Save to 0G failed.');
  }

  setBundleRoot(wallet, data.rootHash);
  return { rootHash: data.rootHash, txHash: data.txHash || data.rootHash };
}
