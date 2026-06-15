// ZeroGStore — the real "0G does real work" path. Each NPC memory object is
// uploaded to the 0G Storage network as a JSON blob; the blob is addressed by
// its Merkle root hash, which is auditable on-chain. A small local pointer
// index maps (wallet, npc) -> latest root hash so we can fetch the current
// memory back. The MEMORY DATA itself lives on 0G; the index is only a cache of
// pointers (and could be swapped for 0G-KV later).
//
// The 0G SDK + ethers are optionalDependencies and only loaded here, so the app
// still boots in local mode if they are absent.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = path.resolve(__dirname, "../../.data/zerog-index.json");

function keyFor(wallet, npc) {
  return `${wallet.toLowerCase()}__${npc}`;
}

export class ZeroGStore {
  mode = "zerog";

  constructor({ rpcUrl, indexerUrl, privateKey }) {
    this.rpcUrl = rpcUrl;
    this.indexerUrl = indexerUrl;
    this.privateKey = privateKey;
    this.index = {};
  }

  async init() {
    if (!this.privateKey) {
      throw new Error("STORAGE_MODE=zerog requires ZEROG_PRIVATE_KEY (a funded 0G testnet account).");
    }
    // Dynamic import so missing optional deps degrade gracefully upstream.
    const { ethers } = await import("ethers");
    this.sdk = await import("@0glabs/0g-ts-sdk");

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.signer = new ethers.Wallet(this.privateKey, this.provider);
    this.indexer = new this.sdk.Indexer(this.indexerUrl);

    await fs.mkdir(path.dirname(INDEX_FILE), { recursive: true });
    try {
      this.index = JSON.parse(await fs.readFile(INDEX_FILE, "utf8"));
    } catch {
      this.index = {};
    }
  }

  async #persistIndex() {
    await fs.writeFile(INDEX_FILE, JSON.stringify(this.index, null, 2), "utf8");
  }

  #tmp(suffix) {
    return path.join(os.tmpdir(), `engram-${crypto.randomUUID()}${suffix}`);
  }

  async read(wallet, npc) {
    const rootHash = this.index[keyFor(wallet, npc)];
    if (!rootHash) return null;

    const out = this.#tmp(".json");
    try {
      const err = await this.indexer.download(rootHash, out, true);
      if (err) throw new Error(`0G download failed: ${err}`);
      const raw = await fs.readFile(out, "utf8");
      return JSON.parse(raw);
    } finally {
      await fs.rm(out, { force: true });
    }
  }

  async write(wallet, npc, memory) {
    const { ZgFile } = this.sdk;
    const tmp = this.#tmp(".json");
    await fs.writeFile(tmp, JSON.stringify(memory), "utf8");

    let file;
    try {
      file = await ZgFile.fromFilePath(tmp);
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr) throw new Error(`0G merkle error: ${treeErr}`);
      const rootHash = tree.rootHash();

      const [tx, uploadErr] = await this.indexer.upload(file, this.rpcUrl, this.signer);
      if (uploadErr) throw new Error(`0G upload failed: ${uploadErr}`);

      this.index[keyFor(wallet, npc)] = rootHash;
      await this.#persistIndex();
      return { ref: rootHash, tx };
    } finally {
      if (file) await file.close();
      await fs.rm(tmp, { force: true });
    }
  }

  describe() {
    return { mode: "zerog", detail: `0G Storage via ${this.indexerUrl}` };
  }
}
