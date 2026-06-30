# Engram — pilares de diseño (filosofía del juego)

Principios que guían **qué** construimos y **por qué**. Cuando dudemos de una mecánica, se mide
contra estos pilares. (Documento vivo — agrégale cuando definamos un principio nuevo.)

## 1. Todo elemento debe estar justificado — nada "porque sí"
Cada objeto, mecánica, recurso y sistema del juego debe **tener una razón de ser** dentro de la
ficción y del bucle de juego. Nada decorativo-por-azar ni puesto "porque queda bonito" sin función.
- Si algo existe, debe **conectar** con otra cosa (un recurso se usa, un peligro tiene consecuencia,
  un lugar tiene propósito).
- **Ejemplos de aplicación:**
  - El **río** no debe ser decorativo → debe habilitar pescar, transportarse, construir puentes,
    granjas, vertientes al cavar (ver Prompt 33).
  - El **kit de hierbas medicinales** solo tiene sentido si **perder vida tiene consecuencia**
    (si morir no cuesta nada, curarse no vale nada) → ver pilar 2 y Prompt 30.
  - Las **escaleras** que la IA construye deben **escalarse de verdad**, no ser bloques decorativos
    (ver Prompt 32).

## 2. Las consecuencias dan peso a las decisiones
Si una acción no tiene consecuencia, no importa. El riesgo justifica las herramientas de mitigación.
- **Perder vida / morir debe costar** (p. ej. restar recursos o coin/tokens al jugador). Eso le da
  sentido a curarse (hierbas), a defenderse, a construir murallas resistentes.
- Como contrapeso, el **daño debe ser justo**: si morir cuesta, el daño por golpe debe ser bajo
  (p. ej. demonios a **-1**, no -15) para que la consecuencia sea tensa pero no frustrante.

## 3. Propiedad real en 0G (la tesis)
Lo que el jugador **es, hace y crea** vive en 0G y le pertenece: memoria de los NPCs, su mundo,
sus parcelas, sus creaciones (builds, ítems) — verificable y comerciable. Cada sistema nuevo debe
preguntarse: **¿qué parte de esto es estado propiedad del jugador en 0G?**

## 4. Diégesis sobre "apretar un botón"
Preferimos que las acciones se **vivan**, no que se resuelvan con un clic instantáneo. Construir,
recolectar o fabricar idealmente involucran presencia y proceso (ver Prompt 34: modo manual con
manos / labores). No siempre es viable, pero es la dirección estética.

## 5. El mundo está vivo y reacciona
La naturaleza, la economía y los NPCs responden al jugador y al tiempo: los recursos se regeneran,
los precios se mueven por escasez, los NPCs recuerdan. El mundo no es un escenario estático.
- Ejemplo: la IA de la naturaleza podría regenerar **más recursos cuanto más se juega/conecta**
  la comunidad (ver Prompt 31), atando la vitalidad del mundo a la actividad real.

## 6. Frontend lo más simple posible
La UI debe **simplificarse, no complicarse**. Menos botones, menos paneles flotantes, menos ruido
visual. Cada elemento de interfaz se gana su lugar; si algo se puede inferir, contextualizar o
esconder hasta que haga falta, mejor. Preferimos lo diegético (que la información viva en el mundo)
sobre HUD encima de la pantalla. (Conecta con el pilar 4 y con quitar adornos que rompen realismo:
nombres flotantes, anillos bajo edificios en 1ra persona, etc.)

## 7. Inmersión y realismo
La experiencia debe **sentirse viva y real**: voz (STT/TTS), audio espacial, sonidos de ambiente,
día/noche, NPCs que reaccionan. Buscamos que el jugador *sienta* el mundo, no que lo opere como un
menú. Nada que rompa la ilusión sin una buena razón (etiquetas flotantes, indicadores artificiales).
El **modo de construcción manual** (ver las manos, hacer labores; pilar 4 y Prompt 34) es la
dirección estrella de este pilar.

## 8. Verticalidad con sentido (Warren Spector)
Si el mundo es 3D, el eje **vertical** tiene que **significar algo** — no ser decorado. El jugador
debe poder ir **arriba** y **abajo** de verdad:
- **Arriba:** escaleras que se suben, edificios/torres a los que se asciende, plataformas
  (ver Prompt 32 "estructuras escalables").
- **Abajo:** **cavar** el terreno, sótanos, túneles, vertientes en el río (ver Prompt 33).
Una escalera que no se sube, o un sótano que no se cava, es un 3D mentiroso. (Extensión directa del
pilar 1: todo elemento justificado — incluido el espacio vertical.)

---

> Regla práctica: antes de añadir X, escribe en una frase **por qué existe** y **con qué se
> conecta**. Si no puedes, X todavía no está listo para entrar.
