# Engram — Economy & Tokenomics

> "In Aldenmoor, your reputation is your currency."

This document outlines the economic design for Engram's token layer —
built on top of the persistent NPC memory system. This is a post-hackathon
roadmap; the MVP (Zero Cup submission) demonstrates the memory layer that
makes this economy possible.

---

## The Core Insight

Most Web3 games fail because their token has no intrinsic reason to exist.
Players earn tokens, sell them, price collapses, everyone leaves.

Engram is different because **the scarce asset is not the token — it's reputation.**

A player who has spent 6 months building trust with Aldric has something
no one can buy with money: a verifiable history of decisions, stored permanently
on 0G Storage. The token (`$ENGRM`) is just the medium of exchange for
trading access to that reputation and the world it unlocks.

---

## The Token: $ENGRM

| Property | Value |
|---|---|
| Standard | ERC-20 on 0G Chain |
| Supply model | Controlled emission tied to in-world activity |
| Sink mechanisms | Paying NPCs, bribing Sable, unlocking roles |
| Source mechanisms | Completing quests, selling information, holding roles |

The token has value because **it is the only way to access certain actions
in the world** — and those actions produce real outcomes (information,
alliances, territory) that other players want.

---

## The Three Pillars of Value

### 1. Reputation is scarce and verifiable

Every interaction with an NPC is stored on 0G Storage, permanently and
immutably. A player's trust_level with Aldric, their combat record with
Maren, their debt history with Sable — all of it is on-chain.

This creates a **verifiable identity** that:
- Cannot be faked (it accumulates over real time)
- Cannot be erased (not even by the developer)
- Can be read by anyone (other players, smart contracts, other games)

High reputation = access to things low-reputation players cannot reach.
That scarcity is real.

### 2. Information has market value

Sable knows things. She aggregates what Aldric and Maren know about every
player in the village. That information has value:

- A merchant wants to know if a new trading partner has a history of debt
- A guild wants to verify a recruit's combat record with Maren
- A player wants to know who betrayed them

Sable charges $ENGRM for this information. Players pay because the
alternative — trusting a stranger — is riskier.

### 3. Roles can be owned

With sufficient reputation and $ENGRM, players can take on roles in the
village economy:

- **Merchant** (like Aldric): set prices, take commission on trades,
  control the flow of goods in/out of Aldenmoor
- **Guard Captain** (like Maren): issue or revoke safe passage, charge
  tolls, hire other players for protection
- **Broker** (like Sable): sell information, broker deals, take cuts
  from introductions

Role ownership creates a player-driven governance layer where the NPCs
are the initial holders and players gradually replace them.

---

## Economic Flows

```
PLAYER ACTIONS                    TOKEN FLOWS
──────────────────────────────    ──────────────────────────────
Complete a quest for Aldric   →   Aldric's treasury → Player wallet
Sell information to Sable     →   Buyer wallet → Sable's treasury → Player wallet (commission)
Pay debt to Aldric            →   Player wallet → Aldric's treasury
Bribe Sable for info          →   Player wallet → Sable's treasury
Hire a player as guard        →   Player wallet → Guard's wallet
Buy a merchant role           →   Player wallet → Village treasury (burn/lock)
```

The village treasury accumulates $ENGRM from role purchases and fees.
A portion is burned (deflationary), a portion funds new quests (inflationary
but tied to activity). The net emission is designed to be slightly deflationary
at scale.

---

## Why Players Put In Real Money

There are only three historically valid reasons someone pays real money
in a game:

### 1. Save time
If your reputation with the NPCs determines what you can do in the world,
a new player might pay to:
- Buy a "reputation report" about how to build trust faster
- Purchase access to a high-reputation player's services
- Acquire a starting position with neutral (not default) NPC attitude

**This is Engram's strongest monetization lever.** Time = money, and
building reputation takes real time.

### 2. Status
Owning the Merchant role in Aldenmoor is visible on-chain. Other players
see it. It signals competence, longevity, and investment in the world.
People pay for status in every game that has ever existed.

### 3. Expected return
If a player believes the Merchant role will generate $ENGRM income
over time (from commissions), they'll pay more than the current cost
to acquire it — the same logic as buying a business.

This only works if the game has real players generating real activity.
Which is why the memory layer (the Zero Cup MVP) comes first:
**make a game people actually want to play, then add the economy.**

---

## The Failure Mode to Avoid

> "Play to earn" games where the only reason to play is to earn.

When Axie Infinity, StepN, and dozens of others launched token economies,
players came for the money — not the game. When prices fell, everyone left.

Engram's defense:
1. **The game is intrinsically interesting** — NPCs that remember you are
   genuinely more compelling than ones that don't. Players would play
   even without a token.
2. **Reputation takes time** — you can't farm it overnight. The economy
   rewards long-term players, not bots.
3. **Information is the product** — the game produces something
   (verified player histories) that has value outside the game itself.

---

## Reputation as Cross-Game Identity

Because the memory bundle lives on 0G Storage (not in Engram's database),
other games can read it.

A player's Aldenmoor reputation becomes a **portable identity**:

- A trading game could offer better rates to players with high Aldric trust
- A combat game could grant veteran status to players with a strong Maren record
- A social game could verify that a player has never defaulted on debts

This is the long-term vision: Engram's reputation layer becomes an identity
primitive for the broader Web3 gaming ecosystem. The `$ENGRM` token is the
incentive layer that makes reputation worth building.

---

## Roadmap

| Phase | What ships | When |
|---|---|---|
| **Phase 0 — Memory** | NPC memory on 0G Storage, Claude/Gemini dialogue, Zero Cup MVP | June 2026 |
| **Phase 1 — Quests** | Structured quests with $ENGRM rewards, NPC treasury wallets | Q3 2026 |
| **Phase 2 — Roles** | Player-owned roles, role marketplace, governance | Q4 2026 |
| **Phase 3 — Identity** | Cross-game reputation API, SDK for other developers | 2027 |

---

## For the Judges (Zero Cup Pitch)

The Zero Cup submission is Phase 0 — the memory layer.

We're not pitching a token. We're demonstrating that **persistent, player-owned
NPC memory is possible on 0G** — and that it's the correct foundation for a
game economy that doesn't collapse.

The question we answer today:
> "Can an NPC remember you across sessions, devices, and game restarts,
> with the memory stored on-chain and owned by the player?"

The answer is yes. And once you have that, everything else follows.

---

*Engram — Zero Cup 2026 — Build on 0G. Own your story.*
