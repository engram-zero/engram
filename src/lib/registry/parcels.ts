'use client';

import { Contract, JsonRpcProvider, ZeroAddress, ZeroHash, encodeBytes32String, getAddress, isAddress } from 'ethers';
import { getProvider, getSigner } from '@/lib/0g/fees';
import { debugWarn } from '@/lib/debug-log';
import { PARCEL_REGISTRY_ABI } from './parcel-abi';

const ZG_GALILEO_CHAIN_ID_HEX = '0x40da';
const DEFAULT_PARCEL_REGISTRY_ADDRESS = '0x11D2EB42d0BF30947EB36882A150ee25518f67d7';
const PARCEL_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_PARCEL_REGISTRY || DEFAULT_PARCEL_REGISTRY_ADDRESS;

export function getParcelRegistryAddress(): string | null {
  return isAddress(PARCEL_REGISTRY_ADDRESS) ? getAddress(PARCEL_REGISTRY_ADDRESS) : null;
}

export function parcelIdToBytes32(parcelId: string): string {
  return encodeBytes32String(parcelId.slice(0, 31));
}

function normalizeDataRoot(dataRoot?: string | null): string {
  if (!dataRoot) return ZeroHash;
  if (!/^0x[a-fA-F0-9]{64}$/.test(dataRoot)) throw new Error('Invalid parcel data root.');
  return dataRoot;
}

async function ensureGalileoChain() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('No Ethereum provider found');

  const chainId = await ethereum.request({ method: 'eth_chainId' });
  if (chainId === ZG_GALILEO_CHAIN_ID_HEX) return;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ZG_GALILEO_CHAIN_ID_HEX }],
    });
  } catch (switchError: any) {
    if (switchError?.code !== 4902) throw switchError;

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: ZG_GALILEO_CHAIN_ID_HEX,
        chainName: '0G Galileo Testnet',
        nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
        rpcUrls: [process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai'],
        blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
      }],
    });
  }
}

async function getLegacyGasPrice(provider: any): Promise<bigint | undefined> {
  try {
    return BigInt(await provider.send('eth_gasPrice', []));
  } catch {
    return undefined;
  }
}

export async function readParcelOwnerOnchain(parcelId: string, l1Rpc: string): Promise<string | null> {
  const registry = getParcelRegistryAddress();
  if (!registry) return null;

  try {
    const provider = new JsonRpcProvider(l1Rpc);
    const contract = new Contract(registry, PARCEL_REGISTRY_ABI, provider);
    const owner = String(await contract.ownerOf(parcelIdToBytes32(parcelId)));
    return owner === ZeroAddress ? null : getAddress(owner);
  } catch (error) {
    debugWarn('[engram] parcel owner read failed:', error);
    return null;
  }
}

export async function claimParcelOnchain(
  wallet: string,
  parcelId: string,
  commissionBps: number,
  valueWei: bigint = BigInt(0),
  dataRoot?: string | null
): Promise<{ txHash: string } | null> {
  const registry = getParcelRegistryAddress();
  if (!registry) return null;

  await ensureGalileoChain();

  const [provider, providerErr] = await getProvider();
  if (!provider) throw new Error(`Provider error: ${providerErr?.message}`);

  const [signer, signerErr] = await getSigner(provider);
  if (!signer) throw new Error(`Signer error: ${signerErr?.message}`);

  const signerAddress = getAddress(await signer.getAddress());
  if (signerAddress !== getAddress(wallet)) {
    throw new Error(`Connected wallet ${signerAddress} cannot claim parcel for ${wallet}`);
  }

  const contract = new Contract(registry, PARCEL_REGISTRY_ABI, signer);
  const tx = await contract.claim(parcelIdToBytes32(parcelId), normalizeDataRoot(dataRoot), commissionBps, {
    value: valueWei,
    gasPrice: await getLegacyGasPrice(provider),
    gasLimit: BigInt(180000),
  });
  await tx.wait();
  return { txHash: tx.hash };
}

export async function updateParcelDataOnchain(
  wallet: string,
  parcelId: string,
  dataRoot: string,
  commissionBps: number
): Promise<{ txHash: string } | null> {
  const registry = getParcelRegistryAddress();
  if (!registry) return null;

  await ensureGalileoChain();

  const [provider, providerErr] = await getProvider();
  if (!provider) throw new Error(`Provider error: ${providerErr?.message}`);

  const [signer, signerErr] = await getSigner(provider);
  if (!signer) throw new Error(`Signer error: ${signerErr?.message}`);

  const signerAddress = getAddress(await signer.getAddress());
  if (signerAddress !== getAddress(wallet)) {
    throw new Error(`Connected wallet ${signerAddress} cannot update parcel data for ${wallet}`);
  }

  const contract = new Contract(registry, PARCEL_REGISTRY_ABI, signer);
  const tx = await contract.updateData(parcelIdToBytes32(parcelId), normalizeDataRoot(dataRoot), commissionBps, {
    gasPrice: await getLegacyGasPrice(provider),
    gasLimit: BigInt(160000),
  });
  await tx.wait();
  return { txHash: tx.hash };
}
