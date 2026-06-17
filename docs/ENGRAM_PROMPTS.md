# Engram — Prompt Log (tareas pendientes)

> Bitácora de prompts de tareas para pasar a la IA (Claude Code / colaboradores).
> El Zero Cup premia el *vibe coding* con prompts; este archivo es a la vez el
> backlog y la evidencia de cómo se construyó cada pieza.
>
> Cada prompt es **autocontenido**: asume una IA que abre el repo en frío, así que
> incluye contexto, archivos relevantes, restricciones y criterios de aceptación.

**Repo:** `engram` — Next.js 15.1.5 + TypeScript · 0G Storage (Galileo testnet, chain `16602`) · ethers v6 · wagmi · Three.js / @react-three/fiber / @react-three/drei.

Índice:
1. [On-chain rootHash registry (memoria cross-device / cross-game)](#prompt-1--on-chain-roothash-registry) — ⏳ pendiente
2. [World pass: terreno con alturas, cielo, casas, árboles y avatares](#prompt-2--world-pass-terreno-cielo-y-props) — ✅ done
3. [Protección de coste/abuso en /api/npc (rate limit)](#prompt-3--rate-limit--anti-abuso-en-apinpc) — ⏳ pendiente
4. [Controles móviles / táctiles (sin pointer lock)](#prompt-4--controles-móviles--táctiles) — ⏳ pendiente
5. [Texturas PNG en lugar de materiales planos](#prompt-5--texturas-png) — ⏳ pendiente
6. [Audio ambiental (fogata, pasos, noche)](#prompt-6--audio-ambiental) — ⏳ pendiente

> **Tareas no-código pendientes (ADMIN):** deploy a Vercel + env vars (en curso) ·
> grabar video demo (2–3 min) · completar submission en 0g.ai/arena/zero-cup ·
> post en X con `#TheZeroCup` y `@0G_labs`.

---

## Prompt 1 — On-chain rootHash registry

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
   - `writeRootOnchain(wallet, root): Promise<{ txHash: string }>`
     usa BrowserProvider+signer (reutiliza getProvider/getSigner de src/lib/0g/fees.ts)
     y llama registry.setRoot(root). Esto dispara MetaMask.
   - Address del registry desde env: NEXT_PUBLIC_ENGRAM_REGISTRY (documéntala en .env.example).

### 3) Integración en `src/lib/memory.ts` (sin romper la API pública)
   - getBundleRoot/readBundle: primero intenta registry (readRootOnchain); si falla
     o no hay address, cae al caché localStorage. Cachea en localStorage el root que
     venga de la cadena para lecturas instantáneas posteriores.
   - writeMemory: tras el upload exitoso a 0G y setBundleRoot(local), llama
     writeRootOnchain(wallet, rootHash) SOLO si el root cambió respecto al último
     conocido (evita una tx redundante). Devuelve también `registryTxHash?` en
     WriteResult. Si la escritura al registro falla, NO tires el guardado: la memoria
     ya está en 0G; loggea un warning y deja el caché local como respaldo.

## Restricción crítica (léela)
El lema del proyecto es "1 firma de MetaMask por conversación". Añadir el registro
implica una 2ª tx por guardado. Mitigaciones que DEBES implementar:
  - escribir a la cadena solo cuando el rootHash realmente cambió;
  - el orden es: subir bundle a 0G (firma 1) → setRoot (firma 2);
  - mantener localStorage como caché/fallback para que la app siga usable aunque el
    registro no esté configurado (NEXT_PUBLIC_ENGRAM_REGISTRY vacío → comportamiento actual).
Documenta en un comentario el camino futuro de "1 sola firma" (relayer/meta-tx o
escribir el root en el mismo flujo de storage) — no lo implementes ahora.

## No rompas
  - La firma de readMemory/readAllMemories/writeMemory que consume src/app/client-page.tsx.
  - El modelo de bundle único y el flujo de upload probado en src/lib/0g/*.
  - El typecheck: `npx tsc --noEmit` debe pasar.

## Criterios de aceptación
  1. Conectar wallet en un navegador, hablar con un NPC, guardar → setRoot emite RootUpdated
     (verificable en chainscan-galileo.0g.ai).
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

*Engram — Zero Cup 2026 — Build on 0G. Own your story.*
