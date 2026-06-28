// One-time (admin) funding for 0G Compute, so /api/mine can run real inference.
//
//   npm run fund:compute
//
// Requires ENGRAM_SPONSOR_KEY (or PRIVATE_KEY) in .env, funded with testnet OG
// from faucet.0g.ai (the ledger needs ≥3 OG; 1 OG is locked per provider).
// After this runs successfully, set ENGRAM_COMPUTE=1 to enable the mining
// receipts. This script is NOT verified end-to-end here (no funded account was
// available at authoring time) — run it against a funded testnet wallet and
// adjust amounts/gas if the network rejects a tx (0G Chain has no EIP-1559).

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JsonRpcProvider, Wallet, formatEther } from 'ethers';
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk';

// 0G Chain has no EIP-1559 — letting ethers build a fee-market tx makes the RPC
// reject it (eth_maxPriorityFeePerGas → -32601). Fetch a legacy gasPrice and pass
// it explicitly to every on-chain SDK call. Returns undefined if it can't be read
// (then the SDK falls back to its own logic).
async function legacyGasPrice(provider: JsonRpcProvider): Promise<number | undefined> {
  try {
    const hex: string = await provider.send('eth_gasPrice', []);
    const bumped = (BigInt(hex) * BigInt(12)) / BigInt(10); // +20% headroom; testnet gas is tiny
    const n = Number(bumped);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

const LEDGER_OG = Number(process.env.ENGRAM_COMPUTE_LEDGER_OG || 3); // ≥3 to create
const PROVIDER_OG = Number(process.env.ENGRAM_COMPUTE_PROVIDER_OG || 1); // ≥1 per provider

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env.local'));
  loadEnvFile(resolve(process.cwd(), '.env'));

  const key = process.env.ENGRAM_SPONSOR_KEY || process.env.PRIVATE_KEY;
  if (!key) throw new Error('Set ENGRAM_SPONSOR_KEY (or PRIVATE_KEY) in .env');
  const rpc = process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai';

  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(key, provider);
  console.log('[fund-compute] sponsor:', wallet.address, '· rpc:', rpc);

  // Confirm the wallet you funded at the faucet is THIS one, with enough OG.
  const balance = await provider.getBalance(wallet.address);
  const needed = LEDGER_OG + PROVIDER_OG;
  console.log(`[fund-compute] wallet balance: ${formatEther(balance)} OG (need ≳ ${needed})`);
  if (balance < BigInt(needed) * BigInt(10) ** BigInt(18)) {
    console.warn(`[fund-compute] ⚠ balance looks low — top up at faucet.0g.ai (≥ ${needed} OG) or the txs may fail.`);
  }

  const gasPrice = await legacyGasPrice(provider);
  console.log('[fund-compute] legacy gasPrice:', gasPrice ?? '(SDK default)');

  const broker = await createZGComputeNetworkBroker(wallet);

  // Ensure a ledger exists and holds enough balance.
  try {
    const ledger = await broker.ledger.getLedger();
    console.log('[fund-compute] existing ledger:', ledger?.toString?.() ?? ledger);
    await broker.ledger.depositFund(LEDGER_OG, gasPrice);
    console.log(`[fund-compute] deposited ${LEDGER_OG} OG into the ledger.`);
  } catch {
    await broker.ledger.addLedger(LEDGER_OG, gasPrice);
    console.log(`[fund-compute] created ledger with ${LEDGER_OG} OG.`);
  }

  // Pick a chatbot provider and lock funds in its inference sub-account.
  const services = await broker.inference.listService();
  const svc = services.find((s: any) => String(s.serviceType).toLowerCase() === 'chatbot') ?? services[0];
  if (!svc) throw new Error('No inference providers available on the network.');
  const providerAddress: string = svc.provider;
  console.log('[fund-compute] provider:', providerAddress, '· model:', svc.model);

  await broker.ledger.transferFund(providerAddress, 'inference', BigInt(PROVIDER_OG) * BigInt(10) ** BigInt(18), gasPrice);
  console.log(`[fund-compute] transferred ${PROVIDER_OG} OG to provider inference sub-account.`);

  console.log('[fund-compute] done. Now set ENGRAM_COMPUTE=1 and NEXT_PUBLIC_ENGRAM_COMPUTE=1, then test.');
}

main().catch((e) => {
  console.error('[fund-compute] failed:', e);
  process.exit(1);
});
