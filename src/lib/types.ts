// ─── Engram domain types ──────────────────────────────────────────────────────
// Shared between the client (memory read/write to 0G) and the /api/npc route
// (Claude dialogue engine). Keep this file free of any runtime imports so it can
// be used from both server and browser code.

export type NPCName = 'aldric' | 'maren' | 'sable';
export type ResourceType = 'wood' | 'stone' | 'coin' | 'silver' | 'gold';
/** Minerals you can mine out of rock outcrops (a subset of ResourceType). */
export type OreType = 'stone' | 'silver' | 'gold';
export type WalletRelation = 'neutral' | 'allied' | 'hostile';
export const BLOCK_UNIT = 0.2;
export const BLOCK_SCALE_MIN = BLOCK_UNIT;
export const BLOCK_SCALE_MAX = 0.4;

export type BuildingType = 'wall' | 'house' | 'block';
/** A structure the player has placed in the world. `block` is a small coloured
 * voxel the AI stacks/colours to sculpt arbitrary shapes (trees, statues…);
 * y/color/scale only apply to blocks. */
export interface Building {
  /** Stable ID used by public raid/repair history. Older saves get a deterministic fallback on load. */
  id?: string;
  type: BuildingType;
  x: number;
  z: number;
  rot: number;
  /** How much wood this placement originally cost. Used for partial demolition refunds. */
  woodCost?: number;
  /** Block only: centre height above the ground. */
  y?: number;
  /** Block only: hex colour. */
  color?: string;
  /** Block only: cube size. */
  scale?: number;
  /** HP of the building */
  hp?: number;
  /** Maximum HP of the building */
  maxHp?: number;
}

export interface RaidEvent {
  /** Stable event ID inside the attacker's world bundle. */
  id: string;
  /** Wallet that authored/spent resources for this event. */
  attacker: string;
  /** Wallet whose public building is targeted. */
  defender: string;
  /** Target `Building.id` in the defender's world bundle. */
  buildingId: string;
  /** HP removed from effective public-world health. */
  damage: number;
  /** Stone spent to publish this event. */
  stoneCost: number;
  /** Reserved for future weapon upgrades. */
  weaponLevel: number;
  /** Epoch ms when the attacker created the event. */
  at: number;
}

export interface RepairEvent {
  /** Stable event ID inside the repairer's world bundle. */
  id: string;
  /** Wallet that authored/spent resources for this event. */
  repairer: string;
  /** Wallet that owns the repaired building. */
  owner: string;
  /** Target `Building.id` in the owner's world bundle. */
  buildingId: string;
  /** HP restored to effective public-world health. */
  heal: number;
  /** Wood spent to publish this repair. */
  woodCost: number;
  /** Whether a repair kit boosted this repair. */
  kitUsed: boolean;
  /** Epoch ms when the repairer created the event. */
  at: number;
}

export interface ParcelClaim {
  /** Stable grid parcel ID, e.g. `p:-1:2`. */
  id: string;
  /** Wallet that owns the parcel. */
  owner: string;
  /** Parcel grid coordinates. */
  gx: number;
  gz: number;
  /** World-space parcel center. */
  x: number;
  z: number;
  /** Square parcel width/depth in world units. */
  size: number;
  /** Coin paid to claim it. */
  claimCost: number;
  /** Commission paid by visitors in basis points. */
  commissionBps: number;
  /** Simple biome/material hint for data-driven rendering. */
  terrain: 'meadow' | 'grove' | 'quarry';
  /** 0G Storage root for the parcel's standalone data bundle. */
  dataRoot?: string | null;
  /** 0G Storage upload tx/hash for the parcel bundle, when available. */
  dataTxHash?: string | null;
  /** Epoch ms when the owner claimed it. */
  at: number;
}

/** Standalone parcel payload stored on 0G and anchored in ParcelRegistry.dataRoot. */
export interface ParcelDataBundle {
  version: number;
  kind: 'engram-parcel';
  wallet: string;
  parcel: ParcelClaim;
  updatedAt: number;
}

export interface ParcelRentEvent {
  /** Stable event ID inside the payer's world bundle. */
  id: string;
  /** Wallet that paid rent/commission. */
  payer: string;
  /** Wallet that owns the parcel. */
  owner: string;
  /** Target parcel ID. */
  parcelId: string;
  /** Action that caused rent. */
  action: 'build' | 'gather';
  /** Coin spent by the payer. */
  coin: number;
  /** Epoch ms when rent was paid. */
  at: number;
}

export interface WorldState {
  inventory: Record<ResourceType, number>;
  /** Indices (into map.ts TREES) of trees the player has chopped. */
  choppedTrees: number[];
  /** Indices (into map.ts ROCKS) of rock outcrops the player has mined out. */
  minedRocks: number[];
  /** Structures the player has built. */
  buildings: Building[];
  /** Enemies the player has killed. */
  enemiesKilled: number;
  /** Tool tier bought from Aldric. 0 = base axe, 1 = sharper axe (2× wood/chop). */
  axeLevel: number;
  /** Consumable building repairs bought from Aldric. */
  repairKits: number;
  /** Outgoing public-world raid/sabotage events authored by this wallet. */
  raidEvents: RaidEvent[];
  /** Public-world maintenance events authored by this wallet. */
  repairEvents: RepairEvent[];
  /** Land parcels this wallet has claimed. */
  parcelClaims: ParcelClaim[];
  /** Outgoing rent/commission events this wallet paid on other players' parcels. */
  parcelRentEvents: ParcelRentEvent[];
  /** Public rent event IDs this wallet has already collected as parcel owner. */
  parcelRentCollected: string[];
  /** Parcel resource node IDs this wallet has harvested/depleted. */
  depletedParcelResources: string[];
  /**
   * Player-declared social graph for public-world wallets. Neutral can be
   * represented by absence; allied/hostile are persisted in the same 0G bundle
   * as the player's world so future co-op/raid rules can read one source.
   */
  relations: Record<string, WalletRelation>;
}

/**
 * The persistent memory object stored on 0G Storage for a single NPC.
 * This is the exact schema the game persists and the NPC's AI reasons over.
 */
export interface NPCMemory {
  /** 0–100. Starts at 50. How much this NPC trusts the player. */
  trust_level: number;
  /** Append-only-ish log of past exchanges (capped on write). */
  interaction_history: InteractionRecord[];
  /** Free-form one/two-word mood, e.g. 'neutral', 'pleased', 'wary', 'cold'. */
  emotional_state: string;
  /** Coin/favours the player owes this NPC. Never negative. */
  debts: number;
  /** Epoch ms of the last interaction, or null if never met. */
  last_seen: number | null;
}

/** One recorded exchange inside an NPC's interaction_history. */
export interface InteractionRecord {
  /** Epoch ms. */
  at: number;
  /** What the player said or did. */
  player: string;
  /** The NPC's own one-line, past-tense record of what happened. */
  summary: string;
  /** How this exchange moved trust (-20..20). */
  trust_delta: number;
}

/** Static definition of an NPC: identity + the persona system prompt. */
export interface NPC {
  id: NPCName;
  name: string;
  role: string;
  /** Short flavour line shown in the UI. */
  tagline: string;
  /** UI accent colour (hex). */
  accent: string;
  /**
   * Base system prompt for Claude. MUST contain the literal token
   * `{MEMORY_JSON}` where the player's NPCMemory is injected at request time.
   */
  systemPrompt: string;
  /** What this NPC's memory primarily reacts to (steers the AI's memory delta). */
  drivers: string;
}

/** A clickable dialogue choice shown to the player. */
export interface DialogOption {
  id: string;
  label: string;
}

// ─── 0G persistence shapes ────────────────────────────────────────────────────

/**
 * Everything Aldenmoor remembers about ONE wallet, stored as a single JSON blob
 * on 0G Storage. Addressed by one rootHash per wallet (the "anchor"), which lets
 * a whole conversation persist with a single upload / signature.
 */
export interface MemoryBundle {
  version: number;
  wallet: string;
  npcs: Record<NPCName, NPCMemory>;
  /** Player-owned gameplay state, committed to 0G with the same wallet root. */
  world?: WorldState;
  updatedAt: number;
}

/**
 * Maps npcName → rootHash. In the single-bundle model there is one anchor per
 * wallet, but this index shape is kept so the memory layer can evolve toward
 * per-NPC blobs (or an on-chain registry) without changing callers.
 */
export interface NPCIndex {
  wallet: string;
  /** The rootHash of the current MemoryBundle for this wallet. */
  bundleRoot: string;
  /** Optional per-NPC roots, for a future per-blob layout. */
  roots?: Partial<Record<NPCName, string>>;
  updatedAt: number;
}

// ─── /api/npc contract ────────────────────────────────────────────────────────

/** How an exchange changed the NPC's memory (produced by the AI, applied server-side). */
export interface MemoryUpdate {
  /** -20..20. */
  trust_delta: number;
  /** New mood; if omitted, keep previous. */
  emotional_state?: string;
  /** Change in debts (usually 0). */
  debts_delta: number;
  /** NPC's past-tense one-line record of what just happened. */
  summary: string;
}

/** A price the player proposes when haggling with Aldric (sell side). */
export interface TradeOffer {
  /** Only wood is tradeable for now. */
  resource: 'wood';
  /** How many units the player wants to sell. */
  quantity: number;
  /** Coin per unit the player is asking for. */
  pricePerUnit: number;
  /** Live market mid-price (coin/unit) so the haggle floats with the dynamic
   * market instead of a fixed reference. Optional for backward compatibility. */
  referencePrice?: number;
}

/** Aldric's verdict on a {@link TradeOffer}. The CLIENT applies the resource move. */
export interface TradeDecision {
  /** Whether a sale happens at all. */
  accepted: boolean;
  /** Coin per unit Aldric will actually pay — may be a counter, ≤ the asked price. */
  agreedPricePerUnit: number;
  /** Units actually sold (≤ the offered quantity). */
  quantity: number;
}

/** POST body for /api/npc. */
export interface NPCChatRequest {
  walletAddress: string;
  npcName: NPCName;
  /** Empty string means "the player just approached" → NPC greets. */
  message: string;
  /** Current memory for this NPC (read from 0G client-side). */
  memory: NPCMemory;
  /** Other NPCs' memories — only sent for Sable, who aggregates them. */
  crossMemory?: Partial<Record<NPCName, NPCMemory>>;
  /** Player's global kill count. */
  enemiesKilled?: number;
  /** Optional price offer when haggling with Aldric. Ignored for other NPCs. */
  offer?: TradeOffer;
}

/** Response from /api/npc. The client persists `memory` to 0G on dialogue end. */
export interface NPCChatResponse {
  /** The NPC's spoken line. */
  response: string;
  /** 3–4 suggested next things the player could say/do. */
  options: string[];
  /** The updated memory after applying the AI's delta. */
  memory: NPCMemory;
  /** The raw delta, for the memory panel / debugging. */
  delta: MemoryUpdate;
  /** Aldric's verdict, present only when the request carried an `offer`. */
  trade?: TradeDecision;
}

/** Factory for a brand-new NPC memory (first contact defaults). */
export function defaultMemory(): NPCMemory {
  return {
    trust_level: 50,
    interaction_history: [],
    emotional_state: 'neutral',
    debts: 0,
    last_seen: null,
  };
}
