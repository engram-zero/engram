export const PARCEL_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'parcelId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'parcels',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'dataRoot', type: 'bytes32' },
      { name: 'pricePaid', type: 'uint96' },
      { name: 'commissionBps', type: 'uint16' },
      { name: 'updatedAt', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'payable',
    inputs: [
      { name: 'parcelId', type: 'bytes32' },
      { name: 'dataRoot', type: 'bytes32' },
      { name: 'commissionBps', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateData',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parcelId', type: 'bytes32' },
      { name: 'dataRoot', type: 'bytes32' },
      { name: 'commissionBps', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ParcelClaimed',
    anonymous: false,
    inputs: [
      { name: 'parcelId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'dataRoot', type: 'bytes32', indexed: false },
      { name: 'pricePaid', type: 'uint256', indexed: false },
      { name: 'commissionBps', type: 'uint16', indexed: false },
      { name: 'at', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ParcelDataUpdated',
    anonymous: false,
    inputs: [
      { name: 'parcelId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'dataRoot', type: 'bytes32', indexed: false },
      { name: 'commissionBps', type: 'uint16', indexed: false },
      { name: 'at', type: 'uint64', indexed: false },
    ],
  },
] as const;
