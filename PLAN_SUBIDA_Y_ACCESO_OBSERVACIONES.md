# Plan — Subir el ajuste y abrir el enlace a quien recibe el correo

> Estado: **APROBAR** (Cursor + Claude Code, 2026-10-26). La sección 8 manda. No implementar hasta que Fabian pida ejecutar.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. No tocar `16gqzy…` ni `17Syj1…`.
> El `git push` de `fd0a626` no actualiza Apps Script. `clasp push` solo al final, y solo si Fabian lo pide en la ejecución. No hay despliegue de versión nueva dentro del código.

## 1. Qué muestran las capturas

El correo de hoy, 2026-10-26, salió con el código anterior:

- Asunto: `Informe de jefatura - Alerta Preventiva: Vigencia de Avalúo Comercial [2026-10-26]`.
- Cuadro: Articulador y **Gestor**. Columnas Vencidas, Hasta 15 días, De 16 a 30, Después, Sin fecha.
- El formulario del mismo RT 55404 pide **dos** observaciones, una marcada Gestor y otra Articulador. El cuadro dice "Agregar observación" y está vacío. No está la frase "La puede registrar el gestor o el articulador. Con una respuesta basta."

Eso es lo que hace el código de antes del commit `fd0a626`. En el repositorio local, ya cambiado, el asunto dice "Informe de jefe inmediato", el cuadro agrupa por articulador y **proyecto**, los rangos son 0 a 30, 31 a 60, 61 a 90 y mayor de 90, y el formulario tiene una sola tarjeta con el texto anterior dentro del editor.

El enlace que abre "Responder observaciones" es:

`https://script.google.com/a/macros/idu.gov.co/s/AKfycbyfD70GGwc4DlnFW48B0xvUX8LFaGKWPxnSGjW08wQ/dev?sa=...`

Esa es la URL de desarrollo escrita en `URLS_SISTEMA.md`. La arma `_urlSeguimientoAlertas_` con `ScriptApp.getService().getUrl()`. Una dirección que termina en `/dev` solo la abre quien puede editar el proyecto. Por eso el formulario le abre a Fabian y no a la persona que recibió el correo.

## 2. Qué hace el código hoy, además de no estar publicado

`doGet` en `Codigo.js` niega el ingreso **antes** de mirar `sa` si el correo no tiene rol en Permisos (cerca de la línea 171). Quien no está en esa hoja no llega al formulario.

`_filasVisiblesDelToken_` en `seguimiento_alertas.js` muestra la fila solo si la sesión es administrador o si su correo es el gestor o el articulador de esa fila. Si no, responde "Este enlace no corresponde a tu usuario."

`_sesionEsAdminSeguimiento_` exige el permiso `ADMIN_SISTEMA`. La cuenta que despliega lo tiene. El gestor, no.

La hoja `SEGUIMIENTO_ALERTAS` guarda `GESTOR_EMAIL`, `ARTICULADOR_EMAIL` y `REMITENTE_EMAIL`. `REMITENTE_EMAIL` es quien oprimió Enviar reporte, no quien llenó la observación. El cuerpo del correo de respuesta sí dice el correo de la sesión (`quien`), pero ese dato no queda en una columna.

`appsscript.json` dice `executeAs: USER_DEPLOYING` y `access: DOMAIN`. Eso no cambia el hecho de que `/dev` es solo para editores. La versión que ven los demás es `/exec`, y solo después de publicar una versión.

Los envíos ya hechos no se reescriben. El token de la captura sigue con dos filas `PENDIENTE` y con el enlace `/dev`.

## 3. Subir lo que ya está en el repositorio

No se vuelve a escribir el informe ni el formulario. Eso ya está en `fd0a626`:

- `Codigo.js`: cubos, cuadro por articulador y proyecto, textos "jefe inmediato".
- `seguimiento_alertas.js`: una fila con los dos correos, y `OBSERVACION_VIGENTE` igual al texto del cuadro.
- `seguimiento_formulario.html`: el editor nace con el texto anterior.
- `app_alertas_js.html` y `app_reglas_editor_js.html`: los textos del jefe inmediato.

La ejecución, cuando Fabian la pida, hace `clasp push` solo a `18vY9…`, después de releer `.clasp.json`. El push actualiza el editor y la URL `/dev`. No publica `/exec`.

## 4. El enlace lo abre quien recibió el correo

### 4.1 La dirección del botón

`_urlSeguimientoAlertas_` sigue usando `getUrl()`. Si esa dirección termina en `/dev`, se cambia ese final por `/exec` antes de agregar `sa`. No se inventa otro dominio ni otro id de despliegue.

`/exec` muestra la última versión publicada, no el código recién empujado. Hasta que Fabian publique una versión nueva del mismo despliegue, con acceso al dominio IDU, el botón de un correo nuevo puede abrir la versión vieja. El plan no publica solo. Lo deja dicho para el paso manual.

Los correos ya enviados conservan el `/dev`. No se reenvían desde este cambio.

### 4.2 Quién entra

Si `sa` trae el formato ya validado, `doGet` abre `seguimiento_formulario.html` **antes** de rechazar por falta de rol en Permisos. Hace falta un correo de sesión. Si `Session.getActiveUser().getEmail()` viene vacío, la página dice que debe entrar con su cuenta del IDU y no muestra el tablero.

Quien no tiene rol sigue sin ver el tablero. Solo el formulario de ese `sa`.

`_filasVisiblesDelToken_` muestra las filas `PENDIENTE` de ese token a cualquier sesión que tenga correo. El enlace es la autorización: cada envío ya tiene su propio token. No se exige que el correo sea el del gestor ni el del articulador, ni que esté en Permisos. El administrador sigue entrando igual.

Si no hay correo de sesión, no se listan filas y no se guarda. No se anota la cuenta que despliega como si ella hubiera escrito.

### 4.3 Qué correo queda en la hoja

Se agrega `RESPONDIDO_POR` al final de `ENCABEZADOS_SEGUIMIENTO_ALERTAS`. `_completarEncabezadosSeguimiento_` ya agrega columnas solo al final y rechaza si el orden anterior no coincide. No se reordena la hoja.

En la fila `RESPONDIDA`, `RESPONDIDO_POR` es el correo de la sesión, en minúsculas. En la fila `PENDIENTE` va vacío. `REMITENTE_EMAIL` no cambia: sigue siendo quien envió el reporte.

Si la sesión no tiene correo, `guardarSeguimientoAlertas` no escribe.

## 5. Fases

### F1 — Enlace y acceso

- **Archivos:** `seguimiento_alertas.js` (`_urlSeguimientoAlertas_`, encabezados, `_filasVisiblesDelToken_`, `guardarSeguimientoAlertas`) y `Codigo.js` (`doGet`, solo el orden del `sa` frente al rechazo por rol).
- **Hecho cuando:** un `sa` válido no pide rol en Permisos. Una sesión sin correo no guarda y no entra al tablero. La dirección del botón no termina en `/dev`. La fila respondida trae `RESPONDIDO_POR`.

### F2 — Bitácora

- Entrada corta en `DOCUMENTACION_TECNICA_VIVA.md`, firmada Cursor.
- `graphify update .`
- Sin commit y sin regenerar DOCX o PDF, salvo que Fabian lo pida.

### F3 — Subida

- Solo si Fabian lo pide al ejecutar.
- Releer `.clasp.json`. `clasp push` al script `18vY9…`.
- Decirle que publique una versión nueva del mismo despliegue, acceso al dominio, para que `/exec` deje de ser el formulario viejo. El código no pulsa Publicar.

## 6. Pruebas

Sin Gmail: `node --check` en `Codigo.js` y `seguimiento_alertas.js`.

Con Fabian, después de la subida, en `/dev` con su cuenta: el informe nuevo no dice jefatura, el cuadro es por proyecto y los rangos son los cuatro pedidos, y el mismo RT sale una sola vez.

El enlace del correo nuevo, abierto por otra cuenta del dominio que no edita el script y no está en Permisos, muestra el formulario y al guardar deja su correo en `RESPONDIDO_POR`. Eso solo se puede ver en `/exec` después de la versión nueva. `/dev` va a seguir abriéndose solo para quien edita.

## 7. Fuera de alcance

- No rehacer el informe, el formulario ni la fila única. Ya están en `fd0a626`.
- No migrar los tokens ya enviados ni sus dos filas.
- No cambiar `executeAs` a cada visitante. La aplicación sigue corriendo como la cuenta que despliega.
- No abrir el tablero a quien no tiene rol.
- No publicar la versión desde el agente.
- No tocar PAC, el motor ni `app_seguimiento_alertas_js.html`.

## 8. Plan conjunto

Auditoría de Claude Code, sesión claude.ai, 2026-10-26. Leyó el plan y, en el código, `Codigo.js`, `seguimiento_alertas.js`, `seguimiento_formulario.html`, `appsscript.json` y `URLS_SISTEMA.md`. Veredicto: **APROBAR**.

Confirmó que el informe nuevo y el formulario de una sola observación ya están en el repositorio, que `doGet` sigue rechazando por rol antes de `sa`, que falta `RESPONDIDO_POR`, y que la URL `/dev` de `URLS_SISTEMA.md` es la misma que abrió Fabian. Esta sección manda. El ejecutor no arranca hasta que Fabian lo pida.
