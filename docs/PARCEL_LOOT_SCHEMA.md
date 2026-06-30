# Parcel Loot Pack Schema

Parcel claims persist a deterministic surprise bundle in `ParcelClaim.resources`.
The same parcel id/grid always derives the same default bundle, and once saved it
travels inside the player's 0G `WorldState` and the standalone `ParcelDataBundle`.

```ts
interface ParcelResourceNode {
  id: string;              // `${parcel.id}:loot:${index}`
  type: 'wood' | 'stone' | 'silver' | 'gold';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  localX: number;          // world x = parcel.x + localX
  localZ: number;          // world z = parcel.z + localZ
  amount: number;          // units granted when depleted
  hp: number;              // harvest durability for the scene loop
  radius: number;          // interaction/collision hint
}
```

Generation rules:
- Node count is usually 2-3, sometimes 4, rarely 5.
- Weighted rarity: wood is common, stone uncommon, silver rare, gold legendary.
- Groves bias toward wood; quarries bias toward stone.
- Silver/gold are capped to at most one node of each per parcel, and their amount
  is always 1, so parcel loot does not overwhelm Prompt 23 scarcity/pricing.
- Old parcels without `resources` are normalized with the deterministic generator,
  so reloads stay stable without migrations or a contract change.

Scene/render consumption:
- Prefer `claim.resources` over legacy terrain-derived `parcelResourceNodes`.
- Use `parcelResourceKey`/node `id` with `world.depletedParcelResources` to hide
  depleted nodes.
- Call `harvestParcelResource(node.id, node.type, node.amount)` when a node is
  exhausted; wood and ore caps are enforced in `world.ts`.
