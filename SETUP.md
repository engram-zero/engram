# Engram — Setup Guide

**Engram** is a text RPG where AI-driven NPCs keep persistent memory of you on
**0G Storage**. Your wallet is your identity; three villagers in Aldenmoor
(Aldric, Maren, Sable) remember every conversation across sessions.

This guide gets you from a fresh clone to a running game at `localhost:3000`.

---

## 1. Prerequisites

- **Node.js 18.18+** (Node 20 LTS recommended) and **npm**
- **MetaMask** browser extension
- One AI API key (either works — see step 3):
  - **Anthropic** (Claude) — best in-character writing, or
  - **Google** (Gemini) — has a free tier
- A little **OG testnet** gas (free from a faucet — step 5)

---

## 2. Install dependencies

```bash
git clone https://github.com/engram-zero/engram.git
cd engram
npm install --legacy-peer-deps
```

> ⚠️ **The `--legacy-peer-deps` flag is required.** This project pins React 19,
> and some dependencies (WalletConnect/web3modal, three.js helpers) declare
> peer ranges that npm's strict resolver rejects. `--legacy-peer-deps` lets the
> install proceed; it's safe here. Use it for any future `npm install <pkg>` too.

---

## 3. Create your `.env.local`

Copy the template and fill in **one** AI key:

```bash
cp .env.example .env.local
```

Open `.env.local` and set either `ANTHROPIC_API_KEY` **or** `GOOGLE_API_KEY`.
You don't need both — the server picks a provider automatically:

| Priority | Condition | Provider used |
|----------|-----------|---------------|
| 1 | `ANTHROPIC_API_KEY` is set | **Claude** (`claude-sonnet-4-6`) |
| 2 | only `GOOGLE_API_KEY` is set | **Gemini** (`gemini-1.5-flash`, free) |
| 3 | neither is set | Deterministic text fallback (UI still works, but NPCs are scripted) |

Minimal `.env.local` examples:

```bash
# Using Gemini (free):
GOOGLE_API_KEY=AIza...your-key...

# — or — using Claude:
ANTHROPIC_API_KEY=sk-ant-...your-key...
```

The 0G Storage RPC defaults are already baked in, so you don't need to set them.
Keys live only on the server (`/api/npc`) and are never sent to the browser.
`.env.local` is gitignored — never commit real keys.

### Get a GOOGLE_API_KEY (free)

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with a Google account → **Create API key**
3. Copy it into `GOOGLE_API_KEY` in `.env.local`

### Get an ANTHROPIC_API_KEY

1. Go to **https://console.anthropic.com**
2. Sign in → **API Keys** → **Create Key**
3. Copy it into `ANTHROPIC_API_KEY` in `.env.local`
   (Claude usage is paid — add billing in the console. Prefer Gemini if you want zero cost.)

---

## 4. Add the OG-Galileo-Testnet to MetaMask

Engram writes memory to 0G Storage on the **0G Galileo Testnet**. Add the network:

**Option A — manually in MetaMask:**
Settings → Networks → **Add a network** → **Add a network manually**, then enter:

| Field | Value |
|-------|-------|
| Network name | `0G Galileo Testnet` |
| New RPC URL | `https://evmrpc-testnet.0g.ai` |
| Chain ID | `16602` |
| Currency symbol | `OG` |
| Block explorer URL | `https://chainscan-galileo.0g.ai` |

Save, then switch MetaMask to **0G Galileo Testnet**.

**Option B — automatically:** When you connect your wallet in the app, it will
prompt you to add/switch to the 0G Galileo Testnet — approve the prompt.

---

## 5. Get free testnet tokens

Saving an NPC's memory to 0G Storage is an on-chain write, so you need a little
gas (testnet **OG**, worth nothing real):

1. Copy your wallet address from MetaMask (make sure the **0G Galileo Testnet** is selected).
2. Go to **https://faucet.0g.ai**
3. Paste your address and request tokens.
4. Wait ~30s, then confirm the balance shows in MetaMask.

A faucet drip is enough for many conversations — each "Leave & save" is one small transaction.

---

## 6. Run the game

```bash
npm run dev
```

Open **http://localhost:3000**:

1. Click **Connect** and approve MetaMask (switch to 0G Galileo Testnet if asked).
2. Walk up to a villager (Aldric, Maren, or Sable) and talk.
3. Click **Leave & save** to persist that conversation to 0G — confirm the one MetaMask signature.
4. Reconnect later (even from another browser) and they'll remember you.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm install` fails with `ERESOLVE` peer errors | You forgot `--legacy-peer-deps`. Re-run with it. |
| NPCs reply with `(set ANTHROPIC_API_KEY or GOOGLE_API_KEY …)` | No AI key detected. Check `.env.local` and **restart `npm run dev`** (env vars load at boot). |
| Wallet won't connect / wrong network | Switch MetaMask to **0G Galileo Testnet** (Chain ID 16602). |
| "Leave & save" fails | You're out of gas — get OG from https://faucet.0g.ai. |
| Changed `.env.local` but nothing changed | Stop and restart the dev server. |

---

## Useful links

- Gemini API key (free): https://aistudio.google.com/app/apikey
- Anthropic API key: https://console.anthropic.com
- 0G testnet faucet: https://faucet.0g.ai
- 0G Galileo explorer: https://chainscan-galileo.0g.ai
