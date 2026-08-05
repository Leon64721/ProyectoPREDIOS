**Resumen Actual**
- **Propósito:** Consolidar múltiples orígenes (Excel/Sheets) → normalizar columnas y tipado → cargar en la Matriz principal y exponer UI/automations vía Google Apps Script.

**Flujo As-Is (tres etapas)**
- **1. Consolidación (Colab / Python):** proceso batch que une orígenes históricos, aplica heurísticas de limpieza y genera un snapshot consolidado.
  - Implementación: [consolidacion_colab/uniondatosfinales.py](consolidacion_colab/uniondatosfinales.py)
  - Salida esperada: archivo `CONSOLIDADO_SNAPSHOT_V21.csv` (o ruta equivalente en Drive).
  - Notas: usa librerías Python (pandas, sentence-transformers opcional) y genera artefactos de progreso y memoria (JSON, lotes CSV).

- **2. Normalización (pipeline JS local / Apps Script helper):** toma el snapshot y aplica reglas de unificación de encabezados, tipado estricto, enriquecimientos y transformaciones de columnas.
  - Implementación: [normalizacion_script/ConfigNormalizacion.js](normalizacion_script/ConfigNormalizacion.js) y [normalizacion_script/CoreNormalizacion.js](normalizacion_script/CoreNormalizacion.js)
  - Resultado: hoja `DATOS_NORMALIZADOS` con estructura objetivo y reportes de calidad.
  - Notas: reglas detalladas en `CONFIG_NORMALIZACION`, garantizan preservación de filas y tipado coherente.

- **3. Plataforma de operación (Google Apps Script — repositorio raíz):** UI web (`HtmlService`), endpoints públicos, triggers y reglas de negocio; gestiona la Matriz, PAC, reportes y auditoría.
  - Puntos clave: `Codigo.js` (orquestador), `datos.js` (GestorDatos / batch writes), `pac_*` (PAC sync y triggers), `reportes.js`, `permisos.js`, `auditoria.js`.
  - Cambios recientes importantes: batch `setValues` para escrituras, `LockService` en flujos críticos, in-memory CSV/PDF via `Utilities.newBlob()` y envío por correo (se evita `ANYONE_WITH_LINK`).
  - Notas operacionales: `CONFIG.DATA_FILES.PRINCIPAL` centraliza escritura; runtime cache `_PAC_RUNTIME_CACHE` para lecturas externas.

**Artefactos y archivos relevantes**
- Consolidación: [consolidacion_colab/uniondatosfinales.py](consolidacion_colab/uniondatosfinales.py)
- Normalización: [normalizacion_script/ConfigNormalizacion.js](normalizacion_script/ConfigNormalizacion.js), [normalizacion_script/CoreNormalizacion.js](normalizacion_script/CoreNormalizacion.js)
- Apps Script principal: `Codigo.js`, `datos.js`, `pac_gestor.js`, `pac_triggers.js`, `reportes.js`, `permisos.js`, `reportes.js`, `Index.html` (UI)

**Riesgos y observaciones**
- Consolidación en Colab produce artefactos fuera del control de Apps Script; coordinar IDs y rutas antes de cargar.
- Procesos concurrentes en Apps Script resueltos parcialmente con `LockService`, pero conviene validar con cargas concurrentes en Staging.
- Temporal doc creation for PDF still occurs (trashed afterwards); validar límites y quotas de Drive/Gmail en producción.

**Siguientes pasos recomendados (prioritarios)**
- Preparar entorno de Staging: clonar spreadsheet principal, actualizar `CONFIG` y desplegar proyecto Apps Script separado.
- Ejecutar pruebas E2E: 1) flujos de guardado concurrente; 2) export CSV/PDF por correo; 3) triggers schedule/manual run.
- Crear `CURRENT_STATE.md` en la carpeta de docs (este archivo). 

Si quieres, genero el checklist de staging y los scripts de prueba automatizados para validar concurrencia y quotas.