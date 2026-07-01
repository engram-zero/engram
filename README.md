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
3. **Persist** — when you leave an NPC, the updated bundle is written back to 0G via
   `POST /api/save`. The 0G storage SDK can't run in the browser (the storage nodes
   send no CORS headers), so the write runs server-side with a **sponsor wallet**.
   The memory is still **keyed to your wallet address** and content-addressed on 0G —
   the storage fee is just sponsored for the demo.

Open the 📜 **Memory** panel to audit exactly what each NPC remembers: trust as a
0–100 bar, the interaction log, current mood, and pending debts — all sourced from 0G.

## Architecture

```
src/
├─ app/
│  ├─ client-page.tsx     the game UI (village, JRPG dialogue, memory panel)
│  └─ api/npc/route.ts    server-side Claude dialogue engine (holds ANTHROPIC_API_KEY)
├─ lib/
│  ├─ memory.ts           read the MemoryBundle from 0G (client) + POST writes to /api/save
├─ app/api/save/route.ts  server-side 0G upload (sponsor wallet; SDK can't run in browser)
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
cp .env.example .env.local       # set ANTHROPIC_API_KEY and ENGRAM_SPONSOR_KEY
npm run dev                      # http://localhost:3000
```

`ENGRAM_SPONSOR_KEY` is a funded **0G Galileo (16602)** testnet private key (server-only)
that pays for storage writes — fund it at [faucet.0g.ai](https://faucet.0g.ai). Connect
any wallet (it's your identity), talk to an NPC, and hit **Leave & save** to persist the
conversation to 0G. Close the tab, come back — the NPC remembers.

> Without `ANTHROPIC_API_KEY`, NPCs use a deterministic fallback so the UI is still
> clickable. Without `ENGRAM_SPONSOR_KEY`, dialogue works but saving to 0G is disabled.

### Debug logs

Production logging is quiet by default. Set `NEXT_PUBLIC_ENGRAM_DEBUG=1` locally
or in a preview deployment to enable verbose diagnostics from API/lib/0G helpers;
leave it blank for the public demo.

## For AI assistants & contributors

**The task backlog lives in [`docs/ENGRAM_PROMPTS.md`](docs/ENGRAM_PROMPTS.md).** It is
the single source of truth for what's planned and what's done — each pending feature is
written as a self-contained, ready-to-run prompt, and the index marks status
(⏳ pendiente / ✅ done).

If you're an AI (or human) about to work on this project:

1. **Read `docs/ENGRAM_PROMPTS.md` first.** Pick a task from the index; don't invent
   scope. Each prompt lists its own files, constraints and acceptance criteria.
2. **When you finish a task, update that doc** — flip its index entry to ✅ and add a
   short "DONE" note (date + where it landed), mirroring the existing entries.
3. **Add new pending work as a new prompt** in the same format, and register it in the
   index — keep the doc the canonical to-do list.

Broader project context lives in [`docs/ENGRAM_PLAN_V2.md`](docs/ENGRAM_PLAN_V2.md)
(architecture decisions, tournament rules, current state). **Before touching anything 0G /
storage, read [`docs/STATUS.md`](docs/STATUS.md)** — it documents the non-obvious 0G
integration gotchas (the SDK package moved twice; writes must run server-side because the
storage nodes have no CORS; 0G has no EIP-1559; default network is Turbo) that cost a full
debugging session to find.

## Why 0G is the core

Remove 0G and the memory has nowhere to live — the whole premise (NPCs that remember
you, that *no developer can make forget*) collapses. The data is auditable by its 0G
root hash; the player owns it.

> **Note on cross-device:** the 0G root-hash pointer is currently cached in
> `localStorage`. The memory **data** is fully on 0G; only the pointer is local.
> True cross-device recall replaces this with an on-chain registry / 0G-KV lookup
> (see `src/lib/memory.ts`).
