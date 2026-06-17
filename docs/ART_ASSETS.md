# Engram — Art assets (textures)

How to add textures to the 3D scene. The system has a **fallback**: if a PNG
isn't registered, the scene keeps its current flat-color look — nothing breaks,
and you can add textures one at a time.

## How it works (2 steps)
1. Drop your PNG/WebP into **`public/textures/`**.
2. Register it in **`src/components/engram/textures.ts`** → `TEXTURE_MANIFEST`:
   change the slot's value from `false` to your filename, e.g.
   `terrain_grass: 'grass.png'`.

That's it — the scene picks it up on reload. Remove it from the manifest (or
delete the file) to fall back to the generic look.

## Specs (please follow)
- **Tileable / seamless** (they repeat across big surfaces).
- **512×512** (max 1024). PNG or WebP.
- **< ~80 KB each**, **< ~500 KB total** (served from Vercel's CDN).
- Night-friendly palette (the scene is a dusk/night village — avoid bright daylight).

## The texture slots the scene asks for
Each slot maps to a surface. Provide a PNG for any you want; skip the rest.

| Slot key (in TEXTURE_MANIFEST) | Surface | Tiling | Notes |
|---|---|---|---|
| `terrain_grass` | the ground / hills | high (auto-repeat) | the big one; most visible |
| `cottage_wood` | house walls | low | warm timber |
| `cottage_roof` | house roofs | low | shingles/thatch |
| `stone` | house plinth + chimneys | low | grey stone |
| `bark` | tree trunks | low | works on all trees |
| `foliage_pine` | pine canopy | none | dark green needles |
| `foliage_broadleaf` | broadleaf canopy | none | green leaves |
| `foliage_bush` | bushes | none | low shrub |

### Suggested filenames (you can use any; just register them)
You mentioned names like `arbol1.png`, `ramas_arbol1.png`, `piedra3.png`,
`madera2.png`. All fine — the manifest maps a slot → whatever filename you choose:
```ts
// src/components/engram/textures.ts
export const TEXTURE_MANIFEST = {
  terrain_grass: 'pasto.png',
  cottage_wood:  'madera2.png',
  cottage_roof:  'tejado1.png',
  stone:         'piedra3.png',
  bark:          'corteza_arbol1.png',
  foliage_pine:  'pino_follaje.png',
  foliage_broadleaf: 'arbol2_follaje.png',
  foliage_bush:  'arbusto.png',
};
```

### Multiple variants per tree (e.g. arbol1, arbol2, arbol3)
The current trees are **instanced** (one shared material per species), so today
there's **one** bark + one foliage texture per species. If you want per-tree
variety (arbol1/arbol2/arbol3 looking different), that's a small code change —
ask the world dev to split species into variants, then you register
`foliage_pine_1`, `foliage_pine_2`, etc. For now, give us **one** good texture
per slot and we expand later.

## Where they're used
`src/components/engram/Scene3D.tsx` reads each slot via `getTexture(slot)` for
terrain, cottages (wood/roof/stone) and trees (bark/foliage). Adding a manifest
entry is all you need — no other code changes.
