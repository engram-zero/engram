// Minimal Ethereum wallet connect via EIP-1193 (MetaMask et al.). The wallet
// address is the player's identity for the whole game. If no wallet extension
// is present, we fall back to a deterministic demo address so the experience is
// still playable — clearly flagged in the UI.
const DEMO_KEY = "engram:demo-wallet";

export function hasInjectedWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet() {
  if (hasInjectedWallet()) {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts && accounts[0]) return { address: accounts[0], demo: false };
  }
  return { address: getDemoAddress(), demo: true };
}

export async function silentWallet() {
  if (hasInjectedWallet()) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts && accounts[0]) return { address: accounts[0], demo: false };
    } catch {
      /* ignore */
    }
  }
  return null;
}

function getDemoAddress() {
  let addr = localStorage.getItem(DEMO_KEY);
  if (!addr) {
    const hex = Array.from({ length: 40 }, () =>
      "0123456789abcdef"[Math.floor(Math.random() * 16)]
    ).join("");
    addr = `0x${hex}`;
    localStorage.setItem(DEMO_KEY, addr);
  }
  return addr;
}

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
