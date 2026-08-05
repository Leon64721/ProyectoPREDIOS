# APLICACIÓN DE PREDIOS — Documentación del proyecto

Este repositorio contiene la "APLICACIÓN DE PREDIOS", una solución implementada en Google Apps Script que provee un tablero web para gestión y seguimiento de predios (matriz de datos, módulo PAC — seguimiento y alertas), informes (PDF/Drive) y automatizaciones mediante triggers.

Resumen rápido:
- Propósito: centralizar información de predios, registrar seguimiento por RT, calcular semáforos de riesgo y notificar a responsables.
- Tipo de proyecto: Google Apps Script (GS) con interfaz HTML (`HtmlService`) publicado como Web App.

**Servicios de Google usados (detectados en el código):**
- `SpreadsheetApp` — lectura/escritura de datos en hojas (módulo central). 
- `HtmlService` — plantillas y UI del frontend (`Index.html`, `pac_ui.html`, etc.).
- `PropertiesService` — banderas y configuración en tiempo de ejecución (ej. `MODO_MANTENIMIENTO`).
- `ScriptApp` — instalación y borrado de triggers programados (p.ej. `instalarTriggersPAC`, `triggerSemanalPAC`).
- `DriveApp` — creación, conversión y compartición de archivos (PDF/Excel) y manejo de carpetas/archivos temporales.
- `UrlFetchApp` — conversiones / llamadas externas (ej. exportar a XLSX vía API de Drive).
- `MailApp` / `GmailApp` — envío de correos y notificaciones (alertas críticas, notificaciones a admin).
- `Session` — obtención de usuario activo para control de permisos y auditoría.


Scopes exactos recomendados para `appsscript.json`:
- `https://www.googleapis.com/auth/spreadsheets`  — lectura y escritura en Google Sheets.
- `https://www.googleapis.com/auth/drive`        — acceso completo a Drive (crear/compartir/trasladar archivos, requerido por exportaciones y permisos de archivos).
- `https://www.googleapis.com/auth/script.external_request` — permitir `UrlFetchApp` para llamadas/descargas externas.
- `https://www.googleapis.com/auth/script.scriptapp` — gestión de triggers mediante `ScriptApp`.
- `https://www.googleapis.com/auth/gmail.send`    — enviar correos con `GmailApp`.
- `https://www.googleapis.com/auth/script.send_mail` — enviar correos con `MailApp` (compatibilidad).
- `https://www.googleapis.com/auth/userinfo.email` — obtener email del usuario activo (`Session.getActiveUser()`).

Nota: estos scopes son los mínimos recomendados según las APIs detectadas en el código. Si deseas restringir el acceso a Drive, considera reemplazar `drive` por `https://www.googleapis.com/auth/drive.file` y probar las operaciones de compartición y conversión; algunas operaciones (p. ej. cambiar permisos a ANYONE_WITH_LINK) requieren el scope completo de Drive.

Archivo `appsscript.json` sugerido (añadir/mergear `oauthScopes`):
```
{
	"timeZone": "America/Bogota",
	"dependencies": {},
	"exceptionLogging": "STACKDRIVER",
	"runtimeVersion": "V8",
	"webapp": {
		"executeAs": "USER_DEPLOYING",
		"access": "DOMAIN"
	},
	"oauthScopes": [
		"https://www.googleapis.com/auth/spreadsheets",
		"https://www.googleapis.com/auth/drive",
		"https://www.googleapis.com/auth/script.external_request",
		"https://www.googleapis.com/auth/script.scriptapp",
		"https://www.googleapis.com/auth/gmail.send",
		"https://www.googleapis.com/auth/script.send_mail",
		"https://www.googleapis.com/auth/userinfo.email"
	]
}
```

Despliegue y publicación — Paso a paso detallado:
1. Abrir el proyecto en el editor de Apps Script (Editor clásico o nuevo IDE).
2. Verificar `appsscript.json` y añadir la propiedad `oauthScopes` como en el ejemplo anterior.
3. Ejecutar manualmente `validateConfig()` desde el editor (Run) y revisar la consola para asegurar que no hay errores.
4. Ejecutar `diagnosticarSistema()` y confirmar `success: true` en la salida (o revisar los logs y corregir faltantes).
5. Autorizar manualmente funciones críticas que requieren permisos (por ejemplo, ejecutar una función que interactúe con Drive y otra con Gmail) para que el proyecto solicite scopes al deployer.
6. En el IDE seleccionar **Deploy** → **New deployment**.
	 - Tipo: `Web app`.
	 - Execute as: seleccionar `Me` (cuenta administrativa que gestiona los datos) o `USER_DEPLOYING` según la política del equipo.
	 - Who has access: `Only myself`, `Domain` (organización) o `Anyone` según la necesidad.
7. Completar el despliegue y copiar la URL del Web App; probar acceso con un usuario con rol de prueba.
8. Instalar triggers (si aplica): en el editor ejecutar `instalarTriggersPAC()` desde la cuenta admin. Verificar que `ScriptApp.getProjectTriggers()` muestra los triggers esperados.
9. Revisar la hoja `Permisos` y la configuración en `CONFIG` (IDs de archivos, hojas, correos de admin).
10. Hacer una prueba end-to-end: crear un registro de prueba en `Datos`, ejecutar flujo de generación de reporte y verificar que el PDF aparece en Drive y que las notificaciones por correo se envían.
11. Documentar en el registro de cambios (CHANGELOG) la versión del despliegue y los pasos realizados.

Comandos útiles (CLI / clasp) — opcional:
1. Autenticarse y subir cambios con `clasp`:
```bash
clasp login
clasp push
```
2. Para desplegar con `clasp` (nuevo deployment):
```bash
clasp deploy --description "Deploy vX.Y" --webapp
```
Nota: `clasp deploy --webapp` puede requerir parámetros adicionales; revisar la versión de `clasp` y la documentación antes de su uso.

Archivo(s) clave y propósito (mapa rápido):
- `Codigo.js` — Orquestador principal y endpoints `doGet`, utilidades cliente-servidor, generación de PDFs y funciones públicas. ([Codigo.js](Codigo.js))
- `config.js` — Configuración central (`CONFIG`, `getConfig`, `validateConfig`, `diagnosticarSistema`). ([config.js](config.js))
- `datos.js` — Abstracciones para lectura/escritura sobre la hoja principal (clase/funciones de acceso). ([datos.js](datos.js))
- `pac_api.js` — Lógica del módulo PAC (sync, cálculos, APIs internas, envíos). ([pac_api.js](pac_api.js))
- `pac_gestor.js` / `pac_config.js` / `pac_setup.js` — Gestión, constantes y rutinas de setup/instalación del PAC. ([pac_gestor.js](pac_gestor.js))
- `pac_triggers.js` — Instalación y handlers de triggers (`triggerSemanalPAC`, `triggerDiarioAlertasCriticas`). ([pac_triggers.js](pac_triggers.js))
- `Index.html`, `pac_ui.html`, `pac_seccion.html` — Plantillas HTML y UI del frontend. ([Index.html](Index.html))
- `auditoria.js`, `permisos.js` — Gestión de auditoría y permisos por usuario/rol. ([auditoria.js](auditoria.js))
- `reportes.js` — Construcción y exportación de reportes (PDF/Drive). ([reportes.js](reportes.js))
- `utilidades.js`, `validacion.js`, `validaciones.js`, `verificacion.js`, `motor_reglas.js` — Librerías auxiliares y validaciones del dominio. ([utilidades.js](utilidades.js))

Reglas básicas y buenas prácticas de desarrollo (recomendadas para este proyecto):
1. Configuración centralizada: usar siempre `CONFIG` y las funciones `getConfig()` / `getConfigOrDefault()`; evitar IDs y credenciales hardcodeadas en funciones. Si agrega un nuevo archivo de datos, incluir su ID en `CONFIG.DATA_FILES_IDS`.
2. Validar `CONFIG`: ejecutar `validateConfig()` o `diagnosticarSistema()` tras cambios en `CONFIG` antes de desplegar.
3. Manejo de permisos: controlar accesos mediante `permisos.js` / `GestorPermisos` y no confiar sólo en la UI para la seguridad.
4. Triggers: instalar/desinstalar triggers sólo desde una cuenta administrativa (usar `instalarTriggersPAC()` y `eliminarTriggersPAC()`); documentar en el cambio de versión cuándo cambiar horarios.
5. Logs y auditoría: usar `GestorAuditoria` para registrar acciones críticas; no eliminar hojas de logs en producción.
6. Envío de correos: preferir `MailApp.sendEmail()` con `htmlBody` y registrar cada envío en la hoja de log para rastreo.
7. Concurrencia y límites: diseñar operaciones de escritura por lotes (appendRows) y considerar `LockService` si introduce procesos paralelos.
8. Manejo de errores: capturar excepciones en funciones exportadas (p.ej. `doGet`, triggers) y notificar al admin vía correo si falla un trigger (`_notificarErrorTrigger`).
9. Pruebas locales: antes de publicar, probar `diagnosticarSistema()` y las funciones de `pac_setup.js` para confirmar estructura de hojas y permisos.
10. Datos sensibles: NO incluir credenciales sensibles en el código; usar `PropertiesService.getScriptProperties()` para secretos no-versionados.

Despliegue y publicación (pasos mínimos):
1. Desde el editor de Apps Script: seleccionar "Deploy" → "New deployment" → "Web app".
2. Ejecutar como: la cuenta administrativa que gestiona los datos (ej. cuenta del proyecto IDU). Acceso: elegir según necesidad (solo organización / anyone con enlace).
3. Autorizar scopes que el sistema requiere (sheets, drive, gmail, urlfetch, etc.).
4. Instalar triggers (si aplica) ejecutando `instalarTriggersPAC()` desde la cuenta admin.

Checklist de verificación antes de un deploy a producción:
- [ ] `validateConfig()` pasa sin errores.
- [ ] `diagnosticarSistema()` devuelve `success: true`.
- [ ] Triggers configurados y probados manualmente en entorno de staging.
- [ ] Hoja `Permisos` poblada con roles correctos.
- [ ] Contactos admin definidos en `CONFIG.MANTENIMIENTO.CORREOS_CONTACTO`.

Notas de mantenimiento y asistencia:
- Función crítica de inclusión de HTML: `include(filename)` en `Codigo.js` (no eliminar).
- Punto de entrada web: `doGet(e)` en `Codigo.js` — contiene control de mantenimiento, validación de config y carga de plantilla.
- Funciones de exportación a PDF/XLSX usan `DriveApp` y `UrlFetchApp` y pueden requerir permisos adicionales.

## Documentacion viva obligatoria

- El archivo canónico de evidencia técnica del proyecto es `DOCUMENTACION_TECNICA_VIVA.md`.
- Cada cambio relevante en backend, frontend, configuración, PAC, auditoría, permisos o despliegue debe registrarse allí.
- Antes de modificar un archivo importante, documentar qué hace el archivo y qué se va a cambiar.
- Después de modificarlo, documentar funciones tocadas, impacto funcional, validaciones ejecutadas y referencias a líneas o bloques relevantes.
- Cuando se requiera entregable formal, usar ese Markdown como fuente para generar PDF o DOCX.
- Esta regla aplica también a cambios realizados desde otros agentes o flujos de trabajo, incluyendo sesiones paralelas o herramientas externas.

Contacto/Soporte interno:
- Autores originales y correos encontrados en plantillas y mensajes: `fabian.montanez@idu.gov.co`, `sistemasdtdp@idu.gov.co`.

Si quieres, actualizo este documento con ejemplos de despliegue paso a paso, los scopes exactos a incluir en `appsscript.json`, o un checklist automatizado para CI/CD. 

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate,
/document-release, /document-generate, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze,
/guard, /unfreeze, /gstack-upgrade, /learn.

## GBrain Configuration (configured by /setup-gbrain)
- Mode: local-stdio
- Engine: pglite
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: 2026-08-04
- MCP registered: no (`claude` CLI not found on PATH in this environment — register manually later with `claude mcp add --scope user gbrain -- <path-to-gbrain> serve` once the CLI is available)
- Embeddings: deferred (no OPENAI_API_KEY/VOYAGE_API_KEY/ZEROENTROPY_API_KEY set) — semantic search unavailable until configured with `gbrain config set embedding_model <id>` + `gbrain embed --stale`
- Artifacts sync: off
- Current repo policy: n/a (no git remote configured)

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

GBrain is set up locally on this machine (CLI only, no MCP tools registered — `claude` was not
found on PATH during setup). Semantic search is unavailable until an embedding provider key is
configured. Until then, prefer Grep for all code lookups in this repo. Once embeddings are
configured and the repo is imported (`gbrain import "$(pwd)" --no-embed && gbrain embed --stale`),
prefer `gbrain search "<terms>"` / `gbrain code-def <symbol>` for semantic or symbol-based
questions, and keep Grep for known exact strings, regex, and file globs.

<!-- gstack-gbrain-search-guidance:end -->

