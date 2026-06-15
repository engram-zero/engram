import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import { connectWallet, silentWallet, shortAddr, hasInjectedWallet } from "./wallet.js";
import { Village, Portrait } from "./components/Art.jsx";
import MemoryPanel from "./components/MemoryPanel.jsx";

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [demo, setDemo] = useState(false);
  const [npcs, setNpcs] = useState([]);
  const [memories, setMemories] = useState({});
  const [storage, setStorage] = useState(null);
  const [active, setActive] = useState(null); // npc id in dialogue
  const [scene, setScene] = useState({ dialogue: "", options: [], loading: false });
  const [panelOpen, setPanelOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    api.npcs().then((d) => setNpcs(d.npcs)).catch((e) => setError(e.message));
    silentWallet().then((w) => w && onConnected(w));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMemories = useCallback(async (address) => {
    const d = await api.memory(address);
    setMemories(d.memories);
    setStorage(d.storage);
  }, []);

  async function onConnected(w) {
    setWallet(w.address);
    setDemo(w.demo);
    try {
      await loadMemories(w.address);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleConnect() {
    setError(null);
    try {
      const w = await connectWallet();
      await onConnected(w);
    } catch (e) {
      setError(e.message);
    }
  }

  async function openDialogue(npcId) {
    setActive(npcId);
    setScene({ dialogue: "", options: [], loading: true });
    try {
      const d = await api.chat(wallet, npcId, ""); // empty = approach/greet
      applyTurn(npcId, d);
    } catch (e) {
      setScene({ dialogue: `(${e.message})`, options: [], loading: false });
    }
  }

  async function say(npcId, message) {
    if (!message?.trim()) return;
    setScene((s) => ({ ...s, loading: true }));
    setTyped("");
    try {
      const d = await api.chat(wallet, npcId, message);
      applyTurn(npcId, d);
    } catch (e) {
      setScene((s) => ({ ...s, loading: false, dialogue: `(${e.message})` }));
    }
  }

  function applyTurn(npcId, d) {
    setScene({ dialogue: d.dialogue, options: d.options, loading: false });
    setMemories((m) => ({ ...m, [npcId]: d.memory }));
    if (d.storage) setStorage(d.storage);
  }

  function leave() {
    setActive(null);
    setScene({ dialogue: "", options: [], loading: false });
  }

  const activeNpc = npcs.find((n) => n.id === active);

  if (!wallet) {
    return (
      <div className="app title-screen">
        <Village />
        <div className="title-overlay">
          <h1 className="game-title">ENGRAM</h1>
          <p className="game-sub">The village of Aldenmoor remembers you.</p>
          <button className="connect-btn" onClick={handleConnect}>
            {hasInjectedWallet() ? "Connect Wallet" : "Enter (Demo Wallet)"}
          </button>
          {!hasInjectedWallet() && (
            <p className="title-hint">No wallet detected — a demo identity will be created.</p>
          )}
          {error && <p className="error">{error}</p>}
          <p className="title-foot">Your wallet is your name. Three souls keep their own memory of you on 0G.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Village />

      {/* top bar */}
      <header className="topbar">
        <div className="brand">ENGRAM <span className="dot">·</span> Aldenmoor</div>
        <div className="topbar-right">
          <span className="wallet-chip" title={wallet}>
            {demo && <span className="demo-tag">DEMO</span>} {shortAddr(wallet)}
          </span>
          <button className="ghost-btn" onClick={() => setPanelOpen(true)}>
            📜 Memory
          </button>
        </div>
      </header>

      {/* NPC stage */}
      <div className={`stage ${active ? "in-dialogue" : ""}`}>
        {npcs.map((npc) => {
          const mem = memories[npc.id];
          const isActive = npc.id === active;
          return (
            <button
              key={npc.id}
              className={`npc ${isActive ? "active" : ""} ${active && !isActive ? "dim" : ""}`}
              onClick={() => openDialogue(npc.id)}
              disabled={!!active}
              style={{ "--accent": npc.accent }}
            >
              <div className="npc-portrait-wrap">
                <Portrait npc={npc.id} size={isActive ? 132 : 108} talking={isActive && scene.loading} />
              </div>
              <div className="npc-label">
                <span className="npc-name">{npc.name}</span>
                <span className="npc-role">{npc.role}</span>
                {mem && (
                  <span className="npc-trust-mini" title={`trust ${mem.trust_level}`}>
                    <span className="mini-bar"><span style={{ width: `${mem.trust_level}%` }} /></span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* JRPG dialogue box */}
      {active && (
        <div className="dialogue-layer">
          <div className="dialogue-box" style={{ "--accent": activeNpc?.accent }}>
            <div className="dialogue-name">{activeNpc?.name}</div>
            <div className="dialogue-text">
              {scene.loading && !scene.dialogue ? <span className="thinking">…</span> : scene.dialogue}
            </div>

            <div className="dialogue-options">
              {scene.options.map((opt, i) => (
                <button key={i} className="option-btn" disabled={scene.loading} onClick={() => say(active, opt)}>
                  {opt}
                </button>
              ))}
            </div>

            <div className="dialogue-foot">
              <input
                className="say-input"
                placeholder={`Say something to ${activeNpc?.name}…`}
                value={typed}
                disabled={scene.loading}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && say(active, typed)}
              />
              <button className="ghost-btn small" disabled={scene.loading} onClick={() => say(active, typed)}>Say</button>
              <button className="ghost-btn small leave" onClick={leave}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error toast">{error}</div>}

      <MemoryPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        npcs={npcs}
        memories={memories}
        storage={storage}
      />
      {panelOpen && <div className="scrim" onClick={() => setPanelOpen(false)} />}
    </div>
  );
}
