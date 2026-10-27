# Plan — Informe a cinco días, cuerpos de correo y lectura del botón

> Estado: **APROBAR** (Cursor + Claude Code, 2026-10-26). La sección 12 manda. No implementar hasta que Fabian pida ejecutar.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. No tocar `16gqzy…` ni `17Syj1…`. No cambiar `scriptId`.
> Este plan no incluye `clasp push`, `clasp deploy` ni commit.

Reemplaza el plan del mismo archivo que ya tenía **APROBAR** el 2026-10-26. Las decisiones de aquel texto siguen, con estos cambios pedidos después: el aviso de faltantes sale solo, el correo de alertas lleva el aviso amarillo y la obligación, y el botón y el formulario se leen primero.

## 1. Qué pidió Fabian

1. Cinco días hábiles después de remitir las alertas, un informe de los RT que exigen observación y siguen sin respuesta.
2. Ese informe sale solo. Lo recibe la persona que envió las alertas. Si quedó correo de jefe inmediato, va en copia. El texto dice que pasaron cinco días hábiles sin respuesta a las observaciones que las alertas exigen. En avalúo, la línea muestra el nombre de esa regla.
3. El correo de respuesta cita el correo de origen, con fecha y asunto, y trae contexto. No queda solo el texto de la observación.
4. Correo a quien actualiza la base: en virtud del seguimiento, debe validar el estado actual, porque el gestor o el articulador informan que ya cuentan con la condición de la regla. Si esa condición es notificación de oferta, el texto dice notificación de oferta.
5. En el cuerpo del correo de alertas, un aviso amarillo: si usted no es el gestor del RT, notifique a su articulador para la actualización de los grupos de trabajo. El correo se remite a la persona que tiene la asignación. La respuesta es obligatoria en las alertas que la exigen.
6. El botón Responder observaciones se ve primero, con una frase inicial que dice que hay que pulsar ese botón para cargar las observaciones. El formulario se ordena igual, sin quitar campos.

La dirección visual sale de gstack `design-consultation`, aplicada a correo HTML y a la plantilla del formulario: estilos en línea, contraste del aviso amarillo, un solo botón principal. No se abre un sistema visual nuevo y no se borra contenido.

## 2. Qué hace el código hoy

`procesarReporteAlertas` (`Codigo.js`, cerca de 2705) arma el asunto con `_asuntoAlertas_` (2073): `Alerta temprana - {regla o Varias reglas} [{yyyy-MM-dd}]`. Las dos llamadas a `despacharCorreoAlertas_` (2853 y 2895) ya pasan `subject`. En modo gestor (2816) el destino es `GESTOR_EMAIL`. Si ese correo no es válido, usa el correo de respaldo o el correo único. El articulador entra en copia cuando `incluirArticuladorEnCopia` no es falso (2789, 2841).

`_botonResponderObservaciones_` (2057) es un enlace azul, padding `8px 12px`. `_buildResumenHtmlAgrupado` (2099) pone primero el título, luego el texto largo `TEXTO_BASE_CORREO_ALERTAS_` (2062), y el botón después (2159). Lo repite al final (2170). `_textoPlanoAlertas_` (2176) inserta la URL.

`despacharCorreoAlertas_` (`seguimiento_alertas.js`, 280) envía con `GmailApp.createDraft().send()`. Si hay filas con `exigir_observacion`, `registrarPendientesSeguimiento_` (197) guarda `CREADO_EN` como `yyyy-MM-dd HH:mm:ss` en `America/Bogota`, el token, los correos y los ids de Gmail. El último encabezado es `RESPONDIDO_POR` (línea 12). `_completarEncabezadosSeguimiento_` (101) solo agrega columnas al final.

Al guardar, `guardarSeguimientoAlertas` (426) cierra la pendiente, agrega `RESPONDIDA` y responde el hilo (564) con `Observaciones cargadas por {correo}` y el texto. El no uso reenvía ese mismo cuerpo al jefe (570). La revisión de estado escribe a `REVISOR_EMAIL` (575). Ese revisor ya es obligatorio en el envío cuando hay observación (2809–2813). El sistema no cambia el estado predial.

La condición está en `condiciones.criterios` de la regla. El motor la evalúa en `_cumpleCondiciones` (`evaluador_alertas.js`, 206). Los operadores de esa función son los de la tabla de la sección 6. `_calcularDiasHabiles` (449) cuenta de la fecha inicial hacia la final con el calendario `es.co#holiday@group.v.calendar.google.com` (433). No suma cinco días a partir de un envío. `instalarTriggerMotorReglas` (651) es manual, a las 6:00, y este plan no lo modifica.

`seguimiento_formulario.html` conserva una observación por RT, el texto previo en el textarea, “Con una respuesta basta”, revisión de estado, no uso y el archivo. El botón `guardar` aparece cuando hay filas.

Un envío nuevo marca `VENCIDA` la pendiente anterior del mismo RT y regla (213–220). Esas filas no son “sin respuesta” de este envío.

## 3. Decisiones cerradas

- El informe de faltantes es un correo. No hay pantalla nueva.
- Destino: `REMITENTE_EMAIL`. Copia a `JEFE_EMAIL` si es válido y distinto. Si el remitente está vacío, el correo va al jefe. Si ninguno es válido, no se envía y queda en el log.
- Un correo por `TOKEN`. Solo filas de ese token que siguen en `PENDIENTE`. Eso cubre las alertas que exigían observación, incluidos los avalúos que la exigen. No se filtra por la palabra avalúo: cada línea lleva el nombre de su regla, y si la regla es de avalúo ese nombre sale en la línea.
- El día del envío no cuenta. El quinto día hábil posterior, en `America/Bogota`, lunes a viernes, sin sábados, domingos ni festivos de ese calendario. Envío un lunes: el informe sale el lunes siguiente si no hay festivo.
- Si el calendario falla, se usan lunes a viernes y el cuerpo lo dice.
- Una sola vez por token. Columna `INFORME_PENDIENTES_EN` al final. La primera corrida también avisa los tokens cuyo quinto día ya pasó y siguen pendientes.
- `VENCIDA`, `CERRADA` y `RESPONDIDA` no entran.
- El aviso queda automático. No hay una función que Fabian deba ejecutar en el editor para encenderlo. Al enviar un correo que deja filas pendientes, `despacharCorreoAlertas_` asegura el trigger diario de las 7:00 si todavía no existe. Si crear el trigger falla, el correo de alertas igual sale y el error queda en el log.
- El trigger corre como la cuenta que publica el proyecto, porque la web app usa `USER_DEPLOYING`. No se mueve el trigger del motor de las 6:00.
- La respuesta sigue en `replyAll`. “El correo con asunto” es la fecha `CREADO_EN` y el asunto guardado. No se imprime el id de Gmail.
- El correo a la base sigue en `REVISOR_EMAIL` y solo en las filas con revisión de estado. Una observación corriente o un no uso no dicen que ya cuentan con la condición.
- La frase de la condición se lee del JSON. El valor de `EQUALS` se copia como está escrito. No se agrega un campo en el editor.
- El correo de alertas sigue dirigido al gestor asignado. Sin gestor válido, se mantiene el respaldo que ya usa `procesarReporteAlertas`. La copia al articulador no cambia. El aviso amarillo le dice a quien no sea el gestor que avise a su articulador para actualizar los grupos de trabajo.
- La respuesta es obligatoria solo en las alertas con `exigir_observacion`. El botón aparece cuando hay esas filas y hay URL, como hoy.
- Estética sin pérdida: siguen el texto base, los textos por regla, las notas, los filtros, los conteos, los RT, el estado predial, el adjunto, una observación por RT, el texto previo, revisión, no uso y el archivo.

## 4. Informe automático de RT sin respuesta

Archivo: `seguimiento_alertas.js`.

- `_festivosSeguimiento_(anio)` lee el mismo calendario y devuelve fechas `yyyy-MM-dd` con `Utilities.formatDate` en `America/Bogota`. Si falla, mapa vacío y `calendario: false`.
- `_sumarDiasHabiles_(fechaTexto, 5, festivos)` toma la fecha de `CREADO_EN` y devuelve el quinto hábil posterior.
- `_asegurarTriggerInformeSinRespuesta_()` mira `ScriptApp.getProjectTriggers()`. Si no está `triggerInformeSinRespuestaAlertas`, crea uno diario a las 7:00. Si ya hay uno, no crea otro. Se llama al final de `despacharCorreoAlertas_` cuando el envío dejó token.
- `triggerInformeSinRespuestaAlertas` agrupa `PENDIENTE` con `INFORME_PENDIENTES_EN` vacío. Si hoy es el quinto hábil o un día posterior, envía y marca la columna.
- `GmailApp.sendEmail`. Asunto: `Sin respuesta - alertas tempranas [{fecha del envío original}]`.
- Cuerpo: pasaron cinco días hábiles sin respuesta a las observaciones que estas alertas exigen; fecha y asunto del correo original; RT, proyecto, regla, nivel, gestor y articulador; la línea del calendario si no hubo festivos. Cuando la regla es de avalúo, el nombre de la regla lo dice.
- Un token que falle no corta los demás. Lock `waitLock(20000)`. Sin lock, no envía. Si el trigger falla entero, correo a `Session.getEffectiveUser().getEmail()`.
- Queda `eliminarTriggerInformeSinRespuestaAlertas` con `_exigirAdminMotorReglas_`, por si hay que apagarlo. No forma parte del uso diario.

`registrarPendientesSeguimiento_` guarda `ASUNTO` e `INFORME_PENDIENTES_EN` vacío. `despacharCorreoAlertas_` le pasa `o.subject`. `Codigo.js` no cambia por el asunto: las dos llamadas ya lo envían.

Encabezados, solo al final y en este orden: `RESPONDIDO_POR`, `ASUNTO`, `INFORME_PENDIENTES_EN`.

La fila `RESPONDIDA` copia `ASUNTO` y deja `INFORME_PENDIENTES_EN` vacío.

## 5. Cuerpo del correo de respuesta

En `guardarSeguimientoAlertas`, el texto de las líneas 556–558 y el correo de no uso (570) pasan a ser:

`En virtud del correo enviado el {fecha CREADO_EN} con asunto «{ASUNTO}», se envían las observaciones pertinentes al seguimiento de esas alertas tempranas.`

Si `ASUNTO` está vacío: la misma frase sin el asunto.

Después: quién respondió. Si el correo de la sesión es el gestor, se dice gestor. Si es el articulador, se dice articulador. Si no coincide con uno solo, se dice el correo.

Por cada RT: proyecto, regla, nivel, `Condición de la regla: {frase}`, observación, y las líneas actuales de no uso o de revisión.

Cierre: la observación queda en el seguimiento y responde al correo citado.

HTML con párrafos, datos escapados con `_escapeHtmlAlertaEmail`. El mismo cuerpo va al jefe cuando hay no uso.

## 6. Correo a quien actualiza la base

Mismo bloque `conRevision` (575). Destino `REVISOR_EMAIL`. Asunto: `Validar estado en la base - alertas tempranas`.

`En virtud del seguimiento y la validación de las alertas tempranas, se requiere validar el estado actual de estos RT en la base. El sistema no cambia el estado predial.`

`{Gestor o articulador} informa que ya cuentan con {frase de la condición}.`

Por RT: RT, proyecto, regla, nivel, observación, fecha del documento, frase de esa regla, fecha y asunto del correo original.

`_fraseCondicionRegla_(nombreRegla)` busca la regla por nombre en `obtenerReglasJSON` y recorre `condiciones.criterios`. Sin `criterios`, usa `condiciones` como un criterio, igual que el motor.

Las reglas guardadas usan `columna_estado`, `operador_estado` y `valores_estado`. `_fraseCondicionRegla_` no lee solo `columna`, `operador` y `valor`. El operador sale de `_aliasOperadorRegla_` (`motor_reglas.js`, 91): `operador_estado` o `operador`. La columna sale de `_aliasColumnaRegla_` (87): `columna_estado`, `columna_A` o `columna`. Esa función devuelve la columna en mayúsculas y así puede quedar en la frase. El valor sale de `valores_estado`, si no de `valores`, si no de `valor`, igual que `_cumpleCondiciones` (`evaluador_alertas.js`, 214). Si es una lista, se muestra separada por coma. El valor se copia como está escrito en la regla, sin pasarlo a mayúsculas. `motor_reglas.js` no se edita: solo se llaman esas dos funciones, que ya son globales en Apps Script.

Unión con “y” si `operador_logico` es `AND`, y con “o” si es `OR`:

| Operador | Texto |
| --- | --- |
| `EQUALS` | el valor, tal como está en la regla |
| `NOT_EQUAL` | un estado distinto de {valor} |
| `IN` | alguno de estos estados: {valores} |
| `NOT_IN` | un estado distinto de: {valores} |
| `IS_NULL` | {columna} sin dato |
| `IS_NOT_NULL` | {columna} con dato |
| `LESS_THAN` | {columna} menor que {valor} |
| `DATE_BEFORE_COLUMN` | {columna} anterior a {columna_destino} |
| `PERCENTAGE_BETWEEN_COLUMNS` | el porcentaje entre {columna} y {columna_destino} dentro del rango configurado |
| `DAYS_PASSED_LESS_THAN` | {columna} con antigüedad dentro del límite configurado |

Criterio anidado o regla no encontrada: `la condición configurada en la regla {nombre}`. No se escribe “notificación de oferta” si ese texto no está en la regla.

## 7. Correo de alertas: obligación, aviso amarillo y botón

Archivo: `Codigo.js`, funciones `_botonResponderObservaciones_`, `_buildResumenHtmlAgrupado` y `_textoPlanoAlertas_`.

Orden del HTML cuando hay obligación y URL:

1. Encabezado actual, con el destinatario.
2. Frase: `Para cargar las observaciones hay que pulsar el botón Responder observaciones.`
3. Frase: `La respuesta es obligatoria en las alertas que la exigen. Este correo se envía a la persona que tiene la asignación.`
4. El botón, una sola vez aquí, grande.
5. Aviso amarillo: `Si usted no es el gestor del RT, notifique a su articulador para la actualización de los grupos de trabajo.`
6. El texto introductorio que ya existe, los filtros, los conteos, los grupos de RT con sus notas y el aviso del archivo adjunto.
7. El botón otra vez, debajo del detalle.

El botón usa tabla y enlace, porque varios clientes de correo ignoran márgenes de un `div`. Fondo `#1f3a5f`, texto blanco, padding `14px 22px`, tamaño 16px, peso 700, texto `Responder observaciones`. La URL sigue saliendo de `_urlSeguimientoAlertas_`.

El aviso amarillo: fondo `#fff8e1`, borde `#e6b800`, texto `#5c4813`. No usa texto amarillo sobre fondo amarillo.

Sin obligación, no se agregan el botón, la frase de pulsar ni el aviso amarillo. El resto del informe sigue.

El texto plano lleva las mismas tres frases y la URL al inicio y al cierre. No depende del color.

No se cambia a quién se envía. El `to` sigue siendo el gestor asignado.

## 8. Formulario

Archivo: `seguimiento_formulario.html`. Solo presentación y el orden de lectura. Siguen los `id` y las clases que usa el script: `estado`, `lista`, `guardar`, `texto`, `no-uso`, `aviso-ok`, `informe`, `revision`, `fecha-doc`, `aviso-no-uso`, `caja-revision`.

- Banda superior `#1f3a5f` con el título en blanco.
- Debajo, la frase de una respuesta y los dos caminos que ya están escritos: no uso con un archivo, y revisar observación con fecha y evidencia en los repositorios.
- Cada RT en tarjeta. Borde izquierdo según nivel: crítica `#c0392b`, riesgo `#e67e22`, preventiva `#f1c40f`.
- El textarea y la nota “Viene la observación anterior” se quedan.
- `Guardar y enviar` a lo ancho, padding `14px`, tamaño 16px. Sigue oculto hasta que haya filas.

No se agrega ahí el botón del correo. Ese botón vive en el mensaje.

## 9. Archivos

| Archivo | Cambio |
| --- | --- |
| `seguimiento_alertas.js` | Columnas, asunto, días hábiles, trigger automático, cuerpos de respuesta y de revisor |
| `Codigo.js` | Frase inicial, obligación, aviso amarillo y botón más visible. El asunto y el destino no se reescriben |
| `seguimiento_formulario.html` | Jerarquía visual. Los campos y el script de guardado siguen |
| `DOCUMENTACION_TECNICA_VIVA.md` | Una sección al ejecutar, firmada Cursor |
| `evaluador_alertas.js` | No se toca |
| `motor_reglas.js` | No se edita. La frase llama a `_aliasColumnaRegla_` y `_aliasOperadorRegla_` |
| `app_reglas_editor_js.html` | No se toca |
| `appsscript.json` | No se toca. Ya tiene calendario y triggers |
| `pac_triggers.js`, `pac_api.js` | No se tocan |

## 10. Fuera de este plan

- No se reenvían correos ya mandados ni se llena `ASUNTO` en filas viejas.
- No se instala el trigger a mano como paso de Fabian. Se asegura al enviar.
- No se publica una versión de Apps Script en este plan.
- No se cambia el motor de las 6:00 ni `_calcularDiasHabiles`.
- No se abre el informe de faltantes al gestor ni al articulador. Ellos ya recibieron la alerta.
- No se manda el correo de base si no marcaron revisión de estado.
- No se quita el Excel adjunto, el informe al jefe inmediato ni los filtros del correo.

## 11. Prueba, cuando se ejecute

- `node --check` en `seguimiento_alertas.js` y `Codigo.js`.
- `node scripts/lint-html-scripts.js` sobre `seguimiento_formulario.html`.
- Comprobación de `_sumarDiasHabiles_`: lunes más cinco hábiles es el lunes siguiente; viernes más cinco es el viernes siguiente; un festivo corre un día.
- No se envía correo de prueba a terceros desde aquí.

## 12. Auditoría

Claude Code, sesión claude.ai, solo lectura. Primera pasada: leyó el plan, `seguimiento_alertas.js`, `Codigo.js`, `evaluador_alertas.js`, `seguimiento_formulario.html`, `motor_reglas.js` y `appsscript.json`. El trigger automático, el aviso amarillo, el botón y los campos del formulario encajan con el código. Pidió un cambio: la frase de la condición tiene que leer `columna_estado`, `operador_estado` y `valores_estado`, porque así están guardadas las reglas. Veredicto de esa pasada: **APROBAR CON CAMBIOS**.

Ese párrafo quedó en la sección 6. Segunda pasada: releyó la sección 6, `motor_reglas.js` líneas 87–93 y `evaluador_alertas.js` línea 214. Veredicto: **APROBAR**.

Veredicto de Cursor: **APROBAR**. El plan se puede ejecutar cuando Fabian lo pida. No se tocó código de la aplicación.
