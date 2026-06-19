'use client';

import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { WagmiConfig, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config/wagmi';
import { AudioProvider } from '@/context/AudioContext';
import { WalletProvider } from '@/context/WalletContext';

// Suppress hydration-related console errors
if (typeof window !== 'undefined') {
  // Save original console.error
  const originalConsoleError = console.error;
  
  // Override console.error to filter out hydration warnings
  console.error = function(...args) {
    // Check if this is a hydration error
    const isHydrationError = 
      args.some(arg => 
        typeof arg === 'string' && (
          arg.includes('hydration') || 
          arg.includes('Hydrate') ||
          arg.includes('text content did not match') || 
          arg.includes('Hydration failed')
        )
      );
    
    // Only log non-hydration errors to the console
    if (!isHydrationError) {
      originalConsoleError.apply(console, args);
    }
  };
}

// Network context to share network state across components
export type NetworkType = 'standard' | 'turbo';

interface NetworkContextType {
  networkType: NetworkType;
  setNetworkType: React.Dispatch<React.SetStateAction<NetworkType>>;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

// Create a client
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // Use a default value for initial render to prevent hydration mismatch.
  // Default to Turbo: the Standard testnet storage indexer is deprecated and
  // returns 503, while Turbo is the endpoint 0G currently recommends.
  const [networkType, setNetworkType] = useState<NetworkType>('turbo');
  const initialized = useRef(false);
  const [mounted, setMounted] = useState(false);

  // Mark component as mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize network type after mount to avoid hydration issues
  useEffect(() => {
    if (initialized.current) return;
    
    // Delay initialization to ensure we're past hydration phase
    const timer = setTimeout(() => {
      // Default to Turbo; honor a saved preference, or an explicit
      // NEXT_PUBLIC_DEFAULT_NETWORK=standard override.
      let initialNetwork: NetworkType = 'turbo';

      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('networkType');
        if (saved === 'standard' || saved === 'turbo') {
          initialNetwork = saved;
        } else if (process.env.NEXT_PUBLIC_DEFAULT_NETWORK === 'standard') {
          initialNetwork = 'standard';
        }

        // Only update state if different from the initial render value.
        if (initialNetwork !== 'turbo') {
          console.log(`[Providers] Setting initial network to ${initialNetwork} after hydration`);
          setNetworkType(initialNetwork);
        }
      }
      
      initialized.current = true;
    }, 100); // Short delay to ensure we're past hydration
    
    return () => clearTimeout(timer);
  }, []);

  // Save network preference when it changes
  useEffect(() => {
    // Skip during first render and before initialization
    if (!initialized.current || !mounted) return;
    
    if (typeof window !== 'undefined') {
      console.log(`[Providers] Saving network preference: ${networkType}`);
      localStorage.setItem('networkType', networkType);
    }
  }, [networkType, mounted]);

  // Use a consistent config during server-side rendering
  const safeConfig = React.useMemo(() => config, []);

  return (
    <WagmiConfig config={safeConfig}>
      <QueryClientProvider client={queryClient}>
        <NetworkContext.Provider value={{ networkType, setNetworkType }}>
          {/* This loading approach helps prevent hydration mismatches */}
          {!mounted ? (
            // You can render a minimal loading state here if needed
            <div className="min-h-screen" />
          ) : (
            <AudioProvider>
              <WalletProvider>
                {children}
              </WalletProvider>
            </AudioProvider>
          )}
        </NetworkContext.Provider>
      </QueryClientProvider>
    </WagmiConfig>
  );
} 
