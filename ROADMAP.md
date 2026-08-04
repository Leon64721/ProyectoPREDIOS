ROADMAP: Despliegue final a Google Apps Script

Precondiciones
- Tener acceso a la cuenta que será la deployer (cuenta administrativa con permisos de edición en la matriz principal).
- Confirmar el ID de la matriz principal en `config.js` / `CONFIG.DATA_FILES.PRINCIPAL`.
- Validar `appsscript.json` contiene los scopes necesarios.

1) Preparar entorno y verificar código local
- Revisa en el repo que los cambios se hayan aplicado y pushed.
- Abrir el proyecto en el editor de Apps Script (IDE) o usar `clasp`.

2) Ejecutar pruebas manuales en IDE (recomendado)
- Desde el IDE ejecutar `validateConfig()` como deployer.
- Ejecutar `diagnosticarSistema()` y confirmar `success: true` o revisar logs.
- Ejecutar `staging_diagnosticar()` y confirmar que se crea/actualiza la hoja `DIAGNOSTICO` en la matriz principal.
- Probar `saveTrackingData` con 2 casos:
  - Caso A (RT ubicado en la matriz principal): comprobar que la fila en `DATOS` se actualiza y que `SEGUIMIENTO` en la matriz principal recibe la fila.
  - Caso B (RT ubicado en un archivo externo): comprobar que la **matriz principal** recibe la fila en `SEGUIMIENTO` y que el archivo externo NO fue modificado.
- Probar generación de reportes: disparar el flujo que envía un informe y verificar que el correo llega con el adjunto CSV y que NO se crean archivos temporales en Drive.

3) Verificar triggers y locks
- Ejecutar manualmente `triggerSemanalPAC` y `triggerDiarioAlertasCriticas` y revisar que ejecutan sin errores y que los locks previenen ejecuciones simultáneas.

4) Revisar `appsscript.json` scopes
- Confirmar las siguientes scopes (mínimas recomendadas):
  - https://www.googleapis.com/auth/spreadsheets
  - https://www.googleapis.com/auth/drive
  - https://www.googleapis.com/auth/script.external_request
  - https://www.googleapis.com/auth/script.scriptapp
  - https://www.googleapis.com/auth/gmail.send
  - https://www.googleapis.com/auth/script.send_mail
  - https://www.googleapis.com/auth/userinfo.email
- Ajustar según política de seguridad (reducir `drive` a `drive.file` si no necesitas cambiar permisos compartidos fuera de la matriz).

5) Crear versión y desplegar (IDE)
- En Apps Script IDE: Deploy -> Manage deployments -> New deployment
  - Tipo: Web app (si corresponde) o Ejecutable según tu uso.
  - Execute as: selecciona la cuenta deployer (cuenta con write en la matriz principal).
  - Who has access: seleccionar según política (Only myself / Domain / Anyone).
  - Añadir descripción: "Optimized: restrict external writes + in-memory export + cache reads".
- Guardar el deployment y copiar el URL/ID resultante.

6) Pruebas post-deploy (smoke tests)
- Usar la URL del Web App o disparadores programados para correr los flows en staging.
- Ejecutar `staging_diagnosticar()` desde el deployer y revisar la hoja `DIAGNOSTICO`.
- Ejecutar una instancia de `saveTrackingData` y revisar que las escrituras quedan en la matriz principal.
- Enviar un reporte y verificar el adjunto CSV recibido.

Staging (Entorno 100% Aislado) — pasos adicionales
- Crear un nuevo Spreadsheet para Staging y copiar la estructura de la matriz principal (hojas `Datos`, `Seguimiento`, `Permisos`, `LOGS`, etc.).
- Crear un nuevo proyecto de Apps Script o duplicar el proyecto actual y vincularlo al Spreadsheet de Staging (recomendado para aislamiento completo).
- En el proyecto de Staging, actualizar `CONFIG.DATA_FILES.PRINCIPAL` y `CONFIG.DATA_FILES_IDS` para que apunten únicamente al ID del Spreadsheet de Staging.
- Verificar y, si se usa, actualizar cualquier ID hardcoded (`MAESTRO_PERMISOS`, `TU_ID_CARPETA_REPORTES`) para que apunten a recursos de Staging.
- Separar properties: usar `PropertiesService.getScriptProperties()` del proyecto de Staging — no compartir properties entre Prod y Staging. Asegurar que `MODO_MANTENIMIENTO` y otros flags estén configurados independientemente.
- No instalar triggers desde Producción: en Staging ejecutar `instalarTriggersPAC()` manualmente desde el IDE de Staging con la cuenta de deployer de Staging.
- Probar `staging_diagnosticar()` y confirmar que la hoja `DIAGNOSTICO` se crea en el Spreadsheet de Staging.
- Ejecutar los siguientes smoke tests en Staging:
  - `saveTrackingData` con RT en la matriz de Staging: comprobar actualización en `Datos` y entrada en `Seguimiento`.
  - `saveTrackingData` con RT en un archivo externo de prueba (solo lectura): comprobar que **no** se modifica el archivo externo y que el `Seguimiento` se registra en la matriz de Staging.
  - Ejecutar `ejecutarReporte` / flujo de reporte y verificar que el CSV adjunto llegue por correo y que no se creen archivos temporales no deseados en Drive de Staging.
  - Ejecutar `triggerSemanalPAC` y `triggerDiarioAlertasCriticas` manualmente desde el IDE de Staging y verificar que locks previenen ejecuciones simultáneas.

Rollback y limpieza en Staging
- Para evitar acumulación de archivos temporales y datos de prueba, mantener una rutina de limpieza en Staging: eliminar filas de prueba en `Datos`/`Seguimiento` y revisar la carpeta de Drive de Staging (si el flujo PDF lo genera allí).

Notas de seguridad adicionales
- No compartir la carpeta de Drive de Staging con producción ni usar permisos `ANYONE_WITH_LINK` en Staging por defecto.
- Mantener Tokens/Secrets fuera del código; usar `PropertiesService` del proyecto de Staging para valores de configuración privados.

7) Monitoreo y rollback
- Monitorizar logs (Stackdriver / Execution transcript) por 24-48 horas tras deploy.
- Si se detecta problema mayor, ir a Deploy -> Manage deployments y reactivar la versión anterior (rollback).

8) Limpieza y documentación
- Actualizar `CLAUDE.md` (ya hecho) y el changelog indicando la versión desplegada.
- Comunicar al equipo: ID de despliegue, cuenta deployer, pasos de validación.

Notas finales
- `solicitarPermisosFaltantes()` se mantiene como helper manual (no lo uso en producción automatizada).
- Si necesitas, puedo generar el commit y preparar el PR con título y descripción listos para merge en el repositorio remoto.
