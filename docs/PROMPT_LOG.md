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

### 18 jun 2026 · Modo demo (sin wallet) + iluminación diurna + sol en pasos
**Pedido (humano):** En móvil no se puede abrir si no es en el navegador de
MetaMask — que se pueda explorar en "modo demo" sin wallet; además, de día el suelo
se ve muy oscuro (mejorar iluminación); y que el sol se mueva en arco "cada 5 minutos
del servidor" (:05, :10…).
**Prompt sintetizado:** (1) Añade un **modo invitado**: botón "explore as a guest" en
la pantalla de título que entra a Aldenmoor sin wallet (explorable, sin diálogo ni
guardado); el header muestra "Demo" + botón Conectar; oculta UI de memoria/carga sin
address. (2) Corrige el suelo oscuro de día (textura oscura × color base oscuro):
aclara el color base del terreno y sube la luz ambiente/hemisférica diurna en
`computeDayNight`. (3) Cuantiza la hora local a pasos de 5 min para que el sol salte a
su siguiente posición en :00/:05/:10. Verifica con `tsc`.
**Qué se hizo:** modo invitado en `client-page` (gate, botón, header y overlays
condicionados a `address`); terreno aclarado + más luz de día; `quantHour` a 5 min.
**Commit:** `874a134`

### 18 jun 2026 · Cablear el conector WalletConnect (deeplink móvil a MetaMask)
**Pedido (humano):** Que el botón Conectar pueda abrir la app de MetaMask en celular
(usar `NEXT_PUBLIC_PROJECT_ID`).
**Prompt sintetizado:** El config de wagmi solo registra el conector `injected`, así
que `NEXT_PUBLIC_PROJECT_ID` no se usa y el "preferir walletConnect en móvil" no tiene
conector. Agrega el conector `walletConnect` (de `wagmi/connectors`) a
`src/config/index.ts`, condicionado a que exista `projectId`, con metadata de la app,
para que en móvil sin wallet inyectada se pueda conectar la APP de MetaMask/Rabby por
deeplink/QR. Verifica con `tsc`.
**Qué se hizo:** añadí `walletConnect({ projectId, showQrModal, metadata })` cuando hay
`NEXT_PUBLIC_PROJECT_ID`. **Commit:** `e562fc6`

### 18 jun 2026 · Reforma de controles táctiles + menos enemigos
**Pedido (humano):** En celular: (1) el hint "Touch mode…" estorba/encima de la
moneda y los recursos deberían apilarse (moneda debajo de madera); (2) el D-pad se
siente escondido y selecciona texto — mejor arrastrar el dedo para moverse; (3) menos
enemigos y que no aparezcan tan pronto; (4) no mostrar el hint "WASD…"; (5) botón para
cambiar entre aérea y primera persona.
**Prompt sintetizado:** Rehaz los controles móviles de la escena 3D: reemplaza el D-pad
por un **joystick de arrastre** flotante (zona izquierda, `touch-action:none`,
`select-none`) que setea el movimiento; en primera persona añade una **zona de arrastre
derecha para mirar** (yaw de la cámara, sin pointer-lock). Muestra el **toggle aérea↔1ª
persona también en táctil** y habilita FP en móvil con joystick+look (arranca en aérea
una vez). Apila el HUD de madera/moneda en vertical, mueve el hint táctil al borde
inferior (corto) y oculta los hints de teclado en táctil. Baja los enemigos: tope 6,
spawn cada ~9s y solo tras ~20s de calma. Verifica con `tsc`.
**Qué se hizo:** componentes `TouchJoystick`/`TouchLook`; `Player` acepta
`touchMove`/`touchYaw` (mezcla movimiento + aplica yaw); toggle visible en móvil;
`EnemySpawner` con tope 6, intervalo 9s y delay inicial 20s; HUD apilado y hints
ajustados. **Commit:** `0e315f6`

### 18 jun 2026 · Móvil: sin scroll, mirar arriba/abajo, sin selección, 13 enemigos
**Pedido (humano):** 13 enemigos y spawn cada ~2 min; el drag con el pulgar derecho
falla por el scroll → que el juego en móvil no tenga scroll (que la pantalla abarque
100% el render, sin que exista scrollbar); los botones con texto (p.ej. "chop") aún
seleccionan el texto al presionar; no se ve cómo atacar; y se siente raro no poder
mover el ángulo de cámara en 1ª persona (mirar al cielo/suelo).
**Prompt sintetizado:** (1) Enemigos: tope 13, intervalo 120s. (2) Elimina la causa
del scroll en móvil: `html,body { overflow:hidden; overscroll-behavior:none }` y
contenedores a `100dvh` para que el render llene exacto el viewport. (3) Evita la
selección de texto en botones globalmente (`user-select:none`, `-webkit-touch-callout`
). (4) Permite mirar con pitch además de yaw en 1ª persona táctil: la zona de arrastre
derecha acumula dx/dy y el `Player` aplica yaw + pitch clampeado vía un `Euler`
sembrado de la cámara. Verifica con `tsc`. (Ataque: ya existe — botón rojo al acercar
el avatar a un enemigo, radio 4.)
**Qué se hizo:** `MAX_ENEMIES=13`/120s; CSS no-scroll + `100dvh`; regla global de
botones; `TouchLook` ahora pasa `{dx,dy}` y `Player` hace yaw+pitch. **Commit:** `adbbe3a`

### 18 jun 2026 · iOS sigue con scroll → fijar el body
**Pedido (humano):** En iPhone (Safari y Chrome) **sigue habiendo scroll**.
**Prompt sintetizado:** `overflow:hidden` no frena el rubber-band de iOS; saca el
`body` del flujo con `position:fixed; inset:0; width:100%` para que no haya nada que
scrollear, y desactiva el zoom (`maximumScale:1`, `userScalable:false`) que también
provoca pan. Verifica con `tsc`.
**Qué se hizo:** `body { position:fixed; inset:0 }` en `globals.css` y viewport sin
zoom en `layout.tsx`. **Commit:** `e3e9953`

### 18 jun 2026 · Construir en móvil con botón "Place"
**Pedido (humano):** En celular construir no funciona: al elegir un item no aparece
porque el control de movimiento "secuestra" la pantalla. Propuesta: al elegir item,
dejar de mover el personaje (o no competir) y colocar el item con un botón.
**Prompt sintetizado:** En táctil el joystick (overlay) tapa el canvas, así que el
`BuildController` por cursor no recibe el tap. Para móvil: no rendrices el
`BuildController`; en su lugar muestra un **fantasma frente al avatar** (posición
calculada de `posRef` cada frame, color por validez) y un botón **"Place"** (+ "Rotate"
y "Demolish nearby") que confirma la colocación. El usuario maneja el avatar para
apuntar y toca Place. Extrae `canPlaceBuilding()`/`demolishNearest()` para compartir la
validación entre desktop y móvil. Verifica con `tsc`.
**Qué se hizo:** `canPlaceBuilding`/`demolishNearest` extraídos; `BuildController` solo
en desktop; `MobileBuildGhost` + botones Place/Rotate/Demolish en táctil; estado
`buildRot`. **Commit:** `13d1419`

### 18 jun 2026 · Pulido móvil: hint, talar duplicado, sin selección
**Pedido (humano):** Quitar el texto "Drag to move…" en celular; frente a un árbol se
duplica el talar ("Hold F to chop" con barra + botón "Hold to chop") — combinarlos; y
que **nada** sea seleccionable como texto en celular.
**Prompt sintetizado:** (1) No muestres el hint persistente "Drag to move" en táctil
(déjalo solo en modo construir). (2) Unifica el talar en móvil: el prompt "Hold F to
chop" con barra queda **solo en desktop** (`!isTouchDevice`) y el **botón táctil "Hold
to chop"** incorpora la **barra de progreso** y el estado "Wood full". (3) En táctil,
desactiva la selección de texto en toda la UI con `@media (pointer:coarse) { * {
user-select:none } }`, dejando `input/textarea` usables; no toques desktop (para poder
copiar hashes en el demo). Verifica con `tsc`.
**Qué se hizo:** prompt de barra gateado a desktop; barra dentro del botón móvil +
"Wood full"; hint solo en build; media query no-select. **Commit:** `91fe77c`

### 18 jun 2026 · Núcleo protegido + precio de construcción por cercanía
**Pedido (humano):** que el centro de la aldea no sea construible y que construir
cueste más cuanto más cerca del centro (para no "ensuciar" la aldea y que se formen
sub-aldeas); subir el límite de madera a 100; definir juntos los precios/zonas antes de
documentarlo. (Aclaración: la persistencia en 0G ya estaba hecha por martelaxe.)
**Prompt sintetizado:** Implementa zonas de construcción: núcleo `r<12` no construible;
fuera, `costo = base × mult` con `mult = clamp(6−(d−12)·5/33, 1, 6)` (6× pegado al
núcleo → 1× en r≥45); base muro 3 / casa 10; `MAX_WOOD=100`. Centraliza en
`buildCostAt`/`canPlaceBuilding` y pasa el costo a `placeBuilding(b, cost)` (la
persistencia no cambia). Actualiza la paleta (costo base con "+") y documenta el modelo
de IA del Prompt 11 (costo en madera, cap de `max_tokens` + BYO key). Verifica con `tsc`.
**Decisiones (vía AskUserQuestion):** núcleo 12, curva empinada 6×→1×, IA = cap+BYO.
**Qué se hizo:** `NO_BUILD_RADIUS`/`buildCostAt` + `canPlaceBuilding` con núcleo y
precio; `MAX_WOOD=100`, base 3/10; `placeBuilding(b,cost)`; Prompt 9/11 actualizados.
**Commit:** `6af9958` (código) + este (docs).

### 18 jun 2026 · IA de construcción (Prompt 11)
**Pedido (humano):** No veo la opción de construir con IA (estaba documentada, no
implementada) → impleméntala.
**Prompt sintetizado:** Crea `/api/build` (espejo de `/api/npc`): recibe
`{prompt, apiKey?}`, llama a Claude con `max_tokens` capado (~1000) + rate-limit, y
devuelve `Building[]` como offsets (dx,dz) desde el jugador; BYO key opcional y fallback
determinista sin key. En el cliente añade un botón "🤖 Build with AI" en la paleta
(aérea) con un modal (descripción + key opcional) que postea, convierte offsets a
absoluto alrededor del avatar, y coloca cada pieza con `canPlaceBuilding` +
`placeBuilding(b, buildCostAt(...))` (paga en madera, respeta núcleo/precio). Reporta
piezas y madera. Verifica con `tsc`.
**Qué se hizo:** `src/app/api/build/route.ts`; estado/modal/`runAIBuild` en Scene3D;
Prompt 11 → done. **Commit:** `99bbe6d`

### 18 jun 2026 · IA: preview + costo USD + límite de gasto
**Pedido (humano):** Para la construcción con IA: un **preview** antes de colocar, una
**aproximación del costo en USD** (ej. $0.05), y poder **limitar** cuánto $ gastar
(el usuario pone su key y un tope).
**Prompt sintetizado:** En `/api/build` devuelve `usage` y un `costUsd` calculado con
el precio de Claude Sonnet 4.6 ($3/M in, $15/M out, configurable por env). En el cliente
cambia el flujo a **preview**: "Preview" pide a la IA, muestra los fantasmas (morado=va,
rojo=bloqueado) en el sitio generado, y un botón **Place/Discard** confirma (paga madera).
Añade un **tope de gasto por sesión** (persistido en localStorage) que bloquea nuevas
generaciones al alcanzarlo, y muestra costo + gasto acumulado. Verifica con `tsc`.
**Qué se hizo:** `usdCost`/`costUsd` en el endpoint; `AIPreviewGhosts` + estado
preview/budget/spent + `requestAIBuild`/`placeAIPreview` y modal con budget en Scene3D.
**Commit:** `7ff2474`

### 18 jun 2026 · Bloques voxel para que la IA construya cualquier cosa
**Pedido (humano):** Pedí "un árbol" y la IA puso dos muros — solo puede usar el catálogo
(wall/house). Idea: un sistema de bloques pequeños que la IA agrupe y coloree según lo
que pida el usuario.
**Prompt sintetizado:** Añade un tercer tipo de edificio **`block`**: un cubo pequeño con
`y` (altura), `color` (hex) y `scale`. La IA (`/api/build`) ahora apila y colorea muchos
bloques (estilo voxel/LEGO) para esculpir lo que se pida (árboles, estatuas, torres), no
solo muros/casas; el system prompt la guía a usar bloques para todo lo que no sea muro o
casa, MAX_PIECES 24→64. Los bloques son decorativos (sin colisión, se solapan libremente,
costo base 1 madera) y persisten como cualquier edificio. Preview/place/costo manejan los
atributos del bloque; el fallback sin key es un arbolito voxel. Verifica con `tsc`.
**Qué se hizo:** `BuildingType` += 'block' + campos y/color/scale en `types.ts`;
`BUILD_COST/RADIUS.block` + normalización en `world.ts`; render/colisión/preview/IA en
Scene3D; prompt + normalización de bloque en el endpoint. **Commit:** `8f7588a`

### 18 jun 2026 · Sincronizar estados en ENGRAM_PROMPTS
**Pedido (humano):** Actualizar docs (sobre todo `ENGRAM_PROMPTS`) y dar la lista de
tareas pendientes para repartir entre partners.
**Prompt sintetizado:** Marca en el índice de `ENGRAM_PROMPTS` lo ya hecho (Prompt 4
móvil = done; Prompt 11 = bloques voxel + preview + costo + budget) y deja claras las
pendientes (6 audio, 7 429-UX, 10 mercado, 12 habitables, + ADMIN).
**Qué se hizo:** actualicé el índice (4 y 11). Pendientes: 6, 7, 10, 12 + tareas ADMIN.

### 18 jun 2026 · Aviso de costo de tokens en el modal de IA
**Pedido (humano):** Confirmar que al descartar se devuelve la madera pero NO los tokens
del agente, y agregar un pequeño aviso en la UI.
**Prompt sintetizado:** En el modal "Build with AI" añade una nota: generar un diseño
llama a la IA y **cuesta unos centavos de tokens aunque descartes** (la madera solo se
gasta al Place y se devuelve si no guardas), y muestra el **gasto acumulado** ("spent $X")
en la cabecera. Verifica con `tsc`.
**Qué se hizo:** nota de advertencia + "spent $X" visible en el header del modal.
**Commit:** `7f64ed7`

### 18 jun 2026 · Repasar docs + guion del video
**Pedido (humano):** Revisar que los docs estén alineados con lo actual, sobre todo el
guion del video (martelaxe propuso una narración nueva).
**Prompt sintetizado:** Adopta la narración pulida de martelaxe en `DEMO_SCRIPT.md`
manteniendo la shot-list/tips; corrige la nota obsoleta ("cross-device no live") porque el
registry ya ancla el puntero on-chain → cross-device SÍ funciona (mantén el caveat de
"sponsored, no wallet-pays"); añade un beat opcional para el 2º uso de 0G (mundo construido
+ public world). Actualiza `STATUS.md` ("Also working") con building/IA/voxel/day-night/
mobile/guest/public-world.
**Qué se hizo:** reescribí `DEMO_SCRIPT.md` (narración de martelaxe + honestidad
actualizada + beat opcional) y amplié `STATUS.md`.

### 18 jun 2026 · Salto en primera persona (Space)
**Pedido (humano):** Un control extra: que la tecla espacio haga un "salto".
**Prompt sintetizado:** Agrega un binding `jump` (Space) a `keyboardMap` y física simple
en `Player`: al presionar Space estando en el suelo, lanza con `JUMP_SPEED` y cae con
`GRAVITY`, sumando un offset a la altura de cámara (sobre el follow del terreno); un salto
por pulsación (sin rebote al mantener). Actualiza el hint de FP. Verifica con `tsc`.
**Qué se hizo:** binding + refs `jump` + física en el frame del Player; hint "Space jump".
**Commit:** `745a143`

### 18 jun 2026 · Luz ambiente legible + guardado NPC estable
**Pedido (humano):** Corregir dos cosas: 1) cuando oscurece, dejar suficiente luz de
"ambiente" para ver piso, árboles y la escena en general, sin que se sienta todo opaco ni
de noche ni de día; 2) al hablar con un NPC y usar "leave and save", corregir los errores
de guardado (`503` / `500`). Hacer cada arreglo en un commit separado.
**Prompt sintetizado:** Rebalancea `computeDayNight()` para mantener una base de visibilidad
en la noche y ajustar ambiente/cielo/niebla/luz direccional sin romper la atmósfera.
Después, arregla el guardado de memoria del juego aislándolo del indexer `standard` de 0G,
que hoy devuelve `503`: haz que el bundle de NPCs/mundo lea y escriba por Turbo aunque la UI
esté en Standard, y registra tanto la red solicitada como la efectiva en logs. Verifica con
`npx tsc --noEmit` y deja los arreglos en commits separados.
**Qué se hizo:** subí el piso de visibilidad nocturna y rebalanceé ambiente, cielo, niebla
y luz direccional para que el mundo siga legible. Luego encapsulé la memoria del juego para
que use Turbo al leer/escribir el bundle aunque el toggle esté en Standard, evitando los
`503` del indexer deprecated y los `500` posteriores en `leave and save`. **Commit:**
`c765226`, `c81ec4f`

### 18 jun 2026 · Segunda pasada de legibilidad nocturna
**Pedido (humano):** Ajustar otra vez la noche porque todavía se sentía algo opaca.
**Prompt sintetizado:** Haz una segunda pasada sobre `computeDayNight()` para llevar la
noche desde "dramática pero opaca" a "oscura pero claramente jugable": sube el piso de
visibilidad, aclara un poco fondo/niebla y refuerza ambiente/hemisphere mientras reduces
algo del peso de la luz direccional, para que el terreno y los árboles no queden enterrados
en sombras. Verifica con `npx tsc --noEmit` y deja el cambio en un commit separado.
**Qué se hizo:** incrementé la base de visibilidad nocturna, aclaré cielo y niebla, subí
la luz ambiente/hemisphere y bajé la fuerza de la direccional para que el piso siga leyendo
sin perder el mood nocturno. **Commit:** `d0f4d7a`

### 18 jun 2026 · Antorchas útiles + fill nocturno + luciérnagas
**Pedido (humano):** Hacer una tercera pasada de iluminación nocturna con antorchas más
útiles, un fill nocturno suave y luciérnagas, y empujar los commits sin miedo.
**Prompt sintetizado:** En vez de seguir dependiendo solo de la iluminación global o de
retocar materiales, añade fuentes de luz locales para que la noche sea más legible sin
romper el ambiente: refuerza las antorchas (más alcance/intensidad + glow visible), suma
un fill light nocturno muy suave sobre el pueblo y añade luciérnagas como acento vivo
alrededor de Aldenmoor. Mantén la activación ligada al estado nocturno (`torchesLit`),
verifica con `npx tsc --noEmit` y deja el cambio en un commit separado.
**Qué se hizo:** reforcé las antorchas con más intensidad, radio y halo, añadí dos luces
de relleno nocturnas suaves para levantar el terreno y sumé un enjambre de luciérnagas
con puntos de luz pequeños alrededor del pueblo. **Commit:** `fe8cc3a`

### 18 jun 2026 · Infraestructura de audio con fallback silencioso
**Pedido (humano):** Dejar preparado el entorno para el prompt de audio: llamadas listas
para grillos, pasos, fuego crepitando, etc., con fallback por si no hay archivos aún; no
romper nada; indicar dónde colocar los audios y dar una lista clara de assets por hacer.
**Prompt sintetizado:** Añade una capa de audio cliente compartida que permita disparar
loops y one-shots desde la escena y la UI sin depender de que los archivos existan todavía:
si un asset falta o el navegador bloquea reproducción, el juego debe seguir funcionando en
silencio. Conecta llamadas para ambiente nocturno, fuego, pasos, salto/caída, hachazo,
ataque y UI de diálogo/guardado. Además, documenta en un archivo de docs los paths exactos
esperados bajo `public/audio/...` para que luego solo haya que añadir los `.mp3/.wav`.
Verifica con `npx tsc --noEmit` y deja el cambio en commit separado.
**Qué se hizo:** añadí `AudioProvider` + manifiesto de cues con fallback silencioso,
conecté loops de grillos/fogata y one-shots de pasos, salto, caída, hachazo, ataque,
abrir/cerrar diálogo y save éxito/error; documenté los archivos esperados en
`docs/AUDIO_ASSETS.md`. **Commit:** `63893ed`

### 18 jun 2026 · Prompt 10: vender madera a Aldric → reputación persistente
**Pedido (humano):** Implementar el Prompt 10 y luego revisar los docs, sobre todo
`ENGRAM_PROMPTS.md`, para que todo quede alineado; dejarlo en dos commits con pushes
separados.
**Prompt sintetizado:** Cierra el MVP del mercado de Aldric sin añadir infraestructura
nueva: dentro del diálogo, añade una acción clara para vender madera con precio fijo,
selector de cantidad, feedback de monedas y reputación, y aplica la venta tanto al
inventario local del jugador como a la memoria persistente de Aldric. La venta debe subir
su `trust`, quedar visible en 📜 Memory y guardarse en 0G al usar **Leave & save**. Luego
alinea `ENGRAM_PROMPTS.md` y los docs de estado para reflejar que Prompt 10 v1 ya existe y
que Prompt 6 está parcialmente cableado.
**Qué se hizo:** añadí el panel de venta de Aldric dentro del diálogo (precio fijo, cantidad,
wood/coin y trust visibles), la venta descuenta madera, da coins y registra una interacción
positiva en la memoria de Aldric. Después actualicé `ENGRAM_PROMPTS.md` y `STATUS.md` para
marcar Prompt 10 v1 como hecho y Prompt 6 como parcial. **Commit:** `4221244` (código) + este commit (docs).

### 18 jun 2026 · Prompt 12: casas habitables + refino de bloques voxel IA
**Pedido (humano):** Hacer el Prompt 12 para que las casas sean habitables/huecas y, al
terminar, refinar el sistema de construcción por IA para usar cubos mucho más pequeños,
sin superposición entre sí pero sí pegados cara con cara, de modo que las formas se sientan
más armónicas y menos como cubos grandes malformados.
**Prompt sintetizado:** (1) Convierte las `house` construidas por el jugador en casas
huecas dentro de la misma escena: reemplaza el volumen sólido por paredes finas, deja una
puerta libre y cambia la colisión para que el jugador pueda entrar sin atravesar muros. (2)
Refina el modo voxel de `/api/build`: usa un grid fino compartido entre servidor y cliente,
reduce el tamaño por defecto de los cubos y prohíbe que se solapen entre sí, permitiendo
solo contacto cara con cara para obtener figuras más limpias y escultóricas.
**Qué se hizo:** rehice las casas de jugador como estructuras huecas con colisión por muros y
puerta abierta, de forma que ya se puede caminar dentro. Después afiné los bloques IA con una
grilla pequeña (`BLOCK_UNIT`), normalización cliente/servidor y validación anti-overlap entre
voxels, manteniendo el encastre sin huecos. **Commit:** `6a8175f`, `edc01e9` (código) + este commit (docs).
