# Engram — guion del video (Zero Cup)

Objetivo: mostrar **mecánicas reales** del juego, cada una **anclada a 0G**. No es un guion
genérico de marketing: es una checklist de tomas + tres órdenes propuestos para grabar mañana.

## Herramientas de grabación (modos de URL)

- `?time=day` → mediodía fijo (sol alto). Para tomas diurnas sin esperar la hora real.
- `?time=night` → noche fija (luna arriba, antorchas, grillos). Para tomas nocturnas.
  - Ambos **conservan el HUD** (no como `?shot`, que oculta toda la UI para thumbnails).
  - `?day=1` es otra cosa (bright plano de debug); para el video usa `?time=`.
- Combinables con la vista: entra, cambia a aérea con el botón o `V`.
- Tip: graba la **misma escena** con `?time=day` y luego `?time=night` para el corte día→noche.

## Las 7 mecánicas + su anclaje a 0G

### Primera persona (a ras de suelo)
1. **Conexión de cartera.** El gancho: "tu memoria es tuya, vive en 0G". (La tarjeta de
   onboarding ya nombra la tesis.) → *0G: identidad/propiedad.*
2. **Conversación de voz con un NPC.** Pregúntale si te recuerda; que cite algo tuyo más allá del
   nombre (una venta pasada, una promesa). El **banner "📜 …recalls N past conversations · loaded
   from 0G Storage · <hash>"** es la prueba visible. → *0G Storage: memoria persistente leída en
   vivo.* (Voz: micrófono 🎤 STT + voz del NPC TTS.)
3. **Obtención de recursos** (madera/piedra/minerales) y su guardado. Talar/minar, ver el
   inventario subir; al guardar el mundo, el estado va a 0G. → *0G: world-state propiedad del
   jugador.*
4. **Comercio + negociación con Aldric.** Vende, regatea; su reputación/recuerdo del trato
   persiste. → *0G: el comercio deja huella en la memoria on-chain del NPC.*

Intercalar **día y noche** (con `?time=`) entre estas tomas para mostrar el mundo vivo.

### Vista aérea (RTS)
5. **Construcción con IA.** Describe una estructura por prompt → la IA la esculpe en bloques.
   Al guardar el mundo aéreo, la build se publica a 0G. → *0G: creaciones del jugador persistidas.*
   (Bonus: construye un **"almacén"/"warehouse"** → acércate y pulsa **E** para abrir el panel de
   **0G Warehouse** y guardar recursos por encima del tope de bolsillo.)
6. **Alianzas / enemistades.** Marca una wallet como aliada u hostil; eso habilita reparar o
   raidear. → *0G: relaciones sociales como estado compartido.*
7. **Claim land (punto fuerte).** Reclama una parcela de la frontera → ParcelRegistry on-chain;
   el mapa crece casilla a casilla, cada parcela con dueño en 0G. → *0G: tierra verificable
   on-chain, el mapa mismo es estado descentralizado.*

### Paneles 0G a mostrar (cortes B-roll)
- **🌍 0G / World Treasury**: economía derivada del estado 0G (precios por escasez, tesorería).
- **Memory**: el bundle JSON por wallet que vive en 0G Storage.
- Nota: en el banner ya decimos **"0G Storage"** (antes el glifo "0G" podía leerse "oG"); si ves
  algún otro "0G" que se preste a confusión, dímelo y lo deletreo igual.

## Tres órdenes propuestos

### Orden A — "El viaje del jugador" (narrativo, recomendado)
Sigue el arco natural de una partida; fácil de narrar en off.
1 Cartera → 2 Voz/recuerdo → 3 Recolección → 4 Comercio → (cambio a aérea) → 5 Construcción IA →
7 Claim land → 6 Alianzas. Cierre: panel Memory + Treasury mostrando que **todo** quedó en 0G.

### Orden B — "0G primero" (técnico, para jueces que premian la tesis)
Abre fuerte con el diferenciador.
7 Claim land (mapa on-chain) → 5 Construcción IA → 2 Voz/recuerdo (memoria 0G) → 3 Recolección/
guardado → 4 Comercio → 6 Alianzas → 1 Cartera al inicio como pre-requisito. Cada beat: frase de
una línea "esto vive en 0G porque…".

### Orden C — "Día y noche" (atmósfera + mecánicas)
Estructura el video por ambiente para lucir el mundo.
- **Día (`?time=day`)**: 1 Cartera → 3 Recolección → 4 Comercio → 5 Construcción IA.
- **Noche (`?time=night`)**: 2 Voz/recuerdo (más íntima de noche) → 6 Alianzas → 7 Claim land.
- Cierre diurno con Memory + Treasury.

## Guion sugerido (voz en off, ~60–90s, base del Orden A)
- (0:00) "En Aldenmoor, tu historia es tuya — y vive en 0G." *(conectar cartera)*
- (0:08) "Hablo con Sable… y me recuerda. No es scripted: su memoria se cargó de 0G Storage."
  *(voz + banner de recall)*
- (0:20) "Talo, mino, recojo — y al guardar, mi mundo se escribe en 0G." *(recolección + save)*
- (0:30) "Negocio con Aldric; el trato queda en su memoria on-chain." *(comercio)*
- (0:40) "Desde el cielo, describo y la IA construye — y se publica en 0G." *(build IA)*
- (0:50) "Reclamo tierra: cada parcela tiene dueño on-chain; el mapa mismo es 0G." *(claim land)*
- (1:00) "Aliados, enemigos, economía… todo es estado que poseo." *(alianzas + Treasury/Memory)*
- (1:10) "Engram: construido con prompts, recordado por 0G."

> Ajusta tiempos al material; cada beat debe **mostrar la UI que prueba el anclaje a 0G**
> (banner de recall, hash de save, ParcelRegistry, Treasury).
