# Engram — video script (Zero Cup)

Goal: show **real game mechanics**, each anchored to 0G — but feel less like a feature list and
more like: *"this world remembers, changes, and expands, and that state belongs to the player,
thanks to 0G."* Incorporates Codex's review: lead with the thesis, keep it lean, be technically
precise, and let one strong path carry the video.

## ⭐ Golden rules (read first)

1. **Open AND close with the thesis** (with variation): *"In Aldenmoor, your story is yours — and
   it lives on 0G."* → close: *"Engram isn't just an RPG with AI characters. It's a world whose
   memory, land, economy, and creations live on 0G."*
2. **Be technically precise about 0G** (a judge will notice):
   - NPC memory / world state / creations → say **"stored on 0G"**, **"persistent 0G memory"**,
     **"saved to 0G Storage"**. **Do NOT** call this "on-chain."
   - **"On-chain"** is reserved for **land / parcels** (ParcelRegistry) — that IS a contract.
3. **Don't cram.** ~60–90s. Pick the lean path below; everything else is optional B-roll. Market,
   per-building storage, alliances, loot packs, day/night are nice but **can saturate** — use at
   most one or two as flavor, not as beats.
4. The single best line is the thesis. Let it breathe.

## Recording tools (URL modes)

- `?time=day` → fixed midday (sun high). `?time=night` → fixed night (moon, torches, crickets).
  Both **keep the HUD** (unlike `?shot`, which hides all UI for clean thumbnails).
- `?day=1` is different (flat debug lighting) — for the video use `?time=`.
- Enter, then switch to aerial with the button or `V`. Tip: record a scene `?time=day` then
  `?time=night` for a day→night cut — but use it as *texture*, not a whole section.

## 🎯 The lean path (this is THE script — Order A, trimmed)

Five beats + a proof close. Each beat = one clear mechanic + one line naming its 0G anchor.

1. **Wallet + thesis.** Connect the wallet. *"In Aldenmoor, your story is yours — and it lives on
   0G."* (The onboarding card already names it.)
2. **NPC memory (voice).** Talk to Sable with the 🎤 mic; ask if she remembers you. She cites
   something real about you (a past sale, a promise) — and the **"📜 recalls N past conversations ·
   loaded from 0G Storage · <hash>"** banner proves it. *"She remembers me — her memory is stored
   on 0G, not scripted."* (Her voice = TTS.)
3. **Gather + Save World.** Chop/mine a bit, watch the inventory rise, then **Save World**. *"I
   gather, and when I save, my world persists to 0G."*
4. **AI build.** In aerial, describe a structure by prompt → the AI sculpts it; **Save World**
   publishes it. *"I describe it, the AI builds it, and my creation is saved to 0G."*
5. **Claim land (the strong point — the on-chain moment).** Claim a frontier parcel → the map grows
   a cell. *"I claim land — this parcel is owned **on-chain** via ParcelRegistry; the map itself is
   decentralized state."*

**Proof close.** Open the **🌍 World Treasury** and **Memory** panels — the economy and the memory
bundle, both derived from 0G. Then the closing thesis line (above).

> Total: 6 quick beats. Resist adding more. If a beat runs long, cut B-roll, not the thesis.

## Optional B-roll / flavor (use sparingly, ≤2)

- **Trade + haggle with Aldric** (economy is 0G state; his memory of the deal persists). A great
  *substitute* for beat 3 if you'd rather show economy than raw gathering.
- **Day↔night cut** (`?time=`) over one existing beat — atmosphere, not a section.
- **Verticality**: build stairs / a tower and climb it. **Storage**: press **E** at a building.
  **Alliances**, **loot packs** (silver/gold glowing in a claimed parcel). One of these, max, as a
  2-second "there's more" flourish.

## 🎙️ Voiceover — FINAL (raw text, ~75s)

Read as-is; each stanza = one shot that shows the UI proving the 0G anchor.

```
Every game world forgets you the moment you leave.
Not this one.

This is Aldenmoor — and here, your story is yours.
It lives on 0G.

I connect my wallet… and step into a world that remembers.

I talk to Sable — with my voice — and she remembers me.
Our history, our deals — loaded from 0G Storage.

I chop, I mine, I gather… and when I save, my world state is written to 0G.
It's mine.

I haggle with Aldric — and he remembers the bargain.

From above, I describe what I want… and AI builds it.
My creation, saved to 0G.

I claim new land — and the map itself grows, parcel by parcel, owned on-chain.

Memory. Land. Economy. Creations.
All of it becomes player-owned state.

Engram isn't just an RPG with AI characters.
It's a living world that remembers — and it lives on 0G.
```

> Precision notes: "on-chain" appears ONLY on land (ParcelRegistry); everything else is "0G
> Storage / written to 0G / saved to 0G". Every beat must SHOW the proof UI (recall banner, save
> hash, the build, ParcelRegistry, Treasury/Memory). Optional read: "and *the* AI builds it" flows
> slightly better out loud.

### ElevenLabs v3 version (audio tags)

For **Eleven v3 (alpha)** — the tags in `[]` cue intonation. Use Stability ~35–45%, Style moderate,
and record stanza by stanza. Tags are *cues*, not commands; if one is ignored, the punctuation
(— …) and line breaks carry it. Safest tags: `[whispers] [serious] [curious] [excited] [sighs]`.

```
[serious] Every game world forgets you the moment you leave.
[whispers] Not this one.

[warm] This is Aldenmoor — and here, your story is yours.
[confident] It lives on 0G.

[curious] I connect my wallet… and step into a world that remembers.

[warm] I talk to Sable — with my voice — and she remembers me.
[sincere] Our history, our deals — loaded from 0G Storage.

[determined] I chop, I mine, I gather… and when I save, my world state is written to 0G.
[proud] It's mine.

[amused] I haggle with Aldric — and he remembers the bargain.

[awe] From above, I describe what I want… and the AI builds it.
[proud] My creation, saved to 0G.

[confident] I claim new land — and the map itself grows, parcel by parcel, owned on-chain.

[building intensity] Memory. Land. Economy. Creations.
[emphatic] All of it becomes player-owned state.

[resolute] Engram isn't just an RPG with AI characters.
[confident] It's a living world that remembers — and it lives on 0G.
```

> For **v2 / Turbo** use the plain (untagged) block above — those models READ `[tags]` aloud.

## Alternative orders (if you want a different feel)

- **Order B — "0G first"** (technical judges): open on claim land / on-chain, then memory, build,
  gather, close on the thesis. Riskier — demands the judge grasp the architecture early.
- **Order C — "Day and night"** (atmosphere): split the beats across a day half and a night half.
  Only if the day→night look is a selling point; otherwise it fragments the story.
