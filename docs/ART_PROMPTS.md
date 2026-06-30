# Engram — prompts para generar arte (texturas)

Prompts listos para pegar en el generador de imágenes (ChatGPT/DALL·E). Estilo objetivo: **igual al
arte que ya existe** en `public/textures/` — texturas **estilizadas, pintadas a mano, low-poly RPG
acogedor**, _seamless tileable_ y vista cenital (top-down) para el suelo. Exporta a `.webp`
(o `.png` y conviértelo), tamaño 512×512 o 1024×1024, **sin sombras direccionales marcadas** (luz
plana y uniforme para que tile sin costuras).

> **Autoría / provenance (importante):** estas texturas son **generadas con IA**. Al añadir cada
> archivo, registra su fila en la tabla de **Provenance** de abajo (archivo · prompt · herramienta ·
> fecha · autor del prompt). Así queda claro que el arte es asistido por IA y de dónde salió — no
> basta con guardar el prompt suelto. (La licencia de las salidas de ChatGPT/DALL·E permite uso
> comercial; verifica los términos vigentes de OpenAI antes de publicar.)

## Convenciones comunes (añádelas a cada prompt)
`seamless tileable texture, top-down orthographic view, flat even lighting, no strong shadows,
stylized hand-painted low-poly RPG art, cohesive cozy fantasy village aesthetic, high detail but
clean, 1024x1024`

---

## A. Suelos por bioma (Prompt 29 — terreno por zonas)
Para que el mundo tenga regiones distintas (pradera, desierto, nieve…) en vez de un tapiz.

1. **terrain_grass (refuerzo de variante — `pasto3.webp`)**
   `lush green meadow grass ground, short blades, subtle dirt patches, varied green tones`
   + convenciones comunes.

2. **terrain_sand / desert (`arena1.webp`, `arena2.webp`)**
   `warm desert sand ground, fine rippled dunes texture, soft beige and ochre tones, a few small
   pebbles` + convenciones comunes.

3. **terrain_snow (`nieve1.webp`, `nieve2.webp`)**
   `fresh snow ground, soft white surface with faint blue shadows, subtle footprints and crunch
   texture, sparse frozen grass tips poking through` + convenciones comunes.

4. **terrain_dry / savanna (`seco1.webp`, `seco2.webp`)**
   `dry savanna ground, pale yellow withered grass over cracked earth, sparse and arid` +
   convenciones comunes.

> Genera **2 variantes** por bioma para romper la repetición sin caer en el tapiz (el código rota
> variantes dentro del MISMO bioma; los biomas se eligen por zona, no por tile).

## B. Variantes opcionales de lo existente
5. **foliage_bush (`arbusto3.webp`)**
   `dense round shrub foliage from above, layered green leaves, small berries, stylized low-poly`
   + convenciones comunes.

## C. Slots NUEVOS (opcionales — requieren que Claude los cablee en el código)
6. **water / río (`agua1.webp`)**
   `clear flowing creek water surface, gentle ripples and reflections, stylized, slight turquoise
   tint` + convenciones comunes (este puede animarse por scroll de UV).
7. **dirt / camino (`tierra1.webp`)**
   `packed dirt path ground, brown earthy tones, small stones and faint footprints` + convenciones.
8. **muro construido del jugador (`muro1.webp`)**
   `rough stacked stone wall surface, mortar lines, sturdy medieval fence, stylized low-poly` +
   `tileable, flat lighting` (este NO es top-down; es para caras verticales).
9. **piel de demonio/enemigo (`demonio1.webp`)**
   `dark cracked demon skin texture, charcoal grey with faint ember-red veins, menacing, stylized`
   + `tileable, flat lighting`.

---

## Cómo conectarlo
- Suelos/variantes existentes: deja el archivo en `public/textures/` con el nombre indicado y
  añádelo al array del slot en [`src/components/engram/textures.ts`](/d:/projects/hackathon/engram/src/components/engram/textures.ts).
- Slots nuevos (C) o biomas (A): avísame y yo agrego el slot al `TEXTURE_MANIFEST` + el render
  (los biomas van con el Prompt 29).

## Provenance (rellenar al añadir cada arte)
| Archivo | Herramienta | Fecha | Autor del prompt | Prompt (resumen) |
| --- | --- | --- | --- | --- |
| _ej._ `arena1.webp` | ChatGPT / DALL·E 3 | 2026-06-?? | AriiBen | desert sand, top-down… |
