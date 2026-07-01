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

## Suggested voiceover (~75s, the lean path)

- (0:00) *"In Aldenmoor, your story is yours — and it lives on 0G."* — connect wallet.
- (0:10) *"I talk to Sable, and she remembers me — her memory is stored on 0G, not scripted."* —
  voice + recall banner.
- (0:24) *"I gather wood and stone, and when I save, my whole world persists to 0G."* — gather +
  Save World (show the save/hash).
- (0:38) *"From above, I describe a build, the AI shapes it, and my creation is saved to 0G."* —
  AI build + save.
- (0:52) *"I claim land — this parcel is owned on-chain; the map itself is decentralized state."* —
  claim land (ParcelRegistry).
- (1:04) *"The economy, the memory, the land — it's all state that I own."* — Treasury + Memory
  panels.
- (1:12) *"Engram isn't just an RPG with AI characters. It's a world whose memory, land, economy,
  and creations live on 0G."*

> Every beat must **show the UI that proves the 0G anchor** (recall banner, save hash,
> ParcelRegistry, Treasury). Precision + rhythm over feature count.

## Alternative orders (if you want a different feel)

- **Order B — "0G first"** (technical judges): open on claim land / on-chain, then memory, build,
  gather, close on the thesis. Riskier — demands the judge grasp the architecture early.
- **Order C — "Day and night"** (atmosphere): split the beats across a day half and a night half.
  Only if the day→night look is a selling point; otherwise it fragments the story.
