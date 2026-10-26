# Plan — Una observación, texto reutilizable e informe al jefe inmediato

> Estado: **APROBAR** (Cursor + Claude, 2026-10-26). La sección 12 manda. No implementar hasta que Fabian pida ejecutar.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. No tocar `16gqzy…` ni `17Syj1…`.
> No hace `clasp push` ni despliegue. No toca el motor de reglas, PAC, equipos ni normalización.
> gstack `/plan-eng-review` es un cuestionario interactivo. Fabian ya cerró los tres cambios. Este plan usa su lista de control (flujo, bordes, pruebas, fuera de alcance) y no abre otra entrevista.

## 1. Qué pide Fabian

1. Si una alerta exige observación, hoy se pide dos veces: una al gestor y otra al articulador. Debe quedar **una sola** por alerta. La llena cualquiera de los dos.
2. La observación del mes anterior hoy se muestra solo como consulta. Debe entrar **en el cuadro de texto**, como respuesta de este mes. Si quieren cambiarla, la editan. Si sigue igual, no la vuelven a redactar.
3. El informe que hoy dice "jefatura" pasa a decir **jefe inmediato**. En el cuadro del correo se quita la columna de vencidos. Los rangos dejan de ser 15 y 30 días. Quedan **0 a 30, 30 a 60, 60 a 90 y mayor de 90**. El cuadro se agrupa por **articulador y proyecto**, no por gestor.

## 2. Qué hace el código hoy

### 2.1 Dos observaciones por la misma alerta

`despacharCorreoAlertas_` (`seguimiento_alertas.js`) arma un token por correo y llama a `registrarPendientesSeguimiento_`. Esa función, por cada alerta que exige observación, llama a `_personasPendiente_` (línea 191).

Si el gestor y el articulador son correos distintos, `_personasPendiente_` devuelve **dos objetos**: uno solo con `GESTOR_EMAIL` y otro solo con `ARTICULADOR_EMAIL`. Cada uno se inserta como fila `PENDIENTE` del mismo token.

`_filasVisiblesDelToken_` muestra la fila si el correo de la sesión es el gestor o el articulador. Cada persona ve la suya y `guardarSeguimientoAlertas` cierra solo las que esa persona ve. Hacen falta las dos respuestas. El administrador, en el mismo enlace, ve las dos tarjetas del mismo RT.

Si los dos correos son iguales, ya sale una sola fila. Ese caso no se toca en el resultado.

El correo al gestor, con el articulador en copia, no se parte. La duplicación está en la hoja y en el formulario, no en un segundo envío.

`doGet`, si `sa` es válido, abre `seguimiento_formulario.html` y no carga el tablero.

### 2.2 La observación anterior es solo lectura

`obtenerSeguimientoPorToken` manda `observacionVigente`, que es el `OBSERVACION_VIGENTE` de la última fila `RESPONDIDA` de ese RT y esa regla (`_observacionVigente_`).

En `seguimiento_formulario.html`, `pintar` pone ese texto en un bloque "Observación anterior" y deja vacío el `textarea` "Agregar observación".

Al guardar, `guardarSeguimientoAlertas` arma la vigente así, antes del candado y otra vez dentro del candado:

`previa + salto de línea + fecha + texto nuevo`

Si el cuadro trajera ya la previa y además se concatenara, el mes siguiente duplicaría el texto.

### 2.3 Informe

`_cuboVencimiento_` y `_cuboFilaInforme_` (`Codigo.js`, cerca de las líneas 2274 y 2461) clasifican así: vencida (días negativos), hasta 15, de 16 a 30, después de 30, sin fecha. Primero usan `FECHA_VENCIMIENTO`. Si no hay fecha, usan `DIAS RESTANTES`.

`_htmlInformeJefatura_` y la hoja Totales de `_xlsxInformeJefatura_` agrupan por articulador y **gestor**, con columnas Vencidas, Hasta 15 días, De 16 a 30, Después y Sin fecha. La torta usa las mismas etiquetas. El título, el asunto, el texto plano, el nombre del archivo y los avisos de la pantalla dicen "jefatura".

Los textos visibles están en:

- `Codigo.js`: título, asunto, texto plano, mensajes de resultado, error de envío, error de exportación y nombre `Informe_Jefatura_Alertas_`.
- `app_alertas_js.html`: etiqueta, placeholder, ayuda y el toast.
- `seguimiento_alertas.js`: dos errores, el del envío y el del no uso.
- `app_reglas_editor_js.html`: `TEXTO_AVALUO_AVISO`, la frase "jefatura inmediata".

La columna de la hoja sigue siendo `JEFE_EMAIL`. El motor puede registrar un día negativo si los umbrales de la regla lo alcanzan. Fabian trabaja con avalúos que ya no entran a la alerta cuando se vencen, y por eso la columna Vencidas sale vacía o no le sirve. Las columnas de 15 y 30 también salen vacías porque la vigencia útil de esos avalúos es más larga: casi todo cae en "Después".

## 3. Una sola observación

`_personasPendiente_` devuelve siempre **un** objeto, con los dos correos en la misma fila:

`{ GESTOR_EMAIL: gestor, ARTICULADOR_EMAIL: art }`

Si falta uno, ese campo va vacío. Si faltan los dos, la fila queda con los dos vacíos, como hoy, y solo la responde un administrador.

Dentro del mismo envío, si el mismo RT y la misma regla vinieran repetidos, se inserta una sola fila. Se conservan los correos de la primera.

No se reescriben tokens ya enviados. En el próximo envío, las `PENDIENTE` viejas de ese RT y esa regla pasan a `VENCIDA`, que es lo que `registrarPendientesSeguimiento_` ya hace.

`_filasVisiblesDelToken_` no cambia de regla: con los dos correos en la misma fila, el gestor y el articulador ven la misma tarjeta. El primero que envía la cierra. El otro, si abre después, ve que ya no hay pendientes. El administrador ve una tarjeta por alerta, no dos.

La tarjeta no dice "Gestor" ni "Articulador" cuando los dos correos están presentes. `dirigidoA` ya queda vacío en ese caso. Encima del cuadro, una línea: "La puede registrar el gestor o el articulador. Con una respuesta basta."

No cambia el Para ni la copia del correo de alertas. No cambia quién puede entrar: sigue haciendo falta rol en Permisos.

## 4. El texto anterior entra al editor

En `seguimiento_formulario.html` se quita el bloque "Observación anterior". El `textarea` se etiqueta "Observación" y nace con `observacionVigente`. Si no hay anterior, nace vacío. Debajo, si había texto: "Viene la observación anterior. Puedes dejarla o modificarla."

El valor se mete escapado dentro del `textarea`, con la función `escapar` que ya existe, para que un `<` del texto no rompa la página. Los saltos de línea se conservan.

Al guardar, el texto del cuadro es la observación de este mes:

- `OBSERVACION_PREVIA` = la vigente anterior, para no perder el historial de la hoja.
- `OBSERVACION_NUEVA` = el texto enviado, completo.
- `OBSERVACION_VIGENTE` = el mismo texto enviado. **No** se le antepone la previa ni la fecha.

La fecha sigue en `RESPONDIDO_EN`. El mes siguiente el cuadro abre con lo que dejaron escrito. Si no lo tocan, se guarda igual y no crece en cada envío.

Las dos asignaciones de `vigente` en `guardarSeguimientoAlertas` cambian. Si se deja una, el candado vuelve a concatenar.

Un cuadro vacío sigue rechazado, en la página y en el servidor. Borrar el texto anterior y enviar en blanco no guarda. No uso, aviso, archivo único y revisión de estado siguen igual. El correo de respuesta sigue llevando el texto que enviaron.

`app_seguimiento_alertas_js.html` no se abre con `?sa=`: `doGet` responde el formulario antes de cargar `Index.html`. No se reescribe ese modal. Sigue desactualizado (pide dos archivos). Queda fuera de este cambio.

## 5. Informe al jefe inmediato

Solo cambian los textos que ve la persona. No se renombra `JEFE_EMAIL`, ni `_htmlInformeJefatura_`, ni las demás funciones. Un cambio de nombre interno no cambia el correo y obliga a tocar llamadas que ya funcionan.

Textos nuevos:

| Dónde | Texto |
| --- | --- |
| Modal de envío | Correo del jefe inmediato |
| Placeholder | jefe@dominio.gov.co |
| Ayuda fija, ayuda dinámica y toast | jefe inmediato. La ayuda no dice "jefatura": dice "informe gerencial" y también se cambia |
| Errores de `Codigo.js` y `seguimiento_alertas.js` | jefe inmediato |
| Título del correo | Informe de jefe inmediato — alertas tempranas |
| Asunto | `Informe de jefe inmediato - ` en lugar de `Informe de jefatura - ` |
| Texto plano y mensajes de resultado | jefe inmediato |
| Archivo | `Informe_Jefe_Inmediato_Alertas_` más la fecha |
| Aviso de avalúo en el constructor | jefe inmediato |

`TEXTO_AVALUO_AVISO` solo afecta la próxima vez que alguien pulse el botón de pegar ese aviso. Las reglas que ya guardaron la frase vieja no se reescriben.

En `app_alertas_js.html` la ayuda no se cubre buscando la palabra "jefatura". El texto fijo de `#ayudaJefeAlertas` (línea 813) dice "informe gerencial". Al abrir el modal, el callback de `requiereCorreoJefeSeguimiento` (líneas 962-965) lo reemplaza por una de dos frases, y las dos también dicen "informe gerencial". Esas tres frases pasan a "informe de jefe inmediato". Si el ejecutor solo reemplaza "jefatura", el modal queda con "Correo del jefe inmediato" arriba y "informe gerencial" abajo.

### 5.1 Rangos, sin columna de vencidos

Cada alerta entra en un solo rango. El día 30, el 60 y el 90 no se cuentan dos veces:

| Columna | Días de vigencia |
| --- | --- |
| 0 a 30 | 0 a 30, inclusive |
| 31 a 60 | 31 a 60 |
| 61 a 90 | 61 a 90 |
| Mayor de 90 | 91 o más |

Es la lectura sin solape de "0 a 30, 30 a 60, 60 a 90 y mayor de 90". Los encabezados dicen 0 a 30, 31 a 60, 61 a 90 y Mayor de 90, para que el número del borde no parezca repetido.

El día que se usa es `DIAS RESTANTES` cuando es un número, también si es cero. Es el mismo dato que ya ve el gestor en el cuerpo del correo. Si esa celda no es un número, se usan los días de calendario hasta `FECHA_VENCIMIENTO`, con `_diasHastaVencimiento_`.

`_cuboFilaInforme_` devuelve solo uno de estos valores: `d30`, `d60`, `d90`, `mas90`, `sin`, o `null` si el día es negativo. `_cuboVencimiento_` no puede seguir devolviendo `vencida`. Si se conserva, devuelve los mismos códigos a partir de un número de días, o el ejecutor concentra la decisión en `_cuboFilaInforme_` y deja de usar el código viejo.

No hay columna Vencidas ni porción de torta para vencidas. Un día negativo devuelve `null`. `_conteoVencimientos_` y los dos bucles que hacen `grupos[clave][cubo]++` (el HTML y la hoja Totales) saltan `null`. Si no lo saltan, al quitar la clave `vencida` del objeto la cuenta pasa a `NaN` o aparece una columna fantasma. Ese RT sigue en la hoja Detalle del Excel. Fabian no espera verlos en el cuadro: el avalúo vencido no entra a la alerta.

Sin fecha solo aparece si alguna alerta del envío no tiene día calculable. Si todas tienen día, esa columna no se pinta, ni en el correo ni en la torta.

Si todos los avalúos de un envío superan 90 días, solo "Mayor de 90" trae números. Las otras columnas quedan en cero porque no hay predios en ese rango.

La torta y los datos del gráfico de la hoja Totales usan estos mismos cuatro rangos, más Sin fecha solo cuando haya alguna. El título de la torta pasa a "Días de vigencia de este envío".

### 5.2 Agrupado por articulador y proyecto

La clave es el nombre de `ARTICULADOR` y `PROYECTO`. Vacío pasa a "Sin articulador" o "Sin proyecto". No se agrupa por gestor. Dos gestores del mismo articulador y el mismo proyecto suman en la misma fila.

Cada fila del cuadro es una alerta del envío, no un RT distinto. El orden es articulador y, dentro, proyecto. Se oculta solo la fila que queda en cero en todas las columnas que sí se pintan, incluida Sin fecha cuando esa columna aparece. Un articulador y proyecto que solo tiene alertas sin fecha sí se muestra.

La hoja Detalle del Excel no cambia de columnas. La hoja Totales sí: Articulador, Proyecto, y los rangos nuevos. El título de ese bloque deja de decir "Vencimientos por articulador y gestor" y pasa a "Vigencia por articulador y proyecto".

El párrafo de respondidas, pendientes, no uso y revisión se deja como está el código. `_historialSeguimientoInforme_` marca respondida cualquier fila `RESPONDIDA` de ese RT y esa regla, sin mirar el token. Como el informe sale al crear las pendientes, ese número puede incluir respuestas de meses anteriores. No es "solo este envío". Corregirlo queda fuera de estos tres cambios.

## 6. Fases

El ejecutor no salta fases ni agrega pantallas.

### F1 — Una fila por alerta

- **Archivos:** `seguimiento_alertas.js`, función `_personasPendiente_` y el armado de filas en `registrarPendientesSeguimiento_`. Una línea de ayuda en `seguimiento_formulario.html`.
- **Hecho cuando:** gestor y articulador distintos producen una fila `PENDIENTE`, con los dos correos. Cualquiera de los dos la ve. Al enviarla, el otro ya no tiene pendiente de ese RT. El administrador ve una tarjeta.

### F2 — Texto en el editor

- **Archivos:** `seguimiento_formulario.html` (`pintar`) y `guardarSeguimientoAlertas` en `seguimiento_alertas.js`, las dos asignaciones de `vigente`.
- **Hecho cuando:** con una `RESPONDIDA` previa, el cuadro abre con ese texto y sin el bloque de consulta. Guardar sin editar deja `OBSERVACION_VIGENTE` igual al texto enviado, no la previa concatenada. Guardar vacío no escribe.

### F3 — Informe al jefe inmediato

- **Archivos:** `Codigo.js` (cubos, HTML, Excel, asunto, textos), `app_alertas_js.html` (etiqueta, placeholder, toast, ayuda fija de la línea 813 y las dos frases del callback de `requiereCorreoJefeSeguimiento`, líneas 962-965), los dos mensajes de `seguimiento_alertas.js`, `TEXTO_AVALUO_AVISO` en `app_reglas_editor_js.html`.
- **Hecho cuando:** el correo y el Excel no dicen jefatura. No hay columna Vencidas. Un día negativo no suma y no produce `NaN`. Un día 10 cae en 0 a 30, un día 45 en 31 a 60, un día 75 en 61 a 90 y un día 120 en Mayor de 90. La fila agrupa articulador y proyecto. Un grupo que solo tiene alertas sin fecha sigue visible. El título de Totales dice articulador y proyecto.

### F4 — Bitácora

- Entrada corta en `DOCUMENTACION_TECNICA_VIVA.md`, firmada Cursor, después de implementar.
- `graphify update .`
- Sin commit, sin `clasp push` y sin regenerar DOCX o PDF, salvo que Fabian lo pida.

## 7. Pruebas

Antes de subir, sin Gmail:

1. `node --check` en `seguimiento_alertas.js` y `Codigo.js`. Lint del formulario.
2. Lectura del HTML del cuadro con una observación que tenga `<` y un salto de línea: el cuadro muestra el carácter y el salto, y la página no se parte.
3. Casos del cubo, en comentario o en una prueba local que no llame a Sheets: −1 no entra a ninguna columna; 0 y 30 entran en 0 a 30; 31 y 60 en 31 a 60; 61 y 90 en 61 a 90; 91 en Mayor de 90; texto vacío cae en sin fecha.

Con Fabian, en la URL de desarrollo, después de que pida la subida:

1. Una alerta con gestor y articulador distintos. El enlace muestra una sola observación. La responde uno. El otro abre y ya no está pendiente.
2. Un RT que ya tenía observación. El cuadro trae ese texto. Se envía sin cambiarlo. La hoja no duplica el párrafo.
3. Un envío con correo de jefe inmediato. El cuadro no dice jefatura ni vencidas, agrupa por articulador y proyecto, y un avalúo de más de 90 días no cae en una columna corta.

## 8. Fuera de alcance

- No cambiar el motor ni los umbrales que deciden si un avalúo vencido entra a `ALERTAS_ACTIVAS`.
- No migrar filas `PENDIENTE` de envíos ya hechos. El próximo envío las marca `VENCIDA`.
- No reescribir reglas que ya guardaron la frase "jefatura inmediata".
- No renombrar `JEFE_EMAIL` ni las funciones.
- No cambiar Para, CC, el Excel del gestor ni el cuerpo que lista los RT.
- No tocar `app_seguimiento_alertas_js.html`.
- No desplegar la Web App. Hasta una versión nueva, el botón de un correo ya enviado sigue abriendo la versión publicada.

## 9. Riesgos

1. Los dos pueden abrir el formulario a la vez. El candado y el rechazo "Otro envío ya cerró alguna de estas alertas" cubren al segundo. No hay segunda observación.
2. Dejar una de las dos concatenaciones de `vigente` vuelve a inflar el texto. Las dos se cambian en el mismo paso.
3. Un `OBSERVACION_VIGENTE` viejo ya trae meses concatenados. El primer cuadro después de este cambio muestra ese bloque. Si lo dejan igual, se conserva. Si lo editan, lo que quede es la respuesta nueva. No se parte solo ese historial.
4. Si en un envío todos los días son mayores de 90, tres columnas quedan en cero. Es el dato, no un fallo del rango.
5. `DIAS RESTANTES` en días hábiles y la fecha de vencimiento en días de calendario pueden no coincidir. El cuadro usa primero `DIAS RESTANTES`, que es el número del correo al gestor.
6. El número de respondidas del informe puede mezclar meses anteriores. No se presenta como conteo exclusivo de este envío y no se corrige aquí.

## 10. Qué hace el ejecutor, y nada más

1. F1, F2 y F3 como quedaron escritas, con la sección 12 si hay duda.
2. F4 en la misma entrega de código.
3. Sin `clasp push` hasta que Fabian lo pida.

## 11. Decisiones cerradas por Fabian

No quedan decisiones abiertas. El auditor puede corregir un borde. No puede volver a pedir dos observaciones, ni dejar el texto anterior solo como consulta, ni conservar la columna Vencidas, ni agrupar por gestor.

## 12. Plan conjunto

Auditoría de Claude Code, sesión claude.ai (no la API), 2026-10-26. Leyó el plan y los cinco archivos que se van a tocar: `seguimiento_alertas.js`, `seguimiento_formulario.html`, `Codigo.js`, `app_alertas_js.html` y `app_reglas_editor_js.html`.

Primera vuelta de esa sesión: **APROBAR CON CAMBIOS**. El código coincidía con el plan, salvo la ayuda del modal: no dice "jefatura", dice "informe gerencial" (línea 813 y líneas 964-965). Cursor lo escribió en la sección 5 y en la fase F3.

Segunda vuelta de Claude Code, sobre el plan ya corregido y esas líneas: **APROBAR**.

Esta sección manda. El ejecutor no arranca hasta que Fabian lo pida. La revisión previa hecha con el modelo de Cursor no sustituye esta.

**Aceptado y ya escrito arriba**

- `_cuboFilaInforme_` devuelve `d30`, `d60`, `d90`, `mas90`, `sin` o `null`. El día negativo es `null`. `_conteoVencimientos_` y los dos bucles de grupos saltan `null`. No queda la clave `vencida`.
- Una fila del cuadro se oculta solo si está en cero en todas las columnas pintadas, Sin fecha incluida. Un grupo que solo tiene alertas sin fecha se muestra. El bloque de Totales se titula "Vigencia por articulador y proyecto".
- Se retira la frase de que las respondidas cuentan solo este envío. `_historialSeguimientoInforme_` no filtra por token. Arreglarlo no entra en estos tres cambios.

**Sigue cerrado**

- Una fila `PENDIENTE` por alerta, con los dos correos. No se cambia `_filasVisiblesDelToken_`.
- El texto anterior entra al `textarea` con `escapar`. Las dos asignaciones de `vigente` dejan de concatenar.
- `doGet` con `sa` válido sigue abriendo `seguimiento_formulario.html` antes del tablero.
- Los textos "jefatura" que se cambian son los citados en la sección 2.3, más el error repetido de `procesarReporteAlertas`.
- La ayuda del modal que dice "informe gerencial" (fija en la línea 813 y las dos frases de las líneas 962-965) pasa a "informe de jefe inmediato".
