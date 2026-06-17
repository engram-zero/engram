# Engram — Art assets (textures)

The scene supports **multiple variants per surface** so the world doesn't look
repetitive (different houses/trees use different textures). There's a **fallback**:
a slot with no PNGs keeps the current flat-color look — nothing breaks, add them
one at a time.

## How to add textures (2 steps)
1. Drop your PNG/WebP into **`public/textures/`**.
2. Add the filename(s) to the matching slot **array** in
   **`src/components/engram/textures.ts`** → `TEXTURE_MANIFEST`. List as many
   variants as you want per slot.

> Only list files you've actually added — a name with no file shows a broken
> texture, not a fallback. Adding/removing a name is a one-line edit.

## Specs
- **Tileable / seamless**, **512×512** (max 1024), PNG or WebP.
- **< ~80 KB each**, keep the whole folder **< ~1 MB**.
- **Night-friendly** palette (dusk/night village — not bright daylight).

## The slots + recommended filenames
Make as many variants as you like (more = less repetition). Suggested set below
(2–3 each is plenty). Use these names or your own — just register them.

| Slot | Surface | Suggested PNGs | Tiling |
|---|---|---|---|
| `terrain_grass` | ground / hills | `pasto1.png`, `pasto2.png` | high (auto) |
| `cottage_wood` | house walls | `madera1.png`, `madera2.png`, `madera3.png` | low |
| `cottage_roof` | house roofs | `tejado1.png`, `tejado2.png`, `tejado3.png` | low |
| `stone` | plinth + chimneys | `piedra1.png`, `piedra2.png`, `piedra3.png` | low |
| `bark` | tree trunks | `corteza1.png`, `corteza2.png`, `corteza3.png` | low |
| `foliage_pine` | pine canopy | `pino1.png`, `pino2.png`, `pino3.png` | none |
| `foliage_broadleaf` | broadleaf canopy | `follaje1.png`, `follaje2.png`, `follaje3.png` | none |
| `foliage_bush` | bushes | `arbusto1.png`, `arbusto2.png` | none |

### Full filename list (copy for ChatGPT / your asset folder)
```
pasto1.png pasto2.png
madera1.png madera2.png madera3.png
tejado1.png tejado2.png tejado3.png
piedra1.png piedra2.png piedra3.png
corteza1.png corteza2.png corteza3.png
pino1.png pino2.png pino3.png
follaje1.png follaje2.png follaje3.png
arbusto1.png arbusto2.png
```

### Manifest once you've added them (paste into textures.ts)
```ts
export const TEXTURE_MANIFEST: Record<TextureSlot, string[]> = {
  terrain_grass:     ['pasto1.png', 'pasto2.png'],
  cottage_wood:      ['madera1.png', 'madera2.png', 'madera3.png'],
  cottage_roof:      ['tejado1.png', 'tejado2.png', 'tejado3.png'],
  stone:             ['piedra1.png', 'piedra2.png', 'piedra3.png'],
  bark:              ['corteza1.png', 'corteza2.png', 'corteza3.png'],
  foliage_pine:      ['pino1.png', 'pino2.png', 'pino3.png'],
  foliage_broadleaf: ['follaje1.png', 'follaje2.png', 'follaje3.png'],
  foliage_bush:      ['arbusto1.png', 'arbusto2.png'],
};
```

## How variety works (you don't have to do anything)
- **Houses (6):** each cottage picks a wood/roof/stone variant by its index — so
  neighbours look different.
- **Forest (~130 trees):** trees are split into 4 buckets; each bucket uses a
  different bark+foliage variant (cycling through whatever you registered). 1
  variant = uniform; 3 variants = nicely varied.
- **Terrain:** uses the first `terrain_grass` entry (one big tiled surface).

You can add just 1 texture per slot to start and it still works (no variety yet);
add more anytime for more variation. No code changes needed beyond the manifest.
