# ENGRAM — Plan v2 (estado actual)

### Persistent AI Characters on 0G
*Zero Cup — Submission & Action Plan — actualizado 16 de junio, 2026*

> "The first game where NPCs truly remember you — and no one can make them forget."

| | |
|---|---|
| Deadline de submission (Grupo) | 23 de junio, 2026 |
| Prize pool | $17,000 USD |
| Premio máximo | $8,500 USD (campeón) |
| Base de código | `0g-storage-web-starter-kit` (adaptado) |
| Stack confirmado | Next.js 15 + TypeScript + wagmi + 0G Storage SDK + Three.js |

> Este documento (v2) refleja **lo que realmente está construido**. El plan original (`ENGRAM_PLAN.md`) asumía desarrollo dentro de 0G Studio con prompts; el camino real fue clonar el Storage Web Starter Kit y construir con Claude Code sobre testnet gratuito.

---

## 1. Submission

**Project Name:** Engram
**Tagline:** The first game where NPCs truly remember you — and no one can make them forget.
**Category:** AI-native game on 0G — onchain gaming with AI components.

**The Solution:** demo RPG interactivo en el browser donde cada NPC tiene memoria persistente almacenada en 0G Storage. La memoria incluye nivel de confianza, historial de interacciones, estado emocional y deudas. Tu wallet es tu identidad; los datos en 0G son auditables y ningún reset, patch o desarrollador puede borrarlos.

**Demo — La Aldea de Aldenmoor:**

| NPC | Rol | Comportamiento de memoria |
|---|---|---|
| Aldric | Mercader | Recuerda si pagaste bien o regateaste. Leal → descuentos. Tramposo → precios altos. |
| Maren | Capitana de la guardia | Rastrea tu historial de combate. Puede advertirte o dejarte caminar a una trampa. |
| Sable | Broker de información | Agrega lo que los otros NPCs saben de ti. Se puede sobornar — o ya te vendió. |

---

## 2. Tech Stack (estado actual)

| Tecnología | Rol | Estado |
|---|---|---|
| 0G Storage Network | Núcleo — guarda/lee la memoria por wallet address (loop verificado end-to-end) | ✅ Funcionando en testnet |
| `@0gfoundation/0g-storage-ts-sdk` | SDK TypeScript de 0G (el paquete se movió 2 veces; ver STATUS.md) | ✅ Instalado y funcionando |
| Next.js 15.1.5 + TypeScript | Frontend + API routes | ✅ Corriendo |
| wagmi + `@web3modal/wagmi` | Wallet connection (identidad del jugador) | ✅ Funcionando |
| Claude API (`@anthropic-ai/sdk`) | Motor de IA de los NPCs (proveedor primario) | ✅ Integrado |
| Gemini (`@google/generative-ai`) | Motor de IA alterno — free tier para colaboradores | ✅ Integrado (fallback) |
| **Three.js (0.169)** | Render 3D de Aldenmoor | ✅ **Instalado y funcionando** |
| **`@react-three/fiber` (9.6.1)** | React renderer para Three.js | ✅ **Instalado y funcionando** |
| **`@react-three/drei` (10.7.7)** | Helpers 3D (PointerLockControls, KeyboardControls, Stars, Html…) | ✅ **Instalado y funcionando** |
| TailwindCSS | Estilos / overlays HUD | ✅ Instalado |
| Vercel | Deploy (auto-deploy en cada push a `main`) | ✅ Desplegado (engram-bay.vercel.app) |

**Render actual:** Aldenmoor es una escena 3D low-poly nocturna. Una vez conectada la wallet, la cámara es **primera persona explorable** (ratón para mirar con PointerLockControls, WASD para caminar, colisiones contra casas/árboles/fogata, prompt de proximidad "Press E to speak"). La pantalla de título mantiene una cámara cinemática.

---

## 3. Decisiones de arquitectura tomadas

### 3.1 — Bundle único de memoria por wallet (no un archivo por NPC)
Toda la memoria de Aldenmoor para una wallet vive en **un solo documento JSON** — el `MemoryBundle { version, wallet, npcs: { aldric, maren, sable }, updatedAt }` — almacenado en 0G Storage.

- **Razón:** una sola subida por guardado = **una sola escritura a 0G por conversación** en vez de 2–3 (una por NPC).
- **Beneficio extra:** Sable puede leer la memoria de los otros NPCs **gratis**, porque está en el mismo documento (no requiere lecturas adicionales).
- 0G es content-addressed: para releer el bundle hace falta su `rootHash`. Ese puntero de 32 bytes se cachea en `localStorage` (`engram:bundleRoot:{wallet}`). **Solo el puntero es local** — la data vive entera en 0G y es auditable por su rootHash.
- *Siguiente paso documentado:* reemplazar el caché del puntero por un registro on-chain / 0G-KV para recall real cross-device.
- Implementado en [`src/lib/memory.ts`](../src/lib/memory.ts).

### 3.2 — Lecturas en el cliente; escrituras server-side patrocinadas (`/api/save`)
El SDK de storage de 0G **no funciona en el navegador** (los nodos/indexer no mandan
cabeceras CORS). Por eso:

- **Lectura** (cliente): `GET {storageRpc}/file?root=…` sí permite CORS → `src/lib/memory.ts`
  baja el bundle directo en el browser.
- **Escritura** (servidor): al salir del diálogo, el cliente arma el bundle completo y lo
  **POSTea a [`/api/save`](../src/app/api/save/route.ts)**, que sube a 0G en Node (sin CORS)
  con una **wallet patrocinadora** (`ENGRAM_SPONSOR_KEY`) y devuelve `{ rootHash, txHash }`.
- **Modelo de pago:** el servidor patrocina el fee de storage para el demo. La memoria sigue
  **indexada por la wallet del jugador** y direccionada por contenido en 0G (auditable). El
  jugador **no firma** la escritura — *no* es "1 firma de MetaMask" (eso quedó obsoleto).
- [`/api/npc`](../src/app/api/npc/route.ts) **solo llama al modelo de IA** y devuelve el turno
  + la memoria actualizada; **no escribe a 0G**. Las API keys viven solo en el servidor.
- *Por qué patrocinado:* mover la firma al jugador exigiría que el SDK corriera en el browser
  (imposible por CORS) o partir submit+upload entre cliente y servidor (frágil). Ver gotchas
  en [`docs/STATUS.md`](STATUS.md).

### 3.3 — Soporte multi-proveedor de IA con fallback automático
Selección de proveedor por prioridad en [`route.ts`](../src/app/api/npc/route.ts):

1. **`ANTHROPIC_API_KEY`** → Claude (`claude-sonnet-4-6`, configurable vía `ENGRAM_MODEL`)
2. **`GOOGLE_API_KEY`** → Gemini (`gemini-1.5-flash`, free tier, configurable vía `ENGRAM_GEMINI_MODEL`)
3. **Ninguna** → fallback determinista hardcodeado (texto en personaje) para que la UI sea jugable sin ninguna key

El system prompt y el contrato de respuesta JSON son idénticos para ambos modelos; solo cambia el cliente. Esto permite a colaboradores correr el demo gratis con Gemini.

---

## 4. Tournament Rules (oficiales — Zero Cup)

### Criterios de submission
| # | Criterio | Cómo lo cumple Engram |
|---|---|---|
| 01 | Build AI-native en 0G | 0G Storage es la única fuente de verdad de la memoria. Sin 0G, la app no funciona. |
| 02 | Vibe coding | Construido con prompts (Claude Code) sobre Next.js/TypeScript. |
| 03 | Trabajo original, Jun 15+ | Proyecto nuevo creado durante el torneo. Librerías open-source permitidas. |
| 04 | Repo público + demo funcional | Repo público desde el día 1; demo en vivo o video del flujo completo. |
| 05 | Snapshots por deadline | Cada corte congela el repo. Lo que cuenta es algo funcional en cada fecha. |
| 06 | Mejorar y resubmitir | Entre rondas el proyecto se desbloquea; iterar es la estrategia. |
| 07 | Un equipo, un proyecto | Proyecto individual — un builder, un proyecto. |
| 08 | Sin trampa | Demo real, repo siempre público, sin bots en el community vote. |

### Reglas clave
- **Repo público en GitHub obligatorio desde el día 1.** El snapshot en cada deadline es lo que se juzga.
- **Post obligatorio en X** con `#TheZeroCup` y mención a `@0G_labs`, con link al proyecto.
- **0G debe hacer trabajo real** en la app (no decorativo). Si se quita 0G, la app debe dejar de funcionar.
- **Community voting sin bots** — votos manipulados descalifican.

### Calendario y premios
| Fecha | Milestone | Estado |
|---|---|---|
| Jun 15 | Inicio del torneo · stack funcionando + upload a 0G confirmado | ✅ HECHO |
| Jun 23 | **DEADLINE Grupo** — MVP mínimo funcional | Corte 1 |
| Jun 27 | Top 32 anunciados | Fase 1 |
| Jun 28 | DEADLINE Ronda de 32 — mejorar y resubmitir | Corte 2 |
| Jul 3 | Top 16 anunciados | Fase 2 |
| Jul 4 | DEADLINE Ronda de 16 — última ronda juzgada | Corte 3 |
| Jul 7 | Top 8 — inicia community voting | Fase 3 |
| Jul 8 | DEADLINE FINAL — último push al repo | Lock final |
| Jul 8–10 | Community voting — Cuartos ($500 garantizados) | $500 |
| Jul 11 | Top 4 | Cuartos |
| Jul 12–14 | Community voting — Semis (+$1,000) | +$1,000 |
| Jul 15 | Top 2 | Semis |
| Jul 16–18 | Community voting — Final (+$2,000) | +$2,000 |
| Jul 19 | Campeón coronado (+$5,000 grand prize · total $8,500) | Campeón |

---

## 5. Sprint de desarrollo

### Día 1 | Jun 15 — Setup ✅ COMPLETADO
Lo que realmente se hizo (divergió del plan original de "0G Studio"):

- ✅ Descubierto que **0G Studio (app.0g.ai) requiere tokens OG reales en mainnet** — no es gratuito. Se descartó.
- ✅ Elegida la ruta correcta: **`0g-storage-web-starter-kit`** clonado de GitHub + código propio, corre en testnet gratuito.
- ✅ Framework confirmado: **Next.js 15.1.5**.
- ✅ Resuelto el conflicto de config del starter kit: `src/config/wagmi.ts` debe reexportar desde `src/config/index.ts`, no definir config propia.
- ✅ **Chain ID correcto: `16602`** (OG-Galileo-Testnet) — no 16600/16601 como dice parte de la documentación.
- ✅ Faucet `faucet.0g.ai` (0.5 OG por wallet / 24 h) — suficiente para múltiples transacciones de testnet.
- ✅ **Upload a 0G Storage confirmado** en testnet (tx `0xe27c7468…ee502`; root hash `0x9fcbda0228…e6486c`).
- ✅ Aclarado que el warning **"Fee calculation error: BAD_DATA"** no impide el upload (el SDK reintenta con gas más alto).
- ✅ WalletConnect: Project ID obtenido (`NEXT_PUBLIC_PROJECT_ID`), plan Starter gratuito.
- ✅ `.env.local` configurado con RPCs, flow/storage addresses y explorer de Galileo testnet.
- ✅ Definido el JSON schema de memoria NPC.

### Día 2 | Jun 16 — Estructura base + 3D 🔄 EN CURSO
- ✅ Limpieza del starter kit (fuera UI de upload/download) y estructura de Engram.
- ✅ `types.ts`, `memory.ts` (bundle único), `npcs.ts`, `api/npc/route.ts`.
- ✅ Multi-proveedor de IA (Claude → Gemini → fallback).
- ✅ Escena 3D de Aldenmoor con Three.js / R3F / drei.
- ✅ Cámara primera persona explorable (WASD + mouse-look + colisiones + prompt "Press E").

### Días 3–8 (restantes)
| Día | Fecha | Objetivo |
|---|---|---|
| Día 3 | Jun 17 | Pulir loop de memoria end-to-end; recall cross-device (registro de rootHash) |
| Día 4 | Jun 18 | Afinar personalidades/prompts de Aldric, Maren y Sable |
| Día 5 | Jun 19 | UI/UX: panel de memoria, retratos, feedback de guardado en 0G |
| Día 6 | Jun 20 | Testing end-to-end + buffer |
| Día 7 | Jun 21 | Deploy en Vercel + verificar con wallet real |
| Día 8 | Jun 22–23 | Video demo + submission + post en X |

---

## 6. Estructura del proyecto (actual)

```
src/
├── app/
│   ├── client-page.tsx          # UI del juego (diálogo, panel, HUD)
│   ├── api/npc/route.ts         # Motor de diálogo (Claude → Gemini → fallback)
│   ├── api/save/route.ts        # Escritura a 0G server-side (sponsor wallet)
│   └── providers.tsx            # wagmi + red (default Turbo)
├── components/engram/
│   ├── Scene3D.tsx              # Escena 3D + primera persona explorable
│   ├── map.ts                   # Terreno (getHeightAt) + props + colliders
│   └── Art.tsx                  # Retratos de NPCs
├── lib/
│   ├── 0g/                      # blob / fees / uploader / downloader / network
│   ├── memory.ts                # MemoryBundle: lee de 0G (cliente) + POST a /api/save
│   ├── npcs.ts                  # Personalidades + system prompts
│   └── types.ts                 # MemoryBundle, NPCMemory, NPCName, etc.
└── config/                      # 0G + wagmi (Chain ID 16602)
```

**Schema de memoria (por NPC, dentro del bundle):**
```json
{
  "trust_level": 50,
  "interaction_history": [],
  "emotional_state": "neutral",
  "debts": 0,
  "last_seen": null
}
```

---

*Engram — Zero Cup 2026 — Build on 0G. Own your story.*
