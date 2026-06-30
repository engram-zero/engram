import { NextResponse } from 'next/server';
import { JsonRpcProvider, Wallet } from 'ethers';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NetworkType } from '@/app/providers';
import { createBlob, generateMerkleTree, getRootHash } from '@/lib/0g/blob';
import { biomeAt } from '@/lib/biome';
import { getNetworkConfig } from '@/lib/0g/network';
import { uploadToStorage } from '@/lib/0g/uploader';
import type { ParcelClaim, ParcelDataBundle } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const isAddress = (w: unknown): w is string =>
  typeof w === 'string' && /^0x[a-fA-F0-9]{40}$/.test(w);
const PARCEL_SIZE = 18;
const PARCEL_COMMISSION_BPS = 1200;
const PARCEL_STORAGE_NETWORK: NetworkType = 'turbo';
const UPLOAD_RETRY_DELAYS_MS = [800, 1800, 4000];
const DEFERRED_RETRY_DELAYS_MS = [15000, 60000, 180000];
const pendingDeferredUploads = new Set<string>();

function normalizeBiome(raw: unknown, x: number, z: number): ParcelClaim['biome'] {
  return raw === 'sand' || raw === 'snow' || raw === 'dry' || raw === 'meadow' ? raw : biomeAt(x, z);
}

function readEnvFileValue(name: string): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;

  for (const file of ['.env.local', '.env']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;

    const line = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));
    const value = line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  }
  return undefined;
}

function resolveSponsorKey(): { key?: string; source: string } {
  const sponsorFromEnv = process.env.ENGRAM_SPONSOR_KEY;
  const sponsorFromFile = readEnvFileValue('ENGRAM_SPONSOR_KEY');
  const privateFromEnv = process.env.NODE_ENV !== 'production' ? process.env.PRIVATE_KEY : undefined;
  const privateFromFile = process.env.NODE_ENV !== 'production' ? readEnvFileValue('PRIVATE_KEY') : undefined;

  if (sponsorFromEnv) return { key: sponsorFromEnv, source: 'process.env.ENGRAM_SPONSOR_KEY' };
  if (sponsorFromFile) return { key: sponsorFromFile, source: 'file:ENGRAM_SPONSOR_KEY' };
  if (privateFromEnv) return { key: privateFromEnv, source: 'process.env.PRIVATE_KEY (local fallback)' };
  if (privateFromFile) return { key: privateFromFile, source: 'file:PRIVATE_KEY (local fallback)' };
  return { source: 'none' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function uploadParcelBlobWithRetry(
  blob: ReturnType<typeof createBlob>,
  net: ReturnType<typeof getNetworkConfig>,
  wallet: Wallet,
  gasPrice: bigint | undefined,
  parcelId: string
): Promise<{ txHash: string; attempts: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(UPLOAD_RETRY_DELAYS_MS[attempt - 1]);
    const [txHash, uploadErr] = await uploadToStorage(blob, net.storageRpc, net.l1Rpc, wallet, gasPrice);
    if (!uploadErr) return { txHash: txHash || '', attempts: attempt + 1 };
    lastError = uploadErr;
    console.warn('[api/parcel-save] upload attempt failed', {
      parcelId,
      networkType: net.name,
      attempt: attempt + 1,
      error: errorMessage(uploadErr),
    });
  }
  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError));
}

function scheduleDeferredUpload(
  rootHash: string,
  blob: ReturnType<typeof createBlob>,
  net: ReturnType<typeof getNetworkConfig>,
  wallet: Wallet,
  gasPrice: bigint | undefined,
  parcelId: string
) {
  const key = `${net.name}:${rootHash}`;
  if (pendingDeferredUploads.has(key)) return;
  pendingDeferredUploads.add(key);

  const run = async (attempt = 0) => {
    await sleep(DEFERRED_RETRY_DELAYS_MS[attempt] ?? DEFERRED_RETRY_DELAYS_MS[DEFERRED_RETRY_DELAYS_MS.length - 1]);
    const [txHash, uploadErr] = await uploadToStorage(blob, net.storageRpc, net.l1Rpc, wallet, gasPrice);
    if (!uploadErr) {
      pendingDeferredUploads.delete(key);
      console.log('[api/parcel-save] deferred upload completed', { parcelId, rootHash, txHash: txHash || rootHash });
      return;
    }
    console.warn('[api/parcel-save] deferred upload failed', {
      parcelId,
      rootHash,
      attempt: attempt + 1,
      error: errorMessage(uploadErr),
    });
    if (attempt + 1 < DEFERRED_RETRY_DELAYS_MS.length) {
      void run(attempt + 1);
    } else {
      pendingDeferredUploads.delete(key);
    }
  };

  void run();
}

function normalizeParcel(raw: unknown, walletAddress: string): ParcelClaim | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const owner = typeof p.owner === 'string' ? p.owner.toLowerCase() : '';
  if (owner !== walletAddress.toLowerCase()) return null;

  const gx = Math.max(-12, Math.min(12, Math.round(Number(p.gx ?? 0))));
  const gz = Math.max(-12, Math.min(12, Math.round(Number(p.gz ?? 0))));
  const id = `p:${gx}:${gz}`;
  const terrain = p.terrain === 'grove' || p.terrain === 'quarry' ? p.terrain : 'meadow';
  const x = gx * PARCEL_SIZE;
  const z = gz * PARCEL_SIZE;
  const at = Math.round(Number(p.at ?? 0));

  return {
    id,
    owner,
    gx,
    gz,
    x,
    z,
    size: PARCEL_SIZE,
    claimCost: Math.max(0, Math.min(999, Math.round(Number(p.claimCost ?? 0)))),
    commissionBps: Math.max(0, Math.min(5000, Math.round(Number(p.commissionBps ?? PARCEL_COMMISSION_BPS)))),
    terrain,
    biome: normalizeBiome(p.biome, x, z),
    at: Number.isFinite(at) && at > 0 ? at : Date.now(),
  };
}

export async function POST(req: Request) {
  const { key, source } = resolveSponsorKey();
  let body: { walletAddress?: string; networkType?: string; parcel?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { walletAddress, networkType } = body;
  if (!isAddress(walletAddress)) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });

  const parcel = normalizeParcel(body.parcel, walletAddress);
  if (!parcel) return NextResponse.json({ error: 'Invalid parcel payload.' }, { status: 400 });

  const requestedNetworkType = (networkType as NetworkType) || PARCEL_STORAGE_NETWORK;
  // Standard storage is currently flaky/503ing; parcel blobs follow memory/world
  // saves onto Turbo so land claims are not blocked by the deprecated indexer.
  const effectiveNetworkType = requestedNetworkType === 'standard' ? PARCEL_STORAGE_NETWORK : requestedNetworkType;
  const net = getNetworkConfig(effectiveNetworkType);
  const bundle: ParcelDataBundle = {
    version: 1,
    kind: 'engram-parcel',
    wallet: walletAddress.toLowerCase(),
    parcel,
    updatedAt: Date.now(),
  };

  console.log('[api/parcel-save] request', {
    walletAddress,
    requestedNetworkType,
    effectiveNetworkType: net.name,
    parcelId: parcel.id,
    terrain: parcel.terrain,
    keySource: source,
  });

  try {
    const json = JSON.stringify(bundle);
    const file = new File([json], `engram_parcel_${parcel.id}_${walletAddress.toLowerCase()}.json`, { type: 'application/json' });
    const blob = createBlob(file);

    const [tree, treeErr] = await generateMerkleTree(blob);
    if (!tree) throw new Error(`Merkle tree failed: ${treeErr?.message}`);
    const [rootHash, hashErr] = getRootHash(tree);
    if (!rootHash) throw new Error(`Root hash failed: ${hashErr?.message}`);

    if (!key) {
      const savedParcel = { ...parcel, dataRoot: rootHash, dataTxHash: null };
      return NextResponse.json(
        {
          rootHash,
          txHash: null,
          parcel: savedParcel,
          storageStatus: 'pending',
          retryQueued: false,
          message: 'Parcel claim can continue, but 0G metadata upload is pending because sponsor storage is not configured.',
        },
        { status: 202 }
      );
    }

    const provider = new JsonRpcProvider(net.l1Rpc);
    const wallet = new Wallet(key, provider);
    const balance = await provider.getBalance(wallet.address).catch(() => null);
    if (balance !== null && balance === BigInt(0)) {
      return NextResponse.json(
        { error: `Sponsor wallet ${wallet.address} has 0 OG. Fund it at faucet.0g.ai (0G-Galileo-Testnet).` },
        { status: 402 }
      );
    }

    let gasPrice: bigint | undefined;
    try {
      const gp = BigInt(await provider.send('eth_gasPrice', []));
      if (gp > BigInt(0)) gasPrice = gp * BigInt(2);
    } catch {
      // 0G SDK can fall back to its own gas handling.
    }

    const { txHash, attempts } = await uploadParcelBlobWithRetry(blob, net, wallet, gasPrice, parcel.id);

    const savedParcel = { ...parcel, dataRoot: rootHash, dataTxHash: txHash || rootHash };
    console.log('[api/parcel-save] uploaded to 0G', { parcelId: parcel.id, rootHash, txHash: txHash || rootHash, attempts });
    return NextResponse.json({ rootHash, txHash: txHash || rootHash, parcel: savedParcel });
  } catch (err) {
    console.error('[api/parcel-save]', err);
    const message = errorMessage(err);
    if (message.match(/503|unavailable|timeout|timed out|fetch failed|bad gateway|gateway/i)) {
      try {
        const json = JSON.stringify(bundle);
        const file = new File([json], `engram_parcel_${parcel.id}_${walletAddress.toLowerCase()}.json`, { type: 'application/json' });
        const blob = createBlob(file);
        const [tree] = await generateMerkleTree(blob);
        const [rootHash] = tree ? getRootHash(tree) : [null];
        if (rootHash && key) {
          const provider = new JsonRpcProvider(net.l1Rpc);
          const wallet = new Wallet(key, provider);
          let gasPrice: bigint | undefined;
          try {
            const gp = BigInt(await provider.send('eth_gasPrice', []));
            if (gp > BigInt(0)) gasPrice = gp * BigInt(2);
          } catch {
            // Deferred retry can use SDK defaults.
          }
          scheduleDeferredUpload(rootHash, blob, net, wallet, gasPrice, parcel.id);
        }
        const savedParcel = { ...parcel, dataRoot: rootHash ?? null, dataTxHash: null };
        return NextResponse.json(
          {
            rootHash: rootHash ?? null,
            txHash: null,
            parcel: savedParcel,
            storageStatus: 'pending',
            retryQueued: !!rootHash && !!key,
            message: '0G Storage is temporarily unavailable; parcel claim can continue and metadata upload will retry.',
          },
          { status: 202 }
        );
      } catch (fallbackErr) {
        console.error('[api/parcel-save] graceful fallback failed', fallbackErr);
      }
    }
    return NextResponse.json(
      { error: message || 'Parcel metadata upload failed.' },
      { status: 500 }
    );
  }
}
