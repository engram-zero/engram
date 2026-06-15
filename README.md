# Engram — Aldenmoor

> The first game where NPCs truly remember you — and no one can make them forget.

A browser-based text RPG. You connect an Ethereum wallet (your wallet address is
your identity), walk into the medieval village of **Aldenmoor**, and talk to three
NPCs. Each NPC keeps an **independent memory of you persisted on the 0G Storage
network** — keyed by your wallet address + the NPC's name. Your past decisions
visibly change how they speak to you in future sessions, across browsers and
devices, because the memory does not live in `localStorage` — it lives on 0G.

Built for the **0G Zero Cup**.

## The cast

| NPC | Role | Memory behaviour |
|---|---|---|
| **Aldric** | Merchant | Remembers every transaction. Loyal payers get discounts; cheats and debtors get cold prices. |
| **Maren** | Guard Captain | Tracks your combat & moral choices. Respects courage, despises cowardice. Warns allies — lets enemies walk into traps. |
| **Sable** | Information Broker | Aggregates what Aldric *and* Maren know about you. Can be bribed. May already be working against you. |

## How the memory works

Each NPC stores one JSON object on 0G Storage:

```json
{ "trust_level": 50, "interaction_history": [], "emotional_state": "neutral", "debts": 0, "last_seen": null }
```

- **On dialogue start** the server reads that object from 0G (creating defaults on
  first contact — and writing those defaults straight back to 0G so even the first
  meeting is recorded).
- The object is **injected into the NPC's system prompt** alongside its
  personality, so Claude references your history naturally.
- **On every exchange** the memory is updated (trust, mood, debts, a one-line
  record of what happened) and **written back to 0G Storage**.

Open the 📜 **Memory** panel any time to audit exactly what each NPC remembers:
trust as a 0–100 bar, the interaction log, current mood, and pending debts.

## Architecture

```
client/  Vite + React. Wallet connect, illustrated village (inline SVG),
         JRPG dialogue box, option buttons, memory panel. No secrets here.
server/  Express. Holds the Claude key + the 0G uploader key.
         ├─ storage/  0G Storage adapter (real SDK) + local-file fallback
         ├─ ai.js     Claude NPC engine + offline persona engine
         └─ npcs.js   Personalities + memory-injected system prompts
```

The Claude API key and the 0G uploader key are **server-side only** — the browser
never sees them. The player's own wallet is used purely as identity.

## Run it

```bash
npm install          # installs root + server + client (workspaces)
cp .env.example .env  # optional — app runs with no keys at all
npm run dev          # server on :8787, client on :5173
```

Open http://localhost:5173.

### Zero-config mode (default)
With no `.env`/keys, Engram is fully playable:
- **Storage** → JSON files under `server/.data/` (`STORAGE_MODE=local`).
- **NPC AI** → a deterministic in-character persona engine (no Claude key needed).

The full memory loop — read → react → persist → recall next session — works
offline so you can demo instantly.

### Live mode (the real thing)
Set these in `.env`:

```ini
ANTHROPIC_API_KEY=sk-ant-...        # NPCs powered by Claude
ENGRAM_MODEL=claude-sonnet-4-6      # or claude-opus-4-8 / claude-haiku-4-5-...

STORAGE_MODE=zerog                  # memory persisted to 0G Storage
ZEROG_RPC_URL=https://evmrpc-testnet.0g.ai
ZEROG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
ZEROG_PRIVATE_KEY=0x...             # a FUNDED 0G testnet account (pays storage fees)
```

In `zerog` mode each memory object is uploaded to 0G Storage as a JSON blob,
addressed by its Merkle root hash (auditable on-chain). A local pointer index
maps `wallet:npc → latest root hash`; the memory **data** lives on 0G. If the 0G
path can't start (missing key/deps), the server logs a warning and falls back to
local mode so a demo is never blocked.

## Why 0G is the core
Remove 0G and the memory has nowhere to live — the app's whole premise (NPCs that
remember you, that *no developer can make forget*) collapses. The memory is not in
a database the developer controls; it's on 0G, and the player can audit it.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Active storage + AI engine |
| `GET` | `/api/npcs` | NPC roster (no secrets) |
| `GET` | `/api/memory/:wallet` | All three memories for a wallet |
| `POST` | `/api/chat` | One dialogue turn: read → AI → persist to 0G |
