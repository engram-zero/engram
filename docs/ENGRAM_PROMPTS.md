# Engram — Prompt Log (tareas pendientes)

> Bitácora de prompts de tareas para pasar a la IA (Claude Code / colaboradores).
> El Zero Cup premia el *vibe coding* con prompts; este archivo es a la vez el
> backlog y la evidencia de cómo se construyó cada pieza.
>
> Cada prompt es **autocontenido**: asume una IA que abre el repo en frío, así que
> incluye contexto, archivos relevantes, restricciones y criterios de aceptación.
>
> 📜 Para la **evidencia de qué prompt produjo qué cambio** (con commits), ver
> [`PROMPT_LOG.md`](PROMPT_LOG.md). Este archivo es el *backlog* (tareas futuras).

**Repo:** `engram` — Next.js 15.1.5 + TypeScript · 0G Storage (Galileo testnet, chain `16602`) · ethers v6 · wagmi · Three.js / @react-three/fiber / @react-three/drei.

Índice:
1. [On-chain rootHash registry (memoria cross-device / cross-game)](#prompt-1--on-chain-roothash-registry) — ✅ done
2. [World pass: terreno con alturas, cielo, casas, árboles y avatares](#prompt-2--world-pass-terreno-cielo-y-props) — ✅ done
3. [Protección de coste/abuso en /api/npc (rate limit)](#prompt-3--rate-limit--anti-abuso-en-apinpc) — ✅ done
4. [Controles móviles / táctiles (sin pointer lock)](#prompt-4--controles-móviles--táctiles) — ✅ done (joystick de arrastre, look táctil en 1ª persona, toggle de vista, sin scroll iOS, modo demo)
5. [Texturas PNG en lugar de materiales planos](#prompt-5--texturas-png) — ✅ done (22 texturas en webp; ver [`ART_ASSETS.md`](ART_ASSETS.md))
6. [Audio ambiental (fogata, pasos, noche)](#prompt-6--audio-ambiental) — 🟡 partial: infraestructura + cues cableados; faltan mute y fogata posicional
7. [Verificar end-to-end la UX del 429 en el cliente](#prompt-7--verificación-diferida-ux-del-429) — ⏳ diferida (ver precondición)
8. [Visión: gameplay loop, doble vista y mundo persistente en 0G](#prompt-8--visión-gameplay-loop--doble-vista) — 🟡 partial: 8a done, 8b persistencia MVP done (martelaxe)
9. [Construir edificios + persistir el mundo en 0G](#prompt-9--construir--persistir-el-mundo-en-0g) — ✅ 9a (gameplay + zonas/precios) y 9b (persistencia 0G, martelaxe) hechos
10. [Mercado: vender recursos a los NPCs → reputación en 0G](#prompt-10--mercado-vender-recursos--reputación) — ✅ v1 done (venta simple + reputación); v2 regateo pendiente
11. [Construcción con IA + tokens (describir y que la IA edifique)](#prompt-11--construcción-con-ia--tokens) — ✅ done (`/api/build` + modal; **bloques voxel** refinados a grid fino, preview, costo USD, tope de gasto, BYO key)
12. [Edificios habitables (entrar dentro)](#prompt-12--edificios-habitables-entrar) — ✅ done (casas huecas con puerta libre)
13. [Relaciones entre players: aliados, enemigos y sabotaje](#prompt-13--relaciones-entre-players-aliados-enemigos-y-sabotaje) — ⏳ pendiente
14. [Mercado v2: bienes comprables, sinks y reparación](#prompt-14--mercado-v2-bienes-comprables-sinks-y-reparación) — ⏳ pendiente
15. [Asedios y demonios con fairness offline](#prompt-15--asedios-y-demonios-con-fairness-offline) — ⏳ pendiente
16. [Animaciones de gathering y feedback físico](#prompt-16--animaciones-de-gathering-y-feedback-físico) — ⏳ pendiente
17. [Terreno editable, ríos y mapa más grande](#prompt-17--terreno-editable-ríos-y-mapa-más-grande) — ⏳ pendiente
18. [Reparación, durabilidad y mantenimiento del mundo](#prompt-18--reparación-durabilidad-y-mantenimiento-del-mundo) — ⏳ pendiente

> **Tareas no-código (ADMIN):** ✅ deploy a Vercel + env vars · ✅ save a 0G end-to-end ·
> ⏳ actualizar la Description del dashboard 0g.ai (versión honesta) ·
> ⏳ grabar video demo (guion en [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)) · ⏳ completar submission ·
> ⏳ post en X (`#TheZeroCup`, `@0G_labs`).

---

## Prompt 1 — On-chain rootHash registry

> **✅ DONE — 17 jun 2026.** Implementado con [`contracts/EngramRegistry.sol`](../contracts/EngramRegistry.sol),
> [`scripts/deploy-registry.ts`](../scripts/deploy-registry.ts), ABI mínimo en
> [`src/lib/registry/abi.ts`](../src/lib/registry/abi.ts), cliente en
> [`src/lib/registry/registry.ts`](../src/lib/registry/registry.ts), e integración en
> [`src/lib/memory.ts`](../src/lib/memory.ts). Registry Galileo actual:
> `0xD142048BcA7fC224d557C12F8adbAc70D4EC4067` (baked-in como infraestructura pública
> de la app; `NEXT_PUBLIC_ENGRAM_REGISTRY` queda solo como override de testing).
> `readBundle` intenta `rootOf(wallet)` primero y cae a localStorage; `writeMemory`
> sube el bundle a 0G vía `/api/save` y luego ancla el root con `setRoot` si cambió.
> `npx tsc --noEmit` limpio.

```
# Tarea: anclar el puntero de memoria en un contrato on-chain (no en localStorage)

## Contexto
Engram guarda TODA la memoria de una wallet en un único JSON ("MemoryBundle")
subido a 0G Storage. 0G es content-addressed: para releer el bundle hace falta su
`rootHash` (32 bytes). Hoy ese puntero se cachea SOLO en localStorage, en
`src/lib/memory.ts`:
  - clave: `engram:bundleRoot:{wallet}` (ver getBundleRoot / setBundleRoot)
  - readBundle(wallet) lo lee; writeMemory(...) lo escribe tras subir el bundle.

Consecuencia: la DATA vive en 0G y es auditable, pero el PUNTERO es local. Por eso
no hay recall real cross-device ni otros juegos pueden descubrir el bundle. El tipo
`NPCIndex` en `src/lib/types.ts` ya anticipa esta evolución (campo `bundleRoot`).

## Objetivo
Mover el puntero a un contrato registry en 0G Chain (EVM, chain 16602), de forma que:
  - cualquier dispositivo con la misma wallet recupere su memoria,
  - cualquier contrato/juego pueda leer `rootOf(wallet)` → demostrando la tesis
    "memoria portable y propiedad del jugador" del docs/ENGRAM_ECONOMY.md.

## Entregables

### 1) Contrato `EngramRegistry` (Solidity, EVM 0G Galileo testnet)
   - `mapping(address => bytes32) public rootOf;`  (rootHash del MemoryBundle vigente)
   - `mapping(address => uint64) public updatedAt;`
   - `function setRoot(bytes32 root) external;`  // msg.sender ancla SU propio root
   - `event RootUpdated(address indexed wallet, bytes32 root, uint64 at);`
   - Sin owner, sin admin: cada wallet solo puede escribir su propio root
     (clave del modelo "ni el dev puede alterar la memoria").
   - Ubícalo en `contracts/EngramRegistry.sol`. Añade un script de deploy con ethers v6
     (`scripts/deploy-registry.ts`) usando NEXT_PUBLIC_L1_RPC (https://evmrpc-testnet.0g.ai)
     y una PRIVATE_KEY de .env (NO commitear la key). Imprime la address desplegada.
   - Guarda el ABI mínimo (solo rootOf/setRoot/updatedAt/evento) en
     `src/lib/registry/abi.ts` para que el cliente no dependa de artefactos de build.

### 2) Capa cliente `src/lib/registry/registry.ts`
   - `readRootOnchain(wallet, l1Rpc): Promise<string | null>`
     usa un JsonRpcProvider de solo lectura (sin firma) → registry.rootOf(wallet).
     Devuelve null si es bytes32 cero.
   - `readRootOnchain(wallet, l1Rpc)` puede usar el provider del wallet conectado
     (window.ethereum) o un JsonRpcProvider de solo lectura.
   - La ESCRITURA del root tiene dos diseños posibles (elige y documenta — ver abajo).
   - Address del registry desde env: NEXT_PUBLIC_ENGRAM_REGISTRY (documéntala en .env.example).

### 3) Integración (OJO: las escrituras hoy son server-side patrocinadas)
   IMPORTANTE: desde el fix de junio, el bundle ya **no se sube desde el cliente** —
   `src/lib/memory.ts:writeMemory` hace `POST /api/save` y el **servidor** sube a 0G con la
   sponsor wallet (`ENGRAM_SPONSOR_KEY`). Ver `docs/STATUS.md`. Así que el registro on-chain
   debe encajar en ese flujo. Dos opciones:

   - **A) Sponsor escribe (gasless para el jugador).** Contrato `setRootFor(address wallet,
     bytes32 root)` restringido a un escritor autorizado (la sponsor). `/api/save`, tras
     subir a 0G, llama `setRootFor(walletAddress, rootHash)` con la misma sponsor wallet.
     Simple y sin firma del jugador, pero el puntero queda mediado por el dev (la data en 0G
     sigue siendo inmutable/auditable; el registry es solo el puntero + un evento auditable).
   - **B) El jugador firma el puntero (más fiel a "tú lo posees").** `setRoot(bytes32)` con
     `msg.sender` = jugador. Tras `/api/save` devolver el rootHash, el cliente llama
     `registry.setRoot(rootHash)` vía MetaMask (esto NO tiene problema de CORS — es una tx
     L1, no storage). Añade una firma del jugador solo para el puntero.

   - `readBundle`: primero intenta `readRootOnchain`; si no hay address/falla, cae al caché
     localStorage. Cachea en localStorage el root que venga de la cadena. Escribe a la cadena
     solo si el root cambió.

## Recomendación
Empieza con **A** (sponsor `setRootFor`) por simplicidad y para no reintroducir fricción de
firma; docémenta el evento `RootUpdated` como la pista auditable. Si quieres el ángulo fuerte
de "el jugador es dueño del puntero", ofrece **B** como opción detrás de un toggle.

## No rompas
  - La firma de readMemory/readAllMemories/writeMemory que consume src/app/client-page.tsx.
  - El modelo de bundle único y el flujo de upload probado en src/lib/0g/*.
  - El typecheck: `npx tsc --noEmit` debe pasar.

## Criterios de aceptación
  1. Hablar con un NPC y guardar → la tx de registro (setRoot **o** setRootFor, según el
     diseño A/B elegido) emite `RootUpdated` (verificable en chainscan-galileo.0g.ai).
  2. Abrir la app en OTRO navegador/perfil con la misma wallet y vacío el localStorage →
     la memoria se recupera leyendo el root desde el contrato.
  3. Con NEXT_PUBLIC_ENGRAM_REGISTRY sin definir, la app funciona igual que hoy (solo local).
  4. Guardar dos veces sin cambios no dispara una 2ª tx de registro.
  5. `npx tsc --noEmit` limpio.
```

---

## Prompt 2 — World pass: terreno, cielo y props

> **✅ DONE — 16 jun 2026.** Implementado en [`src/components/engram/map.ts`](../src/components/engram/map.ts)
> (fuente única: `getHeightAt`, props y colliders) + refactor de
> [`src/components/engram/Scene3D.tsx`](../src/components/engram/Scene3D.tsx): terreno
> desplazado que la cámara sigue, cielo `<Sky>` crepuscular + luna con halo, casas a dos
> aguas con chimenea humeante, bosque instanciado (pino/frondoso/arbusto) y avatares
> pulidos. `tsc --noEmit` limpio; smoke test en navegador sin errores de consola.

```
# Tarea: hacer de Aldenmoor un entorno detallado y explorable (terreno con alturas)

## Contexto
La aldea se renderiza en `src/components/engram/Scene3D.tsx` con
@react-three/fiber + @react-three/drei (Three 0.169). YA es primera persona:
PointerLockControls (mouse-look) + WASD vía KeyboardControls, en el componente
`Player`. Hoy el suelo es un disco plano y la altura del jugador es fija (EYE_HEIGHT).
Las colisiones son círculos XZ en la constante COLLIDERS, y los NPCs están en NPC_POS.
La lógica de diálogo/memoria vive en client-page.tsx y NO debe tocarse.

Referencia de estilo (otro proyecto del equipo, three.js vanilla) para un mundo
caminable con alturas: ver el patrón `getWalkHeightAt(x,z)` y colisiones por Box3 en
`C:\Users\aribe\Desktop\Ensayos_programación\Spaces\public\house\scene.js` y
`public/shared/movement.js`. Adáptalo a R3F (no copies vanilla three).

## Objetivo
Subir mucho la calidad visual y la sensación de exploración, manteniendo el FPS
fluido y el flujo de "acércate + E para hablar" intacto.

## Entregables

### 1) Módulo de terreno con elevación — `src/components/engram/map.ts`
   - Exporta `getHeightAt(x, z): number` (altura del suelo) y `getGroundNormal(x,z)` opcional.
   - Usa una función de altura determinista (suma de senos / ruido simple sin deps nuevas;
     o un PlaneGeometry con vértices desplazados). Colinas suaves, un claro plano en el
     centro donde están los NPCs y la fogata (que NPC_POS y la plaza queden ~nivel 0).
   - Exporta también la malla/listado de props del mapa (posiciones de casas, árboles,
     caminos) para que escena y colisiones lean de UNA sola fuente de verdad.
   - Exporta los colliders derivados de esos props (reemplaza la constante COLLIDERS hardcodeada).

### 2) Integración en `Player` (Scene3D.tsx)
   - La cámara debe seguir el relieve: `camera.position.y = getHeightAt(x,z) + EYE_HEIGHT + bob`.
   - Mantén el head-bob y las colisiones por empuje radial ya existentes, pero leyendo
     colliders desde map.ts. Conserva el límite del mundo (boundary) y el spawn.
   - Asegúrate de que los NPCs (NPC_POS) y el prompt "Press E" sigan funcionando: si elevas
     el terreno, ancla los NPCs/props a `getHeightAt` para que no floten ni se hundan.

### 3) Cielo "más padre" 
   - Usa `<Sky>` de drei (o un gradiente shader) para un crepúsculo/noche estrellada con
     buen degradado de horizonte; conserva <Stars>. Mejora la luna (glow/halo, bloom sutil
     si añades @react-three/postprocessing — opcional y barato). Niebla atmosférica por
     profundidad coherente con el color del cielo.

### 4) Casas más grandes y mejores — refactor de `Cottage`
   - Mayor escala y proporción creíble, con detalles: marcos de puerta/ventana, chimenea con
     humo (sprite/partículas ligeras), tejado a dos aguas en vez de cono, viga de madera,
     variación de materiales. Distribúyelas con map.ts (4–6 casas) sobre el relieve.

### 5) Árboles mucho más detallados — `Tree` (instanciado)
   - 2–3 especies (pino, frondoso, arbusto), tronco con corteza, copa multi-capa o follaje
     por instancias. Usa InstancedMesh para poblar decenas/cientos sin matar el FPS.
     Ancla cada árbol al terreno con getHeightAt y añade su collider al set de map.ts.

### 6) Avatares de NPC pulidos — refactor de `CharacterBody`
   - Mejora siluetas y materiales de Aldric/Maren/Sable (manos/capa/casco/báculo según rol),
     proporciones más cuidadas, sombras de contacto. Mantén la animación de "bob"/idle y los
     accents/colores actuales por NPC. Que sigan siendo reconocibles a primera vista.

## Rendimiento (obligatorio)
  - InstancedMesh para árboles/vegetación; reutiliza geometrías y materiales (useMemo).
  - dpr acotado como hoy ([1, 1.75]); sombras solo donde aporten. Apunta a 60 fps en laptop media.
  - Nada de assets externos pesados ni dependencias nuevas grandes salvo (opcional)
    @react-three/postprocessing para bloom; si lo añades, instálalo con --legacy-peer-deps.

## No rompas
  - El contrato de props de Scene3D (memories, active, talking, onSelect, interactive, showTitle)
    ni la pantalla de título cinemática.
  - El flujo de diálogo/memoria de client-page.tsx.
  - `npx tsc --noEmit` debe pasar y la app debe arrancar con `npm run dev`.

## Criterios de aceptación
  1. Caminas en primera persona sobre terreno con colinas; la cámara sube/baja con el relieve.
  2. Cielo y luna notablemente mejores; casas más grandes; árboles densos y detallados sin caída de FPS.
  3. NPCs anclados al suelo, "Press E" funciona, el diálogo abre y guarda igual que antes.
  4. Escena y colisiones leen la MISMA fuente (map.ts); no hay posiciones duplicadas.
  5. `npx tsc --noEmit` limpio.
```

---

## Prompt 3 — Rate limit / anti-abuso en /api/npc

> **✅ DONE — 16 jun 2026.** Limitador sliding-window en memoria en
> [`src/lib/ratelimit.ts`](../src/lib/ratelimit.ts) (15/min + 200/día por clave),
> cableado en [`src/app/api/npc/route.ts`](../src/app/api/npc/route.ts) por wallet **e**
> IP, con guard de tamaño (mensaje >500 chars → 413) y respuesta 429
> `{ retryAfter }` + header `Retry-After`. El cliente
> ([`client-page.tsx`](../src/app/client-page.tsx)) muestra aviso amable y reintenta una
> vez si la espera es corta. Verificado por HTTP: 413 en mensaje gigante; 15×200→429 en
> ráfaga; `Retry-After: 59`. Upstash queda documentado como upgrade opcional (no añadido).

```
# Tarea: proteger /api/npc del abuso y del coste descontrolado de la IA

## Contexto
`src/app/api/npc/route.ts` llama a Claude/Gemini con la API key del servidor.
Es un endpoint público (POST con { walletAddress, npcName, message, memory }).
En un demo desplegado en Vercel, cualquiera puede martillearlo y quemar el
presupuesto de la API key — riesgo ya anotado en docs/ENGRAM_PLAN_V2.md.

## Objetivo
Limitar el uso por wallet y global, con degradación elegante (no romper la UX),
sin introducir una base de datos pesada.

## Entregables
  1. Rate limit por walletAddress y por IP: p.ej. máx ~15 mensajes/min y ~200/día.
     - En memoria por instancia basta para el MVP (Map con ventana deslizante);
       documenta que en serverless multi-instancia conviene Upstash Redis / Vercel KV.
       Si añades una dep, que sea @upstash/ratelimit (opcional, gated por env vars
       UPSTASH_REDIS_REST_URL/TOKEN; sin ellas, cae al limitador en memoria).
  2. Validación de tamaño: rechazar message > ~500 chars y bodies enormes (413).
  3. Respuesta 429 con { error, retryAfter } cuando se exceda; el cliente
     (client-page.tsx) muestra un aviso amable y reintenta tras retryAfter.
  4. Cap defensivo de max_tokens ya existe (700); mantenlo. No subir el modelo
     por defecto.

## No rompas
  - El contrato NPCChatRequest/NPCChatResponse ni el flujo de memoria.
  - `npx tsc --noEmit` limpio.

## Criterios de aceptación
  1. Ráfaga de >20 requests/min desde la misma wallet → algunas 429 con retryAfter.
  2. message de 5.000 chars → 413/400, no llega al modelo.
  3. Con las env vars de Upstash ausentes, todo sigue funcionando (limitador local).
```

---

## Prompt 4 — Controles móviles / táctiles

```
# Tarea: hacer Aldenmoor jugable en móvil (el community voting es gente con teléfono)

## Contexto
La exploración FPS en `src/components/engram/Scene3D.tsx` usa PointerLockControls
(ratón) + WASD. En móvil NO hay pointer lock ni teclado, así que hoy el juego es
injugable en teléfono. El componente `Player` lee teclas vía useKeyboardControls.
Referencia del equipo: joystick/botones táctiles en
`C:\Users\aribe\Desktop\Ensayos_programación\Spaces\public\house\main.js`
(setTouchMoveState / setTouchLookState) y el HTML de controles móviles.

## Objetivo
Detectar dispositivos táctiles y ofrecer: joystick de movimiento + arrastre para
mirar + botón "E" de interacción, sin romper el flujo de escritorio.

## Entregables
  1. Detección de touch (pointer: coarse / ontouchstart). En táctil, NO montar
     PointerLockControls; en su lugar, mirar con arrastre de un dedo sobre el canvas
     (actualizar yaw/pitch de la cámara) y mover con un joystick virtual en pantalla.
  2. HUD táctil (overlay HTML, fuera del Canvas): joystick abajo-izquierda, botón
     "E / Hablar" abajo-derecha (visible solo cuando hay un NPC en rango), respetando
     uiOpen (ocultar cuando hay GUI/diálogo).
  3. El `Player` debe aceptar input tanto de teclado como de un estado táctil
     (expón setTouchMove/look o un store ligero). Conserva colisiones, head-bob y
     el height-follow del terreno.
  4. La pista "Click to look around" se reemplaza por la apropiada en táctil.

## No rompas
  - La experiencia de escritorio (mouse-look + WASD) intacta.
  - El fix de pointer lock al abrir GUI (uiOpen) sigue válido en escritorio.
  - `npx tsc --noEmit` limpio.

## Criterios de aceptación
  1. En emulación móvil del navegador: joystick mueve, arrastre mira, botón E habla.
  2. En escritorio nada cambia.
  3. Acercarse a un NPC en móvil muestra el botón E y abre el diálogo.
```

---

## Prompt 5 — Texturas PNG

```
# Tarea: sustituir materiales planos por texturas PNG tileables (low-poly estilizado)

## Contexto
Hoy `src/components/engram/Scene3D.tsx` usa meshStandardMaterial con color sólido
+ flatShading (terreno, casas, troncos, follaje, suelo). Se ve limpio pero plano.
Queremos textura sin perder el estilo low-poly ni el rendimiento (InstancedMesh para
árboles; ver Prompt 2 ya hecho).

## Objetivo
Añadir un set PEQUEÑO de texturas tileables en `public/textures/` y aplicarlas a las
superficies grandes, reutilizando materiales (una textura → un material compartido).

## Entregables
  1. Carpeta `public/textures/` con ~5–7 PNG/WebP **tileables** y ligeros
     (512×512, idealmente .webp, < ~80 KB c/u): grass/terrain, wood (cuerpo casa),
     roof_tile, stone (plinto/chimenea), bark (troncos), foliage (opcional).
     - Pueden ser generadas (IA/seamless) o pintadas a mano; deben repetir sin costura.
  2. Carga con drei `useTexture` (un único objeto compartido), `RepeatWrapping`,
     `repeat` por superficie (p.ej. terreno repeat ~ GROUND_RADIUS/4), `colorSpace`
     SRGB, y `generateMipmaps`. Reutiliza el material entre instancias (useMemo) —
     NO crear una textura por mesh.
  3. Aplica a: terreno (tiling alto), casas (wood + roof_tile + stone), troncos (bark).
     El follaje puede quedarse con color plano o textura sutil. Mantén el InstancedMesh.
  4. Suma todo el peso de texturas: objetivo < ~500 KB en total (CDN de Vercel).

## No rompas
  - El estilo nocturno (que las texturas no se vean "de día"; ajusta color/roughness).
  - FPS: materiales compartidos, sin texturas 4K, sin un material por instancia.
  - `npx tsc --noEmit` limpio y `npm run dev` arranca.

## Criterios de aceptación
  1. Terreno, casas y troncos con textura tileable, sin costuras visibles.
  2. Sin caída de FPS perceptible; peso total de /public/textures < ~500 KB.
  3. La escena sigue leyéndose de noche y coherente con la luna/fogata.
```

---

## Prompt 6 — Audio ambiental

> **🟡 PARTIAL — 18 jun 2026.** Ya existe la infraestructura cliente en
> [`src/context/AudioContext.tsx`](../src/context/AudioContext.tsx) +
> [`src/lib/audio/manifest.ts`](../src/lib/audio/manifest.ts), con fallback silencioso
> si faltan assets. También están cableados los cues de grillos, fogata, pasos,
> salto/caída, hachazo, ataque y UI, y documentados en
> [`AUDIO_ASSETS.md`](AUDIO_ASSETS.md). Lo que sigue pendiente de este prompt es el
> **mute toggle** y volver la fogata realmente **posicional**.

```
# Tarea: ambiente sonoro de Aldenmoor (inmersión barata, gran retorno)

## Contexto
El juego es mudo. Un loop nocturno + crepitar de fogata posicional + pasos suben
mucho la inmersión con muy poco coste. R3F + drei (PositionalAudio) o el WebAudio
nativo. La cámara FPS está en `src/components/engram/Scene3D.tsx`.

## Objetivo
Añadir audio ambiental y posicional, respetando autoplay policies (arranca tras el
primer gesto del usuario — el mismo clic que captura el pointer lock sirve).

## Entregables
  1. Assets en `public/audio/`: night_ambience loop (grillos/viento), fire_crackle
     loop, footstep(s). Ligeros (.mp3/.ogg, mono para los posicionales). < ~1.5 MB total.
  2. Loop de ambiente global (bajo volumen) que arranca al entrar a explorar.
  3. `<PositionalAudio>` de drei en la fogata (volumen cae con la distancia).
  4. Pasos sutiles sincronizados con el head-bob cuando el jugador se mueve.
  5. Un toggle de mute (icono esquina) y respeta uiOpen/diálogo (baja o pausa).

## No rompas
  - Nada de audio antes del primer gesto (sin warnings de autoplay).
  - `npx tsc --noEmit` limpio.

## Criterios de aceptación
  1. Al explorar se oye ambiente; acercarse a la fogata sube el crepitar.
  2. Caminar produce pasos; el botón de mute silencia todo.
  3. Sin errores de autoplay en consola.
```

---

## Prompt 7 — Verificación diferida: UX del 429

```
# Tarea: verificar end-to-end el manejo del 429 en el cliente

## Precondición (NO empezar antes)
Hacer SOLO cuando ya exista un camino barato para ejercitar la UI sin montar
andamiaje nuevo, es decir cuando se cumpla alguna de estas:
  - ✅ Prompt 4 (controles móviles) hecho — ya habrá un arnés/flujo que mueve la UI, o
  - ✅ la app está desplegada (Vercel) y se puede spamear el diálogo en vivo, o
  - ✅ existe un mock reutilizable de wallet + lectura de 0G para tests de UI.
Si nada de eso existe, esta tarea NO vale el coste: el lado servidor del rate limit
(la defensa real de coste/abuso) ya está verificado por HTTP. Ver Prompt 3 (done).

## Contexto
La lógica de servidor (413 / 429 / retryAfter / header Retry-After) ya está
verificada. Lo que falta observar corriendo es solo la UX del cliente en
`src/app/client-page.tsx` → `runTurn()`: ante 429 muestra un aviso amable y hace
UN reintento automático si la espera es corta (≤30s), con guard `activeRef` para
no reintentar si el jugador ya salió del diálogo.

## Objetivo
Confirmar, conduciendo la app real, que el cruce client↔servidor del 429 funciona.

## Pasos
  1. Con la app corriendo y wallet conectada, abre un diálogo y envía >15 mensajes
     en <1 min al mismo NPC para forzar el 429 (o baja temporalmente el límite en
     src/lib/ratelimit.ts para no gastar IA — y revertir después).
  2. Observa: el cuadro muestra "Aldenmoor needs a breath…(retrying in Ns…)" y,
     pasado el retryAfter, reintenta solo una vez.
  3. Repite pero ABANDONA el diálogo (Leave) antes de que dispare el reintento →
     el guard activeRef debe impedir el reintento (no debe reabrir/escribir nada).
  4. Caso de cap diario / espera larga (>30s): debe mostrar "try again in ~Ns" sin
     reintento automático.

## Criterios de aceptación
  1. 429 produce aviso amable + un único reintento automático en cool-downs cortos.
  2. Salir del diálogo cancela el reintento (sin efectos colaterales).
  3. Esperas largas no auto-reintentan.
```

---

## Prompt 8 — Visión: gameplay loop + doble vista

> 🔭 **Roadmap post-MVP, NO para el deadline del 23.** No construir antes del video.
> Esto es una visión por fases, no un prompt único; cada fase puede volverse su propio
> prompt. Origen: queremos una mecánica REAL de ganar monedas (hoy las monedas/“comprar
> información” son solo narrativa del LLM, no un sistema real).

### Principio rector (no negociable)
El diferenciador de Engram es **IA + memoria propiedad del jugador en 0G**. Todo lo que se
construya aquí debe ser **vehículo de esa tesis**, no un clon de Age of Empires:
- **El estado del mundo (lo plantado/construido/explorado) se persiste en 0G, indexado a la
  wallet del jugador** — exactamente como la memoria de los NPCs hoy. Eso lo vuelve
  "real-real" y on-theme: un mundo persistente y propiedad del jugador.
- La IA gobierna la simulación (agentes de naturaleza), no solo el diálogo.
- El token/monedas viene AL FINAL y se ancla a actividad real (ver `docs/ENGRAM_ECONOMY.md`);
  nada de "play-to-earn" hueco.

### Fase 8a — Doble cámara: primera persona ↔ cenital (tipo AoE)  ← empezar por aquí
Quick win, alto valor, bajo riesgo. En `src/components/engram/Scene3D.tsx`:
- Toggle de cámara: la actual **perspectiva en primera persona** ↔ una **ortográfica
  cenital** (RTS) que sobrevuela el terreno (`map.ts` ya da alturas y props).
- En vista cenital: paneo (WASD/drag), zoom (rueda), límites del mundo; sin pointer-lock.
- Objetivo de experiencia: "explora con tu avatar / admira desde el aire lo explorado y lo
  que falta". No romper el flujo de diálogo ni el HUD de primera persona.
- Criterio: alternar vista con una tecla/botón; ambas fluidas a 60 fps; NPCs y props
  visibles en ambas. `tsc` limpio.

### Fase 8b — Construir + recursos, persistido en 0G
> **🟡 MVP implementado — 17 jun 2026.** Ya existe `WorldState` (`inventory` +
> `choppedTrees`) en [`src/lib/world.ts`](../src/lib/world.ts), y ahora también vive dentro
> del `MemoryBundle.world` en 0G. [`src/lib/world-0g.ts`](../src/lib/world-0g.ts) hidrata
> el mundo desde el bundle al conectar wallet y mantiene localStorage como fallback
> instantáneo. [`src/lib/memory.ts`](../src/lib/memory.ts) incluye el mundo actual en cada
> guardado normal de conversación, por lo que no aparece una firma/transacción extra por
> cada árbol talado. Lo que falta para llamar esta fase "completa": construir edificios,
> crecimiento de árboles, economía real y UX clara de "world saved".

- Acciones básicas: **plantar árboles** (semilla → crecimiento con el tiempo) y **talar**
  para obtener **madera**; un inventario simple de recursos.
- Construir estructuras con recursos; si el mapa crece, agrupar en **aldeas**.
- CLAVE: el **estado del mundo del jugador** (árboles plantados, edificios, recursos) se
  serializa y **se guarda en 0G** vía el mismo patrón que la memoria (`/api/save` + bundle
  por wallet). Reusar `src/lib/memory.ts` / `src/app/api/save/route.ts` como modelo.
- Las **monedas** se ganan por actividad real (talar/comerciar/construir), no de la nada.
  Engancha con `debts`/economía ya existente en la memoria de los NPCs.

### Fase 8c — Agentes de naturaleza (IA gobernando la sim)
- **Agente Tierra**: por zona del mapa, dice qué tan rápido crecen los árboles (fertilidad).
- **Agente Fauna**: comportamiento de animales (hostil/neutral), dónde proliferan, etc.
- Reusar el patrón server-side de `/api/npc` (un endpoint por agente que devuelve parámetros
  de la sim). Estos agentes también pueden tener **memoria en 0G** (estado del ecosistema).
- Esto es lo que evita el "se siente como AoE": el mundo está vivo y **dirigido por IA**.

### Fase 8d — Economía/token
- Solo cuando 8a–8c den un juego que la gente quiera jugar. Anclar a actividad real y a la
  reputación persistente. Detalle en `docs/ENGRAM_ECONOMY.md`.

### Recordatorio de alcance
Cada fase es semanas de trabajo. Prioriza **8a** (barato, diferenciador) y mantén la IA +
0G en el centro. No dejes que la parte de "construir/RTS" canibalice lo único que te
distingue: NPCs/mundo con memoria persistente y propiedad del jugador en 0G.

---

## Prompt 9 — Construir + persistir el mundo en 0G

> Concreta la Fase 8b del Prompt 8. Se divide en **9a (gameplay, world-dev)** y
> **9b (persistencia 0G, martelaxe)**. La costura entre ambos ya existe:
> `WorldPersistence` en [`src/lib/world.ts`](../src/lib/world.ts). Valor para el torneo:
> un **segundo uso real de 0G** — no solo la memoria de NPCs, sino el **mundo construido
> del jugador**, indexado a su wallet, auditable, que nadie puede borrar.

### Modelo de datos compartido (acordar primero)
Extender `WorldState` en `world.ts` con los edificios colocados:
```ts
export type BuildingType = 'wall' | 'house';
export interface Building { type: BuildingType; x: number; z: number; rot: number }
export interface WorldState {
  inventory: Record<ResourceType, number>;
  choppedTrees: number[];
  buildings: Building[];   // ← nuevo
}
```
Acciones en el store: `placeBuilding(b, cost)` (descuenta `cost` madera),
`removeBuilding(i)` (demoler, reembolsa la mitad). `buildings` se persiste vía la MISMA
costura `WorldPersistence` (no cambia el contrato load/save).

### Zonas y precios (acordado, ✅ implementado en gameplay)
Para que nadie "ensucie" el centro y se formen **sub-aldeas** afuera:
- **Núcleo protegido `r < 12`: NO se puede construir** (plaza, fogata, NPCs, casas).
- **Precio por cercanía:** `costo = base × mult`, con `mult = clamp(6 − (d−12)·5/33, 1, 6)`
  → **6×** pegado al núcleo, **1×** en `d ≥ 45`. Base: muro **3**, casa **10**.
- `MAX_WOOD = 100` (para aguantar builds caros del centro y la IA del Prompt 11).
- Implementado en `canPlaceBuilding` / `buildCostAt` (Scene3D); el costo se pasa a
  `placeBuilding(b, cost)`. La persistencia no cambia (sólo guarda type/x/z/rot).

### 9a — Gameplay de colocación (world-dev) — ✅ done (+ zonas/precios)
- **Modo construir** (tecla B o botón), idealmente en **vista aérea** (ya existe).
- **Preview fantasma** del edificio bajo el cursor/avatar (semitransparente, verde si
  cabe / rojo si choca con colliders o no hay madera). Snap a una grilla simple.
- **Clic = colocar** → `placeBuilding` (descuenta madera del inventario, tope MAX_WOOD).
- Renderizar `world.buildings` (reusar geometrías de `Cottage`/cajas para muros) y
  **añadir sus colliders** al set que usa `resolveCollision` (de una sola fuente).
- **Demoler**: apuntar a un edificio + acción → `removeBuilding` (devuelve algo de madera).
- No romper diálogo/memoria/combate. `tsc --noEmit` + `next build` deben pasar.

### 9b — Persistencia en 0G (martelaxe) — ✅ MVP listo
Ya existe un `WorldPersistence` respaldado por 0G en
[`src/lib/world-0g.ts`](../src/lib/world-0g.ts), registrado con
`setWorldPersistence(...)`: carga `MemoryBundle.world` desde el root del registry y
usa localStorage como fallback instantáneo. [`src/lib/memory.ts`](../src/lib/memory.ts)
expone `writeWorldState(...)`, que sube el bundle actualizado a 0G y ancla el nuevo root.

Las acciones de construir/demoler son **drafts locales**. En vista aérea, el jugador debe
clickear **Save World** para subir el `WorldState` actual a 0G y anclar el root en
`EngramRegistry`. Si no publica, otros wallets no ven esos edificios. Chopping/recolección
simple queda local hasta publicar mundo.

### Criterios de aceptación
1. Construir un muro/casa descuenta madera y aparece en el mundo con colisión.
2. Demoler lo quita (y persiste el cambio).
3. Con `WorldPersistence` de 0G activo: construir → recargar/otro dispositivo → el mundo
   construido se recupera desde 0G.
4. Sin 0G configurado, todo funciona en local (localStorage). `tsc` limpio.

---

## Prompt 10 — Mercado: vender recursos → reputación

> **✅ v1 DONE — 18 jun 2026.** Aldric ya ofrece una venta simple de madera dentro
> del diálogo: muestra precio fijo, cantidad, monedas actuales y reputación/trust.
> La venta modifica el inventario local del jugador y añade una interacción directa
> a la memoria de Aldric, que se persiste con **Leave & save** como el resto de su
> historial. Queda pendiente solo la **v2 opcional** de regateo con LLM/precios
> negociados.

> El gancho del proyecto: que el **gameplay alimente la memoria/reputación en 0G**.
> Vender al comerciante (Aldric) y regatear cambia tu reputación, que ya vive en 0G.
> No es infraestructura nueva — se apoya en el sistema de memoria de NPCs existente.

### Objetivo
Cerrar el loop **talar → vender a Aldric → cambia tu reputación (0G) → cambian
precios/diálogo**. Empezar simple; el regateo con LLM es v2.

### v1 — Venta simple (gameplay)
- Acércate a **Aldric** → opción **"Vender madera"** (junto a hablar).
- UI mínima: cantidad a vender + precio fijo por unidad → recibes `coin`, pierdes `wood`
  (usar `addResource` en [`world.ts`](../src/lib/world.ts)).
- La venta **registra una interacción en la memoria de Aldric** (reusar el flujo de
  `/api/npc` / la memoria): vender justo/seguido sube `trust`; nada de precios aún.
- Mostrar precio y reputación actual; al subir trust, Aldric saluda mejor (ya lo hace).

### v2 — Regateo / negociación (LLM) — opcional, alto impacto demo
- El jugador **propone un precio**; el LLM de Aldric responde en personaje:
  - precio abusivo → "scammer", `trust` ↓, puede rechazar.
  - precio justo/bajo → acepta, `trust` ↑.
- Reusar `/api/npc`: mandar la oferta como `message` con contexto de "negociación de
  venta de X madera"; el modelo devuelve aceptar/rechazar + delta de trust (ya existe el
  contrato de `memory_update`). El precio acordado define los `coin` recibidos.

### Ídem para otros NPCs (futuro)
- Matar enemigos / defender la aldea → sube reputación con **Maren** (la guardia), que
  ya "rastrea tu historial de combate" → puede protegerte. Mismo patrón: la acción
  registra una interacción en su memoria 0G.
- El paso siguiente del mercado es que Aldric también **venda** cosas reales al jugador
  (herramientas, semillas, repair kits, antorchas, etc.) para que la moneda no sea solo
  un marcador sino un recurso con sinks claros. Ver Prompt 14.

### No rompas
- El flujo de diálogo/memoria existente ni el guardado a 0G. `tsc --noEmit` limpio.

### Criterios de aceptación
1. Vender madera a Aldric da coins, descuenta madera, y sube su `trust` (visible en 📜 Memory).
2. Al recargar, Aldric recuerda la venta (persistido en 0G como cualquier interacción).
3. (v2) Regatear caro → el modelo te trata de tramposo y baja trust.

---

## Prompt 11 — Construcción con IA + tokens

> **✅ REFINADO — 18 jun 2026.** Los bloques voxel del modo IA quedaron más finos y
> consistentes: el endpoint ya cuantiza offsets/alturas/escalas a una grilla pequeña,
> el cliente normaliza esos bloques al mismo grid y evita que se superpongan entre sí.
> Se permiten cubos adyacentes al ras, pero no uno dentro de otro, para que las
> formas salgan más limpias y menos “Minecraft tosco”.

> Idea de AriiBen: el jugador **describe** lo que quiere construir en un chat, y la IA
> lo edifica. La **cantidad de tokens** que gasta determina lo elaborado/grande del
> resultado (igual que el diálogo: pocos tokens → menos detalle; aquí además acota el
> **tamaño**). Reusa la misma infraestructura LLM que `/api/npc`. Encaja con Prompt 9
> (sistema de construcción) y Prompt 10 (economía/tokens).

### Modelo (acordado 18 jun)
- El costo se paga en **madera**: cuanto más elaborada la estructura (más piezas/tokens),
  **más madera** cuesta. `MAX_WOOD = 100` (ya subido). El costo de cada pieza usa
  `buildCostAt(type,x,z)` (ya existe): **respeta el núcleo no-construible (r<12) y el
  precio por cercanía** del Prompt 9.
- "Más tokens → más unidades": el tamaño/detalle del resultado lo acota directamente el
  **cap de `max_tokens`** de la respuesta del modelo.

### Control de costo de la Anthropic key (acordado: **ambos**)
- **Cap server-side:** en `/api/build`, fija un `max_tokens` bajo (p.ej. ~1000–1200) y
  reúsa el **rate-limit** de `/api/npc`. Esto acota tanto el tamaño de lo construido como
  el gasto contra la key del proyecto.
- **BYO key:** permite que el usuario pegue **su propia** Anthropic key (guardada solo en
  su navegador, enviada a `/api/build`); si no la pone, usa la del proyecto (capada).

### Endpoint `/api/build` (server, igual patrón que /api/npc)
- Input: `{ prompt: string, origin: {x,z}, apiKey?: string }`.
- El LLM devuelve **JSON estructurado** validado: `Building[]` (type/x/z/rot) relativo a
  `origin`. Mismas defensas que `/api/npc` (rate-limit, tamaño, fallback determinista).
- Aplicar en cliente: por cada pieza, `canPlaceBuilding` (núcleo/colisiones) y
  `placeBuilding(b, buildCostAt(...))`; salta piezas inválidas o si no alcanza la madera.
  Persiste en 0G por la costura existente.

### UI
- En modo construir (vista aérea): botón **"🤖 Build with AI"** → input de texto (+ campo
  opcional para la API key del usuario). Muestra el **preview + costo total en madera**
  antes de confirmar.

### Criterios
1. Describir "una pequeña empalizada con dos casas" gasta madera y aparece construido
   (fuera del núcleo; más caro cerca del centro).
2. El `max_tokens` acota el tamaño; con poco presupuesto la estructura es más simple.
3. Con BYO key, las peticiones usan la key del usuario. `tsc` limpio; no rompe el build
   manual (Prompt 9) ni el diálogo.

---

## Prompt 12 — Edificios habitables (entrar)

> **✅ DONE — 18 jun 2026.** Las `house` construidas por el jugador ya son huecas en la
> misma escena: se renderizan como paredes finas + techo, con hueco de puerta libre.
> La colisión usa la envolvente de esos muros en vez de un disco sólido, así que se
> puede entrar y caminar dentro sin atravesar paredes.

> Idea de AriiBen: poder **entrar** a los edificios, no que sean props sólidos.
> **Recomendación (baja complejidad):** hacer las casas **huecas** — 4 muros + techo +
> un **hueco de puerta** — en la MISMA escena, para caminar dentro sin teleport ni
> escenas de interior. Evita complejidad innecesaria.

### Enfoque recomendado (in-place, sin cambiar de escena)
- Reemplazar la caja sólida de `house` por **paredes** (4 cajas finas) con un **gap de
  puerta** en una cara, **suelo** y **techo a dos aguas** (ya tenemos el gable).
- Colisión: en vez de un círculo, usar los muros como colliders (segmentos/AABB) con el
  gap libre. Mantener el collider de pared del Prompt 9 para los muros sueltos.
- El jugador entra por el hueco; dentro queda resguardado (útil si más tarde los enemigos
  asedian la aldea).

### Alternativa (más trabajo, NO recomendada para el plazo)
- Interiores como escena/zona aparte con trigger de puerta y teleport. Mejor estética pero
  añade gestión de estado/escenas; dejarlo post-torneo.

### Criterios
1. Entrar a una casa por la puerta y moverse dentro sin atravesar paredes.
2. El techo no bloquea la cámara en primera persona de forma molesta (subir un poco o
   recortar al entrar).
3. `tsc` limpio.

---

## Prompt 13 — Relaciones entre players: aliados, enemigos y sabotaje

> Nueva línea de diseño social: que los jugadores puedan declararse **aliados** o
> **enemigos**, y que eso abra juego emergente real sobre el mundo persistente
> guardado en 0G. La idea detonadora: permitir que un enemigo pueda **demoler o
> saquear** parte de lo construido por otro player para obtener recursos, mientras
> los aliados tengan protecciones o permisos compartidos.

### Objetivo
Modelar relaciones explícitas entre wallets para que el mundo persistente no sea
solo “mi aldea privada”, sino un espacio social con cooperación, protección y
conflicto controlado.

### Primera versión a explorar
- Añadir una relación por wallet: `neutral | allied | hostile`.
- UI mínima para marcar a otro player como aliado o enemigo desde el overlay del
  mundo público o una lista de wallets encontradas.
- **Aliados**:
  - pueden recibir permisos futuros sobre construcción/reparación compartida;
  - podrían quedar excluidos de trampas o de fuego amigo.
- **Enemigos**:
  - pueden habilitar mecánicas futuras de raid/sabotaje;
  - ejemplo inicial: demoler parcialmente edificios del rival y recuperar solo una
    fracción de la madera, nunca tokens.

### Restricciones / fairness
- No permitir griefing irreversible offline desde el día 1.
- Si existe sabotaje, debe ir acompañado de límites: ventanas horarias, costo,
  enfriamientos, daño lento o necesidad de presencia sostenida.
- Todo vínculo ally/enemy debe persistirse de forma portable (idealmente en el
  mismo bundle o en un índice claro por wallet).

### Preguntas abiertas
- ¿La relación debe ser unilateral o mutua?
- ¿Puede alguien atacar sin “declarar enemistad” primero?
- ¿Qué ve el jugador víctima en el replay/log de daños?
- ¿Cómo se integra con el sistema futuro de NPC trust, guardias y mercado?

### Criterios de aceptación (cuando se implemente)
1. Un player puede marcar a otro como aliado o enemigo y esa relación persiste.
2. El mundo/UI refleja esa relación con feedback claro.
3. Las futuras acciones de sabotaje o cooperación respetan esa relación y quedan auditables.

---

## Prompt 14 — Mercado v2: bienes comprables, sinks y reparación

> La moneda ya existe y Aldric ya compra madera, pero aún falta el lado importante
> del loop: **gastar** esa moneda en algo que cambie el gameplay.

### Objetivo
Convertir a Aldric en un mercado útil, no solo en un comprador. La idea es que los
players puedan comprar herramientas, consumibles y utilidades que a su vez alimenten
construcción, defensa y exploración.

### Primera lista de bienes a evaluar
- **Repair kit** para reparar edificios dañados.
- **Seeds / saplings** para replantar árboles o acelerar regeneración.
- **Torch kit / lantern oil** para iluminación decorativa o defensiva.
- **Better axe / tool upgrades** para talar más rápido o cargar más.
- **Building dyes / material skins** para personalizar bloques y casas.
- **Bridge / stair kits** si el terreno evoluciona a verticalidad real.

### Restricciones
- Nada de power creep tonto: que los objetos abran decisiones, no solo números.
- Mantener simple la primera versión: compra determinista, stock infinito o un stock
  diario pequeño; no hace falta economía dinámica aún.

### Criterios de aceptación (cuando se implemente)
1. El jugador puede comprar al menos 2 bienes reales con coin.
2. Esos bienes alteran gameplay o mantenimiento de la aldea.
3. El gasto queda visible y coherente con la reputación/mercado de Aldric.

---

## Prompt 15 — Asedios y demonios con fairness offline

> Henrique quiere que los demonios puedan atacar edificios, pero eso requiere una
> capa de fairness: no es justo que alguien pierda trabajo offline por completo.

### Objetivo
Diseñar ataques de demonios que añadan tensión sin destruir la confianza del jugador
en el mundo persistente.

### Reglas a explorar
- Los demonios **no aparecen** en ciertas horas o ventanas del día.
- El daño a edificios es **lento y reducido**, no explosivo.
- Debe haber tiempo para responder: telegraph visual/sonoro, asedio gradual.
- El edificio no se borra de golpe: pasa por estados `healthy → damaged → critical`.
- Offline, el daño máximo por ventana queda capado.

### Posibles compensaciones
- Maren o guardias NPC podrían mitigar parte del daño si tu reputación con ella es alta.
- Los repair kits del mercado (Prompt 14) pueden cerrar el loop.
- Aliados podrían ayudar a defender o reparar.

### Criterios de aceptación (cuando se implemente)
1. Los demonios pueden dañar edificios sin borrar una aldea entera de una sola pasada.
2. El sistema respeta ventanas y límites claros para players offline.
3. El daño queda registrado y el jugador entiende qué pasó.

---

## Prompt 16 — Animaciones de gathering y feedback físico

> Falta dar más cuerpo a las acciones del jugador. La más evidente ahora mismo es la
> tala: existe la mecánica, pero no la animación/impacto visual suficiente.

### Objetivo
Hacer que gathering y combate se sientan físicos y legibles con animaciones baratas
pero expresivas.

### Tareas candidatas
- **Animación de tala**: balanceo del hacha/brazo, recoil, wood chips, shake del árbol.
- **Telegraph de impacto** en enemigos: hit flash, knockback corto, polvo.
- **Feedback de construcción/demolición**: ghost más vivo, partículas de escombro, pickup de refund.
- **Paso por superficie**: variar audio/FX según tierra/pasto/madera si luego hay más biomas.

### Criterios de aceptación (cuando se implemente)
1. Talar deja de sentirse como una barra abstracta y pasa a sentirse como un golpe real.
2. Construcción/demolición muestran feedback claro y satisfactorio.
3. Todo sigue ligero y compatible con móvil.

---

## Prompt 17 — Terreno editable, ríos y mapa más grande

> El terreno actual funciona y se ve bien para MVP, pero hoy es una fórmula
> matemática continua. Falta decidir si ese será el camino definitivo o si el juego
> debe migrar a un terreno más “autorable” y eventualmente editable.

### Objetivo
Tomar una decisión técnica/visual sobre el futuro del terreno antes de seguir
encima de una base que luego haya que rehacer.

### Opciones a evaluar
- **Seguir con height function**: barato, bonito, continuo, poco editable a mano.
- **Migrar a terrain grid editable**: permite valles/crestas diseñados, caminos,
  terrazas, escalones y eventualmente edición por tools o IA.

### Extras a estudiar
- **Ríos** como capa de navegación/bioma.
- **Mapa más grande** o por chunks, apoyado en 0G para persistencia.
- **Sub-áreas escalables**: colinas, barrancos, puentes, entradas a zonas nuevas.
- **Compatibilidad con construcción**: cómo se anclan casas, muros y bloques al nuevo relieve.

### Criterios de aceptación (cuando se implemente o decida)
1. Queda elegida una dirección clara para el sistema de terreno.
2. Si hay spike/prototipo, muestra al menos una ventaja concreta frente al sistema actual.
3. La decisión considera móvil, performance y persistencia del mundo.

---

## Prompt 18 — Reparación, durabilidad y mantenimiento del mundo

> Si habrá demonios, sabotaje entre enemigos o simplemente desgaste, hace falta una
> mecánica de mantenimiento del mundo. También abre espacio para coin sinks y trabajo cooperativo.

### Objetivo
Introducir una capa ligera de durabilidad/reparación para edificios sin volver el
juego un simulador de chores.

### Primera versión deseable
- Cada building puede tener `hp/maxHp` o `condition`.
- Daño parcial reduce condición, no borra de inmediato.
- El jugador puede **repair** usando madera, coin o kits.
- El estado visual cambia con daño ligero/medio/fuerte.

### Cómo conecta con otros sistemas
- Mercado vende repair kits (Prompt 14).
- Demonios dañan lentamente (Prompt 15).
- Aliados pueden ayudar a reparar; enemigos podrían sabotear (Prompt 13).
- El mundo persistente guarda la condición de los edificios junto con el resto del bundle.

### Criterios de aceptación (cuando se implemente)
1. Un edificio puede dañarse y luego repararse.
2. El costo de reparación es menor que reconstruir desde cero, pero no gratis.
3. El estado dañado/reparado persiste correctamente.

---

*Engram — Zero Cup 2026 — Build on 0G. Own your story.*
