# Normas de atención para tareas y pomodoros (v2)

Estas normas fijan **cuánto dura un pomodoro según la tarea**. Las aplican la app y los
modelos (Gemini, Laya) que etiquetan tareas nuevas.

Las escribió un modelo grande una sola vez y vienen con ejemplos ya etiquetados
([anclas.json](anclas.json)). Así, un modelo más simple solo tiene que **clasificar dos rasgos
observables**. El largo del pomodoro lo calcula el código con una tabla fija, no un modelo.

## 1. La idea

Que una tarea sea "difícil" no dice cuánto debe durar su pomodoro. Lo dicen dos rasgos que se
pueden observar:

| Rasgo | Pregunta | Qué controla |
|---|---|---|
| **R: costo de reentrada** | Después de una pausa, ¿cuánto cuesta volver a estar dentro de la tarea? | **El largo del pomodoro.** Si volver a entrar es caro, cada pausa sale cara, así que conviene hacer menos pausas y más largas. |
| **C: carga mental** | ¿Cuántas ideas hay que sostener en la cabeza a la vez? | **El largo de la pausa** y **cuánto se puede sostener seguido.** Una carga alta cansa y pide pausas más largas. |

Los dos rasgos se califican de 0 a 3. Cada nivel tiene ejemplos fijos (anclas) para que dos
personas, o dos modelos, lleguen al mismo número.

### R: costo de reentrada

| R | Descripción | Ejemplos |
|---|---|---|
| 0 | Se retoma al instante; cada paso es independiente. | Responder un correo, llenar un formulario, registrar algo. |
| 1 | Basta releer el último paso. | Repasar apuntes conocidos, un ejercicio directo de aplicar una fórmula, buscar convocatorias. |
| 2 | Hay que reconstruir un hilo de varios pasos. | Leer una sección nueva, una derivación de media página, escribir una función nueva. |
| 3 | Hay que reconstruir un estado mental grande y frágil; interrumpir cuesta 10 minutos o más. | Una demostración larga, depurar un error con varias hipótesis, ejercicios de cierre, un texto argumentativo en borrador (SOP). |

### C: carga mental

| C | Descripción | Ejemplos |
|---|---|---|
| 0 | Rutina: solo ejecutar. | Ordenar archivos, copiar datos, enviar algo ya escrito. |
| 1 | Una idea a la vez, con el material a la vista. | Definiciones básicas de conjuntos, repaso de álgebra lineal, un reporte informativo. |
| 2 | Varias ideas o pasos que se relacionan; hay que comparar o encadenar. | Teoría nueva de nivel estándar, comparar métodos, implementar un algoritmo conocido. |
| 3 | Muchas piezas abstractas a la vez, sin poder apoyarse en el papel. | Análisis funcional (teorema espectral, operadores no acotados), cierres difíciles, una teoría nueva muy abstracta. |

**Para desempatar:** si dudas entre dos niveles, elige el más bajo. Las mediciones (sección 5)
lo suben si hace falta, y un pomodoro demasiado largo hace más daño que uno corto.

## 2. Perfiles de atención

El par (R, C) da uno de **tres perfiles** con esta tabla. **Esta tabla la aplica el código;
ningún modelo la calcula.**

| R \ C | C0 | C1 | C2 | C3 |
|---|---|---|---|---|
| **R0** | Mecánico | Mecánico | Ligero | Ligero |
| **R1** | Mecánico | Ligero | Ligero | Ligero |
| **R2** | Ligero | Ligero | Ligero | Profundo |
| **R3** | Ligero | Profundo | Profundo | Profundo |

Cada perfil fija el largo del pomodoro, el de la pausa y el del bloque. Los valores los fijaste
tú (2026-10-01):

| Perfil (en el código) | Pomodoro / pausa | Bloque | Reparto |
|---|---|---|---|
| Mecánico (`MECHANICAL`) | 15 / 5 | **60 min** | 15 · 5 · 15 · 5 · 15 · 5 |
| Ligero (`LIGHT`) | 25 / 5 | 90 min | 25 · 5 · 25 · 5 · 25 · 5 |
| Profundo (`DEEP`) | 40 / 5 | 90 min | 40 · 5 · 40 · 5 |

Los tres bloques se reparten exactos. El bloque se cuenta **desde su hora de inicio**: uno
mecánico que empieza a las 14:00 termina a las 15:00, aunque el horario de trabajo siga hasta
las 15:30. Si empiezas tarde, salen menos pomodoros y el último se recorta, pero el bloque
termina a la misma hora. Si quedan menos de 10 minutos, no se empieza otro pomodoro.

## 3. Tamaño de las tareas: en sesiones, no en pomodoros

Una tarea se estima en **sesiones de un bloque (90 minutos)**, y los pomodoros salen del perfil.
Una tarea de "2 sesiones" son dos tareas de una sesión, en días distintos y en orden. Esto
elimina el problema de las tareas de 4 o 6 pomodoros que no cabían en ningún bloque.

## 4. Reglas para armar el día (las usa el planificador)

1. **Un bloque tiene un solo perfil:** el de la tarea más exigente, que va primero ("encima").
2. **Las tareas profundas ocupan el bloque entero.** Las ligeras y mecánicas pueden compartirlo
   si caben.
3. **Lo profundo va de preferencia en los bloques de la mañana** (09:00 y 11:00), y lo mecánico
   en la tarde. A casi todo el mundo el trabajo analítico le rinde más temprano, pero depende del
   cronotipo; si tus mediciones dicen lo contrario, se invierte.
4. **Como mucho dos bloques profundos por día.**
5. Estas reglas van **debajo** de las tuyas (`Prompt_app_calendario.md`). Si choca alguna, manda
   la tuya: qué línea va en qué bloque, el orden del pensum y las reglas de ajuste.

## 5. Calibración: el criterio es subjetivo, así que se mide

El check-in que ya existe ("¿Cuánto llevas concentrado de verdad en este pomodoro?") se guarda
**por perfil**, no como un único promedio. Regla para cada perfil:

- El largo del pomodoro pasa a ser la **mediana de las últimas 5 respuestas** de ese perfil,
  redondeada a 5 minutos y dentro de su rango (Mecánico 10-20, Ligero 20-30, Profundo 30-50; nunca
  más de 50, tu máximo). Después se vuelve a repartir el bloque.
- Si en una tarea concreta las respuestas quedan por debajo del rango de su perfil 3 veces
  seguidas, la app **sugiere** bajarle un perfil. Nunca lo cambia sola.
- Cuando corriges el perfil de una tarea, esa corrección se convierte en una etiqueta nueva y
  se usa para entrenar a Laya (sección 6).

## 6. Qué hace cada modelo

| Quién | Qué hace | Por qué |
|---|---|---|
| **Modelo grande** (Claude, una vez y en revisiones) | Escribe estas normas y etiqueta las anclas. Revisa los casos en que los demás no coinciden. | El criterio pide juicio; hacerlo una vez sale barato. |
| **Gemini** (gratis) | Etiqueta tareas nuevas: devuelve tipo, R, C y una justificación, con estas normas y unas 20 anclas como ejemplo. | Sigue bien una rúbrica con ejemplos. |
| **Laya** (local) | **Todavía no etiqueta.** Sin entrenamiento falló con estas preguntas: puso los cierres con la carga más baja y llamó "escritura" a la integral de Lebesgue. Cuando haya unas 150 etiquetas (anclas, más lo que etiquete Gemini, más tus correcciones), se le hace fine-tuning y pasa a etiquetar al instante y sin conexión. | Clasifica bien solo cuando está entrenado para la tarea. |
| **Código** | Aplica la tabla R×C → perfil, reparte el bloque, revisa la capacidad y calibra. | Lo que es una regla no se le pide a un modelo. |
| **Tú** | Puedes cambiar el perfil de cualquier tarea. | Tu criterio es la referencia final. |

## 7. Prueba (2026-10-01)

Se le pasaron a `gemini-3.5-flash` (nivel gratis) estas normas y 20 anclas, y etiquetó las otras
80 sin ver las respuestas. Tardó 60 segundos.

| Medida | Resultado |
|---|---|
| R exacto | 83 % |
| C exacto | 75 % |
| Perfil exacto (3 perfiles) | **81 %** |
| Perfil con un nivel de diferencia como máximo | **100 %** |

La prueba se hizo con la versión de 5 perfiles (70 % exacto). Cada perfil viejo corresponde a
uno solo de los nuevos, así que el resultado se recalculó con la misma respuesta de Gemini.

Casi todos los errores son **un nivel más bajo**: Gemini calificó como ligeras sesiones que las
anclas ponen como profundas, como el teorema espectral, Darboux, la integral de Lebesgue y los
cierres de los pilares. En parte es lo que pide la regla de desempate ("si dudas, el más bajo"),
y la calibración (sección 5) lo corrige con el uso. Con Laya sin entrenar, en cambio, la misma
prueba no sirvió (sección 6).

## 8. Tipos de trabajo (para describir, no para calcular)

Cada tarea también lleva un tipo. Sirve para la justificación y como valor por defecto cuando
no hay información para fijar R y C:

| Tipo | Típico | Perfil típico |
|---|---|---|
| administrativo | R0 C0 | Mecánico |
| busqueda | R1 C1 | Ligero |
| repaso | R1 C1 | Ligero |
| teoria (leer y rehacer derivaciones) | R2 C2 | Ligero |
| critica (leer artículos y comparar) | R2 C2 | Ligero |
| practica (implementar en código) | R3 C2 | Profundo |
| escritura argumentativa | R3 C2 | Profundo |
| cierre (ejercicios o problemas difíciles) | R3 C2-C3 | Profundo |
| fisico | — | sin pomodoro: es un hábito, no un bloque de foco |
