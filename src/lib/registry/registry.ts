'use client';

import { Contract, JsonRpcProvider, ZeroHash, getAddress, isAddress, isHexString } from 'ethers';
import { getProvider, getSigner } from '@/lib/0g/fees';
import { ENGRAM_REGISTRY_ABI } from './abi';

const DEFAULT_REGISTRY_ADDRESS = '0xD142048BcA7fC224d557C12F8adbAc70D4EC4067';
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_ENGRAM_REGISTRY || DEFAULT_REGISTRY_ADDRESS;

export function getRegistryAddress(): string | null {
  return isAddress(REGISTRY_ADDRESS) ? getAddress(REGISTRY_ADDRESS) : null;
}

function assertBytes32Root(root: string): string {
  if (!isHexString(root, 32)) {
    throw new Error(`Invalid MemoryBundle rootHash for registry: ${root}`);
  }
  return root;
}

export async function readRootOnchain(wallet: string, l1Rpc: string): Promise<string | null> {
  const registry = getRegistryAddress();
  if (!registry) return null;

  try {
    const provider = new JsonRpcProvider(l1Rpc);
    const contract = new Contract(registry, ENGRAM_REGISTRY_ABI, provider);
    const root = (await contract.rootOf(wallet)) as string;
    return root === ZeroHash ? null : root;
  } catch (error) {
    console.warn('[engram] registry root read failed:', error);
    return null;
  }
}

export async function writeRootOnchain(
  wallet: string,
  root: string
): Promise<{ txHash: string }> {
  const registry = getRegistryAddress();
  if (!registry) {
    throw new Error('NEXT_PUBLIC_ENGRAM_REGISTRY is not configured');
  }

  const [provider, providerErr] = await getProvider();
  if (!provider) throw new Error(`Provider error: ${providerErr?.message}`);

  const [signer, signerErr] = await getSigner(provider);
  if (!signer) throw new Error(`Signer error: ${signerErr?.message}`);

  const signerAddress = getAddress(await signer.getAddress());
  if (signerAddress !== getAddress(wallet)) {
    throw new Error(`Connected wallet ${signerAddress} cannot anchor memory for ${wallet}`);
  }

  const contract = new Contract(registry, ENGRAM_REGISTRY_ABI, signer);
  const tx = await contract.setRoot(assertBytes32Root(root));
  await tx.wait();
  return { txHash: tx.hash };
}
