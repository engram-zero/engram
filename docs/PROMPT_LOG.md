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
