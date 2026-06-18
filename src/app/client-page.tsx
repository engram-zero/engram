'use client';

// ─── Engram — Aldenmoor ───────────────────────────────────────────────────────
// The whole game UI. Connect a wallet (your identity), talk to three NPCs, and
// their memory of you persists on 0G Storage. Loop per conversation:
//   readAllMemories (0G) → POST /api/npc (Claude) → ...chat... → writeMemory (0G)
// Memory is written once, when you leave an NPC; the storage write is sponsored
// server-side and the player signs the registry pointer only when the root changes.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Providers, useNetwork } from './providers';
import ConnectButton from '@/components/ConnectButton';
import NetworkToggle from '@/components/NetworkToggle';
import { useWallet } from '@/hooks/useWallet';
import { NPC_LIST } from '@/lib/npcs';
import type { NPCName, NPCMemory } from '@/lib/types';
import { readAllMemories, writeMemory, getBundleRoot } from '@/lib/memory';
import { initWorld, setWorldPersistence } from '@/lib/world';
import { createBundleWorldPersistence } from '@/lib/world-0g';
import { startPublicWorldPolling } from '@/lib/public-world';
import { Portrait } from '@/components/engram/Art';
import dynamic from 'next/dynamic';

// Three.js is client-only and heavy — load it without SSR.
const Scene3D = dynamic(() => import('@/components/engram/Scene3D'), { ssr: false });

const short = (s?: string | null) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '');

interface Scene {
  dialogue: string;
  options: string[];
  loading: boolean;
}
interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  txHash?: string;
  root?: string;
  error?: string;
}

async function chat(
  walletAddress: string,
  npcName: NPCName,
  message: string,
  memory: NPCMemory,
  crossMemory?: Partial<Record<NPCName, NPCMemory>>
) {
  const res = await fetch('/api/npc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, npcName, message, memory, crossMemory }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Dialogue failed.') as ChatError;
    err.code = res.status;
    if (typeof data.retryAfter === 'number') err.retryAfter = data.retryAfter;
    throw err;
  }
  return data as { response: string; options: string[]; memory: NPCMemory; delta: unknown };
}

type ChatError = Error & { code?: number; retryAfter?: number };

function trustColor(t: number) {
  if (t >= 70) return '#5fb86a';
  if (t >= 40) return '#d6b84a';
  return '#cc5a4a';
}

// ─── Game ─────────────────────────────────────────────────────────────────────

function Game() {
  const { address, isConnected } = useWallet();
  const { networkType } = useNetwork();

  const [memories, setMemories] = useState<Record<NPCName, NPCMemory> | null>(null);
  const [active, setActive] = useState<NPCName | null>(null);
  const [scene, setScene] = useState<Scene>({ dialogue: '', options: [], loading: false });
  const [typed, setTyped] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [dirty, setDirty] = useState<Partial<Record<NPCName, boolean>>>({});
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  const [err, setErr] = useState<string | null>(null);
  // "Explore as guest" — roam Aldenmoor without a wallet (no dialogue/saving).
  // The best mobile fallback when there's no injected wallet / WalletConnect.
  const [guest, setGuest] = useState(false);

  // Latest active NPC, readable from inside a delayed retry without stale closure.
  const activeRef = useRef<NPCName | null>(active);
  activeRef.current = active;

  // Load all three memories from 0G when the wallet connects.
  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;
    setMemories(null);
    readAllMemories(address, networkType)
      .then((m) => !cancelled && setMemories(m))
      .catch((e) => !cancelled && setErr(e.message));
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, networkType]);

  // Load the player's world state (resources + chopped trees) for this wallet.
  useEffect(() => {
    if (!isConnected || !address) return;
    setWorldPersistence(createBundleWorldPersistence(networkType));
    initWorld(address).catch(() => {});
    return startPublicWorldPolling(networkType, address);
  }, [address, isConnected, networkType]);

  const crossFor = useCallback(
    (npc: NPCName): Partial<Record<NPCName, NPCMemory>> | undefined => {
      if (npc !== 'sable' || !memories) return undefined;
      return { aldric: memories.aldric, maren: memories.maren };
    },
    [memories]
  );

  async function runTurn(npc: NPCName, message: string, attempt = 0) {
    if (!address || !memories) return;
    setErr(null);
    setScene((s) => ({ ...s, loading: true }));
    try {
      const data = await chat(address, npc, message, memories[npc], crossFor(npc));
      setMemories((prev) => (prev ? { ...prev, [npc]: data.memory } : prev));
      setDirty((d) => ({ ...d, [npc]: true }));
      setScene({ dialogue: data.response, options: data.options, loading: false });
    } catch (e) {
      const error = e as ChatError;
      // Rate limited: be gentle, and auto-retry once for short cool-downs.
      if (error.code === 429) {
        const wait = Math.max(1, error.retryAfter ?? 5);
        if (wait <= 30 && attempt < 1) {
          setScene((s) => ({ ...s, loading: true, dialogue: `${error.message} (retrying in ${wait}s…)` }));
          window.setTimeout(() => {
            if (activeRef.current === npc) runTurn(npc, message, attempt + 1);
          }, wait * 1000);
          return;
        }
        setScene((s) => ({ ...s, loading: false, dialogue: `${error.message} (try again in ~${wait}s)` }));
        return;
      }
      setScene((s) => ({ ...s, loading: false, dialogue: `(${error.message})` }));
    }
  }

  function openDialogue(npc: NPCName) {
    setActive(npc);
    setSave({ status: 'idle' });
    setScene({ dialogue: '', options: [], loading: true });
    runTurn(npc, ''); // empty = approach → NPC greets
  }

  function say(npc: NPCName, message: string) {
    if (!message.trim() || scene.loading) return;
    setTyped('');
    runTurn(npc, message.trim());
  }

  // Leaving an NPC persists that conversation to 0G and anchors the new root if needed.
  async function leave() {
    const npc = active;
    setActive(null);
    setScene({ dialogue: '', options: [], loading: false });
    if (!npc || !address || !memories || !dirty[npc]) return;

    setSave({ status: 'saving' });
    try {
      const { rootHash, txHash } = await writeMemory(address, npc, memories[npc], networkType);
      setSave({ status: 'saved', txHash, root: rootHash });
      setDirty((d) => ({ ...d, [npc]: false }));
    } catch (e) {
      setSave({ status: 'error', error: (e as Error).message });
    }
  }

  // ── Title screen ──
  if ((!isConnected || !address) && !guest) {
    return (
      <div className="relative w-screen h-[100dvh] overflow-hidden engram-serif">
        {/* key forces a full remount vs the in-game Scene3D so nothing lingers
            in the persistent canvas when the wallet connects. */}
        <Scene3D key="title" interactive={false} showTitle />
        {/* Title as HTML (was a 3D drei <Text> that orphaned in the canvas across
            the title→game transition and showed up as stray letters in-game). */}
        <div className="absolute inset-x-0 top-[16vh] z-10 px-6 text-center pointer-events-none">
          <h1
            className="text-5xl sm:text-7xl font-bold tracking-[0.2em] text-[#e7c14e]"
            style={{ textShadow: '0 3px 14px #000, 0 0 36px rgba(214,167,42,0.35)' }}
          >
            ENGRAM
          </h1>
          <p className="mt-3 text-base sm:text-lg italic text-[#f4e8d0]/85" style={{ textShadow: '0 2px 8px #000' }}>
            The village of Aldenmoor remembers you.
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center text-center gap-4 pb-[12vh] bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            <ConnectButton />
            <button
              onClick={() => setGuest(true)}
              className="text-sm text-[#f4e8d0]/80 underline underline-offset-4 hover:text-[#f4e8d0]"
            >
              or explore as a guest →
            </button>
          </div>
          <p className="text-sm text-[#f4e8d0]/70 max-w-md px-6">
            Your wallet is your name. Three souls keep their own memory of you — stored on 0G, where no one can make them forget.
          </p>
        </div>
      </div>
    );
  }

  const activeNpc = NPC_LIST.find((n) => n.id === active);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden engram-serif text-[#f4e8d0]">
      {/* 3D Aldenmoor. Clicking a villager opens their dialogue; the camera
          eases toward whoever is active. All memory/dialogue logic is unchanged. */}
      <Scene3D
        key="game"
        memories={memories}
        active={active}
        talking={scene.loading}
        onSelect={address ? openDialogue : () => {}}
        interactive={address ? !!memories : true}
        uiOpen={panelOpen}
      />

      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex justify-between items-center px-4 py-3 bg-gradient-to-b from-black/55 to-transparent">
        <div className="font-bold tracking-[0.15em] text-[#d6b84a]">ENGRAM · Aldenmoor</div>
        <div className="flex items-center gap-2">
          {address ? (
            <>
              <NetworkToggle />
              <span className="text-xs font-mono bg-black/40 border border-[#4a3f28] px-3 py-1.5 rounded-full" title={address}>
                {short(address)}
              </span>
              <button onClick={() => setPanelOpen(true)} className="bg-black/40 border border-[#5a4a28] hover:border-[#d6b84a] rounded-md px-3 py-1.5 text-sm">
                📜 Memory
              </button>
            </>
          ) : (
            <>
              <span className="text-xs bg-black/40 border border-[#4a3f28] px-3 py-1.5 rounded-full text-[#f4e8d0]/80">Demo</span>
              <div className="pointer-events-auto">
                <ConnectButton />
              </div>
            </>
          )}
        </div>
      </header>

      {/* Save-to-0G status banner */}
      {save.status !== 'idle' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 text-sm rounded-lg px-4 py-2 border"
          style={{
            background: 'rgba(20,16,10,0.92)',
            borderColor: save.status === 'error' ? '#7a3a2a' : '#5a4a28',
          }}>
          {save.status === 'saving' && '⛓ Saving memory to 0G…'}
          {save.status === 'saved' && (
            <span>
              ✓ Saved to 0G · root <span className="font-mono text-[#d6b84a]">{short(save.root)}</span>
              {save.txHash && <> · tx <span className="font-mono text-[#d6b84a]">{short(save.txHash)}</span></>}
            </span>
          )}
          {save.status === 'error' && <span className="text-[#e07a6a]">Save failed: {save.error}</span>}
        </div>
      )}

      {/* Loading memories (only when a wallet is connected; guests have none). */}
      {address && !memories && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="engram-thinking text-xl text-[#d6b84a]">Reading Aldenmoor’s memory from 0G…</div>
        </div>
      )}

      {/* Villagers are rendered inside the 3D Scene above; the dialogue box and
          memory panel below stay as 2D overlays. */}

      {/* Walking + interaction hints now live inside the 3D first-person HUD. */}

      {/* JRPG dialogue box */}
      {active && activeNpc && (
        <div className="absolute inset-x-0 bottom-0 z-30 p-4">
          <div className="engram-dialogue relative max-w-3xl mx-auto rounded-2xl px-6 pt-6 pb-4" style={{ ['--accent' as string]: activeNpc.accent }}>
            <div
              className="absolute -top-4 left-6 text-[#15110a] font-bold px-4 py-1 rounded-md text-sm tracking-wide"
              style={{ background: activeNpc.accent, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}
            >
              {activeNpc.name}
            </div>

            <div className="text-lg leading-relaxed min-h-[58px] mb-4 mt-1">
              {scene.loading && !scene.dialogue ? <span className="engram-thinking">…</span> : scene.dialogue}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {scene.options.map((opt, i) => (
                <button
                  key={i}
                  disabled={scene.loading}
                  onClick={() => say(active, opt)}
                  className="engram-option text-left bg-[#322a1a]/70 border border-[#6a5832] rounded-lg px-3.5 py-2.5 text-[15px] transition-all disabled:opacity-40"
                >
                  <span className="text-[#d6b84a]">▸ </span>
                  {opt}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-3.5">
              <input
                className="flex-1 bg-black/40 border border-[#5a4a28] focus:border-[#d6b84a] outline-none rounded-md px-3 py-2 text-sm"
                placeholder={`Say something to ${activeNpc.name}…`}
                value={typed}
                disabled={scene.loading}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && say(active, typed)}
              />
              <button onClick={() => say(active, typed)} disabled={scene.loading} className="bg-black/40 border border-[#5a4a28] hover:border-[#d6b84a] rounded-md px-3 py-2 text-sm disabled:opacity-40">
                Say
              </button>
              <button onClick={leave} className="bg-black/40 border border-[#5a4a28] hover:border-[#d6b84a] rounded-md px-3 py-2 text-sm text-[#d89]">
                Leave & save
              </button>
            </div>
          </div>
        </div>
      )}

      {err && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 text-sm text-[#e07a6a] bg-[rgba(40,10,10,0.9)] border border-[#7a3a2a] px-4 py-2 rounded-lg">
          {err}
        </div>
      )}

      {/* Memory panel */}
      {address && memories && (
        <MemoryPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          memories={memories}
          bundleRoot={getBundleRoot(address)}
          networkType={networkType}
        />
      )}
      {panelOpen && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setPanelOpen(false)} />}
    </div>
  );
}

// ─── Memory panel ─────────────────────────────────────────────────────────────

function MemoryPanel({
  open,
  onClose,
  memories,
  bundleRoot,
  networkType,
}: {
  open: boolean;
  onClose: () => void;
  memories: Record<NPCName, NPCMemory>;
  bundleRoot: string | null;
  networkType: string;
}) {
  return (
    <aside
      className="engram-panel fixed top-0 right-0 h-full w-[380px] max-w-[92vw] z-50 flex flex-col engram-serif text-[#f4e8d0]"
      style={{
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        background: 'linear-gradient(180deg,#1a1610,#110d08)',
        borderLeft: '3px solid #c79a3a',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex justify-between items-center px-5 pt-4 pb-2.5 border-b border-[#3a2f1a]">
        <h2 className="text-lg text-[#d6b84a] m-0">What Aldenmoor Remembers</h2>
        <button onClick={onClose} className="text-lg">✕</button>
      </div>
      <div className="px-5 py-2 text-xs opacity-70 border-b border-[#2a2316]">
        Stored on <strong>0G Storage</strong> ({networkType})
        {bundleRoot && <> · root <span className="font-mono text-[#d6b84a]">{`${bundleRoot.slice(0, 10)}…`}</span></>}
      </div>

      <div className="overflow-y-auto p-3.5 flex flex-col gap-3.5">
        {NPC_LIST.map((npc) => {
          const mem = memories[npc.id];
          const history = [...mem.interaction_history].reverse();
          return (
            <div key={npc.id} className="bg-black/35 rounded-xl p-3 border" style={{ borderColor: npc.accent }}>
              <div className="flex items-center gap-2.5">
                <Portrait npc={npc.id} size={44} />
                <div>
                  <div className="font-bold">{npc.name}</div>
                  <div className="text-[11px] italic opacity-65">{npc.role}</div>
                </div>
                <div className="ml-auto text-[11px] bg-white/10 px-2 py-0.5 rounded-full capitalize">{mem.emotional_state}</div>
              </div>

              <div className="mt-2.5 mb-1.5">
                <div className="flex justify-between text-xs opacity-85 mb-1">
                  <span>Trust</span>
                  <span>{mem.trust_level}/100</span>
                </div>
                <div className="h-2.5 bg-black/50 rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${mem.trust_level}%`, background: trustColor(mem.trust_level) }} />
                </div>
              </div>

              {mem.debts > 0 && <div className="text-xs text-[#e0883a] my-1.5">⚠ Owes {npc.name} <strong>{mem.debts}</strong> in debts</div>}

              <div className="text-[11px] uppercase tracking-wide opacity-60 mt-2 mb-1">
                Remembers {history.length} interaction{history.length === 1 ? '' : 's'}
              </div>
              <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
                {history.length === 0 && <li className="italic opacity-40 text-sm">No memories yet.</li>}
                {history.slice(0, 8).map((h, i) => (
                  <li key={i} className="flex justify-between gap-2 text-[13px] leading-tight">
                    <span className="opacity-90">{h.summary}</span>
                    {h.trust_delta !== 0 && (
                      <span className="font-mono font-bold" style={{ color: h.trust_delta > 0 ? '#5fb86a' : '#cc5a4a' }}>
                        {h.trust_delta > 0 ? '+' : ''}{h.trust_delta}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/**
 * Client-only version of the page that skips server-side rendering to avoid
 * hydration mismatches completely.
 */
export function ClientPage() {
  return (
    <Providers>
      <Game />
    </Providers>
  );
}
