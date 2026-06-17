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
// This module is browser-only (it uses window.ethereum + localStorage). It is
// never imported by the /api/npc server route.

import { createBlob, generateMerkleTree, getRootHash } from '@/lib/0g/blob';
import { getProvider, getSigner } from '@/lib/0g/fees';
import { uploadToStorage } from '@/lib/0g/uploader';
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

// ─── write (one upload = one wallet signature) ────────────────────────────────

export interface WriteResult {
  rootHash: string;
  txHash: string;
}

/**
 * Persists one NPC's updated memory to 0G Storage. Reads the current bundle,
 * replaces just this NPC's slice (preserving the others), uploads the whole
 * bundle as a single blob, and caches the new rootHash pointer.
 *
 * Runs the full proven upload pipeline directly (blob → merkle → submission →
 * fees → submit tx → upload), so it can be called from anywhere in the client
 * (e.g. when the player leaves a conversation). Triggers ONE MetaMask signature.
 */
export async function writeMemory(
  wallet: string,
  npcName: NPCName,
  memory: NPCMemory,
  networkType: NetworkType
): Promise<WriteResult> {
  // 1. Start from the current bundle (or a fresh one) and patch this NPC.
  const bundle = (await readBundle(wallet, networkType)) ?? emptyBundle(wallet);
  bundle.npcs[npcName] = memory;
  bundle.wallet = wallet.toLowerCase();
  bundle.version = BUNDLE_VERSION;
  bundle.updatedAt = Date.now();

  // 2. Serialize the bundle into a File and run the 0G upload pipeline.
  const json = JSON.stringify(bundle);
  const file = new File([json], `engram_${wallet.toLowerCase()}.json`, {
    type: 'application/json',
  });

  const blob = createBlob(file);

  const [tree, treeErr] = await generateMerkleTree(blob);
  if (!tree) throw new Error(`Merkle tree failed: ${treeErr?.message}`);

  const [rootHash, hashErr] = getRootHash(tree);
  if (!rootHash) throw new Error(`Root hash failed: ${hashErr?.message}`);

  // 3. Wallet provider / signer (the signer is what triggers MetaMask).
  const [provider, providerErr] = await getProvider();
  if (!provider) throw new Error(`Provider error: ${providerErr?.message}`);

  const [signer, signerErr] = await getSigner(provider);
  if (!signer) throw new Error(`Signer error: ${signerErr?.message}`);

  const network = getNetworkConfig(networkType);

  // 0G Chain has no EIP-1559. Fetch a plain legacy gasPrice (eth_gasPrice, no
  // EIP-1559 probing); the SDK builds a type-0 tx with it (avoids the
  // eth_maxPriorityFeePerGas -32601 that aborts the save). x2 for inclusion.
  let gasPrice: bigint | undefined;
  try {
    const gp = BigInt(await provider.send('eth_gasPrice', []));
    if (gp > BigInt(0)) gasPrice = gp * BigInt(2);
  } catch {
    // Leave undefined; the SDK falls back to the wallet's own gas handling.
  }

  // 4. Let the 0G SDK do the on-chain submit AND the segment upload in one call.
  // It reads the correct Flow address from the storage node and computes the
  // exact storage fee itself — our hand-rolled fee calc + manual submit were
  // reverting the tx. Returns the submit txHash.
  const [txHash, uploadErr] = await uploadToStorage(blob, network.storageRpc, network.l1Rpc, signer, gasPrice);
  if (uploadErr) throw new Error(`Upload error: ${uploadErr.message}`);

  // 5. Remember the new anchor so we can read this bundle back next session.
  setBundleRoot(wallet, rootHash);

  return { rootHash, txHash: txHash || rootHash };
}
