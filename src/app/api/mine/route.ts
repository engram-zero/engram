// ─── /api/mine ──────────────────────────────────────────────────────────────
// "Proof-of-useful-work" mining (Prompt 20): when the player exhausts a rock,
// the server runs a REAL, verifiable inference job on the 0G Compute Network and
// verifies the provider's TEE signature. The stone is still granted client-side;
// this endpoint returns a verifiable RECEIPT that the batch's work ran on 0G.
//
// Honest contract:
//   - { verified: true,  chatID, provider, model }  → a real 0G Compute inference
//     ran AND its TEE signature verified. Only then may the UI claim "verified on
//     0G Compute".
//   - { verified: false, reason }                   → compute disabled/unfunded/
//     unavailable. Mining still works locally; the UI must say so, not pretend.
//
// Gated by ENGRAM_COMPUTE='1' (server) — default OFF, so main behaves exactly as
// before until a funded 0G Compute ledger is wired (see scripts/fund-compute.ts).
// The 0G Compute SDK is a Node SDK; this route runs on the Node.js runtime.

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { debugWarn } from '@/lib/debug-log';
import { reserve } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const COMPUTE_ENABLED = process.env.ENGRAM_COMPUTE === '1';
const RPC = process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai';
const SPONSOR_KEY = process.env.ENGRAM_SPONSOR_KEY || process.env.PRIVATE_KEY;

const isAddress = (w: unknown): w is string =>
  typeof w === 'string' && /^0x[a-fA-F0-9]{40}$/.test(w);

// 0G Chain has no EIP-1559: pass an explicit legacy gasPrice to on-chain SDK calls
// so ethers doesn't build a fee-market tx the RPC rejects (-32601). Undefined → SDK default.
async function legacyGasPrice(): Promise<number | undefined> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    const hex: string = await provider.send('eth_gasPrice', []);
    const bumped = (BigInt(hex) * BigInt(12)) / BigInt(10);
    const n = Number(bumped);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Lazily build the broker once per server instance (SDK import is dynamic so it
// never loads unless compute is actually enabled).
let brokerPromise: Promise<any> | null = null;
function getBroker(): Promise<any> {
  if (!brokerPromise) {
    brokerPromise = (async () => {
      const { createZGComputeNetworkBroker } = await import('@0gfoundation/0g-compute-ts-sdk');
      const provider = new ethers.JsonRpcProvider(RPC);
      const wallet = new ethers.Wallet(SPONSOR_KEY!, provider);
      return createZGComputeNetworkBroker(wallet);
    })().catch((e) => {
      brokerPromise = null; // allow a later retry if init failed
      throw e;
    });
  }
  return brokerPromise;
}

export async function POST(req: Request) {
  let body: { walletAddress?: string };
  try {
    body = (await req.json()) as { walletAddress?: string };
  } catch {
    return NextResponse.json({ verified: false, reason: 'bad-request' }, { status: 400 });
  }
  if (!isAddress(body.walletAddress)) {
    return NextResponse.json({ verified: false, reason: 'bad-wallet' }, { status: 400 });
  }

  // Heavy rate-limit: real inference spends testnet OG. A blocked call is a no-op.
  const rl = reserve([`mine:w:${body.walletAddress.toLowerCase()}`, `mine:ip:${clientIp(req)}`]);
  if (!rl.ok) {
    return NextResponse.json({ verified: false, reason: 'rate-limited', retryAfter: rl.retryAfter }, { status: 429 });
  }

  if (!COMPUTE_ENABLED || !SPONSOR_KEY) {
    return NextResponse.json({ verified: false, reason: 'compute-disabled' });
  }

  try {
    const broker = await getBroker();
    const services = await broker.inference.listService();
    const svc =
      services.find((s: any) => String(s.serviceType).toLowerCase() === 'chatbot') ?? services[0];
    if (!svc) return NextResponse.json({ verified: false, reason: 'no-provider' });
    const providerAddress: string = svc.provider;

    // Acknowledge the provider's signer once (no-op if already acknowledged).
    // This is the on-chain tx in this flow, so pass a legacy gasPrice.
    try {
      const gasPrice = await legacyGasPrice();
      await broker.inference.acknowledgeProviderSigner(providerAddress, gasPrice);
    } catch {
      // already acknowledged or non-fatal — proceed
    }

    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
    const headers = await broker.inference.getRequestHeaders(providerAddress);

    // The "useful work": a tiny inference. Keep it minimal to bound cost/latency.
    const messages = [{ role: 'user', content: 'Aldenmoor mining ledger: reply with a single word.' }];
    const r = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ messages, model }),
    });
    const data = await r.json().catch(() => ({} as any));
    const chatID = r.headers.get('ZG-Res-Key') || data?.id;

    let verified = false;
    if (chatID) {
      try {
        verified = (await broker.inference.processResponse(providerAddress, chatID)) === true;
      } catch {
        verified = false;
      }
    }

    return NextResponse.json({ verified, chatID: chatID ?? null, provider: providerAddress, model });
  } catch (err) {
    // Any failure degrades gracefully: the game already granted the stone locally.
    debugWarn('[api/mine] compute failed:', err);
    return NextResponse.json({ verified: false, reason: err instanceof Error ? err.message : 'compute-error' });
  }
}
