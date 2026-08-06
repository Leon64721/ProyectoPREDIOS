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

## 7. Subdivisión modular de `app_js.html` en 4 parciales funcionales — [PLANIFICADO 2026-08-05, no ejecutado]

**Planificado:** Dictamen de arquitectura (`/plan-eng-review` sobre `app_js.html`) completado el 2026-08-05. Análisis por profundidad de llaves (no `grep ^function`, que falla con la indentación inconsistente del archivo) identificó **127 declaraciones de función top-level, 116 nombres únicos, 11 duplicados** (no 4 como decía la Sección 12.5) y **33 sitios `google.script.run`**. Clasificación real por uso de `rawData`/`currentData`/`currentUser`/`state` (conteo por función, no estimado):

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
