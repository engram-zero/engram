import { NextResponse } from 'next/server';
import { JsonRpcProvider, Wallet } from 'ethers';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NetworkType } from '@/app/providers';
import { createBlob, generateMerkleTree, getRootHash } from '@/lib/0g/blob';
import { getNetworkConfig } from '@/lib/0g/network';
import { uploadToStorage } from '@/lib/0g/uploader';
import type { ParcelClaim, ParcelDataBundle } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const isAddress = (w: unknown): w is string =>
  typeof w === 'string' && /^0x[a-fA-F0-9]{40}$/.test(w);
const PARCEL_SIZE = 18;
const PARCEL_COMMISSION_BPS = 1200;

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

function normalizeParcel(raw: unknown, walletAddress: string): ParcelClaim | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const owner = typeof p.owner === 'string' ? p.owner.toLowerCase() : '';
  if (owner !== walletAddress.toLowerCase()) return null;

  const gx = Math.max(-12, Math.min(12, Math.round(Number(p.gx ?? 0))));
  const gz = Math.max(-12, Math.min(12, Math.round(Number(p.gz ?? 0))));
  const id = `p:${gx}:${gz}`;
  const terrain = p.terrain === 'grove' || p.terrain === 'quarry' ? p.terrain : 'meadow';
  const at = Math.round(Number(p.at ?? 0));

  return {
    id,
    owner,
    gx,
    gz,
    x: gx * PARCEL_SIZE,
    z: gz * PARCEL_SIZE,
    size: PARCEL_SIZE,
    claimCost: Math.max(0, Math.min(999, Math.round(Number(p.claimCost ?? 0)))),
    commissionBps: Math.max(0, Math.min(5000, Math.round(Number(p.commissionBps ?? PARCEL_COMMISSION_BPS)))),
    terrain,
    at: Number.isFinite(at) && at > 0 ? at : Date.now(),
  };
}

export async function POST(req: Request) {
  const { key, source } = resolveSponsorKey();
  if (!key) {
    return NextResponse.json(
      { error: 'Parcel storage is not configured on the server (missing ENGRAM_SPONSOR_KEY; localhost may fall back to PRIVATE_KEY).' },
      { status: 503 }
    );
  }

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

  const net = getNetworkConfig((networkType as NetworkType) || 'turbo');
  const bundle: ParcelDataBundle = {
    version: 1,
    kind: 'engram-parcel',
    wallet: walletAddress.toLowerCase(),
    parcel,
    updatedAt: Date.now(),
  };

  console.log('[api/parcel-save] request', {
    walletAddress,
    networkType: net.name,
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

    const [txHash, uploadErr] = await uploadToStorage(blob, net.storageRpc, net.l1Rpc, wallet, gasPrice);
    if (uploadErr) throw uploadErr;

    const savedParcel = { ...parcel, dataRoot: rootHash, dataTxHash: txHash || rootHash };
    console.log('[api/parcel-save] uploaded to 0G', { parcelId: parcel.id, rootHash, txHash: txHash || rootHash });
    return NextResponse.json({ rootHash, txHash: txHash || rootHash, parcel: savedParcel });
  } catch (err) {
    console.error('[api/parcel-save]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
