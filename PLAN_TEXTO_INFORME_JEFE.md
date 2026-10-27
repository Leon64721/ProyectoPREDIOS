# Plan — Texto formal del informe al jefe inmediato

Estado: APROBAR CON CAMBIOS. Claude Code pidió no limitar el término a las alertas críticas, porque la observación se exige por regla y por nivel. La ejecución usa «las alertas que exigen observación».

## 1. Qué se revisó del ajuste anterior

El `clasp push` del commit `f768978` sí quedó en el script `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. La frase de los tres días hábiles está en `Codigo.js`, funciones `_contextoBotonObservaciones_` y `_textoPlanoAlertas_`.

Esa frase entra solo en el correo de alertas que recibe el gestor, y solo cuando el envío exige observación y tiene enlace. No entra en el informe al jefe inmediato.

El correo que se está leyendo es el de `_htmlInformeJefatura_` (`Codigo.js`, alrededor de la línea 2598). Ahí sigue el texto técnico:

- «Este informe trae solo las alertas de este envío…»
- «La fecha de vencimiento sale de la fecha de inicio de la regla… FECHA AVALUO más 365 días…»

Ese párrafo no formaba parte del ajuste de tres y siete días. Por eso no aparece un término de respuesta en ese correo.

## 2. Qué se va a cambiar

Solo la redacción del informe que ya se envía al jefe inmediato, en HTML y en texto plano. El asunto sigue: `Informe de jefe inmediato - {regla o Varias reglas} [fecha]`.

Se mantienen la tabla por articulador y proyecto, la gráfica, el Excel, los conteos de respuesta y el destinatario.

Se quitan del cuerpo las dos frases técnicas de cómo se calcula la fecha de vencimiento. Esa fecha sigue en el Excel.

## 3. Redacción

Apertura:

Cordial saludo.

Se remite el informe consolidado de las alertas tempranas de este envío (N).

Tipo de alerta: {nombres de las reglas de este envío}. Niveles incluidos: {Crítica, Riesgo, Preventiva, los que vengan}.

Un párrafo por cada regla distinta del envío:

- Si la regla tiene `texto_inicial_correo` en Retroalimentación, se usa ese texto. Es el que el equipo ya redactó para esa regla.
- Si no tiene texto y el nombre contiene «avalúo» o «avaluo», se usa: «Los predios de esta alerta no cuentan, a la fecha, con una oferta notificada. Por esa razón el avalúo aparece sin uso.»
- En cualquier otra regla sin texto propio: «Los predios de este grupo corresponden a la regla «{nombre}», de acuerdo con la condición configurada en el tablero.»

Cierre de proceso, igual para todos los envíos:

Las observaciones que estas alertas exigen las registran los gestores responsables de cada predio. El término para presentarlas es de tres días hábiles, contados desde el día siguiente al envío. Si no se reciben en ese término, se informa al articulador. Si al séptimo día hábil continúan sin respuesta, se informa a quien remitió la alerta y al jefe inmediato.

El archivo adjunto relaciona cada predio, los días de vigencia y la fecha de vencimiento.

Los conteos actuales se redactan así: «Estado de las respuestas de este envío: respondidas, N; pendientes, N; procesos que no se van a usar, N; solicitudes de revisión de estado, N.»

## 4. Lo que este plan no hace

No crea un segundo correo automático para cuando todas las observaciones estén listas. Cada gestor recibe su propio enlace, así que hoy no hay un cierre único de las 49 alertas. El consolidado que se remite al jefe es este informe. Decir que después se enviará otro correo dejaría una promesa que el sistema no cumple.

No se cambia el formulario, el botón, el aviso de tres y siete días, el motor, los equipos ni `appsscript.json`.

## 5. Archivos

- `Codigo.js`: nuevas ayudas `_reglasDelInforme_` y `_textoReglaInformeJefe_`. `_htmlInformeJefatura_` recibe los textos de las reglas. `_enviarInformeJefatura_` y `_anexarInformeJefatura_` los pasan desde `procesarReporteAlertas`, donde ya existe `textosIniciales`.
- `DOCUMENTACION_TECNICA_VIVA.md`: una sección nueva, sin borrar las anteriores.

## 6. Validación

`node --check` de `Codigo.js`. Claude Code audita el diff y confirma que el plazo de tres días sigue en el correo del gestor y que el informe al jefe ya no trae la frase de FECHA AVALUO más 365 días.
