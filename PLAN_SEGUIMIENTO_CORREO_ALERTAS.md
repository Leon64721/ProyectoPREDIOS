# Plan — Seguimiento del correo de alertas

> Estado: plan conjunto Cursor + Claude (2026-10-18). Veredicto de auditoría: APROBAR CON CAMBIOS. La sección 12 manda si algo de arriba quedó viejo. **No implementar** hasta que Fabian pida ejecutar.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. No tocar `16gqzy…` ni `17Syj1…`.
> No hace `clasp push` ni `deploy`. No toca PAC, equipos ni normalización.

## 1. Qué se quiere

El botón **Enviar reporte** sigue enviando el Excel. El cuerpo del correo, además, lista los RT de cada semáforo. Según el tipo de regla y el color, algunos RT exigen que el gestor o el articulador carguen una observación. Si el mismo gestor tiene varias alertas críticas, las carga todas en un solo cuadro, una por RT, y al enviar el sistema responde ese correo con lo escrito.

Esa respuesta queda en una hoja solo de seguimiento. Si al mes siguiente el mismo RT vuelve a caer en la misma regla, el cuadro trae la observación anterior, deja agregar texto y guarda de nuevo sin borrar lo viejo.

Hay casos especiales, configurables por regla y por color. El ejemplo de avalúo: en naranja no se pide nada; en rojo el correo advierte implicaciones disciplinarias y fiscales, y si la persona declara que no va a usar el avalúo debe confirmar un aviso y adjuntar concepto jurídico y concepto técnico. Esos archivos van a una carpeta del proyecto. El correo de respuesta lleva copia a quien remitió la alerta y a la jefatura inmediata. El correo de la jefatura se guarda en el proceso, no se escribe a mano en cada envío.

Nada de esto queda fijo en código para "avalúo". Se define en la bandeja, al editar cada regla.

## 2. Qué hace el código hoy

- `procesarReporteAlertas` (`Codigo.js`, desde la línea 2097) solo lo puede llamar un Administrador. Lee `ALERTAS_ACTIVAS` del spreadsheet principal, aplica filtros y el filtro de matriz.
- Modo `EMAIL_UNICO`: un correo. Modo `GESTOR_Y_ARTICULADOR`: un correo por `GESTOR_EMAIL`, con el articulador en copia si el check está marcado. El adjunto lo arma `_buildAlertasEmailAttachmentGrid` (línea 1912), HTML con extensión `.xls`.
- El cuerpo lo arma `_buildResumenHtmlAgrupado` (línea 1983). Agrupa por nivel + nombre de regla y muestra **cantidades** de articulador y gestor. No lista RT.
- `_obtenerObservacionesPorRT` (línea 1943) copia la columna de observaciones de la hoja `Datos` al Excel. No es un seguimiento de alertas y no se reutiliza para este flujo.
- El envío usa `MailApp.sendEmail`. No guarda id de hilo, así que hoy no se puede contestar ese mensaje.
- Los niveles reales son `ROJO`, `NARANJA`, `AMARILLO` (`NIVELES_ALERTA_REGLAS` en `evaluador_alertas.js`). No existen las palabras Crítica, Riesgo ni Preventiva.
- La regla vive en `CONFIG_REGLAS`. El constructor (`app_reglas_editor_js.html`, `construirReglaDesdeFormulario`) no tiene bloque de seguimiento. El validador de `motor_reglas.js` rechaza JSON de más de 49.000 caracteres.
- `ALERTAS_ACTIVAS` se reescribe completa en cada corrida del motor. No sirve como historial.
- La hoja `Permisos` tiene `EMAIL`, `ROL`, `PROYECTOS`, `ACTIVO`, `FECHA_CREACION`. La hoja de usuarios tiene `EMAIL`, `ROL`, `NOMBRE`, `ACTIVO`, `COMPONENTE`. No hay correo de jefatura.
- `appsscript.json` ya tiene `gmail.send` y `script.send_mail`. No tiene permiso para leer el buzón ni contestar un hilo.
- El modal está en `exportarAlertasExcel` / `ensureModalConfiguracionReporteAlertas` (`app_alertas_js.html`, cerca de la línea 762). PAC tiene otro botón de reportes y no se toca.

## 3. Restricción que define el diseño

Un correo HTML no puede subir archivos ni guardar en una hoja. La persona no "responde" escribiendo en Gmail. El correo trae la lista de RT, la nota de obligación y un enlace. El enlace abre la Web App, ya con la sesión del dominio. Ahí está el cuadro, una fila por RT. Al confirmar, el script guarda la hoja, sube los anexos y **contesta el hilo** del correo original.

Hace falta poder leer y contestar el buzón de la cuenta que despliega la Web App (`executeAs: USER_DEPLOYING`). Eso implica agregar el scope `https://www.googleapis.com/auth/gmail.modify` y volver a autorizar. No se pide acceso total a Gmail.

## 4. Diseño recomendado

### 4.1 Nombres en pantalla

| Valor guardado | Texto en correo y formulario |
|----------------|------------------------------|
| ROJO | Crítica |
| NARANJA | Riesgo |
| AMARILLO | Preventiva |

El JSON, la hoja `ALERTAS_ACTIVAS` y los filtros siguen usando ROJO / NARANJA / AMARILLO.

### 4.2 Política por regla

Cada regla puede llevar, sin ser obligatorio, este objeto. Si no está, el correo se comporta como hoy para esa regla: entra al listado y al Excel, y no pide observación.

```json
"seguimiento_correo": {
  "ROJO": {
    "exigir_observacion": true,
    "permitir_no_uso": true,
    "nota_correo": "Texto que sale en el cuerpo cuando hay RT en este color.",
    "texto_no_uso": "Texto del aviso antes de marcar que no se va a usar."
  },
  "NARANJA": { "exigir_observacion": false, "permitir_no_uso": false, "nota_correo": "", "texto_no_uso": "" },
  "AMARILLO": { "exigir_observacion": false, "permitir_no_uso": false, "nota_correo": "", "texto_no_uso": "" }
}
```

Reglas del validador, en cliente y en `validarConfigReglas_`:

- Solo esas tres claves de nivel. Cualquier otra es error.
- `exigir_observacion` y `permitir_no_uso` son booleanos.
- Si `exigir_observacion` es true, `nota_correo` no puede ir vacío.
- Si `permitir_no_uso` es true, `exigir_observacion` también debe ser true y `texto_no_uso` no puede ir vacío.
- `permitir_no_uso` en false borra la obligación de anexos aunque el texto exista.
- Cada texto de más de 600 caracteres se rechaza con error. No se recorta en silencio.
- Si `permitir_no_uso` es false, el servidor ignora `texto_no_uso`. No borra nada del JSON por su cuenta.
- Una regla vieja sin `seguimiento_correo` es válida.

En el constructor gráfico, debajo del tipo de alerta, un bloque **Seguimiento del correo** con tres tarjetas (Crítica, Riesgo, Preventiva). Cada tarjeta: dos casillas y dos textos. El botón de pegar el texto de avalúo solo rellena los campos de Crítica; no guarda solo.

### 4.3 Cuerpo del correo

Se mantiene el Excel. El HTML nuevo, por cada semáforo que tenga filas:

1. Título con el nombre de pantalla y la cantidad.
2. Dentro, por cada regla, la lista de RT (y proyecto). Si pasan de 40 RT en esa regla y color, se muestran 40 y la frase "los demás están en el archivo adjunto".
3. Si la política de ese color exige observación, la `nota_correo` de la regla, una sola vez por regla, no repetida por RT.

Al final, si al menos un RT exige observación, un botón al enlace de la Web App. Si ninguno exige, el correo no lleva enlace ni habla de obligación.

El modo `EMAIL_UNICO` también lista los RT. El enlace de ese modo abre el cuadro para un Administrador, porque el destinatario puede no ser el gestor. El modo `GESTOR_Y_ARTICULADOR` es el que usa el gestor.

### 4.4 Un correo, un cuadro, una respuesta

Al enviar en modo gestor se crea **un token por correo** (por destinatario), no uno por RT. El enlace trae ese token.

En la hoja de seguimiento se inserta una fila `PENDIENTE` por cada par RT + nombre de regla que exija observación. Todas comparten el token, el id del hilo y el correo de quien oprimió Enviar reporte (el remitente).

El formulario muestra esas filas pendientes del token. En cada una:

- RT, regla, color, proyecto, mensaje de la alerta.
- La observación vigente anterior, si existe, solo lectura.
- Un cuadro para agregar texto.
- Si esa regla y color permiten "no se va a usar": una casilla. Al marcarla se muestra `texto_no_uso` y dos archivos obligatorios (jurídico y técnico). Hay que marcar "leí el aviso" antes de poder enviar.

No se puede confirmar si falta el texto nuevo de algún RT, o si una fila marcada como no uso no trae los dos archivos. Un solo botón envía todas.

Al guardar:

- No se borra la historia. Por cada RT se agrega una fila `RESPONDIDA`. La fila `PENDIENTE` de ese RT pasa a `CERRADA`.
- La observación vigente que verá el mes siguiente es previa + salto de línea + fecha + texto nuevo.
- Los archivos van a la carpeta de Drive y la fila guarda el enlace. Ese enlace es para el Administrador. Quien recibe el correo no depende de él: los dos archivos van adjuntos en la respuesta del hilo y en el correo directo a la jefatura.
- `replyAll` contesta el hilo. El cuerpo dice quién escribió, con el correo de la sesión. En copia va quien oprimió Enviar reporte (`REMITENTE_EMAIL`), porque esa persona no queda sola en el hilo: el remitente técnico es la cuenta que despliega la Web App. El articulador sigue si ya iba en el correo original.
- Si hubo no uso, además sale un correo nuevo, con Para = `JEFE_EMAIL` y copia = `REMITENTE_EMAIL`. Lleva el RT, la regla, el aviso, la observación y los dos archivos adjuntos. `replyAll` no tiene campo Para, por eso este correo es aparte.
- Si el token ya no tiene filas `PENDIENTE`, el servidor rechaza. No hay segundo guardado con el mismo enlace. El mes siguiente nace con el próximo Enviar reporte.

### 4.5 Mes siguiente

La clave de búsqueda es `RT` + nombre de regla, en mayúsculas y sin espacios sobrantes. No incluye el color: si el mes pasado fue roja y ahora también, trae el texto. Si la regla ya no exige observación en el color nuevo, no se pide nada y no se muestra el formulario para ese RT.

### 4.6 Jefatura y carpeta

Cerrado por Fabian el 2026-10-18. No se agrega columna a la hoja de usuarios.

En el cuadro que ya abre **Enviar reporte** (`ensureModalConfiguracionReporteAlertas`), junto al modo de envío y a la copia, hay un campo **Correo de la jefatura inmediata**. Es obligatorio solo si, entre las alertas que se van a enviar, alguna regla y color tiene `permitir_no_uso` en true. Si ninguna lo tiene, el campo puede ir vacío. El valor se copia a `JEFE_EMAIL` en cada fila `PENDIENTE` de ese envío.

Si al responder marcan "no se va a usar", además de la respuesta en el hilo se envía un correo **directo** a ese `JEFE_EMAIL`, con copia a quien oprimió Enviar reporte. Lleva el RT, la regla, el aviso, la observación y los dos archivos adjuntos. Si el campo vino vacío, el servidor rechaza ese guardado completo.

- Carpeta: Script Property `SEGUIMIENTO_ALERTAS_FOLDER_ID`. La primera vez que haga falta, el script crea "Seguimiento alertas" en el Drive de la cuenta que despliega y guarda el id. No comparte el archivo con "cualquiera con el enlace". Los permisos son los de esa carpeta.
- Hoja nueva `SEGUIMIENTO_ALERTAS` en el spreadsheet principal (`DATA_FILES.PRINCIPAL`), no dentro de `ALERTAS_ACTIVAS`.

### 4.7 Quién puede abrir el enlace

La sesión de Google tiene que ser el `GESTOR_EMAIL` o el `ARTICULADOR_EMAIL` de alguna fila de ese token, o un Administrador. Cada persona ve y cierra solo las filas donde su correo coincide. El Administrador ve todas las del token. El token solo no alcanza. Quien no tiene rol en la hoja Permisos no pasa de `doGet`: si un gestor no está ahí, no puede abrir el enlace. Eso se comprueba en F0, antes de construir el cuadro.

### 4.8 Texto propuesto para la regla de avalúo

No se escribe solo en código. Queda como texto que el Administrador puede pegar en la tarjeta Crítica de la regla que corresponda. Propuesta:

**Nota del correo (Crítica):** Debido a que esta es una alerta crítica, es obligatorio cargar una observación por cada RT. El no uso de un avalúo, cuando el procedimiento exige aplicarlo, puede implicar incumplimiento de deberes y consecuencias disciplinarias y fiscales, incluido el detrimento patrimonial.

**Aviso al marcar "no se va a usar":** Se sugiere revisar con detalle si el avalúo debe aplicarse antes de continuar. Si aun así confirma que no se va a usar, debe adjuntar el concepto jurídico y el concepto técnico que motiven y sustenten esa decisión. Esos anexos quedan en el seguimiento del proyecto y se envía copia a quien remitió la alerta y a la jefatura inmediata.

Naranja y Preventiva de esa regla: las dos casillas apagadas.

## 5. Decisiones cerradas por Fabian (2026-10-18)

| # | Tema | Decisión |
|---|------|----------|
| D1 | Nombres de semáforo | ROJO se muestra Crítica, NARANJA Riesgo, AMARILLO Preventiva. En hojas y JSON se siguen guardando ROJO, NARANJA y AMARILLO. |
| D2 | Correo de la jefatura | Se pide en el cuadro de Enviar reporte, no en la hoja de usuarios. Si declaran que no se va a usar el avalúo u otro proceso, ese aviso sale directo a ese correo, con copia a quien remitió la alerta. |
| D3 | "No se va a usar" | La observación sigue siendo obligatoria. Si marcan no uso, además adjuntan concepto jurídico y concepto técnico. |
| D4 | Historial | Hoja `SEGUIMIENTO_ALERTAS` en el spreadsheet principal. |
| D5 | Quién abre el enlace | Se mantiene: el gestor del RT, el articulador del RT o un Administrador. El token solo no basta. |

## 6. Hoja `SEGUIMIENTO_ALERTAS`

Crearla si no existe, con estas columnas y ninguna más en esta entrega:

`ID`, `TOKEN`, `ESTADO`, `CREADO_EN`, `RESPONDIDO_EN`, `PERIODO`, `RT`, `REGLA`, `NIVEL`, `PROYECTO`, `GESTOR_EMAIL`, `ARTICULADOR_EMAIL`, `JEFE_EMAIL`, `REMITENTE_EMAIL`, `HILO_GMAIL_ID`, `MENSAJE_GMAIL_ID`, `OBSERVACION_PREVIA`, `OBSERVACION_NUEVA`, `OBSERVACION_VIGENTE`, `NO_USO`, `AVISO_ACEPTADO`, `ARCHIVO_JURIDICO_URL`, `ARCHIVO_TECNICO_URL`

- `ESTADO`: `PENDIENTE`, `RESPONDIDA`, `VENCIDA` o `CERRADA`.
- `PERIODO`: `yyyy-MM` de America/Bogota.
- `ID`: `Utilities.getUuid()`.
- Escritura con `LockService` de script. No borrar filas desde la Web App.
- Al armar un envío nuevo, las filas `PENDIENTE` anteriores del mismo RT + regla pasan a `VENCIDA` si el token es distinto. No se borran.
- Al guardar la respuesta se agrega una fila `RESPONDIDA` por RT y la `PENDIENTE` de ese RT pasa a `CERRADA`.
- El formulario solo abre filas `PENDIENTE` del token, y solo las que le corresponden a la sesión. Si no queda ninguna `PENDIENTE`, rechaza.

## 7. Fases

El ejecutor no salta fases ni agrega pantallas.

### F0 — Línea base y prueba de Gmail
- Anotar en `DOCUMENTACION_TECNICA_VIVA.md` el antes: funciones y archivos de la sección 2.
- Comprobar en la hoja Permisos si los gestores que deben responder tienen rol. Si no están, `doGet` no les abre el enlace. Anotarlo. No inventar un permiso nuevo.
- Spike, a mano, en el editor del script `18vY9…`, sin dejar la función en el repo: `GmailApp.createDraft(...).send()`, leer `getThread().getId()` y `replyAll`, primero con el scope `gmail.modify`. Si Google lo rechaza, el scope de F3 pasa a ser `https://mail.google.com/`. No implementar F3 hasta anotar cuál de los dos funcionó.

### F1 — Hoja, carpeta y política en el servidor
- **Archivos:** `seguimiento_alertas.js` (nuevo), `motor_reglas.js`.
- **Hacer:** funciones de leer y crear la hoja; leer o crear la carpeta y guardar la Script Property; buscar la última `RESPONDIDA` por RT + regla con una sola lectura de la hoja; `politicaSeguimientoDeRegla_(nombreRegla, nivel)` lee `obtenerReglasJSON()` y devuelve la política de ese nivel o null. Validar `seguimiento_correo` contra `NIVELES_ALERTA_REGLAS`, no con una lista copiada. Textos de más de 600 caracteres: error, sin recortar.
- **Hecho cuando:** una regla sin el objeto sigue guardándose; una con `permitir_no_uso: true` y sin texto de aviso es rechazada; una con observación exigida y nota vacía es rechazada; un texto de 601 caracteres es rechazado.

### F2 — Constructor
- **Archivos:** `app_reglas_editor_js.html`. `Index.html` no cambia en esta fase.
- **Hacer:** el bloque se pinta dentro de `pintarConstructor`. Al abrir, `abrirConstructorRegla` carga `reglaEnEdicion.seguimiento_correo`. La validación entra en `validarReglaCliente`. El botón de avalúo solo rellena la tarjeta Crítica. `construirReglaDesdeFormulario` escribe `seguimiento_correo` solo si alguna casilla está activa o algún texto tiene contenido. Si todo está apagado y vacío, borra la clave para no inflar el JSON.
- **Hecho cuando:** editar una regla vieja no le inventa seguimiento; guardar una Crítica con observación y sin nota muestra el error y no llama al servidor.

### F3 — Cuerpo del correo y filas pendientes
- **Archivos:** `Codigo.js`, `seguimiento_alertas.js`.
- **Hacer:** sustituir el listado de cantidades de `_buildResumenHtmlAgrupado` por RT agrupados en Crítica, Riesgo y Preventiva, con tope de 40 por regla y color. Un nivel que no sea ROJO, NARANJA ni AMARILLO se lista sin política y sin enlace. La nota de la regla sale una vez por regla y color.
- Reemplazar solo los dos `MailApp.sendEmail` de `procesarReporteAlertas` (modo gestor y modo único). No tocar el PDF de `Codigo.js`, el aviso de `triggerDiarioMotorReglas` ni ningún envío de `pac_api.js` o `pac_triggers.js`.
- Envío, con cuerpo de texto plano obligatorio además del HTML:

```js
var draft = GmailApp.createDraft(to, subject, textoPlano, { htmlBody: htmlBody, cc: ccStr, attachments: [attachment] });
var msg;
try { msg = draft.send(); } catch (e) { draft.deleteDraft(); throw e; }
```

- Un fallo de un gestor no corta a los demás: try/catch por grupo. Tras el envío exitoso, las filas `PENDIENTE` entran con un solo `setValues`. Si esa escritura falla, el resultado dice que el correo salió y el seguimiento no quedó armado. No se borra el correo.
- El modo CSV local no crea filas ni enlace. Un gestor sin correo válido sigue yendo al correo de respaldo; sus filas quedan con `GESTOR_EMAIL` vacío y solo un Administrador las responde.
- El scope de `appsscript.json` es el que haya aprobado el spike de F0. No se agrega antes.
- **Hecho cuando:** un grupo sin ninguna política de observación no crea filas ni enlace; un grupo con una regla roja que exige observación crea una fila por RT y el HTML contiene la nota y el enlace.

### F4 — Cuadro de respuesta
- **Archivos:** `Codigo.js` (`doGet` solo para leer el parámetro `sa` y pasarlo a la plantilla), `Index.html`, `app_seguimiento_alertas_js.html` (nuevo).
- **Hacer:** el cuadro es un modal creado por JS, del mismo estilo que `ensureModalConfiguracionReporteAlertas`. En `Index.html`, antes de los includes, `const SEGUIMIENTO_TOKEN = <?!= tokenJs ?>;` y una línea `<?!= include('app_seguimiento_alertas_js') ?>`. El partial no lleva scriptlets: `include` no los evalúa. `tokenJs` sale de `doGet` solo si `e.parameter.sa` cumple `/^[A-Za-z0-9-]{20,64}$/`; si no, es cadena vacía. No leer el token con `window.location.search`.
- Abrir el modal al final del arranque, después de `loadDashboardData()`. No bloquear el tablero.
- `obtenerSeguimientoPorToken` hace una sola lectura de la hoja. El gestor o el articulador ven solo sus filas `PENDIENTE`. El Administrador ve todas las de ese token. `guardarSeguimientoAlertas` valida de nuevo en servidor solo esas filas: texto, aviso aceptado, dos archivos y jefatura si hay no uso. Sube los archivos, agrega una `RESPONDIDA` por RT, pasa esas `PENDIENTE` a `CERRADA` y contesta con `GmailApp.getMessageById(id).replyAll(textoPlano, { htmlBody: html, cc: remitente, attachments: anexos })`.
- Archivos: nombre `RT_regla_juridico_yyyyMMdd` y `RT_regla_tecnico_yyyyMMdd`. Rechazar algo que no sea PDF, DOC, DOCX o imagen, y rechazar más de 5 MB por archivo.
- **Hecho cuando:** un usuario que no es gestor, articulador ni admin de esas filas recibe rechazo; un gestor no ve RT de otro gestor del mismo token; falta un texto y el servidor no escribe; con datos completos hay fila `RESPONDIDA`, la pendiente queda `CERRADA` y el hilo tiene respuesta con los anexos; un segundo guardado del mismo token es rechazado.

### F5 — Jefatura en el cuadro de envío
- **Archivos:** `app_alertas_js.html` (el modal de `ensureModalConfiguracionReporteAlertas`), `Codigo.js` (leer `jefeEmail` del payload). No se modifica `config.js` ni `COLUMNS_USUARIOS`.
- **Hacer:** campo "Correo de la jefatura inmediata". Si el conjunto filtrado no tiene ninguna alerta cuya regla y color permitan no uso, el campo no bloquea el envío. Si hay al menos una, el cliente y el servidor exigen un correo válido y lo guardan en las filas `PENDIENTE`. Al responder con no uso, `guardarSeguimientoAlertas` manda un correo directo a ese destinatario, con copia al `REMITENTE_EMAIL`, además del `replyAll` del hilo.
- **Hecho cuando:** un envío con una regla que permite no uso y sin correo de jefatura no sale. Un envío sin ninguna regla de no uso puede ir con el campo vacío. Una respuesta con no uso llega a la jefatura en el campo Para, no solo en copia.

### F6 — Bitácora
- Entrada en `DOCUMENTACION_TECNICA_VIVA.md`, firmada por quien ejecute. Funciones, impacto, pruebas y pendiente de reautorizar Gmail.
- `graphify update .`
- Sin commit y sin regenerar DOCX/PDF salvo que lo pidan.

### F7 — Subida
- Solo si Fabian lo pide, después de releer `.clasp.json` y de que no haya otro push en paralelo.
- `clasp push`. El push solo actualiza el código del editor. Para que la Web App publicada use el scope nuevo, el dueño reautoriza desde el editor y publica una versión nueva del despliegue. El mismo día se mira que sigan corriendo los activadores del PAC y `triggerDiarioMotorReglas`.
- El correo de jefatura se escribe en cada envío, no en una hoja de usuarios.

## 8. Archivos

| Archivo | Fase | Qué cambia |
|---------|------|------------|
| `seguimiento_alertas.js` | F1, F3, F4, F5 | Hoja, carpeta, token, guardado, respuesta |
| `motor_reglas.js` | F1 | Validar `seguimiento_correo` |
| `app_reglas_editor_js.html` | F2 | Tarjetas del constructor |
| `Codigo.js` | F3, F4, F5 | Cuerpo del correo, envío con hilo, `doGet`, correo directo a la jefatura |
| `app_alertas_js.html` | F5 | Campo de correo de la jefatura en el modal de envío |
| `Index.html` | F4 | Constante del token y el include del partial. No cambia en F2 |
| `app_seguimiento_alertas_js.html` | F4 | Formulario |
| `appsscript.json` | F3 | El scope que haya aprobado el spike de F0 |
| `DOCUMENTACION_TECNICA_VIVA.md` | F0, F6 | Bitácora |

No se tocan: `pac_*`, `evaluador_alertas.js` (el motor no cambia), `permisos.js`, `.clasp.json`, `export_pdf_backend.js`.

## 9. Pruebas

Local, antes de subir:

1. `node --check` sobre `seguimiento_alertas.js`, `motor_reglas.js` y `Codigo.js`.
2. El lint de HTML sobre `Index.html`, `app_reglas_editor_js.html` y `app_seguimiento_alertas_js.html`.
3. Regla sin `seguimiento_correo` pasa el validador. Regla con no uso y sin aviso no pasa.

En la Web App, con Fabian:

1. Regla de prueba con Crítica obligatoria y Riesgo apagado. Forzar evaluación. Enviar por gestor.
2. El correo lista RT bajo Crítica y Riesgo. Solo Crítica muestra la nota y el enlace.
3. Abrir el enlace con el gestor: aparece la observación vieja si se sembró una fila `RESPONDIDA`. Agregar texto y enviar. La hoja tiene la fila nueva y la vieja. El hilo recibe la respuesta.
4. Marcar no uso sin archivos: el servidor rechaza. Con los dos archivos: guarda, responde el hilo, manda correo directo a la jefatura indicada en el envío, con copia al remitente, y deja los archivos en la carpeta.
5. Editor que no es el gestor del token: rechazo.
6. Página de Permisos y el correo de PAC siguen igual.

## 10. Fuera de alcance

- Envío automático desde `triggerDiarioMotorReglas`. Este flujo nace del botón Enviar reporte.
- Leer la respuesta que alguien escriba a mano en Gmail.
- Evaluar reglas nuevas o cambiar umbrales.
- Hacer obligatorio el seguimiento para las reglas que ya existen. Hasta que un Administrador lo active en la regla, el correo sigue como hoy y solo cambia el listado de RT.
- Guardar la jefatura en la hoja de usuarios o en Permisos. Se pide en cada envío.
- PAC, equipos, normalización.

## 11. Riesgos

1. `gmail.modify` permite a la Web App leer y modificar el buzón de la cuenta que despliega, no el de cada gestor. Hay que reautorizar. Si no se acepta ese scope, no hay respuesta en el mismo hilo: se enviaría un correo nuevo con asunto "Re:" y se pierde el hilo. Eso queda fuera salvo que la auditoría lo proponga como alternativa.
2. El cuerpo con muchos RT puede acercarse al límite de Gmail. El tope de 40 por regla y color, más el Excel, es la contención.
3. El JSON de reglas tiene techo de 49.000 caracteres. Textos largos en muchas reglas pueden impedir guardar. El tope es 600 caracteres por texto, y el servidor lo rechaza.
4. `ALERTAS_ACTIVAS` se borra y se reescribe. Por eso el historial va en otra hoja.
5. La cuenta que despliega es la dueña del hilo y de la carpeta. Si cambia la cuenta de despliegue, los hilos viejos no se podrán contestar.
6. Dos clics seguidos en guardar pueden duplicar filas. El lock de script y el rechazo cuando el token ya no tiene `PENDIENTE` cubren el caso. Otro agregado del mismo RT espera al siguiente envío de reporte.
7. Renombrar una regla cambia la clave RT + nombre. El historial anterior no se trae. Es el mismo criterio con el que el motor distingue reglas.
8. La cuota diaria de Gmail es de la cuenta que despliega. Un envío por gestor la consume más rápido que un correo único.
9. `doGet` deja fuera a quien no tenga rol en Permisos. Un gestor que solo exista como correo en la matriz, sin fila de permisos, no abre el enlace.

## 12. Plan conjunto

Auditor: [Claude](5fa97e93-55c5-44c2-a8fb-1f77852b623e), 2026-10-18. Veredicto: **APROBAR CON CAMBIOS**. No implementó código. Las decisiones D1–D5 de Fabian se mantienen. Esta sección manda sobre el resto del archivo.

**Aceptado**

- El correo no puede subir archivos. El cuadro vive en la Web App y el script contesta el hilo.
- `GmailApp.createDraft(...).send()` es la llamada que devuelve el mensaje. `GmailApp.sendEmail` no sirve para guardar el hilo. Si `send()` falla, se borra el borrador.
- Hace falta cuerpo en texto plano además del HTML.
- El token entra por la plantilla (`<?!= tokenJs ?>` en `Index.html`), no por `window.location.search` ni por un scriptlet dentro del partial.
- El token se valida con `/^[A-Za-z0-9-]{20,64}$/` antes de pintarlo.
- Solo se cambian los dos envíos de `procesarReporteAlertas`. PDF, trigger del motor y PAC quedan como están.
- Estados: `PENDIENTE`, `RESPONDIDA`, `VENCIDA`, `CERRADA`. Al guardar se agrega `RESPONDIDA` y la pendiente pasa a `CERRADA`. Sin pendientes, se rechaza. No hay segundo guardado con el mismo enlace.
- Cada quien ve y cierra solo sus filas. El Administrador ve todas las del token.
- Los anexos van en el correo. La URL de Drive queda en la hoja para el Administrador.
- Tope de 40 RT por regla y color, y de 5 MB por archivo.
- Textos de la política: máximo 600 caracteres, con error si se pasan. No se recortan.
- El modal de respuesta se abre después de `loadDashboardData()`.
- F7 no termina en el push. Hace falta reautorizar y publicar una versión nueva, y revisar los activadores ese día.

**Rechazado**

- Poner `JEFE_EMAIL` en la hoja de usuarios. Fabian ya decidió que se pide en el cuadro de Enviar reporte. La auditoría alcanzó a leer la versión anterior de F5. No se vuelve a esa idea.
- Reingresar al mismo enlace para agregar otra observación. El mes siguiente espera un envío nuevo.
- Compartir la carpeta con cualquiera que tenga el enlace.
- Implementar F3 antes del spike de Gmail de F0.

**Qué hace el ejecutor, y nada más**

1. F0: bitácora, comprobación de Permisos y spike de Gmail en el editor. Anotar el scope que funcionó.
2. F1 a F6 como quedaron escritas arriba, con esta sección si hay duda.
3. F7 solo si Fabian lo pide.

No hay decisiones abiertas.
