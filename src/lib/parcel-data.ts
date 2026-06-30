import type { NetworkType } from '@/app/providers';
import { debugWarn } from '@/lib/debug-log';
import type { ParcelClaim } from '@/lib/types';

export interface SaveParcelDataResult {
  rootHash: string | null;
  txHash: string | null;
  parcel: ParcelClaim;
  storageStatus?: 'uploaded' | 'pending';
  message?: string;
}

function pendingParcelResult(parcel: ParcelClaim, message: string): SaveParcelDataResult {
  return {
    rootHash: null,
    txHash: null,
    parcel: { ...parcel, dataRoot: null, dataTxHash: null },
    storageStatus: 'pending',
    message,
  };
}

export async function saveParcelData(
  walletAddress: string,
  networkType: NetworkType,
  parcel: ParcelClaim
): Promise<SaveParcelDataResult> {
  let res: Response;
  try {
    res = await fetch('/api/parcel-save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ walletAddress, networkType, parcel }),
    });
  } catch (error) {
    debugWarn('[engram] parcel metadata upload request failed; continuing claim without dataRoot:', error);
    return pendingParcelResult(
      parcel,
      '0G Storage is temporarily unreachable. The parcel claim can continue; metadata upload is pending.'
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 500) {
      debugWarn('[engram] parcel metadata upload failed; continuing claim without dataRoot:', data?.error);
      return pendingParcelResult(
        parcel,
        typeof data?.error === 'string'
          ? `0G Storage is temporarily unavailable (${data.error}). The parcel claim can continue; metadata upload is pending.`
          : '0G Storage is temporarily unavailable. The parcel claim can continue; metadata upload is pending.'
      );
    }
    throw new Error(typeof data?.error === 'string' ? data.error : 'Parcel metadata could not be prepared.');
  }

  const storageStatus = data?.storageStatus === 'pending' ? 'pending' : 'uploaded';
  if (storageStatus === 'pending' && data?.parcel && typeof data.parcel === 'object') {
    return {
      rootHash: typeof data.rootHash === 'string' ? data.rootHash : null,
      txHash: typeof data.txHash === 'string' ? data.txHash : null,
      parcel: data.parcel as ParcelClaim,
      storageStatus,
      message: typeof data.message === 'string'
        ? data.message
        : '0G Storage is temporarily unavailable. The parcel claim can continue; metadata upload is pending.',
    };
  }

  if (
    typeof data?.rootHash !== 'string' ||
    typeof data?.txHash !== 'string' ||
    !data?.parcel ||
    typeof data.parcel !== 'object'
  ) {
    throw new Error('Parcel data upload returned an invalid response.');
  }

  return {
    rootHash: data.rootHash,
    txHash: data.txHash,
    parcel: data.parcel as ParcelClaim,
    storageStatus,
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}
