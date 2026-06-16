# Engram — Prompt Log (tareas pendientes)

> Bitácora de prompts de tareas para pasar a la IA (Claude Code / colaboradores).
> El Zero Cup premia el *vibe coding* con prompts; este archivo es a la vez el
> backlog y la evidencia de cómo se construyó cada pieza.
>
> Cada prompt es **autocontenido**: asume una IA que abre el repo en frío, así que
> incluye contexto, archivos relevantes, restricciones y criterios de aceptación.

**Repo:** `engram` — Next.js 15.1.5 + TypeScript · 0G Storage (Galileo testnet, chain `16602`) · ethers v6 · wagmi · Three.js / @react-three/fiber / @react-three/drei.

Índice:
1. [On-chain rootHash registry (memoria cross-device / cross-game)](#prompt-1--on-chain-roothash-registry)
2. [World pass: terreno con alturas, cielo, casas, árboles y avatares](#prompt-2--world-pass-terreno-cielo-y-props)

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

*Engram — Zero Cup 2026 — Build on 0G. Own your story.*
