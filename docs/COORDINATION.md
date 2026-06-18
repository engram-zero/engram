# Engram — Team coordination

Who owns what, and the **seams** between us so we don't step on each other.
Keep changes on your side of a seam; don't change a seam's interface without a heads-up.

## People & areas
- **martelaxe** → 0G / on-chain. Contracts, the EngramRegistry, and the **persistence
  of game state** (memory bundle, resources, coins) to 0G / contracts.
- **world/UI dev** → the 3D world, gameplay, HUD (Scene3D, map.ts, world.ts, textures).
- **art** → textures in `public/textures/` (see `docs/ART_ASSETS.md`).

## ✅ Already done (don't redo)
- **Memory → 0G**: works end-to-end. Sponsored server-side write (`/api/save`), reads
  client-side. Pointer anchored in **EngramRegistry** (`setRoot`, player signs). See
  `docs/STATUS.md` for the 0G gotchas (SDK package, CORS, no EIP-1559, Turbo default).
- **EngramRegistry** deployed at `0xD142048BcA7fC224d557C12F8adbAc70D4EC4067`
  (`contracts/EngramRegistry.sol`, `src/lib/registry/`).

## 🔌 The seam that matters now: world-state persistence
Gameplay resources/buildings are **client-side today** and need an owner for on-chain/0G
persistence. The seam is defined in **`src/lib/world.ts`**:

```ts
export interface WorldPersistence {
  load(wallet: string): Promise<WorldState>;     // { inventory:{wood,stone,coin}, choppedTrees:number[] }
  save(wallet: string, state: WorldState): Promise<void>;
}
export function setWorldPersistence(p: WorldPersistence): void; // register yours at startup
```

- **world/UI dev owns:** the gameplay store + actions (`chopTree`, `addResource`,
  `useWorld`) and the default `localWorldPersistence` (localStorage). DON'T change the
  store's public API.
- **martelaxe owns:** a real `WorldPersistence` backed by 0G / a contract (wood balance,
  coins, built things). Implement it and call `setWorldPersistence(yours)` once at
  startup (e.g. in a provider). **You do not need to touch Scene3D or gameplay code** —
  just swap the persistence. Keep `load/save` resilient (a failure must not break play;
  the store already wraps `save` in try/catch).

### Contract design notes for resources/coins (martelaxe's call)
- **Wood/resources**: could live in the same MemoryBundle-style doc on 0G (one
  `WorldState` blob per wallet, like memory), OR in an ERC-20-ish contract. Simplest first
  step mirrors memory: serialize `WorldState` → `/api/save`-style sponsored upload →
  anchor root (reuse the registry pattern, or a second registry slot). Coins as a real
  token come later (see `docs/ENGRAM_ECONOMY.md`).
- Whatever you choose, expose it ONLY through `WorldPersistence` so gameplay stays decoupled.

### Building system (Prompt 9) — heads up
`WorldState` will gain a `buildings: Building[]` field (placed walls/houses). Split:
**9a** placement gameplay = world-dev; **9b** persisting `WorldState` (incl. buildings)
on 0G = **martelaxe**, via the SAME `WorldPersistence` seam (load/save unchanged). This
is the planned **second real 0G use case** (the player's built world on 0G). Full spec:
Prompt 9 in `docs/ENGRAM_PROMPTS.md`.

## ✅ Dual camera + avatar (Prompt 8a) — implemented (verify visually)
Done in `Scene3D.tsx`: `view: 'fp' | 'aerial'` (toggle key **V** + HUD button); aerial
uses a drei `<OrthographicCamera>` following a third-person **Avatar**; WASD moves the
avatar in world directions (W=north); FP/aerial share one player position (`posRef`) so
switching is seamless; chop/talk stay first-person. Build + typecheck pass — **please test
the aerial view live** (camera framing/zoom feel may want tuning). Original spec kept below:
- Add a `view: 'fp' | 'aerial'` toggle (key `V` + a HUD button) in `Scene3D`.
- **fp**: current first-person (PointerLockControls + `Player`). Unchanged.
- **aerial**: a drei `<OrthographicCamera makeDefault>` looking down; render a **third-person
  avatar** (simple capsule+head) at the shared player position; **WASD moves the avatar in
  WORLD directions** (W = north −Z, S = +Z, A = −X, D = +X) and rotates it to face the
  move; the ortho camera follows above; wheel = zoom. No pointer lock in aerial.
- Share one player XZ position between both modes (a ref in `Scene3D`) so switching views
  is seamless. Disable `Player` + PointerLock while in aerial.
- Reuse `resolveCollision`, `getHeightAt`, and the chop/talk proximity (works in both views).
- Keep dialogue/save/memory untouched. `tsc --noEmit` + `next build` must pass.

## Build hygiene
- Installs need `--legacy-peer-deps`. `tsc --noEmit` and `npm run build` must pass before push.
- Vercel auto-deploys `main`. Don't break the working memory→0G loop (criterion #1).
- Task backlog & vision: `docs/ENGRAM_PROMPTS.md`. Project state: `docs/STATUS.md`.
