# Engram — video script (Zero Cup)

Goal: show **real game mechanics**, each one **anchored to 0G**. This is not a generic marketing
script — it's a shot list plus three recording orders and a voiceover, ready to record.

## Recording tools (URL modes)

- `?time=day` → fixed midday (sun high). Daytime shots without waiting for the real clock.
- `?time=night` → fixed night (moon up, torches, crickets). Nighttime shots on demand.
  - Both **keep the HUD** (unlike `?shot`, which hides all UI for clean thumbnails).
  - `?day=1` is a different thing (flat debug lighting); for the video use `?time=`.
- Combine with the view: enter, then switch to aerial with the button or `V`.
- Tip: record the **same scene** with `?time=day`, then `?time=night`, for a day→night cut.

## The 7 mechanics + their 0G anchor

### First person (on the ground)
1. **Wallet connect.** The hook: "your memory is yours, it lives on 0G." (The onboarding card
   already names the thesis.) → *0G: identity / ownership.*
2. **Voice conversation with an NPC.** Ask if they remember you; have them cite something about
   you beyond your name (a past sale, a promise). The banner **"📜 …recalls N past conversations ·
   loaded from 0G Storage · <hash>"** is the visible proof. → *0G Storage: persistent memory read
   live.* (Voice: 🎤 mic = STT; the NPC voice = TTS.)
3. **Gathering resources** (wood / stone / minerals) and saving them. Chop/mine, watch the
   inventory rise; on Save World the state goes to 0G. → *0G: player-owned world state.*
4. **Trading + haggling with Aldric.** Sell, negotiate; his reputation/memory of the deal
   persists. → *0G: trade leaves a mark on the NPC's on-chain memory.* Also show the **Market**
   (medicinal herbs — losing HP now costs you, so healing matters).

Intercut **day and night** (with `?time=`) between these shots to show a living world.

### Aerial view (RTS)
5. **AI building.** Describe a structure by prompt → the AI sculpts it in blocks. On Save World the
   build is published to 0G. → *0G: player creations persisted.* (Bonus: build **stairs/a tower**
   and climb it — verticality; or open **storage** in any building with **E**.)
6. **Alliances / hostilities.** Mark a wallet allied or hostile; that enables repairing or
   raiding. → *0G: social relations as shared state.*
7. **Claim land (the strong point).** Claim a frontier parcel → ParcelRegistry on-chain; the map
   grows cell by cell, each parcel owned on 0G, and it comes with a **surprise loot pack** (wood/
   stone/silver/gold by rarity). → *0G: verifiable on-chain land; the map itself is decentralized
   state.*

### 0G panels to show (B-roll)
- **🌍 0G / World Treasury**: economy derived from 0G state (scarcity pricing, treasury).
- **Memory**: the per-wallet JSON bundle living on 0G Storage.
- Note: the recall banner reads **"0G Storage"** so the glyph isn't misread as "oG."

## Three suggested orders

### Order A — "The player's journey" (narrative, recommended)
Follows the natural arc of a session; easy to narrate.
1 Wallet → 2 Voice/memory → 3 Gathering → 4 Trading → (switch to aerial) → 5 AI building →
7 Claim land → 6 Alliances. Close: Memory + Treasury panels showing **everything** landed on 0G.

### Order B — "0G first" (technical, for judges who reward the thesis)
Open strong with the differentiator.
7 Claim land (on-chain map) → 5 AI building → 2 Voice/memory (0G memory) → 3 Gather/save →
4 Trading → 6 Alliances → 1 Wallet up front as a prerequisite. Each beat: a one-line "this lives on
0G because…".

### Order C — "Day and night" (atmosphere + mechanics)
Structure the video by ambience to show off the world.
- **Day (`?time=day`)**: 1 Wallet → 3 Gathering → 4 Trading → 5 AI building.
- **Night (`?time=night`)**: 2 Voice/memory (more intimate at night) → 6 Alliances → 7 Claim land.
- Close on a daytime Memory + Treasury shot.

## Suggested voiceover (~60–90s, based on Order A)
- (0:00) "In Aldenmoor, your story is yours — and it lives on 0G." *(connect wallet)*
- (0:08) "I talk to Sable… and she remembers me. It's not scripted: her memory loaded from 0G
  Storage." *(voice + recall banner)*
- (0:20) "I chop, I mine, I gather — and when I save, my world is written to 0G." *(gather + save)*
- (0:30) "I haggle with Aldric; the deal stays in his on-chain memory." *(trade)*
- (0:40) "From above, I describe and the AI builds — and it's published to 0G." *(AI build)*
- (0:50) "I claim land: every parcel is owned on-chain; the map itself is 0G." *(claim land)*
- (1:00) "Allies, enemies, the economy… it's all state that I own." *(alliances + Treasury/Memory)*
- (1:10) "Engram: built with prompts, remembered by 0G."

> Adjust timings to your footage; every beat should **show the UI that proves the 0G anchor**
> (recall banner, save hash, ParcelRegistry, Treasury).
