// Picks the active storage backend from STORAGE_MODE and exposes a single
// memory API to the rest of the server. Always falls back to LocalStore if the
// 0G path cannot initialise, so the demo never hard-fails.
import { LocalStore } from "./local.js";
import { ZeroGStore } from "./zerog.js";
import { defaultMemory } from "../npcs.js";

let store = null;

export async function initStorage() {
  const mode = (process.env.STORAGE_MODE || "local").toLowerCase();

  if (mode === "zerog") {
    try {
      const zg = new ZeroGStore({
        rpcUrl: process.env.ZEROG_RPC_URL || "https://evmrpc-testnet.0g.ai",
        indexerUrl:
          process.env.ZEROG_INDEXER_URL ||
          "https://indexer-storage-testnet-turbo.0g.ai",
        privateKey: process.env.ZEROG_PRIVATE_KEY,
      });
      await zg.init();
      store = zg;
      console.log(`[storage] 0G Storage active — ${zg.describe().detail}`);
      return store;
    } catch (err) {
      console.warn(
        `[storage] Could not start 0G mode (${err.message}). Falling back to local store.`
      );
    }
  }

  const local = new LocalStore();
  await local.init();
  store = local;
  console.log(`[storage] Local store active — ${local.describe().detail}`);
  return store;
}

export function storageInfo() {
  return store ? store.describe() : { mode: "uninitialised" };
}

// Read a memory, creating defaults on first contact (and persisting them so the
// "first meeting" is itself recorded on 0G).
export async function getOrCreateMemory(wallet, npc) {
  let memory = await store.read(wallet, npc);
  if (!memory) {
    memory = defaultMemory();
    await store.write(wallet, npc, memory);
  }
  return memory;
}

export async function readMemory(wallet, npc) {
  return (await store.read(wallet, npc)) || defaultMemory();
}

export async function writeMemory(wallet, npc, memory) {
  return store.write(wallet, npc, memory);
}
