# Engram — Prompt Log (evidencia de *vibe coding*)

> El Zero Cup premia construir **con prompts**. Este documento es la **bitácora
> auditable** de cada pedido (prompt) del equipo y el cambio que produjo, con su
> commit. Es distinto de [`ENGRAM_PROMPTS.md`](ENGRAM_PROMPTS.md), que es el
> *backlog* de tareas **futuras**; aquí queda lo que **ya se construyó**.
>
> Workflow (ver [`CLAUDE.md`](../CLAUDE.md)): por cada tarea, el agente redacta el
> **prompt sintetizado** (el prompt autocontenido que *crea* la tarea, como paso
> intermedio entre el pedido casual y el resultado) y lo registra aquí. Append al
> final, en orden cronológico. El historial de git es la fuente de verdad.
>
> Formato por entrada:
> ```
> ### <fecha> · <título>
> **Pedido (humano):** …   **Prompt sintetizado:** …
> **Qué se hizo:** …   **Commit:** <hash>
> ```
> (Las entradas de abajo previas a este formato quedan en estilo resumido.)

---

## 17 jun 2026

**Techo de las casas formaba una "V" en vez de "A"** → invertí la rotación de las
dos aguas para que hagan una cumbrera (gable) arriba. · `e6a46c9`

**Texturas listas (22 PNG) — "¿qué falta?"** → optimicé 51.5 MB de PNG → ~1.2 MB de
WebP 512×512 con `sharp`, registré las 22 en `TEXTURE_MANIFEST`, y documenté el
prompt de ChatGPT + el paso de optimización en `ART_ASSETS.md`. · `8bbcc5a`

**"Todo se ve muy oscuro, ¿más luminoso?"** → subí ambiente/direccional + luz
hemisférica, y luego (seguía oscuro) la **exposición del render** (1.6) y todas las
luces, aclarando fondo/niebla/cielo. · `0cb2329`, `8078909`

**"Antorchas con luz, talar toma tiempo, límite de madera"** → antorchas con luz
cálida parpadeante en cada casa; talar = **mantener F** con barra de progreso; tope
`MAX_WOOD=20`. Luego afinado a **extracción gradual** (~5s/unidad, 5 por árbol). ·
`6b8f77b`, `f37577f`

**"¿Construir con la madera? ¿persistir el mapa en 0G? ¿se puede destruir?"** →
documenté el split (Prompt 9: 9a gameplay / 9b 0G) y el mercado (Prompt 10); luego
implementé el **sistema de construcción (9a)**: paleta en vista aérea
(muro/casa/demoler), preview fantasma, colocar descontando madera, colliders,
demoler. Se integró con la **persistencia 0G del mundo** que hizo martelaxe
(`WorldState.buildings` viaja en el bundle de 0G). · `5af41f4`, `0b80c97`, `3980cc1`

**"Que los edificios roten; hay claros donde no se puede construir"** → rotación con
**R** (45°); arreglé que **árboles talados** ya no bloqueen (su collider quedaba);
enemigos/NPCs ya no atraviesan muros (`resolveBuildings`). · `85c35a1`

**"Construir con IA+tokens; entrar a los edificios"** → documentados como Prompt 11
(describe→IA edifica, presupuesto en tokens) y Prompt 12 (casas habitables/huecas). ·
`9871de6`

**"Iluminación/animación día-noche según la hora local del player"** → ciclo
día/noche: `computeDayNight(horaLocal)` mapea la hora real del jugador a sol, luces,
cielo, niebla, **estrellas de noche** y **antorchas encendidas de noche**; revisado
cada minuto. · `14d57ec`

**"Registrar cada cambio para que sea auditable por los jueces"** → creé este
`PROMPT_LOG.md`. · `53a4908`

### 17 jun 2026 · Astro móvil + workflow de prompt-logging
**Pedido (humano):** "el 'sol' me da problemas; que se mueva según la hora del
servidor, a esta hora ya no se debe ver; amanece 6am, anochece 7pm, gradual" + "que
cada agente, además de la tarea, redacte el prompt que la crea y lo guarde en el
historial de prompts".
**Prompt sintetizado:** (1) Sustituir la luna fija por un astro que recorre un arco
calculado por `computeDayNight(horaLocal)`: sol visible entre SUNRISE=6 y SUNSET=19,
bajo el horizonte fuera de ese rango; luna en el arco nocturno; ambos salen/ocultan
gradualmente. (2) Añadir `CLAUDE.md` instruyendo a los agentes a, por cada tarea,
sintetizar el prompt de la tarea y registrarlo en `PROMPT_LOG.md` junto al commit.
**Qué se hizo:** `Celestial` (sol/luna) posicionado por el ciclo; `CLAUDE.md` con el
workflow; este formato de log. **Commit:** `bffb428` (código) + este commit (docs).

### 17 jun 2026 · Soporte móvil + wallet con errores visibles
**Pedido (humano):** Revisar el proyecto, hacerlo jugable en celular además de computadora, registrar este pedido según `CLAUDE.md`, y diagnosticar por qué en móvil la pantalla inicial de conectar wallet no avanzaba y fallaba en silencio.
**Prompt sintetizado:** Audita el arranque de Engram en móvil y corrige el flujo de conexión de wallet para que no falle en silencio: prioriza un conector móvil adecuado, muestra errores/ayuda visibles cuando no haya proveedor o WalletConnect no esté configurado, y conserva el comportamiento de escritorio. Además, adapta la experiencia jugable para pantallas táctiles sin romper desktop: añade `viewport` móvil, habilita una ruta de control táctil jugable (vista aérea por defecto en touch, pad virtual, botones de acción y selección táctil de NPCs), y reutiliza la lógica actual de proximidad/interacción para hablar, talar y combatir. Verifica con `npx tsc --noEmit` y deja registro en `docs/PROMPT_LOG.md`.
**Qué se hizo:** Ajusté el contexto de wallet para preferir `walletConnect` en touch, exponer errores de conexión y dar ayuda visible; el botón ahora muestra esos mensajes. En la escena 3D añadí detección de dispositivos táctiles, vista aérea por defecto en móvil, controles virtuales de movimiento/acción y selección táctil de NPCs, manteniendo escritorio con pointer lock. También agregué `viewport` móvil en el layout, reemplacé los emojis rotos del inventario por iconos inline de madera/moneda y validé con `npx tsc --noEmit`. **Commit:** `31493e3`
