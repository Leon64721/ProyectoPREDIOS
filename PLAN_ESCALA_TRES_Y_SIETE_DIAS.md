# Plan — Respuesta a tres días y aviso al séptimo

> Estado: **APROBAR** (Cursor + Claude Code, 2026-10-26). La sección 8 manda. No implementar hasta que Fabian pida ejecutar.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. No tocar `16gqzy…` ni `17Syj1…`. No cambiar `scriptId`.
> Este plan no incluye `clasp push`, `clasp deploy` ni commit.
> Sustituye solo el plazo de cinco días de `PLAN_INFORME_SIN_RESPUESTA_Y_CUERPO.md`. El botón, el aviso amarillo, el cuerpo de la respuesta y el correo a quien actualiza la base siguen como están.

Dirección de flujo: gstack `plan-eng-review`. El cambio es de plazos y destinatarios sobre el trigger que ya existe. No abre pantalla ni consulta el módulo de equipos.

## 1. Qué pidió Fabian

Las observaciones que exigen respuesta y siguen sin ella escalan así:

1. En el correo de las alertas queda escrito que la respuesta se requiere dentro de los próximos tres días hábiles. Si no llega, se informa al articulador. Si sigue sin llegar, se informa a quien remitió la alerta y al jefe inmediato.
2. A los tres días hábiles, el articulador recibe el listado de los RT a su cargo y el gestor de cada uno que todavía no respondió. El texto le pide gestionar esa respuesta con su equipo de trabajo.
3. Pasados esos tres días y otros tres, al séptimo día hábil, quien remitió la alerta recibe el listado que sigue pendiente, con copia al jefe inmediato.

“Observaciones con respuesta que no tienen respuesta” se lee como las filas que exigían observación y siguen en `PENDIENTE`. Una fila `CERRADA`, `RESPONDIDA` o `VENCIDA` no entra.

“Jefe inmediata” es el mismo correo `JEFE_EMAIL`. El texto visible sigue diciendo jefe inmediato, que es el nombre ya usado en el producto.

## 2. Qué hace el código hoy

`triggerInformeSinRespuestaAlertas` (`seguimiento_alertas.js`, 814) corre a las 7:00. Lo crea `_asegurarTriggerInformeSinRespuesta_` (653) la primera vez que un envío deja token. Agrupa filas `PENDIENTE` con `INFORME_PENDIENTES_EN` vacío, por `TOKEN`. Si hoy es el quinto día hábil de `CREADO_EN`, o uno posterior, `_enviarInformeSinRespuesta_` (775) escribe a `REMITENTE_EMAIL` y, si `JEFE_EMAIL` es válido y distinto, lo pone en copia. El texto dice “cinco días hábiles”. El gestor sale como `GESTOR_EMAIL`.

`_sumarDiasHabiles_` (616) ya suma N días hábiles a una fecha `yyyy-MM-dd`, saltando sábado, domingo y el mapa de festivos. No hay que reescribirla.

Los encabezados terminan en `ASUNTO`, `INFORME_PENDIENTES_EN` (líneas 12–13). `_completarEncabezadosSeguimiento_` solo agrega al final.

El correo de alertas, en `_contextoBotonObservaciones_` (`Codigo.js`, 2065) y en el texto plano (2222), dice que la respuesta es obligatoria y que hay que pulsar el botón. No dice el plazo de tres días ni la escala.

`ALERTAS_ACTIVAS` guarda `GESTOR_EMAIL` y `ARTICULADOR_EMAIL`. No hay una columna de nombre del gestor distinta del correo. `GESTOR JURÍDICO`, cuando no es un correo, no se copia a la alerta (`evaluador_alertas.js`, 509–511). El pendiente guarda `GESTOR_EMAIL` y `ARTICULADOR_EMAIL`, no el nombre visible de `ARTICULADOR`.

`getGestoresPorArticulador` (`gestion_equipos_backend.js`, 901) resuelve nombres con el alcance de equipos. El trigger diario no debe llamarla: lee permisos y relaciones que este aviso no necesita.

## 3. Decisiones cerradas

- El día del envío no cuenta. Los plazos usan `_sumarDiasHabiles_` con el mismo calendario de festivos. Si el calendario falla, lunes a viernes, y el cuerpo lo dice.
- Día hábil 3: correo al articulador. Día hábil 7: correo a quien remitió, con copia al jefe inmediato. El aviso de cinco días desaparece. No salen los tres.
- “Seis días” son los tres del primer plazo más los tres siguientes. El aviso a quien remitió y al jefe es el séptimo día hábil, el siguiente a esos seis.
- Ejemplo, sin festivos: envío el lunes 2026-10-26. El articulador recibe el jueves 2026-10-29. Quien remitió y el jefe reciben el miércoles 2026-11-04.
- Un correo de articulador por dirección y por corrida. Reúne los RT de esa persona que ya cumplieron el día 3 y todavía no tienen `INFORME_ARTICULADOR_EN`, aunque vengan de envíos distintos.
- El del día 7 sigue siendo uno por `TOKEN`, solo con las filas de ese token que siguen en `PENDIENTE`.
- Cada aviso se marca una vez. Columna nueva, al final: `INFORME_ARTICULADOR_EN`. `INFORME_PENDIENTES_EN` pasa a ser la marca del día 7. No se renombra: el completador rechaza un cambio de orden.
- Sin correo de articulador válido, ese RT no se marca y queda en el log. El día 7 no depende de que el del día 3 haya salido.
- El gestor del listado es `GESTOR_EMAIL`. Si está vacío, la línea dice `sin gestor asignado`. No se consulta equipos para buscar un nombre.
- La primera corrida también envía lo ya vencido: día 3 o más para el articulador, día 7 o más para quien remitió. Una vez cada uno.
- El trigger de las 7:00 no cambia de hora ni de forma de instalación.
- Quien ya respondió no aparece. La fila dejó de ser `PENDIENTE`.

## 4. Correo de las alertas

Archivo: `Codigo.js`. Solo el texto de `_contextoBotonObservaciones_` y las mismas frases en `_textoPlanoAlertas_` (el bloque que empieza en 2222). El botón, el aviso amarillo, el destinatario gestor y el asunto no se mueven.

Se agrega, cuando hay obligación y URL, después de la frase de obligación:

`Se requiere la respuesta dentro de los próximos tres días hábiles. Si no se cuenta con ella, se remitirá un informe al articulador. Si al séptimo día hábil sigue sin respuesta, se informará a quien remitió la alerta y al jefe inmediato.`

El texto plano lleva la misma frase junto a las que ya existen.

## 5. Los dos avisos

Archivo: `seguimiento_alertas.js`.

`triggerInformeSinRespuestaAlertas` deja de usar el quinto día. En la misma corrida, con el mismo lock:

1. Filas `PENDIENTE` con `INFORME_ARTICULADOR_EN` vacío y hoy mayor o igual al tercer hábil. Se agrupan por `ARTICULADOR_EMAIL`. Un envío por grupo. Si sale, se escribe la fecha de hoy en esa columna.
2. Filas `PENDIENTE` con `INFORME_PENDIENTES_EN` vacío y hoy mayor o igual al séptimo hábil. Se agrupan por `TOKEN`. Un envío por token. Si sale, se escribe la fecha en `INFORME_PENDIENTES_EN`.

Asunto del articulador: `Gestionar respuesta - alertas tempranas [{fecha del más antiguo del grupo}]`.

Cuerpo: pide gestionar con su equipo de trabajo la respuesta de los RT a su cargo que siguen sin observación. Lista `RT`, proyecto, regla, nivel y gestor. Dice que, si al séptimo día hábil sigue sin respuesta, se informará a quien remitió la alerta y al jefe inmediato.

Asunto del día 7: `Sin respuesta - alertas tempranas [{fecha del envío original}]`.

Cuerpo: pasaron siete días hábiles sin respuesta a las observaciones que estas alertas exigen. Cita fecha y asunto originales, como ya hace `_enviarInformeSinRespuesta_`. Lista RT, proyecto, regla, nivel y gestor. Destino y copia iguales a los de hoy: remitente, y jefe si el correo es válido y distinto. Si no hay remitente, va al jefe. Si no hay ninguno, no se envía y no se marca.

Un grupo que falle no corta los demás. El fallo de toda la función sigue avisando a `Session.getEffectiveUser().getEmail()`.

La fila `RESPONDIDA` deja `INFORME_ARTICULADOR_EN` vacío. `registrarPendientesSeguimiento_` también lo deja vacío en la pendiente.

## 6. Archivos

| Archivo | Cambio |
| --- | --- |
| `seguimiento_alertas.js` | Día 3 al articulador, día 7 a quien remitió y al jefe, columna nueva |
| `Codigo.js` | La frase de los tres días y del séptimo, en HTML y en texto plano |
| `DOCUMENTACION_TECNICA_VIVA.md` | Una sección al ejecutar, firmada Cursor |
| `evaluador_alertas.js` | No se toca |
| `gestion_equipos_backend.js` | No se toca |
| `seguimiento_formulario.html` | No se toca |
| `motor_reglas.js`, `appsscript.json`, `pac_triggers.js`, `pac_api.js` | No se tocan |

## 7. Fuera de este plan y prueba

- No se reescriben correos ya enviados.
- No se cambia el formulario, el cuerpo de la respuesta ni el correo a quien actualiza la base.
- No se publica una versión de Apps Script en este plan.
- Cuando se ejecute: `node --check` en los dos archivos. Con `_sumarDiasHabiles_`, lunes 2026-10-26 más 3 es 2026-10-29, y más 7 es 2026-11-04. No se envían correos de prueba a terceros.

## 8. Auditoría

Claude Code, sesión claude.ai, solo lectura. Leyó el plan, `seguimiento_alertas.js`, `Codigo.js` y `evaluador_alertas.js`, y confirmó `getGestoresPorArticulador` en `gestion_equipos_backend.js`.

Confirmó el aviso actual a los cinco días, que `_sumarDiasHabiles_` sirve para 3 y para 7, que el completador solo agrega columnas al final, que la frase nueva cabe en el correo sin mover destinatario ni asunto, y que `ALERTAS_ACTIVAS` no tiene un nombre de gestor distinto de `GESTOR_EMAIL`. No pidió cambios.

Veredicto de Claude Code: **APROBAR**.

Veredicto de Cursor: **APROBAR**. El plan se puede ejecutar cuando Fabian lo pida. No se tocó código de la aplicación.
