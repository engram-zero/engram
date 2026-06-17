# Engram — Status / resume-here (handoff)

_Last updated: 16 jun 2026. Read this first when resuming._

## TL;DR
The whole game works **except the final save to 0G**, which is one step from done.
Saving now runs **server-side** (`/api/save`, sponsor wallet) and has cleared every
earlier blocker; the current failure is the on-chain `submit` returning
**"Failed to submit transaction"**, and the #1 suspect is **the sponsor wallet
(Account 3) has no testnet OG** (the faucet showed "missing bearer token", which may
have blocked funding).

## ✅ Working
- First-person explorable Aldenmoor (WASD + mouse-look, terrain, sky, forest).
- Dialogue is **real Claude** (cross-memory confirmed: Sable references Aldric/Maren).
- Rate-limit / size guard on `/api/npc` (verified).
- **Reads** from 0G work (client GET `/file?root=…`; the download endpoint allows CORS).
- Save architecture: client builds the full bundle → `POST /api/save` → server uploads
  to 0G with the 0G SDK (no CORS in Node).
- Pointer-lock UX fixes (release on GUI, no teleport on Leave).
- Deployed on Vercel (auto-deploy on push to `main`): https://engram-bay.vercel.app/

## ❌ The one remaining blocker: Leave & save → "Failed to submit transaction"

### How we got here (each fix unblocked the next error)
1. `Fee calc error: market() BAD_DATA` → **stale Flow contract address.** Fixed:
   `src/lib/0g/network.ts` now defaults to the current Galileo Flow
   `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296` (docs.0g.ai).
2. `eth_maxPriorityFeePerGas -32601` / `Internal JSON-RPC -32603` (no MetaMask popup) →
   **0G has no EIP-1559**, pre-flight fee/gas estimation aborted the tx. Fixed: legacy
   `eth_gasPrice` + explicit gasLimit, no `getFeeData`.
3. `transaction execution reverted` → our **hand-rolled fee + manual submit** were
   wrong. Fixed: let the **SDK** do submit+upload (`indexer.upload`, skipTx:false).
4. **CORS** blocked from the browser → moved the whole upload **server-side**
   (`/api/save`, sponsor wallet `ENGRAM_SPONSOR_KEY`).
5. `503` from the storage node → **Standard indexer is deprecated/down.** Fixed: default
   network is now **Turbo** (`src/app/providers.tsx`).
6. **← YOU ARE HERE:** on Turbo, node selection succeeds but the on-chain `submit`
   fails with **"Failed to submit transaction"** (the SDK's generic message).

### Most likely cause (check FIRST)
**The sponsor wallet (Account 3, key in `ENGRAM_SPONSOR_KEY`) has no / not enough OG.**
- The faucet at faucet.0g.ai showed **"missing bearer token"** — funding may have failed.
- **Action:** open MetaMask → Account 3 → OG-Galileo-Testnet → check the balance.
  If ~0, fund it: copy Account 3's address → faucet.0g.ai (resolve the bearer-token
  issue: reload / re-login / connect wallet; or try an alternate 0G faucet) → request OG.
- Each save costs ~0.002 OG of gas + a small storage fee, so even 0.5 OG is plenty.

### If Account 3 IS funded and it still fails
- Read **Vercel → the Project → Functions logs** for `/api/save`: the route logs
  `[api/save] …` and the SDK logs `Data prepared to upload root=…`, selected nodes,
  and the real submit error. That pinpoints revert vs gas vs nonce.
- Possible follow-ups: surface the SDK's underlying submit error (it currently returns a
  generic "Failed to submit transaction"); try without the `gasPrice * 2` bump; confirm
  `net.l1Rpc` (evmrpc-testnet.0g.ai) is reachable from the server.

## Env vars (Vercel, Production)
- `ANTHROPIC_API_KEY` — set ✅ (dialogue is live).
- `ENGRAM_SPONSOR_KEY` — set ✅ (Account 3 private key, server-only, no NEXT_PUBLIC). **But
  Account 3 must be funded.**
- `NEXT_PUBLIC_PROJECT_ID` — set (WalletConnect).
- 0G RPC/Flow vars — NOT set → code defaults used (correct; Flow read from node anyway).

## Roles (don't confuse them)
- **Player wallet** = your identity in the browser (e.g. Account 1). Signs/pays nothing now.
- **Sponsor wallet** = Account 3, key on the server, pays storage. Needs testnet OG.

## Key files (save path)
- `src/lib/memory.ts` — `writeMemory()` builds bundle → POST `/api/save`; reads stay client-side.
- `src/app/api/save/route.ts` — server-side 0G upload with the sponsor wallet.
- `src/lib/0g/uploader.ts` — `uploadToStorage()` wraps `indexer.upload` (returns txHash).
- `src/lib/0g/network.ts` — RPC + Flow defaults (Flow updated to current Galileo).
- `src/app/providers.tsx` — default network = Turbo.

## Submission to-dos (tournament, deadline Jun 23)
- [ ] **Fix the save** (above) — this is criterion #1 ("0G must do real work").
- [ ] Update the 0g.ai dashboard **Description** to the corrected, honest copy (no
      "MetaMask signature / no server / cross-device"; see chat history). Reframed:
      sponsored writes, keyed to wallet, auditable, can't be erased.
- [ ] (Optional) record a 2–3 min demo video.
- [ ] Backlog in `docs/ENGRAM_PROMPTS.md`: on-chain registry, mobile, textures, audio.
