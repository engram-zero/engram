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

### Manifest (already wired up — the 22 textures are registered as `.webp`)
The current set was generated, then **optimized to 512×512 WebP** (51.5 MB of PNGs →
~1.2 MB total) and registered:
```ts
export const TEXTURE_MANIFEST: Record<TextureSlot, string[]> = {
  terrain_grass:     ['pasto1.webp', 'pasto2.webp'],
  cottage_wood:      ['madera1.webp', 'madera2.webp', 'madera3.webp'],
  cottage_roof:      ['tejado1.webp', 'tejado2.webp', 'tejado3.webp'],
  stone:             ['piedra1.webp', 'piedra2.webp', 'piedra3.webp'],
  bark:              ['corteza1.webp', 'corteza2.webp', 'corteza3.webp'],
  foliage_pine:      ['pino1.webp', 'pino2.webp', 'pino3.webp'],
  foliage_broadleaf: ['follaje1.webp', 'follaje2.webp', 'follaje3.webp'],
  foliage_bush:      ['arbusto1.webp', 'arbusto2.webp'],
};
```

> **IMPORTANT — always optimize before committing.** Raw generated PNGs are 1–4 MB
> each. Resize to 512×512 and convert to WebP (target < ~100 KB each). With `sharp`
> installed you can batch it:
> ```js
> // node optimize.mjs  (sharp must be installed)
> import sharp from 'sharp'; import { readdirSync, unlinkSync } from 'fs';
> const dir='public/textures';
> for (const f of readdirSync(dir).filter(x=>/\.(png|jpe?g)$/i.test(x))) {
>   await sharp(`${dir}/${f}`).resize(512,512,{fit:'fill'}).webp({quality:82})
>     .toFile(`${dir}/${f.replace(/\.(png|jpe?g)$/i,'.webp')}`);
>   unlinkSync(`${dir}/${f}`);
> }
> ```
> Then register the `.webp` names in `TEXTURE_MANIFEST`.

## How variety works (you don't have to do anything)
- **Houses (6):** each cottage picks a wood/roof/stone variant by its index — so
  neighbours look different.
- **Forest (~130 trees):** trees are split into 4 buckets; each bucket uses a
  different bark+foliage variant (cycling through whatever you registered). 1
  variant = uniform; 3 variants = nicely varied.
- **Terrain:** uses the first `terrain_grass` entry (one big tiled surface).

You can add just 1 texture per slot to start and it still works (no variety yet);
add more anytime for more variation. No code changes needed beyond the manifest.

---

## ChatGPT prompt (to generate the textures)

ChatGPT generates one image per request. Paste the **style preamble** once, then ask
for each texture and save it with the matching filename above.

### 1) Style preamble (paste once)
```
Eres un artista de texturas para un videojuego. Voy a pedirte varias texturas, una por una. Para TODAS aplica estas reglas:

JUEGO: "Engram – Aldenmoor", un RPG low-poly en una aldea medieval, ambientado de NOCHE / atardecer. Se explora en primera persona y en vista aérea (tipo Age of Empires). Estética estilizada, low-poly, pintada a mano, colores algo apagados/desaturados (es de noche, luz de luna y fogatas).

REGLAS PARA CADA TEXTURA (obligatorio):
- SIN COSTURAS / SEAMLESS / TILEABLE: debe poder repetirse en mosaico sin que se note el borde. Es lo más importante.
- Vista perfectamente PLANA y cenital (top-down), como una muestra de material, NO una escena ni con perspectiva.
- Iluminación PLANA y uniforme (sin sombras fuertes ni brillos direccionales ni viñeta).
- CUADRADA (1:1). SIN texto, SIN marcas de agua, SIN logos, SIN bordes/marcos.
- Estilo stylized/hand-painted low-poly, paleta nocturna apagada (no "de día").

Cuando entiendas, dime "listo" y te pediré la primera.
```

### 2) Then request each (subject → filename)
| Pídele… | Guárdala como |
|---|---|
| Pasto/hierba nocturna, verde oscuro, tileable | `pasto1.png` |
| La misma, variación con parches de tierra | `pasto2.png` |
| Tablones de madera (pared), marrón cálido | `madera1.png` |
| Madera, variación más oscura/desgastada | `madera2.png` |
| Madera, variación con vetas marcadas | `madera3.png` |
| Tejas de techo gris-marrón, hileras | `tejado1.png` |
| Tejas, variación rojiza | `tejado2.png` |
| Techo de paja/madera, variación | `tejado3.png` |
| Piedra gris (cimiento/chimenea) | `piedra1.png` |
| Piedra, variación más clara | `piedra2.png` |
| Piedra, variación musgosa | `piedra3.png` |
| Corteza de árbol, marrón, vertical | `corteza1.png` |
| Corteza, variación rugosa | `corteza2.png` |
| Corteza, variación clara | `corteza3.png` |
| Follaje de pino (agujas verde oscuro) | `pino1.png` |
| Follaje de pino, variación | `pino2.png` |
| Follaje de pino, variación | `pino3.png` |
| Follaje frondoso (hojas verdes) | `follaje1.png` |
| Follaje frondoso, variación | `follaje2.png` |
| Follaje frondoso, variación | `follaje3.png` |
| Follaje de arbusto bajo | `arbusto1.png` |
| Follaje de arbusto, variación | `arbusto2.png` |

After generating: drop the PNGs in `public/textures/`, run the optimize snippet above
(→ `.webp`), and register the `.webp` names in `TEXTURE_MANIFEST`.

---

# Showcase assets (logo · thumbnail · video copy)

For the 0G Zero Cup submission page (`my project` tab) and the YouTube upload.

## Logo (LOGO URL — square)
Square app icon, **512×512** (the generator can output larger; downscale). The
chosen logo is a fire-thread "E" on a midnight-indigo rune seal. Prompt used:

```
Square app icon for a fantasy browser RPG called "Engram". A single stylized
glowing letter "E" formed from interwoven threads of warm amber light, like a
memory etched in firelight, centered on a deep midnight-indigo background.
Subtle medieval rune / seal aesthetic, soft inner glow, minimal, flat-ish with a
slight emboss. No text other than the "E". Clean edges, centered composition,
suitable as a small app icon. 512x512.
```

## Thumbnail (THUMBNAIL URL — cover, ~1200×630 / 1280×720)
**Capture it in-game with photo mode** — visit the live demo with the `?shot`
query param, which hides ALL UI chrome, skips the title screen (no wallet needed)
and pins a flattering time of day:

- `…/?shot` → golden dusk with torches lit (default; best for the cover)
- `…/?shot=12` noon · `…/?shot=20` night with stars · `…/?shot=7` sunrise

Chosen cover = **first-person, golden dusk**, framing the three NPCs (Aldric /
Maren / Sable, with their name+role labels) around the campfire — it reads as
"NPC game" at a glance. (Aerial `?shot=18.6` is the alternative wide shot; the
dark *night* aerial reads too murky as a small gallery card.) When compositing,
brighten slightly and overlay the tagline + the fire-"E" logo in a corner.

## YouTube — title & description
**Title:** `Engram — NPCs that truly remember you, on 0G | Zero Cup 2026`

**Description (paste as-is):**
```
Engram is a browser RPG where the villagers of Aldenmoor keep a persistent,
player-owned memory of you — stored on 0G Storage, where not even we, the
developers, can reset or edit it.

Talk to three NPCs, each with their own memory of you:
• Aldric — merchant
• Maren — guard captain
• Sable — information broker (she aggregates what the others know about you)

Your trust, debts, mood and history persist across sessions and devices: every
conversation is written back to 0G, auditable by its root hash and anchored
on-chain with your own wallet signature — so you truly own the memory.
Remove 0G and the whole premise collapses.

Explore Aldenmoor in first or third person, chop wood, build walls and houses
(by hand or with an AI that designs voxel structures from a text prompt), and
watch a living day/night cycle over the village.

▶ Play the live demo: https://engram-bay.vercel.app
▶ Code: https://github.com/engram-zero/engram

Built for the 0G Zero Cup 2026. Live on the 0G Galileo Testnet (Chain ID 16602)
with real on-chain uploads.

#0G #web3gaming #AI #NPC #blockchain
```
