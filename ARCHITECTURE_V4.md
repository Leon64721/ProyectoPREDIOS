# ARCHITECTURE_V4.md — Sprint 5: Gestión de Equipos, Gobernanza Cascada RBAC, Homologación Inteligente de Usuarios y Enrutamiento de Alertas

**Estado:** [Fase A COMPLETADA 2026-08-18 — ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 19 para evidencia de despliegue. Fase B/C planificadas, no iniciadas.]
**Agente:** Claude Code (Claude Sonnet 5, orquestado con gstack v1.60.1.0).
**Fecha:** 2026-08-18.
**Precede a:** este documento reemplaza como referencia activa de arquitectura a `ARCHITECTURE_V3.md` (Sprint 3 — Normalización) para el alcance específico de Sprint 5; no lo invalida para su propio dominio.

---

## 0. Grounding — estado real verificado del código (no asumido)

Antes de diseñar, se verificó contra el código actual (no contra la descripción del problema) lo siguiente, porque cambia decisiones de diseño:

| Verificado | Estado actual |
|---|---|
| `CONFIG.ROLES` (`config.js:116-120`) | `{ EDITOR: 'Editor', LECTOR: 'Lector', ADMIN: 'Administrador' }`. **No existe `ARTICULADOR` ni `GESTOR`.** |
| `CONFIG.PERMISOS_POR_ROL` (`config.js:123-127`) | Mapea cada rol a acciones (`LEER/EDITAR/ELIMINAR/PERMISOS/REPORTES`), no a alcance jerárquico de datos. |
| `CONFIG.SHEETS` (`config.js:30-38`) | `DATOS, SEGUIMIENTO, PERMISOS: 'Permisos', REPORTES, LOGS: 'Logs', AUDITORIA: 'LOGS_AUDITORIA', HISTORIAL_PERMISOS`. **No existe `USUARIOS`.** |
| Directorio parcial existente | `PAC_Articuladores` (hoja interna del módulo PAC, `pac_config.js:16,73`), poblada por `pac_poblarArticuladores()` (`pac_setup.js:257`) desde una hoja **externa** (`PAC_CONFIG.PAC_SPREADSHEET_ID`). Guarda `{nombre, correo, proyecto}` — pero `correo` se inicializa `''` y **nunca se completa** en ningún punto del código. Es el mismo síntoma de "usuario desactualizado" que Sprint 5 busca resolver, solo que ya existe media solución sin terminar. |
| Column matching existente | `findColumnIndex()` (`utilidades.js:24`) hace *keyword includes* sobre `toUpperCase().trim()` — **no** normaliza tildes (`"JURIDICO"` ≠ `"JURÍDICO"` bajo esta función) ni tolera typos. `pac_getColIdx()` (`pac_config.js:162`) es aún más estricto (igualdad exacta tras trim/uppercase). Ninguna de las dos funciones existentes resuelve homologación difusa real — se requiere la nueva `homologarUsuariosMatriz()`. |
| Motor de similitud reutilizable | `levenshteinDistance(str1, str2)` ya existe en `normalizacion_script/UtilidadesNormalizacion.js:17` (usado hoy para detectar columnas duplicadas en el pipeline de normalización). **Se reutiliza tal cual** para Sprint 5 en vez de reimplementar distancia de edición. |
| Patrón de lock ya establecido | `permisos.js` → `GestorPermisos.eliminarPermiso()` usa `LockService.getScriptLock(); lock.waitLock(30000); ... finally { lock.releaseLock(); }`. Este es el patrón exacto que debe replicar `asignarEquipoGranular()`. |
| Patrón de log ya establecido (con una inconsistencia real) | `GestorAuditoria.registrarAccion()` escribe en `SHEETS.LOGS` sobre un spreadsheet **separado** (`DATA_FILES.LOGS`, ID `***REMOVED***`, ya en uso). `GestorAuditoria.registrarCambio()` en cambio escribe en `SHEETS.AUDITORIA` (`LOGS_AUDITORIA`) sobre el spreadsheet **principal**. Los dos patrones coexisten hoy sin resolver — `LOGS_ASIGNACION` resuelve esto usando un tercer spreadsheet dedicado propio (confirmado, Sección 6.1). |
| Columnas `ARTICULADOR JUIRIDICO` / `GESTOR JURÍDICO` | [CONFIRMADO 2026-08-18, texto literal del usuario] No existen en `CONFIG.COLUMNS` (`config.js:41-77`) — deben añadirse en Fase A. Nombre real en `Datos`: **`ARTICULADOR JUIRIDICO`** (typo de producción, no "JURIDICO") y `GESTOR JURÍDICO`. |

**Conclusión de grounding:** Sprint 5 no parte de una base RBAC vacía — parte de dos sistemas de permisos parciales y no conectados (`Permisos`/`CONFIG.ROLES` para acceso a la app, `PAC_Articuladores` para el directorio de campo). El usuario confirmó (Sección 6.1) que Articulador/Gestor **extienden** `CONFIG.ROLES` y que `PAC_Articuladores` queda deprecado — la ambigüedad de diseño original ya está resuelta.

---

## 1. Especificación de producto (/office-hours)

### 1.1 Problema real
Dos fuentes de verdad sobre "quién es responsable de qué" divergen silenciosamente: la matriz `Datos` (columnas `ARTICULADOR JURIDICO`/`GESTOR JURÍDICO`, texto libre, sin validación) y el directorio de usuarios (hoy fragmentado entre `Permisos` y el `PAC_Articuladores` con emails vacíos). Sin homologación, un cambio de nombre, un typo o una salida de personal deja RTs "huérfanos" — visibles en la matriz pero sin dueño resoluble a un email real, lo que rompe el enrutamiento de alertas y la trazabilidad de auditoría. Tampoco existe hoy visibilidad de balance de carga (cuántos RTs tiene cada Gestor/Articulador) ni control de qué ve cada rol según jerarquía — cualquier usuario autenticado con rol `Editor`/`Lector` ve todo, sin recorte por Proyecto/Tramo/RT asignado.

### 1.2 Usuarios y roles (jerarquía de negocio — capa nueva sobre/junto a `CONFIG.ROLES`)
- **Administrador:** acceso total y global. Mapea al `CONFIG.ROLES.ADMIN` existente.
- **Articulador:** ve y gestiona únicamente sus proyectos/tramos/RTs asignados; asigna carga a sus Gestores.
- **Gestor:** ve todos los RTs del proyecto/tramo que lidera su Articulador (atención ciudadana transversal), pero opera formalmente sobre sus RTs específicos asignados.

### 1.3 Acciones clave
1. Homologación automática/difusa de nombres (`Datos` ↔ `USUARIOS`).
2. Alerta de usuarios desactualizados/ausentes ("huérfanos").
3. Asignación en cascada: Proyecto → Tramo → RT.
4. Cola de "RTs por Asignar" (RTs sin Articulador/Gestor resoluble).
5. Reasignación global (handover 1-click por salida de personal).
6. Registro de auditoría dedicado (`LOGS_ASIGNACION`).

### 1.4 MVP
Tablero de Carga (KPIs de distribución) + Motor de Homologación + Modal de Asignación Granular + hoja `LOGS_ASIGNACION`.

### 1.5 Antipatrones a evitar explícitamente
- Asignación parcial sin log (toda escritura en `Datos` debe emparejarse 1:1 con una fila en `LOGS_ASIGNACION` — ni una sin la otra).
- Mutación directa de `Datos` sin `LockService` (mismo riesgo de condición de carrera ya mitigado en `permisos.js` y anotado como pendiente-parcial en `TODOS.md` ítem 12 "Coordinación entre agentes concurrentes").
- `localStorage` para cualquier dataset (Directiva 1).
- Renderizado bloqueante del Tablero de Carga sobre datasets grandes (mismo antipatrón ya documentado y evitado en Fase B — ver `DOCUMENTACION_TECNICA_VIVA.md` Sección 18).

### 1.6 Valor operativo
Base limpia y auditable para personalización de UI por rol (Fase futura) y enrutamiento automatizado de alertas por correo (Fase C de este mismo sprint) — hoy `evaluador_alertas.js` no tiene forma de resolver un email real desde una alerta generada, porque no existe una tabla de verdad usuario↔email↔alcance.

---

## 2. Arquitectura técnica

### 2.A Backend

#### `homologacion_usuarios.js` (nuevo)

```
homologarUsuariosMatriz()
```
Lee `Datos` (columnas confirmadas — texto **exacto**, incluyendo el typo real de producción: `ARTICULADOR JUIRIDICO` — no "JURIDICO" — y `GESTOR JURÍDICO`) y `USUARIOS` (esquema confirmado: `No, EMAIL, ROL, NOMBRE, ACTIVO, COMPONENTE`). Ambos nombres de columna de `Datos` deben añadirse a `CONFIG.COLUMNS` (`config.js:41-77`) tal cual, typo incluido — no "corregir" el header en código, porque debe matchear el header real de producción; el typo es justamente el tipo de inconsistencia que este motor existe para resolver del lado de los *valores*, no de los headers. Para cada nombre distinto encontrado en `Datos.ARTICULADOR JUIRIDICO`/`Datos.GESTOR JURÍDICO`, busca la mejor coincidencia contra `USUARIOS.NOMBRE` (filtrando primero por `USUARIOS.ACTIVO = SI` y `USUARIOS.ROL` compatible con el rol buscado) por:
1. Igualdad exacta normalizada (`toUpperCase().trim()` + `normalize('NFD').replace(/[̀-ͯ]/g,'')` para ignorar tildes — corrige el gap real de `findColumnIndex`/`pac_getColIdx` detectado en Sección 0).
2. Si no hay igualdad exacta normalizada, `levenshteinDistance()` (reutilizado de `normalizacion_script/UtilidadesNormalizacion.js`) con umbral configurable (propuesto: distancia ≤ 2 o ≤ 20% de la longitud del string, a validar con datos reales).
3. Resultado por nombre: `{ nombreEnDatos, coincidenciaSugerida, email, activo: USUARIOS.ACTIVO, confianza: 'EXACTA'|'APROXIMADA'|'SIN_COINCIDENCIA'|'ENCONTRADO_INACTIVO' }`. El cuarto estado (`ENCONTRADO_INACTIVO`) es necesario porque `USUARIOS` tiene su propio flag `ACTIVO` — un nombre puede coincidir exactamente con un registro de `USUARIOS` que ya no está activo (salida de personal no limpiada), lo cual es un caso distinto de "sin coincidencia" y debe tratarse como candidato directo a la cola de reasignación, no a la de homologación.

Procesa por lotes de 1000 filas de `Datos` (Directiva 3) — no bloqueante para datasets grandes.

```
detectarUsuariosHuérfanos()
```
Subconjunto de `homologarUsuariosMatriz()` con `confianza` en `'SIN_COINCIDENCIA'` o `'ENCONTRADO_INACTIVO'`. Devuelve lista lista-para-modal, no solo un booleano, para que la UI pueda ofrecer resolución inmediata (Fase B, modal de homologación).

**Nota sobre alcance de `USUARIOS`:** el esquema confirmado (`No, EMAIL, ROL, NOMBRE, ACTIVO, COMPONENTE`) es un directorio de identidad/rol — **no contiene** columnas de Proyecto/Tramo/RT. La asignación granular (cascada Proyecto→Tramo→RT) sigue viviendo en `Datos` (vía `asignarEquipoGranular()`, que escribe en las columnas `ARTICULADOR JUIRIDICO`/`GESTOR JURÍDICO`), no en `USUARIOS`. `COMPONENTE` probablemente corresponde a los Google Groups institucionales que mencionó el usuario (`dtdp`/`stap`/`stgsv`) — a evaluar en Fase A si se usa solo como dato informativo o como filtro adicional de alcance.

#### `gestion_equipos_backend.js` (nuevo)

```
getEstadisticasCargaEquipos(userContext)
```
Calcula RTs por Gestor/Articulador **filtrados por la jerarquía RBAC del usuario activo** — reutiliza el mecanismo de alcance ya existente (`GestorPermisos.obtenerProyectos(email)` en `permisos.js:48`, que hoy devuelve `'ALL'` o un array de proyectos) como base, extendido con el nuevo alcance Articulador→Tramo/RT y Gestor→RT. Un Articulador nunca debe recibir en la respuesta datos fuera de sus proyectos asignados — el filtro se aplica en backend, no en cliente (mismo principio que `_isAdminOrPowerEditor()` en `Codigo.js:1896`, no un check solo de UI).

```
asignarEquipoGranular(nivel, idTarget, articuladorEmail, gestorEmail)
```
`nivel` ∈ `{PROYECTO, TRAMO, RT}` — cascada: asignar a nivel Proyecto propaga por defecto a todos los Tramos/RTs sin asignación explícita más específica (no sobreescribe asignaciones a nivel RT ya hechas manualmente, salvo que se indique `forzar: true`). Usa `LockService.getScriptLock()` con el mismo patrón try/finally que `eliminarPermiso()` (`permisos.js:169-229`). Escribe en lotes de 1000 filas (Directiva 3). Cada escritura exitosa dispara `registrarLogAsignacion()` — nunca hay actualización de `Datos` sin su log correspondiente (antipatrón #1, Sección 1.5).

```
reasignarUsuarioMasivo(usuarioOrigen, usuarioDestino, rol)
```
Reemplazo global 1-click (handover). Mismo lock + batching que `asignarEquipoGranular()`. Genera **una fila de log por entidad afectada** (no una sola fila resumen), para que `LOGS_ASIGNACION` sea auditable RT por RT, consistente con cómo `registrarCambio()` ya genera una fila por campo cambiado (`auditoria.js:69-81`).

```
registrarLogAsignacion(eventoData)
```
Ver esquema completo en Sección 3.

#### `evaluador_alertas.js` (modificado, no reescrito)
Se añade resolución de destinatario: cuando el motor genera una alerta para un RT, además del contenido actual (`NIVEL`, `REGLA`, `RT`, `PROYECTO`, `MENSAJE` — confirmado por su consumo en `app_alertas_js.html:301-319`, Sprint 4 Fase C), se resuelve `articuladorEmail`/`gestorEmail` contra la asignación vigente (vía la misma tabla que usa `getEstadisticasCargaEquipos`). Si el RT está en la cola de "RTs por Asignar" (sin dueño resoluble), la alerta se marca `SIN_RESPONSABLE` en vez de fallar silenciosamente o enrutarse a nadie.

### 2.B Frontend — `app_equipos_js.html` (nuevo)

- Panel `#moduloGestionEquipos`: KPIs de distribución de carga (consume `getEstadisticasCargaEquipos`) + sección "RTs por Asignar" (consume la cola generada por `detectarUsuariosHuérfanos()` + RTs sin asignación de `asignarEquipoGranular`).
- Modal de Homologación de Usuarios: lista de coincidencias `APROXIMADA`/`SIN_COINCIDENCIA` de `homologarUsuariosMatriz()`, con acción de confirmar/corregir por fila — mismo patrón de modal dinámico ya usado en `#modalDetalleAlertas` (`app_alertas_js.html`) y `#modalFichaPredial` (`app_herramientas_js.html`, Sprint 4 Fase B): construido 100% por JS, sin scriptlets `<?!= ?>` (Directiva 2).
- Selector jerárquico de asignación en cascada (Proyecto → Tramo → RT), reutilizando los mismos dropdowns buscables ya introducidos en Sprint 1 (`DESIGN.md`, `SearchableDropdown`) en vez de construir un selector nuevo desde cero.
- Persistencia de estado de interfaz: `IndexedDB` bajo la clave `equipos_cache_<CURRENT_USER_EMAIL>` — mismo patrón de base de datos por-usuario ya usado por `dashboard-cache-v1`/`export-cache-v1`/`normalizacion_ui_cache` (Directiva 1, cero excepciones).

---

## 3. Esquema de `LOGS_ASIGNACION`

Modelado sobre el patrón ya existente de `COLUMNS_AUDITORIA` (`config.js:96-104`, usado por `registrarCambio()`), extendido con los campos específicos de asignación pedidos:

| # | Columna | Tipo | Ejemplo | Notas |
|---|---|---|---|---|
| 1 | `FECHA` | Date (timestamp) | `2026-08-18T15:32:00Z` | Igual que `registrarCambio()`, usa `this.timestamp` del `GestorAuditoria` en el momento de construcción, no `new Date()` por fila (evita timestamps ligeramente distintos dentro del mismo lote). |
| 2 | `ENTIDAD_TIPO` | String enum | `PROYECTO` \| `TRAMO` \| `RT` | Corresponde al `nivel` de `asignarEquipoGranular()`. |
| 3 | `ENTIDAD_ID` | String | `RT-00123` | El identificador del Proyecto/Tramo/RT afectado. |
| 4 | `ROL` | String enum | `ARTICULADOR` \| `GESTOR` | Cuál de los dos roles cambió en este evento (una reasignación que toca ambos genera 2 filas). |
| 5 | `USUARIO_ANTERIOR` | String (email o vacío) | `juan.perez@idu.gov.co` | Vacío si la entidad no tenía dueño previo (alta desde la cola "RTs por Asignar"). |
| 6 | `USUARIO_NUEVO` | String (email) | `maria.gomez@idu.gov.co` | Nunca vacío en una asignación exitosa. |
| 7 | `EJECUTOR` | String (email) | `admin.sistema@idu.gov.co` | Quién disparó el cambio — mismo campo `usuario` que ya recibe `registrarAccion(usuario, accion, detalles)`. |
| 8 | `ACCION` | String enum | `ASIGNACION_GRANULAR` \| `REASIGNACION_MASIVA` \| `AUTO_HOMOLOGACION` | Distingue el origen del cambio para auditoría — necesario porque `reasignarUsuarioMasivo()` puede generar cientos de filas de una sola acción de usuario. |

**Ubicación del spreadsheet:** [CONFIRMADO 2026-08-18] spreadsheet nuevo y dedicado — no reutiliza ni `DATA_FILES.LOGS` (patrón `registrarAccion()`) ni `LOGS_AUDITORIA` en el principal (patrón `registrarCambio()`). Requiere agregar un nuevo ID a `CONFIG.DATA_FILES` (ej. `DATA_FILES.LOGS_ASIGNACION`) en Fase A.

---

## 4. Directivas inquebrantables — cumplimiento por diseño

| Directiva | Cómo se cumple en este diseño |
|---|---|
| 1. Sin `localStorage`, solo IndexedDB | `equipos_cache_<email>` sigue el patrón `dashboard-cache-v1`/`export-cache-v1` ya validado en Fases anteriores. |
| 2. Sin lógica compleja/`;` en scriptlets GAS | Modal de Homologación y selector de cascada se construyen 100% por JS (mismo patrón que `#modalFichaPredial`), cero cambios a scriptlets `<?!= ?>` en `Index.html`. |
| 3. Backend V8 por lotes de 1000, no bloqueante | `homologarUsuariosMatriz()`, `asignarEquipoGranular()` y `reasignarUsuarioMasivo()` procesan `Datos` en lotes de 1000 filas; `asignarEquipoGranular()` y `reasignarUsuarioMasivo()` además usan `LockService` (patrón `eliminarPermiso()`) porque mutan `Datos`, no solo la leen. |

---

## 5. Riesgos técnicos identificados (no cubiertos por las directivas explícitas)

1. **Contención de lock en `reasignarUsuarioMasivo()`:** un handover que reasigna cientos de RTs bajo un solo `LockService.getScriptLock()` puede exceder el timeout de 30s usado hoy en `eliminarPermiso()`. Proponer `waitLock(60000)` para esta función específica y medir en runtime antes de cerrar Fase A.
2. **`PAC_Articuladores` como fuente huérfana:** confirmado por el usuario (Sección 6.1) que queda deprecada — Fase A debe asegurarse de que ningún endpoint nuevo (`homologarUsuariosMatriz`, `getEstadisticasCargaEquipos`) la consulte, para no reintroducir una tercera fuente de verdad por accidente.
3. **Umbral de Levenshtein sin calibrar:** un umbral demasiado laxo homologa personas distintas con nombres parecidos (falso positivo de alto impacto — asigna RTs a la persona equivocada). Se recomienda que la Fase A entregue el modal de confirmación humana (`confianza: 'APROXIMADA'` nunca se aplica automáticamente sin revisión) antes de automatizar cualquier homologación silenciosa.

---

## 6. Preguntas abiertas

### 6.1 Resueltas 2026-08-18 (confirmadas por el usuario)

1. **`USUARIOS` vs `PAC_Articuladores`:** `USUARIOS` **sí existe ya**, en un spreadsheet separado del principal, creado por el equipo: `https://docs.google.com/spreadsheets/d/***REMOVED***/edit?gid=9693508`. `PAC_Articuladores` y toda la configuración PAC asociada a articuladores quedan **deprecadas**: la centralización de este sprint reemplaza esa fuente parcial, no coexiste con ella. `pac_poblarArticuladores()` (`pac_setup.js:257`) deja de ser la fuente de verdad de correos — Fase A debe apuntar a `USUARIOS` exclusivamente. No se borra el código PAC en este sprint (fuera de alcance), solo se deja de alimentar el nuevo motor de homologación desde ahí.
2. **Roles:** Articulador/Gestor se agregan a `CONFIG.ROLES` (`config.js:116-120`), junto a `Administrador`/`Editor`/`Lector`. Fase A/C debe también extender `PERMISOS_POR_ROL` (`config.js:123-127`) para los dos roles nuevos.
3. **Multiplicidad Gestor↔RT:** 1 RT → 1 Gestor exclusivo. `asignarEquipoGranular()` puede usar una columna simple `GESTOR_ASIGNADO` (no requiere tabla de relación N:N).
4. **Spreadsheet de `LOGS_ASIGNACION`:** dedicado y nuevo, distinto de `DATA_FILES.LOGS` y de `LOGS_AUDITORIA` (ver Sección 3).
5. **Esquema exacto de `USUARIOS`** (confirmado 2026-08-18, texto literal pegado por el usuario — la navegación automatizada vía `gstack /browse` no logró acceder por inestabilidad del proceso de Chromium en este equipo, ver nota al final de esta sección): 6 columnas — `No, EMAIL, ROL, NOMBRE, ACTIVO, COMPONENTE`. Sin columnas de Proyecto/Tramo/RT (ver nota en Sección 2.A).
6. **Nombre exacto de columnas en `Datos`** (confirmado, texto literal pegado por el usuario): `ARTICULADOR JUIRIDICO` (**typo real de producción — así está escrito, sin la "R" en la posición esperada: "JUIRIDICO", no "JURIDICO"**; debe copiarse tal cual a `CONFIG.COLUMNS`, no corregirse) y `GESTOR JURÍDICO`.

**Fuente adicional aportada por el usuario (a evaluar en Fase A, no bloquea):** el usuario tiene acceso a los Google Groups institucionales (`dtdp`, `stap`, `stgsv` en `groups.google.com/a/idu.gov.co`) que podrían usarse como fuente adicional nombre↔email para `homologarUsuariosMatriz()`, y que probablemente corresponden a la columna `USUARIOS.COMPONENTE`. Queda para Fase A decidir si se integran como segunda fuente o se dejan para una fase posterior — no bloquea el inicio de Fase A porque `USUARIOS` ya es suficiente para un primer motor de homologación funcional.

### 6.2 Nota operativa — acceso por navegador automatizado

Durante esta sesión se intentó leer `USUARIOS` en vivo vía `gstack /browse` (4 vías: navegación headless directa, importación de cookies del navegador real del usuario, `handoff` con ventana visible, y modo `connect` persistente). Las 4 fallaron por inestabilidad del proceso de Chromium en este entorno Windows (crashes repetidos del daemon, no un problema de autenticación) — no se pudo verificar nada por esta vía. El esquema final documentado arriba viene de texto pegado directamente por el usuario en el chat, no de lectura automatizada. **Todas las preguntas de arquitectura de datos quedan resueltas** — Fase A ya no está bloqueada por falta de información.
