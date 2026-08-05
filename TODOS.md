# TODOS — Aplicación de Predios

Backlog de deuda técnica identificada en la auditoría arquitectónica (`/plan-eng-review`) y de código (`/review`) del 2026-08-04. Ninguno de estos ítems bloquea producción por sí solo; se documentan aquí para no perderlos mientras se prioriza `ARCHITECTURE_V2.md`.

---

## 1. Implementar LockService en motores de reglas — [COMPLETADO 2026-08-04]

**Completado:** `LockService.getScriptLock()` (patrón try/catch/finally, `waitLock(20000)`) aplicado en `evaluador_alertas.js` (`obtenerReglasJSON`, `guardarReglasJSON`, `_guardarAlertasEnHoja`), `motor_reglas.js` (`obtenerReglasJSON`, `guardarReglasJSON` — copia duplicada) y `pac_gestor.js` (`aprobarBorradorPAC` y `_pac_compararYGenerarBorrador`, esta última es donde vive la segunda escritura masiva citada originalmente en línea ~1037, no dentro de `aprobarBorradorPAC` como se pensaba). Verificado con `node --check` en los 3 archivos.

**What (original):** Añadir `LockService.getScriptLock()` alrededor de las escrituras de `evaluador_alertas.js`, `motor_reglas.js` y `pac_gestor.js` (función `aprobarBorradorPAC`, líneas 889 y 1037).

**Why:** Estos tres archivos escriben hojas compartidas (`ALERTAS_ACTIVAS`, `CONFIG_REGLAS`, `PAC_Vigente`) sin ningún uso de `LockService` — confirmado por grep, cero coincidencias en los tres archivos. `datos.js`, `Codigo.js`, `reportes.js` y `permisos.js` sí bloquean sus escrituras críticas; esta es la excepción inconsistente. Dos usuarios aprobando un borrador PAC a la vez, o el motor de alertas corriendo mientras alguien edita `CONFIG_REGLAS`, es una condición de carrera real.

**Pros:** Elimina pérdida de escrituras y filas duplicadas bajo uso concurrente; alinea estos tres archivos con el patrón ya usado en el resto del código.

**Cons:** Requiere medir el tiempo de ejecución de `ejecutarMotor()` y `aprobarBorradorPAC()` para fijar un timeout de lock razonable (evitar que un lock mal dimensionado cause timeouts en cascada).

**Context:** `evaluador_alertas.js:18,20,43,355,359,381` y `motor_reglas.js:18,20,43` son los puntos de escritura sin lock. `pac_gestor.js:889,1037` es la escritura de `aprobarBorradorPAC`.

**Depends on / blocked by:** Ninguno — cambio aislado, se puede hacer archivo por archivo.

---

## 2. Resolver colisiones de funciones onOpen() — [COMPLETADO 2026-08-04]

**Completado:** `MatrizSeguimiento_script/ImportarDato.js:90` renombrada a `onOpenMatriz()` y `normalizacion_script/MenuNormalizacion.js:9` renombrada a `onOpenNormalizacion()`. La colisión de namespace con `Codigo.js:1833` (`onOpen()`) queda resuelta. Nota: al renombrarse, estas dos funciones ya no se disparan automáticamente como simple trigger `onOpen` de Apps Script si esas carpetas llegaran a desplegarse — dejan de ser el menú activo salvo que algo las invoque explícitamente. Esto es intencional dado que están desconectadas del proyecto principal (ver ítem original más abajo), pero **la decisión de fondo sobre dónde deben vivir estas carpetas sigue abierta** — el rename solo neutraliza el síntoma de colisión, no reemplaza esa decisión.

**What (original):** Decidir el destino de `MatrizSeguimiento_script/` y `normalizacion_script/` — moverlas a su propio proyecto Apps Script, excluirlas de `clasp push` vía `.claspignore`, o integrarlas formalmente si siguen siendo necesarias.

**Why:** `.clasp.json` tiene `"skipSubdirectories": false`, así que un `clasp push` empuja todo el repo. Ambas carpetas definen su propia `function onOpen()` (`MatrizSeguimiento_script/ImportarDato.js:90`, `normalizacion_script/MenuNormalizacion.js:9`), que colisiona con `Codigo.js:1833`. En JS/GAS la última declaración carga silenciosamente sobre las otras — sin error, sin aviso. Si alguien hace push sin excluir estas carpetas, el menú del spreadsheet puede cambiar de comportamiento sin que nadie lo note.

**Pros:** Elimina un riesgo de despliegue silencioso; clarifica qué carpetas pertenecen al proyecto Apps Script desplegado y cuáles son scripts auxiliares independientes.

**Cons:** Ninguno significativo — es principalmente una decisión de organización, no una reescritura.

**Context:** Confirmado que estas carpetas están 100% desconectadas del código rastreado (0 referencias cruzadas desde `Codigo.js`/`pac_*.js`/`config.js`/`datos.js`). Ver `CURRENT_STATE.md` para el flujo as-is de 3 etapas que estas carpetas representan.

**Depends on / blocked by:** Ninguno.

---

## 3. Desacoplar el monolito Index.html — [COMPLETADO parcial 2026-08-05: extracción CSS/JS + QA en runtime real]

**Completado:** `estilos.html` (1364 líneas, bloque `<style>` principal) y `app_js.html` (4281 líneas, bloque `<script>` principal, ~135 funciones) extraídos de `Index.html` y enlazados vía `<?!= include('estilos') ?>` / `<?!= include('app_js') ?>`. `Index.html` bajó de 7340 a 1697 líneas. `clasp push` al entorno de pruebas (confirmado NO-producción por el usuario) y QA manual en navegador real 2026-08-05: sin div de error de include() faltante, CSS cargado, sin `ReferenceError` en consola, onclick de la matriz responde, guardar seguimiento funciona, alertas cargan, módulo PAC funciona. El riesgo de scope global que preocupaba en la auditoría de Staff Engineer quedó descartado en la práctica, no solo en teoría.

**Sigue pendiente (no confundir con completado):** el resto del "What" original — agrupar el JS por sección funcional (matriz, PAC, alertas, auditoría, permisos) en archivos separados en vez de un solo `app_js.html` monolítico de 4281 líneas — nunca se hizo. Hoy `Index.html` pasó de 1 archivo gigante a 3 (Index/estilos/app_js), no a los ~7 módulos funcionales que planteaba el "What". Dejar como ítem de seguimiento si se retoma este refactor.

**What:** Dividir `Index.html` (7328 líneas, ~135 funciones JS inline, un solo `<style>` de 7000+ líneas de markup) en módulos más pequeños — al menos separar CSS a un archivo/`include()` propio y agrupar el JS por sección funcional (matriz, PAC, alertas, auditoría, permisos).

**Why:** Cualquier cambio de UI toca este único archivo, lo que genera alto riesgo de conflictos de merge con más de un desarrollador y dificulta ubicar código relacionado. GAS no tiene bundler nativo, pero `HtmlService`'s `include()` (ya usado para `pac_seccion.html`) permite dividir el archivo en partials sin cambiar la arquitectura de despliegue.

**Pros:** Reduce el blast radius de cada cambio de UI; hace más fácil revisar diffs de frontend.

**Cons:** Esfuerzo no trivial (día(s) de trabajo) por el tamaño del archivo; requiere probar que las ~135 funciones sigan resolviendo correctamente el scope global tras la división en partials vía `include()`.

**Context:** Ver hallazgo de arquitectura #`Index.html` monolítico en el diagnóstico del 2026-08-04. `ARCHITECTURE_V2.md` no cubre el frontend directamente — este ítem es independiente de esa migración.

**Depends on / blocked by:** Ninguno, pero conviene hacerlo antes de agregar features grandes de UI para no seguir creciendo el archivo.

---

## 4. Unificar capa de datos del módulo PAC e integrar flujos de Colab

**What:** (a) Migrar `pac_gestor.js`/`pac_api.js`/`pac_config.js`/`pac_setup.js`/`pac_triggers.js` para que usen `getConfig()`, `GestorDatos`, `GestorPermisos` y `GestorAuditoria` en vez de su config/accessor/cache paralelos (`PAC_CONFIG`, `pac_getSpreadsheet()`, `_PAC_RUNTIME_CACHE`). (b) Formalizar la integración del pipeline `consolidacion_colab/uniondatosfinales.py` → `normalizacion_script/` → matriz principal, o documentar explícitamente que es un proceso manual fuera de banda.

**Why:** El módulo PAC (2603 líneas across 5 archivos) tiene 0 llamadas a `getConfig()` y 0 uso de `GestorDatos`/`GestorPermisos`/`GestorAuditoria` — confirmado por grep. Esto significa que las acciones del PAC no pasan por el sistema central de auditoría ni por el control de permisos del resto de la app. El script de consolidación en Python (Colab) no tiene ninguna invocación automatizada desde el repo — es un paso manual que puede desincronizarse del resto del pipeline sin que nadie lo note.

**Pros:** Una sola fuente de verdad para acceso a datos, permisos y auditoría; reduce la superficie de bugs por duplicación de lógica; hace el flujo de datos end-to-end (Colab → normalización → matriz → PAC) auditable y trazable.

**Cons:** Es el ítem más grande de los cuatro — tocar el módulo PAC completo es un esfuerzo de varios días y requiere pruebas de regresión exhaustivas dado que actualmente no hay tests automatizados.

**Context:** `ARCHITECTURE_V2.md` ya propone la solución de fondo (BigQuery + Cloud Run reemplazando Colab/Sheets como fuente de verdad) — este ítem es el paso intermedio realista antes de esa migración mayor. Ver `pac_gestor.js:6-31` (`pac_leerHojaExterna`) como ejemplo del patrón paralelo a reemplazar.

**Depends on / blocked by:** Idealmente después del ítem 1 (locks) para no mezclar cambios de concurrencia con refactor de acceso a datos en el mismo módulo.

---

## 5. Mejorar manejo de errores (timeout vs parse) en LockService de los motores de reglas

**What:** En `guardarReglasJSON` y `obtenerReglasJSON` (`evaluador_alertas.js` y su copia duplicada en `motor_reglas.js`), diferenciar el `catch` para que un timeout de `lock.waitLock()` no se reporte al usuario como "El formato JSON es inválido" — ese mensaje debería reservarse para fallos reales de `JSON.parse()`.

**Why:** Hallazgo [P2] de la auditoría de Staff Engineer (`/review`, 2026-08-04) tras implementar `LockService` (ítem 1 de este backlog). En `guardarReglasJSON`, `lock.waitLock(20000)` vive dentro del mismo `try` que `JSON.parse(jsonString)`; si el lock expira por contención (dos administradores guardando reglas casi al mismo tiempo), el único `catch` devuelve el mensaje genérico de JSON inválido — un diagnóstico falso que confundiría a un admin cuyo JSON sí era correcto. Variante menor del mismo patrón en `obtenerReglasJSON`, donde un timeout en el bloque de auto-creación de `CONFIG_REGLAS` degrada a un `TypeError` capturado por el catch externo, con mensaje técnico en vez de explicar la causa real.

**Pros:** Diagnóstico correcto para el usuario ("inténtalo de nuevo, alguien más está guardando reglas" vs "revisa tu JSON"); evita reportes de bug falsos por parte de administradores confundidos por el mensaje incorrecto.

**Cons:** Ninguno significativo — cambio acotado a los bloques catch ya identificados, sin tocar la lógica de negocio.

**Context:** No es un hallazgo nuevo de diseño — es una regresión menor de calidad de mensaje introducida al añadir el LockService del ítem 1. No bloqueaba `/qa` según el dictamen de la auditoría (el sistema sigue devolviendo un error controlado, no un crash).

**Depends on / blocked by:** Depende del ítem 1 (ya completado) — este es su seguimiento directo.
