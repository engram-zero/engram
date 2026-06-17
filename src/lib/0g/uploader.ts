import { Indexer, Blob } from '@0glabs/0g-ts-sdk';
import { Contract } from 'ethers';

/**
 * Submits a transaction to the flow contract
 * @param flowContract The flow contract
 * @param submission The submission object
 * @param value The value to send with the transaction
 * @returns A promise that resolves to the transaction result and any error
 */
export async function submitTransaction(
  flowContract: Contract,
  submission: any,
  value: bigint,
  gasPrice?: bigint
): Promise<[any | null, Error | null]> {
  try {
    // 0G reports EIP-1559 block fields but its RPC lacks
    // eth_maxPriorityFeePerGas. Force a legacy (type-0) tx with an explicit
    // gasPrice AND gasLimit so neither ethers nor MetaMask run any pre-flight
    // fee/gas estimation — that probing hits the missing method and fails with
    // -32601 / -32603 BEFORE the wallet even prompts (no popup, instant error).
    const overrides: { value: bigint; gasPrice?: bigint; gasLimit?: bigint } = { value };

    let gp = gasPrice;
    if (gp === undefined) {
      try {
        const provider = (flowContract.runner as unknown as { provider?: { send: (m: string, p: unknown[]) => Promise<string> } })?.provider;
        if (provider) gp = BigInt(await provider.send('eth_gasPrice', []));
      } catch {
        // leave undefined — wallet decides
      }
    }
    if (gp) overrides.gasPrice = gp;

    // Pre-set the gasLimit ourselves so ethers doesn't call eth_estimateGas in a
    // way that re-triggers the fee probing. Estimate if we can, else a safe cap.
    try {
      const est = await flowContract.submit.estimateGas(submission, gp ? { value, gasPrice: gp } : { value });
      overrides.gasLimit = (est * BigInt(12)) / BigInt(10);
    } catch {
      overrides.gasLimit = BigInt(3000000);
    }

    const tx = await flowContract.submit(submission, overrides);
    const receipt = await tx.wait();
    return [{ tx, receipt }, null];
  } catch (error) {
    // Surface the real revert/RPC reason instead of a generic message.
    const e = error as { reason?: string; shortMessage?: string; info?: { error?: { message?: string } }; message?: string };
    const msg = e.reason || e.info?.error?.message || e.shortMessage || e.message || String(error);
    return [null, new Error(msg)];
  }
}

/**
 * Uploads a file to 0G storage
 * @param blob The blob to upload
 * @param storageRpc The storage RPC URL
 * @param l1Rpc The L1 RPC URL
 * @param signer The signer
 * @returns A promise that resolves to a success flag and any error
 */
export async function uploadToStorage(
  blob: Blob,
  storageRpc: string,
  l1Rpc: string,
  signer: any,
  gasPrice?: bigint
): Promise<[boolean, Error | null]> {
  try {
    const indexer = new Indexer(storageRpc);

    const uploadOptions = {
      taskSize: 10,
      expectedReplica: 1,
      finalityRequired: true,
      tags: '0x',
      skipTx: false,
      fee: BigInt(0)
    };

    // Force the SDK's internal flow tx to legacy gas too (same 0G no-EIP-1559
    // issue). The 6th arg is TransactionOptions { gasPrice, gasLimit }.
    const txOpts = gasPrice ? { gasPrice } : undefined;
    await indexer.upload(blob, l1Rpc, signer, uploadOptions, undefined, txOpts);
    return [true, null];
  } catch (error) {
    return [false, error instanceof Error ? error : new Error(String(error))];
  }
} 