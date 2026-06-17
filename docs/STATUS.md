# Engram — Status / resume-here (handoff)

_Last updated: 16 jun 2026. Read this first when resuming._

## TL;DR
The whole game works **except the final save to 0G**, which is one step from done.
Saving now runs **server-side** (`/api/save`, sponsor wallet) and has cleared every
earlier blocker. From the Vercel logs we now know the on-chain `submit` **reverts**
(`require(false)`) even though funding, node selection, Flow address and fee are all
correct — i.e. the **Flow contract rejects the SDK's submit**. The strong lead: we're on
the **outdated `@0glabs/0g-ts-sdk@0.3.0`** (Newton-era); Galileo's current SDK is
**`@0gfoundation/0g-ts-sdk@1.2.1`**. **Resume by upgrading the SDK** (details below).

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
6. `503` from Standard indexer → default to **Turbo**.
7. **← YOU ARE HERE:** on Turbo the `submit` tx **reverts** (`require(false)`).

### Diagnosed (17 jun, from Vercel Functions logs) — it's a CONTRACT REVERT
Ruled out: sponsor **funding** (balance = 0.5 OG ✅), **node selection** (Turbo ✅),
**Flow address** (node reports `0x22E03a…105296` ✅), **fee/value** (SDK sends the
computed market fee `122934579848n` ✅). The submit itself reverts:

```
execution reverted (no data; likely require(false)), action="estimateGas",
to=0x22E03a…105296, selector=0xef3e12dc, value = market fee
```

So the SDK does everything right and the **Flow contract rejects the submit**.

### Strong hypothesis (try FIRST tomorrow): the 0G SDK is OUTDATED
We use **`@0glabs/0g-ts-sdk@0.3.0`** (old, Newton-era — see `package.json`). The current
SDK for Galileo is **`@0gfoundation/0g-ts-sdk` v1.2.1** (new npm scope + major version).
`market()`/`pricePerSector()` still decode (stable ABI), but the `submit`
encoding/logic almost certainly changed on the new Flow contract → `require(false)`.

**Next action:**
1. `npm rm @0glabs/0g-ts-sdk && npm i @0gfoundation/0g-ts-sdk@^1.2.1 --legacy-peer-deps`
2. Update every import of `@0glabs/0g-ts-sdk` → `@0gfoundation/0g-ts-sdk` in
   `src/lib/0g/{blob,uploader,downloader,fees}.ts` and adapt to API changes
   (Blob/Indexer/MerkleTree/`submit` may differ — follow the v1.2.1 README and the
   official **0g-storage-ts-starter-kit**).
3. `npm run build`, then test **Leave & save** (sponsor Account 3 is already funded).

Refs: https://github.com/0glabs/0g-ts-sdk ·
https://github.com/0gfoundation/0g-storage-ts-starter-kit ·
https://www.npmjs.com/package/@0gfoundation/0g-ts-sdk

### If the SDK upgrade is NOT the fix
- Decode the revert further or ask in the 0G Discord with the calldata above.
- Read the full `/api/save` Vercel Functions logs (the route logs
  `[api/save] sponsor 0x… balance=…` and the SDK logs node status + submit error).
- Try without the `gasPrice * 2` bump (`src/app/api/save/route.ts`).

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
