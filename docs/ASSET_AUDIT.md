# Engram — auditoría de assets (2026-06-29)

Estado de texturas y audio, para saber qué producir. El código tiene **fallbacks seguros**: si un
archivo falta, el juego sigue y esa textura/sonido queda en silencio o usa color plano — así que
todo lo de abajo es **mejora**, no bloqueante.

## 🎨 Texturas — COMPLETAS

Los 8 slots de [`src/components/engram/textures.ts`](/d:/projects/hackathon/engram/src/components/engram/textures.ts)
tienen sus variantes en `public/textures/` (`.webp`):

| Slot | Archivos | Variantes |
| --- | --- | --- |
| terrain_grass | pasto1, pasto2 | 2 (podría +1) |
| cottage_wood | madera1-3 | 3 ✓ |
| cottage_roof | tejado1-3 | 3 ✓ |
| stone | piedra1-3 | 3 ✓ |
| bark | corteza1-3 | 3 ✓ |
| foliage_pine | pino1-3 | 3 ✓ |
| foliage_broadleaf | follaje1-3 | 3 ✓ |
| foliage_bush | arbusto1, arbusto2 | 2 (podría +1) |

**Opcional (variedad):** `pasto3.webp`, `arbusto3.webp`.

**Slots NUEVOS que aún no existen** (requieren cambio de código además del arte — si los produces,
te los cableo): superficie de **agua/río**, **tierra/camino**, **muro construido** por el jugador,
piel de **demonio/enemigo**, superficie de **bloque IA**. Dime si quieres alguno y lo agrego al
`TEXTURE_MANIFEST`.

## 🔊 Audio

### Faltan (referenciados en el manifest, hoy en silencio)
Coloca en `public/audio/...`:
- `foley/land-dirt.mp3` — aterrizaje tras saltar.
- `ui/dialogue-open.mp3` — abrir diálogo.
- `ui/dialogue-close.mp3` — cerrar diálogo.
- `ui/save-success.mp3` — "guardado en 0G" exitoso.
- `ui/save-error.mp3` — error al guardar.

### Variantes (pulido, opcional)
- `foley/footstep-grass-02/03/04.mp3` — hoy solo está wired el `01`; con 2-4 los pasos dejan de
  sonar monótonos (el código ya rota arrays de variantes; habría que listarlas en el manifest).
- `foley/footstep-water` — una o dos variantes extra.

### Cues que NO existen pero sumarían (requieren wiring; dime y los agrego)
- **Venta/moneda** al comerciar con Aldric (chime de coin).
- **Colocar construcción** (thud) y **árbol que cae** (crash) al talar el último golpe.
- **Gruñido de demonio / asedio** (refuerza el evento de sieges).
- **Viento ambiental** sutil para el día.
- **Mejora/upgrade** (al comprar hacha mejorada o forjar un ítem — ver Prompt 25).

## Notas
- Formato: `.webp` para texturas, `.mp3` para audio (también valen `.wav/.ogg` ajustando rutas).
- Créditos/licencias de audio: ver [`docs/AUDIO_ASSETS.md`](/d:/projects/hackathon/engram/docs/AUDIO_ASSETS.md)
  (Pixabay Content License, atribución no requerida).
- Mantener archivos ligeros para web.
