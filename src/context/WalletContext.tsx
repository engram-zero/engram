import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useBalance } from 'wagmi';
import { zgTestnet } from '@/config';

// Types for our wallet context
interface WalletContextType {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isHydrated: boolean;
  connectError: string | null;
  walletHelp: string | null;
  balance: {
    formatted: string | undefined;
    symbol: string | undefined;
    loading: boolean;
  };
  connect: () => Promise<void>;
  clearConnectError: () => void;
}

// Create the context with a default value
const WalletContext = createContext<WalletContextType>({
  address: undefined,
  isConnected: false,
  isConnecting: false,
  isHydrated: false,
  connectError: null,
  walletHelp: null,
  balance: {
    formatted: undefined,
    symbol: undefined,
    loading: true,
  },
  connect: async () => {},
  clearConnectError: () => {},
});

// Hook to use the wallet context
export const useWalletContext = () => useContext(WalletContext);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const { address, isConnected, isConnecting } = useAccount();
  const { connectAsync: wagmiConnect, connectors } = useConnect();

  const shouldFetchBalance = isHydrated && isConnected && !!address;
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance(
    shouldFetchBalance 
      ? {
          address,
          chainId: zgTestnet.id,
        }
      : { address: undefined }
  );
  
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isTouchDevice = useMemo(() => {
    if (!isHydrated || typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }, [isHydrated]);

  const walletHelp = useMemo(() => {
    const hasWalletConnect = connectors.some((connector) => connector.id === 'walletConnect');
    if (hasWalletConnect && process.env.NEXT_PUBLIC_PROJECT_ID) return null;
    return 'Si estás en celular, abre esta página dentro del navegador de MetaMask/Rabby o configura WalletConnect.';
  }, [connectors]);

  useEffect(() => {
    if (isConnected) {
      setConnectError(null);
    }
  }, [isConnected]);

  const clearConnectError = () => setConnectError(null);

  const connect = async () => {
    if (!isHydrated) return;

    setConnectError(null);

    const preferredConnector = isTouchDevice
      ? connectors.find((connector) => connector.id === 'walletConnect') ??
        connectors.find((connector) => connector.id === 'metaMask') ??
        connectors.find((connector) => connector.id === 'injected')
      : connectors.find((connector) => connector.id === 'metaMask') ??
        connectors.find((connector) => connector.id === 'injected') ??
        connectors.find((connector) => connector.id === 'walletConnect');

    if (!preferredConnector) {
      setConnectError('No encontré un conector de wallet disponible en este dispositivo.');
      return;
    }

    try {
      await wagmiConnect({ connector: preferredConnector });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'La conexión con la wallet falló.';
      setConnectError(message);
    }
  };

  const walletContextValue: WalletContextType = {
    address,
    isConnected: isHydrated ? isConnected : false,
    isConnecting: isHydrated ? isConnecting : false,
    isHydrated,
    connectError,
    walletHelp,
    balance: {
      formatted: balanceData?.formatted,
      symbol: balanceData?.symbol,
      loading: isBalanceLoading,
    },
    connect,
    clearConnectError,
  };
  
  return (
    <WalletContext.Provider value={walletContextValue}>
      {children}
    </WalletContext.Provider>
  );
}; 
