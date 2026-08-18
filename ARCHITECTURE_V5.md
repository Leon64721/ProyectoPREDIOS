# ARCHITECTURE_V5.md — Sprint 6: Estabilización Post-Línea Cero (Performance, Limpieza y UX)

**Estado:** [PLANIFICACIÓN — investigación completada, código no tocado todavía]
**Agente:** Claude Code (Claude Sonnet 5, orquestado con gstack v1.60.1.0).
**Fecha:** 2026-08-18.
**Contexto:** la Línea Cero (Sprint 5) redujo los RTs pendientes de ~9691 a 4690 — éxito confirmado por el usuario en producción. Este sprint no es funcionalidad nueva, es estabilización: 4 puntos críticos de UX/Performance levantados directamente por el usuario tras usar el sistema real.

---

## 0. Hallazgos del `/investigate` — verificados contra código, no asumidos

### 0.1 "Archivo faltante: export_backend.html"

**Confirmado.** `Index.html:1843` tiene:
```html
<?!= include('export_backend') ?>
```
`include(filename)` (`Codigo.js:13`) llama a `HtmlService.createHtmlOutputFromFile(filename).getContent()`, que busca un archivo **`.html`** con ese nombre exacto. `export_backend.js` es un archivo de servidor V8 plano (funciones globales, mismo patrón que `export_pdf_backend.js`/`gestion_equipos_backend.js`) — **nunca debió incluirse vía `include()`**, porque no necesita inclusión: cualquier función global de un `.js` de servidor ya está disponible en todo el proyecto sin scriptlet. Confirmado con `Glob: export_backend.html` → 0 resultados en todo el repo. Esta línea rompe cada carga de `doGet()` con el error exacto reportado por el usuario.

**Nota:** este `include()` roto no fue introducido por las sesiones de Sprint 4/5 documentadas en este repositorio — no aparece en los cambios de `export_backend.js` (creado en Sprint 4 Fase A, commit previo a esta cadena de sesiones). Es deuda preexistente que nadie había disparado hasta ahora porque `export_backend.js` fue el primer archivo `.js` de servidor nuevo en llevar ese patrón de nombre calcado del de un `.html`.

### 0.2 Mensaje "pagar"/"premium" en Filtro Matriz

**No encontrado — la premisa original era incorrecta.** Búsqueda exhaustiva (`grep -ri "pagar|premium|de pago"` en todo el repo): las únicas coincidencias son términos de negocio legítimos del módulo PAC (`SALDO POR PAGAR`, `FORMA DE PAGO`, `NUMERO DE PAGOS` — columnas financieras reales de `pac_config.js`, `pac_gestor.js`, `normalizacion_script/ConfigNormalizacion.js`) y un comentario en `evaluador_alertas.js` sobre "porcentaje de pago". **Ninguna tiene relación con Filtro Matriz.**

Al buscar "rápido" en su lugar apareció el artefacto real: `Codigo.js:570` define `guardarYActivarFiltroManual()` con el nombre interno **"FILTRO MANUAL VISTA RÁPIDA"** — el "Filtro Rápido" de la matriz. La palabra que el usuario recordaba como "pagar" casi con certeza es una confusión con "rápido" (posible transcripción de voz a texto, dado el tono coloquial de sus mensajes en esta sesión) — no hay ningún mensaje de pago/premium bloqueando la funcionalidad.

**La lentitud real sí es genuina, y su causa está identificada:** `aplicarFiltroAdhoc()` y `restablecerFiltroAdhoc()` (`app_matriz_js.html:2393-2422`) llaman a `loadDashboardData()` — la **recarga completa del dashboard** — inmediatamente después de cada cambio de filtro. `activarFiltro()`/`eliminarFiltro()` (`datos.js:529-587`, `592-640`) sí invalidan correctamente `CacheService` (`invalidateDataCache()`, confirmado en ambas), así que cada toggle del Filtro Rápido fuerza un **cache-miss garantizado**: relectura completa de la hoja `Datos` (miles de filas) desde `SpreadsheetApp`, re-evaluación de alertas sobre el dataset completo, re-serialización, y re-render completo de la tabla en cliente. No es un bug de caché — es que el filtro está implementado como un cambio de *qué le manda el servidor al cliente*, en vez de un cambio de *qué muestra el cliente sobre datos que ya tiene*. Cada aplicar/quitar filtro paga el costo íntegro de una carga inicial del dashboard.

### 0.3 Botón "Recargar" no fuerza invalidación real

**Confirmado, dos capas de staleness, no una:**
1. `refreshData()` (`app_core_js.html:910-916`) solo llama a `loadDashboardData()` — **nunca llama a `invalidateDataCache()`**. Si el `CacheService` del servidor sigue vigente (TTL 1800s = 30 min, `Codigo.js` `getDashboardData()`), el "Recargar" devuelve exactamente el mismo payload cacheado, sin tocar `Datos` de nuevo.
2. `loadDashboardData()` (`app_core_js.html:783-817`) además pinta **primero** desde `IndexedDB` local (`readDashboardCache(cacheKey)`, patrón `dashboard-cache-v1` ya documentado en sesiones previas) de forma optimista, y solo después llega la respuesta de red — que, por el punto 1, puede ser la misma data vieja, reescribiendo el mismo IndexedDB con los mismos datos obsoletos. El botón "Recargar" hoy no tiene ninguna vía garantizada de traer datos realmente frescos dentro de la ventana de 30 minutos.

---

## 1. Plan de reingeniería — los 4 puntos

### 1.A Fix crítico: remover el `include()` roto

Eliminar `<?!= include('export_backend') ?>` de `Index.html:1843`. Cero riesgo — `export_backend.js` sigue siendo un archivo de servidor global normal, no pierde ninguna función; solo se retira la línea que intentaba tratarlo como partial HTML. Verificación posterior: `doGet()` debe dejar de lanzar el error, confirmable solo en runtime real (no reproducible por `node --check`, que no ejecuta scriptlets GAS).

### 1.B Invalidación forzada completa en "Recargar"

`refreshData()` pasa de "recargar" a "purgar y recargar":
1. Server: llamar explícitamente a `invalidateDataCache()` (ya existe, `cache_backend.js:121`) vía `google.script.run` **antes** de disparar `loadDashboardData()` — no depender de que loadDashboardData lo haga por su cuenta.
2. Cliente: limpiar la entrada de `IndexedDB` (`dashboard-cache-v1`, clave `dashboardData_<email>`) correspondiente al usuario actual antes de repintar, para que `loadDashboardData()` no vuelva a pintar optimistamente desde el mismo snapshot obsoleto mientras espera la red.
3. Solo después de ambas purgas, invocar `loadDashboardData()` normalmente (que hará un cache-miss garantizado en las dos capas y traerá datos genuinamente frescos).

Este cambio es **aditivo y de bajo riesgo** — no toca la lógica de `getDashboardData()` ni el resto de callers de `loadDashboardData()` (que siguen beneficiándose del caché normalmente; solo "Recargar" fuerza la purga).

### 1.C Limpieza de Admin SDK — retirar `sincronizarGruposGoogleIDU()`

Decisión del usuario: la Línea Cero sembrada manualmente (`sembrado_usuarios_grupos.js`, Sprint 5 Sección 23) es la solución final — Admin SDK nunca llegó a habilitarse en Cloud Console pese a dos intentos de la sesión (Secciones 20 y 22), y mantener el código vivo sin poder ejecutarlo nunca es deuda pura.

**Alcance exacto de la limpieza** (a ejecutar en la Fase A de build, no en este documento):
- `homologacion_usuarios.js`: eliminar `sincronizarGruposGoogleIDU()`, `_obtenerDirectorioGruposIDU()`, `_obtenerMiembrosGrupo()`, `_obtenerNombreCompleto()`, las constantes `GRUPOS_OFICIALES_IDU`, `GRUPOS_DIRECTORIO_CACHE_KEY`, `GRUPOS_DIRECTORIO_CACHE_TTL`.
- **Simplificar `_leerDirectorioCombinado()`**: hoy fusiona `USUARIOS` + el fallback de Grupos (Sección 22). Sin el fallback, vuelve a ser una lectura directa de `_leerDirectorioUsuariosSheet()` — evaluar en Fase A si conviene colapsar ambas funciones en una sola (`_leerDirectorioUsuariosSheet()` ya hace exactamente lo que se necesita) para no dejar un nivel de indirección que ya no indirecciona nada.
- **`ENCONTRADO_SIN_PERFIL` queda huérfano**: ese estado de confianza existe específicamente para candidatos que solo vienen del fallback de Grupos (sin fila de perfil en `USUARIOS`). Sin el fallback, es código inalcanzable en la práctica (aunque técnicamente una fila de `USUARIOS` con `ACTIVO` vacío podría seguir generando el mismo estado por una vía distinta — a decidir en Fase A si se conserva como defensivo o se retira junto con el resto).
- `appsscript.json`: retirar el servicio avanzado `AdminDirectory` de `dependencies.enabledAdvancedServices` y los 2 scopes OAuth (`admin.directory.group.member.readonly`, `admin.directory.user.readonly`) — **esto reduce la superficie de permisos que la app pide a los usuarios**, deseable de por sí.
- `sembrado_usuarios_grupos.js` **se conserva tal cual** — es el mecanismo vigente, no se toca.
- `gestion_equipos_backend.js` (`ejecutarCargaLineaCero()`, `obtenerMapeoLineaCero()`) **se conserva tal cual** — no depende de Admin SDK, solo de `homologarUsuariosMatriz()`.

### 1.D Optimización "Filtro Matriz" — de round-trip a in-memory

Reestructurar `aplicarFiltroAdhoc()`/`restablecerFiltroAdhoc()` para que el filtrado ocurra **sobre `window.currentData`/`rawData` ya cargado en memoria**, en vez de disparar un `loadDashboardData()` completo:
- El guardado del filtro en `FiltroMatriz` (para que persista entre sesiones/usuarios, que es su propósito real) sigue yendo al servidor exactamente igual — eso no es negociable, es la fuente de verdad compartida.
- Lo que cambia es que la **aplicación visual inmediata** del filtro no espera la respuesta del servidor ni dispara una recarga completa: se filtra el dataset ya en memoria del lado cliente (mismo patrón ya usado en `onProyectoChange()`/`getBaseFilteredData()`, `app_matriz_js.html`) y se re-renderiza la tabla al instante. La llamada a `guardarYActivarFiltroManual()` sigue en paralelo, de fondo, para persistir el cambio — pero deja de ser lo que bloquea el repintado.
- El "mensaje premium/pago" que pidió remover el usuario no existe (Sección 0.2) — no hay nada que remover ahí; el trabajo real de este punto es 100% la reestructuración a in-memory.

### 1.E UI de Asignación en Lote (Draft Mode) para `#arbolAsignacionEquipos`

Rediseño del árbol de asignación (Sprint 5 Sección 22) a modo borrador:
- Cada nodo del árbol (Proyecto/Tramo/RT) pasa a tener un **estado local en memoria** (`arbolEstado`, ya existe como estructura — se le agrega un campo `pendiente: {articuladorEmail, gestorEmail}` por nodo modificado) en vez de disparar `asignarEquipoGranular()` inmediatamente por cada cambio.
- Seleccionar un Articulador/Gestor en un nodo marca ese nodo como "modificado" visualmente (borde/badge distintivo) pero **no llama al backend todavía**.
- Botón flotante nuevo, **"Guardar Todos los Cambios"**, visible solo cuando `arbolEstado` tiene al menos un nodo con `pendiente` — recolecta todos los nodos modificados y los envía en un **solo payload** al backend.
- **Implicación de backend (Fase B de este sprint, a diseñar en detalle antes de construir):** `asignarEquipoGranular()` hoy recibe un `(nivel, idTarget, ...)` — un solo objetivo por llamada. Un guardado por lote de N nodos heterogéneos (mezcla de niveles Proyecto/Tramo/RT) requiere **una función nueva** tipo `asignarEquipoGranularLote(cambios[])` que itere internamente sobre `asignarEquipoGranular()` por cada entrada, bajo un único `LockService` para todo el lote (evita N locks secuenciales) y agregando los resultados — o rediseñar el batching a nivel de escritura de columnas si los cambios no se solapan. Este es el punto de mayor incertidumbre de diseño del sprint — se recomienda una ronda de `/plan-eng-review` dedicada antes de construir 1.E, separada de 1.A-1.D que son directos.

---

## 2. Priorización recomendada para la Fase A

| Orden | Punto | Riesgo | Motivo |
|---|---|---|---|
| 1 | 1.A (fix `include` roto) | Ninguno | Bug de producción activo, una línea, cero ambigüedad de diseño. |
| 2 | 1.B (invalidación forzada) | Bajo | Aditivo, no toca lógica existente de caché para otros callers. |
| 3 | 1.C (limpieza Admin SDK) | Bajo | Elimina código muerto/inalcanzable, reduce scopes OAuth pedidos. |
| 4 | 1.D (Filtro Matriz in-memory) | Medio | Reestructura un flujo existente — requiere probar que el guardado en `FiltroMatriz` sigue persistiendo correctamente en background sin regresión. |
| 5 | 1.E (Draft Mode del árbol) | Alto | Requiere una función backend nueva (`asignarEquipoGranularLote`) y un rediseño real del modelo de estado del árbol — no es un ajuste menor. |

**Recomendación:** construir 1.A–1.D en una sola Fase A (bajo riesgo, alto impacto en la queja reportada), y tratar 1.E como Fase B separada con su propio diseño de backend antes de tocar UI.

---

## 3. Cumplimiento de directivas

- Directiva 1 (IndexedDB, no `localStorage`): 1.B limpia `dashboard-cache-v1` (IndexedDB), no introduce `localStorage`.
- Directiva 2 (sin scriptlets complejos): 1.A elimina una línea de scriptlet roto, no agrega lógica nueva a `Index.html`.
- Directiva 3 (batch V8, no bloqueante): 1.D mueve trabajo del servidor al cliente pero mantiene el guardado persistente en background; 1.E explícitamente diseña para "un solo payload" en vez de N llamadas — mismo espíritu de batching que el resto del proyecto.
