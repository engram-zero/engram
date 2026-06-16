ENGRAM

Persistent AI Characters on 0G

Zero Cup — Submission & Action Plan — June 2026 — v2


"The first game where NPCs truly remember you — and no one can make them forget."



Deadline de submission23 de junio, 2026Prize pool$17,000 USDPremio máximo$8,500 USD (campeón)Repogithub.com/engram-zero/engramBase de código0g-storage-web-starter-kit (adaptado)Stack confirmadoNext.js 15 + TypeScript + wagmi + 0G Storage SDK


1. Submission

Project Name

Engram

Tagline

The first game where NPCs truly remember you — and no one can make them forget.

Category

AI-native game on 0G — onchain gaming with AI components.

The Problem

En todos los videojuegos actuales, los NPCs reinician. Las relaciones, rencores y alianzas desaparecen cuando termina la sesión o el desarrollador actualiza el servidor. Los jugadores construyen vínculos emocionales con personajes que, en el fondo, son amnésicos. El mundo no recuerda que estuviste ahí.

Además, esa memoria — cuando existe — vive en una base de datos centralizada que el desarrollador puede borrar, alterar o perder. El jugador no posee nada.

The Solution

Engram es un demo RPG interactivo en el browser donde cada NPC tiene memoria persistente almacenada en la red 0G. Las decisiones del jugador se acumulan en una reputación viva que ningún desarrollador, ningún reset y ningún patch puede borrar.


Tu wallet es tu identidad — conecta una vez y el mundo recuerda tu historial
Cada conversación se procesa con IA y se escribe en 0G Storage
La memoria incluye: nivel de confianza, historial de interacciones, estado emocional, deudas
Los datos en 0G son auditables — el jugador puede verificar qué sabe el NPC de él
Portable — futuros juegos podrán leer la misma capa de memoria


Demo: La Aldea de Aldenmoor

Una pequeña aldea medieval. Tres NPCs con personalidades distintas, cada uno con su propio objeto de memoria en 0G Storage:

NPCRolComportamiento de memoriaAldricMercaderRecuerda si pagaste bien o regateaste. Leal → descuentos. Tramposo → precios altos.MarenCapitana de la guardiaRastrea tu historial de combate. Puede advertirte o dejarte caminar a una trampa.SableBroker de informaciónAgrega lo que los otros NPCs saben de ti. Se puede sobornar — o ya te vendió.

Por qué 0G es el núcleo

Las reglas del torneo exigen que 0G haga trabajo real en la app. En Engram, 0G Storage es la única fuente de verdad sobre la memoria de los NPCs. Si se quita 0G, la app no funciona. Si el desarrollador apaga su servidor, los recuerdos sobreviven. El jugador puede auditar en la blockchain exactamente qué sabe el NPC de él.


Diferenciador clave para los jueces: la memoria no puede ser alterada ni por el propio desarrollador del juego.



Tech Stack (confirmado en funcionamiento)

TecnologíaRolEstado0G Storage NetworkNúcleo — guarda y lee memoria de NPCs por wallet address✅ Probado@0gfoundation/0g-storage-ts-sdkSDK de TypeScript para upload/download✅ InstaladoNext.js 15 + TypeScriptFrontend + API routes✅ Corriendowagmi + @web3modal/wagmiWallet connection✅ FuncionandoClaude API (Anthropic)Motor de IA de los NPCsPendienteTailwindCSSEstilos✅ InstaladoVercelDeployPendiente

Checklist de Criterios de Submission

CriterioCómo lo cumple Engram01 Build AI-native en 0GEngram usa 0G Storage para guardar/leer memoria. Sin 0G, la app no funciona.02 Vibe codingConstruido con prompts + stack propio (Next.js/TypeScript).03 Trabajo original, Jun 15+Proyecto nuevo, creado durante el torneo.04 Repo público + demo funcionalgithub.com/engram-zero/engram — público desde el día 1.05 Snapshots por deadlineCada corte congela el repo.06 Mejorar y resubmitirEntre rondas el proyecto se desbloquea. Iterar es la estrategia.07 Un equipo, un proyectoProyecto individual.08 Sin trampaDemo real, repo siempre público.


2. Lo que aprendimos en el Día 1

Sobre 0G Studio


0G Studio (app.0g.ai) requiere tokens OG reales en mainnet para generar apps — no es gratuito.
La alternativa correcta es el Storage Web Starter Kit + código propio, que corre en testnet gratuito.


Sobre el stack real


Base: 0g-storage-web-starter-kit clonado de GitHub
Framework: Next.js 15.1.5
El starter kit usa dos archivos de config que pueden conflictuar:

src/config/index.ts — config principal de 0G + wagmi
src/config/wagmi.ts — debe reexportar desde index, no definir config propia



El Chain ID correcto de 0G Galileo Testnet es 16602 (no 16600 ni 16601 como dice la documentación)
La red en MetaMask se llama OG-Galileo-Testnet


Sobre los tokens de testnet


Faucet: faucet.0g.ai — da 0.5 OG por wallet cada 24 horas
Es suficiente para múltiples transacciones de testnet
La wallet usada: Account 1 de MetaMask (0x2d10...528B7)


Sobre el upload a 0G Storage


El error "Fee calculation error: BAD_DATA" en la UI no impide el upload — es un warning del contrato de mercado
El SDK reintenta automáticamente con gas price más alto si la primera transacción falla
Upload confirmado: transacción 0xe27c7468445e0c8ab47091624b5baeb83218c4995ec921062e04434ef52ee502
El Root Hash del archivo es la clave para descargarlo: 0x9fcbda0228...0d2c97e6486c


Sobre WalletConnect


Registro en cloud.walletconnect.com — plan Starter gratuito es suficiente
Project ID obtenido: 256e025a69d4bb5bb58a8db315e13a17
Variable de entorno: NEXT_PUBLIC_PROJECT_ID


Sobre el .env.local

NEXT_PUBLIC_PROJECT_ID=256e025a69d4bb5bb58a8db315e13a17
NEXT_PUBLIC_L1_RPC=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_STANDARD_FLOW_ADDRESS=0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628
NEXT_PUBLIC_STANDARD_STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_STANDARD_EXPLORER_URL=https://chainscan-galileo.0g.ai/tx/
NEXT_PUBLIC_STANDARD_L1_RPC=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_TURBO_FLOW_ADDRESS=0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628
NEXT_PUBLIC_TURBO_STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_TURBO_EXPLORER_URL=https://chainscan-galileo.0g.ai/tx/
NEXT_PUBLIC_TURBO_L1_RPC=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_DEFAULT_NETWORK=turbo


3. Plan de Acción (actualizado)


El stack está confirmado. El upload a 0G funciona. Ahora toca construir Engram encima.



Calendario — Zero Cup

FechaMilestoneEstadoJun 15Stack funcionando + upload a 0G confirmado✅ HECHOJun 23DEADLINE Grupo — MVP mínimo funcionalCorte 1Jun 27Top 32 anunciadosFase 1Jun 28DEADLINE Ronda de 32 — mejorar y resubmitirCorte 2Jul 3Top 16 anunciadosFase 2Jul 4DEADLINE Ronda de 16 — última ronda juzgadaCorte 3Jul 7Top 8 anunciados — inicia community votingFase 3Jul 8DEADLINE FINAL — último push al repoLock finalJul 8–10Community voting — Cuartos ($500 garantizados)$500Jul 11Top 4 anunciadosCuartosJul 12–14Community voting — Semis (+$1,000)+$1,000Jul 15Top 2 anunciadosSemisJul 16–18Community voting — Final (+$2,000)+$2,000Jul 19Campeón coronado (+$5,000 grand prize)Campeón

Estructura del proyecto (sobre el starter kit)

src/
├── app/
│   ├── page.tsx                    # Escena de Aldenmoor (reemplaza upload/download UI)
│   ├── api/
│   │   └── npc/
│   │       └── route.ts            # API route: agente NPC con Claude API
├── components/
│   ├── DialogBox.tsx               # Cuadro de diálogo estilo JRPG
│   ├── MemoryPanel.tsx             # Panel: qué sabe el NPC del jugador
│   ├── NPCPortrait.tsx             # Retrato del NPC activo
│   └── VillageScene.tsx            # Escena de la aldea
├── lib/
│   ├── 0g/                         # Ya existe — upload/download a 0G Storage
│   │   ├── blob.ts                 # Ya existe
│   │   ├── uploader.ts             # Ya existe — usar para escribir memoria
│   │   └── downloader.ts           # Ya existe — usar para leer memoria
│   ├── npcs.ts                     # Personalidades + prompts de los 3 NPCs
│   ├── memory.ts                   # Funciones: leer/escribir memoria NPC en 0G
│   └── types.ts                    # NPCMemory, PlayerProfile, DialogOption
├── config/
│   ├── index.ts                    # Config de 0G + wagmi (Chain ID: 16602) ✅
│   └── wagmi.ts                    # Solo reexporta desde index ✅
└── hooks/
    ├── useWallet.ts                # Ya existe ✅
    ├── useUpload.ts                # Ya existe — reusar para escribir memoria
    └── useDownload.ts              # Ya existe — reusar para leer memoria

JSON Schema de memoria NPC

json{
  "trust_level": 50,
  "interaction_history": [],
  "emotional_state": "neutral",
  "debts": 0,
  "last_seen": null
}

La clave en 0G Storage es: engram_{walletAddress}_{npcName}
Ejemplo: engram_0x2d10...528B7_aldric

Sprint restante (Días 2–8)

DíaFechaObjetivoDía 2Jun 16Limpiar starter kit — eliminar UI de upload/download, crear estructura de EngramDía 3Jun 17memory.ts — leer/escribir JSON de memoria NPC en 0G usando hooks existentesDía 4Jun 18api/npc/route.ts — agente NPC con Claude API + memoria inyectadaDía 5Jun 19npcs.ts — personalidades de Aldric, Maren y Sable + promptsDía 6Jun 20UI — DialogBox, VillageScene, NPCPortrait, MemoryPanelDía 7Jun 21Testing end-to-end + deploy en VercelDía 8Jun 22–23Video demo + submission en 0g.ai/arena/zero-cup

Riesgos y Plan B (actualizado)

RiesgoPlan BSDK de 0G no soporta claves custom (solo rootHash)Guardar un índice: un JSON maestro por wallet que mapea npcName → rootHashCosto de Claude API en demo públicoRate limit por wallet. Máximo 10 mensajes por sesión.Pocos votos en community votingPost en X desde el día 1 con #TheZeroCup y @0G_labsError "Fee calculation: BAD_DATA" en producciónEs un warning conocido — no impide el upload. Documentado.

Recursos

RecursoURLRegistro Zero Cup0g.ai/arena/zero-cup0G Storage docsdocs.0g.ai0G Explorer (ver transacciones)chainscan-galileo.0g.ai0G Storage Scanstoragescan.0g.aiFaucet testnetfaucet.0g.aiWalletConnect dashboardcloud.walletconnect.comRepo del proyectogithub.com/engram-zero/engramSeguir el torneo@0G_labs en X — #TheZeroCup


4. Prompt para Claude Code

Pegar este prompt en Claude Code (VS Code) para continuar el desarrollo:

Estoy construyendo "Engram" — un RPG de texto en el browser donde los NPCs tienen memoria persistente almacenada en 0G Storage. Es mi participación en el Zero Cup hackathon de 0G Labs (deadline: 23 de junio).

## Stack actual (todo funcionando)
- Next.js 15.1.5 + TypeScript
- @0gfoundation/0g-storage-ts-sdk instalado y probado
- wagmi + @web3modal/wagmi para wallet connection
- Chain ID: 16602 (OG-Galileo-Testnet)
- Upload a 0G Storage confirmado en testnet

## Estructura de archivos relevante
- `src/lib/0g/uploader.ts` — ya existe, hace upload a 0G Storage
- `src/lib/0g/downloader.ts` — ya existe, hace download desde 0G Storage
- `src/lib/0g/blob.ts` — ya existe, crea blobs para upload
- `src/hooks/useUpload.ts` — hook de React para upload
- `src/hooks/useDownload.ts` — hook de React para download
- `src/hooks/useWallet.ts` — hook de React para wallet
- `src/config/index.ts` — config de wagmi con zgTestnet (id: 16602)

## Lo que necesito construir
El juego tiene 3 NPCs en una aldea medieval (Aldenmoor):
- Aldric (mercader): recuerda si pagaste bien o regateaste
- Maren (capitana de guardia): rastrea tu historial de combate
- Sable (broker de info): agrega lo que los otros saben de ti

Cada NPC tiene un objeto JSON de memoria en 0G Storage, con clave `engram_{walletAddress}_{npcName}`:
```json
{
  "trust_level": 50,
  "interaction_history": [],
  "emotional_state": "neutral",
  "debts": 0,
  "last_seen": null
}
```

## Tarea inmediata
1. Crear `src/lib/types.ts` con los tipos TypeScript: NPCMemory, NPC, DialogOption
2. Crear `src/lib/memory.ts` con funciones readMemory(walletAddress, npcName) y writeMemory(walletAddress, npcName, memory) usando el SDK de 0G existente
3. Crear `src/lib/npcs.ts` con las personalidades y system prompts de los 3 NPCs
4. Crear `src/app/api/npc/route.ts` — API route que recibe {walletAddress, npcName, message}, lee la memoria de 0G, llama a Claude API con el system prompt del NPC + memoria inyectada, actualiza la memoria y la escribe de vuelta en 0G

Usa el código existente en src/lib/0g/ como base — no reescribas lo que ya funciona.
El objetivo para el 23 de junio es tener el flujo completo funcionando: wallet conectada → hablar con un NPC → memoria guardada en 0G → NPC recuerda en la siguiente sesión.


Engram — Zero Cup 2026 — Build on 0G. Own your story.