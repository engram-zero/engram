// LocalStore — zero-setup fallback that persists NPC memory as JSON files on
// disk. Same interface as ZeroGStore so the rest of the app does not care which
// one is active. Use this for instant local demos; switch STORAGE_MODE=zerog
// to put the memory on the 0G network instead.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../.data");

function keyFor(wallet, npc) {
  // wallet address + npc name is the unique memory key.
  return `${wallet.toLowerCase()}__${npc}.json`;
}

export class LocalStore {
  mode = "local";

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async read(wallet, npc) {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, keyFor(wallet, npc)), "utf8");
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  async write(wallet, npc, memory) {
    const file = path.join(DATA_DIR, keyFor(wallet, npc));
    await fs.writeFile(file, JSON.stringify(memory, null, 2), "utf8");
    // Local mode has no on-chain reference; return a stable pseudo-locator.
    return { ref: `local:${keyFor(wallet, npc)}` };
  }

  describe() {
    return { mode: "local", detail: `JSON files under ${DATA_DIR}` };
  }
}
