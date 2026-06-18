# Engram — Demo video script (~90s)

Goal: in 90 seconds make a judge believe the one thing that matters — **NPCs that
truly remember you, with that memory stored on 0G and recalled across sessions**
(tournament criterion #1: "0G must do real work"). Show it, don't tell it.

- **Length:** 90s (hard cap; judges skim). Keep narration tight.
- **The money shot:** the page **reload** where the NPC greets you by name. Everything
  builds to that.
- **Record at:** https://engram-bay.vercel.app/ — Turbo network, a funded sponsor wallet
  set in Vercel, an AI key set (real Claude dialogue). Have the 📜 Memory panel ready.
- **Tip:** rehearse one full run first; pre-fund the sponsor; pre-connect the wallet so
  you don't film the WalletConnect modal.

> Narration below = martelaxe's polished script. Timings are a guide; the only
> non-negotiable is that the **reload → it remembers** beat lands clearly.

---

## Shot list

### 0:00–0:08 — Hook (title + thesis)
- **On screen:** the title screen ("ENGRAM · Aldenmoor").
- **VO:** *"In most games, NPCs forget you. Engram's don't — and no one can make them forget."*

### 0:08–0:22 — Enter the world (first person)
- **Do:** land already connected → walk through Aldenmoor in first person (WASD + mouse),
  approach an NPC (e.g. Sable).
- **VO:** *"Your wallet is your identity. Walk up to a villager and talk."*

### 0:22–0:42 — A memorable interaction
- **Do:** open dialogue. Type something specific, e.g. **"My name is AriiBen, remember it."**
  Send. Show the NPC respond in character; pick a choice that visibly moves trust.
- **VO:** *"Real AI dialogue — but with persistent state. Trust, debts, mood, and past
  interactions are tracked per player."*

### 0:42–0:55 — Write it to 0G
- **Do:** **Leave & save** → the banner shows **✓ Saved to 0G · root … · tx …**. Let the
  root/tx hashes be readable for a beat.
- **VO:** *"When you leave, the memory bundle is written to 0G Storage: content-addressed,
  auditable, and anchored by its root hash."*

### 0:55–1:12 — THE PAYOFF: reload → it remembers (criterion #1)
- **Do:** **reload the page** (F5) — show the reload happening. Walk back to the same NPC.
  It greets you **by name** ("AriiBen —…"). Then open **📜 Memory**: trust (e.g. 57/100)
  and the interaction log listing your past actions.
- **VO:** *"Reload. New session. Same wallet. The NPC still remembers — because the state
  doesn't live in our database. It lives on 0G."*

### 1:12–1:30 — Why it matters + vision
- **On screen:** a quick text card (optionally over a slow aerial pan of the village).
- **VO:** *"This RPG is the proof of concept. Engram is a portable state layer for
  AI-native game objects: NPCs, items, terrains, environments, and agents. Each object can
  expose a memory bundle, anchored on-chain and reusable across games, simulations, and
  player-owned worlds."*
- **End card:** Engram · engram-bay.vercel.app · github.com/engram-zero/engram

---

## Optional extra beat — second 0G use case (only if you have time, ~6s)
If the cut has room, slot this between the payoff and the vision card. It proves 0G does
real work **twice** (memory *and* the built world):
- **Do:** press **V** for aerial → 🤖 **Build with AI**, type *"a small tree"* → **Place**
  → **Save World**. (Other players' builds already show around you — the public world.)
- **VO:** *"And the world you build persists on 0G too — owned by your wallet, visible to
  everyone."*
> Keep it tight; the memory reload remains the headline. Drop this if it pushes past 90s.

## What to emphasize (and avoid)
- **Emphasize:** the reload-and-recall moment; the root/tx hashes (proof it's on 0G);
  "auditable", "can't be erased". That's criterion #1, on screen.
- **Now true (don't shy away):** **cross-device** recall — the bundle pointer is anchored
  on-chain in **EngramRegistry** (`rootOf(wallet)`), so the same wallet on another device
  reads the root and rehydrates from 0G. (The demo uses same-device **reload** because it's
  the most reliable shot, but cross-device is a legitimate claim now.)
- **Still avoid claiming:** "**your wallet pays / one signature**" — the storage write is
  **sponsored server-side** (the player signs only the registry pointer when the root
  changes). Don't claim any feature you don't show. Tournament rules disqualify
  misrepresenting functionality.
- **Optional B-roll:** a slow first-person pan over the village + campfire (and the
  day/night sky) for the intro, to look like a game and not an app.

## 30-second cut (if a shorter version is needed)
Hook (5s) → one interaction "remember my name" (8s) → Leave & save ✓ (5s) → reload →
NPC greets by name + Memory panel (10s) → end card (2s).
