// ─── Engram domain types ──────────────────────────────────────────────────────
// Shared between the client (memory read/write to 0G) and the /api/npc route
// (Claude dialogue engine). Keep this file free of any runtime imports so it can
// be used from both server and browser code.

export type NPCName = 'aldric' | 'maren' | 'sable';
export type ResourceType = 'wood' | 'stone' | 'coin' | 'silver' | 'gold';
/** Minerals you can mine out of rock outcrops (a subset of ResourceType). */
export type OreType = 'stone' | 'silver' | 'gold';
export type StoredResourceType = 'wood' | OreType;
export type TreeGrowthStage = 'sapling' | 'young' | 'mature';
export type WalletRelation = 'neutral' | 'allied' | 'hostile';
export type AiItemType = 'tool' | 'weapon' | 'trinket';
export type AiItemStat = 'woodYield' | 'miningYield' | 'combatDamage' | 'moveSpeed' | 'maxHp';
export type AiItemRarity = 'common' | 'uncommon' | 'rare';
export type BiomeId = 'meadow' | 'sand' | 'snow' | 'dry';
export type NatureZoneId = 'north_forest' | 'riverlands' | 'east_hills' | 'south_fields' | 'west_grove';
export type FaunaMood = 'hostile' | 'wary' | 'neutral';
export const BLOCK_UNIT = 0.1; // smaller voxels → more detailed, realistic builds
export const BLOCK_SCALE_MIN = BLOCK_UNIT;
export const BLOCK_SCALE_MAX = 0.25;

export interface NatureZoneSnapshot {
  id: NatureZoneId;
  label: string;
  standingTrees: number;
  choppedTrees: number;
  intactRocks: number;
  minedRocks: number;
  parcelClaims: number;
  playerBuilds: number;
}

export interface EarthZoneDirective {
  id: NatureZoneId;
  fertility: number;
  regrowthShare: number;
  note: string;
}

export interface FaunaZoneDirective {
  id: NatureZoneId;
  demeanor: FaunaMood;
  spawnWeight: number;
  note: string;
}

export interface EarthAgentState {
  updatedAt: number;
  cadenceMs: number;
  nextGrowthAt: number;
  nextRockAt?: number;
  dominantZone: NatureZoneId;
  zones: EarthZoneDirective[];
  summary: string;
}

export interface FaunaAgentState {
  updatedAt: number;
  spawnIntervalMs: number;
  calmDelayMs: number;
  maxEnemies: number;
  speedMultiplier: number;
  dominantZone: NatureZoneId;
  mood: FaunaMood;
  zones: FaunaZoneDirective[];
  summary: string;
}

export interface EcosystemState {
  updatedAt: number;
  sourceFingerprint?: string;
  earth?: EarthAgentState;
  fauna?: FaunaAgentState;
  activity?: EcosystemActivityState;
  communityActivity?: CommunityActivityState;
  treasury?: WorldTreasuryState;
}

export interface CommunityActivityState {
  updatedAt: number;
  formulaVersion: string;
  /** Aggregate played/connected time observed by this wallet/world bundle. */
  totalPlayMs: number;
  /** Decayed recent playtime signal; gives the world a short-term "alive" pulse. */
  recentPlayMs: number;
  sessionCount: number;
  lastSessionAt: number;
  /** 0..1 normalized playtime signal used by nature-AI cadence. */
  communitySignal: number;
  /** Multiplier applied to resource regrowth cadence. 0.75 = 25% faster. */
  regenCadenceMultiplier: number;
}

export interface EcosystemActivityState {
  updatedAt: number;
  formulaVersion: string;
  tokensInCirculation: number;
  depletedTrees: number;
  depletedRocks: number;
  recentExtraction: number;
  stockPressure: number;
  activityScore: number;
  communitySignal: number;
  communityRegenMultiplier: number;
  treeCadenceMs: number;
  rockCadenceMs: number;
}

export interface WorldTreasuryState {
  updatedAt: number;
  /** In-game coin paid into the world's bank by gated paid mining. */
  coin: number;
  paidMiningRevenue: number;
  paidMiningCount: number;
  orePurchased: Record<OreType, number>;
}

export interface TreeGrowthState {
  stage: TreeGrowthStage;
  nextStageAt: number;
  updatedAt: number;
}

export interface AiItem {
  /** Stable content-ish ID generated from owner + prompt + bounded item stats. */
  id: string;
  /** Wallet that currently owns this user-created item. */
  owner: string;
  name: string;
  type: AiItemType;
  stat: AiItemStat;
  /** Bounded additive modifier. Scene/gameplay reads this via world.ts helpers. */
  magnitude: number;
  rarity: AiItemRarity;
  /** Suggested market price in in-game coin, bounded server/store-side. */
  estimatedCoinValue: number;
  /** Original user prompt that forged the item. */
  prompt: string;
  /** Short model/fallback explanation shown by future UI. */
  lore: string;
  /** Whether this came from deterministic fallback instead of live AI. */
  fallback?: boolean;
  createdAt: number;
}

export interface AiItemListing {
  id: string;
  item: AiItem;
  seller: string;
  priceCoin: number;
  status: 'listed' | 'sold' | 'cancelled' | 'pending';
  createdAt: number;
  updatedAt: number;
  buyer?: string;
}

export interface DeathPenaltyState {
  at: number;
  coinLost: number;
  resourcesLost: Partial<Record<ResourceType, number>>;
  reason: 'death' | 'damage';
}

export type AldricStandardItemId =
  | 'medicinal_herbs'
  | 'repair_kit'
  | 'sapling'
  | 'sharper_axe';

export interface AldricStandardMarketItem {
  id: AldricStandardItemId;
  name: string;
  description: string;
  priceCoin: number;
  category: 'healing' | 'repair' | 'upgrade' | 'utility';
  stock: number | 'unlimited';
}

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
  /** Block only: which named sub-structure of an AI build this voxel belongs to
   * (e.g. a torch's "pole" vs "crown"). Blocks sharing a clusterId are selected,
   * repaired and demolished together — the "hybrid" HP model. */
  clusterId?: string;
  /** Human label for the cluster, shown in the stats card. */
  clusterLabel?: string;
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

export interface DemonSiegeEvent {
  /** Stable event ID inside the owner's world bundle. */
  id: string;
  /** Wallet whose building was damaged by the world simulation. */
  owner: string;
  /** Target `Building.id` in the owner's world bundle. */
  buildingId: string;
  /** HP removed from the owner's persisted building health. */
  damage: number;
  /** Epoch ms when the demon hit landed. */
  at: number;
  /** Start of the fairness window this hit counted against. */
  windowStartedAt: number;
  /** Nature-agent zone that was applying pressure, if known. */
  zone?: NatureZoneId;
  /** Always `demon` for now; leaves room for wolves/blight later. */
  source: 'demon';
  /** True when the hit was trimmed by the per-window damage cap. */
  capped: boolean;
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
  /** Legacy parcel resource hint (grove/quarry/meadow); kept for resource overlays. */
  terrain: 'meadow' | 'grove' | 'quarry';
  /** Ground biome at parcel center; render can map this to coherent soil textures. */
  biome?: BiomeId;
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
  /** Resources stored in the player's 0G warehouse, separate from carry caps. */
  storage: Record<StoredResourceType, number>;
  /** Indices (into map.ts TREES) of trees the player has chopped. */
  choppedTrees: number[];
  /** Per-tree growth stages for felled/regrowing trees, keyed by TREES index. */
  treeGrowth: Record<number, TreeGrowthState>;
  /** Indices (into map.ts ROCKS) of rock outcrops the player has mined out. */
  minedRocks: number[];
  /** Structures the player has built. */
  buildings: Building[];
  /** Enemies the player has killed. */
  enemiesKilled: number;
  /** Tool tier bought from Aldric. 0 = base axe, 1 = sharper axe (2× wood/chop). */
  axeLevel: number;
  /** Persistent player HP used by death/economy consequences. */
  playerHp: number;
  playerMaxHp: number;
  deathCount: number;
  lastDeathPenalty?: DeathPenaltyState;
  /** Prompt-forged tools/weapons/trinkets owned by this wallet, persisted in 0G. */
  aiItems: AiItem[];
  /** Equipped item IDs by slot; Scene3D can consume stat modifiers via world.ts helpers. */
  equippedItemIds: Partial<Record<AiItemType, string>>;
  /** Outgoing item listings authored by this wallet; public discovery can hydrate these later. */
  aiItemListings: AiItemListing[];
  /** Consumable building repairs bought from Aldric. */
  repairKits: number;
  /** Outgoing public-world raid/sabotage events authored by this wallet. */
  raidEvents: RaidEvent[];
  /** Public-world maintenance events authored by this wallet. */
  repairEvents: RepairEvent[];
  /** Local ecosystem attacks against this wallet's own buildings. */
  siegeEvents: DemonSiegeEvent[];
  /** Land parcels this wallet has claimed. */
  parcelClaims: ParcelClaim[];
  /** Outgoing rent/commission events this wallet paid on other players' parcels. */
  parcelRentEvents: ParcelRentEvent[];
  /** Public rent event IDs this wallet has already collected as parcel owner. */
  parcelRentCollected: string[];
  /** Parcel resource node IDs this wallet has harvested/depleted. */
  depletedParcelResources: string[];
  /** Server-authored nature-agent directives that make the world evolve over time. */
  ecosystem?: EcosystemState;
  /**
   * Player-declared social graph for public-world wallets. Neutral can be
   * represented by absence; allied/hostile are persisted in the same 0G bundle
   * as the player's world so future co-op/raid rules can read one source.
   */
  relations: Record<string, WalletRelation>;
  /** When this state was last mutated (ms). Used to prefer the newer of the local
   * draft vs the 0G bundle on load, so unsaved gathering isn't clobbered by a stale
   * 0G snapshot. Not gameplay data. */
  savedAt?: number;
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

export interface ForgeRequest {
  walletAddress: string;
  prompt: string;
  apiKey?: string;
}

export interface ForgeResponse {
  items: AiItem[];
  costUsd: number;
  fallback?: boolean;
  byo?: boolean;
}

export interface EarthAgentRequest {
  walletAddress: string;
  world: WorldState;
  snapshot: NatureZoneSnapshot[];
  current?: EcosystemState;
}

export interface EarthAgentResponse {
  earth: EarthAgentState;
}

export interface FaunaAgentRequest {
  walletAddress: string;
  world: WorldState;
  snapshot: NatureZoneSnapshot[];
  current?: EcosystemState;
}

export interface FaunaAgentResponse {
  fauna: FaunaAgentState;
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
