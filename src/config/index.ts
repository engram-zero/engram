import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect is what lets a phone's MetaMask/Rabby APP connect (deeplink/QR)
// when there's no injected wallet in the mobile browser. Needs a project id from
// https://cloud.reown.com (WalletConnect Cloud), set as NEXT_PUBLIC_PROJECT_ID.
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

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
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
            metadata: {
              name: 'Engram · Aldenmoor',
              description: 'NPCs that remember you, on 0G.',
              url: 'https://engram-bay.vercel.app',
              icons: ['https://engram-bay.vercel.app/favicon.ico'],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [zgTestnet.id]: http(zgTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
