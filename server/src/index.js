import express from "express";
import cors from "cors";
import { NPCS, NPC_LIST } from "./npcs.js";
import {
  initStorage,
  storageInfo,
  getOrCreateMemory,
  readMemory,
  writeMemory,
} from "./storage/index.js";
import { generateTurn, aiInfo } from "./ai.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const isAddress = (w) => typeof w === "string" && /^0x[a-fA-F0-9]{40}$/.test(w);
const shortWallet = (w) => `${w.slice(0, 6)}…${w.slice(-4)}`;

// Apply an AI memory_update onto a memory object and stamp the interaction.
function applyUpdate(memory, update, playerLine) {
  const next = {
    ...memory,
    trust_level: Math.max(0, Math.min(100, memory.trust_level + (update.trust_delta || 0))),
    debts: Math.max(0, memory.debts + (update.debts_delta || 0)),
    emotional_state: update.emotional_state || memory.emotional_state,
    last_seen: Date.now(),
    interaction_history: [
      ...memory.interaction_history,
      {
        at: Date.now(),
        player: playerLine || "(approached)",
        summary: update.summary,
        trust_delta: update.trust_delta || 0,
      },
    ].slice(-50),
  };
  return next;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storage: storageInfo(), ai: aiInfo() });
});

app.get("/api/npcs", (req, res) => {
  res.json({ npcs: NPC_LIST });
});

// All three NPC memories for a wallet — powers the memory panel and first load.
app.get("/api/memory/:wallet", async (req, res) => {
  const wallet = req.params.wallet;
  if (!isAddress(wallet)) return res.status(400).json({ error: "Invalid wallet address." });
  try {
    const memories = {};
    for (const id of Object.keys(NPCS)) {
      memories[id] = await getOrCreateMemory(wallet, id);
    }
    res.json({ wallet, memories, storage: storageInfo() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read memory." });
  }
});

// One dialogue turn: read memory -> AI in character -> persist update to 0G.
app.post("/api/chat", async (req, res) => {
  const { wallet, npc, message } = req.body || {};
  if (!isAddress(wallet)) return res.status(400).json({ error: "Invalid wallet address." });
  if (!NPCS[npc]) return res.status(400).json({ error: "Unknown NPC." });

  try {
    const memory = await getOrCreateMemory(wallet, npc);

    // Sable aggregates what the other NPCs know.
    let crossMemory;
    if (npc === "sable") {
      crossMemory = {};
      for (const id of Object.keys(NPCS)) {
        if (id === "sable") continue;
        const m = await readMemory(wallet, id);
        crossMemory[NPCS[id].name] = m;
      }
    }

    const turn = await generateTurn({
      npcId: npc,
      memory,
      walletShort: shortWallet(wallet),
      playerLine: message,
      crossMemory,
    });

    const updated = applyUpdate(memory, turn.memory_update, message);
    const writeResult = await writeMemory(wallet, npc, updated);

    res.json({
      npc,
      dialogue: turn.dialogue,
      options: turn.options,
      memory: updated,
      delta: turn.memory_update,
      storage: { ...storageInfo(), ref: writeResult?.ref },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dialogue failed.", detail: err.message });
  }
});

const PORT = process.env.PORT || 8787;
initStorage().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Engram server on http://localhost:${PORT}`);
    console.log(`  storage: ${JSON.stringify(storageInfo())}`);
    console.log(`  ai:      ${JSON.stringify(aiInfo())}\n`);
  });
});
