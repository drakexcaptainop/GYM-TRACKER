---
title: Gym Tracker
type: feat
date: 2026-11-21
status: requirements-only
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

## Goal Capsule

- **Objective:** Dos personas entrenan con rutinas distintas y ajustables, siguen cada sesión paso a paso desde el celular y se acompañan con rachas compartidas y mensajes de ánimo, sin competir ni presionarse.
- **Product authority:** Las dos personas que usarán la app. Este documento fija el producto (qué hace y para quién). La arquitectura, las tecnologías y el reparto del desarrollo se definen después, en otra etapa.
- **Open blockers:** Ninguno. Hay preguntas abiertas que no bloquean la planificación (ver Outstanding Questions).

---

## Product Contract

### Summary

Gym Tracker es una página web pensada para el celular, con versión también para computadora, para dos personas. Cada una entra a su perfil con un PIN, tiene su propia rutina semanal y entrena con una guía paso a paso que explica cada ejercicio con texto. Registra series, repeticiones y pesos, y consulta su progreso en privado. Un espacio llamado "Nosotros" muestra las rachas, la semana y el estado del día de ambas, y permite enviarse mensajes de ánimo predeterminados.

### Problem Frame

Las dos personas quieren mejorar su condición física y volver el entrenamiento un hábito. Ya tienen una rutina cada una, con ejercicios, intensidad y objetivos distintos, y esa rutina cambiará con el tiempo. Sin una herramienta, tienen que recordar qué toca cada día, cuántas series, qué peso usaron la vez anterior y cuánto descansar. Tampoco saben cómo va la otra persona ni cómo acompañarla en el momento justo.

No buscan una red social ni una app de fitness grande. Buscan algo pequeño, atractivo y fácil de usar que sostenga la constancia.

### Key Decisions

- **El acceso es un PIN por perfil.** Se elige el perfil y se ingresa el PIN; el dispositivo recuerda la sesión. Protege los registros personales sin cuentas ni correos. Governs R1, R2. (session-settled: user-directed — chosen over enlace secreto, correo con enlace mágico y acceso libre: el PIN fue la opción recomendada y la elegida.)
- **Las guías de los ejercicios son solo texto.** Sin imágenes, GIF, videos ni animaciones. Cada ejercicio explica por escrito, paso a paso, cómo hacerlo. Governs R15, R16, R17. (session-settled: user-directed — chosen over animaciones simples hechas para la app y enlaces a videos: se prefiere texto bien explicado.)
- **La paleta es negro con azul eléctrico, cian y un acento ámbar.** Reemplaza al morado y rosado del planteamiento inicial. Se mantiene la regla de no usar verde ni rojo. Los tonos exactos se definen en el diseño. Governs R40. (session-settled: user-directed — chosen over negro, morado y rosado: la persona pidió otros colores sobre fondo negro; la combinación concreta la propuse yo.)
- **Este documento solo define el producto.** La arquitectura, las tecnologías, el reparto del trabajo y las pruebas quedan fuera y se tratan después. (session-settled: user-directed — chosen over incluir una propuesta técnica en este documento.)
- **Una rutina es un punto de partida, no algo fijo.** Cada persona la edita sin afectar a la otra ni a lo ya registrado. Governs R8, R9.
- **Una sesión es una copia de lo que se entrenó ese día.** Al comenzar una sesión se guarda lo que la rutina decía en ese momento, de modo que editar o borrar la rutina después no cambia el historial. Governs R9, R30.
- **Lo compartido es poco y está definido.** Racha, sesiones de la semana, calendario de estados del día y mensajes. Todo lo demás es privado. Governs R35, R36.
- **Los días de recuperación activa (miércoles) son sesiones programadas.** Tienen su guía y cuentan para la racha al terminarlas. Los sábados y domingos son descanso programado. Governs R33.

### Requirements

**Perfiles y acceso**

- R1. Existen dos perfiles independientes, cada uno con nombre, rutina semanal, historial y estadísticas propios.
- R2. Cada perfil se abre con un PIN; la sesión se recuerda en ese dispositivo hasta que la persona cierre sesión.
- R3. Los datos privados de una persona (rutinas, pesos, repeticiones, historial, estadísticas) no se muestran a la otra.
- R4. Cada persona ve sus propios datos y los datos compartidos actualizados desde su celular, aunque la otra los haya generado desde otro dispositivo.

**Rutinas**

- R5. Cada perfil arranca con su rutina inicial (ver Rutinas iniciales). Ambas son modificables desde el primer día.
- R6. Una rutina semanal asigna a cada día de la semana una sesión de entrenamiento o un descanso programado.
- R7. Cada persona puede crear una rutina desde cero, duplicar una existente como base, editar su nombre y descripción, activarla, desactivarla, reemplazarla o eliminarla. Solo una rutina está activa a la vez por persona.
- R8. Dentro de una rutina se puede agregar, quitar y reordenar ejercicios, asignarlos a distintos días y convertir un día en descanso o al revés.
- R9. Los cambios en una rutina se aplican a las sesiones futuras; las sesiones ya terminadas no se modifican.
- R10. Cada ejercicio de una rutina tiene series, repeticiones o tiempo objetivo (admite rangos como 12–15), peso y descanso entre series, todos editables.
- R11. Los ejercicios principales y los accesorios tienen descansos distintos y configurables. Los valores iniciales de cada persona están en Rutinas iniciales.
- R12. Las rutinas pueden tener un calentamiento propio, activable o no, que se muestra antes de la sesión.
- R13. Los ejercicios pueden medirse en repeticiones, repeticiones por lado, segundos, segundos por lado o minutos. Algunos pueden no tener series (por ejemplo, estiramientos suaves).
- R14. La rutina de la persona 1 muestra una indicación de volumen reducido para sus dos primeras semanas (hasta 3 series en principales y 2 en accesorios). Es una guía visible que ella decide seguir o no; la app no limita las series.

**Ejercicios y guía en texto**

- R15. Cada ejercicio tiene una guía escrita con: nombre, músculos principales, materiales necesarios, series y repeticiones recomendadas, pasos numerados para hacerlo, consejos de técnica y errores comunes.
- R16. Los pasos están escritos para alguien que no conoce el ejercicio: posición inicial, movimiento, posición final, respiración cuando aplique y cómo volver.
- R17. Todos los ejercicios de las dos rutinas iniciales llegan con su guía completa. Los ejercicios que una persona agregue después pueden tener la guía en blanco y se pueden completar por escrito.
- R18. Un mismo ejercicio puede estar en las dos rutinas con prescripciones distintas (series, repeticiones, peso, descanso) y comparte la misma guía.
- R19. Se pueden crear ejercicios propios con su guía y editar las guías existentes.

**Pantalla de inicio**

- R20. Inicio muestra la sesión que toca hoy (o el descanso programado), el resumen de la semana y el botón "Comenzar entrenamiento".
- R21. Si hay una sesión pausada, Inicio ofrece retomarla.

**Entrenamiento guiado**

- R22. "Comenzar entrenamiento" abre una pantalla que guía toda la sesión en este orden: calentamiento (si la rutina lo tiene), primer ejercicio, sus series, descanso, siguiente serie o ejercicio, y resumen final.
- R23. Para cada ejercicio la pantalla muestra solo lo necesario para hacerlo: nombre, serie actual, repeticiones o tiempo objetivo, peso, materiales y la guía en texto, que se despliega a pedido.
- R24. Cada serie se registra por separado con las repeticiones (o segundos) y el peso realmente usados. Los valores sugeridos parten de lo planeado o de la última vez.
- R25. Al marcar una serie como hecha, el temporizador de descanso arranca solo cuando el ejercicio tiene descanso configurado.
- R26. El temporizador permite pausar, continuar, sumar 15 segundos, saltar el descanso y pasar al siguiente ejercicio cuando corresponda. Terminar el tiempo no marca ninguna serie como hecha.
- R27. Completar una serie y completar un ejercicio son acciones distintas; el ejercicio se da por completo cuando la persona lo indica o cuando termina todas sus series.
- R28. Si la rutina tiene calentamiento, tras él se ofrece una serie ligera del primer ejercicio de fuerza.
- R29. Una sesión se puede pausar y retomar después sin perder lo registrado, incluso si se cierra la página.
- R30. Al terminar se muestra un resumen: ejercicios completados, series realizadas, repeticiones registradas y duración aproximada. La sesión queda guardada como una copia de lo que se hizo (según R9).
- R31. Una sesión cuenta como completada solo cuando la persona la termina de forma explícita. Abrir la app o comenzar una sesión no cuenta.

**Progreso individual**

- R32. "Mi progreso" muestra: entrenamientos completados, historial cronológico, sesiones por semana, porcentaje de cumplimiento de la rutina, evolución de pesos, evolución de repeticiones y el detalle de cada sesión realizada. Es privado.

**Espacio compartido: Nosotros**

- R33. Cada persona tiene su propia racha, calculada según sus días programados. Los descansos programados no la rompen. Un día programado que pasa sin sesión completada la rompe. La racha de una persona no depende de la otra.
- R34. "Nosotros" muestra, para cada persona: nombre, racha actual, sesiones completadas esta semana y el estado de hoy.
- R35. Hay un calendario de actividad compartido donde cada día de cada persona aparece como completado, pendiente o descanso programado. Los pendientes se distinguen visualmente de los descansos.
- R36. Lo único que se comparte es lo de R34 y R35 más los mensajes de R37. Las rutinas, ejercicios, pesos y repeticiones de una persona no se muestran a la otra.
- R37. Cada persona puede enviar a la otra un mensaje elegido de una lista de frases de ánimo predeterminadas (por ejemplo "¡Tú puedes! 💪", "¡Estoy contigo! 💜", "¡Un entrenamiento más!"). Los mensajes se ven dentro de "Nosotros".
- R38. Se puede enviar un mensaje tanto cuando la otra persona ya entrenó como cuando todavía tiene el entrenamiento pendiente.
- R39. No hay chat libre, notificaciones push ni recordatorios automáticos. La otra persona ve los mensajes al abrir la app.

**Diseño y navegación**

- R40. La interfaz es oscura, con fondo negro o gris muy oscuro, tarjetas oscuras, azul eléctrico y cian como colores principales y un acento ámbar. No usa verde ni rojo. Tiene bordes redondeados, tipografía clara, animaciones discretas e iconos simples, y se siente como una app de fitness, no como un panel administrativo.
- R41. Está optimizada para el celular durante el entrenamiento, con botones grandes y texto legible, y también funciona bien en computadora.
- R42. Se accede por una URL y se puede agregar a la pantalla de inicio del celular.
- R43. La navegación tiene cinco secciones: Inicio, Entrenar, Nosotros, Mi progreso y Mis rutinas. Mis rutinas puede vivir dentro del perfil o la configuración si eso simplifica la navegación.

### Key Flows

- F1. Entrenar un día normal
  - **Trigger:** La persona abre la app y toca "Comenzar entrenamiento" en Inicio.
  - **Steps:** Ve el calentamiento, hace la serie ligera, pasa al primer ejercicio, lee la guía si la necesita, registra cada serie, descansa con el temporizador, continúa hasta el último ejercicio y toca "Terminar".
  - **Outcome:** La sesión queda guardada, se actualiza su racha y su día pasa a completado en "Nosotros".
  - **Covered by:** R22–R31, R33–R35

- F2. Pausar y retomar
  - **Trigger:** La persona tiene que interrumpir la sesión a la mitad.
  - **Steps:** Pausa la sesión; más tarde abre Inicio, ve la sesión pausada y la retoma en el punto donde quedó.
  - **Outcome:** Los registros anteriores siguen ahí.
  - **Covered by:** R21, R29

- F3. Animar a la otra persona
  - **Trigger:** En "Nosotros", una persona ve que la otra aún no entrenó hoy, o que ya terminó.
  - **Steps:** Elige una frase de ánimo y la envía.
  - **Outcome:** La otra persona la ve al abrir "Nosotros".
  - **Covered by:** R34, R37–R39

- F4. Ajustar la rutina
  - **Trigger:** Una persona quiere cambiar su rutina (más peso, otro ejercicio, otro día).
  - **Steps:** En Mis rutinas, edita o duplica la rutina, cambia lo que necesita y la activa.
  - **Outcome:** Las próximas sesiones usan el cambio; el historial no se altera y la rutina de la otra persona queda intacta.
  - **Covered by:** R7–R10, R5

### Acceptance Examples

- AE1. **Covers R9, R30.** Dado que la persona 1 terminó el lunes una sesión con "Sentadilla búlgara", cuando el martes elimina ese ejercicio de su rutina, entonces el lunes sigue mostrando la sentadilla búlgara con sus series y pesos en "Mi progreso".
- AE2. **Covers R26, R27.** Dado que el descanso de una serie llega a 0, entonces la serie siguiente no se marca ni se inicia sola, y la persona decide cuándo registrarla.
- AE3. **Covers R33.** Dado que la persona 2 entrena de lunes a miércoles y falta el jueves, cuando termina el jueves, entonces su racha vuelve a empezar; la racha de la persona 1 no cambia.
- AE4. **Covers R33, R35.** Dado que sábado y domingo son descanso programado, cuando una persona entrena viernes y lunes, entonces su racha continúa y el sábado y el domingo aparecen como descanso, no como pendiente.
- AE5. **Covers R3, R36.** Dado que la persona 1 registró 40 kg en hip thrust, cuando la persona 2 abre "Nosotros", entonces ve solo el estado del día, la racha y las sesiones de la semana de la persona 1, no el peso.
- AE6. **Covers R29.** Dado que la persona cierra el navegador en el ejercicio 3 de 5 con dos series registradas, cuando vuelve a abrir la app, entonces puede retomar en ese ejercicio con esas dos series intactas.
- AE7. **Covers R4.** Dado que la persona 1 termina su sesión en su celular, cuando la persona 2 abre "Nosotros" en el suyo, entonces ve el día de la persona 1 como completado.

### Success Criteria

- Las dos personas pueden entrenar un día completo solo con la app: ver qué toca, seguir la guía, registrar las series y terminar, sin consultar nada más.
- Cualquiera puede editar su rutina y sus pesos sin perder ni alterar lo ya registrado.
- Ambas ven el estado y la racha de la otra desde su propio celular, y sus registros personales siguen siendo privados.
- La app sigue siendo pequeña: cinco secciones y nada de lo listado en Scope Boundaries.

### Scope Boundaries

**Fuera de la primera versión**

- Imágenes, GIF, videos o animaciones de los ejercicios. Las guías son texto.
- Red social, seguidores, rankings o competencias.
- Chat completo o mensajes escritos libremente. Podría evaluarse después.
- Notificaciones push y recordatorios automáticos.
- Planes de pago.
- Seguimiento nutricional, calorías y porcentaje de grasa corporal.
- Inteligencia artificial.
- Cualquier función que complique la app sin ayudar a entrenar con constancia.

**Fuera de este documento**

- Arquitectura, tecnologías, estructura de datos, despliegue, pruebas y organización del desarrollo entre las dos personas. Se definen después.

---

## Appendix

### Rutinas iniciales

Estas son las rutinas con las que arranca cada perfil. Son puntos de partida editables (R5).

#### Persona 1

**Calentamiento (días de fuerza: lunes, martes, jueves y viernes):** sentadillas sin peso (15), rotaciones de cadera (10 por lado), movilidad de tobillos (15 por lado), flexión controlada de rodillas (10 por pierna), balanceo de piernas (10 por pierna) y rotaciones internas y externas de cadera (10 por pierna). Después, una serie ligera del primer ejercicio de fuerza. El miércoles no lleva calentamiento.

**Descansos iniciales:** principales 90–150 s; accesorios 45–90 s. Configurables por ejercicio.

**Primeras dos semanas:** indicación de hasta 3 series en principales y 2 en accesorios (R14).

| Día | Sesión | Ejercicios |
|---|---|---|
| Lunes | Glúteos y piernas (glúteos y cuádriceps) | Sentadilla profunda con mochila 3 × 12–15; hip thrust con mochila 4 × 12–15; sentadilla búlgara 3 × 10–12 por pierna; elevación de talones de pie 3 × 15–20; abducción de cadera acostada de lado 2 × 15 por lado |
| Martes | Brazos y abdomen | Flexiones 3 × 8–12; remo con mochila 3 × 12–15; curl de bíceps con botellas o mancuernas 3 × 12–15; extensión de tríceps por encima de la cabeza 3 × 12–15; elevación de piernas 3 × 10–15; plancha sobre antebrazos 3 × 25–40 s; dead bug 2 × 10 por lado |
| Miércoles | Recuperación activa | Caminata ligera o moderada 20–30 min; movilidad de cadera 2 × 10; rotaciones de hombros 2 × 15; estiramientos de piernas 2 × 20 s; movilidad de espalda 2 × 10 |
| Jueves | Glúteos y piernas (cadena posterior) | Peso muerto rumano con mochila 3 × 12; puente de glúteo a una pierna 3 × 10–12 por pierna; zancadas hacia atrás 3 × 12 por pierna; patada de glúteo en cuadrupedia 3 × 15 por pierna; curl femoral deslizante 2 × 10–12 |
| Viernes | Tren superior y abdomen | Press de hombros con botellas o mancuernas 3 × 10–12; elevaciones laterales 3 × 12–15; remo con mochila 3 × 12–15; curl de bíceps 2 × 12–15; extensión de tríceps 2 × 12–15; plancha lateral 3 × 20–30 s por lado; crunch controlado 2 × 15 |
| Sábado y domingo | Descanso programado | — |

#### Persona 2

Rutina más ligera, con énfasis en bíceps, tríceps, hombros, espalda y abdomen. Busca esfuerzo moderado, buena técnica y progresión gradual, sin llegar al agotamiento. Usa peso corporal, botellas de agua, mancuernas ligeras o una mochila con poco peso. No tiene calentamiento definido; puede agregarlo después (R12).

**Descansos iniciales:** principales 60–90 s; accesorios y abdominales 45–60 s. Configurables por ejercicio.

| Día | Sesión | Ejercicios |
|---|---|---|
| Lunes | Brazos y abdomen | Curl de bíceps con botellas 3 × 12; extensión de tríceps por encima de la cabeza 3 × 12; flexiones apoyando las rodillas si es necesario 2 × 8–10; crunch abdominal 3 × 15; plancha sobre antebrazos 3 × 20–30 s |
| Martes | Actividad ligera y abdomen | Caminata ligera 20 min; dead bug 2 × 10 por lado; elevación de rodillas 2 × 12; movilidad de hombros y brazos 2 × 15; estiramientos suaves |
| Miércoles | Recuperación activa | Caminata ligera 15–20 min; movilidad general; estiramientos suaves de brazos, espalda y piernas |
| Jueves | Brazos, hombros y abdomen | Curl de bíceps 3 × 12; elevaciones laterales con botellas 2 × 12; extensión de tríceps 3 × 12; remo con mochila ligera 2 × 12; plancha lateral 2 × 20 s por lado; bicicleta abdominal controlada 2 × 12 por lado |
| Viernes | Circuito ligero de cuerpo completo y abdomen | Sentadillas sin peso 2 × 15; flexiones apoyando las rodillas 2 × 8; curl de bíceps 2 × 12; crunch abdominal 2 × 15; dead bug 2 × 10 por lado; plancha 2 × 20–30 s |
| Sábado y domingo | Descanso programado | — |

### Forma de la guía de un ejercicio

Todos los ejercicios de ambas rutinas siguen esta forma (R15, R16). Ejemplo con un ejercicio de repeticiones y otro de tiempo.

**Sentadilla búlgara**

- **Músculos principales:** glúteos y cuádriceps.
- **Materiales:** una silla o banco estable; opcionalmente una mochila con peso.
- **Recomendado:** 3 × 10–12 por pierna (persona 1).
- **Pasos:**
  1. Párate de espaldas a la silla, a un paso largo de distancia.
  2. Apoya el empeine de una pierna sobre la silla, detrás de ti.
  3. Mantén el torso erguido, el pecho abierto y la mirada al frente.
  4. Baja doblando la rodilla de la pierna de adelante hasta que el muslo quede casi paralelo al suelo.
  5. Empuja con el talón de la pierna de adelante para volver a la posición inicial.
  6. Haz todas las repeticiones de un lado antes de cambiar de pierna.
- **Consejos de técnica:** la rodilla delantera sigue la dirección de los dedos del pie; el peso va sobre el talón y el medio del pie; baja con control.
- **Errores comunes:** poner el pie delantero demasiado cerca de la silla, dejar caer la rodilla hacia adentro, inclinar el torso hacia adelante.

**Plancha sobre antebrazos**

- **Músculos principales:** abdomen, hombros y glúteos.
- **Materiales:** una superficie cómoda o colchoneta.
- **Recomendado:** 3 × 25–40 s (persona 1); 3 × 20–30 s (persona 2 los lunes).
- **Pasos:**
  1. Acuéstate boca abajo y apoya los antebrazos en el suelo, con los codos debajo de los hombros.
  2. Apoya las puntas de los pies y levanta las rodillas y la cadera del suelo.
  3. Forma una línea recta desde la cabeza hasta los talones.
  4. Aprieta abdomen y glúteos, y respira de forma continua.
  5. Mantén la posición el tiempo indicado y baja con control.
- **Consejos de técnica:** mira al suelo con el cuello neutro; separa los pies al ancho de la cadera para estabilizarte.
- **Errores comunes:** hundir la cadera, subirla demasiado, aguantar la respiración.

---

## Outstanding Questions

### Deferred to Planning

- Cómo mostrar en la pantalla de entrenamiento los ejercicios "por lado" y los de tiempo o minutos para que el registro siga siendo rápido (R13, R24).
- Qué recuperación existe si alguien olvida su PIN (R2).
- Si se podrá registrar o corregir una sesión de un día pasado, y qué pasa con la racha (R31, R33).
- Redacción final de las guías de los ejercicios de ambas rutinas, a cargo de las dos personas, usando la forma del apéndice (R17).
- Tonos exactos de azul, cian y ámbar, y cómo se distinguen completado, pendiente y descanso sin usar verde ni rojo (R35, R40).
- Los nombres con los que se mostrará cada persona (R1, R34).
