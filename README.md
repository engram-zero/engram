# Engram — Aldenmoor

> The first game where NPCs truly remember you — and no one can make them forget.

A browser text-RPG where three NPCs keep an **independent, persistent memory of you
stored on the 0G Storage network**, keyed by your wallet. Your past decisions
visibly change how they speak to you in future sessions — because the memory does
not live in a database a developer controls, or in `localStorage`. It lives on 0G.

Built for the **0G Zero Cup**. Live on 0G Galileo Testnet (Chain ID `16602`).

## The cast

| NPC | Role | Memory behaviour |
|---|---|---|
| **Aldric** | Merchant | Remembers every transaction. Loyal payers get discounts; cheats and debtors get cold prices. |
| **Maren** | Guard Captain | Tracks your combat & moral choices. Respects courage, despises cowardice. |
| **Sable** | Information Broker | Aggregates what Aldric *and* Maren know about you. Can be bribed. May already be working against you. |

## How the memory works

Each NPC keeps a JSON memory object:

```json
{ "trust_level": 50, "interaction_history": [], "emotional_state": "neutral", "debts": 0, "last_seen": null }
```

All three live in a single **MemoryBundle** per wallet, stored on **0G Storage**.

1. **Read** — on connect, the client downloads your bundle from 0G (`src/lib/memory.ts`).
2. **Speak** — your message + that NPC's memory go to `POST /api/npc`, which injects
   the memory into the NPC's persona system prompt and asks **Claude** for an
   in-character turn (`src/app/api/npc/route.ts`). The Claude key stays server-side.
3. **Persist** — when you leave an NPC, the updated bundle is uploaded back to 0G
   with **one wallet signature** (your wallet pays the storage fee — you own the memory).

Open the 📜 **Memory** panel to audit exactly what each NPC remembers: trust as a
0–100 bar, the interaction log, current mood, and pending debts — all sourced from 0G.

## Architecture

```
src/
├─ app/
│  ├─ client-page.tsx     the game UI (village, JRPG dialogue, memory panel)
│  └─ api/npc/route.ts    server-side Claude dialogue engine (holds ANTHROPIC_API_KEY)
├─ lib/
│  ├─ memory.ts           read/write the MemoryBundle on 0G (client, wallet signs writes)
│  ├─ npcs.ts             the 3 personas + {MEMORY_JSON} / {CROSS_MEMORY} prompts
│  ├─ types.ts            shared types + memory schema
│  └─ 0g/                 0G Storage primitives (upload/download/blob/fees) — starter kit
└─ components/engram/Art.tsx   inline-SVG village + portraits
```

Built on the official **0G Storage web starter kit** — the `src/lib/0g/`, `src/hooks/`,
and wallet/config layers are the kit's proven 0G integration (real testnet uploads).

## Run it

```bash
npm install --legacy-peer-deps   # web3modal pins zod; this is the standard resolve
cp .env.example .env.local       # then paste your ANTHROPIC_API_KEY into .env.local
npm run dev                      # http://localhost:3000
```

Connect a wallet on **0G Galileo (16602)** with testnet funds, talk to an NPC, and
hit **Leave & save** to persist the conversation to 0G. Close the tab, come back —
the NPC remembers.

> Without `ANTHROPIC_API_KEY`, NPCs use a deterministic fallback so the UI is still
> clickable. Set the key for real Claude-powered dialogue.

## Why 0G is the core

Remove 0G and the memory has nowhere to live — the whole premise (NPCs that remember
you, that *no developer can make forget*) collapses. The data is auditable by its 0G
root hash; the player owns it.

> **Note on cross-device:** the 0G root-hash pointer is currently cached in
> `localStorage`. The memory **data** is fully on 0G; only the pointer is local.
> True cross-device recall replaces this with an on-chain registry / 0G-KV lookup
> (see `src/lib/memory.ts`).
