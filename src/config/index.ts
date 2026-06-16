import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

// Define the zgTestnet chain
export const zgTestnet = {
  id: 16602,
  name: '0G Galileo Testnet',
  network: '0g-galileo-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'OG',
    symbol: 'OG',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai'],
    },
  },
} as const;

export const config = createConfig({
  chains: [zgTestnet],
  connectors: [
    injected({
      target: 'metaMask',
    }),
  ],
  transports: {
    [zgTestnet.id]: http(zgTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
