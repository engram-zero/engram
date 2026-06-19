# Engram — Status & 0G integration notes

_Last updated: 18 jun 2026. If you're an AI/contributor touching storage, read the
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
merchant loop** (sell wood for coin, raising his trust/memory); and **audio scaffolding**
(silent-safe cues wired for ambience/foley/UI, awaiting assets/mute/positional polish).
Player-built **houses are now enterable** (hollow walls + door gap), and AI voxel
construction now snaps to a **fine anti-overlap grid** so generated shapes read more
like deliberate sculptures than coarse overlapping cubes.

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

## Remaining for the Jun 23 submission
- [x] Save to 0G working end-to-end (criterion #1). ✅
- [ ] Update the 0g.ai dashboard **Description** to the corrected, honest copy (no
      "MetaMask signature / no server / cross-device" — see README / chat history).
- [ ] (Optional) 2–3 min demo video.
- [ ] Backlog in `docs/ENGRAM_PROMPTS.md`: audio polish (6: mute + positional fire),
      deferred 429-UX check (7), richer world loop/economy follow-ups (8c+, 10 v2, 12).
