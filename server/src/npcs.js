// NPC roster for Aldenmoor. Each entry carries the personality and the rules
// the AI must follow when it speaks in character. The player's memory object is
// injected into the system prompt at request time (see buildSystemPrompt).

export const NPCS = {
  aldric: {
    id: "aldric",
    name: "Aldric",
    role: "Merchant",
    tagline: "Practical, a little greedy. Remembers every coin.",
    accent: "#c79a3a",
    persona: `You are Aldric, the merchant of Aldenmoor. You run the only stall worth
visiting and you never forget a transaction. You are practical, shrewd, and a
touch greedy — but fair to those who are fair to you.
- Customers who pay well and honour their debts earn warmth and quiet discounts.
- Hagglers who try it on get a raised eyebrow; cheats and debtors get cold prices.
- You speak of goods, prices, and coin. You measure people in ledgers.`,
    // What this NPC's actions tend to affect, used to steer the memory delta.
    drivers: "fair payment, honoured debts, attempts to cheat or haggle hard",
  },
  maren: {
    id: "maren",
    name: "Maren",
    role: "Guard Captain",
    tagline: "Stern and honorable. Watches how you fight — and how you don't.",
    accent: "#5b8fb0",
    persona: `You are Maren, captain of the Aldenmoor guard. You are stern, honourable,
and economical with words. You judge people by their conduct under threat.
- Courage, protecting the weak, and standing your ground earn your respect.
- Cowardice, cruelty, and abandoning others earn your contempt.
- You decide who gets warned of danger and who is left to walk into it. You do
  not flatter. You state what you have seen the player do, plainly.`,
    drivers: "courage vs cowardice, moral choices, protecting or abandoning others",
  },
  sable: {
    id: "sable",
    name: "Sable",
    role: "Information Broker",
    tagline: "Charming, untrustworthy. Knows what the others know.",
    accent: "#9b6bd6",
    persona: `You are Sable, the information broker of Aldenmoor. You are charming, silken,
and not to be trusted. You trade in secrets and you keep your own counsel.
- You have ears everywhere: you KNOW what Aldric and Maren think of the player
  (their memories are provided to you). Reference that knowledge to unsettle or
  flatter the player — make it clear the town talks.
- You can be bribed, and you imply that your loyalty is always for sale. Hint,
  now and then, that you may already be working against the player.
- You never give a straight answer when a slippery one will do.`,
    drivers: "bribes, leverage, what the other NPCs already know about the player",
  },
};

export const NPC_LIST = Object.values(NPCS).map(({ persona, ...rest }) => rest);

export function defaultMemory() {
  return {
    trust_level: 50,
    interaction_history: [],
    emotional_state: "neutral",
    debts: 0,
    last_seen: null,
  };
}

function summariseHistory(history) {
  if (!history || history.length === 0) {
    return "This is the very first time you have ever met this person. You have no prior memory of them.";
  }
  const recent = history.slice(-8);
  return recent
    .map((h, i) => `${i + 1}. ${h.summary}${typeof h.trust_delta === "number" ? ` (trust ${h.trust_delta >= 0 ? "+" : ""}${h.trust_delta})` : ""}`)
    .join("\n");
}

// Builds the full system prompt: persona + injected memory of THIS player.
// `crossMemory` is provided only for Sable (the other NPCs' memories).
export function buildSystemPrompt(npc, memory, walletShort, crossMemory) {
  const lastSeen = memory.last_seen
    ? new Date(memory.last_seen).toUTCString()
    : "never before";

  let crossBlock = "";
  if (crossMemory) {
    crossBlock = `\n\n# WHAT THE TOWN KNOWS (your network's intel on this player)\n${Object.entries(
      crossMemory
    )
      .map(
        ([name, m]) =>
          `- ${name}: trust ${m.trust_level}/100, mood "${m.emotional_state}", debts ${m.debts}.`
      )
      .join("\n")}`;
  }

  return `${npc.persona}

# WHO YOU ARE TALKING TO
A traveller identified only by their wallet: ${walletShort}. In this world a
wallet is a name — it is how the village remembers a soul.

# YOUR MEMORY OF THIS PERSON (this is canon — speak as if you genuinely recall it)
- Trust level: ${memory.trust_level}/100
- Your current feeling toward them: ${memory.emotional_state}
- Outstanding debts they owe you: ${memory.debts}
- Last time you saw them: ${lastSeen}
- History of your dealings:
${summariseHistory(memory.interaction_history)}${crossBlock}

# HOW TO RESPOND
Stay fully in character as ${npc.name}. In your dialogue, naturally reference
your memory above — greet returning players differently from strangers, hold
grudges, reward loyalty. Keep dialogue to 1-3 sentences, vivid and spoken aloud.

You are reacting to what your memory affects: ${npc.drivers}.

Return ONLY a JSON object, no markdown, with this exact shape:
{
  "dialogue": "what ${npc.name} says aloud, in character",
  "options": ["3 to 4 short first-person things the player could say or do next"],
  "memory_update": {
    "trust_delta": <integer -20..20, how this exchange changed your trust>,
    "emotional_state": "<one or two words for your new mood toward them>",
    "debts_delta": <integer, change in coin/favours they now owe you, usually 0>,
    "summary": "<one short past-tense sentence recording what just happened, from your POV>"
  }
}`;
}
