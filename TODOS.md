# TODOS — Aplicación de Predios

Backlog de deuda técnica identificada en la auditoría arquitectónica (`/plan-eng-review`) y de código (`/review`) del 2026-08-04. Ninguno de estos ítems bloquea producción por sí solo; se documentan aquí para no perderlos mientras se prioriza `ARCHITECTURE_V2.md`.

## Cierre de sesión — 2026-08-12

**Estado general:** sesión finalizada y documentada.

**Evidencia guardada en repo:**
- [DOCUMENTACION_TECNICA_VIVA.md](DOCUMENTACION_TECNICA_VIVA.md) como bitácora canónica de cambios y validaciones.
- [PROTOCOLO_CIERRE_SESION_2026-08-06_COPILOT.md](PROTOCOLO_CIERRE_SESION_2026-08-06_COPILOT.md) como protocolo formal de cierre de la sesión previa.
- [Documento_Tecnico_Aplicacion_Predios.pdf](Documento_Tecnico_Aplicacion_Predios.pdf) y [Documento_Tecnico_Aplicacion_Predios.docx](Documento_Tecnico_Aplicacion_Predios.docx) como entregables formales.
- [Index.html](Index.html), [app_herramientas_js.html](app_herramientas_js.html) y [export_backend.js](export_backend.js) quedan en la raíz del proyecto con la versión publicada por el último push.

**Verificación ejecutada:**
- [x] `git status --short` revisado.
- [x] `npx clasp push --force` ejecutado y confirmado en la salida.
- [x] `git log -1 --pretty=oneline` capturado.
- [x] Se documentó la evidencia del cierre y el estado de la sesión actual.

**Nota de acceso a lo hecho por Claude:**
- El trabajo de Claude quedó visible a nivel de repo en archivos y documentación del proyecto; no hay un terminal paralelo accesible desde este entorno para ejecutar comandos ajenos a esta sesión.
- Si se quiere revisar el trabajo de la sesión de Claude desde la terminal, debe abrirse ese terminal o leerse la sesión/transcript local del VS Code de ese agente; desde este entorno solo podemos consultar el resultado visible en el proyecto y la evidencia persistida.

**Complemento (Claude Code, mismo cierre de jornada — no reemplaza lo anterior, lo completa):**
- Detalle completo del handoff Claude → Copilot → Claude (incluyendo por qué el `SyntaxError` no se pudo reproducir desde esta sesión y cómo lo resolvió Copilot en `58533e5`) en `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.27.
- Verificado directamente (no asumido) sobre el HEAD final `21d1bff`: `node --check` en los 8 archivos backend tocados hoy + extracción de `<script>` en los 4 partials frontend tocados/nuevos — 12/12 OK. `npx clasp push --force` → `Script is already up to date` (el `@HEAD` de Apps Script ya refleja este commit).
- Ítem 11 de este mismo backlog (LocalCache aislado por usuario) — completado y desplegado por Claude Code antes del handoff; ver marca `[COMPLETADO 2026-08-12]` más abajo.
- Sigue sin cambios el ítem 13 (validación visual en runtime): ninguna de las dos sesiones de hoy tuvo acceso a un navegador autenticado contra el dominio `idu.gov.co` para confirmarlo.

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

**Sigue pendiente (no confundir con completado):** el resto del "What" original — agrupar el JS por sección funcional (matriz, PAC, alertas, auditoría, permisos) en archivos separados en vez de un solo `app_js.html` monolítico de 4281 líneas — nunca se hizo. Hoy `Index.html` pasó de 1 archivo gigante a 3 (Index/estilos/app_js), no a los ~7 módulos funcionales que planteaba el "What". Dejar como ítem de seguimiento si se retoma este refactor. **Planificación de este seguimiento completada el 2026-08-05: ver ítem 7.**

**Corrección al conteo original (2026-08-05):** el "~135 funciones" citado abajo era una estimación. El conteo real por profundidad de llaves (no por `grep ^function`, que falla con indentación inconsistente) da **127 declaraciones top-level, 116 nombres únicos** (11 duplicados, no 4 como se documentó en la Sección 12.5 de `DOCUMENTACION_TECNICA_VIVA.md`). Ver ítem 7 para el detalle completo.

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

## 5. Mejorar manejo de errores (timeout vs parse) en LockService de los motores de reglas — [COMPLETADO 2026-08-05]

**Completado:** En `guardarReglasJSON` (`evaluador_alertas.js` y `motor_reglas.js`), el `JSON.parse(jsonString)` ahora se valida en su propio `try/catch` **antes** de tocar el lock — un JSON inválido nunca llega a `lock.waitLock()` y un timeout de lock nunca puede confundirse con un JSON inválido. La adquisición del lock vive en un segundo `try/catch` independiente que, si `waitLock(20000)` expira, devuelve `{ success: false, message: 'El sistema se encuentra ocupado por otro administrador. Por favor intente de nuevo en unos segundos.' }` sin ejecutar la lógica de guardado. En `obtenerReglasJSON`, el bloque de auto-creación de `CONFIG_REGLAS` captura el timeout de lock con el mismo mensaje de "sistema ocupado" en vez de degradar a un `TypeError` técnico. `lock.releaseLock()` se sigue garantizando en cada ruta donde el lock fue realmente adquirido (vía `finally`); las rutas donde `waitLock()` lanza excepción no necesitan liberar porque el lock nunca llegó a adquirirse. Auditado como Staff Engineer (equivalente a `/review`, repo sin rama base): sin fugas de lock, comportamiento de éxito sin cambios, ambos archivos siguen siendo comportacionalmente idénticos. Verificado con `node --check` en ambos archivos. Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.7 (`[CONC-P2.1]`).

**What (original):** En `guardarReglasJSON` y `obtenerReglasJSON` (`evaluador_alertas.js` y su copia duplicada en `motor_reglas.js`), diferenciar el `catch` para que un timeout de `lock.waitLock()` no se reporte al usuario como "El formato JSON es inválido" — ese mensaje debería reservarse para fallos reales de `JSON.parse()`.

**Why:** Hallazgo [P2] de la auditoría de Staff Engineer (`/review`, 2026-08-04) tras implementar `LockService` (ítem 1 de este backlog). En `guardarReglasJSON`, `lock.waitLock(20000)` vive dentro del mismo `try` que `JSON.parse(jsonString)`; si el lock expira por contención (dos administradores guardando reglas casi al mismo tiempo), el único `catch` devuelve el mensaje genérico de JSON inválido — un diagnóstico falso que confundiría a un admin cuyo JSON sí era correcto. Variante menor del mismo patrón en `obtenerReglasJSON`, donde un timeout en el bloque de auto-creación de `CONFIG_REGLAS` degrada a un `TypeError` capturado por el catch externo, con mensaje técnico en vez de explicar la causa real.

**Pros:** Diagnóstico correcto para el usuario ("inténtalo de nuevo, alguien más está guardando reglas" vs "revisa tu JSON"); evita reportes de bug falsos por parte de administradores confundidos por el mensaje incorrecto.

**Cons:** Ninguno significativo — cambio acotado a los bloques catch ya identificados, sin tocar la lógica de negocio.

**Context:** No es un hallazgo nuevo de diseño — es una regresión menor de calidad de mensaje introducida al añadir el LockService del ítem 1. No bloqueaba `/qa` según el dictamen de la auditoría (el sistema sigue devolviendo un error controlado, no un crash).

**Depends on / blocked by:** Depende del ítem 1 (ya completado) — este es su seguimiento directo.

---

## 6. Habilitar exportación formal de `DOCUMENTACION_TECNICA_VIVA.md` a PDF/DOCX — [RESUELTO 2026-08-05]

**Resuelto:** `pdf.exe generate DOCUMENTACION_TECNICA_VIVA.md Documento_Tecnico_Aplicacion_Predios.docx --to docx` y la variante `--to pdf --cover --toc` se ejecutaron directamente sobre el documento y funcionaron sin error, generando ambos archivos en la raíz del repo (529KB / 1023KB). El comando `pdf.exe setup` (su propio smoke test interno) sigue fallando con el mismo error de Chromium, pero **no afecta** al comando real de generación (`generate`), que es el que importa para este caso de uso. Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.6 y 17.3.

**What (original):** Resolver el error de `make-pdf` (`~/.claude/skills/gstack/make-pdf/dist/pdf.exe setup` falla con `Blocked: scheme "about:" is not allowed` al lanzar Chromium vía el `browse` tool interno de gstack) para poder exportar la bitácora técnica viva a un entregable formal.

**Why:** El proyecto ahora mantiene `DOCUMENTACION_TECNICA_VIVA.md` como fuente canónica de evidencia técnica (ver Sección 2 y 7 de ese documento). El usuario necesita, en algún punto, un entregable formal (PDF o Word) para radicados/informes al IDU. `make-pdf` ya soporta `--to docx` directamente (no requiere Pandoc), pero su pipeline de renderizado depende del mismo `browse` tool que ya mostró comportamiento poco confiable en este entorno Windows/Git Bash durante el intento de QA con navegador (ver checkpoint de sesión `20260805-004443`).

**Pros:** Una vez resuelto, exportar la bitácora a PDF/DOCX es un solo comando (`pdf.exe generate DOCUMENTACION_TECNICA_VIVA.md --to docx --cover --toc`), sin depender de Pandoc externo.

**Cons:** El error parece un bug específico del `browse` tool en este entorno (rechaza `about:blank` al abrir una pestaña nueva) — puede requerir reportarlo aguas arriba en gstack o instalar Pandoc como alternativa mientras tanto.

**Context:** Verificado el 2026-08-05 (ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.6): el binario existe y su CLI responde correctamente (`--help`, `--version`), pero `pdf.exe setup` falla en el paso 2/5 ("Launching Chromium"). `./setup` completo de gstack no resolvió el problema.

**Depends on / blocked by:** Ninguno — es independiente del resto del backlog técnico del código.

---

## 7. Subdivisión modular de `app_js.html` en 4 parciales funcionales — [COMPLETADO 2026-08-06: Fases 1-4]

**Progreso (cierre 2026-08-06):**
- **Fase 1 — `app_core_js.html` — [COMPLETADO]** — commit `9415350`. 698 LOC: 16 globals, 23 funciones (utilidades, bootstrap, navegación), 8 parejas de duplicados reconciliadas. Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.9 para el detalle de la decisión de reconciliación de `setupModalCleanup` (cambio de comportamiento confirmado con el usuario, no solo refactor).
- **Fase 2 — `app_alertas_js.html` — [COMPLETADO]** — commit `29e204d`. 502 LOC, 16 funciones del dominio de reglas/alertas.
- **Fase 3 — `app_permisos_js.html` — [COMPLETADO]** — commit `70c22bb`. 371 LOC, 24 funciones del dominio de permisos/reportes/auditoría. Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.10.
- **Fase 4 (final) — `app_matriz_js.html` — [COMPLETADO]** — commit `a397a5e`. 2504 LOC, 53 funciones únicas (filtros, paginación, KPIs, trimestres, render de tabla, `submitTracking` → `saveFollowupData`). Reconciliadas las últimas 3 duplicadas del sistema (`populateDropdowns`, `onProyectoChange`, `onTramoChange`) — sin ambigüedad, la copia activa ya era la más completa. `app_js.html` retirado por completo (`git rm`). Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.11.
- `clasp push` ejecutado 3 veces a lo largo de las 4 fases (39, 40 y 40 archivos) al entorno de pruebas confirmado NO-producción.
- **Sistema final: 4075 LOC en 4 partials, 116 funciones únicas — coincide exactamente con el conteo del dictamen original (12.8).** Cero colisiones de nombres, cero funciones huérfanas.
- **QA manual en navegador: SIGUE PENDIENTE desde la Fase 2.** Se solicitó 3 veces (cierre de Fases 2, 3 y 4) sin confirmación de resultado del usuario. **Es el único paso que falta para cerrar CONC-FE-02 por completo — no asumir el proyecto funcionalmente cerrado hasta esa confirmación explícita.**

**Planificado (contexto original):** Dictamen de arquitectura (`/plan-eng-review` sobre `app_js.html`) completado el 2026-08-05. Análisis por profundidad de llaves (no `grep ^function`, que falla con la indentación inconsistente del archivo) identificó **127 declaraciones de función top-level, 116 nombres únicos, 11 duplicados** (no 4 como decía la Sección 12.5) y **33 sitios `google.script.run`**. Clasificación real por uso de `rawData`/`currentData`/`currentUser`/`state` (conteo por función, no estimado):

| Destino propuesto | Funciones | LOC reales | Contenido |
|---|---|---|---|
| `app_core_js.html` | 31 | ~861-999 (según si se reconcilian duplicados antes o después) | Declaraciones `let/const` globales (única vez), utilidades UI genéricas (loaders/toasts/modales/onError), bootstrap de datos (`loadDashboardData`, `onDataLoaded`), chrome de app |
| `app_matriz_js.html` | 56 | 2390 | Filtros, paginación, KPIs, trimestres, render de tabla, `submitTracking` (→ `saveFollowupData`), `generatePdfReport` |
| `app_alertas_js.html` | 16 | 508 | Editor visual de reglas, tarjetas de alertas, exportación de riesgos |
| `app_permisos_js.html` | 24 | 364 | Usuarios, roles, reportes guardados, historial/auditoría, validación de integridad |

Confirmado por grep dirigido: **cero llamadas cruzadas** entre matriz/alertas/permisos — los 3 son hojas independientes que solo dependen de core. `state` (101 ocurrencias) resultó ser casi exclusivo de matriz, pero debe declararse en core igual, porque GAS no permite scope por partial — todo `include()` cae en el mismo `<script>` global y una redeclaración `let` duplicada entre archivos es un `SyntaxError` que rompe la carga completa de la página.

**Orden de `include()` obligatorio en `Index.html` (línea 1595, reemplazando el `include('app_js')` actual):** `app_core_js` primero siempre, luego `app_matriz_js`/`app_alertas_js`/`app_permisos_js` en cualquier orden entre sí (no hay dependencia entre ellos). Detalle completo del razonamiento (incluyendo por qué el riesgo de `ReferenceError` por orden es bajo en la práctica actual pero el orden sigue siendo la práctica correcta) en `DOCUMENTACION_TECNICA_VIVA.md`.

**Secuencia de extracción recomendada (4 PRs separados, no un solo corte):** 1) `app_core_js.html` (la base, cero dependencias de los otros 3), 2) `app_alertas_js.html` (módulo más chico, 0 dependencias cruzadas, sirve de canario de bajo riesgo), 3) `app_permisos_js.html` (mismo perfil de riesgo bajo), 4) `app_matriz_js.html` al final (el más grande y el único con lógica transaccional de guardado — dejarlo para cuando el patrón de 4 includes ya esté validado 3 veces).

**Hallazgo colateral no relacionado con este ítem:** `openModal()` se invoca en `app_js.html:1936` (onclick de celdas de matriz) y `app_js.html:2585` (tras guardar seguimiento) pero **no existe definida en ningún archivo del repo** — bug de referencia rota preexistente (`ReferenceError` en consola al hacer clic en una celda con datos), distinto de `openEditModal(rowData)` que sí existe con otra firma. No bloquea esta planificación; requiere su propio ítem de TODO si se decide corregir.

**What:** Ejecutar la extracción real (crear los 4 archivos, mover el código según la tabla de arriba, reconciliar las 11 funciones duplicadas eligiendo qué copia sobrevive antes de mover — no copiar ambas), actualizar el `include()` en `Index.html`, verificar `node --check` en los 4 archivos nuevos, y QA manual en navegador real repitiendo el checklist de la Sección 12.5 (sin `ReferenceError`, onclick de matriz responde, guardar seguimiento funciona, alertas cargan, módulo de permisos/reportes funciona).

**Why:** Es el seguimiento directo del ítem 3 — la extracción de `estilos.html`/`app_js.html` (FE-01) resolvió el riesgo de merge del archivo de 7340 líneas original, pero dejó un solo `app_js.html` de 4281 líneas con 116 funciones de 4 dominios de negocio distintos mezcladas. Esta planificación cierra la brecha entre "extracción mecánica" (hecha) y "modularización por dominio" (pendiente desde el `What` original del ítem 3).

**Pros:** Reduce aún más el blast radius de cambios de UI — tocar el editor de reglas ya no arriesga romper el guardado de seguimiento en el mismo archivo; facilita ubicar código por dominio funcional; el análisis de dependencias ya demostró que no hay acoplamiento oculto entre los 3 módulos hoja.

**Cons:** 4 archivos nuevos más el `Index.html` modificado; requiere reconciliar 11 duplicados con cuidado (elegir la copia vigente, no asumir); esfuerzo no trivial de QA en navegador real por cada uno de los 4 pasos de la secuencia recomendada.

**Context:** Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.8 (dictamen completo con grafo de dependencias ASCII y metodología). Corrige los números de la Sección 12.5 (FE-01).

**Depends on / blocked by:** Depende del ítem 3 (FE-01, ya completado) — es su continuación directa. No depende del ítem 4 (unificación de capa de datos PAC).

---

## 8. Fase 5 — Optimización de rendimiento, desacoplamiento de base de datos y rediseño UI/UX — [PLANIFICADO 2026-08-06]

**What:** (a) Envolver `getDashboardData` (`Codigo.js` ~323-440) y `getPACData` (`pac_api.js:5`) con `CacheService.getScriptCache()` (backend) y un caché de cliente en IndexedDB (frontend), con invalidación centralizada vía un helper `invalidateDataCache()` en cada punto de escritura conocido. (b) Mover el log de auditoría (`GestorAuditoria.registrarAccion` → `GestorDatos.agregarFila`) de la hoja `LOGS` dentro del spreadsheet principal a un spreadsheet nuevo y separado (`CONFIG.DATA_FILES_IDS.LOGS`), sin cambiar la firma pública de `logAction`/`getUserLogs` ni ninguno de sus 16 call sites. (c) Reemplazar los loaders de texto del Tablero de Seguimiento y del módulo PAC por Skeleton Loaders (placeholders con la forma real de filas/tarjetas), con un estado visual "datos parciales" cuando IndexedDB tiene un valor cacheado pero la respuesta real aún no llegó. (d) Extraer la lógica de lectura viva de `cache_backend.gs::getSearchHints()` (línea 251) y eliminar el resto del archivo (cola `CacheQueue`/`CacheStore`, triggers de procesamiento), que está muerto.

**Why:** `getDashboardData` abre el spreadsheet y lee `Datos`+`Seguimiento` completos por `getDisplayValues()` en cada carga, sin ningún caché — confirmado por lectura directa del código, causa raíz medida del tiempo de carga >5s reportado por el usuario. `GestorDatos.agregarFila` no tiene `LockService` propio y depende de que el llamador ya sostenga uno; el riesgo real no es el locking de la app sino la serialización interna de Google Sheets a nivel de **archivo completo**, no de pestaña — corrección hecha durante el Architecture Review tras framing inicial impreciso del usuario ("bloqueos por concurrencia" sugería `LockService`, pero `logAction` no tiene ninguno). Por eso una hoja LOGS separada en el MISMO archivo no resuelve nada; se requiere un spreadsheet **distinto**. Decisión tomada en modo HOLD SCOPE tras `/plan-ceo-review` (Mega Plan Review): Firestore/BD externa descartada por ROI negativo frente al costo/riesgo de reescritura dado el tamaño actual del sistema; arquitectura de 2 capas de caché (CacheService + IndexedDB) sobre el mismo origen Sheets es la opción de mejor retorno.

**Pros:** Ataca la causa raíz medida (lecturas síncronas sin caché) sin migrar la fuente de verdad; separa físicamente el log de auditoría del archivo transaccional, eliminando contención de escritura entre ambos; Skeleton Loaders mejoran la percepción de velocidad incluso antes de que el caché backend esté completamente afinado; reutiliza infraestructura ya presente en el proyecto (`CacheService`, `getConfig()`) en vez de introducir un servicio externo nuevo.

**Cons:** Requiere localizar y cubrir con `invalidateDataCache()` **todos** los puntos de escritura de `Datos`/`Seguimiento`/PAC (lista de call sites se completa en la implementación, Fase 5b — no es trivial dejarla incompleta sin romper consistencia de caché); `CacheService.put()` tiene un límite duro de 100KB/valor que puede excederse con el dataset actual (requiere try/catch con fallback a no-cachear, no un happy path simple); IndexedDB en el sandbox de `HtmlService` (origen `googleusercontent.com`) no tiene Service Worker disponible, así que solo sirve como caché de cliente plano, nunca como PWA con interceptación de `fetch` — verificado por WebSearch, no asumido; la migración de LOGS requiere copiar el historial existente al spreadsheet nuevo antes del corte, un paso operacional manual único.

**Context:** Ver diagramas Mermaid (arquitectura de componentes + secuencia de lectura acelerada) y el registro completo de modos de falla en `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.12. Revisión cruzada (Outside Voice, subagente independiente) encontró 8 huecos en el spec inicial — 6 incorporados como requisitos obligatorios de Fase 5a (lista de invalidación completa, nombre de función correcto, `cache_backend.gs` no está 100% muerto, manejo de overflow de 100KB, cache-key parametrizada para PAC, orden del check de mantenimiento antes de cualquier lectura de caché). Coordina con el ítem 4 (unificación de capa de datos PAC) sin bloquearlo ni ser bloqueado por él — son refactors complementarios sobre el mismo módulo.

**Depends on / blocked by:** Ninguno para la planificación (este ítem). La implementación (Fase 5b) puede paralelizarse en 2 worktrees independientes: backend/caché (`Codigo.js`, `cache_backend.gs`, `pac_api.js`, `CONFIG`) y frontend/Skeleton Loaders (`app_core_js.html`, `app_matriz_js.html`, `pac_seccion.html`) — sin conflicto de archivos entre ambos.

---

## 9. Duplicación de funciones de permisos entre `Codigo.js` y `permisos.js` — [COMPLETADO 2026-08-06]

**Completado:** `savePermission`/`deletePermission` (y las funciones auxiliares duplicadas) eliminadas de `Codigo.js`, dejando `permisos.js` como única fuente activa. Verificado con `node --check`. Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.22.

**What (original, para referencia):**

**What:** Determinar cuál copia de `deletePermission`, `getAllowedProjects`, `getPermissionsData`, `getUserRole` y `savePermission` es la que realmente ejecuta el editor de Apps Script (la última declarada en el orden de concatenación de archivos, que por convención de comunidad suele ser alfabético — `permisos.js` antes que dependa de dónde caiga `Codigo.js`, sin verificar en vivo todavía), y eliminar la copia muerta.

**Why:** Grep dirigido (`comm -12` sobre los nombres de función de ambos archivos) confirmó 5 nombres duplicados verbatim (solo difiere el espaciado) entre `Codigo.js` (líneas 875, 888, 901, y las de `getPermissionsData`/`getAllowedProjects`) y `permisos.js` (líneas 265, 275, y otras). Hallado como efecto colateral de la investigación de backend para la Fase 5, no relacionado con el rendimiento. Hoy es inofensivo porque ambas copias son funcionalmente idénticas, pero es una mina de futuro-edit: si alguien corrige un bug en una copia sin saber que existe la otra, el fix puede no aplicarse a la copia realmente activa.

**Pros:** Elimina la ambigüedad de "¿cuál copia edito?"; reduce 5 funciones duplicadas del inventario de duplicados del proyecto (relevante para el conteo de la Sección 12.8/ítem 7).

**Cons:** Requiere verificar en el editor real de Apps Script (no solo razonar por convención de orden alfabético) cuál copia gana antes de borrar nada, para no eliminar por accidente la que sí está activa.

**Context:** Descubierto durante la investigación de backend previa a la planificación de Fase 5 (ítem 8). No bloquea la Fase 5 — es un hallazgo colateral, registrado por separado a propósito.

**Depends on / blocked by:** Ninguno — se puede resolver de forma aislada en cualquier momento.

---

## 10. Duplicación de `activarFiltro`/`eliminarFiltro` dentro de `GestorFiltroMatriz` (`datos.js`) — [COMPLETADO 2026-08-06]

**Completado:** eliminadas las copias muertas (líneas originales ~319/388); las copias activas (~608/671) quedan como única implementación. Verificado con `node --check`. Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.22.

**What (original, para referencia):** `GestorFiltroMatriz` (clase completa en `datos.js:248-842`) define `activarFiltro` dos veces (líneas 319 y 608) y `eliminarFiltro` dos veces (líneas 388 y 671), dentro del mismo cuerpo de clase. En JS, la segunda declaración de un método sobrescribe silenciosamente a la primera en el mismo scope de clase — las copias de las líneas 319 y 388 son código muerto inalcanzable; las de 608 y 671 son las que realmente ejecutan. Verificar esto en el editor real de Apps Script (mismo tipo de verificación pendiente que el ítem 9) y eliminar las dos copias muertas.

**Why:** Hallado durante el `/review` de la Fase 5b (implementación de CacheService), al inyectar `invalidateDataCache()` en los 4 puntos de escritura de esta clase — se detectó la duplicación al confirmar los 4 `return { success: true, ... }` reales. A diferencia del ítem 9 (duplicación entre archivos distintos), esta es una duplicación **dentro del mismo archivo y la misma clase**, lo que la hace aún más fácil de introducir por error al copiar/pegar un método sin darse cuenta de que ya existía uno con el mismo nombre más arriba.

**Pros:** Elimina 2 funciones muertas del inventario del proyecto; reduce el riesgo de que un futuro fix se aplique a la copia equivocada (la que nunca se ejecuta).

**Cons:** Requiere confirmar en el editor real de Apps Script cuál copia es la activa antes de borrar — por las reglas de sobrescritura de JS debería ser la última declarada (línea 608/671), pero no se ha verificado en vivo, mismo caveat que el ítem 9.

**Context:** Como medida de seguridad inmediata, la Fase 5b ya inyectó `invalidateDataCache()` en las 4 copias (319, 388, 608, 671) — así que independientemente de cuál copia resulte ser la muerta, ninguna quedó con invalidación de caché faltante. Ver `DOCUMENTACION_TECNICA_VIVA.md` sección de Fase 5b para el detalle completo del `/review`.

**Depends on / blocked by:** Ninguno — igual que el ítem 9, se puede resolver de forma aislada. Conviene resolver ambos (9 y 10) en la misma sesión de limpieza ya que comparten el mismo tipo de verificación previa.

---

## 11. Exportación institucional y herramientas de datos — [COMPLETADO 2026-08-12]

**Completado:** se integró el partial de herramientas y exportación en [Index.html](Index.html), se creó el backend base [export_backend.js](export_backend.js) y se validó la sintaxis del script extraído del partial [app_herramientas_js.html](app_herramientas_js.html) sin errores.

**What:** dejar una capa reutilizable para CSV, headers institucionales, serialización segura y chunks de exportación sin bloquear la UI principal.

**Why:** el proyecto necesitaba una base de exportación que pudiera reutilizarse en matriz, alertas y PAC sin depender de procesos pesados en el navegador ni de duplicación de lógica.

**Pros:** reduce riesgo de errores por delimitadores y texto multilínea, centraliza metadata del IDU y prepara el camino para exportaciones PDF/Excel/CSV.

**Cons:** el flujo aún requiere integración funcional específica del botón de exportación en la UI y validación de QA real con datos de la app.

**Context:** corresponde a la fase inicial de Sprint 4 para reportes avanzados y exportación formal.

**Depends on / blocked by:** nada bloqueante para la base técnica; la validación de UX/QA real en runtime sigue pendiente.

---

## 12. Render parcial del tablero desde caché local (LocalCache) — deshabilitado por riesgo de fuga entre usuarios — [COMPLETADO 2026-08-12]

**Completado:** Implementado exactamente según el diseño de la sección "Why" de abajo, más 3 hallazgos de una revisión adversarial post-implementación que no estaban previstos en el diseño original:
- `Codigo.js::doGet()` (~línea 192): `template.userEmail = userEmail;` — email disponible de forma síncrona en el template.
- `Index.html` (~línea 1665, antes de `include('app_core_js')`): `const CURRENT_USER_EMAIL = <?!= JSON.stringify(userEmail) ?>;` — se usa `JSON.stringify` en vez de interpolación con comillas simples (`'<?= userEmail ?>'`) porque el escape HTML de `<?= ?>` no es lo mismo que escape de string JS; un apóstrofe legal en el local-part de un correo (`o'brien@dominio.com`) habría roto silenciosamente el namespacing.
- `app_core_js.html::loadDashboardData()`: cache-key `dashboardData_<email>`, pintado síncrono desde `localStorage` vía `onDataLoaded(cached.response)` antes de la llamada de red, badge "Sincronizando…" + opacidad reducida (`showSyncingIndicator`/`hideSyncingIndicator`, CSS nuevo en `estilos.html`).
- **Hallazgo adversarial 1 (crítico, corregido en el mismo commit):** `loadDashboardData()` se invoca desde ~7 sitios sin ningún guard de concurrencia — dos llamadas superpuestas podían resolver fuera de orden y la más vieja pisaba tanto el DOM como el `localStorage` recién escrito por la más nueva, persistiendo un dato incorrecto como si fuera "confirmado". Corregido con un token de carga (`_dashboardLoadToken`) que descarta respuestas obsoletas en ambos handlers (success/failure).
- **Hallazgo adversarial 2 (crítico, corregido en el mismo commit):** si `Session.getActiveUser().getEmail()` devuelve `''` (posible en ciertos contextos de auth), la implementación original caía en una llave compartida `dashboardData_anon`, reintroduciendo fuga entre usuarios sin email fiable en el mismo navegador. Corregido: sin `CURRENT_USER_EMAIL` fiable, la ruta optimista se desactiva por completo (ni lectura ni escritura de caché), no solo se degrada a una llave compartida.
- `node --check` (con extracción del `<script>` para los `.html`) y `npx clasp push --force` verificados. Ver commit `b1351a7`.

**What (original, para referencia):** El diseño original de Fase 5c pedía pintar instantáneamente el último `getDashboardData()` cacheado en el cliente (vía `LocalCache`/`localStorage`, con opacidad reducida y badge "Actualizando…") mientras se espera la respuesta real del servidor. Se implementó y luego se **removió deliberadamente** de `app_core_js.html::loadDashboardData()` antes de hacer commit, tras una revisión adversarial: `LocalCache` (localStorage) no está aislado por usuario ni por sesión — solo por origen+perfil de navegador. En un equipo compartido de oficina (plausible en un contexto de agencia gubernamental), un segundo usuario que abra la app dentro de la ventana de TTL (1h) vería por un instante filas de predios y el email del primer usuario antes de que llegue la respuesta real autorizada para él.

**Why (para resolverlo, no solo para descartarlo):** El aislamiento correcto requiere que el cliente conozca su propia identidad de forma SÍNCRONA, antes de la primera llamada `google.script.run` — hoy no existe ese mecanismo: `Session.getActiveUser().getEmail()` solo está disponible server-side, y el cliente solo la conoce después de una llamada RPC (`getUserRoles()`/`getDashboardData()`). La forma correcta de resolverlo es que `doGet()` (`Codigo.js`) inyecte el email del usuario autenticado directamente en el HTML servido (ej. `<script>const CURRENT_USER_EMAIL = '<?= Session.getActiveUser().getEmail() ?>';</script>` antes de cualquier otro script), permitiendo namespacing de la cache-key (`dashboardData:${CURRENT_USER_EMAIL}`) sin esperar ningún round-trip.

**Pros:** Una vez resuelto el namespacing, se recupera la ganancia de percepción de velocidad completa (pintura instantánea de datos "probablemente correctos" en vez de solo el Skeleton Loader) sin el riesgo de fuga entre usuarios.

**Cons:** Requiere tocar `Codigo.js::doGet()` e `Index.html` (fuera del alcance de los archivos de Fase 5c) — es un cambio de superficie de renderizado server-side, no solo de JS cliente.

**Context:** El Skeleton Loader (placeholders CSS pulsantes) SÍ quedó implementado y es la mejora principal de esta fase — este ítem era solo sobre la capa adicional de "pintar datos viejos mientras confirma", pospuesta en su momento vía AskUserQuestion en vez de aceptar el riesgo entonces conocido. **Pendiente real que queda:** validación visual en runtime del badge "Sincronizando…" y del pintado optimista — cubierto por el ítem 13 (QA visual runtime), no por este ítem.

**Depends on / blocked by:** Ninguno — implementación cerrada. El ítem 13 (validación visual en runtime) sigue siendo el bloqueador abierto del backlog para poder dar por cerrado el Sprint 1 completo (incluye validar visualmente este ítem).

---

## 12. Coordinación entre agentes concurrentes sobre el mismo `@HEAD` de `clasp` — [PENDIENTE, hallado 2026-08-06]

**What:** Establecer un protocolo (aunque sea informal — un aviso en el chat, un archivo lock, o simplemente coordinar turnos) antes de que más de una sesión de agente (Claude Code, GitHub Copilot, o cualquier otra) ejecute `clasp push` sobre el mismo deployment `@HEAD` en una ventana de tiempo cercana.

**Why:** Durante la depuración de un `SyntaxError` en Fase 5c, se descubrió que una sesión de GitHub Copilot había editado `Index.html` (eliminando por accidente la línea `<?!= include('app_permisos_js') ?>`, con un diagnóstico basado en el estado desactualizado del repo — creía que `Index.html` todavía incluía `app_js`, retirado desde la Fase 4 de CONC-FE-02) y había ejecutado su propio `clasp push`, todo esto en el working tree local sin commitear, de forma concurrente con esta sesión de Claude Code. El `clasp push --force` de esta sesión estuvo a punto de volver a desplegar esa versión rota sin darse cuenta — se detectó por revisar `git status`/`git diff` antes de comitear, no porque el proceso lo hubiera prevenido. Ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.15-12.16 para el detalle completo.

**Pros:** Evita que el trabajo de un agente sobrescriba silenciosamente el de otro en el mismo deployment; reduce el riesgo de que un usuario reporte "sigue roto" cuando en realidad el problema es que dos versiones distintas se están alternando en producción sin que nadie lo note.

**Cons:** Requiere un mecanismo de coordinación que hoy no existe — este proyecto ya usa `DOCUMENTACION_TECNICA_VIVA.md` como bitácora compartida (ver Sección 7), pero eso documenta DESPUÉS del hecho, no previene el push concurrente en sí.

**Context:** Confirmado por timestamps de archivo (`Index.html` y `DOCUMENTACION_TECNICA_VIVA.md` modificados minutos antes de que esta sesión empezara a editar los mismos archivos) — no es una hipótesis, es un incidente real ya ocurrido una vez.

**Segunda ocurrencia (2026-08-06, tarde-noche, sin daño esta vez):** entre las 21:42 y las 23:31 dos sesiones (esta y una concurrente) hicieron `clasp push` sobre el mismo `@HEAD` sin coordinación explícita, produciendo 5 commits entrelazados (`5dfa099`, `b0a498b`, `9083bbd`, `da7ba22`, `e80222c`) que tocaron los mismos archivos (`Index.html`, `app_matriz_js.html`, `Codigo.js`) desde ángulos distintos (grid Bootstrap vs. dropdown widget para la barra de filtros; embebido vs. remoción de `filtrosMatriz` del payload). A diferencia del incidente original, esta vez no hubo rotura — verificado en `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.24 que el diseño dual-mode de `cargarFiltrosMatriz()` absorbió el cambio de payload sin conflicto — pero fue compatibilidad accidental, no por el protocolo (que sigue sin existir). Refuerza que este ítem sigue abierto y con probabilidad real de repetirse.

**Depends on / blocked by:** Ninguno — es una decisión de proceso/flujo de trabajo, no de código.

---

## 13. Validación visual en runtime (WebApp real) — cierre de Sprint 1 — [PENDIENTE, hallado 2026-08-06]

**What:** Ejecutar la corrida manual guiada por `QA_SPRINT1_UIUX.md` sobre el deployment `@HEAD` real: medir `t_boot_start` → primer render visible, validar Matriz y Alertas en desktop (1440/1024px) y mobile (768/360px), confirmar que los dropdowns buscables responden a Enter/Escape sin glitch de cierre, revisar overflow de cabeceras/celdas en la tabla PAC, y repasar labels/alineación en Historial, Auditoría, Permisos y Reportes. Registrar tiempos y hallazgos en `DOCUMENTACION_TECNICA_VIVA.md`.

**Why:** Toda la Fase 8/8b/CONC-FE-04 (Secciones 12.17-12.24) fue validada por código (`node --check`, `get_errors`, lectura directa) pero **cero validación visual en navegador real** se ha ejecutado sobre estos cambios. Es la brecha real que separa "Sprint 1 técnicamente listo" de "Sprint 1 cerrado" — no una reimplementación de Fase 8b, que ya está hecha (ver Sección 12.24 para la corrección explícita de esa premisa errónea).

**Pros:** Es el único paso que falta para cerrar Sprint 1 de `DESIGN.md` con confianza real, no solo con evidencia de código.

**Cons:** Requiere sesión interactiva con navegador y usuario autenticado — no automatizable desde esta sesión de agente sin acceso a browser real contra el deployment.

**Context:** Ver `QA_SPRINT1_UIUX.md` (checklist completo por pantalla) y `DOCUMENTACION_TECNICA_VIVA.md` Sección 12.24.

**Depends on / blocked by:** Ninguno — puede ejecutarse en cualquier momento sobre el `@HEAD` actual.

---

## 14. Fase C — Integración UI y Visualización de Alertas — [COMPLETADO 2026-08-12]

**Completado:** `app_alertas_js.html` incluye `renderizarResumenAlertas(alertasResumen)`, `app_core_js.html` lo dispara desde `onDataLoaded`, los badges `#badgeCriticas`, `#badgeAdvertencias` y `#badgeTotalAlertas` reflejan severidades reales, y el modal `#modalDetalleAlertas` permite abrir el RT relacionado desde la lista de alertas. La estructura `alertasResumen` queda persistida dentro del mismo payload de `dashboardData_<email>` en IndexedDB, y el render optimista reusa ese valor en la primera pintura sin usar `localStorage` ni scriptlets `<?= ?>`.

**Verificación:** `node --check` sobre el contenido extraído de los partials de UI y validación del flujo completo de carga del dashboard.

---

## 15. Sprint 2 — Endurecimiento y cierre de alertas (Fase D) — [COMPLETADO 100% 2026-08-12]

**Cierre operativo:** se implementaron los estados vacíos del resumen, se añadió el tope `MAX_ALERTAS_PAYLOAD = 100` para evitar degradación del payload en picos masivos, y se validó el flujo de alertas en backend y UI sin introducir regresiones.

**Cobertura:** batch backend, render seguro, caché cliente y cierre documental del Sprint 2.

**Verificación ejecutada:** `npx clasp push --force` completado con éxito; `git commit -m "fix(alerts): implement empty-state rendering, payload limits, and close Sprint 2 [CONC-BE-04]"` creado en `7094284`; `node --check` verificado sobre los scripts extraídos/afectados; y sincronización del contexto en gbrain completada con el slug `sprint-2-alertas-hardening`.

---

## 15.5. Sprint 3 — Módulo de Normalización y Cruce Colab — [PLANIFICADO 2026-08-12]

**Objetivo:** convertir la normalización en un pipeline backend-first, trazable y validable antes del merge operativo.

**Fase A — Core Backend:** [COMPLETADO 2026-08-12] reforzar lectura completa, normalización, unificación, validación de RT y esquema objetivo; mantener fuente de verdad centralizada y establecer trazabilidad de ejecución. Implementación realizada en `normalizacion_script/ConfigNormalizacion.js` y `normalizacion_script/CoreNormalizacion.js` con diccionario maestro, sanitización V8 y detección de conflictos por lotes.

**Fase B — UI de Mapeo:** [COMPLETADO 2026-08-12] crear una capa visual para revisar columnas, propuestas de mapeo, conflictos semánticos y resultados de previsualización antes de confirmar el merge. Incluye modal `#modalMapeoNormalizacion`, reporte visual de conflictos y persistencia intermedia en IndexedDB bajo la clave `normalizacion_map_<USER_EMAIL>`.

**Fase C — Validación y Merge:** [COMPLETADO 2026-08-12] ejecutar validación final de filas, columnas críticas y estructura objetivo; materializar el resultado final y dejarlo listo para consolidación operativa con los módulos principales. Queda integrada la confirmación del modal de mapeo con la ejecución operativa de `ejecutarNormalizacionCompleta(payload)`, la persistencia del mapeo en IndexedDB y el refresco del tablero tras la normalización.

**Why:** la lógica ya existe en `normalizacion_script/CoreNormalizacion.js`, `ConfigNormalizacion.js` y `MenuNormalizacion.js`, pero necesita pasar de ejecución manual aislada a pipeline operativo con intermedios persistidos y validación de negocio. El enfoque debe priorizar procesamiento backend, no render del navegador.

**Verificación ejecutada:** `node --check normalizacion_script/MenuNormalizacion.js`, `node --check normalizacion_script/CoreNormalizacion.js` y validación del bloque JS del modal `app_normalizacion_js.html` sin errores reportados por el editor.

**Contexto de arquitectura:** gráfo validado con `graphify query "Normalizacion"`; núcleo funcional detectado y documentado en `ARCHITECTURE_V3.md`.

**Depends on / blocked by:** ninguno funcional, pero requiere cerrar la preparación de backend y de revisión de calidad antes de merge operativo.

---

## 16. Fase 9 (`DESIGN.md`) — Sprints 2 a 5: consistencia de filtros, layout/legibilidad, microinteracciones y accesibilidad — [PLANIFICADO, no iniciado]

**What:** Ejecutar los Sprints 2-5 definidos en `DESIGN.md` Sección 5: (2) migrar todos los selects de filtros restantes a `SearchableDropdown` con contador de coincidencias y QA responsive; (3) normalizar spacing vertical global, corregir overflow/word-break restante, revisar contraste AA; (4) estandarizar toasts y animaciones de apertura/cierre; (5) navegación por teclado, atributos ARIA y pruebas de regresión visual por captura.

**Why:** `DESIGN.md` es un plan de diseño Fase 9 completo (creado 2026-08-06 por la sesión concurrente) del cual solo el Sprint 1 (performance de arranque) tiene trabajo de código ejecutado (Secciones 12.17-12.24). Los Sprints 2-5 son planificación pura todavía, no deuda técnica retroactiva.

**Pros:** Plan ya existe con criterios de aceptación claros (`DESIGN.md` Sección 6) — no requiere replanización, solo ejecución.

**Cons:** Alcance grande (5 sprints), varios módulos (Alertas, PAC, Historial, Auditoría, Permisos) — no es un cambio aislado.

**Context:** Ver `DESIGN.md` completo para el plan de diseño y el orden de implementación recomendado (Sección 7).

**Depends on / blocked by:** Depende de que el ítem 13 (validación visual runtime) confirme que el Sprint 1 quedó realmente cerrado antes de iniciar el Sprint 2, para no construir sobre una base sin validar.
