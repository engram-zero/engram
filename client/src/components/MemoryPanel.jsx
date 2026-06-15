import { Portrait } from "./Art.jsx";

function trustColor(t) {
  if (t >= 70) return "#5fb86a";
  if (t >= 40) return "#d6b84a";
  return "#cc5a4a";
}

function NpcMemory({ npc, memory }) {
  const history = [...(memory.interaction_history || [])].reverse();
  return (
    <div className="mem-card" style={{ borderColor: npc.accent }}>
      <div className="mem-head">
        <Portrait npc={npc.id} size={44} />
        <div>
          <div className="mem-name">{npc.name}</div>
          <div className="mem-role">{npc.role}</div>
        </div>
        <div className="mem-mood" title="emotional state">{memory.emotional_state}</div>
      </div>

      <div className="mem-trust">
        <div className="mem-trust-label">
          <span>Trust</span>
          <span>{memory.trust_level}/100</span>
        </div>
        <div className="mem-bar">
          <div
            className="mem-bar-fill"
            style={{ width: `${memory.trust_level}%`, background: trustColor(memory.trust_level) }}
          />
        </div>
      </div>

      {memory.debts > 0 && (
        <div className="mem-debt">⚠ Owes {npc.name} <strong>{memory.debts}</strong> in debts</div>
      )}

      <div className="mem-history-title">
        Remembers {history.length} interaction{history.length === 1 ? "" : "s"}
      </div>
      <ul className="mem-history">
        {history.length === 0 && <li className="mem-empty">No memories yet.</li>}
        {history.slice(0, 8).map((h, i) => (
          <li key={i}>
            <span className="mem-h-summary">{h.summary}</span>
            {typeof h.trust_delta === "number" && h.trust_delta !== 0 && (
              <span className={`mem-h-delta ${h.trust_delta > 0 ? "pos" : "neg"}`}>
                {h.trust_delta > 0 ? "+" : ""}{h.trust_delta}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MemoryPanel({ open, onClose, npcs, memories, storage }) {
  return (
    <aside className={`memory-panel ${open ? "open" : ""}`}>
      <div className="memory-panel-header">
        <h2>What Aldenmoor Remembers</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close memory panel">✕</button>
      </div>
      <div className="memory-source">
        Stored on <strong>{storage?.mode === "zerog" ? "0G Storage" : "local store"}</strong>
        {storage?.mode === "zerog" && storage?.ref && (
          <span className="memory-ref" title="0G root hash"> · {String(storage.ref).slice(0, 14)}…</span>
        )}
      </div>
      <div className="memory-panel-body">
        {npcs.map((npc) =>
          memories[npc.id] ? (
            <NpcMemory key={npc.id} npc={npc} memory={memories[npc.id]} />
          ) : null
        )}
      </div>
    </aside>
  );
}
