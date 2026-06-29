import type { NetworkType } from '@/app/providers';
import type { ParcelClaim } from '@/lib/types';

export async function saveParcelData(
  walletAddress: string,
  networkType: NetworkType,
  parcel: ParcelClaim
): Promise<{ rootHash: string; txHash: string; parcel: ParcelClaim }> {
  const res = await fetch('/api/parcel-save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ walletAddress, networkType, parcel }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Parcel data upload failed.');
  }

  if (
    typeof data?.rootHash !== 'string' ||
    typeof data?.txHash !== 'string' ||
    !data?.parcel ||
    typeof data.parcel !== 'object'
  ) {
    throw new Error('Parcel data upload returned an invalid response.');
  }

  return data as { rootHash: string; txHash: string; parcel: ParcelClaim };
}
