# Engram — Status & 0G integration notes

_Last updated: 23 jun 2026 (Group Stage accepted → Round of 32). If you're an AI/contributor touching storage, read the
"0G integration gotchas" section — it's hard-won and non-obvious._

## Current state — the core loop WORKS ✅
Verified end-to-end on the live Vercel demo:
1. Talk to an NPC → memory updates (real Claude, with cross-memory).
2. **Leave & save** → bundle written to 0G (server-side, sponsored) → banner shows
   `✓ Saved to 0G · root … · tx …`.
3. **Reload the page** → the NPC recalls you (e.g. Sable greets "AriiBen —" after the
   name was told in a prior conversation; the 📜 Memory panel shows trust + the
   interaction log). The write→0G→read→recall loop is closed → **tournament criterion #1
   ("0G must do real work") is genuinely satisfied.**

Also working: first-person/aerial Aldenmoor (WASD + mouse-look, terrain/sky/forest),
rate-limit/size guard on `/api/npc`, pointer-lock UX, Vercel auto-deploy on push to `main`,
and the on-chain root registry for cross-device recall.

Also shipped (gameplay): textures, day/night cycle tied to the player's clock, torches;
tree chopping + inventory; **building system** (walls/houses + AI-designed voxel "blocks"
via `/api/build`, with preview, USD cost estimate + spend cap, and distance-based pricing
around a protected village core); **world state persisted on 0G** (a *second* real 0G use
case — inventory/chopped trees/buildings ride the same wallet bundle, with a **Save World**
button and a read-only **public world** showing other wallets' builds); mobile/touch
controls (drag joystick, touch look, no-scroll) + a no-wallet **guest mode**; **Aldric's
merchant loop** (sell wood for coin, raising his trust/memory); and **audio** (silent-safe
cues wired for ambience/foley/UI, with **distance-based spatial ambience** — the
campfire crackle and night-cricket pockets fade in/out by the player's distance to
each emitter, like light but for sound; core asset files and the persisted mute toggle
are now present).
Player-built **houses are now enterable** (hollow walls + door gap), the six
**village cottages are also larger and hollow**, AI voxel construction now snaps to a
**fine anti-overlap grid** with `BLOCK_UNIT = 0.2`, and demolition refunds **half of the
actual wood paid** for that structure instead of a flat base value.

## 0G integration gotchas (READ before touching storage)
These cost a long debugging session; keep them in mind.

1. **SDK package = `@0gfoundation/0g-storage-ts-sdk`.** It moved TWICE:
   `@0glabs/0g-ts-sdk` (old, Newton-era — its `submit` encoding **reverts** with
   `require(false)` on the current Galileo Flow contract) → `@0gfoundation/0g-ts-sdk`
   (deprecated redirect) → **`@0gfoundation/0g-storage-ts-sdk`** (current). Using the old
   `@0glabs/0g-ts-sdk@0.3.0` was the root cause of the save reverting.
2. **The 0G storage SDK can't run in the browser (CORS).** The indexer/node HTTP
   endpoints send no `Access-Control-Allow-Origin`, so `selectNodes`/segment POSTs are
   blocked. Therefore **writes run server-side** in `src/app/api/save/route.ts` with a
   **sponsor wallet** (`ENGRAM_SPONSOR_KEY`). **Reads stay client-side** — the download
   endpoint (`GET {storageRpc}/file?root=…`, `src/lib/0g/downloader.ts`) does allow CORS.
3. **0G Chain has no EIP-1559.** Don't let ethers/MetaMask call
   `eth_maxPriorityFeePerGas` (RPC returns -32601 → the tx fails with -32603). Fetch a
   legacy `eth_gasPrice` and pass it explicitly (we do this in `/api/save`).
4. **Default network = Turbo.** The Standard testnet storage indexer is deprecated and
   returns 503. `src/app/providers.tsx` defaults to Turbo. Standard and Turbo are
   **independent networks** — data written to one is not on the other, so reads and
   writes must use the same one.
5. **Current Galileo Flow contract** = `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`
   (`src/lib/0g/network.ts` default). Testnet contracts get redeployed; the SDK actually
   reads the Flow address from the storage node, so this default mostly matters for the
   client read path. Source of truth: docs.0g.ai.
6. **`Indexer.upload(...)` now returns `[{ txHash, rootHash, txSeq } | { txHashes,
   rootHashes, txSeqs }, Error | null]`** (changed from the old `[string, Error]`).
   Handled in `src/lib/0g/uploader.ts`.

## Env vars (Vercel, Production)
- `ANTHROPIC_API_KEY` — Claude dialogue. (Falls back to Gemini via `GOOGLE_API_KEY`, then a
  deterministic stub.) Server-only.
- `ENGRAM_SPONSOR_KEY` — funded 0G Galileo testnet private key the server writes 0G with.
  **Server-only, never `NEXT_PUBLIC_`.** The wallet must hold testnet OG (faucet.0g.ai).
  Local dev may fall back to `PRIVATE_KEY` if `ENGRAM_SPONSOR_KEY` is missing; production
  must set `ENGRAM_SPONSOR_KEY` explicitly.
- `NEXT_PUBLIC_PROJECT_ID` — WalletConnect (optional for injected wallets).
- `NEXT_PUBLIC_ENGRAM_REGISTRY` — optional override for redeploy/testing. The current
  Galileo registry is baked into the app as public infrastructure:
  `0xD142048BcA7fC224d557C12F8adbAc70D4EC4067`.
- 0G RPC/Flow vars — unset → code defaults used (correct).

## Two wallet roles (don't confuse them)
- **Player wallet** = the player's identity, connected in the browser. It signs the
  `EngramRegistry.setRoot(rootHash)` pointer update when the 0G bundle root changes.
- **Sponsor wallet** = `ENGRAM_SPONSOR_KEY` on the server; pays the storage fee. Needs
  testnet OG. (We used a dedicated throwaway MetaMask account for this.)

## Key files (memory path)
- `src/lib/memory.ts` — reads the latest root from EngramRegistry, downloads the bundle from
  0G (client GET), and `writeMemory()` POSTs the full bundle to `/api/save`. Caches the
  rootHash pointer in localStorage as fallback.
- `src/lib/registry/*` — minimal ABI + client for `rootOf(wallet)` / `setRoot(rootHash)`.
- `src/lib/world.ts` + `src/lib/world-0g.ts` — world inventory/chopped trees/buildings.
  Hydrates from `MemoryBundle.world`. Building/demolition changes are local drafts until
  the player clicks **Save World** in aerial mode; that writes the bundle to 0G and calls
  `EngramRegistry.setRoot`.
- `src/lib/public-world.ts` — scans `RootUpdated` events from EngramRegistry, downloads
  other wallets' 0G bundles, and renders their `world.buildings` as a read-only public
  overlay. This is discovery, not shared editing.
- `src/app/api/save/route.ts` — server-side 0G upload with the sponsor wallet + legacy gas.
- `src/lib/0g/uploader.ts` — `uploadToStorage()` wraps `indexer.upload`.
- `src/lib/0g/{blob,downloader,fees,network}.ts` — 0G primitives + network config.
- `src/app/providers.tsx` — default network (Turbo).

## Known limitation (next real feature)
World persistence is an MVP: each wallet owns its editable `WorldState`, included in the
same 0G bundle as NPC memory and hydrated cross-device through the registry root.
Building/demolition changes are drafts until **Save World** is clicked and the registry
tx is approved. Other wallets' builds are visible through the public-world overlay, but they
are read-only and do not currently affect collision/pathing. The future version should add
better pending/saved feedback or a relayer/meta-tx flow.

## Tournament progress
- [x] Save to 0G working end-to-end (criterion #1). ✅
- [x] **Group Stage submitted & ACCEPTED → through to Round of 32.** ✅ (jun 2026)
- [x] **Round of 32 — QUALIFIED (top 32).** ✅ Now iterate + resubmit before the R32 deadline.
- [x] Demo video (AI voiceover, ElevenLabs), logo, thumbnail, MIT license. ✅
- [ ] **🔴 R32 SUBMISSION (deadline JUN 28): resubmit repo at latest `main` + paste the updated
      Description below.** The Group Stage copy claimed *"your wallet pays"* (storage is sponsored
      server-side — a DQ-shaped overclaim); the new copy fixes that AND showcases the living world
      (economy, mining, raids). Confirm the Vercel deploy is green before resubmitting.
- [ ] Post on X (`#TheZeroCup`, `@0G_labs`) — **only relevant from the Quarter Finals on**
      (community voting JUL 8–10+). R32 and R16 are judged, so it does **not** affect this round's
      score. Optional/strategic for later; a human must post it.

### Paste-ready R32 dashboard Description (honest + showcases the living world)
Drops the false present-tense *"your wallet pays"*, keeps the (true) one-signature pointer +
ownership claim, discloses the demo sponsor as a positive, and adds the new gameplay shipped
since the Group Stage (haggling, mining, dynamic market, raids). Paste verbatim.

> **Engram** is a browser RPG where three villagers keep a **persistent, player-owned memory of you** — stored on **0G Storage**, where no developer, reset, or patch can make them forget.
>
> Connect your wallet and **explore the village of Aldenmoor in first person**. Talk to **Aldric** (merchant), **Maren** (guard captain) and **Sable** (information broker) — each keeps their own memory of you: trust, debts, mood, history. Your past decisions visibly change how they treat you next time. **Haggle** a price with Aldric and he remembers whether you dealt fair or tried to gouge him.
>
> It's a **living, player-owned world on 0G**: gather wood and **mine stone**, **build** by hand or with AI, and trade in a market with **dynamic, scarcity-driven prices**. Your whole world — buildings, inventory, NPC reputations — is serialized to your own 0G bundle. Mark other wallets allied or hostile and **raid** a rival's structures; every change is anchored on-chain, so it's discoverable and auditable.
>
> **Why 0G is the core:** every NPC's memory and your world state live on 0G, **auditable by root hash** and unalterable — *not even we, the developers, can edit or erase it.* Remove 0G and the premise collapses.
>
> Each save is anchored to 0G with **one signature from your wallet** — you sign the on-chain pointer to your own data, so **you own it and can audit it by root hash.** *(Storage fees are sponsored for this testnet demo; the design puts that cost on the player.)* Live on 0G Galileo Testnet (Chain ID 16602) with real on-chain uploads.

## Round of 32 — what to do next
Knockout round, judged. The Group Stage submission is locked but you can iterate and
submit a revised version if you advance. Snapshot = `main` at the round deadline, so keep
`main` green (tsc clean, demo live). **Prioritised plan lives in
[`ENGRAM_PROMPTS.md` → "🏆 Fase 2 — Round of 32"](ENGRAM_PROMPTS.md).**

**Done this round (25 jun 2026), all on `main`:**
- [x] **Stabilise the public world** — scans Turbo regardless of the network toggle so
      every wallet's builds are consistently visible to judges. (`09aefe2`)
- [x] **Audio mute toggle** — persisted 🔊/🔇 in the header; closes the last open item
      of Prompt 6. (`14f1c6c`)
- [x] **Memory-driven loop on camera** — LLM haggling with Aldric (Prompt 10 v2): propose
      a price, he accepts / counters / refuses in character; trust persists to 0G. (`69b79e9`)
- [x] **AV polish — river** — softer faded banks, muted dusk teal, meandering width (no
      longer a flat saturated band). (`fd02145`) + a touch more **moonlight fill** at night.
- [x] **Market v2 (Prompt 14), 3 phases** — Aldric now **sells** goods (sharper axe, sapling,
      buy wood/stone) with a **house-edge spread** (buy > sell, can't be arbitraged against the
      haggle); wood is **dynamically priced** (tree scarcity × coin inflation); and **stone** is a
      new **mineable** resource (rock outcrops, same hold-action) that's tradeable. Purchases
      build Aldric's trust and persist to 0G. (`d71358b`, `fbef41a`, `db60162`)
- [x] **Player relations MVP** — public-world wallets can be marked neutral/allied/hostile;
      relations persist in the player's 0G world bundle and public builds get relation markers.
      Hostile wallets can now be raided via outgoing `RaidEvent`s: the attacker spends stone,
      saves their world bundle to 0G, and the on-chain registry root makes the event discoverable.
      Defender bundles are not directly mutated.
- [x] **Repair/durability complete loop** — buildings have persisted HP, show damage visually with
      WebGL HP bars, and repair costs wood; Aldric sells repair kits as a repair boost. Public
      raids and repairs are event-sourced (`RaidEvent`/`RepairEvent`) in 0G bundles, discoverable
      through the registry root, and shown in a maintenance log. Allied wallets can repair public
      buildings without directly mutating the owner's bundle. Wallet-loaded/public builds are
      clamped on hydrate so bad 0G data cannot cover the camera.

**Still open (deferred):**
1. Real-time multiplayer (biggest differentiator; new prompt #19, scoped) — **deferred to a
   later phase** by decision; coordinate with martelaxe when picked up.
2. Further AV polish if wanted: avatar silhouettes (plain but recognisable).
3. Repair/durability polish (Prompt 18) — core loop is implemented; future polish can add richer
   building-specific history panels, defense upgrades, and demon schedule windows.
4. 💡 **Mining = real 0G Compute work** (Prompt 20) — on-thesis future idea: gathering stone
   triggers a verifiable 0G compute job (proof-of-useful-work), not a placeholder.

Full backlog (still open) in `docs/ENGRAM_PROMPTS.md`: raids/sabotage fairness from player
relations (13: defense/weapon upgrades), more market goods/stock depth (14), fair demon sieges (15), gathering
animation polish (16), editable terrain / bigger map (17), repair/damage UI polish (18),
verified 0G-compute mining live test/funding (20).
