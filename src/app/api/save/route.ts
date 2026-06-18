// ─── /api/save ────────────────────────────────────────────────────────────────
// Server-side 0G Storage write. The 0G storage endpoints don't send CORS headers,
// so the browser can't talk to the indexer/nodes directly — uploads must run in
// Node. The client POSTs the full MemoryBundle here; we upload it to 0G with a
// sponsor wallet (ENGRAM_SPONSOR_KEY, a funded testnet key) and return the
// rootHash + txHash. The memory is still keyed to the player's wallet address and
// lives on 0G (auditable) — only the storage fee is sponsored for the demo.
//
// The sponsor key NEVER leaves the server. The 0G SDK is a Node SDK: here it can
// reach the indexer/nodes over HTTP and control gas (0G has no EIP-1559).

import { NextResponse } from 'next/server';
import { JsonRpcProvider, Wallet } from 'ethers';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createBlob, generateMerkleTree, getRootHash } from '@/lib/0g/blob';
import { uploadToStorage } from '@/lib/0g/uploader';
import { getNetworkConfig } from '@/lib/0g/network';
import type { NetworkType } from '@/app/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

const isAddress = (w: unknown): w is string =>
  typeof w === 'string' && /^0x[a-fA-F0-9]{40}$/.test(w);

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

function resolveSponsorKey(): { key?: string; source: string; debug: Record<string, unknown> } {
  const sponsorFromEnv = process.env.ENGRAM_SPONSOR_KEY;
  const sponsorFromFile = readEnvFileValue('ENGRAM_SPONSOR_KEY');
  const privateFromEnv = process.env.NODE_ENV !== 'production' ? process.env.PRIVATE_KEY : undefined;
  const privateFromFile = process.env.NODE_ENV !== 'production' ? readEnvFileValue('PRIVATE_KEY') : undefined;

  const debug = {
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
    hasProcessSponsor: !!sponsorFromEnv,
    hasFileSponsor: !!sponsorFromFile,
    hasProcessPrivateKey: !!privateFromEnv,
    hasFilePrivateKey: !!privateFromFile,
    envLocalExists: existsSync(join(process.cwd(), '.env.local')),
    envExists: existsSync(join(process.cwd(), '.env')),
  };

  if (sponsorFromEnv) return { key: sponsorFromEnv, source: 'process.env.ENGRAM_SPONSOR_KEY', debug };
  if (sponsorFromFile) return { key: sponsorFromFile, source: 'file:ENGRAM_SPONSOR_KEY', debug };
  if (privateFromEnv) return { key: privateFromEnv, source: 'process.env.PRIVATE_KEY (local fallback)', debug };
  if (privateFromFile) return { key: privateFromFile, source: 'file:PRIVATE_KEY (local fallback)', debug };
  return { source: 'none', debug };
}

export async function POST(req: Request) {
  const { key, source, debug } = resolveSponsorKey();
  console.log('[api/save] sponsor key resolution', { source, ...debug });
  if (!key) {
    return NextResponse.json(
      {
        error: 'Storage is not configured on the server (missing ENGRAM_SPONSOR_KEY; localhost may fall back to PRIVATE_KEY).',
        debug: { source, ...debug },
      },
      { status: 503 }
    );
  }

  let body: { walletAddress?: string; networkType?: string; bundle?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { walletAddress, networkType, bundle } = body;
  if (!isAddress(walletAddress)) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  if (!bundle || typeof bundle !== 'object') return NextResponse.json({ error: 'Missing bundle.' }, { status: 400 });

  const net = getNetworkConfig((networkType as NetworkType) || 'turbo');
  const world = (bundle as any)?.world;
  console.log('[api/save] request', {
    walletAddress,
    networkType: net.name,
    keySource: source,
    hasWorld: !!world,
    buildings: Array.isArray(world?.buildings) ? world.buildings.length : 0,
    choppedTrees: Array.isArray(world?.choppedTrees) ? world.choppedTrees.length : 0,
  });

  try {
    // Serialize the bundle and run it through the same merkle pipeline to get the
    // content-addressed rootHash the client will use to read it back.
    const json = JSON.stringify(bundle);
    const file = new File([json], `engram_${walletAddress.toLowerCase()}.json`, { type: 'application/json' });
    const blob = createBlob(file);

    const [tree, treeErr] = await generateMerkleTree(blob);
    if (!tree) throw new Error(`Merkle tree failed: ${treeErr?.message}`);
    const [rootHash, hashErr] = getRootHash(tree);
    if (!rootHash) throw new Error(`Root hash failed: ${hashErr?.message}`);

    // Sponsor signer + legacy gasPrice (0G Chain has no EIP-1559).
    const provider = new JsonRpcProvider(net.l1Rpc);
    const wallet = new Wallet(key, provider);

    // The #1 cause of "Failed to submit transaction" is the sponsor wallet having
    // no testnet OG. Check up front and return an actionable message (with the
    // address, so a key/account mismatch is obvious too).
    const balance = await provider.getBalance(wallet.address).catch(() => null);
    console.log('[api/save] sponsor wallet', {
      address: wallet.address,
      balance: balance?.toString() ?? 'unknown',
      keySource: source,
    });
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
      // SDK falls back to its own gas handling.
    }

    const [txHash, uploadErr] = await uploadToStorage(blob, net.storageRpc, net.l1Rpc, wallet, gasPrice);
    if (uploadErr) throw uploadErr;

    console.log('[api/save] uploaded to 0G', { rootHash, txHash: txHash || rootHash });
    return NextResponse.json({ rootHash, txHash: txHash || rootHash });
  } catch (err) {
    console.error('[api/save]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
