export const ENGRAM_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'rootOf',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'updatedAt',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'setRoot',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'RootUpdated',
    anonymous: false,
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'root', type: 'bytes32', indexed: false },
      { name: 'at', type: 'uint64', indexed: false },
    ],
  },
] as const;
