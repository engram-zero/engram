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
  value: bigint
): Promise<[any | null, Error | null]> {
  try {
    // 0G Chain is a legacy (non-EIP-1559) chain. Without an explicit gasPrice,
    // ethers/MetaMask try the EIP-1559 path and call eth_maxPriorityFeePerGas,
    // which the RPC doesn't implement (-32601) → the tx fails with an Internal
    // JSON-RPC error (-32603). Fetch the legacy gasPrice and pass it so the tx
    // is built as type-0 and skips the priority-fee call entirely.
    const overrides: { value: bigint; gasPrice?: bigint } = { value };
    try {
      const provider = (flowContract.runner as { provider?: { getFeeData: () => Promise<{ gasPrice: bigint | null }> } })?.provider;
      const feeData = provider ? await provider.getFeeData() : null;
      if (feeData?.gasPrice) overrides.gasPrice = feeData.gasPrice;
    } catch {
      // No gasPrice available — fall through and let the wallet decide.
    }

    const tx = await flowContract.submit(submission, overrides);
    const receipt = await tx.wait();
    return [{ tx, receipt }, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
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
  signer: any
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
    
    await indexer.upload(blob, l1Rpc, signer, uploadOptions);
    return [true, null];
  } catch (error) {
    return [false, error instanceof Error ? error : new Error(String(error))];
  }
} 