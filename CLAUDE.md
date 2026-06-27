# Engram — agent guide (read me first)

Engram is a browser RPG for the **0G Zero Cup**: NPCs in the village of Aldenmoor
keep persistent, player-owned **memory on 0G Storage**. Next.js 15 + TypeScript +
React 19 · Three.js / @react-three/fiber / drei · ethers v6 · wagmi.

## ⭐ Prompt-logging workflow (REQUIRED for every task)

The Zero Cup rewards **building with prompts**, so we keep an auditable trail. For
**every** task a human asks you to do, before you finish:

1. **Synthesize the task prompt.** Write the self-contained prompt that *would
   create the task* — the intermediate artifact between the human's casual request
   and your result (context + what to change + acceptance). This is the deliverable
   the team wants recorded, not just the code.
2. **Append an entry to [`docs/PROMPT_LOG.md`](docs/PROMPT_LOG.md)** (at the bottom,
   chronological) with this shape:
   ```
   ### <fecha> · <título corto>
   **Pedido (humano):** <lo que dijo la persona, resumido>
   **Prompt sintetizado:** <el prompt autocontenido que define la tarea>
   **Qué se hizo:** <cambios>  · **Commit:** <hash>
   ```
3. Commit `PROMPT_LOG.md` together with the change (so the prompt and its result
   share a commit). If you can't know the hash yet, commit the code first, then add
   the log entry referencing it.

`PROMPT_LOG.md` = evidence of what was built. `docs/ENGRAM_PROMPTS.md` = backlog of
**future** task-prompts. Don't confuse them.

## Conventions
- **Run `npx tsc --noEmit` before committing.** Prefer not to run `next build` while
  a dev server holds `.next` (Windows EPERM) — rely on tsc.
- **Use `pnpm install`** — Vercel deploys with **pnpm + `--frozen-lockfile`**, so
  `pnpm-lock.yaml` is the single source of truth. Adding/updating a dep MUST run
  `pnpm install` (which updates `pnpm-lock.yaml`); installing with **npm breaks the
  Vercel build** (stale pnpm lockfile). pnpm handles the react19/web3modal peer
  conflict with no flags. (`package-lock.json` is gitignored — don't commit it.)
- End commit messages with the co-author identity of the actual agent that made
  the change. Do not impersonate a different agent just because this file is
  named `CLAUDE.md`. If Codex did the work, use Codex's co-author identity; if
  Claude did the work, use Claude's co-author identity.
- **Never commit** `.claude/settings.json` (local harness config) or any real key.
  `.env*` are gitignored. `ENGRAM_SPONSOR_KEY` is a server-only throwaway testnet key.
- Multiple people push to `main` concurrently (martelaxe = 0G/contracts, henrique =
  combat). `git pull --no-edit` before pushing; resolve merges; re-run tsc.

## Where things live
- **0G storage gotchas** (read before touching storage): [`docs/STATUS.md`](docs/STATUS.md).
- **Ownership seams / who-owns-what**: [`docs/COORDINATION.md`](docs/COORDINATION.md).
- Single source of truth for the map (terrain height, props, colliders):
  [`src/components/engram/map.ts`](src/components/engram/map.ts).
- Player world state + persistence seam: [`src/lib/world.ts`](src/lib/world.ts)
  (`WorldPersistence`; 0G-backed impl in `src/lib/world-0g.ts`).
- The 3D scene (most gameplay): [`src/components/engram/Scene3D.tsx`](src/components/engram/Scene3D.tsx).
