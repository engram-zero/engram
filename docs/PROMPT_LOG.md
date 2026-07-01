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

### 18 jun 2026 · Aldea habitable, voxel más fino, refund real y backlog ampliado
**Pedido (humano):** Hacer cinco cosas con commits/pushes individuales: (1) volver
habitables y más grandes las seis casas existentes de la aldea; (2) bajar `BLOCK_UNIT`
a `0.2`; (3) hacer que al demoler un edificio propio se devuelva parte de la madera real
gastada, no el total; (4) considerar un sistema de aliados/enemigos entre players, incluso
sabotaje/demolición de edificios rivales por recursos; y (5) pasar revista a los docs,
sobre todo a los prompts, agregando nuevas tareas de mercado, demonios/horarios, animación
de tala, futuro del terreno, ríos, mapa grande y otras ideas útiles.
**Prompt sintetizado:** (1) Escala y vacía las seis `COTTAGES` del pueblo, reemplazando sus
colliders sólidos por muros/puertas para poder entrar también a las casas del escenario base.
(2) Reduce la unidad de voxel IA a `0.2` manteniendo el grid fino y la prevención de overlaps.
(3) Persiste en cada building el costo real pagado en madera y usa la mitad de ese valor como
refund al demoler. (4) Documenta un nuevo prompt para relaciones ally/enemy y sabotaje justo.
(5) Revisa y amplía el backlog de prompts con mercado comprable, fairness offline para demonios,
animación de gathering, dirección del terreno, ríos, escalado de mapa, reparación y durabilidad.
**Qué se hizo:** agrandé e hice huecas las seis casas de Aldenmoor, bajé `BLOCK_UNIT` a `0.2`,
hice que la demolición reembolse la mitad de la madera realmente pagada, añadí el prompt de
aliados/enemigos y amplié el backlog estratégico de `ENGRAM_PROMPTS.md`; además actualicé
`STATUS.md` con el estado real del proyecto. **Commit:** `7160b24`, `a2f9ca9`, `85e4e16`,
`6b7ad1a`, `46c68ac`, `e262ca7` + este commit (docs).

### 22 jun 2026 · Pulido pre-demo: sensibilidad de mouse, labels sobre la GUI y teclado al escribir
**Pedido (humano):** Antes de grabar el video, arreglar tres detalles: (1) la cámara
en primera persona se mueve demasiado fuerte con un leve movimiento del mouse; (2) los
nombres flotantes de los NPC quedan por encima del panel de Memory y ensucian la lectura;
(3) al escribir en el panel "build with AI" el avatar camina (una "W" lo manda al norte) y
hay que evitar además que lo tecleado quede en almacenamiento del navegador.
**Prompt sintetizado:** Baja la sensibilidad del PointerLockControls de primera persona a
~0.55. Oculta las etiquetas flotantes `<Html>` de los NPC siempre que haya un overlay 2D
abierto (no solo en aerial), porque drei las portalea a un z-index altísimo por encima del
panel de Memory; reutiliza el prop `aerial` plegándole `uiOpen`. Y como `KeyboardControls`
escucha en window, añade un guard `isTypingTarget()` dentro de `mergeMovement` que anule el
movimiento por teclado mientras el foco esté en un input/textarea/select/contentEditable;
marca los campos de prompt y API key con `autoComplete/autoCorrect/spellCheck` off para que
el navegador no recuerde lo tecleado.
**Qué se hizo:** `pointerSpeed={0.55}` en el `PointerLockControls`; el label del NPC ahora
se oculta con `aerial={view === 'aerial' || uiOpen}`; `mergeMovement` ignora el teclado vía
`isTypingTarget()`; textarea de prompt e input de key con autocompletado/corrector apagados.
tsc limpio. **Commit:** _(este commit)_

### 22 jun 2026 · UX de "Save World": estado claro y confirmación in-game
**Pedido (humano):** Pulir el flujo de Save World (que sentía con pasos de más): que
quede claro cuándo hay cambios sin guardar vs. guardados, y reemplazar el `window.confirm`
nativo al salir de la vista aérea por algo integrado.
**Prompt sintetizado:** Mantén el guardado por lotes (un solo Save World = una tx on-chain),
pero arregla el feedback: (1) píldora de estado persistente y con color — Saving / ✓ guardado /
● cambios sin guardar / ⚠ error; (2) el botón Save World refleja el estado (deshabilitado y "✓
Saved" cuando no hay cambios, resaltado en ámbar con "💾 Save World ●" cuando los hay); (3)
reemplaza el `window.confirm` de `switchView` por un modal in-game con tres acciones —
"Save & leave" (guarda a 0G y solo sale si tuvo éxito), "Discard & leave" (revierte al
snapshot de entrada) y "Keep editing". `publishWorld` ahora devuelve boolean para encadenar
el guardar-y-salir.
**Qué se hizo:** añadí estado `confirmLeave`, refactoré `switchView`/`leaveAerial`,
`publishWorld` retorna éxito, nuevo `saveAndLeave`, píldora de estado con tono e icono, botón
de guardar con estado dirty/saved y el modal de confirmación in-game. tsc limpio.
**Commit:** _(este commit)_

### 22 jun 2026 · Audio ambiental por distancia (espacial)
**Pedido (humano):** Implementar audio con alcance "como si fuera luz, pero sonido":
un crepitar en la fogata y grillos solo en ciertas áreas, atenuados por distancia.
**Prompt sintetizado:** Añade ambiente espacial sin requerir un puente de contexto al
canvas r3f. (1) En `AudioContext`, agrega `setLoopVolume(cue, volume)` que ajusta el
volumen del loop de forma continua sin reiniciarlo (volumen ~0 pausa, positivo asegura
play). (2) En la escena, define `AUDIO_EMITTERS` (emisores puntuales con `x,z,radius,
volume,nightOnly`): `campfire_crackle` en `CAMPFIRE` y varias bolsas de `night_crickets`
en el bosque/pradera, solo de noche. (3) Un driver por timer (200ms, no `useFrame`, para
que sirva en ambas vistas) lee `dynamicPlayerState` y fija el volumen de cada loop con el
emisor más cercano y caída lineal hasta el borde del radio; silencia al desmontar.
**Qué se hizo:** `setLoopVolume` en `AudioContext`, tipo `AudioEmitter` + tabla de emisores,
driver espacial en `Scene3D` que reemplaza el loop global anterior, y nota en `STATUS.md`.
tsc limpio. **Commit:** _(este commit)_

### 22 jun 2026 · LICENSE MIT para el submission del hackathon
**Pedido (humano):** Crear el archivo LICENSE para que el repo no se vea pobre en el
dashboard del Zero Cup y los jurados tengan claro el licenciamiento.
**Prompt sintetizado:** Añade un archivo `LICENSE` en la raíz con la licencia MIT
(permisiva, estándar de hackathon), con copyright 2026 a nombre de Engram.
**Qué se hizo:** creé `LICENSE` (MIT, © 2026 Engram). **Commit:** _(este commit)_

### 22 jun 2026 · Modo foto (?shot) para capturar el thumbnail del showcase
**Pedido (humano):** Preparar algo para el thumbnail (cover) del submission: idealmente
una escena/entorno único y limpio para tomar una captura del juego sin UI encima.
**Prompt sintetizado:** Añade un "modo foto" activado por el query param `?shot` que
deje el mundo listo para una captura limpia del showcase. (1) Oculta TODO el chrome:
HUD del juego (inventario, paleta de build, hints, crosshair, joystick, banners) en
`Scene3D` y el header/banners de la página en `client-page`. (2) Salta la pantalla de
título y entra directo a la aldea explorable sin requerir wallet. (3) Fija una hora
favorecedora: `?shot` solo → atardecer dorado con antorchas encendidas (18.6h); `?shot=12`
mediodía, `?shot=20` noche con estrellas, etc., parseando el valor como hora. El usuario
abre `engram-bay.vercel.app/?shot`, encuadra (V para vista aérea del pueblo o primera
persona junto a la fogata) y toma el screenshot.
**Qué se hizo:** `photoMode` en `Scene3D` (param `?shot`, hora pinneada vía
`computeDayNight`) y en `client-page` (header/banner/title-gate); todos los bloques de HUD
gateados con `!photoMode`. tsc limpio. **Commit:** _(este commit)_

### 22 jun 2026 · Documentar assets del showcase (logo + copy de YouTube)
**Pedido (humano):** Dejar documentado el prompt del logo (la "E" de fuego ya elegida)
y la descripción/título de YouTube para el submission.
**Prompt sintetizado:** En `docs/ART_ASSETS.md` añade una sección "Showcase assets" con:
el prompt de imagen del logo cuadrado (E de hilos de fuego sobre sello rúnico índigo),
la guía del thumbnail vía photo mode `?shot` (portada elegida = primera persona al
atardecer con los tres NPC junto a la fogata), y el título + descripción listos para
pegar en YouTube.
**Qué se hizo:** sección "Showcase assets (logo · thumbnail · video copy)" en
`ART_ASSETS.md` con prompt de logo, guía de thumbnail y copy de YouTube. **Commit:** _(este commit)_

### 22 jun 2026 · Rutas públicas para logo/cover del submission
**Pedido (humano):** Crear las rutas donde irán logo.png y cover.png (servidos en
engram-bay.vercel.app/.../logo.png y /cover.png), indicar dónde guardarlos y dejarlo
documentado.
**Prompt sintetizado:** Establece `public/assets/` como carpeta de assets del showcase
(Next sirve `public/` desde la raíz → `/assets/logo.png` y `/assets/cover.png`). Crea
`public/assets/README.md` con la convención (nombres exactos, URLs, specs) y referencia
las rutas desde `docs/ART_ASSETS.md`. El usuario solo suelta los dos PNG con esos nombres.
**Qué se hizo:** creé `public/assets/README.md` con la tabla de rutas/specs y añadí la
sección "Where the files live" en `ART_ASSETS.md`. **Commit:** _(este commit)_

### 22 jun 2026 · Favicon nuevo del sitio
**Pedido (humano):** Puse un `public/favico.ico`; ¿carga solo o hay que commitear algo?
**Prompt sintetizado:** El favicon del sitio lo resuelve la convención del App Router
(`src/app/favicon.ico`), no `public/`. Reemplaza `src/app/favicon.ico` con el ícono nuevo
y elimina el `public/favico.ico` (mal nombrado, sin la "n", y además sin efecto porque
gana el de `app/`).
**Qué se hizo:** sustituí `src/app/favicon.ico` por el ícono nuevo y borré
`public/favico.ico`. **Commit:** _(este commit)_

### 22 jun 2026 · Auditoría pre-submission + ignore de worktrees/harness
**Pedido (humano):** Revisión general del proyecto contra la documentación del hackathon,
buscando cosas por las que podríamos ser descalificados o no tomados en cuenta.
**Prompt sintetizado:** Audita riesgos de descalificación: secretos filtrados (claves en
git, .env), licencia, que 0G haga trabajo real, honestidad de la descripción, README y
demo en vivo. Como arreglo seguro, ignora en git los worktrees `.tmp*` (copias completas
del proyecto que un `git add -A` podría commitear) y el `.claude/settings.json` per-máquina.
**Qué se hizo:** escaneo de secretos (limpio: solo placeholders en `.env.example`, sin
claves en código), verificado README/LICENSE/demo 200; añadidos `.tmp*` y
`.claude/settings*.json` a `.gitignore`. Informe de hallazgos entregado al humano.
**Commit:** _(este commit)_

### 22 jun 2026 · Guía de voiceover ElevenLabs (sincronizada al video)
**Pedido (humano):** Cambiar la narración a voz IA (ElevenLabs) por pronunciación/vibecode;
dar la instrucción para generarla de modo que cada frase inicie EXACTO en su timecode del
video (subtítulos hechos a mano en Kdenlive), y documentarlo en el repo.
**Prompt sintetizado:** Documenta en `DEMO_SCRIPT.md` cómo generar la narración con
ElevenLabs sincronizada: voz/modelo/ajustes (narrador grave, Multilingual v2, stability
~50, speed ~0.95), la regla de pronunciar "0G" como "zero-G", y el flujo de generar CADA
frase como clip independiente para colocar su INICIO exacto en el timecode en Kdenlive
(el final puede ajustarse con speed/trim). Incluye la tabla de 16 líneas con sus timecodes
de inicio tal como están marcados en el proyecto.
**Qué se hizo:** sección "ElevenLabs voiceover" en `DEMO_SCRIPT.md` con ajustes de voz,
workflow de sincronización y la tabla timecode→texto. **Commit:** _(este commit)_

### 23 jun 2026 · Fix audio (pasos/hachazo/grillos) + tirón de cámara
**Pedido (humano):** No se oyen pasos, hachazos ni grillos; y la cámara en primera persona
a veces pega un salto violento de ángulo al mirar con el mouse mientras se camina.
**Prompt sintetizado:** (1) Pasos: el cue `footstep_grass` listaba 4 variantes pero solo
existe `-01`; las 404 atascaban el cursor de reproducción → deja el manifest con solo el
archivo existente y endurece `AudioContext.play` para que SIEMPRE avance el índice y salte
elementos no disponibles. (2) Hachazo: sólo sonaba al completar 1 unidad (~5s) → reproduce
`axe_chop` en cada golpe (~0.6s) mientras se tala. (3) Grillos: son night-only + por zona;
ensancha los radios de `AUDIO_EMITTERS` para que se oigan al salir del pueblo de noche.
(4) Cámara: limita `minPolarAngle`/`maxPolarAngle` del PointerLockControls para eliminar el
tirón de gimbal al mirar casi recto arriba/abajo.
**Qué se hizo:** manifest a 1 variante de paso, `play()` robusto, swing de hacha periódico
durante la tala, radios de grillos mayores, clamp vertical de la cámara. tsc limpio.
**Commit:** _(este commit)_

### 23 jun 2026 · Cámara: filtrar spikes del pointer-lock
**Pedido (humano):** El salto violento de la cámara en primera persona sigue (menos
frecuente) pese al clamp de ángulo.
**Prompt sintetizado:** El residuo no es gimbal sino un mousemove con `movementX/Y`
atípicamente grande (spike del pointer-lock) que PointerLockControls convierte en un
tirón. Añade un listener de `mousemove` en fase de captura que, cuando el pointer está
bloqueado y el delta supera un umbral (~200px en un evento), haga `stopImmediatePropagation`
para que el control no procese ese evento. Las vueltas rápidas normales quedan por debajo.
**Qué se hizo:** efecto con filtro de spikes en captura en `Scene3D`. tsc limpio.
**Commit:** _(este commit)_

### 23 jun 2026 · Grillos: muchos puntos aleatorios por el mapa (excepto el centro)
**Pedido (humano):** Aún no se oyen los grillos; poner varios puntos aleatorios en el mapa
donde se escuchen, menos en el centro.
**Prompt sintetizado:** Reemplaza las 4 bolsas de grillos hechas a mano por un generador
determinista (PRNG con semilla, como el bosque) que disperse ~16 emisores de `night_crickets`
por todo el anillo (radio 16..60 del centro), nunca dentro del core (radio <16), cada uno con
su propio radio de alcance. Siguen siendo night-only. Así se oyen "al azar" por todo el mapa
de noche, pero el centro queda en silencio.
**Qué se hizo:** `makeCricketEmitters()` con PRNG sembrado genera 16 puntos esparcidos;
`AUDIO_EMITTERS` los incluye. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Casa flotante en la colina: cimiento hundido
**Pedido (humano):** Una de las seis casas se ve "flotando" por estar en una colina.
**Prompt sintetizado:** El cottage se posiciona a la altura del terreno en su CENTRO, así
que en pendiente el lado cuesta-abajo queda en el aire. Añade un cimiento de piedra que se
hunda: calcula la caída del terreno del centro al rincón más bajo del footprint y extiende
una caja de cimiento hacia abajo (esa caída + margen), enterrada en el lado alto y tocando
el suelo en el lado bajo, para que ninguna casa flote.
**Qué se hizo:** helper `cottageFoundationDrop` (muestrea el terreno en los 4 rincones) y
una caja de cimiento por casa en `Cottage`. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Vista aérea: liberar el mouse + cursor personalizado
**Pedido (humano):** Al pasar a vista aérea el puntero queda secuestrado por el pointer-lock
(había que apretar Esc para usar las herramientas); además, estaría padre un cursor
personalizado en aérea (con prompt documentado para crear la imagen).
**Prompt sintetizado:** Como el mouse-look solo aplica en primera persona, libera el
pointer-lock siempre que NO estés en FP (efecto: si `!fpExploring` y hay `pointerLockElement`,
`exitPointerLock`), para que en aérea el puntero esté libre sin apretar Esc. Y aplica un
cursor CSS personalizado en aérea (`url(/assets/cursor-aerial.png) 8 8, crosshair`), con
fallback a crosshair hasta que exista el PNG; documenta el prompt para generarlo (32×32,
transparente) en `ART_ASSETS.md`.
**Qué se hizo:** efecto de liberación de pointer-lock fuera de FP, cursor aéreo en el root
div, y sección "Aerial cursor" en `ART_ASSETS.md`. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Grillos: más puntos y radios mayores
**Pedido (humano):** Sigo sin escuchar grillos; poner más cantidad de puntos y/o aumentar
el radio por si era muy pequeño.
**Prompt sintetizado:** Sube `makeCricketEmitters` a ~30 puntos con radios 24..40 y volumen
0.4, manteniéndolos night-only y fuera del core (radio <14), para que de noche se oigan casi
en cualquier lugar fuera del centro.
**Qué se hizo:** 30 emisores, radios 24..40, vol 0.4, CORE 14. (Recordatorio: son night-only;
de día no suenan — probar con `?shot=20` o de noche.) tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Cielo nocturno totalmente negro
**Pedido (humano):** Que de noche el cielo sea lo más negro posible (no azul, no gris; NEGRO).
**Prompt sintetizado:** En `computeDayNight`, el fondo y la niebla usaban el factor `visible`
(con piso 0.32) → de noche quedaban azul-grisáceos. Cámbialos para que dependan de `daylight`
(0 de noche) y así `bg` y `fog` lleguen a negro puro en la noche y vuelvan al azul de día,
sin tocar la iluminación del terreno (que mantiene su piso para que se siga viendo).
**Qué se hizo:** `bg`/`fog` interpolados desde `#000000` con `daylight`. tsc limpio.
**Commit:** _(este commit)_

### 23 jun 2026 · Avatares de NPC más estilizados (caras + detalles)
**Pedido (humano):** Mejorar los avatares de los NPC, estilizarlos/detallarlos para que no
se sientan genéricos.
**Prompt sintetizado:** Los avatares estaban sin cara (solo Sable tenía ojos), por eso se
sentían insípidos. Añade rasgos faciales y detalles de carácter, sin tocar gameplay:
Aldric (mercader) ojos, nariz, mejillas rosadas y barba gris jovial; Maren (capitana) ojos,
ceño severo bajo el yelmo y una capa corta de color de acento; Sable (informante) pañuelo que
cubre media cara y un broche luminoso en el cuello.
**Qué se hizo:** mallas aditivas de rostro/detalle en `CharacterBody` para los tres NPC.
tsc limpio. (Revisar visualmente tras el deploy.) **Commit:** _(este commit)_

### 23 jun 2026 · Ícono de madera en botones de construcción (en vez del □)
**Pedido (humano):** En los botones de la derecha de la vista aérea, el costo de madera
sale como un cuadro □ en vez del emoji.
**Prompt sintetizado:** El □ es el emoji 🪵 (Unicode reciente) que la fuente de Windows del
usuario no tiene. Reemplaza el 🪵 en los botones Wall/House por el componente SVG `WoodIcon`
(que siempre se ve), reestructurando el label a JSX `<icon label> ({cost}<WoodIcon/>)`; y
cambia el 🪵 del mensaje de la IA por la palabra "wood".
**Qué se hizo:** botones de construcción con `WoodIcon` SVG y costo; mensaje IA sin emoji.
tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Ambiente diurno (cuando NO es de noche)
**Pedido (humano):** Tener un sonido "de ambiente" para cuando NO es de noche (en lugar de
los grillos).
**Prompt sintetizado:** Añade un cue `day_ambience` (loop, `/audio/ambient/day-ambience-loop.mp3`)
y un emisor global (radio enorme, centrado) con bandera `dayOnly`; agrega soporte `dayOnly` al
driver espacial (`if (e.dayOnly && night) continue`) para que suene de día en todo el mapa y se
apague de noche (cuando entran los grillos). Tolerante a archivo faltante.
**Qué se hizo:** cue `day_ambience` en manifest + TODO, emisor global dayOnly, flag `dayOnly`
en `AudioEmitter` y en el driver. tsc limpio. (Falta poner el mp3.) **Commit:** _(este commit)_

### 23 jun 2026 · Riachuelo que atraviesa el mapa
**Pedido (humano):** Poner un riachuelo que atraviese el mapa.
**Prompt sintetizado:** Añade un arroyo translúcido que cruce el mapa por el norte,
bordeando la aldea (sin pasar por el claro central). Hazlo como una cinta de agua que se
drapea sobre el terreno (cada vértice a la altura del suelo `getHeightAt`+offset), para no
tallar el terreno ni afectar colisión/pathing (no toca `map.ts`). Curva suave (meandro),
material azul translúcido con leve emisión, `depthWrite:false`.
**Qué se hizo:** componente `River` con BufferGeometry tipo cinta siguiendo `riverCenterZ(x)`,
renderizado en la escena tras `Village`. tsc limpio. (Revisar a ojo; reroutear si hace falta.)
**Commit:** _(este commit)_

### 23 jun 2026 · Grillos: bajar volumen (~50%) y reducir área
**Pedido (humano):** Ya se escuchan los grillos; bajarles el volumen ~50% y reducir el área
donde se oyen.
**Prompt sintetizado:** En `makeCricketEmitters`, baja el volumen de 0.4 a 0.2, reduce el
número de bolsas (30→14) y sus radios (24..40 → 12..20), manteniéndolos night-only y fuera
del core, para que los grillos se oigan aquí y allá (no cubriendo todo el mapa) y más suave.
**Qué se hizo:** 14 emisores, radios 12..20, vol 0.2. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Árboles fuera del cauce del río
**Pedido (humano):** El río queda debajo de varios árboles y se ve raro; mover los árboles
para que no estén sobre el río.
**Prompt sintetizado:** Mueve la curva `riverCenterZ` a `map.ts` (fuente de verdad) y en la
generación de `TREES` excluye posiciones a menos de `RIVER_CLEAR` (~5.5) del centro del río,
para que colisión/tala/visual queden consistentes. En `Scene3D`, importa `riverCenterZ` de
`map.ts` en lugar de la copia local.
**Qué se hizo:** `riverCenterZ` + `RIVER_CLEAR` exportados en `map.ts`, filtro en `TREES`,
import en `Scene3D`. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Árboles dan 20 de madera (en vez de 5)
**Pedido (humano):** Que los árboles den 20 de madera en lugar de 5.
**Prompt sintetizado:** Sube el rendimiento de un árbol a 20 manteniendo el mismo tiempo de
tala: separa "ciclos para talar" (`TREE_CHOPS=5`) de "madera por ciclo" (`WOOD_PER_CHOP=4`),
con `TREE_WOOD = TREE_CHOPS*WOOD_PER_CHOP = 20`; `harvestTree` agota tras `TREE_CHOPS` y suma
`WOOD_PER_CHOP` por ciclo (capado a MAX_WOOD).
**Qué se hizo:** `TREE_CHOPS`/`WOOD_PER_CHOP`/`TREE_WOOD=20` en `world.ts`; `harvestTree`
actualizado. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Tala: 1 madera por ciclo, árbol cae a los 20
**Pedido (humano):** Corrección: que cada vez que se llena la barrita dé 1 unidad (no las
cinco/cuatro del cambio anterior), y el árbol desaparezca tras 20 unidades — así el tiempo
por unidad es como antes, pero talar el árbol entero toma más.
**Prompt sintetizado:** Ajusta `WOOD_PER_CHOP=1` y `TREE_CHOPS=20` (TREE_WOOD sigue 20), para
que cada ciclo de la barra otorgue 1 madera y el árbol se agote tras 20 ciclos.
**Qué se hizo:** constantes de tala a 1/20 en `world.ts`. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Vista aérea estilo RTS: avatar clickeable + click-derecho para mover
**Pedido (humano):** En vista aérea, que el avatar sea clickeable y al seleccionarlo emita un
aura neón/glow; y que con click derecho en el mapa el avatar camine solo en línea recta hacia
ahí (esquivando árboles, que ya se hace vía colisión).
**Prompt sintetizado:** (1) `Avatar` recibe `selectable/selected/onSelect`: onClick en el
cuerpo alterna selección y, al estar seleccionado, muestra un anillo neón pulsante + pointLight
(aura). (2) `AerialRig` recibe `moveTargetRef`: si no hay WASD y hay target, camina hacia él con
`resolveCollision` (desliza alrededor de obstáculos), llega a <0.35 o se rinde si queda atascado
~1.2s; WASD cancela el target. (3) Un plano invisible a y=0 (solo cuando NO se construye) captura
`onContextMenu` → fija el target en `e.point`; click izquierdo deselecciona. Suprime el menú
contextual del navegador en aérea.
**Qué se hizo:** glow/selección en `Avatar`, movimiento a target en `AerialRig`, plano de
click-derecho + refs/estado en el componente. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Auto-ocultar banners de guardado + crickets actualizado
**Pedido (humano):** Que el banner "✓ Saved to 0G · root…" de las conversaciones desaparezca
tras ~10-15s, y lo mismo para "All changes saved" del Save World; además actualicé el mp3 de
night-crickets, agrégalo al commit.
**Prompt sintetizado:** En `client-page`, efecto que resetea `save` a idle 12s después de
quedar 'saved'. En `Scene3D`, estado `showSavedPill` que se enciende al guardar el mundo y se
apaga a los 12s; la píldora "✓ All changes saved" solo se muestra mientras esté encendido
(las de saving/error/unsaved siguen siempre). Incluye el `night-crickets-loop.mp3` actualizado.
**Qué se hizo:** auto-dismiss del banner de memoria (12s) y de la píldora de mundo (12s);
mp3 de grillos actualizado. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · FP: cursor cuando no está secuestrado + click derecho = acción
**Pedido (humano):** Que el cursor PNG aparezca también en primera persona cuando la cámara
no tenga secuestrado el puntero; click izquierdo activa el modo cámara (lock), y click derecho
sea un botón de acción (atacar enemigos, hablar con NPCs, talar árboles).
**Prompt sintetizado:** (1) Muestra el cursor custom en FP cuando `!locked` (el left-click ya
hace lock vía PointerLockControls). (2) Suprime el menú contextual también en FP. (3) En el
listener de mouse, añade botón derecho como acción contextual (funcione con o sin lock):
prioridad enemigo→atacar (con `recordEnemyKill`), si no NPC→hablar (`onSelect`), si no árbol→
talar manteniendo (setea `fHeldRef` en mousedown derecho y lo suelta en mouseup). Mantén el
left-click de ataque (combate de henrique) intacto. Actualiza los hints.
**Qué se hizo:** cursor FP sin lock, context-menu suprimido en FP, click derecho de acción
(atacar/hablar/talar) vía refs sin closures stale, hints actualizados. tsc limpio.
**Commit:** _(este commit)_

### 23 jun 2026 · Grillos: bajar volumen otro ~50%
**Pedido (humano):** Bajar el volumen de los grillos otro ~50% (y commitear el mp3 nuevo).
**Prompt sintetizado:** Baja el volumen de los emisores `night_crickets` de 0.2 a 0.1.
(El mp3 en disco resultó idéntico al ya commiteado —mismo hash—, así que no había binario
nuevo que agregar.)
**Qué se hizo:** volumen de grillos 0.2 → 0.1. tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Aérea: click izquierdo detiene el auto-movimiento
**Pedido (humano):** En modo aéreo, cuando el avatar se mueve solo (click derecho), que un
click izquierdo en cualquier lugar (que no sea un botón) detenga ese movimiento.
**Prompt sintetizado:** Mientras `aerialExploring`, escucha `mousedown` botón izquierdo: si el
target no está dentro de un `<button>` (HUD), limpia `aerialTargetRef` para frenar el
auto-movimiento en el sitio.
**Qué se hizo:** efecto que cancela el move-target con click izquierdo (excepto sobre botones).
tsc limpio. **Commit:** _(este commit)_

### 23 jun 2026 · Docs para Fase 2 (Round of 32)
**Pedido (humano):** Pasamos de ronda (Group Stage aceptado); actualizar la documentación
para arrancar la Fase 2 en un chat nuevo con prioridades claras.
**Prompt sintetizado:** Marca en `ENGRAM_PROMPTS.md` el avance real (audio espacial ✅, río
parcial ✅, Group Stage enviado y aceptado, video/logo/thumbnail/license ✅) y añade una sección
"🏆 Fase 2 — Round of 32 (prioridades)" con el plan priorizado (multiplayer realtime, estabilizar
mundo público, pulido AV + mute, profundizar loop de memoria, relaciones entre players) y cómo
arrancar el chat nuevo. Refleja lo mismo en `STATUS.md` (progreso del torneo + qué sigue).
**Qué se hizo:** estados actualizados e índice ADMIN en `ENGRAM_PROMPTS.md`, nueva sección de
Fase 2, y secciones "Tournament progress" / "Round of 32 — what to do next" en `STATUS.md`.
**Commit:** _(este commit)_

### 25 jun 2026 · Mundo público estable: escanear siempre Turbo (Round of 32 #1)
**Pedido (humano):** Round of 32, prioridad #1: estabilizar el mundo público para que los
builds de todas las wallets se vean de forma consistente a los jueces, sin depender del toggle
de red.
**Prompt sintetizado:** El descubrimiento del mundo público (`src/lib/public-world.ts`) usa
hoy el `networkType` del toggle del jugador para `getNetworkConfig`, así que un juez con la red
en Standard descarga bundles desde el storage de Standard y no ve ningún build (los writes van
siempre a Turbo — STATUS.md gotcha #4; Standard y Turbo son redes de storage independientes; el
registry/L1 RPC es compartido). Fija el escaneo a Turbo de forma incondicional: introduce una
constante `PUBLIC_WORLD_NETWORK: NetworkType = 'turbo'`, úsala en `getNetworkConfig` y en la
cache key dentro de `initPublicWorld`, e ignora el `networkType` recibido (renómbralo a
`_networkType`, manteniendo la firma para no tocar callers). No subir el `scanLookback` a ciegas
(arriesga el cap de rango de `eth_getLogs`); queda env-overridable. tsc debe pasar.
**Qué se hizo:** constante `PUBLIC_WORLD_NETWORK='turbo'` con comentario explicativo;
`initPublicWorld` ahora escanea Turbo siempre (storage + cache key) e ignora el toggle; firma
intacta. `npx tsc --noEmit` limpio. **Commit:** 09aefe2

### 25 jun 2026 · Mute toggle de audio (cierra Prompt 6, Round of 32 #2)
**Pedido (humano):** Round of 32, prioridad #2: añadir el toggle de mute pendiente del sistema
de audio (último ítem abierto del Prompt 6).
**Prompt sintetizado:** Añade mute global al `AudioProvider`
(`src/context/AudioContext.tsx`): expón `muted: boolean` y `setMuted(next)` en el contexto,
persistido en `localStorage` (`engram:audioMuted`) e hidratado en mount (client-only, sin
mismatch SSR). Implementa el mute vía `element.muted` (no tocando `volume`) para no pelear con
la lógica de volumen espacial por-tick: aplica `mutedRef.current` a cada elemento al crearlo en
`getCue`, y al togglear recorre los cues existentes seteando `.muted`. Cablea un botón
🔊/🔇 en el header de `client-page.tsx`, visible también en modo Demo/guest, con `aria-label`.
tsc debe pasar.
**Qué se hizo:** `muted`/`setMuted` con persistencia en `AudioContext`; `.muted` aplicado en
creación y en toggle; botón de mute en el header (siempre visible). `npx tsc --noEmit` limpio.
**Commit:** 14f1c6c

### 25 jun 2026 · Regateo con Aldric (Prompt 10 v2, Round of 32 #4)
**Pedido (humano):** Round of 32, prioridad #4: profundizar un loop con la memoria 0G que luzca
en cámara — el regateo/negociación con Aldric (Prompt 10 v2), donde el jugador propone un precio
y el LLM responde en personaje (acepta / contraoferta / rechaza), ajustando trust y persistiendo
en 0G.
**Prompt sintetizado:** Implementa el regateo de venta de madera con Aldric **extendiendo
`/api/npc`** (no un endpoint nuevo), para reusar rate-limit, proveedor LLM, fallback y el flujo
de memoria. (1) Contrato en `types.ts`: `NPCChatRequest.offer?: TradeOffer { resource:'wood',
quantity, pricePerUnit }` y `NPCChatResponse.trade?: TradeDecision { accepted,
agreedPricePerUnit, quantity }`. (2) Servidor: cuando llega `offer` y el NPC es Aldric, sanitiza
la oferta, inyecta un bloque de negociación en su system prompt (precio justo=2, techo=5,
abusivo≥6, su trust actual; reglas acepta/contraoferta/rechaza, recompensa lealtad), pide al
modelo un campo `trade` además de `dialogue`/`memory_update`, y **clampa** el veredicto contra la
oferta real (nunca paga > lo pedido ni > techo, ni compra más de lo ofrecido). Fallback
determinista `decideTradeFallback` para cuando no hay key o el modelo no devuelve `trade`. El
servidor **no** mueve recursos. (3) Cliente: `chat()` acepta `offer` y devuelve `trade`; panel de
Aldric gana input "Your price / wood" + botón "Propose deal"; al aceptar aplica `addResource`
(wood−, coin+ a `agreedPricePerUnit`) y el `trust_delta` se persiste con **Leave & save**; si
rechaza, no se mueve nada. Se conserva el botón fijo "Sell wood". tsc debe pasar.
**Qué se hizo:** contrato `TradeOffer`/`TradeDecision`; negociación + clamp + fallback en
`/api/npc/route.ts`; `chat()` extendido y UI de regateo en `client-page.tsx`. Verificada la
aritmética del fallback (justo paga 2; 4–5 → contraoferta 3, leal 4; ≥6 rechaza).
`npx tsc --noEmit` limpio. **Commit:** 69b79e9

### 25 jun 2026 · Pulido del río: bordes suaves + color apagado (Round of 32 #3)
**Pedido (humano):** Round of 32, pulido AV: corre el dev server, juzga el río a ojo y
arréglalo. Diagnóstico (vía capturas aéreas headless con SwiftShader): el río se veía como una
banda cian saturada, de ancho uniforme y bordes duros ("agua de piscina").
**Prompt sintetizado:** Reescribe `River()` en `Scene3D.tsx` para que la cinta de agua deje de
ser una banda plana: (1) genera 3 carriles transversales (L/centro/R) en vez de 2 y usa
**vertex colors** horneando un color de orilla más oscuro (`#16323c`) en los bordes y el núcleo
en un teal-acero apagado (`#2c5d70`), de modo que el agua se difumine en su orilla (borde suave
sin shader propio); (2) haz que el medio-ancho **serpentee** con `2.5 + sin(x*0.17)*0.85` para
que no sea uniforme; (3) baja saturación/emissive/metalness del material (`vertexColors`,
opacity 0.82, roughness 0.3, metalness 0.25, emissive `#0c2630` @0.15). Mantén el drapeado sobre
el terreno y `depthWrite:false`. Verifica a ojo con capturas aéreas. tsc debe pasar.
**Qué se hizo:** `River()` con 3 carriles, vertex colors de orilla, ancho serpenteante y
material apagado; verificado con capturas aéreas (antes/después). `npx tsc --noEmit` limpio.
**Commit:** fd02145

### 25 jun 2026 · Relleno lunar nocturno + STATUS Round of 32
**Pedido (humano):** Sube un pelín el relleno lunar (que el suelo no quede tan negro de noche);
y actualiza `STATUS.md` marcando los cuatro ítems de la ronda como hechos.
**Prompt sintetizado:** En `computeDayNight` (`Scene3D.tsx`) sube el piso de visibilidad
nocturna `visible` de `0.32 + daylight*0.68` a `0.42 + daylight*0.58` (mantiene el tope diurno
en 1.0, así el día no cambia; solo sube el relleno lunar que alimenta ambient/hemi/dir de noche).
En `STATUS.md`, en "Round of 32 — what to do next", marca como hechos: mundo público (Turbo),
mute toggle, regateo con Aldric (v2) y pulido del río + relleno lunar, con sus commits; deja
multiplayer como diferido. tsc debe pasar.
**Qué se hizo:** piso nocturno 0.32→0.42 en `computeDayNight`; sección Round of 32 de
`STATUS.md` actualizada con los cuatro hechos. `npx tsc --noEmit` limpio. **Commit:** 6c84778

### 25 jun 2026 · Copy honesta del dashboard (riesgo de misrepresentation)
**Pedido (humano):** La descripción del dashboard dice "your wallet pays" pero el storage lo
paga la sponsor wallet server-side — ¿riesgo de DQ? Guarda una versión corregida lista para
pegar cuando abra el submit del R32.
**Prompt sintetizado:** En `docs/STATUS.md` (Tournament progress) reemplaza el ítem del
dashboard por una versión que (1) explique que la copy actual afirma en presente "your wallet
pays" mientras el storage es sponsoreado (`ENGRAM_SPONSOR_KEY`) → wording DQ-shaped de bajo
riesgo; (2) incluya una **descripción corregida lista para pegar** que cambia solo el último
párrafo: mantiene "one signature from your wallet" + "you own it / auditable by root hash"
(ambos ciertos: el jugador firma el puntero `setRoot`), elimina el "your wallet pays" falso y
**declara el sponsor del demo como diseño**. Reencuadra el post en X como relevante solo desde
cuartos (community voting), no en R32/R16 (jueces).
**Qué se hizo:** ítem del dashboard reescrito + bloque "Paste-ready corrected dashboard
Description" en `STATUS.md`; nota del X reencuadrada. (Análisis del flujo real: storage =
sponsor; puntero `setRoot` = firma del jugador.) **Commit:** 60562e8

### 25 jun 2026 · Mercado v2 — Fase 1: lado de compra + spread + sinks (Prompt 14)
**Pedido (humano):** Que Aldric VENDA bienes con coin y que el mercado tenga "ventaja de la
casa" (spread bid/ask, como un casino): comprar siempre cuesta más coin del que se recibe al
vender, para no poder arbitrar contra el regateo. Hacha a 70 coin.
**Prompt sintetizado:** Fase 1 del mercado v2 con precios estáticos. (1) `WorldState` gana
`axeLevel` (types + normalize/clone/EMPTY). (2) En `world.ts`: tabla `MARKET` con
`{ wood: { sell: 2, buy: 6 } }` (buy > sell SIEMPRE, y buy > el techo del regateo 5 para que
ni el mejor regateo permita arbitraje), constantes `AXE_UPGRADE_COST=70` y `SAPLING_COST=5`, y
acciones `replantTree()` (saca el último árbol de `choppedTrees` → reaparece), `upgradeAxe()`
(`axeLevel=1`) y `receiveBoughtWood(units)` (suma madera capada a MAX_WOOD); `harvestTree` rinde
×2 con `axeLevel>=1`. (3) En `client-page.tsx`: handlers `buyWoodFromAldric`/`buySaplingFromAldric`/
`buyAxeUpgradeFromAldric` que descuentan coin, aplican el efecto y registran la compra en la
memoria de Aldric (`applyAldricSpend`, +1 trust) para que persista con Leave & save; sección
"Buy from Aldric" en el panel del comerciante. tsc debe pasar. (Fase 2: precio dinámico por
escasez de árboles × inflación de coin. Fase 3: gathering de stone.)
**Qué se hizo:** `axeLevel` + `MARKET`/costos + `replantTree`/`upgradeAxe`/`receiveBoughtWood` en
`world.ts`; yield del hacha en `harvestTree`; handlers + UI de compra en `client-page.tsx`.
`npx tsc --noEmit` limpio. **Commit:** d71358b

### 25 jun 2026 · Mercado v2 — Fase 2: precio dinámico relativo (Prompt 14)
**Pedido (humano):** Que el precio del mercado sea relativo: la madera depende de cuántos
árboles quedan vs cuántas monedas hay. Y el spread simétrico multiplicativo (la casa gana 1.3×
en ambas direcciones: comprar 1 madera ≈ 1.3 coin; obtener 1 coin ≈ 1.3 madera).
**Prompt sintetizado:** Implementa pricing dinámico de madera v1. En `world.ts`: `woodQuote(world,
totalTrees)` con `scarcity = 0.8 + (1−forest)` (forest = árbolesRestantes/total), `inflation =
1 + min(coin/200,1)*0.5`, `mid = 3*scarcity*inflation`, y **spread multiplicativo** `HOUSE_SPREAD=1.3`:
`sell = round(mid/1.3)`, `buy = round(mid*1.3)` forzado `> haggleCeil` (= round(mid)) para que NUNCA
se pueda arbitrar contra el regateo. `TradeOffer` gana `referencePrice` (el mid vivo). En
`/api/npc`: `haggleParams(ref)` deriva fair/ceil/abusive del mid (fallback a constantes si falta);
`negotiationInstruction`, `decideTradeFallback` y `clampTrade` los usan, así el regateo flota con el
mercado. En `client-page.tsx`: `quote = woodQuote(world, TREES.length)` (useMemo); venta rápida,
compra, regateo y labels usan `quote.sell/buy/mid`; se elimina el `ALDRIC_WOOD_PRICE` fijo. tsc debe
pasar y mantenerse el invariante buy>ceil (la casa siempre gana).
**Qué se hizo:** `woodQuote` + constantes en `world.ts`; `referencePrice` en el contrato;
`haggleParams` + integración en `/api/npc`; quote vivo cableado en `client-page.tsx`. Verificado el
invariante (houseWins=true) y la curva en 6 estados. `npx tsc --noEmit` limpio. **Commit:** fbef41a

### 25 jun 2026 · Mercado v2 — Fase 3: gathering de stone (minería) + mercado (Prompt 14)
**Pedido (humano):** Agregar un recurso real nuevo: que se pueda **minar piedra** (nodos de roca,
como los árboles) y comerciarla con Aldric. (Y pregunta: ¿minar podría ser minería literal de
cómputo? → sí, mejor vía 0G Compute que PoW; idea post-torneo.)
**Prompt sintetizado:** Espeja el sistema de árboles para piedra. (1) `map.ts`: `ROCKS` (16 nodos
deterministas en las colinas, fuera del núcleo/río/cottages) + sus colliders. (2) `WorldState`
gana `minedRocks` (types + normalize/clone/EMPTY); en `world.ts` `MAX_STONE=60`, `ROCK_MINES=18`,
`harvestRock`/`isMined`/`stoneIsFull` (espejo de `harvestTree`), y `MARKET.stone={sell:4,buy:9}`
(buy>sell, house edge; piedra más cara que madera). (3) `Scene3D.tsx`: componente `Rocks`
(InstancedMesh de dodecaedros, oculta los `minedRocks`); rocas añadidas a los obstáculos de
`resolveCollision` y de colocación de edificios (filtrando `!isMined`); detección de roca cercana
en el Player FP (`onNearbyRockChange`, `MINE_RANGE`); el loop de hold-action mina la roca si no hay
árbol en rango (prioridad árbol); click-derecho y los HUDs (desktop + táctil) ganan el hint "Hold F
to mine". (4) `client-page.tsx`: handlers `sellStoneToAldric`/`buyStoneFromAldric` + fila de stone
en el panel de Aldric. tsc debe pasar. (Verificación headless omitida por saturación del entorno;
la integración espeja el sistema de árboles ya probado.)
**Qué se hizo:** `ROCKS`+colliders en `map.ts`; `minedRocks`/minería/`MARKET.stone` en `world.ts`;
`Rocks` + colisión + detección + loop + hints en `Scene3D.tsx`; comercio de stone en
`client-page.tsx`. `npx tsc --noEmit` limpio. **Commit:** db60162

### 25 jun 2026 · Prompt 20 — Minería verificable en 0G Compute (gateado OFF)
**Pedido (humano):** Implementar la idea: que minar dispare **trabajo real en 0G Compute**
(proof-of-useful-work). Decisiones: construir ahora detrás de flag + fallback; disparar al
agotar una roca.
**Prompt sintetizado:** Investiga el SDK real de 0G Compute (`@0gfoundation/0g-compute-ts-sdk`,
`createZGComputeNetworkBroker`; es **inferencia LLM verificable** por TEE, no PoW). Crea
`/api/mine` (runtime nodejs, import dinámico del SDK): con el sponsor wallet hace `listService` →
`getServiceMetadata`/`getRequestHeaders` → POST `/chat/completions` → **`processResponse`** (verifica
TEE) y devuelve `{ verified, chatID, provider, model }`; rate-limit fuerte; gateado por
`ENGRAM_COMPUTE` (default OFF) con fallback `{verified:false}`. Script admin `scripts/fund-compute.ts`
(`npm run fund:compute`: `addLedger`/`depositFund` + `transferFund` a un proveedor). En `Scene3D`,
al agotar una roca y si `NEXT_PUBLIC_ENGRAM_COMPUTE`, llama `/api/mine` y muestra una píldora HUD
con el recibo ("verifying" → "verified on 0G Compute · chatID" o "mined locally"). Honestidad:
solo dice "verified" si `processResponse` es true; **no verificado end-to-end** (sin cuenta
fondeada al escribir) → flag OFF, juego idéntico. `.env.example` documentado. tsc y `next build`
deben pasar.
**Qué se hizo:** dep `@0gfoundation/0g-compute-ts-sdk`; `/api/mine` con broker + verificación TEE +
fallback; `scripts/fund-compute.ts` + npm script `fund:compute`; cableado + píldora HUD en
`Scene3D.tsx`; flags y notas en `.env.example`; estado actualizado en `ENGRAM_PROMPTS.md` (🟡
construido, gateado OFF, sin verificar en vivo). `npx tsc --noEmit` y `next build` limpios.
**Commit:** _(este commit)_

### 26 jun 2026 · Relaciones entre players MVP (Prompt 13)
**Pedido (humano):** Aclarar si las tareas #13–#19 son lo mismo y arrancar con #13:
relaciones entre players (aliado/enemigo) sobre el mundo persistente.
**Prompt sintetizado:** Implementa una primera versión no destructiva de Prompt 13. Añade
`WalletRelation = neutral | allied | hostile` y `WorldState.relations` normalizado en
`world.ts`; expón `setWalletRelation` y guarda esas relaciones en el mismo bundle del mundo,
por lo que se publican a 0G con **Save World**. Extiende `public-world` con una lista de owners
descubiertos por sus builds. En vista aérea, muestra un panel de wallets públicas con botones
Neutral/Ally/Hostile; al cambiar una relación marca el mundo como dirty y reutiliza el flujo de
guardar/descartar existente. Las construcciones públicas reciben un anillo sutil de color según
la relación. No implementar raids todavía; sabotaje/destrucción queda pendiente de reglas de
fairness, durabilidad y posiblemente multiplayer.
**Qué se hizo:** modelo `relations`, normalización/clonado/store action; owners en
`public-world`; panel de relaciones y marcadores 3D en `Scene3D`; docs de `ENGRAM_PROMPTS.md`
y `STATUS.md` actualizados. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 26 jun 2026 · Repair kits + durabilidad MVP (Prompts 14/18)
**Pedido (humano):** Continuar el MVP con el siguiente loop básico: repair/durability v1 +
repair kit, conectando relaciones, mercado y mundo persistente sin implementar raids todavía.
**Prompt sintetizado:** Aprovecha que `Building` ya tiene `hp/maxHp` y que los enemigos ya
pueden dañar edificios. Añade `WorldState.repairKits` normalizado/persistido, constantes
`REPAIR_KIT_COST`/`REPAIR_KIT_HEAL`, acción `addRepairKits` y `repairBuilding(index)`.
En Aldric, añade compra de repair kit por coin y registra la compra en su memoria. En vista
aérea, muestra kits en el HUD, añade herramienta **Repair**, y permite reparar edificios propios
dañados con un kit; marca el mundo como dirty para guardarlo con **Save World**. Añade feedback
visual de daño en edificios (`hp/maxHp` → material más oscuro + anillo naranja/rojo). No tocar
raids/sabotaje todavía.
**Qué se hizo:** `repairKits` persistido en `WorldState`; kit de reparación comprado a Aldric
como coin sink; herramienta Repair en aerial; visual de daño en builds; docs de prompts/status
actualizados. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 26 jun 2026 · Durability hardening: HP bars, wood repair, wallet-world render fix
**Pedido (humano):** Al conectar wallet la escena quedaba gris/oscura, pero en guest no; empezó
con el trabajo de HP de edificios. Quitar soluciones no relacionadas, explicar en prompts lo
hecho, quitar el tag `TEST DAY`, mostrar HP de edificios con barras, y hacer que reparar cueste
madera también.
**Prompt sintetizado:** Vuelve al origen del bug en vez de tocar el renderer/cielo: el fallo solo
aparece con wallet conectada, por tanto revisar el path de `world.buildings`/`publicWorld.buildings`
cargado desde 0G. Elimina debug UI/renderer (`TEST DAY`) y cualquier `<Html>` permanente asociado a
HP que pueda crear capas DOM sobre el canvas. Sanitiza edificios persistidos descargados de 0G
(`x/z` finitos y dentro de bounds, `scale/y/hp/maxHp` clampados) para que una wallet pública no pueda
dibujar geometría gigante sobre la cámara. Mantén la durabilidad con marcadores puros de Three.js:
anillo de daño + barra de HP billboard sobre edificios dañados. Cambia reparación a coste de madera
(`REPAIR_WOOD_COST`) y deja repair kits como boost opcional de esa reparación, no como requisito.
Actualiza tooltips/feedback y verifica con `npx tsc --noEmit`.
**Qué se hizo:** se eliminó el tag `TEST DAY`; el bug de pantalla gris se corrigió retirando el
badge DOM de HP y los anillos neutrales públicos; `normalizeBuildings` ahora clampa builds cargados
desde bundles 0G; edificios dañados muestran barras HP WebGL; `repairBuilding` cuesta madera y
consume kit solo como boost si existe; copies de Repair/Aldric actualizadas. `npx tsc --noEmit`
limpio. **Commit:** _(este commit)_

### 26 jun 2026 · Task 13b — Raid events sobre edificios públicos
**Pedido (humano):** Pulir Task 13: que la gente pueda dañar edificios de otros jugadores, pero
sin editar directamente el bundle del defensor. Preparar el harness/wrapper para eventos, historia
por edificio, coste en stone, y dejar listo el camino para upgrades de armas; "on-chain como siempre".
**Prompt sintetizado:** Implementa el siguiente incremento de relaciones PvP como **event sourcing**
portable. No permitas que wallet B mute el `WorldState` de wallet A; en su lugar, crea `RaidEvent`s
en el bundle 0G del atacante (`attacker`, `defender`, `buildingId`, `damage`, `stoneCost`,
`weaponLevel`, `at`). Añade IDs estables a `Building` y backfill determinístico para saves antiguos.
La acción de raid solo funciona contra wallets marcadas `hostile`, cuesta stone, respeta cooldown, y
marca el mundo como dirty para que **Save World** suba el bundle a 0G y ancle el nuevo root en
`EngramRegistry`. `public-world` debe escanear bundles, leer eventos salientes y aplicar daño efectivo
al render público del edificio objetivo (`effectiveHP = ownerHP - raidEvents`). En la UI aérea añade
herramienta **Raid** sobre edificios públicos hostiles y feedback claro: evento en cola hasta guardar.
No implementar weapon upgrades todavía, solo dejar `weaponLevel` y `raidDamageForWeapon` preparados.
Verifica con `npx tsc --noEmit`.
**Qué se hizo:** `Building.id` + `RaidEvent` en tipos; `WorldState.raidEvents` normalizado/clonado;
`recordRaidEvent` hostile-only con coste `RAID_STONE_COST`, cooldown y `weaponLevel`; `public-world`
descarga builds + raid events de los bundles 0G y calcula HP público efectivo; herramienta aérea
**Raid** crea eventos locales, muestra daño inmediato y exige **Save World** para publicarlos/on-chain
via root registry. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 27 jun 2026 · R32: descripción del submit + docs + pulido (stone en HUD)
**Pedido (humano):** Clasificamos al Round of 32. Preparar la descripción del submit, actualizar
la documentación, y hacer un pulido de bajo riesgo.
**Prompt sintetizado:** (1) En `STATUS.md`, reemplaza la "Paste-ready dashboard Description" por una
versión R32 que mantiene la copy honesta (sin "your wallet pays", declara el sponsor) y **añade el
mundo vivo nuevo** (regateo, minería de stone, precios dinámicos, raids); marca R32 CLASIFICADO y el
ítem de reenvío como 🔴 con deadline JUN 28. (2) Refleja R32 + descripción lista en la línea ADMIN de
`ENGRAM_PROMPTS.md`. (3) Pulido: el HUD de inventario mostraba Wood/Coin pero **no Stone** (recurso
nuevo invisible al jugar) → añade `StoneIcon` y el contador `stone/MAX_STONE` entre Wood y Coin en
`Scene3D.tsx`. tsc debe pasar.
**Qué se hizo:** descripción R32 + progreso del torneo en `STATUS.md`; ADMIN actualizado en
`ENGRAM_PROMPTS.md`; `StoneIcon` + contador de stone en el HUD de `Scene3D.tsx`. `npx tsc --noEmit`
limpio. **Commit:** _(este commit)_

### 27 jun 2026 · Guion de demo R32 (voiceover)
**Pedido (humano):** Dame el guion del video y documéntalo; lo paso por ElevenLabs.
**Prompt sintetizado:** Extiende `docs/DEMO_SCRIPT.md` (sin pisar el guion base de la tesis de
memoria) con una sección "R32 cut": shot list + voiceover continuo (~90s) que entreteje las
features nuevas (regateo, minar stone, mercado dinámico, build con IA, raids) alrededor del beat
headline reload→recuerda. Reglas anti-DQ: no decir "your wallet pays", **no** mostrar/afirmar
minería en 0G Compute (gateada/sin verificar), y mostrar raids solo porque el build los hace.
**Qué se hizo:** sección "R32 cut" en `DEMO_SCRIPT.md` (shot list + VO continuo + notas de
honestidad + pasos de subida del video). **Commit:** _(este commit)_

### 27 jun 2026 · Hardening de 0G Compute (gas legacy + chequeo de saldo)
**Pedido (humano):** Subir las probabilidades de que la minería en 0G Compute funcione al primer
intento cuando se fondee (aunque no se encienda para R32).
**Prompt sintetizado:** 0G Chain no tiene EIP-1559 → pasar `gasPrice` legacy explícito a las tx
on-chain del SDK. En `scripts/fund-compute.ts`: helper `legacyGasPrice` (eth_gasPrice +20%),
pasarlo a `addLedger`/`depositFund`/`transferFund`, e imprimir el saldo de la wallet con aviso si
es bajo. En `/api/mine`: mismo helper, pasarlo a `acknowledgeProviderSigner` (la tx on-chain del
flujo). Evitar literales BigInt (`10n`) por el target del tsconfig. tsc debe pasar.
**Qué se hizo:** `legacyGasPrice` + chequeo de saldo en `fund-compute.ts`; gas legacy en
`acknowledgeProviderSigner` en `/api/mine`. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Afinar arma FP: aparece solo al golpear + lanza en combate (sobre Prompt 16)
**Pedido (humano):** Afinar la animación de hachazos/golpes de Henrique; que la herramienta
aparezca **solo cuando se la llama** (al talar/atacar), no sostenida todo el tiempo.
**Prompt sintetizado:** Reescribe `ChopArm` en `Scene3D.tsx` (sin tocar las partículas/feedback de
Henrique): (1) ocultar el arma en idle y mostrarla solo mientras `chopArmSwing.phase > 0.02`, con
un escalado `sin(phase·π)` para que crezca/desaparezca suave (no "pop"). (2) Dos armas distintas
según la acción: **hacha** (golpe vertical) para talar/minar y **lanza** (estocada hacia adelante)
para combate, alternando la visibilidad de sub-grupos `axeRef`/`spearRef` por `chopArmSwing.type`.
El disparo del swing ya ocurre en cada golpe del hold (tala) y por ataque (combate). tsc debe pasar.
**Qué se hizo:** `ChopArm` reescrito con gating de visibilidad + escalado suave + geometría de lanza
para combate; hacha para gather. `npx tsc --noEmit` limpio. (FX view-space; verificación visual en
navegador pendiente del usuario.) **Commit:** _(este commit)_

### 28 jun 2026 · Sonido de minar propio + lanza más visible + hacha mejorada
**Pedido (humano):** Que minar tenga un sonido distinto al hacha; revisar que la lanza no se
pierda de vista en el thrust; mejorar el diseño del hacha. (Audio de grillos/fuego: por diseño —
grillos night-only, fuego posicional cerca de la fogata; falta el asset day-ambience.)
**Prompt sintetizado:** (1) Manifest: nuevo cue `mine_hit` (`/audio/foley/mine-hit.mp3`, fallback
silencioso). En el chop loop, al minar (`!canChop`) reproducir `mine_hit` en vez de `axe_chop`.
(2) `ChopArm`: acortar el thrust de la lanza y subirla un poco para que quede en el centro-bajo
visible todo el golpe. (3) Rediseñar el hacha: haft con grip de cuero + pomo, cabeza de acero con
contrahoja (poll) y filo brillante. tsc debe pasar.
**Qué se hizo:** cue `mine_hit` en el manifest + wiring; lanza reposicionada; hacha con grip/pomo/
poll/filo en `Scene3D.tsx`. `npx tsc --noEmit` limpio. **Falta asset:** `public/audio/foley/mine-hit.mp3`
(hasta entonces minar es silencioso). **Commit:** _(este commit)_

### 28 jun 2026 · Minería de oro y plata (vetas por roca)
**Pedido (humano):** Meter oro y plata a la minería (vetas más raras), comerciables con Aldric.
**Prompt sintetizado:** Añade `silver`/`gold` como `ResourceType` + `OreType` (types.ts). En map.ts,
`RockDef.ore` con distribución ~68% piedra / 22% plata / 10% oro (22 rocas). En world.ts: inventario
+ `ORE_MAX` (stone 60/silver 40/gold 24), `MARKET` (silver 12/26, gold 30/66 con spread),
`oreIsFull(ore)` y `harvestRock(index, ore)` genéricos. En Scene3D: `Rocks` tinta cada veta por
mineral (color por instancia + metalness), minar otorga el mineral de la roca, HUD muestra
plata/oro (al tener >0) y los hints dicen el mineral. En client-page: `sellOreToAldric`/
`buyOreFromAldric` genéricos + filas de mercado por mineral (plata/oro aparecen al tener o poder
comprar). tsc debe pasar.
**Qué se hizo:** recursos+ore en types/world/map; render tintado + minado por mineral + HUD en
Scene3D; mercado genérico de minerales en client-page. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Prompt 18 completo: mantenimiento público, aliados y logs
**Pedido (humano):** Hacer más profundo y completar Prompt 18, no dejarlo solo en HP local.
**Prompt sintetizado:** Convertir reparación/durabilidad en un loop público auditable: añadir
`RepairEvent` al `WorldState`, normalizarlo/persistirlo en el bundle 0G, aplicar HP efectivo como
`baseHP - RaidEvent + RepairEvent`, permitir que aliados reparen edificios públicos gastando madera
y repair kits, y mostrar un log compacto de raids/repairs en la vista aérea. Mantener el patrón
actual: quien actúa escribe en su bundle, lo sube a 0G y el registry on-chain hace descubrible el
root; no mutar directamente el bundle de otra wallet.
**Qué se hizo:** `RepairEvent` añadido a tipos/world; `recordRepairEvent` gasta madera/kit y cola
evento; `public-world` agrega raids+repairs desde bundles y calcula HP efectivo; la herramienta
Repair ahora repara edificios propios con daño entrante y edificios públicos aliados; el panel de
wallets muestra un maintenance log. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Sonido de pasos en el agua + Prompt 21 (mapa por parcelas en 0G)
**Pedido (humano):** Sonido al caminar por el agua; documentar la idea de "mapa que crece" pagando
parcelas en 0G con renta tipo Monopoly.
**Prompt sintetizado:** (1) Manifest: cue `footstep_water` (fallback silencioso, asset pendiente).
En Scene3D, `isOverWater(x,z)` (medio-ancho del ribbon = `2.5+sin(x·0.17)·0.85`); `onFootstep`
elige `footstep_water` vs `footstep_grass` por la posición del jugador. (2) Documenta Prompt 21 en
`ENGRAM_PROMPTS.md`: parcelas de tierra propiedad del jugador en 0G, render data-driven (sin
redeploy), renta/comisión; dueño martelaxe.
**Qué se hizo:** cue + `isOverWater` + wiring en Scene3D; Prompt 21 (índice + sección). `npx tsc
--noEmit` limpio. **Falta asset:** `public/audio/foley/footstep-water.mp3`. **Commit:** _(este commit)_

### 28 jun 2026 · Prompt 16 — feedback físico de minería + pickup flotante "+N"
**Pedido (humano):** Hagamos el Prompt 16 (animaciones de gathering/feedback). Tala y combate ya
tenían FX; faltaba la minería y un feedback claro de recolección.
**Prompt sintetizado:** En `Scene3D.tsx`, cerrar los huecos del Prompt 16. (1) Minería: añadir
`rockShake` (jitter por roca que decae en `Rocks` vía useFrame) y `mineDebrisQueue` consumido por
un nuevo emisor `MineDebris` (chispas/escombro tintados por mena: gris stone, brillo silver/gold).
Disparar ambos en cada golpe de pico dentro del loop de hold-F (rama `else if (rock !== null)`).
(2) Recolección: pop flotante "+1 <recurso>" en el HUD por cada unidad obtenida (madera/stone/
silver/gold), con color por recurso y animación CSS `engram-pickup` (rise+fade) en `globals.css`.
Sin deps nuevas, `npx tsc --noEmit` limpio, sin tocar combate/persistencia.
**Qué se hizo:** `rockShake`/`mineDebrisQueue` module-level; useFrame de shake en `Rocks`;
componente `MineDebris` montado junto a WoodChips/HitDust; FX de pico cableado en el loop; estado
`pickups`+`showPickup` y overlay HUD; keyframes `engram-pickup`. Prompt 16 pasa a 🟢. `npx tsc
--noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Onboarding de la tesis (cartel de entrada + banner "recalls from 0G")
**Pedido (humano):** Hacer legible en los primeros ~15-30s la tesis (memoria propiedad del jugador
en 0G), tono ~65% técnico / 35% inmersivo.
**Prompt sintetizado:** En `client-page.tsx`, sin tocar el core: (1) Cartel de entrada de una sola
vez (gate `localStorage engram:onboarded:v1`, set en effect para evitar hydration mismatch) que
explica que la memoria de cada aldeano vive como bundle JSON en **0G Storage**, apuntado por la
wallet vía registry on-chain, inmutable; botón "Enter Aldenmoor". (2) Banner contextual en la caja
de diálogo: "📜 {NPC} recalls N past conversations · loaded from 0G · <root>…", solo cuando ese NPC
tiene `interaction_history.length > 0` y existe `getBundleRoot(wallet)` (honesto: no aparece en
wallets nuevas/invitados). `npx tsc --noEmit` limpio.
**Qué se hizo:** estado `showIntro`/`dismissIntro` + overlay del cartel; banner de recall inline en
el diálogo; keyframes no requeridos. Tono 65/35 técnico/inmersivo. **Commit:** _(este commit)_

### 28 jun 2026 · Prompt 21 v0 jugable: parcelas data-driven + renta
**Pedido (humano):** Trabajar Task/Prompt 21.
**Prompt sintetizado:** Hacer una primera versión real y probabe del "mapa que crece" sin esperar
un contrato nuevo: guardar `ParcelClaim` y `ParcelRentEvent` en el `WorldState`, publicarlos en el
mismo bundle 0G, descubrirlos con el registry root existente, renderizar overlays de parcelas en
runtime y cobrar coin cuando alguien construye sobre tierra ajena. Documentar que el
`ParcelRegistry` dedicado sigue como hardening futuro.
**Qué se hizo:** tipos de parcela/renta; normalización/clonado en `world`; herramienta **Claim
land** en vista aérea; overlays WebGL para parcelas propias/públicas; `public-world` agrega
parcelas/rentas desde bundles; construir en tierra ajena registra renta y gasta coin; panel de
wallets muestra land count y rent log. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Prompt 21 completo: ParcelRegistry + renta cobrable + comisión
**Pedido (humano):** Hacer las partes que faltaban de Task 21.
**Prompt sintetizado:** Completar la versión fuerte de parcelas: contrato `ParcelRegistry`, script
de deploy, ABI mínimo y cliente opcional/por defecto; descubrimiento público por eventos
`ParcelClaimed`, renta cobrable por el dueño, comisión al recolectar en parcela ajena, recursos
visuales data-driven por terreno y documentación actualizada. Mantener el bundle 0G como estado
rico de parcela y el contrato como propiedad/anti-double-claim.
**Qué se hizo:** `contracts/ParcelRegistry.sol`, `scripts/deploy-parcel-registry.ts`,
`src/lib/registry/parcel-abi.ts` y `parcels.ts`; deploy Galileo en
`0x11D2EB42d0BF30947EB36882A150ee25518f67d7`; claims ahora intentan tx on-chain antes de commitear
local; `public-world` escanea `ParcelClaimed`; `parcelRentCollected` + botón Collect rent; comisión
de gathering; overlays con recursos por `meadow/grove/quarry`; env/docs/status actualizados.
`npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Assets de audio (mine-hit, footstep-water, day-ambience) + créditos
**Pedido (humano):** Agregar los mp3 de mine-hit y footstep-water; bajar el day-ambience "a la
mitad" (bed relajante de fondo); documentar créditos Pixabay.
**Prompt sintetizado:** Colocar `public/audio/foley/mine-hit.mp3` y `footstep-water.mp3` (rutas que
ya apunta el manifest) y `public/audio/ambient/day-ambience-loop.mp3`. Reducir el volumen del cue
`day_ambience` a la mitad (0.22→0.11) en `src/lib/audio/manifest.ts`, sin reencodear. Añadir sección
Credits/Licenses en `docs/AUDIO_ASSETS.md` con la nota de Pixabay Content License (atribución no
obligatoria) y la URL de origen del day-ambience.
**Qué se hizo:** 3 mp3 añadidos; `day_ambience.volume` 0.22→0.11; doc de assets actualizado (cues
nuevos + tabla de créditos). `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Pulido de HUD/animación (pica, swing más lento, panel wallets, cartel modal)
**Pedido (humano):** Varias correcciones de UI tras probar en local: el "Repair 0" ensucia el HUD;
el cartel de inicio deja asomar los nombres flotantes de los NPCs; la animación de herramienta se
volvió muy rápida y no concuerda con el sonido (y querer hacha para madera + pica para piedra/oro/
plata); el panel "Nearby wallets" estorba arriba-izquierda y no se puede cerrar sin elegir relación.
**Prompt sintetizado:** En `Scene3D.tsx`/`client-page.tsx`: (1) ocultar el contador de repair kits
cuando es 0 (patrón de silver/gold). (2) `uiOpen = panelOpen || showIntro` para que el modal de
onboarding congele el mundo y oculte los nametags drei `<Html>` (z-index altísimo). (3) `ChopArm`:
nuevo tipo `mine` con modelo de pica (twin-pointed), hacha solo para `chop`; bajar el decay del
swing (dt*3.0→dt*1.85, ~0.55s) para que cuadre con el sonido (~0.6s); el loop de hold-F elige
`chop` vs `mine` según árbol/roca. (4) `PublicRelationsPanel`: mover a inferior-izquierda
(`bottom-16`), colapsable con ✕ → chip "👥 N nearby" para reabrir, sin obligar a elegir relación.
**Qué se hizo:** los 4 cambios + modelo de pica en el view-space arm. `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 28 jun 2026 · #6 Declutter de la barra aérea (Build dropdown + acciones contextuales)
**Pedido (humano):** La barra aérea se ensucia con tantas herramientas; fundir Wall/House (y AI) en
un "Build" con dropdown; que Repair/Demolish/Raid no estén siempre fijos (Raid solo vs hostil).
**Prompt sintetizado:** En `Scene3D.tsx` (vista aérea): (1) fundir Wall/House/Build-with-AI en un
único botón **🏗️ Build** con dropdown (estado `buildMenuOpen`), resaltado verde si hay un modo de
construcción activo. (2) Mantener **Claim land** como primario. (3) Gatear Repair/Demolish/Raid por
contexto: Repair si tienes edificios propios o un público aliado; Demolish si tienes edificios;
**Raid solo si hay un edificio público hostil descubierto**; damage-test solo en localhostGod. No
se toca el modelo de clic (tool→tap) ni la lógica de raid/repair existente — solo qué botones se
muestran. `npx tsc --noEmit` limpio.
**Qué se hizo:** dropdown Build + Claim land + cluster contextual; `buildMenuOpen` state. **Nota:**
el modelo "click-en-edificio → menú contextual" pleno y un 3er tipo de edificio quedan como
iteración siguiente (tocan henrique/tipos/colliders). **Commit:** _(este commit)_

### 28 jun 2026 · Subir luminosidad de producción (path cinematic) sin perder el sol
**Pedido (humano):** En local todo se ve más luminoso (mejor) y en prod más apagado; en prod sí se
ve la trayectoria del sol y en local no. Dejar prod "luminoso como local" pero conservando el sol.
**Diagnóstico:** `forceBrightTestLighting` está ON en local/LAN/dev (`NODE_ENV!=='production'`):
fuerza hora=12 + luces blancas planas + exposición 2.2, sin sombras/fog/Sky. Prod usa el path
cinematic con la hora real → de tarde se ve apagado pero con el sol bajo visible. No es bug de
texturas; es la iluminación.
**Prompt sintetizado:** Subir moderadamente el path cinematic (solo prod) manteniendo Sky/sol/
sombras: en `computeDayNight` elevar el piso `visible` 0.42→0.52 y las intensidades ambient
mix(1.18,1.72)→(1.45,1.95), hemi (1.22,1.56)→(1.45,1.82), dir (0.45,2.05)→(0.75,2.2); exposición
cinematic 1.6→1.9. Previsualizable en local con `?night=1`. `npx tsc --noEmit` limpio.
**Qué se hizo:** los 5 ajustes de luz. ~+25% de luminosidad, noche más legible, sol/arco intactos.
**Commit:** _(este commit)_

### 28 jun 2026 · Pulido: swing sincronizado, pica real, prod luminoso+sol, chispas visibles, Prompt 22
**Pedido (humano):** (1) el swing del hacha se ve como bucle rápido — que sea UNA animación por
sonido; (2) bajar más el volumen del día; (3) la pica parece hacha — estilizarla como pica real
(espiga curva, animación arriba-abajo); (4) prod apaga mucho los colores — preferir el look de
local pero con sol visible; (5) en prod no se ven las chispas de minar/talar; (6) versionar el
Prompt 22 (frontera expandible).
**Prompt sintetizado:** En `Scene3D.tsx`/manifest/docs: (1) `SWING_MS` 620→720 y decay del swing
1.85→1.4 para que 1 swing = 1 sonido. (2) `day_ambience.volume` 0.11→0.06. (3) Nuevo modelo de
pica (espiga larga curva forward-down + poll trasero) y rama `mine` del swing más centrada y con
más pitch (vertical). (4) El modo luminoso pasa a default en todas partes (gate `?night`/`?shot`
como opt-out) y se le añade un `<Sky>` con sol bajo fijo + luz direccional alineada → prod se ve
como local pero con sol. (5) Subir color/tamaño de `MineDebris`/`WoodChips` para que las chispas
se lean en cualquier luz. (6) Sección Prompt 22 en `ENGRAM_PROMPTS.md`. `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 28 jun 2026 · Prompt 22 — frontera expandible casilla a casilla
**Pedido (humano):** Continuar la tarea de Prompt 22: que el mapa crezca por parcelas adyacentes,
no por un radio fijo.
**Prompt sintetizado:** Implementar Fase 1-4 como hito seguro: modelo puro de frontera
(`parcelIsClaimable`, `frontierClaimableCells`, `worldExtentForClaims`, `cellLabel`), claims solo
adyacentes a la frontera base o a parcelas existentes, movimiento/building dentro de
`WORLD_RADIUS ∪ claimedCells`, tiles de suelo data-driven para claims fuera del mapa base, props y
colliders por terreno, y fantasmas azules de las casillas reclamables en modo Claim. Dejar
`/api/parcel-save` + `ParcelRegistry.updateData(dataRoot)` como siguiente fase.
**Qué se hizo:** `world.ts` reemplaza el tope radial de claim por adyacencia; `Scene3D` permite
caminar/construir en celdas reclamadas públicas/propias, renderiza tiles exteriores con recursos y
colliders, muestra etiquetas de celda y fantasmas clickables; `public-world` expone snapshot para
colisión; docs/status actualizados. `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Bugs de playtest: W trabada, dirección de gathering, HP bars en FP, rumbo aerial→FP
**Pedido (humano):** (A) si se pierde el foco (popup de MetaMask) la W se queda apretada y no se
destraba; (B) con árbol y roca cercanos, talar/minar se confunden — debería decidirlo la dirección
en que mira el jugador; (C) las barras de HP/stats del edificio se ven en 1ª persona (no deberían);
(D) al volver de aéreo a 1ª persona, la cámara debe conservar el rumbo del avatar.
**Prompt sintetizado (Scene3D.tsx):** (A) en `blur`/`visibilitychange→hidden`, sintetizar `keyup`
de todas las teclas del `keyboardMap` para que drei suelte el movimiento. (B) el target de gathering
se elige por mayor alineación `dot(forward, dirAlRecurso)` dentro de un cono (~140°) entre árboles y
rocas en rango; solo el mejor-mirado queda activo (el otro null), así talar vs minar lo decide la
mirada. (C) señal módulo-level `viewSignal.aerial`; `BuildingHpBar` se oculta (`visible=false`) en
1ª persona. (D) al re-enganchar FP, si no es la primera vez, `camera.lookAt` hacia
`posRef.heading` (rumbo del avatar en aéreo). `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 28 jun 2026 · Prompt 22 completo — dataRoot de parcela en 0G + ParcelRegistry
**Pedido (humano):** Terminar Prompt 22 para que la parcela no dependa solo del bundle general
del dueño.
**Prompt sintetizado:** Añadir bundle dedicado por parcela en 0G, anclar su `dataRoot` en
`ParcelRegistry.claim(...)`, exponer `updateParcelData(...)` para futuras mutaciones y hacer que
el public world hidrate parcelas desde esos roots.
**Qué se hizo:** `/api/parcel-save` serializa `engram-parcel` y lo sube a 0G con sponsor key;
la acción **Claim land** ahora sube la parcela antes de la tx y pasa el `dataRoot` al registry;
`ParcelClaim` persiste `dataRoot/dataTxHash`; `public-world` escanea `ParcelClaimed` y
`ParcelDataUpdated`, descarga el bundle de parcela por root y lo mezcla con bundles de wallet.
Los recursos generados por parcela pasan de props visuales a nodos recolectables: click para
sumar wood/stone, persistencia por `depletedParcelResources` y comisión si el recurso está en
tierra ajena.

### 28 jun 2026 · Fix regresiones: hold-F estable (anim+sonido), noche restaurada, chispas
**Pedido (humano):** (1) la animación de hacha/pica vibra como colibrí (antes se veía 1 swing por
sonido); (2) al MANTENER F no suena el mp3, solo al hacer taps; (3) son las 20h y se ve día — debería
ser noche con grillos; (4) se perdieron otra vez las chispas de hachazo/tala (sospecha: iluminación).
**Diagnóstico:** mi selección por "facing" ponía el recurso en null cuando no lo mirabas exacto →
el loop reseteaba `sinceSwing` y re-golpeaba en ráfaga (vibra). Como `play()` hace `currentTime=0`
en cada llamada, la ráfaga reiniciaba el clip antes de sonar (silencio al mantener; los taps espaciados
sí suenan). Y el "modo luminoso 24/7" que metí tapaba la noche/grillos y lavaba las chispas.
**Prompt sintetizado (Scene3D.tsx):** (1/2) Reescribir el scan de gathering: un recurso solo en
rango SIEMPRE se selecciona (sin exigir facing → target estable, cadencia 720ms firme); el facing
solo desempata árbol-vs-roca cuando ambos están en rango. (3) `forceBrightTestLighting` vuelve a
default cinematic día/noche en todas partes (solo `?day=1` fuerza el plano brillante; `?shot` intacto),
conservando el +25% de brillo y el sol diurno → 20h = noche + grillos. (4) se resuelve solo con la
noche cinematic (contraste); partículas ya venían con tamaño/color subidos. `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 28 jun 2026 · CAUSA REAL de la vibración + colisión de edificios públicos + panel replegado
**Pedido (humano):** la anim de hacha/pica SIGUE vibrando como colibrí tras redeploy; además solo
se ve/talas desde cierto ángulo (debería desde cualquiera); muros y casas se atraviesan; el panel
"Nearby wallets" debería estar replegado por defecto.
**Diagnóstico (el bueno):** el `useEffect` del loop de gathering tenía `publicWorld.parcels` +
callbacks no memoizados en sus deps → se **recreaba en cada render** (y `setChopPct` re-renderiza
cada 80ms), reseteando `sinceSwing` y disparando golpes cada ~80-160ms = vibración + `play()`
reiniciando el clip (silencio al mantener). Lo del ángulo era el requisito de "facing" (ya removido
en 34bd79f: un recurso solo siempre se selecciona). La colisión solo cubría `getWorld().buildings`
(propios), no `publicWorld.buildings` (los de otras wallets) → atravesables.
**Prompt sintetizado (Scene3D.tsx):** (1) mover deps inestables del loop a un `chopLoopRef` y dejar
el `useEffect` con deps `[fpExploring]` → intervalo estable, 1 swing/sonido cada 720ms. (2)
`resolveCollision` ahora también colisiona `getPublicWorldSnapshot().buildings` (muros radiales +
casas huecas). (3) `PublicRelationsPanel` arranca replegado (`open=false`). `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Menú contextual de edificio (tarjeta fija) + quitar Repair/Demolish/Raid de la barra
**Pedido (humano):** Quitar Repair/Demolish/Raid del panel derecho; en aéreo, click izquierdo en un
edificio lo selecciona y muestra sus stats + acciones válidas en una tarjeta fija.
**Prompt sintetizado (Scene3D.tsx):** `Buildings` recibe `onSelectBuilding`; el click en edificio
(propio o público) ya no depende de un tool: selecciona y reporta `{scope, index/id, owner, type,
hp, maxHp, relation}` (damage-test localhost sigue como acción). El componente principal guarda
`selectedBuilding` y renderiza una **tarjeta fija** (abajo-derecha, aéreo) con tipo, dueño/relación,
barra de HP y solo las acciones válidas: **Repair** (dañado y propio/aliado), **Demolish** (propio),
**Raid** (público hostil), reusando `repairBuilding`/`removeBuilding`/`recordRepairEvent`/
`recordRaidEvent`. Se quitan los botones fijos Repair/Demolish/Raid de la barra (queda Build ▾,
Claim land, Save World, y Damage-test solo en localhost). Selección se limpia al salir de aéreo.
`npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Pulido playtest: sparks sin cull, edificio seleccionado resaltado, labels ortho, attack hit, known issues
**Pedido (humano):** resaltar el edificio seleccionado en aéreo (color por relación); chispas solo
se ven en cierto ángulo; texto gigante "G1H17" al reclamar parcela; círculos múltiples bajo la
antorcha; sonido de impacto de ataque; iniciar un log de problemas conocidos.
**Prompt sintetizado:** (#2) `frustumCulled={false}` en los 3 `<points>` (el objeto se cull-eaba por
bounding sphere en el origen) → chispas visibles desde cualquier ángulo. (a) `SelectionRing`
pulsante bajo el edificio seleccionado, color por relación (dorado propio / verde-rojo-gris). (gama)
quitar `distanceFactor` de las etiquetas `<Html>` de parcela (gigantes bajo cámara ortográfica).
(c) ocultar el anillo de daño en piezas `block` (la antorcha apilaba círculos). (#5) cue `attack_hit`
(`/audio/sfx/attack-hit.mp3`) al conectar un golpe. (+) `docs/KNOWN_ISSUES.md`. `npx tsc --noEmit`
limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Pulido: deselect en vacío, audio hurt/death variado, build más caro, pinch móvil
**Pedido (humano):** (1) click izquierdo en vacío deselecciona el edificio; (3) cablear hurt con 5
variantes + player-mort al morir (los sfx viejos no servían); (2) subir costo de muro/casa; (beta)
pinch-zoom en aéreo móvil.
**Prompt sintetizado:** (1) `onPointerMissed` del Canvas → `setSelectedBuilding(null)`. (3) cues
`player_hurt` (array de player-hurt-1..5, rota por variedad) y `player_death` (player-mort.mp3);
en el sync de HP, comparar con `prevHpRef` → hurt al bajar HP, death al llegar a 0. (2) `BUILD_COST`
wall 3→6, house 10→24 (block 1). (beta) en el efecto de zoom aéreo, listeners `touchmove`/`touchend`
de dos dedos: delta de distancia → `zoom.current` (separar=zoom in, juntar=zoom out). `npx tsc
--noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Block 0.4 madera + persistencia "preferir el más nuevo" (sin popups)
**Pedido (humano):** los blocks son pequeñitos → deberían costar ~0.4 (incluso 0.2/0.1 si fueran más
chicos); y los recursos no se guardan (pero autosave a 0G cada 10s = popup de wallet molesto, y
autosave al cerrar = riesgo de limbo si se apaga la PC).
**Prompt sintetizado:** (block) `BUILD_COST.block` 1→0.4; `buildCostAt` devuelve plano para block
(sin mult de distancia ni redondeo a 0); HUD de madera redondeado a 1 decimal. (persistencia) sin
autosave ni firmas extra: añadir `savedAt` a `WorldState`, estamparlo en `commit` (cada mutación),
preservarlo en `normalizeWorldState`; en `createBundleWorldPersistence.load` elegir el **más
reciente** entre el borrador local y el bundle 0G → el gathering no guardado no se pisa con un 0G
viejo, y un 0G más nuevo (otro device) gana en navegador limpio. Save World sigue siendo el anclaje
on-chain explícito (1 popup intencional). `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Prompt 23 doc + Fase 1 (precios de mena dinámicos por escasez)
**Pedido (humano):** documentar Prompt 23 (economía respaldada en 0G), arrancar Fase 1, y dejar
encaminado el Prompt 8 (IA de naturaleza).
**Prompt sintetizado:** Documentar Prompt 23 (modelo banco/usuarios, conservación, precios por
escasez×inflación viviendo en 0G, fases incl. IA de naturaleza = Prompt 8c y respaldo OG real
post-torneo). Fase 1 en código: `quoteFromScarcity(base, fracciónRestante, coin)` en `world.ts`
(generaliza `woodQuote`) + `oreQuote(world, ore, total, mined)`; client-page calcula totales/minados
por mena desde `ROCKS`/`world.minedRocks` y el mercado de Aldric usa precios **dinámicos** de
stone/silver/gold (suben con la escasez del mundo). `npx tsc --noEmit` limpio. **Pendiente:**
tesorería explícita en 0G (F2), IA de naturaleza (F3/Prompt 8c), minar-cuesta-tokens (F4).
**Commit:** _(este commit)_

### 29 jun 2026 · Prompt 15: asedios demoníacos con fairness offline
**Pedido (humano):** implementar Prompt 15 para que los demonios puedan atacar edificios sin que
el jugador pierda una aldea entera por daño explosivo u offline.
**Prompt sintetizado:** Añadir `DemonSiegeEvent` a `WorldState` y persistirlo en el bundle 0G;
reemplazar el daño bruto de enemigos contra edificios por `recordDemonSiegeHit(...)`, con wind-up,
daño bajo, cooldown por edificio, fase segura al inicio de cada ventana y cap total por wallet/ventana.
El golpe baja HP del edificio propio y registra el evento para auditoría; no hay catch-up de daño
offline. `public-world` descubre `siegeEvents` y el maintenance log muestra asedios junto a raids,
repairs y rentas. Verificado con `npx tsc --noEmit`.
**Commit:** _(este commit)_

### 29 jun 2026 · Micrófono + voz de NPC (Azure Speech) con token efímero
**Pedido (humano):** poder "hablar" con los NPCs: botón de grabar → transcribe (con límite) → llena
el input para confirmar/editar antes de enviar; y voz opcional para los NPCs.
**Prompt sintetizado:** key de Azure solo en server. `GET /api/speech-token` cambia
`AZURE_SPEECH_KEY`/`REGION` por un token efímero (~10min). `src/lib/speech.ts` (Speech SDK vía
token): `transcribeOnce()` (mic, auto es-MX/en-US, tope 60 palabras), `speakText(text, npc)` (voz
neural distinta por NPC), `isSpeechAvailable()`. En `client-page`: botón 🎤 (dicta al input, no
auto-envía) + toggle 🔊 (voz del NPC al responder), solo si hay vars. `.env.example` + `tmp/` al
gitignore (repo ajeno de referencia). `npx tsc --noEmit` limpio (solo errores ajenos en tmp/).
**Commit:** _(este commit)_

### 29 jun 2026 · AI clusters (HP híbrido): la IA agrupa bloques en sub-estructuras
**Pedido (humano):** que la IA, al construir, elija qué es cada cúmulo de bloques (palo vs corona de
antorcha, muro de casa); y que HP/selección/repair/demolish operen por cúmulo (híbrido).
**Prompt sintetizado:** (1) `/api/build`: cada bloque lleva `"part"` (etiqueta lowercase del
sub-elemento); el prompt instruye etiquetar todo bloque; `partLabel()` sanea. (2) `Building` gana
`clusterId`/`clusterLabel` (types); al colocar una build AI se asigna `clusterId = ai-<ts>:<part>`
(`aiPieceToBuilding`/`placeAIPreview`), preservado en `normalizeBlockBuilding`. (3) world.ts:
`repairCluster(id)` (cura todos los bloques por 1 costo) y `removeCluster(id)` (demuele todo,
reembolsa ½). (4) Scene3D: click en bloque con `clusterId` selecciona el **cúmulo** (HP agregado),
la tarjeta muestra la etiqueta y repair/demolish actúan por cúmulo; `SelectionRing` en todos los
bloques del cúmulo. `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Prompt 23 F2/F3 — loop economía ↔ ecosistema
**Pedido (humano):** cerrar el loop "el mundo se agota → la IA repone → los precios responden",
extendiendo Prompt 8c/Fase 1 a rocas, tesorería en 0G y cadencia ligada a actividad económica.
**Prompt sintetizado:** Extender, sin rehacer agentes ni pricing Fase 1: (1) añadir
`pickRockToRespawn(minedRocks, earth)` en `ecosystem.ts`, ponderado por zona con
`zoneOfPoint(ROCKS[i].x, ROCKS[i].z)` + `EarthAgentState.zones[].fertility/regrowthShare`; (2)
añadir `EarthAgentState.nextRockAt` y `world.ecosystem.activity` persistido en `WorldState`, con
fórmula auditable `activityScore = clamp01(0.45*coin/200 + 0.35*recentExtraction/6 +
0.20*depletedStock)` y `cadence = base*(1.25 - 0.45*depletedStock)*(1 - 0.45*activityScore)`, para
que más coin/extracción acelere reposición y stock alto la frene; (3) en `client-page.tsx`, añadir
efecto de respawn de rocas que quita índices de `world.minedRocks`, actualiza `nextRockAt` y deja
que `oreQuote` baje precios al volver la oferta; (4) añadir HUD discreto "World Treasury" con stock
restante, precio mid y zona dominante de Tierra; (5) actualizar docs de Prompt 23 F2/F3.
**Qué se hizo:** `ecosystem.ts` comparte el score de Tierra para árboles/rocas y calcula
`ecosystem.activity`; `WorldState` normaliza y clona `nextRockAt`/`activity`; el cliente persiste
cadencias económicas, repone rocas, conserva el regrowth de árboles y muestra la tesorería derivada
del bundle 0G. `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Fixes GUI de diálogo (nombre flotante, scroll) + reasignar voces
**Pedido (humano):** (1) el nombre flotante del NPC pisa el GUI — el GUI debe ir encima; (2) el panel
se corta arriba (hay que poner zoom 80%) — resolver con scroll; (3) voces: Aldric con la de Maren,
Maren con la de Aldric, y Sable como un mago viejo/sabio.
**Prompt sintetizado:** (1) `uiOpen = ... || active !== null` → durante el diálogo se ocultan los
nametags drei `<Html>` (z-index altísimo) y el GUI queda encima. (2) panel de diálogo
`max-h-[calc(100dvh-2rem)] overflow-y-auto` → scroll si es alto, ya no se corta. (3) en `speech.ts`,
`NPC_VOICE` con voz+prosodia por NPC: aldric=en-US-JaneNeural, maren=en-US-DavisNeural,
sable=en-GB-RyanNeural con SSML `rate -14% / pitch -12%` (viejo y sabio); `speakText` pasa a
`speakSsmlAsync` con XML escapado. `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Botón "Leave" (sin guardar) + iluminación híbrida (colores localhost + cielo prod)
**Pedido (humano):** (1) un botón para salir del diálogo SIN guardar (si solo quieres leer al NPC);
(2) que convivan los colores de localhost (vibrantes/planos) con el cielo de prod (sol/día-noche).
**Prompt sintetizado:** (1) `leaveNoSave()` cierra el diálogo, descarta `dirty[npc]` y NO escribe a
0G; botón **Leave** siempre visible, **Leave & save** solo si hay cambios. (2) Mantener el path
cinematic (Sky/sol/día-noche de prod) pero subir y blanquear la luz a niveles "localhost":
`visible` floor 0.52→0.74, ambient mix(1.45,1.95)→(2.1,2.55) y casi-blanco, hemi (1.45,1.82)→
(1.9,2.2), dir (0.75,2.2)→(1.5,2.6); exposición 1.9→2.05; niebla alejada (30,110)→(70,220) para que
los colores cercanos no se apaguen. `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Prompt 23 F4 — minar = pagar a la tesorería (gateado OFF)
**Pedido (humano):** cerrar la tesis "mineral respaldado por valor": minar deja de ser gratis y pasa
a comprar metal a la tesorería del mundo, conservando el coin dentro del bundle 0G y sin tocar F1-F3.
**Prompt sintetizado:** Añadir cobro opcional al punto único de otorgamiento de mena (`harvestRock`),
gateado por `NEXT_PUBLIC_ENGRAM_PAID_MINING` (OFF por defecto). El costo se deriva del `oreQuote`
vigente; como cobrar mid literal haría imposible que el costo sea menor que la reventa (`sell =
mid / spread`), se usa `mid / HOUSE_SPREAD²` capado debajo de `sell`. Si falta coin, no se entrega
mena y el HUD avisa "Need N coin...". Si se paga, el coin pasa a `world.ecosystem.treasury`
(`coin`, `paidMiningRevenue`, `paidMiningCount`, `orePurchased`) y `computeEcosystemActivity` cuenta
`playerCoin + treasuryCoin`, acelerando reposición de Tierra. HUD "World Treasury" muestra el banco.
Documentar flag y honestidad: economía in-game/testnet simulada, no custodia de OG real.
**Qué se hizo:** `WorldTreasuryState` persistido en `EcosystemState`; `harvestRock` soporta cobro
atómico y feedback de saldo; `Scene3D` calcula el ask dinámico desde `oreQuote` y bloquea extracción
solo con el flag ON; `client-page` muestra coin del banco; `.env.example` y Prompt 23 actualizados.
**Commit:** _(este commit)_

### 29 jun 2026 · Review F4 de Codex + fix anti-arbitraje del costo de minado
**Pedido (humano):** revisar el commit 6eb9bd1 (paid mining de Codex), que esté bien y no rompa nada.
**Hallazgo:** tsc limpio, flag OFF por defecto, un solo caller de `harvestRock` (firma retro-
compatible), conservación del coin a la tesorería (`addMiningTreasuryPayment`) — todo bien. **Pero**
`miningCostFromQuote` ponía el costo por debajo de la reventa (`sell-1`), creando un money pump
(minar barato → vender caro drena la tesorería). Codex siguió mi criterio mal redactado ("costo <
reventa"); el correcto es **≥ reventa**.
**Fix:** `miningCostFromQuote` ahora devuelve el **mid** (`max(sell+1, round(mid))`): sobre la
reventa (sin arbitraje) y bajo el precio de compra de Aldric (minar sigue siendo más barato que
comprar). `npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 29 jun 2026 · Facing para gathering + luna (luz alineada + fase real) + snap de muros + créditos audio
**Pedido (humano):** (1) talar/minar (y su hint) solo si el player MIRA al recurso (no de espaldas);
(2) la luz nocturna y la luna están en lados distintos — alinear; + luna por fase lunar real (centro
de México); (3) #4a muros que se toquen (continuos); (4) créditos de los audios Pixabay.
**Prompt sintetizado:** (1) re-añadir gate de facing al scan FP (cono frontal ~155°, `dot(forward,
dir) ≥ 0.2`); ya sin el bug de vibración (el intervalo es estable). (2) `dirPos`/`dirColor` siguen al
SOL de día y a la LUNA de noche (alineados con `moonDiscPos`); `Celestial` (luna) calcula la fase con
`moonPhase(now)` (mes sinódico desde luna nueva conocida) y oculta la parte no iluminada con una
esfera negra desplazada → creciente/gibosa/llena real. (3) en `BuildController`, muros snapean a
grilla de 1.8 (su ancho) + rotación a 90° (`snapXZ`/`placeRot`) en ghost y placement → tile continuo.
(4) tabla de créditos en `AUDIO_ASSETS.md` (attack-hit/swing, player-hurt/mort). `npx tsc --noEmit`
limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Voz de Aldric masculina, nombre/scrollbar del diálogo, glow de átomos, cono 60°
**Pedido (humano):** Aldric con voz de hombre (no mujer); el nombre del NPC se corta en el diálogo;
scrollbar genérico feo → uno temático; átomos de Sable con glow ("magia"); cerrar el cono de
gathering de ~150° a ~60°.
**Prompt sintetizado:** (1) `NPC_VOICE.aldric` → `en-US-DavisNeural` (masculina). (2) Reestructurar
la caja de diálogo: el contenedor `engram-dialogue` ya no scrollea; el body va en un wrapper
`.engram-scroll` con `overflow`, así el tab del nombre (`-top-4`) no se recorta. (3) `.engram-scroll`
en globals.css: scrollbar delgado dorado/oscuro (webkit + firefox). (4) `SableAtoms`: halos
aditivos por electrón + halo de núcleo + `pointLight` morada → glow mágico. (5) `FACING_MIN`
0.2→0.85 (cono ~60° frontal). `npx tsc --noEmit` limpio.
**Commit:** _(este commit)_

### 29 jun 2026 · Fix NPCs miran al jugador al hablar + pulso de atención en el micrófono
**Pedido (humano):** los NPCs te dan la espalda/miran de lado al hablar (regresión); y dejar el audio
on por defecto para que los jueces lo noten y prueben el micrófono.
**Hallazgo/fix:** al estar `active` (en diálogo), el NPC no actualizaba `targetRotY` y caía al branch
"idle" que oscila alrededor de 0 (mirando al norte) → te daba la espalda. Ahora, si `active`, mira al
jugador (`atan2(player - npc)`) y la rotación usa ese target con sway mínimo. Audio: ya estaba
`muted=false` por defecto y arranca al primer gesto (autoplay unlock) — confirmado; añadido un pulso
`.engram-attention` (borde verde latente) al botón 🎤 para invitar a los jueces a probar la voz.
`npx tsc --noEmit` limpio. **Commit:** _(este commit)_

### 2026-06-29 · El audio arranca silenciado entre sesiones
**Pedido (humano):** al cargar la página e ir a hablar con un NPC, la bocina sale apagada
aunque la sesión anterior la dejé prendida; los jueces se perderían valor si no lo notan.
**Prompt sintetizado:** El estado de mute se persiste en `localStorage` (`engram:audioMuted`)
y se rehidrata al montar `AudioProvider`, así que una sesión que alguna vez quedó silenciada
arranca muda para siempre — fatal para una demo de jueces. Quita la rehidratación al cargar:
cada carga de página debe empezar con el sonido ENCENDIDO (`muted=false`), conservando el
toggle dentro de la sesión. No persistas mute entre reloads.
**Qué se hizo:** removí el `useEffect` que rehidrataba `readStoredMute()` en
`src/context/AudioContext.tsx`; el default `false` ahora gana en cada carga. `tsc` limpio.
**Commit:** _(este commit)_

### 2026-06-29 · Voz NPC por defecto, stop manual del mic, y un solo botón Leave
**Pedido (humano):** (1) la voz de los NPCs sale apagada al cargar — debería estar ON;
(2) mostrar Leave o Leave & save, no ambos, según haya algo que guardar; (3) un botón para
parar el micrófono ("ya dije mi frase"), conservando el auto-cierre por silencio si no se pulsa.
**Prompt sintetizado:** En `client-page.tsx` arranca `voiceOn` en `true` (TTS audible de
entrada para jueces). Reemplaza la dictado de un solo disparo por una sesión controlable:
`beginDictation(onFinal)` en `src/lib/speech.ts` usa reconocimiento continuo, acumula segmentos,
se auto-cierra tras una pausa natural y expone `stop()`; el botón 🎤 pasa a "■ Stop" mientras
escucha y al pulsarlo finaliza y vuelca el texto al input. En la barra de acciones, muestra
"Leave & save" cuando `dirty[active]`, si no "Leave" — nunca los dos.
**Qué se hizo:** `beginDictation`/`Dictation` en speech.ts (continuo + stop + auto-silencio);
`voiceOn` default true; mic toggle stop; Leave/Leave&save mutuamente excluyentes. `tsc` limpio.
**Commit:** _(este commit)_

### 2026-06-29 · El TTS leía los asteriscos en voz alta
**Pedido (humano):** a veces los NPCs responden con asteriscos (markdown / *acotaciones*) y el
sistema de audio los lee literalmente ("asterisco…"). Que no los diga.
**Prompt sintetizado:** En `src/lib/speech.ts`, antes de sintetizar (`speakText`), sanea el texto
con `forSpeech()`: elimina por completo las *acotaciones* entre asteriscos (asides no verbales) y
quita cualquier marcador markdown suelto (`* _ \` # ~ >`), colapsando espacios. El texto en
pantalla queda intacto; solo cambia lo que se pronuncia. Si tras sanear queda vacío, no habla.
**Qué se hizo:** helper `forSpeech` aplicado al SSML de `speakText`. (tsc local con errores ajenos
del WIP de Codex en world.ts/types.ts — `speech.ts` no toca esos tipos.) **Commit:** _(este commit)_

### 2026-06-29 · Prompt 24 — árboles por etapas + almacén 0G
**Pedido (humano):** implementar árboles que no reaparezcan maduros de golpe: etapa persistida
(`sapling → young → mature`), rendimiento distinto por etapa, y un almacén para guardar wood/menas
por encima del cap de bolsillo.
**Prompt sintetizado:** Mantener `map.ts` como fuente de posiciones; añadir estado dinámico por
índice en `WorldState.treeGrowth` con `stage`, `nextStageAt`, `updatedAt`; `harvestTree` debe rendir
según etapa (`8/24/50 wood`) y al agotarse iniciar regrowth como sapling. El agente Tierra/economía
avanza etapas con la cadencia de Prompt 23 F3, y `woodQuote` debe calcular scarcity desde árboles
maduros disponibles. Añadir `WorldState.storage` para `wood`/`stone`/`silver`/`gold`, con
depositar/retirar persistido en el bundle 0G y sin subir el cap de acarreo. Exponer helpers de etapa
para que `Scene3D` renderice escala por árbol y documentar el seam en `COORDINATION.md`.
**Qué se hizo:** `TreeGrowthState`/`storage` normalizados y clonados en `world.ts`; helpers
`treeStageFor`, `treeIsVisible`, `matureTreeCount`, `advanceTreeGrowth`, `depositResource` y
`withdrawResource`; render instanciado escala sapling/young/mature; HUD muestra etapa/rendimiento y
panel "0G Storage"; `client-page` avanza etapas con Tierra; docs actualizados. `npx tsc --noEmit`
limpio.
**Commit:** _(este commit)_

### 2026-06-29 · Leave&save prematuro + zoom aéreo más amplio
**Pedido (humano):** (1) aparece "Leave & save" aunque no haya dicho nada, debería ser solo
"Leave"; (2) que el zoom out de la vista aérea se aleje un poquito más.
**Prompt sintetizado:** En `client-page.tsx`, `runTurn` marcaba `dirty` también para el saludo de
aproximación (`runTurn(npc, '')`), así que "Leave & save" salía antes de interactuar. Marca dirty
solo cuando `message.trim()` (utterance/elección real). En `Scene3D.tsx`, baja el mínimo de zoom
ortográfico de 12 a 9 en los dos clamps (rueda y pinch) para permitir alejar la cámara aérea un
poco más sin que asome el horizonte.
**Qué se hizo:** dirty gateado por mensaje no vacío; min zoom 12→9. `tsc` limpio.
**Commit:** _(este commit)_

### 2026-06-29 · Warehouse como edificio (no HUD) + modos ?time + "0G Storage" + guion de video
**Pedido (humano):** sacar el panel de almacén del HUD (ensucia); que sea un edificio que el
usuario construya y, al estar en él (aérea/1ra persona), abra el panel con E/click. Modos de URL
para día/noche fijos (grabar video). Y proponer/documentar varios órdenes de guion para el video.
**Prompt sintetizado:** En `Scene3D.tsx` elimina el panel de warehouse siempre-visible del HUD.
Detecta "almacén" por etiqueta de cluster (`isWarehouseLabel`: warehouse/almacén/storehouse/…);
muestra "Press E · 0G Warehouse" al acercarte a uno construido y abre un modal con deposit/withdraw
(reusando `depositResource`/`withdrawResource`). En la tarjeta de selección del edificio añade
"📦 Open warehouse" (vista aérea). Añade `?time=day|night` que fija la hora (sol/luna fijos) sin
ocultar el HUD, distinto de `?day=1` (debug) y `?shot` (thumbnail). En `client-page.tsx` el banner
de recall dice "0G Storage" (el glifo "0G" se leía "oG"). Documenta el guion en `docs/VIDEO_SCRIPT.md`.
**Qué se hizo:** warehouse gateado por edificio + E + card; modal de storage; `?time=`; banner
"0G Storage"; `docs/VIDEO_SCRIPT.md` con 3 órdenes + voz en off. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-30 · Hotfix asedios demoníacos anti-wipe
**Pedido (humano):** el playtest mostró que dejar la pestaña abierta podía acabar en wipe total:
los demonios dañaban demasiado rápido, aparecían con mucha frecuencia y una casa perdía HP en
segundos.
**Prompt sintetizado:** Ralentizar el daño de asedio sin tocar `Scene3D.tsx`: subir el cooldown,
bajar el daño/cap por ventana, impedir que demonios destruyan edificios solos con un piso de HP, y
subir el clamp mínimo de `spawnIntervalMs` para que fauna/demonios no aparezcan cada 45s.
**Qué se hizo:** `DEMON_SIEGE_DAMAGE=2`, cooldown global por wallet de 60s, cap de 8 HP por ventana
de 10min y piso seguro `max(24 HP, 35% maxHp)` para que el asedio no pueda borrar estructuras por
sí solo. `nature-agents.ts` ahora clampa spawns a 2-6min y el normalizador de mundo eleva bundles
viejos a mínimo 2min. Sin cambios en `Scene3D.tsx`. **Commit:** _(este commit)_

### 2026-06-30 · Parcel-save tolerante a 0G 503
**Pedido (humano):** comprar parcela mostraba "request failed 503" después de "saving data to 0G"
porque el storage/indexer Standard de 0G está caído/deprecado; el claim no debe romperse por eso.
**Prompt sintetizado:** Hacer que `/api/parcel-save` use la misma estrategia estable que memoria:
forzar Turbo cuando el cliente venga de Standard, reintentar la subida con backoff, y si 0G sigue
caído devolver un estado `pending` legible para que el cliente pueda continuar el claim on-chain con
metadata diferida en vez de arrojar un 503 crudo.
**Qué se hizo:** `parcel-save` calcula el `rootHash`, sube en Turbo con retries, y ante fallos
transitorios devuelve `202` con `storageStatus: "pending"`, `retryQueued` best-effort y `message`
claro. `saveParcelData` acepta ese estado pendiente y también degrada fallos de red/5xx a un
resultado local con `dataRoot=null`, evitando "request failed". Sin cambios en `Scene3D.tsx`.
**Commit:** _(este commit)_

### 2026-06-30 · Prompt 25 backend — herramientas/armas IA vendibles
**Pedido (humano):** implementar Prompt 25 en scope backend-only: ítems diseñados con IA,
persistibles en 0G, listables/comprables, y exponer ítem equipado + modificador de stat para que
Claude conecte `Scene3D.tsx` después. No tocar la escena.
**Prompt sintetizado:** Añadir un esquema acotado `AiItem`/`AiItemListing` al `WorldState`; crear
`/api/forge` como espejo de `/api/build` para prompt → ítem con stats clampados y fallback
determinista; persistir ítems/listings/equip en el bundle del mundo; exponer helpers de stat y
acciones de mercado sin romper economía/scarcity.
**Qué se hizo:** tipos `AiItem`, `AiItemListing`, `ForgeRequest/Response`; `WorldState.aiItems`,
`equippedItemIds`, `aiItemListings`; normalización anti-exploit en `world.ts`; endpoint
`/api/forge`; helpers `addAiItem`, `equipAiItem`, `equippedAiItems`, `statModifierFor`,
`allStatModifiers`, `listAiItem`, `cancelAiItemListing`, `buyAiItemListing`; seam documentado en
`COORDINATION.md` y estado del Prompt 25 actualizado. Sin cambios en `Scene3D.tsx`.
**Commit:** _(este commit)_

### 2026-06-30 · Prompt 29 data layer — biomas coherentes + parcelas
**Pedido (humano):** implementar solo la capa de datos de biomas: regiones coherentes
`meadow/sand/snow/dry`, mapeo a slots de suelo, y que las parcelas nuevas hereden bioma estable.
No tocar `Scene3D.tsx` ni `textures.ts`.
**Prompt sintetizado:** Crear `BiomeId`, `biomeAt(x,z)` determinista con regiones amplias y raros
separados, `biomeBlendAt` para bordes, `BIOME_GROUND` para que el render elija textura, y persistir
`ParcelClaim.biome` derivándolo del centro si falta.
**Qué se hizo:** `src/lib/biome.ts` con centros regionales + ruido de baja frecuencia, blend
primario/secundario, y mapping `terrain_grass/terrain_sand/terrain_snow/terrain_dry`; `ParcelClaim`
incluye `biome`; `world.ts`, `parcel-save` y `public-world` normalizan/derivan el bioma para
claims nuevos, bundles dedicados y eventos on-chain sin metadata. Seam documentado en
`COORDINATION.md`; estado de Prompt 29 actualizado. Sin cambios en `Scene3D.tsx` ni `textures.ts`.
**Commit:** _(este commit)_

### 2026-06-30 · Prompt 30 backend — muerte cuesta recursos + mercado de Aldric
**Pedido (humano):** implementar backend de consecuencias de daño/muerte y mercado de Aldric:
morir debe restar recursos/coin persistidos, demonios deben pegar ~1, y el mercado debe exponer
hierbas, kits, mejoras e ítems de jugadores para que Claude cablee la GUI.
**Prompt sintetizado:** En `world.ts` añadir vida persistida del jugador, regla de muerte con
penalización económica, catálogo estándar de Aldric y acciones de compra/curación. Integrar el
catálogo con listings de ítems del Prompt 25 sin tocar `Scene3D.tsx` ni `client-page.tsx`.
**Qué se hizo:** `WorldState.playerHp/playerMaxHp/deathCount/lastDeathPenalty`; `applyPlayerDamage`
revive a 60% HP y descuenta 20% de coin + 10% de recursos de bolsillo; `healPlayer`;
`DEMON_SIEGE_DAMAGE=1`; `ALDRIC_STANDARD_CATALOG` con hierbas medicinales, repair kit, sapling y
sharper axe; `aldricMarketCatalog` combina estándar + listings de jugadores y `buyAldricMarketItem`
aplica compras/curación. Seam documentado en `COORDINATION.md`; sin tocar escena ni client-page.
**Commit:** _(este commit)_

### 2026-06-30 · Prompt 31 backend — actividad comunitaria alimenta a Tierra
**Pedido (humano):** definir una métrica agregada de actividad/juego conectado, persistirla en 0G
y hacer que acelere la regeneración de recursos sin romper la escasez del Prompt 23. No tocar
`Scene3D.tsx` ni `client-page.tsx`.
**Prompt sintetizado:** Guardar playtime agregado en `WorldState.ecosystem.communityActivity`;
derivar `communitySignal` desde tiempo total + tiempo reciente con decaimiento; aplicar un factor
acotado a cadencias de árboles/rocas y al Agente Tierra. Exponer helper para que la UI registre
sesiones luego.
**Qué se hizo:** `CommunityActivityState`; `computeCommunityActivity` con fórmula
`0.55*totalPlay/4h + 0.45*recentPlay/45m`; `recordCommunityPlaytime(sessionMs)` persiste la métrica
en el bundle del mundo; `computeEcosystemActivity` aplica `regenCadenceMultiplier` clampado
`0.75..1` a `treeCadenceMs`/`rockCadenceMs`; `nature-agents` también aplica el multiplicador a
`cadenceMs` del Agente Tierra y lo incluye en su prompt. Seam documentado en `COORDINATION.md`.
**Commit:** _(este commit)_

### 2026-06-29 · Lote de pulido aéreo/combate (deselección, muros, sombras, casas, cono de ataque)
**Pedido (humano):** del playtest — #9 click izq. no deselecciona en aérea; #10 no se pueden rotar
muros a 45° y a veces no se puede colocar otro muro; #2 árboles sin sombra; #8 casas muy chicas;
#6 que atacar use un cono de 60° hacia el enemigo (como recolección).
**Prompt sintetizado:** Solo en `src/components/engram/Scene3D.tsx` (Codex trabaja en world.ts en
paralelo, no tocar): (#9) el "ground catcher" aéreo onClick debe `setSelectedBuilding(null)`.
(#10a) `placeRot` de muros snap a 45° (`Math.PI/4`) en vez de 90°. (#10b) en `canPlaceBuilding`
los muros usan un clearance menor (0.55) para poder pegarse a casas/otros muros. (#2) ampliar el
frustum del shadow-map de la luz direccional (±26→±52, far 80→140, mapSize 2048→3072) para que
todos los árboles proyecten sombra. (#8) subir HOUSE_WIDTH 2.4→3.0, HOUSE_DEPTH 2.0→2.6, puerta
0.82→1.1 (colisión y modelo derivan de estas constantes; actualizar los ghosts). (#6) en el scan
de enemigos (Maren + demonios) exigir el cono frontal `FACING_MIN` antes de fijar objetivo.
**Qué se hizo:** lo anterior; `tsc` limpio; sin tocar archivos de Codex. **Commit:** _(este commit)_

### 2026-06-29 · #5 árbol encoge al talar + #11 estructuras "resistentes" por IA
**Pedido (humano):** #5 que un árbol disminuya de tamaño según la madera que le queda al talarlo;
#11 si el usuario construye con IA pidiendo algo "resistente", multiplicar sus HP para que aguante.
**Prompt sintetizado:** En `world.ts` exponer `treeHarvestFraction(index)` (0→1, progreso de tala
transitorio) y, en el render de árboles de `Scene3D.tsx`, escalar el árbol por `(1 - frac*0.45)`
en la capa base y en la animación de golpe. Para #11: helper `isReinforcedLabel` + `REINFORCED_HP_MULT`
(2.5) en world.ts; `placeBuilding` multiplica `maxHp` cuando el `clusterLabel` luce reforzado.
En `Scene3D.tsx`, al generar el build IA detectar la intención en el prompt (`aiReinforced`) y
prefijar el clusterLabel con "reinforced …" al colocar, para que herede el HP y la tarjeta lo muestre.
**Qué se hizo:** lo anterior; `tsc` limpio. Coordinado: Codex ya cerró su hotfix de world.ts antes
de tocarlo. **Commit:** _(este commit)_

### 2026-06-29 · Documentar futuros (#12,#13,#15,#16) + auditoría de assets (#14)
**Pedido (humano):** documentar #12 (rotar vista aérea), #13 (hambre), #15 (herramientas/armas IA
vendibles) y una nueva idea #16 (NPC compañero); y pasar la lista de assets faltantes/pendientes.
**Qué se hizo:** `docs/ENGRAM_PROMPTS.md` Prompts 25 (#15, para Codex, backend/0G), 26 (#12),
27 (#13), 28 (#16). Nuevo `docs/ASSET_AUDIT.md`: texturas completas (8 slots), faltan 5 audios
referenciados (land-dirt + 4 de ui/) y variantes/cues opcionales. **Commit:** _(este commit)_

### 2026-06-29 · Sonido del río + biomas (doc) + prompts de arte
**Pedido (humano):** sonido de flujo de agua cerca del río; confirmar resistencia variable de
edificios a igual tamaño (sin casas miniatura); que el suelo no parezca tapiz (zonas/biomas, con
parcelas nuevas coherentes); y los prompts para generar el arte (con autoría/provenance).
**Qué se hizo:** (audio) cue `river_water` en el manifest + `makeRiverEmitters()` en Scene3D que
siembra emisores espaciales a lo largo de `riverCenterZ()` (radio RIVER_CLEAR+3, día y noche);
falta el archivo `ambient/river-water-loop.mp3` (fallback silencioso). (docs) Prompt 29 (suelo por
biomas + parcelas) en ENGRAM_PROMPTS; `docs/ART_PROMPTS.md` con prompts de textura por bioma +
slots nuevos + tabla de provenance/autoría; ASSET_AUDIT actualizado. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-29 · Edificio reforzado cuesta más madera + crédito del río
**Pedido (humano):** si un edificio es más resistente, es lógico que cueste más (madera) — y
también más tokens de su Anthropic key (prompt de sistema + prompt del usuario). Crédito del río.
**Qué se hizo:** en `Scene3D.tsx` `placeAIPreview`, un build reforzado cuesta `×REINFORCED_HP_MULT`
(2.5) de madera, igual que su factor de HP. El costo en tokens es inherente (el sistema manda
nuestras instrucciones + el prompt del usuario a /api/build con su key; el presupuesto en $ ya lo
contempla) — sin cambio. Crédito del río en `docs/AUDIO_ASSETS.md` (Pixabay 450696, recorte) y
ASSET_AUDIT marcado como presente. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-29 · Levantar el techo de la casa (quedó bajo tras agrandarla)
**Pedido (humano):** al agrandar la casa, el techo quedó bajo y con un hueco (se veía el gable
abierto). Levantarlo para que cubra bien.
**Prompt sintetizado:** El techo de la casa estaba hardcodeado para el tamaño viejo (planos
`[3.6,0.16,1.95]`/`[2.8,0.14,1.6]`, cumbrera 2.38) en los DOS renders (cottage + casa construida).
Deriva la geometría del techo de la huella: sube `HOUSE_RIDGE_Y` a 2.78 y calcula
`HOUSE_EAVE_Z/ROOF_ANGLE/SLOPE_LEN/MID_Y/MID_Z/WIDTH_X` desde HOUSE_WIDTH/DEPTH, de modo que las
dos aguas vayan del alero a la cumbrera sin dejar hueco sea cual sea el tamaño. Aplícalo en ambos
renders y al caballete.
**Qué se hizo:** constantes de techo derivadas; ambos techos parametrizados; cumbrera más alta.
`tsc` limpio; solo Scene3D.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Build fixes: commit río + casas más altas + ventanas afuera + sin anillo en FP
**Pedido (humano):** (1) el sonido del agua no se oye; (2) casas un poco más grandes (al entrar el
techo queda a la altura de los ojos); (3) las ventanas de las cottages están "por dentro" del muro;
(4) un muro quedó con un anillo (como seleccionado) en 1ra persona — quitarlo.
**Hallazgo/fix:** (1) el cableado estaba bien pero `river-water-loop.mp3` estaba SIN COMMITEAR
(untracked) → prod en silencio; se commitea el archivo. (2) `HOUSE_WALL_HEIGHT 1.8→2.3` (+ ridge/
roofY derivados), con dintel de puerta parametrizado `HOUSE_DOOR_TOP_Y`. (3) las ventanas/posts de
la cottage estaban hardcodeados en z viejo (1.01/1.06); ahora se anclan a `HOUSE_FRONT_Z` (cara
exterior del muro frontal) para verse desde afuera. (4) el anillo era el `DamageMarker` (muro
dañado por asedio); ahora `DamageMarker` y `RelationMarker` se ocultan en 1ra persona (visible solo
en aérea, como la barra de HP). `tsc` limpio; solo Scene3D.tsx + el mp3. **Commit:** _(este commit)_

### 2026-06-30 · Pilares de diseño + backlog (muerte/mercado, nature-actividad, escaleras, río, manual)
**Pedido (humano):** documentar el pilar "todo elemento debe estar justificado"; consecuencia de
morir (resta recursos) → daño de demonios a -1 + mercado de Aldric con hierbas e ítems de jugadores;
nature-AI alimentada por tiempo jugado; escaleras escalables/torres; río con propósito (cavar/pescar/
puentes/granjas/comida); modo manual con manos. Y el prompt de arte para biomas (uno por uno).
**Qué se hizo:** nuevo `docs/DESIGN_PILLARS.md` (5 pilares); ENGRAM_PROMPTS Prompts 30 (muerte+
mercado, Codex+Claude), 31 (nature-actividad), 32 (escaleras escalables), 33 (río con propósito +
comida), 34 (modo manual). Los prompts de textura por bioma ya están en `docs/ART_PROMPTS.md`.
**Commit:** _(este commit)_

### 2026-06-30 · Texturas de bioma cableadas, caminar a parcela, sin nombre flotante, +2 pilares
**Pedido (humano):** clasificar/renombrar las 7 texturas de bioma y cablearlas; la frontera impide
llegar a una parcela proclamada; quitar el nombre flotante (J17) de las parcelas; +2 pilares (UI
simple; inmersión/realismo).
**Qué se hizo:** renombré las webp a `arena1-2`, `nieve1-3`, `seco1-2` (clasificadas viendo el
contenido) y las agregué a `textures.ts` (slots terrain_sand/snow/dry). Caminabilidad: `clampToFrontier`
clampea a la región caminable MÁS CERCANA (círculo base o parcela), para cruzar el hueco y entrar a
la parcela propia. Quité el `<Html>` del nombre de parcela (rompe inmersión; las ghost-cells en modo
claim siguen mostrando su letra). DESIGN_PILLARS: pilar 6 (frontend simple) y 7 (inmersión/realismo).
Pendiente (pasada enfocada): render del terreno por biomas (shader, gradiente sin parche) + restyle
de la parcela + unión de muros 45°/perpendicular. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-30 · Render del terreno por biomas (shader, gradiente suave)
**Pedido (humano):** que el suelo no parezca tapiz/parche; usar las texturas de bioma con gradiente.
**Qué se hizo:** `Terrain` ahora usa un MeshStandardMaterial con `onBeforeCompile` que mezcla las 4
texturas (pasto base + arena/nieve/seco) por POSICIÓN del mundo, con los mismos centros/radios que
`src/lib/biome.ts`; los biomas raros entran con `smoothstep` → regiones amplias y bordes suaves, sin
parches. El centro (aldea) queda pasto puro. Conserva sombras (receiveShadow) e iluminación PBR.
`tsc` limpio; solo Scene3D.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Restyle de parcela (sin pegote) + unión de muros 45°/perpendicular
**Pedido (humano):** la parcela parece un pegote; el suelo debe degradar y no parecer parche; y los
muros no se unen en 45° ni perpendiculares (N-S con E-O).
**Qué se hizo:** (parcela) el tinte/borde de propiedad ahora es overlay SOLO-aérea (`AerialOnlyGroup`,
oculto en 1ra persona, como los anillos de edificio); el `ParcelGroundTile` solo se dibuja cuando la
parcela está fuera del terreno base (radio > GROUND_RADIUS, antes 132 → causaba doble suelo/parche),
y usa la textura del BIOMA (biomeAt) sin tinte. (muros) `WALL_GRID 1.8 → 0.9` (media celda): permite
posicionar esquinas (E-O con N-S) y que los 45° se toquen en la diagonal, conservando el tile recto a
1.8. `tsc` limpio; solo Scene3D.tsx. **Commit:** _(este commit)_

### 2026-06-30 · GUI del Mercado de Aldric (hierbas medicinales + ítems de jugadores)
**Pedido (humano):** un botón/sección "Mercado" en Aldric con productos estándar (hierbas que curan)
y los ítems que otros jugadores fabricaron y vendieron.
**Qué se hizo:** en `client-page.tsx`, sección "🏪 Market" en el panel de Aldric: muestra HP del
jugador + botón **🌿 Medicinal herbs** (cura, vía `buyAldricMarketItem('medicinal_herbs')` de Codex)
y lista los **player listings** (`aldricMarketCatalog().playerListings`) con compra (`buyAiItemListing`).
Cierra el loop del Prompt 30 (curarse importa porque perder HP cuesta). `tsc` limpio; solo client-page.tsx.
**Commit:** _(este commit)_

### 2026-06-30 · Audio por terreno: pasos/salto por bioma + ambiente desierto/nevada
**Pedido (humano):** sonidos de pasos/salto distintos según el terreno; ambiente que difiera
gradualmente de escena a escena (desierto, nevada); archivos provistos por el usuario.
**Qué se hizo:** renombré los archivos a `foley/footstep-{sand,snow,stone}-*` + `jump-{sand,snow,stone}`
y `ambient/{desert-ambience,snowfall}-loop`. Cues nuevos en el manifest (pasos a/b que alternan por
rotación de array). En Scene3D: `footstepCueFor`/`jumpCueFor` eligen el cue por `biomeAt` (agua→
splash, meadow→grass, sand→sand, snow→snow, dry→stone); emisores de ambiente `desert_ambience` y
`snowfall` centrados en las regiones de bioma → el driver por distancia hace el crossfade gradual.
Créditos en AUDIO_ASSETS. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-30 · Prompt 35: frontera caminable conexa
**Pedido (humano):** implementar el Prompt 35: una parcela proclamada puede quedar separada del
círculo base por un hueco entre `WORLD_RADIUS=132` y el grid de `PARCEL_SIZE=18`; arreglar
`parcelCellIntersectsBase` / `frontierClaimableCells` / `parcelIsClaimable` sin tocar `Scene3D.tsx`.
**Prompt sintetizado:** Cambia la arquitectura de claim de frontera para que una celda solo sea
reclamable si toca/intersecta tierra ya caminable — el círculo base o una parcela reclamada — y no
solo si es vecina en grilla de una celda que toca la base. Permite celdas que cruzan el borde del
círculo para que la primera parcela sea alcanzable, pero no celdas completamente dentro del mundo
base. Expón una regla compartida para futuros consumidores y mantén `tsc` limpio.
**Qué se hizo:** `parcelIsClaimable` ahora rechaza solo celdas completamente dentro de la base y exige
`parcelOverlapsWalkable(...)`; `frontierClaimableCells` escanea la frontera con esa misma regla, de
modo que las parcelas nuevas siempre se pegan físicamente a tierra caminable. `parcelCellsOverlap`
acepta contacto por borde y evita contacto diagonal de esquina. Sin cambios en `Scene3D.tsx`.
**Commit:** `5d8dc4b`

### 2026-06-30 · Pilar de verticalidad (Warren Spector) + estructuras escalables (Prompt 32)
**Pedido (humano):** agregar a la filosofía el punto de Warren Spector (un mundo 3D debe tener
sentido vertical: arriba —escaleras/torres— y abajo —cavar—); revisar saldo de tokens; y continuar
con otro prompt mientras Codex trabaja.
**Qué se hizo:** DESIGN_PILLARS pilar 8 (verticalidad con sentido). Saldo del sponsor: 5.40 OG
(subió ~2 OG por la transferencia). Implementé el Prompt 32 (estructuras escalables) en Scene3D
(no choca con Codex en world.ts): los voxels IA ahora son SÓLIDOS y ESCALABLES — `blockSupportTop`
permite pararse/subir escalones ≤ STEP_UP (0.62) (escaleras, cima de torre); `resolveBlockWalls`
frena al jugador contra voxels altos (muros de torre) pero deja subir escalones. Integrado en el
grounding y la colisión del Player FP, con `groundYRef` como referencia de step-up. (Limitación
conocida: saltar sobre plataformas altas aún no aterriza encima; subir por escaleras sí — pendiente
de playtest.) `tsc` limpio; solo Scene3D.tsx + docs. **Commit:** _(este commit)_

### 2026-06-30 · Base caminable cuadrada (parcela/muro circular) + aves vs nieve + agua animada
**Pedido (humano):** sigo sin entrar a mi parcela y el muro invisible es circular (hay textura
inaccesible en un mapa cuadrado); las aves se oyen junto a la nevada (debe ser una u otra); animar
el agua del río para que se note flujo.
**Qué se hizo:** (#2) `isFrontierWalkable`/`clampToBaseWorld` ahora usan un CUADRADO base
(`GROUND_RADIUS-3`) en vez del círculo `WORLD_RADIUS` → todo el terreno texturizado es caminable y
las parcelas del borde conectan; quita el "muro redondo en mapa cuadrado". (#1c) en el tick de
ambiente, `day_ambience` (aves) se silencia cuando el jugador está en bioma snow/sand → no se
encima con snowfall/desierto. (#1b) `River` anima sus vértices con ondas que viajan río abajo
(useFrame) → sensación de flujo. `tsc` limpio; solo Scene3D.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Performance pass de datos: public-world incremental + logs debug
**Pedido (humano):** implementar la parte de datos de la auditoría de eficiencia sin tocar
`Scene3D.tsx` ni `client-page.tsx`: `public-world` incremental con cache por `latestBlock/root`,
pool de descargas, pausa de polling con `document.hidden`, e higiene de logs controlada por env.
**Prompt sintetizado:** Optimiza la lectura pública del mundo para no re-escanear ni re-descargar
datos si no cambiaron: cachear mundos por `owner/root`, cachear metadata de parcelas por `dataRoot`,
limitar concurrencia de descargas y suspender el polling mientras la pestaña esté oculta. Añadir un
helper `debugLog` controlado por `NEXT_PUBLIC_ENGRAM_DEBUG`/`ENGRAM_DEBUG` y mover logs ruidosos de
API/0G/memoria detrás de esa bandera, manteniendo el comportamiento funcional intacto.
**Qué se hizo:** `public-world` ahora salta refreshes si `latestBlock` no cambió, reutiliza bundles
cuando el root del owner es el mismo, hidrata parcelas con cache, descarga con pool de 5, y reanuda
al volver la pestaña visible. `debug-log.ts` centraliza `debugLog/debugInfo/debugWarn/debugError`;
logs informativos/repetitivos de `/api/save`, `/api/parcel-save`, `/api/mine`, `memory`,
`parcel-data`, `public-world` y `0g/downloader` quedan silenciosos por defecto.
`tsc` limpio. **Commit:** _(este commit)_

### 2026-06-30 · Perf pass de Scene3D (índice de obstáculos memoizado + mapas de eventos)
**Pedido (humano):** atender la auditoría de Codex — colisión reconstruye listas de obstáculos por
frame, y el render filtra eventos por edificio (buildings × events).
**Qué se hizo:** (1) `obstacleIndex()` memoizado por IDENTIDAD DE REFERENCIA de los arrays de estado
(buildings/choppedTrees/treeGrowth/minedRocks/parcelClaims + públicos), porque el estado es inmutable
→ las listas (campfire+árboles+rocas+nodos de parcela, muros, casas, voxels) se reconstruyen solo al
commitear, no cada frame. `resolveCollision`, `blockSupportTop` y `resolveBlockWalls` lo consumen.
(2) En `Buildings`, mapas `useMemo` `local/publicRaid|RepairByBuilding` agrupan eventos por buildingId
→ cada edificio hace lookup en vez de filtrar todos los eventos (era buildings × events). `tsc`
limpio; solo Scene3D.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Daño de demonios a -1, HP persistido en 0G, y falso "Hold F to mine"
**Pedido (humano):** los demonios siguen quitando 15 (debe ser 1); la vida debe vivir en el JSON 0G
del jugador (no salir con 100 al recargar); y aparece "Hold F to mine" sin piedra cerca (y sí mina).
**Qué se hizo:** (daño) el DPS de enemigos al jugador pasó de 15 a **1** (Scene3D 2527). (HP en 0G)
nuevo `setPlayerHp` en world.ts; en Scene3D el intervalo de HP inicializa `dynamicPlayerState.hp`
desde `playerHpWithEquipment()` (carga del 0G) y reconcilia: una curación (hierbas) sube world.playerHp
y se adopta; el combate baja la HP viva y se persiste (throttle ~900ms) → al recargar conserva la vida.
(falso mine) la detección de roca/árbol solo usaba distancia HORIZONTAL; en colinas detectaba recursos
muy arriba/abajo → agregué compuerta vertical (`|terrenoY - pies| ≤ 2.2`). `tsc` limpio.
**Commit:** _(este commit)_

### 2026-06-30 · Parcela deja de verse como parche (mismo shader de biomas)
**Pedido (humano):** la parcela parece un parche; la iluminación/terreno no se comparte (capturas).
**Qué se hizo:** extraje el material de biomas del terreno a un singleton `getBiomeTerrainMaterial()`
y lo uso TAMBIÉN en `ParcelGroundTile`. Antes la parcela usaba la textura de UN solo bioma (biomeAt
del centro) mientras el terreno MEZCLA por posición → en bordes de bioma se veía un parche verde
sobre nieve/desierto. Ahora la parcela mezcla por posición igual que el entorno (mismo shader, misma
iluminación PBR) → sin parche. `tsc` limpio; solo Scene3D.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Parcelas como loot pack con rareza
**Pedido (humano):** reemplazar los recursos fijos de parcela por un bundle sorpresa determinista y
persistido en 0G, con pesos de rareza madera > piedra > plata > oro, sin tocar `Scene3D.tsx` ni
`client-page.tsx`.
**Prompt sintetizado:** Define un esquema de `ParcelClaim.resources` que exponga nodos `{type,
rarity, amount, hp, localX, localZ, radius}`. Genera el loot pack de forma determinista por id/grid
de parcela, normaliza saves viejos con el mismo generador, persiste el resultado en el bundle 0G y
en el `ParcelDataBundle`, y mantén plata/oro raros para no romper la escasez/precios del Prompt 23.
Documenta el contrato para que Claude lo renderice/coseche después.
**Qué se hizo:** nuevo `parcel-resources.ts` con generador/normalizador determinista; `ParcelClaim`
ahora persiste `resources`; `world.ts`, `parcel-save` y `public-world` normalizan/generan nodos; y
`harvestParcelResource(node.id, node.type, node.amount)` soporta madera, piedra, plata y oro con
caps. Esquema documentado en `docs/PARCEL_LOOT_SCHEMA.md`. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-30 · Frontera de parcelas sobre base cuadrada
**Pedido (humano):** la base caminable ya no es el círculo `PARCEL_BASE_WORLD_RADIUS`, sino un
cuadrado de medio-lado 137 (`GROUND_RADIUS - 3`) sin importar `map.ts`; una celda dentro del mapa
original no debe ser reclamable, solo la frontera que extiende el cuadrado. No tocar `Scene3D.tsx`
ni `client-page.tsx`.
**Prompt sintetizado:** Introduce `BASE_HALF_EXTENT = 137` en `world.ts` y cambia
`parcelCellIntersectsBase` / `parcelCellFullyInsideBase` para usar intersección/contención de
rectángulo-celda contra cuadrado base. Mantén `parcelIsClaimable`: no claimed, no fully-inside,
dentro del hard limit y solapa tierra caminable. Actualiza helpers de extensión/labels para que la
geometría de datos use la misma base cuadrada.
**Qué se hizo:** `parcelCellIntersectsBase` ahora detecta solape con `[-137,137]^2`; `fullyInside`
usa contención total en ese cuadrado; `worldExtentForClaims` y `cellLabel` parten de
`BASE_HALF_EXTENT`. Sanity check: `7,7` no reclamable; `8,0`/`8,8` sí cruzan frontera; `9,0` no toca
base y no es primer claim. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-30 · Prompt 36: storage en cualquier edificio
**Pedido (humano):** reemplazar el warehouse único por almacenamiento en cualquier edificio del
jugador, con capacidad derivada del tamaño/área de la huella; backend-only en `world.ts`; no tocar
`Scene3D.tsx` ni `client-page.tsx`.
**Prompt sintetizado:** Añade storage persistido por edificio (`Building.storage`), calcula capacidad
por footprint (casa > muro > bloque; clusters suman sus bloques), expón vistas de capacidad/contenido
por edificio para la UI de Claude, y acciones `deposit/withdraw` por edificio manteniendo caps de
bolsillo. Conserva `WorldState.storage` solo como agregado/compatibilidad y migra saves viejos al
primer edificio con capacidad cuando sea posible.
**Qué se hizo:** `buildingStorageCapacity`, `buildingStorageContents`, `buildingStorageView`,
`depositResourceToBuilding` y `withdrawResourceFromBuilding` en `world.ts`; `Building.storage`
normalizado/persistido en el bundle 0G; demolición redistribuye contenido a edificios restantes o
lo deja como overflow agregado para no perder recursos. Wrappers legacy `depositResource`/
`withdrawResource` siguen funcionando apuntando al primer edificio viable. `tsc` limpio.
**Commit:** _(este commit)_

### 2026-06-30 · Payload compacto para agentes de naturaleza
**Pedido (humano):** preparar el punto medio de auditoría: dejar de depender del `WorldState`
completo para Earth/Fauna porque el payload crecerá con builds, parcelas, eventos y storage. No
tocar `client-page.tsx` ni `Scene3D.tsx`; exponer helper para que Claude haga el swap.
**Prompt sintetizado:** Crear `buildNatureAgentSnapshot(world, ecosystem)` con solo los campos que
los agentes usan: snapshot zonal, contadores globales de presión ecológica, coin/enemies y memoria
`ecosystem`. Adaptar `/api/earth-agent` y `/api/fauna-agent` para aceptar el payload compacto
(`agentSnapshot`) sin romper el contrato legacy `world + snapshot`; internamente los agentes deben
usar siempre el compacto. Documentar qué entra y qué se omite.
**Qué se hizo:** nuevo tipo `NatureAgentSnapshot`/`NatureAgentWorldCounters`; `nature-agents.ts`
exporta `buildNatureAgentSnapshot` y normaliza requests legacy/compactos; prompts y fallbacks usan
contadores compactos en vez de leer el mundo completo. Las APIs aceptan `agentSnapshot` o fallback
legacy. Comentario de contrato documenta que se omiten inventario completo, edificios/parcelas/eventos,
items y memorias. `tsc` limpio. **Commit:** _(este commit)_

### 2026-06-30 · GUI de Aldric: vender madera dentro del panel (no separado)
**Pedido (humano):** la venta de madera está separada del resto (traslape de forma vieja/nueva).
**Qué se hizo:** quité el botón "Sell wood" de la fila de acciones (junto a Say/Leave) y puse un
botón "Sell" JUNTO al input "Wood to sell" dentro del panel de comercio, donde ya viven comprar/
sapling/repair/axe/Market. Toda la venta/compra en un solo lugar (pilar 6: frontend simple).
`tsc` limpio; solo client-page.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Recursos de parcela cosechables (loot packs de Codex) — adiós puntas verdes
**Pedido (humano):** las puntas verdes de la parcela son adorno y no se cosechan; deberían ser
"premios sorpresa" con rareza (oro > plata > piedra > madera).
**Qué se hizo:** reescribí `ParcelResourceCluster` para consumir `claim.resources` (el loot pack
de Codex, schema en docs/PARCEL_LOOT_SCHEMA.md) en vez de los nodos placeholder: wood → árbol,
stone/silver/gold → roca/veta tintada (plata y oro BRILLAN con emissive + pointLight; oro/legendary
más grande). Se posicionan en el suelo (getHeightAt por nodo), se cosechan al click
(`harvestParcelResource(id, type, amount)`), los agotados desaparecen, y el feedback marca la rareza
(✨ Legendary / ★ Rare). La colisión (`parcelLootColliders`) usa los mismos nodos (y se memoiza con
`depletedParcelResources` en las keys). Quité el `parcelResourceNodes` viejo. `tsc` limpio; solo Scene3D.tsx.
**Commit:** _(este commit)_

### 2026-06-30 · Cablear almacén por edificio (backend de Codex Prompt 36)
**Pedido (humano):** ver el trabajo de Codex (almacén en cualquier edificio) y continuar el mío (UI).
**Revisión de Codex (0fd3b60):** aprobado — `Building.storage`, capacidad por huella, suma por cluster,
`buildingStorageView/depositResourceToBuilding/withdrawResourceFromBuilding`, migración de storage
legacy. tsc limpio integrado.
**Qué hice (UI, Scene3D):** el panel de almacén ya no está gateado por `isWarehouseLabel`; ahora
**cualquier edificio propio** almacena. La proximidad detecta el **edificio más cercano** (hint
"Press E · Store in <label>"); E abre su panel; también hay "📦 Open storage" en la tarjeta de
selección (aérea). El modal muestra `used/capacity` y hace deposit/withdraw **a ese edificio**
(`depositResourceToBuilding`/`withdrawResourceFromBuilding`). `tsc` limpio; solo Scene3D.tsx.
**Commit:** _(este commit)_

### 2026-06-30 · Swap a payload compacto para agentes de naturaleza
**Pedido (humano):** revisar el snapshot compacto de Codex y hacer mi parte (el swap en client-page).
**Revisión de Codex (0daf3f7):** aprobado — `buildNatureAgentSnapshot(world, ecosystem)` +
`NatureAgentSnapshot` (v1); las rutas earth/fauna aceptan `agentSnapshot` con fallback a world; los
prompts/fallbacks internos ya usan contadores/zonas compactos. tsc limpio.
**Qué hice (client-page):** el `baseBody` ahora manda SOLO `{ walletAddress, agentSnapshot:
buildNatureAgentSnapshot(world, world.ecosystem) }` en vez del WorldState completo → menos tokens/
latencia. Quité `computeNatureSnapshot`/`world`/`current` del envío. `tsc` limpio; solo client-page.tsx.
**Commit:** _(este commit)_

### 2026-07-01 · Higiene de logs en producción
**Pedido (humano):** implementar el punto "Bajo" de auditoría: silenciar logs diagnósticos de
lib/API/0G en producción con `debugLog`, sin tocar `Scene3D.tsx` ni `client-page.tsx`.
**Prompt sintetizado:** Reutilizar el helper `debug-log.ts` (`NEXT_PUBLIC_ENGRAM_DEBUG=1` /
`ENGRAM_DEBUG=1`) para que los logs de diagnóstico solo salgan en debug. Convertir `console.warn`/
`console.info` ruidosos de world persistence y lecturas opcionales de registry a `debugWarn`/
`debugInfo`; conservar `console.error` de fallos reales en API. Documentar la env var en `.env.example`
y README.
**Qué se hizo:** `world.ts`, `world-0g.ts`, `registry.ts` y `parcels.ts` ya no emiten warnings/info
diagnósticos por defecto; `debug-log.ts` documenta el gate; `.env.example` y README explican cómo
activar `NEXT_PUBLIC_ENGRAM_DEBUG=1`. Búsqueda en `src/lib`/`src/app/api` limpia para
`console.log/info/warn/debug` fuera del helper. **Commit:** _(este commit)_

### 2026-06-30 · Penalización de muerte (cerrar el loop del pilar 2)
**Pedido (humano):** morir debe costar (restar recursos), disparando el backend de Codex.
**Revisión de Codex (73e2b58, debugLog):** aprobado — logs de diagnóstico tras `debugLog` +
NEXT_PUBLIC_ENGRAM_DEBUG, errores reales de API intactos.
**Qué hice (Scene3D):** al detectar la muerte en combate disparo `applyPlayerDamage(9999,'death')`
UNA vez → world aplica la pérdida de recursos (`deathPenaltyFor`/`applyDeathPenalty`) y revive
`playerHp` a una fracción del máximo; guardo el `penalty` y muestro "You lost X wood · Y coin…" en
el overlay YOU DIED. El respawn usa `playerHpWithEquipment().hp` (el 60% del revive), NO el máximo →
morir cuesta. Cierra el loop del pilar 2 (perder vida importa → curarse importa). `tsc` limpio; solo
Scene3D.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Cielo más bonito: nubes suaves a la deriva
**Pedido (humano):** embellecer el cielo.
**Qué se hizo:** nuevo `SkyClouds` (drei `<Clouds>/<Cloud>`, batched en un draw call) — 4 nubes
suaves a gran altura que van a la deriva lateral lenta (useFrame) y solo aparecen de día
(`dn.skyVisible`), tintadas con `dn.dirColor` para que capten el color cálido del atardecer. Se
renderizan junto al `<Sky>` en ambos modos (cinemático y ?day=1). `tsc` limpio; solo Scene3D.tsx.
**Commit:** _(este commit)_

### 2026-06-30 · Loops de ambiente sin corte (Web Audio API gapless)
**Pedido (humano):** el loop del agua tiene un corte audible entre fin y principio en producción.
**Causa/fix:** era la brecha del `<audio loop>` de HTML (no el mp3). Añadí una capa Web Audio en
`AudioContext.tsx`: cada cue de LOOP se decodifica a un AudioBuffer y se reproduce con un
`AudioBufferSourceNode(loop=true)` → GainNode → master → destino (sin gap). `setLoopVolume`/
`setLoopEnabled` ahora rampan el GainNode (volumen espacial), y el mute usa un master gain. El
contexto se crea/reanuda en el primer gesto. Los one-shots (pasos, golpes) siguen en HTML Audio.
Afecta a todos los loops (río, desierto, nevada, grillos, día, fogata) → todos sin corte. `tsc`
limpio; solo AudioContext.tsx. **Commit:** _(este commit)_

### 2026-06-30 · Documentar 3 pendientes de playtest + video script en inglés
**Pedido (humano):** documentar (sin arreglar) 3 issues (piso nocturno "espejo"/iluminación pésima;
demonio que se acerca pero no ataca; unión de muros en ángulos aún imperfecta) y rehacer el guion
del video EN INGLÉS.
**Qué se hizo:** appended a `docs/KNOWN_ISSUES.md` los 3 issues con hipótesis y punteros de código.
Reescribí `docs/VIDEO_SCRIPT.md` completo en inglés (7 mecánicas ancladas a 0G, modos ?time=day|night,
3 órdenes de grabación, voiceover). Sin cambios de código.
**Commit:** _(este commit)_
