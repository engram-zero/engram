# ENGRAM
### Persistent AI Characters on 0G
*Zero Cup — Submission & Action Plan — June 2026*

> "The first game where NPCs truly remember you — and no one can make them forget."

| | |
|---|---|
| Deadline de submission | 23 de junio, 2026 |
| Prize pool | $17,000 USD |
| Premio máximo | $8,500 USD (campeón) |
| Plataforma | 0G Studio — app.0g.ai |
| Repo | GitHub público — crear desde el día 1 |

---

## 1. Submission

### Project Name
Engram

### Tagline
The first game where NPCs truly remember you — and no one can make them forget.

### Category
AI-native game on 0G — onchain gaming with AI components.

### The Problem
En todos los videojuegos actuales, los NPCs reinician. Las relaciones, rencores y alianzas desaparecen cuando termina la sesión o el desarrollador actualiza el servidor. Los jugadores construyen vínculos emocionales con personajes que, en el fondo, son amnésicos. El mundo no recuerda que estuviste ahí.

Además, esa memoria — cuando existe — vive en una base de datos centralizada que el desarrollador puede borrar, alterar o perder. El jugador no posee nada.

### The Solution
Engram es un demo RPG interactivo en el browser donde cada NPC tiene memoria persistente almacenada en la red 0G. Las decisiones del jugador se acumulan en una reputación viva que ningún desarrollador, ningún reset y ningún patch puede borrar.

- Tu wallet es tu identidad — conecta una vez y el mundo recuerda tu historial
- Cada conversación se procesa con IA y se escribe en 0G Storage
- La memoria incluye: nivel de confianza, historial de interacciones, estado emocional, deudas
- Los datos en 0G son auditables — el jugador puede verificar qué sabe el NPC de él
- Portable — futuros juegos podrán leer la misma capa de memoria

### Demo: La Aldea de Aldenmoor
Una pequeña aldea medieval. Tres NPCs con personalidades distintas, cada uno con su propio objeto de memoria en 0G Storage:

| NPC | Rol | Comportamiento de memoria |
|---|---|---|
| Aldric | Mercader | Recuerda si pagaste bien o regateaste. Leal → descuentos. Tramposo → precios altos. |
| Maren | Capitana de la guardia | Rastrea tu historial de combate. Puede advertirte o dejarte caminar a una trampa. |
| Sable | Broker de información | Agrega lo que los otros NPCs saben de ti. Se puede sobornar — o ya te vendió. |

### Por qué 0G es el núcleo
Las reglas del torneo exigen que 0G haga trabajo real en la app. En Engram, 0G Storage es la única fuente de verdad sobre la memoria de los NPCs. Si se quita 0G, la app no funciona. Si el desarrollador apaga su servidor, los recuerdos sobreviven. El jugador puede auditar en la blockchain exactamente qué sabe el NPC de él.

> Diferenciador clave para los jueces: la memoria no puede ser alterada ni por el propio desarrollador del juego.

### Tech Stack

| Tecnología | Rol |
|---|---|
| 0G Storage Network | Núcleo del proyecto — guarda y lee la memoria de cada NPC por wallet address |
| 0G Studio | Entorno de vibe coding en el browser — prompts → app → deploy en 1 click |
| Claude API | Motor de IA de los NPCs — genera respuestas en personaje con memoria inyectada |
| Wallet connection | Identidad del jugador — la wallet address es el ID único en el mundo |
| GitHub (público) | Requerido por las reglas — snapshot del repo en cada deadline |

### Checklist de Criterios de Submission

| Criterio | Cómo lo cumple Engram |
|---|---|
| 01 Build AI-native en 0G | Engram usa 0G Storage para guardar/leer memoria. Sin 0G, la app no funciona. |
| 02 Vibe coding | Construido con prompts en 0G Studio. Sin código manual. |
| 03 Trabajo original, Jun 15+ | Proyecto nuevo, creado durante el torneo. Libraries open-source permitidas. |
| 04 Repo público + demo funcional | GitHub público desde el día 1. Demo en vivo o video del flujo completo. |
| 05 Snapshots por deadline | Cada corte congela el repo. Lo que importa: algo funcional en cada fecha. |
| 06 Mejorar y resubmitir | Entre rondas el proyecto se desbloquea. Iterar es la estrategia. |
| 07 Un equipo, un proyecto | Proyecto individual — un builder, un proyecto. |
| 08 Sin trampa | Demo real, repo siempre público, sin bots en el community vote. |

---

## 2. Plan de Acción

El skill central de este torneo es describir bien. El código lo genera 0G Studio con prompts. La estrategia es: prompts claros → iterar → algo funcional antes de cada corte.

> Regla de oro: el repo debe estar público en GitHub desde el día 1. El snapshot es lo que cuenta en cada deadline.

### Calendario — Zero Cup

| Fecha | Milestone | Estado |
|---|---|---|
| Jun 15 | Registro abierto — inicio del torneo (HOY) | Ahora |
| Jun 23 | DEADLINE Grupo — snapshot del repo. MVP mínimo funcional. | Corte 1 |
| Jun 27 | Top 32 anunciados | Fase 1 |
| Jun 28 | DEADLINE Ronda de 32 — mejorar y resubmitir | Corte 2 |
| Jul 3 | Top 16 anunciados | Fase 2 |
| Jul 4 | DEADLINE Ronda de 16 — última ronda juzgada | Corte 3 |
| Jul 7 | Top 8 anunciados — inicia community voting | Fase 3 |
| Jul 8 | DEADLINE FINAL — último push al repo. Build definitivo. | Lock final |
| Jul 8–10 | Community voting — Cuartos ($500 garantizados por proyecto) | $500 |
| Jul 11 | Top 4 anunciados | Cuartos |
| Jul 12–14 | Community voting — Semis (+$1,000) | +$1,000 |
| Jul 15 | Top 2 anunciados | Semis |
| Jul 16–18 | Community voting — Final (+$2,000) | +$2,000 |
| Jul 19 | Campeón coronado — grand prize +$5,000 (total: $8,500) | Campeón |

---

### Guía de Prompts para 0G Studio

Prompts modulares en orden. Cada uno construye sobre el anterior.

| Módulo | Prompt |
|---|---|
| 1. Estructura base | Crea una app web de RPG de texto. Hay una aldea medieval llamada Aldenmoor. El jugador puede conectar su wallet de Ethereum. Hay 3 NPCs: Aldric (mercader), Maren (capitana de guardia) y Sable (broker de información). El jugador puede hablar con cada uno por turno. |
| 2. Objeto de memoria | Cada NPC tiene un objeto JSON de memoria: `{ trust_level: 0-100, interaction_history: [], emotional_state: string, debts: number, last_seen: timestamp }`. Este objeto se guarda en 0G Storage usando la wallet address del jugador como clave y el nombre del NPC como identificador. |
| 3. Leer memoria al iniciar | Cuando el jugador inicia un diálogo con un NPC, la app lee el objeto de memoria de ese NPC desde 0G Storage. Si no existe, se crea uno con valores por defecto (trust_level: 50, emotional_state: 'neutral'). |
| 4. Agente NPC con Claude API | Cuando el jugador envía un mensaje, el sistema inyecta el objeto de memoria en el system prompt del NPC junto con su personalidad, y genera una respuesta usando Claude API. Después de cada intercambio, actualiza el objeto de memoria y lo escribe de vuelta en 0G Storage. |
| 5. Panel de memoria | Agrega un panel lateral que el jugador puede abrir para ver qué sabe cada NPC de él: trust_level como barra visual (0-100), historial de interacciones, estado emocional actual, deudas pendientes. |
| 6. UI estilo RPG | La interfaz tiene un cuadro de diálogo en la parte inferior estilo JRPG clásico. Fondo ilustrado de una aldea. Cada NPC tiene un retrato diferente. Las opciones de diálogo aparecen como botones. |

> Si Studio no puede integrar 0G Storage con prompts, pedir que genere el código del cliente HTTP para hacer las llamadas manualmente — sigue siendo válido como vibe coding.

---

### Sprint de Desarrollo — 8 Días

*Tipos de tarea: PROMPT = trabajo en 0G Studio | CÓDIGO = ajuste manual si Studio falla | ADMIN = tareas del torneo*

#### Día 1 | Jun 15 — Setup
| Tarea | Tiempo | Tipo |
|---|---|---|
| Crear cuenta en 0G Builder Profile en app.0g.ai | 30 min | ADMIN |
| Crear repo GitHub público: engram-zerocup | 20 min | ADMIN |
| Explorar 0G Studio: abrir un template y ver qué genera | 1 hr | PROMPT |
| Leer docs de 0G Storage: cómo se sube y baja un JSON | 1 hr | ADMIN |
| Definir el JSON schema de la memoria NPC en papel | 30 min | ADMIN |

#### Día 2 | Jun 16 — Estructura base
| Tarea | Tiempo | Tipo |
|---|---|---|
| Prompt 1 en Studio: aldea + 3 NPCs + wallet connect | 2 hrs | PROMPT |
| Verificar que Studio genera algo navegable en el browser | 30 min | PROMPT |
| Prompt 2: sistema de diálogo con opciones de respuesta | 1.5 hrs | PROMPT |
| Primer commit al repo público de lo generado | 20 min | ADMIN |

#### Día 3 | Jun 17 — Integración 0G Storage
| Tarea | Tiempo | Tipo |
|---|---|---|
| Prompt 3: leer memoria del NPC desde 0G al iniciar diálogo | 2 hrs | PROMPT |
| Prompt 4: escribir memoria actualizada en 0G al terminar diálogo | 2 hrs | PROMPT |
| Verificar en 0G explorer que los datos realmente se guardan | 1 hr | ADMIN |
| Si Studio falla: generar cliente HTTP de 0G Storage manualmente | 2 hrs | CÓDIGO |

#### Día 4 | Jun 18 — Agente NPC
| Tarea | Tiempo | Tipo |
|---|---|---|
| Prompt 5: integrar Claude API como motor de los NPCs | 2 hrs | PROMPT |
| Ajustar prompt de sistema para cada NPC (personalidad + memoria) | 1.5 hrs | PROMPT |
| Testing: hablar con Aldric 3 veces, verificar que recuerda | 1 hr | ADMIN |
| Commit con el flujo completo funcionando | 20 min | ADMIN |

#### Día 5 | Jun 19 — Panel de memoria + UI
| Tarea | Tiempo | Tipo |
|---|---|---|
| Prompt 6: panel lateral con lo que sabe el NPC del jugador | 2 hrs | PROMPT |
| Prompt 7: UI visual — retratos, fondo de aldea, cuadro de diálogo | 2 hrs | PROMPT |
| Pulir estilos: que se vea como un juego, no como una app genérica | 1.5 hrs | PROMPT |

#### Día 6 | Jun 20 — Testing & buffer
| Tarea | Tiempo | Tipo |
|---|---|---|
| Testing completo: wallet → 3 NPCs → verificar memoria en 0G | 2 hrs | ADMIN |
| Escribir README: qué hace el proyecto, cómo corre, dónde está 0G | 1 hr | ADMIN |
| Día de buffer: resolver lo que falló los días anteriores | 3 hrs | PROMPT |

#### Día 7 | Jun 21 — Deploy
| Tarea | Tiempo | Tipo |
|---|---|---|
| Deploy en 0G Studio — obtener URL pública | 1 hr | ADMIN |
| Verificar que la URL pública funciona con wallet real | 30 min | ADMIN |
| Grabar video demo del flujo completo (2–3 min) | 2 hrs | ADMIN |

#### Día 8 | Jun 22–23 — Submission
| Tarea | Tiempo | Tipo |
|---|---|---|
| Completar submission en 0g.ai/arena/zero-cup (repo + descripción) | 1 hr | ADMIN |
| Publicar post en X con #TheZeroCup y link al proyecto (obligatorio) | 30 min | ADMIN |
| Verificar criterios de submission uno por uno | 30 min | ADMIN |
| Confirmar: repo público, demo viva, 0G hace trabajo real | 15 min | ADMIN |

---

### Estrategia por Rondas

| Ronda | Objetivo |
|---|---|
| Group Stage (Jun 23) | MVP funcional. Wallet + 1 NPC con memoria en 0G. Flujo completo demostrable. |
| Ronda de 32 (Jun 28) | Agregar los 2 NPCs restantes. Panel de memoria. UI mejorada. |
| Ronda de 16 (Jul 4) | Experiencia pulida. Prompts refinados. Video demo profesional. |
| Jul 8 — Lock final | Build definitivo. A partir de aquí solo cuenta el community vote. |
| Cuartos en adelante | Campaña en X. Compartir cada ronda con @0G_labs y #TheZeroCup. |

### Riesgos y Plan B

| Riesgo | Plan B |
|---|---|
| 0G Studio no integra Storage con prompts | Usar 0G HTTP API directamente con código mínimo en Node |
| Prompts generan código que no funciona | Iterar el prompt. Reformular. Empezar de cero si es necesario. |
| Demo no pasa revisión de 'trabajo real en 0G' | Mostrar en el video cómo la memoria se escribe/lee en 0G |
| Costo Claude API en demo público | Rate limit por wallet. Cachear respuestas frecuentes. |
| Pocos votos en community voting | Post en X desde el día 1. Construir audiencia durante el proceso. |

### Recursos

| Recurso | URL |
|---|---|
| Registro Zero Cup | 0g.ai/arena/zero-cup |
| 0G Studio | app.0g.ai |
| 0G Builder Hub / docs | build.0g.ai |
| Submission criteria | 0g.ai/arena/zero-cup/submission-criteria |
| Competition rules | 0g.ai/arena/zero-cup/competition-rules |
| 0G Storage docs | docs.0g.ai |
| Recordatorios por ronda | luma.com/thezerocup |
| Seguir el torneo | @0G_labs en X — #TheZeroCup |

---

*Engram — Zero Cup 2026 — Build on 0G. Own your story.*
