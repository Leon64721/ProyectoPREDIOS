# Plan conjunto — Motor de reglas y alertas

> Plan: Claude Opus. Auditoría: Claude Sonnet. Cierre conjunto: Cursor. Fecha: 2026-10-18. Estado: **listo para ejecutar**. Fabian cerró las cuatro decisiones el 2026-10-18. Ninguna fase se implementa hasta que él pida arrancar.
> Script Apps Script único permitido: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi` (ya en `.clasp.json`). Cualquier otro proyecto: **prohibido**.
> Ninguna fase hace `clasp push`, salvo F10, y solo si el usuario lo pide.
> Este plan se basa en lectura real del código (graphify + lectura directa de `motor_reglas.js`, `evaluador_alertas.js`, `app_alertas_js.html`, `Index.html`, `Codigo.js`, `permisos.js`, `pac_triggers.js`, `config.js`, `cache_backend.js`, `export_pdf_backend.js`, `app_herramientas_js.html`, `appsscript.json`, `.clasp.json`, `.claspignore`).

---

## 1. Resultado para el usuario

Al terminar F0–F9:

1. **Una sola fuente de verdad de alertas.** El tablero (badges del dashboard, modal de alertas, PDF de alertas, ficha predial) y la Bandeja de Alertas leen lo mismo: la hoja `ALERTAS_ACTIVAS`, producida por `MotorEvaluadorReglas` a partir del JSON de `CONFIG_REGLAS!B1`. Desaparecen las reglas hardcoded de `MotorReglas` y la escala `CRITICA/ALERTA/ADVERTENCIA/INFO`; queda una sola escala: `ROJO / NARANJA / AMARILLO`.
2. **Constructor gráfico de reglas.** "Nueva Regla" abre un formulario que carga los encabezados reales de la hoja `Datos`, permite crear, editar, activar y desactivar reglas con los mismos campos que el motor ya evalúa, valida antes de guardar y guarda en el **mismo** JSON de `CONFIG_REGLAS!B1`. El Modo Desarrollador (JSON) sigue existiendo.
3. **La UI deja de mentir.** `evaluacion_cruzada` y `FuentesDeDatos` se conservan en el JSON pero se muestran marcados como "No se evalúa en esta versión"; las reglas que nunca disparan por esa causa se señalan.
4. **Seguridad en servidor.** Solo `Administrador` puede guardar reglas, ejecutar el motor, enviar el reporte por correo e instalar el trigger. La lectura de la bandeja sigue el Filtro Matriz existente.
5. **Recalculo diario automático.** Queda lista la función `instalarTriggerMotorReglas()` (trigger diario 6:00, separado de PAC). El usuario la ejecuta una vez desde el editor; el plan no la instala.
6. **Arreglos menores.** El botón huérfano "Programar Envío" desaparece de Permisos; el CSV local exporta bien "DIAS RESTANTES" y "ESTADO PREDIAL ACTUAL".

---

## 2. Fuente de verdad (flujo después del cambio)

```
                     ┌──────────────────────────────────────────────┐
  Admin (UI)         │  CONFIG_REGLAS!B1  (JSON único)              │
  ─────────────      │  { ReglasDeNegocio:[...], FuentesDeDatos:{} }│
  Constructor  ──┐   └───────────────▲───────────────┬──────────────┘
  gráfico        │                   │ guardarReglasJSON()   │ obtenerReglasJSON()
  Modo JSON  ────┴─► validación ─────┘ (motor_reglas.js,     │ (motor_reglas.js,
                     cliente +          ÚNICA definición,    │  ÚNICA definición,
                     servidor           solo Administrador,  │  devuelve version MD5)
                                        LockService,         │
                                        version optimista)   │
                                                             ▼
  obtenerMetadatosEditorReglas() ◄── Datos fila 1   ejecutarMotorReglasInterno_()
  (encabezados reales + operadores)  (DATA_FILES.         │   ▲            ▲
                                      PRINCIPAL)          │   │            │
                                                          │ ejecutarEvaluadorAlertas()   triggerDiarioMotorReglas(e)
                                                          │ (botón "Forzar Evaluación",  (trigger diario 6:00,
                                                          │  solo Administrador)          instalado a mano)
                                                          ▼
                                     MotorEvaluadorReglas.ejecutarMotor()
                                     lee Datos (PRINCIPAL) + overlay ASIGNACIONES_EQUIPOS
                                     evalúa condiciones / excepciones / regla_tiempo / alerta_bloqueo
                                     (evaluacion_cruzada: NO se evalúa, se cuenta como "no evaluable")
                                                          │
                                                          ▼
                                     ALERTAS_ACTIVAS (hoja)  ──► invalidateDataCache()
                                     niveles ROJO/NARANJA/AMARILLO
                     ┌────────────────────────┼─────────────────────────────┐
                     ▼                        ▼                             ▼
     obtenerAlertasWeb()          resumirAlertasActivasParaDashboard_   procesarReporteAlertas()
     (Bandeja; Filtro Matriz      (allRecords)  ← getDashboardData()    (correo; solo Administrador;
      por proyecto, igual que     filtra por RTs visibles (Filtro       Filtro Matriz)
      hoy)                        Matriz + RBAC Articulador/Gestor)
                                              │
                                              ▼
                               alertasResumen → badges dashboard, modal,
                               PDF de alertas, ficha predial (sin cambios
                               en export_pdf_backend.js: ya entiende ROJO/NARANJA/AMARILLO)

  ELIMINADO: class MotorReglas (reglasBase hardcoded), evaluarAlertasDataset(),
             _normalizarSeveridadAlertas(), copia duplicada de obtener/guardarReglasJSON
             en evaluador_alertas.js, programarReporte() y su botón.
```

---

## 3. Decisiones ya tomadas

Cada ítem está **DECIDIDO** salvo los tres de la sección 8.

| # | Decisión | Por qué |
|---|----------|---------|
| D1 | **`motor_reglas.js` pasa a ser el módulo de almacenamiento y configuración de reglas** (obtener/guardar, metadatos del editor, validación, guarda de rol). **`evaluador_alertas.js` queda como el módulo de evaluación** (motor, resumen para el dashboard, trigger). Se borran las copias de `obtenerReglasJSON`/`guardarReglasJSON` de `evaluador_alertas.js` (líneas 1–86). | Hoy ambas copias son idénticas, pero en GAS gana la última cargada en silencio. Con `filePushOrder: []` el orden depende de clasp. Una sola definición elimina el riesgo de deriva. |
| D2 | **No se toca `.clasp.json`** (ni `scriptId` ni `filePushOrder`). | Al quedar una sola definición de cada función, el orden de carga deja de importar: ninguna sentencia de nivel superior depende de otro archivo (`class MotorEvaluadorReglas` solo se usa dentro de funciones). Llenar `filePushOrder` crearía una lista que hay que mantener con cada archivo nuevo. |
| D3 | **`MotorReglas` deja de alimentar el dashboard y se elimina.** En `Codigo.js:getDashboardData()` (línea 537) `evaluarAlertasDataset(allRecords)` se sustituye por `resumirAlertasActivasParaDashboard_(allRecords)`. Se borran `class MotorReglas` + `globalThis.MotorReglas` (`motor_reglas.js` 88–332), `evaluarAlertasDataset()` y `_normalizarSeveridadAlertas()` (`evaluador_alertas.js` 514–623). | El dashboard y la bandeja hoy calculan cosas distintas con escalas distintas. Leer `ALERTAS_ACTIVAS` es una lectura de hoja barata y deja una sola fuente. Correr `MotorEvaluadorReglas` dentro de `getDashboardData` en cada carga sería caro (CalendarApp, días hábiles día a día) y arriesga el límite de 6 min. Grep confirma: `MotorReglas` y `evaluarAlertasDataset` no tienen otros consumidores (solo un comentario en `gestion_equipos_backend.js:17`, que no se toca). |
| D4 | **El resumen del dashboard filtra por los RT de `allRecords`** (ya recortados por Filtro Matriz y RBAC de Articulador/Gestor). | Conserva la semántica de seguridad actual del dashboard (hoy evalúa sobre `allRecords`) y no abre una fuga nueva en el caché compartido. |
| D5 | **Escala única ROJO/NARANJA/AMARILLO.** `alertasResumen.severidades` pasa a `{ROJO, NARANJA, AMARILLO}`. Los badges del dashboard pasan de "CRÍTICAS / ADVERTENCIAS" a "ROJO / NARANJA / AMARILLO / TOTAL". | Es la escala que el motor configurable produce. `export_pdf_backend.js` ya mapea ROJO/NARANJA/AMARILLO (líneas 80–88): no se toca. |
| D6 | **`evaluacion_cruzada` y `FuentesDeDatos`: conservar en el JSON sin ejecutar, y marcarlos visualmente "No se evalúa en esta versión".** (Recomendación pedida en el punto A3.) | (a) **Borrarlos** destruiría configuración escrita por un admin que el código del repo no puede ver (el JSON real vive solo en la hoja de producción). (b) **Ocultarlos** haría que una regla parezca funcionar cuando no lo hace: hoy `ejecutarMotor` (línea 179) suprime en silencio `alerta_bloqueo` si existe `evaluacion_cruzada`, así que esa regla nunca dispara. (c) **Conservar y marcar** no pierde datos, es honesto y deja la puerta abierta para una entrega futura de evaluación cruzada. El constructor gráfico **no** ofrece crear `evaluacion_cruzada`; al editar una regla que ya la tiene, la conserva tal cual (panel de solo lectura). El motor no cambia la línea 179: hacer que esas reglas empiecen a disparar sin el cruce generaría falsos positivos. |
| D7 | **El motor reporta las reglas no evaluables.** `ejecutarMotor()` devuelve `reglasNoEvaluables` (reglas activas con `evaluacion_cruzada` y `alerta_bloqueo` sin `regla_tiempo`) y el toast lo muestra. | Hace visible lo que hoy es silencioso. |
| D8 | **`programarEnvioAutomatico` no se implementa.** Se borra `programarReporte()` (`app_alertas_js.html` 892–918) y se quitan los **cuatro** botones del encabezado de `#page-permisos` (`Index.html` 886–898: Forzar Evaluación, Enviar Reporte, Programar Envío, Recargar). | Los cuatro son una copia del encabezado de Alertas pegada en Permisos; "Recargar" allí recarga alertas, no permisos. Las tres acciones válidas siguen en `#page-alertas`. Quitar solo uno dejaría la página de Permisos igual de confusa. |
| D9 | **Un trigger diario propio, separado de PAC**: `triggerDiarioMotorReglas(e)` a las **6:00** (America/Bogota), instalado por `instalarTriggerMotorReglas()` y quitado por `eliminarTriggerMotorReglas()`, que solo tocan el handler `triggerDiarioMotorReglas`. Viven en `evaluador_alertas.js`. **Solo recalcula `ALERTAS_ACTIVAS`; no envía correos.** | El patrón viene de `pac_triggers.js` (eliminar y luego crear, idempotente), sin llamar a nada de PAC (`_notificarErrorTrigger` y `_obtenerEmailAdmin` dependen de hojas PAC). 6:00 deja el resultado listo antes de la jornada y antes de los triggers PAC (7:00/8:00). |
| D10 | **Autorización:** guarda única `_exigirAdminMotorReglas_(accion)` en `motor_reglas.js`, basada en `new GestorPermisos().validarPermiso('ADMIN_SISTEMA')` (solo `Administrador` tiene `ADMIN_SISTEMA` en `CONFIG.PERMISOS_POR_ROL`, `config.js:183`). Si niega, registra `logAction(email, accion + '_DENEGADO', mensaje)` y devuelve `{success:false, error}`. Se aplica a: `guardarReglasJSON`, `ejecutarEvaluadorAlertas`, `procesarReporteAlertas`, `obtenerMetadatosEditorReglas`, `instalarTriggerMotorReglas`, `eliminarTriggerMotorReglas`. | `validarPermiso` toma la identidad de `Session` (nunca del cliente) y ya es el patrón del PDF (`export_pdf_backend.js:273,305`). Hoy `guardarReglasJSON` audita con el `usuario` que manda el cliente (falsificable): pasa a usar `Session.getActiveUser().getEmail()`; el parámetro se conserva en la firma y se ignora. |
| D11 | **Lectura sin cambios:** `obtenerReglasJSON` y `obtenerAlertasWeb` siguen abiertos a cualquier rol con acceso a la Web App; la bandeja conserva su filtro por proyecto (`GestorFiltroMatriz.obtenerProyectosVisibles`). La descarga **CSV local** sigue disponible para todos (es cliente puro); las opciones de correo del modal "Enviar Reporte" solo se muestran a `Administrador`. | Es el alcance pedido: solo cambian guardar, ejecutar y enviar. |
| D12 | **Ocultar en la UI es cosmético; el servidor es quien aplica la seguridad.** Botones con clase `solo-admin-reglas` se ocultan si `currentRole !== 'Administrador'`. | `currentRole` llega en segundo plano (`getUserAndRole`); si el botón se ve un instante, el servidor igual rechaza. |
| D13 | **Separación del ejecutor:** `ejecutarEvaluadorAlertas()` (pública, con guarda de admin) y `triggerDiarioMotorReglas(e)` llaman ambas a `ejecutarMotorReglasInterno_()` (el `_` final la hace no invocable desde `google.script.run`). El handler del trigger exige `e && e.triggerUid` y que ese UID exista en `ScriptApp.getProjectTriggers()`; si no, devuelve `{success:false}` sin ejecutar. | En un trigger de tiempo `Session.getActiveUser()` puede venir vacío, así que la guarda de admin no sirve ahí. El chequeo de UID impide que un cliente invoque el handler directo con un objeto falso. Aun si se saltara, el impacto es solo recalcular la hoja (no hay correos). |
| D14 | **Sin lock externo en el trigger.** `_guardarAlertasEnHoja` ya toma `LockService.getScriptLock()`; no se añade otro lock alrededor de la ejecución completa. | Evita depender de si el lock es reentrante y evita bloquear a `guardarReglasJSON` durante toda la evaluación. |
| D15 | **Concurrencia optimista al guardar reglas.** `obtenerReglasJSON` devuelve además `version` (MD5 hex del string de B1). `guardarReglasJSON(jsonString, _usuarioIgnorado, versionEsperada)`: si llega `versionEsperada` y no coincide con la versión actual (comparada **dentro** del lock), responde `{success:false, conflicto:true, error:'Otro administrador modificó las reglas. Recarga antes de guardar.'}`. Si no llega, guarda como hoy (compatibilidad). | El constructor reescribe el JSON entero; sin esto, dos admins editando reglas distintas se pisan sin saberlo. Son unas 15 líneas dentro del lock que ya existe. |
| D16 | **El constructor guarda de inmediato** ("Guardar regla" persiste en B1; "Activar/Desactivar" en la tarjeta también persiste tras confirmar). Desaparece el flujo de dos pasos "Aplicar cambios" → "Guardar Configuración" para la vía gráfica. El Modo JSON conserva su botón, renombrado **"Guardar JSON"** y movido dentro de su pestaña. | El flujo de dos pasos actual (`guardarEdicionReglaVisual` deja el cambio solo en memoria) es la principal fuente de cambios perdidos. |
| D17 | **Clave de id = `id_regla`** (la que ya usa la UI: `app_alertas_js.html` 70 y 114). El motor no usa el id. Para reglas nuevas: `R-NNN` (máximo sufijo numérico existente + 1, con relleno a 3 dígitos); si no hay ids con ese patrón, se empieza en `R-001`. Al editar, el id es de solo lectura. | No inventar un formato paralelo. |
| D18 | **`nombre` debe ser único** (sin distinguir mayúsculas ni espacios en los extremos). Se valida en cliente y en servidor. | La deduplicación del motor usa `RT + "_" + REGLA(nombre)` (`evaluador_alertas.js:389`): dos reglas con el mismo nombre se tapan entre sí. |
| D19 | **`regla_tiempo` y `alerta_bloqueo` son excluyentes en el constructor** (radio "Por plazo" / "Bloqueo directo"). Al cambiar de tipo se borra la otra clave, con aviso. | El motor ignora `alerta_bloqueo` en silencio si existe `regla_tiempo` (línea 179). |
| D20 | **Forma canónica al escribir criterios:** `columna`, `operador`, `valor` (escalar) o `valores` (array, solo IN/NOT_IN), `columna_destino`, `min_pct`, `max_pct`. Al leer, el constructor acepta los alias que el motor acepta (`columna_estado`/`columna_A`, `valores_estado`/`valor`, `operador_estado`). Al guardar un criterio editado, borra los alias de ese criterio. Las `condiciones` sin `criterios` (criterio suelto) se reescriben como `{operador_logico:'AND', criterios:[...]}`. Las `excepciones` se escriben siempre como **array** de bloques. | Equivale semánticamente a lo que el motor ya hace (`_cumpleCondiciones` toma `columna_estado || columna_A || columna`), pero sin que un alias viejo tape el valor nuevo. |
| D21 | **Nombres de columna en MAYÚSCULAS y sin espacios en los extremos**, igual que el motor (`evaluador_alertas.js:125`). `obtenerMetadatosEditorReglas()` normaliza así, sin vacíos ni duplicados, en el orden de la hoja. | Si el editor guardara la columna tal como aparece en la hoja, `filaMatriz[columna]` no la encontraría. |
| D22 | **Cliente vs servidor en la validación:** el **cliente bloquea** columna vacía, columna que no está en los encabezados (en reglas tocadas por el constructor), operador desconocido, parámetros faltantes del operador, JSON inválido, nombre vacío o duplicado, umbrales sin orden estrictamente creciente (ROJO < NARANJA < AMARILLO entre los niveles habilitados) y `dias_vida_util` ≤ 0. El **servidor bloquea** JSON inválido, `ReglasDeNegocio` que no sea array, operador desconocido, nivel fuera de ROJO/NARANJA/AMARILLO y nombre duplicado. Una columna desconocida en el servidor es **advertencia, no bloqueo**. | Si se renombra un encabezado en `Datos`, bloquear en el servidor impediría guardar cualquier arreglo. La lista de operadores existe una sola vez (constante del servidor expuesta por metadatos) y el cliente no la repite. |
| D23 | **No se añaden operadores nuevos** (por ejemplo, no hay `GREATER_THAN`) y no se corrigen sus particularidades (ver §9). | Alcance: "operadores que el código ya soporta". |
| D24 | **Valores de IN/NOT_IN: uno por línea** en un textarea, que se guarda como array. | Hay valores de dominio que llevan coma. |
| D25 | **Selector de columna con `<input list>` + un único `<datalist id="dlColumnasDatos">`.** | Es buscable de forma nativa con listas largas, sin framework. |
| D26 | **Código del constructor en un partial nuevo `app_reglas_editor_js.html`**, incluido justo después de `app_alertas_js`. | `app_alertas_js.html` ya mezcla reglas y bandeja (919 líneas); el constructor suma unas 400. Un partial aparte sigue el patrón CONC-FE-02 y deja diffs revisables. |
| D27 | **Tras escribir `ALERTAS_ACTIVAS`, el motor llama a `invalidateDataCache()`** (`cache_backend.js:138`). | Si no, el dashboard mostraría el resumen viejo durante los 30 min del caché del servidor. |
| D28 | **El badge fijo "3" del menú Alertas** (`Index.html:94`) recibe `id="navBadgeAlertas"` y muestra el total del resumen. | Hoy es un número inventado: contradice la fuente única. |
| D29 | **Arnés de pruebas locales fuera del repo** (`%TEMP%`). | Con `rootDir:""` y `skipSubdirectories:false`, cualquier `scripts/*.js` nuevo (salvo `lint-html-scripts.js`, que está en `.claspignore`) se subiría al proyecto GAS. |

---

## 4. Fases (instrucciones literales para el ejecutor)

**Reglas para todas las fases:**
- Antes de explorar código, ejecuta `graphify query "<tema de la fase>" --budget 1500` en la raíz (regla del repo). Después usa Read/Grep solo para las líneas a editar.
- No hagas `clasp push`/`pull`/`deploy`/`clone` ni cambies `.clasp.json`. No hagas commits salvo que el usuario lo pida (formato `tipo(módulo): descripción [TICKET]`).
- No toques PAC (`pac_*.js`, `pac_seccion.html`, que tiene su propio botón "Nueva Regla" en la línea 472: **no es este**), Equipos, Normalización ni `export_pdf_backend.js`.
- Si `git status` muestra cambios ajenos a la sesión, no los toques.
- Los números de línea son de la lectura del 2026-10-18; confírmalos antes de editar.
- Comando de verificación base (desde la raíz): `node scripts/lint-html-scripts.js <archivos tocados>`.

### F0 — Línea base y bitácora "antes" (sin cambios de código)
- **Archivos:** `DOCUMENTACION_TECNICA_VIVA.md` (solo añadir).
- **Hacer:**
  1. Leer `.clasp.json` y confirmar `scriptId == 18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. Si no coincide: detenerse y avisar.
  2. Ejecutar `node scripts/lint-html-scripts.js motor_reglas.js evaluador_alertas.js Codigo.js app_alertas_js.html Index.html` y guardar la salida como línea base. Si algo falla ya aquí (por ejemplo, un scriptlet `<?!= ?>` dentro de `<script>` en `Index.html`), anotarlo: en las fases siguientes solo se aceptan **esos mismos** fallos.
  3. Añadir a `DOCUMENTACION_TECNICA_VIVA.md` una entrada firmada **Cursor**, "Motor de reglas y alertas — antes del cambio": qué hace cada archivo a tocar (§5) y qué se va a cambiar (resumen de §3).
- **No tocar:** ningún `.js` ni `.html`.
- **Hecho cuando:** existe la entrada en la bitácora y la línea base está anotada.

### F1 — Una sola definición de obtener/guardar reglas (A1)
- **Archivos:** `evaluador_alertas.js`, `motor_reglas.js`.
- **Hacer:**
  1. `evaluador_alertas.js`: borrar el bloque de las líneas 1–86 (encabezado "MOTOR DE REGLAS - ALMACENAMIENTO Y LECTURA", `obtenerReglasJSON`, `guardarReglasJSON`). El archivo debe empezar en el comentario "MOTOR EVALUADOR DE REGLAS DE NEGOCIO V1.0".
  2. `motor_reglas.js`: extraer la creación de la hoja a `function _obtenerHojaConfigReglas_(ss, crearSiFalta)`, que devuelve la hoja o `null` y conserva tal cual el lock y el doble chequeo de las líneas 15–37. `obtenerReglasJSON()` la usa con `crearSiFalta=true`.
  3. `guardarReglasJSON(jsonString, _usuarioIgnorado, versionEsperada)`: usar `_obtenerHojaConfigReglas_(ss, true)` (hoy, si la hoja no existe, falla con TypeError en la línea 71). Auditar con `Session.getActiveUser().getEmail()`, no con el parámetro del cliente.
  4. En `MotorEvaluadorReglas.ejecutarMotor()` (`evaluador_alertas.js`, línea 112 original), reemplazar la lectura directa de `CONFIG_REGLAS!B1` por `const lectura = obtenerReglasJSON(); if (!lectura.success) return { success:false, error: lectura.error || lectura.message };` y usar `lectura.data`. Añadir una guarda: si `!Array.isArray(configReglas.ReglasDeNegocio)`, devolver `{success:false, error:'El JSON de reglas no tiene ReglasDeNegocio[]'}`.
- **No tocar:** `class MotorReglas` (se borra en F2), la UI.
- **Hecho cuando:** `rg -c "function obtenerReglasJSON|function guardarReglasJSON" *.js` muestra exactamente 1 de cada una, ambas en `motor_reglas.js`; `ejecutarMotor` ya no contiene `getSheetByName('CONFIG_REGLAS')`.
- **Verificar:** `node scripts/lint-html-scripts.js motor_reglas.js evaluador_alertas.js`.

### F2 — Dashboard y bandeja con la misma fuente (A2)
- **Archivos:** `evaluador_alertas.js`, `motor_reglas.js`, `Codigo.js`, `app_alertas_js.html`, `Index.html` (solo el badge del menú).
- **Hacer:**
  1. `evaluador_alertas.js`: añadir `function resumirAlertasActivasParaDashboard_(registrosVisibles)`:
     - Construye un `Set` de RT con `String(r.RT || r['NUMERO RT'] || '').trim()` a partir de `registrosVisibles`.
     - Lee `ALERTAS_ACTIVAS` de `getConfig('DATA_FILES.PRINCIPAL')`. Si no existe o tiene menos de 2 filas, o la fila 2 es el texto "No hay alertas activas en el sistema.", devuelve el resumen vacío.
     - Mapea los encabezados por nombre (`TIMESTAMP, NIVEL, RT, PROYECTO, ARTICULADOR_EMAIL, GESTOR_EMAIL, REGLA, MENSAJE`) y conserva solo las filas cuyo RT esté en el Set.
     - Devuelve `{ success:true, totalAlertas, severidades:{ROJO,NARANJA,AMARILLO}, proyectosImpactados, rtImpactados, alertas: top MAX_ALERTAS_PAYLOAD ordenadas ROJO>NARANJA>AMARILLO con forma {RT, PROYECTO, REGLA, NIVEL, MENSAJE, FECHA_EVALUACION:TIMESTAMP, ARTICULADOR_EMAIL, GESTOR_EMAIL, SIN_RESPONSABLE}, ultimaEvaluacion: TIMESTAMP de la primera fila o '' }`.
     - Todo dentro de try/catch; ante error devuelve `{success:false, ...vacío, error}`.
  2. `evaluador_alertas.js`: borrar `_normalizarSeveridadAlertas` y `evaluarAlertasDataset` (líneas 514–623 originales). Conservar `MAX_ALERTAS_PAYLOAD`, `REGEX_EMAIL_SIMPLE_ALERTAS` y `_resolverEmailDesdeCeldaAlertas`.
  3. `motor_reglas.js`: borrar los typedef `Regla`/`AlertaGenerada`, `class MotorReglas` y el bloque `globalThis.MotorReglas` (líneas 88–332 originales).
  4. `Codigo.js:getDashboardData()`: en la línea 537, `const alertasResumen = resumirAlertasActivasParaDashboard_(allRecords);`. En el catch (líneas 578–585), cambiar `severidades` a `{ ROJO: 0, NARANJA: 0, AMARILLO: 0 }`.
  5. `evaluador_alertas.js:ejecutarMotor()`: después de `this._guardarAlertasEnHoja();`, añadir `if (typeof invalidateDataCache === 'function') invalidateDataCache();`.
  6. `app_alertas_js.html`:
     - En `ensureAlertSummaryDom`, reemplazar los badges por `badgeAlertasRojo` ("ROJO: 0"), `badgeAlertasNaranja`, `badgeAlertasAmarillo` y `badgeTotalAlertas`, que se mantiene porque abre el modal.
     - En `renderizarResumenAlertas`, todos los defaults de `severidades` pasan a `{ROJO:0,NARANJA:0,AMARILLO:0}`; se leen `severidades.ROJO/NARANJA/AMARILLO`; en el modal, el color sale de `ROJO→danger`, `NARANJA→warning`, otro→`secondary`; además se escribe el total en `#navBadgeAlertas` si existe.
     - Escapar con `escapeHtml` (de `app_core_js.html:438`) `REGLA`, `PROYECTO`, `MENSAJE` y `RT` en el HTML del modal.
  7. `Index.html:94`: `<span class="badge" id="navBadgeAlertas">0</span>`.
- **No tocar:** `export_pdf_backend.js`, `app_herramientas_js.html` (ya leen `NIVEL`), `obtenerAlertasWeb`, la lógica RBAC de `getDashboardData`.
- **Hecho cuando:** `rg -n "MotorReglas\b|evaluarAlertasDataset|CRITICA" --glob "*.{js,html}"` no devuelve nada en `motor_reglas.js`, `evaluador_alertas.js`, `Codigo.js` ni `app_alertas_js.html` (puede seguir apareciendo `CRITICA` en `export_pdf_backend.js`, lo cual es correcto, y en `pac_*`).
- **Verificar:** `node scripts/lint-html-scripts.js motor_reglas.js evaluador_alertas.js Codigo.js app_alertas_js.html Index.html` (comparar con la línea base de F0).

### F3 — Evaluación cruzada y fuentes: conservar sin ejecutar y mostrarlo (A3)
- **Archivos:** `evaluador_alertas.js`, `app_alertas_js.html`, `Index.html`.
- **Hacer:**
  1. `ejecutarMotor()`: contar `reglasNoEvaluables = reglasActivas.filter(r => r.evaluacion_cruzada && r.alerta_bloqueo && !r.regla_tiempo).length` y devolverlo en el resultado junto con `totalAlertas`. **No cambiar** la condición de la línea 179.
  2. `renderizarTarjetasReglas()`:
     - Escapar `fase`, `nombre`, `descripcion` e `id_regla` con `escapeHtml`.
     - Si `regla.evaluacion_cruzada`, badge gris "Evaluación cruzada: no se evalúa".
     - Si además tiene `alerta_bloqueo` y no `regla_tiempo`, badge rojo contorneado "No genera alertas en esta versión".
     - Hoy el badge de tiempo pisa al de bloqueo (líneas 54–55): concatenar ambos.
  3. `renderizarFuentesDeDatos()`: escapar los valores y anteponer un `alert-secondary`: "Fuentes declaradas en el JSON. El motor de esta versión solo evalúa la hoja Datos; estas fuentes no se consultan."
  4. `ejecutarMotorManual()`: si `res.reglasNoEvaluables > 0`, añadir al toast "(N reglas con evaluación cruzada no se evaluaron)".
  5. `Index.html:960`: renombrar la pestaña a "Fuentes declaradas (no evaluadas)".
- **No tocar:** las claves del JSON; no borrar `FuentesDeDatos` ni `evaluacion_cruzada`.
- **Hecho cuando:** con un JSON de prueba que tenga una regla con `evaluacion_cruzada` + `alerta_bloqueo`, la tarjeta muestra ambos badges (verificable en F10/Web App; en local, revisión de código).
- **Verificar:** `node scripts/lint-html-scripts.js evaluador_alertas.js app_alertas_js.html Index.html`.

### F4 — Trigger diario del motor y botón huérfano (A4 + A7)
- **Archivos:** `evaluador_alertas.js`, `app_alertas_js.html`, `Index.html`.
- **Hacer:**
  1. `evaluador_alertas.js`, sección "FUNCIONES PARA LLAMAR DESDE LA INTERFAZ Y TRIGGERS":
     - `function ejecutarMotorReglasInterno_()`: crea `new MotorEvaluadorReglas()`, llama `ejecutarMotor()`, registra `logAction(Session.getEffectiveUser().getEmail() || 'SISTEMA', 'MOTOR_REGLAS_EJECUTADO', JSON.stringify({totalAlertas, reglasNoEvaluables}))` dentro de try/catch y devuelve el resultado.
     - `ejecutarEvaluadorAlertas()`: por ahora solo `return ejecutarMotorReglasInterno_();` (la guarda de admin se añade en F5).
     - `function triggerDiarioMotorReglas(e)`:
       - Si `!e || !e.triggerUid` o el UID no está en `ScriptApp.getProjectTriggers().map(t => t.getUniqueId())`, devolver `{success:false, error:'Solo invocable por el trigger instalado'}`.
       - Si pasa, `try { const r = ejecutarMotorReglasInterno_(); if (!r.success) throw new Error(r.error); } catch (err) { console.error(...); MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: '[Motor de Reglas] Fallo en trigger diario', htmlBody: <mensaje escapado> }); }`.
     - `function _eliminarTriggerMotorReglas_()`: borra solo los triggers cuyo `getHandlerFunction() === 'triggerDiarioMotorReglas'` y devuelve cuántos borró.
     - `function instalarTriggerMotorReglas()`: `_eliminarTriggerMotorReglas_()`, luego `ScriptApp.newTrigger('triggerDiarioMotorReglas').timeBased().everyDays(1).atHour(6).create()`, y devuelve `{success:true, mensaje:'Trigger diario 6:00 instalado'}`.
     - `function eliminarTriggerMotorReglas()`: `return {success:true, eliminados:_eliminarTriggerMotorReglas_()};`.
     - Encabezado JSDoc en el que diga literalmente: "Ejecutar UNA VEZ desde el editor con la cuenta Administrador. Independiente de instalarTriggersPAC()."
  2. `app_alertas_js.html`: borrar `programarReporte()` completo (líneas 892–918).
  3. `Index.html` 886–898: vaciar el `<div class="page-actions">` de `#page-permisos` (quitar los cuatro botones).
- **No tocar:** `pac_triggers.js`, `instalarTriggersPAC`, `eliminarTriggersPAC`. **No ejecutar** `instalarTriggerMotorReglas`.
- **Hecho cuando:** `rg -n "programarReporte|programarEnvioAutomatico" --glob "*.{js,html}"` no devuelve nada; `rg -n "triggerDiarioMotorReglas" *.js` aparece solo en `evaluador_alertas.js`.
- **Verificar:** `node scripts/lint-html-scripts.js evaluador_alertas.js app_alertas_js.html Index.html`.

### F5 — Solo Administrador guarda, ejecuta, envía e instala (A5)
- **Archivos:** `motor_reglas.js`, `evaluador_alertas.js`, `Codigo.js`, `app_alertas_js.html`, `Index.html`.
- **Hacer:**
  1. `motor_reglas.js`: añadir `function _exigirAdminMotorReglas_(accion)`. Hace `try { new GestorPermisos().validarPermiso('ADMIN_SISTEMA'); return null; } catch (e) { try { logAction(Session.getActiveUser().getEmail() || 'desconocido', accion + '_DENEGADO', e.message); } catch (_) {} return { success:false, error:'Requiere rol Administrador.' }; }`.
  2. Primera línea de cada función, con la forma `const denegado = _exigirAdminMotorReglas_('<ACCION>'); if (denegado) return denegado;`:
     - `guardarReglasJSON` → `'GUARDAR_REGLAS'` (antes de parsear).
     - `ejecutarEvaluadorAlertas` → `'EJECUTAR_MOTOR_REGLAS'`.
     - `instalarTriggerMotorReglas` → `'INSTALAR_TRIGGER_MOTOR'`.
     - `eliminarTriggerMotorReglas` → `'ELIMINAR_TRIGGER_MOTOR'`.
     - `Codigo.js:procesarReporteAlertas` → `'ENVIAR_REPORTE_ALERTAS'` (dentro del try, como primera sentencia).
  3. `ejecutarMotorReglasInterno_` y `triggerDiarioMotorReglas` **no** llevan la guarda (ver D13).
  4. `app_alertas_js.html`:
     - Añadir `function aplicarVisibilidadAdminReglas()`, que alterna `d-none` en `.solo-admin-reglas` según `typeof currentRole !== 'undefined' && currentRole === 'Administrador'`. Llamarla al final de `cargarJSONenPantalla` y de `cargarAlertasWeb`.
     - En `exportarAlertasExcel()`, si el usuario no es Administrador, eliminar del `<select id="reporteAlertasModo">` las opciones `EMAIL_UNICO` y `GESTOR_Y_ARTICULADOR` y dejar `DESCARGAR_CSV` seleccionada.
     - Ante `res.error` de servidor, mostrar el error tal cual.
  5. `Index.html`: añadir la clase `solo-admin-reglas` al botón "Forzar Evaluación (Motor)" de `#page-alertas` (línea 524).
- **No tocar:** `obtenerReglasJSON`, `obtenerAlertasWeb`, `generarReporteAlertasPdfBackend` (sigue con `REPORTES`).
- **Hecho cuando:** `rg -n "_exigirAdminMotorReglas_\(" *.js` muestra 6 llamadas + 1 definición.
- **Verificar:** `node scripts/lint-html-scripts.js motor_reglas.js evaluador_alertas.js Codigo.js app_alertas_js.html Index.html`.

### F6 — CSV local con las columnas reales (A6)
- **Archivos:** `app_alertas_js.html`.
- **Hacer:** en `descargarAlertasCsvLocal()` (líneas 720–746), usar `a['DIAS RESTANTES']` y `a['ESTADO PREDIAL ACTUAL']` en lugar de `a.DIAS_RESTANTES` y `a.ESTADO_PREDIAL`. Añadir un helper local `const celdaCsv = v => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';` y aplicarlo a **todas** las celdas.
- **No tocar:** los encabezados del CSV (ya coinciden con la hoja), `procesarReporteAlertas`.
- **Hecho cuando:** `rg -n "DIAS_RESTANTES|ESTADO_PREDIAL\b" app_alertas_js.html` no devuelve nada.
- **Verificar:** `node scripts/lint-html-scripts.js app_alertas_js.html`.

### F7 — Backend del constructor: metadatos, validación y versión (B, servidor)
- **Archivos:** `evaluador_alertas.js`, `motor_reglas.js`.
- **Hacer:**
  1. `evaluador_alertas.js`, justo encima de `class MotorEvaluadorReglas`: constantes globales que describen **exactamente** el `switch` de `_cumpleCondiciones` (sin añadir operadores):
     ```
     const OPERADORES_CONDICION_REGLAS = {
       EQUALS:                     { etiqueta: 'Es igual a',                         parametros: ['valor'] },
       NOT_EQUAL:                  { etiqueta: 'Es distinto de',                     parametros: ['valor'] },
       IN:                         { etiqueta: 'Está en la lista',                   parametros: ['valores'] },
       NOT_IN:                     { etiqueta: 'No está en la lista',                parametros: ['valores'] },
       IS_NULL:                    { etiqueta: 'Está vacío (vacío, N/A, -)',         parametros: [] },
       IS_NOT_NULL:                { etiqueta: 'Tiene dato (no vacío, 0 ni N/A)',    parametros: [] },
       LESS_THAN:                  { etiqueta: 'Número menor que',                   parametros: ['valor'] },
       DATE_BEFORE_COLUMN:         { etiqueta: 'Fecha anterior a otra columna',      parametros: ['columna_destino'] },
       PERCENTAGE_BETWEEN_COLUMNS: { etiqueta: '% de otra columna entre min y max',  parametros: ['columna_destino', 'min_pct', 'max_pct'] },
       DAYS_PASSED_LESS_THAN:      { etiqueta: 'Días transcurridos hasta hoy ≤',     parametros: ['valor'] }
     };
     const NIVELES_ALERTA_REGLAS = ['ROJO', 'NARANJA', 'AMARILLO'];
     const TIPOS_DIAS_REGLAS = ['HABILES', 'CALENDARIO'];
     ```
     Añadir un comentario de una línea: "Debe coincidir con el switch de _cumpleCondiciones".
  2. `motor_reglas.js`:
     - `function obtenerMetadatosEditorReglas()`: guarda de admin `'LEER_METADATOS_REGLAS'`; abre `getConfig('DATA_FILES.PRINCIPAL')` y la hoja `getConfig('SHEETS.DATOS')`; lee **solo la fila 1** (`getRange(1,1,1,getLastColumn()).getValues()[0]`); normaliza con `String(h).trim().toUpperCase()`, filtra vacíos y deduplica conservando el orden. Devuelve `{success:true, columnas, operadores: OPERADORES_CONDICION_REGLAS, niveles: NIVELES_ALERTA_REGLAS, tiposDias: TIPOS_DIAS_REGLAS}`.
     - `function validarConfigReglas_(config, columnasConocidas)` → `{errores:[], advertencias:[]}`:
       - Errores: `config` no es objeto; `ReglasDeNegocio` no es array; regla sin `nombre`; `nombre` duplicado (trim + mayúsculas); criterio con operador no presente en `OPERADORES_CONDICION_REGLAS` (resolver `operador_estado || operador`); `alerta_bloqueo.nivel` o `umbrales[].nivel` fuera de `NIVELES_ALERTA_REGLAS`; `regla_tiempo.umbrales` que no sea array.
       - Advertencias: columna (resolver alias como el motor) no presente en `columnasConocidas`, solo si se pasó la lista.
       - Recorrer `condiciones` y cada bloque de `excepciones` (objeto o array).
     - `guardarReglasJSON`: después de `JSON.parse`, llamar `validarConfigReglas_(obj, columnasDeDatos)` (leer la fila 1 con la misma lógica, a través de un helper compartido `_leerEncabezadosDatosReglas_()` que también usa `obtenerMetadatosEditorReglas`). Si hay errores, devolver `{success:false, error: errores.join(' | '), errores}` **antes** del lock. Si guarda, incluir `advertencias` en la respuesta.
     - Versión: `function _versionReglas_(str)`, que devuelve el hex de `Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(str), Utilities.Charset.UTF_8)`. `obtenerReglasJSON` añade `version: _versionReglas_(jsonString)`. `guardarReglasJSON`, ya dentro del lock y antes de escribir: si `versionEsperada` viene con valor y `!== _versionReglas_(hoja.getRange('B1').getValue())`, devolver `{success:false, conflicto:true, error:'Otro administrador modificó las reglas. Recarga antes de guardar.'}`. En éxito devolver `version` nueva.
- **No tocar:** el `switch` de `_cumpleCondiciones`, `_evaluarReglaTiempo`, la UI.
- **Hecho cuando:** las claves de `OPERADORES_CONDICION_REGLAS` coinciden 1:1 con los `case` del switch: `rg -o 'case "[A-Z_]+"' evaluador_alertas.js` da los mismos 10 nombres.
- **Verificar:** `node scripts/lint-html-scripts.js motor_reglas.js evaluador_alertas.js` + arnés local de §6 (validador y `_cumpleCondiciones`).

### F8 — Constructor gráfico en el tablero (B, cliente)
- **Archivos:** `app_reglas_editor_js.html` (nuevo), `app_alertas_js.html`, `Index.html`.
- **Hacer:**
  1. **`Index.html`:**
     - Línea 975, botón "Nueva Regla": `onclick="abrirConstructorRegla(null)"` + clase `solo-admin-reglas`.
     - Líneas 938–940: quitar "Guardar Configuración" del encabezado de la página.
     - En la cabecera del card del Modo JSON (línea 994), junto a "Formatear Código", añadir `<button class="btn btn-sm btn-warning py-0 solo-admin-reglas" onclick="guardarJSONdesdePantalla()">Guardar JSON</button>`.
     - Reemplazar el modal `#modalEditarReglaVis` (líneas 1007–1054) por `#modalConstructorRegla` (`modal-xl`, `data-bs-backdrop="static"`), con estas secciones:
       - (1) **Datos generales:** `id_regla` (solo lectura), `nombre`*, `fase` (con `<datalist id="dlFasesReglas">`), switch `activa`, `descripcion`.
       - (2) **Condiciones:** select AND/OR + contenedor `#crCondiciones` + botón "Añadir criterio".
       - (3) **Excepciones:** contenedor `#crExcepciones` + "Añadir bloque de excepción".
       - (4) **Tipo de alerta:** radios `#crTipoTiempo` / `#crTipoBloqueo`.
         - Panel tiempo: `columna_fecha_inicio`, `tipo_dias` (HABILES/CALENDARIO), `dias_vida_util`, y tres filas fijas ROJO/NARANJA/AMARILLO, cada una con checkbox "usar", `dias_restantes` y `mensaje` (con ayuda "{DIAS} se reemplaza por el número de días").
         - Panel bloqueo: `nivel`, `mensaje`.
       - (5) **Evaluación cruzada (solo lectura):** visible solo si la regla la trae, con el texto "Se conserva en el JSON; no se evalúa en esta versión".
       - (6) **Vista previa JSON** de la regla (`<pre>`).
       - (7) Lista de errores de validación (`#crErrores`).
       - Pie: Cancelar / "Guardar regla" (`solo-admin-reglas`).
     - Un único `<datalist id="dlColumnasDatos">`.
     - Añadir `<?!= include('app_reglas_editor_js') ?>` inmediatamente después de `<?!= include('app_alertas_js') ?>` (línea 1908).
  2. **`app_alertas_js.html`:**
     - Borrar `abrirEditorVisual` y `guardarEdicionReglaVisual`.
     - Al inicio del archivo declarar `let motorReglasVersion = null; let motorReglasJsonCargado = '';`. No redeclarar `motorReglasData` (vive en `app_core_js.html:57`).
     - En `cargarJSONenPantalla`, guardar `motorReglasVersion = response.version` y `motorReglasJsonCargado = val`. Si el JSON está vacío (`{}`) o no trae `ReglasDeNegocio`, inicializar `motorReglasData = { ReglasDeNegocio: [] }` (conservando las otras claves si existen) para que "Nueva Regla" funcione con la hoja vacía; el mensaje vacío pasa a decir "Aún no hay reglas. Usa «Nueva Regla»."
     - En `renderizarTarjetasReglas`, el pie de cada tarjeta tiene "Editar" → `abrirConstructorRegla(index)` y "Activar/Desactivar" → `alternarActivaRegla(index)`, ambos con `solo-admin-reglas`.
     - `guardarJSONdesdePantalla`:
       - Validación en cliente: JSON parseable; `ReglasDeNegocio` es array; si `metadatosEditorReglas` está cargado, operadores conocidos.
       - Si hay columnas desconocidas: `confirm` con la lista.
       - Llamar `.guardarReglasJSON(jsonString, currentUser, motorReglasVersion)`.
       - Si la respuesta trae `conflicto`, avisar y llamar `cargarJSONenPantalla()`.
       - Mostrar `advertencias` si vienen.
  3. **`app_reglas_editor_js.html`** (nuevo; `<script>` con funciones globales, sin `let` que choque con otros partials). Estado: `let metadatosEditorReglas = null; let reglaEnEdicion = null; let indiceReglaEnEdicion = null;`. Funciones:
     - `cargarMetadatosEditorReglas(callback)`: `google.script.run.obtenerMetadatosEditorReglas()`, cacheado en `metadatosEditorReglas`; llena `#dlColumnasDatos`.
     - `abrirConstructorRegla(index)`:
       - Si `motorReglasData` es null, mostrar el toast "Carga primero el motor" y salir.
       - Carga los metadatos y luego pone `reglaEnEdicion = index === null ? { id_regla: generarIdRegla(), nombre:'', descripcion:'', fase:'', activa:true, condiciones:{operador_logico:'AND', criterios:[]} } : JSON.parse(JSON.stringify(motorReglasData.ReglasDeNegocio[index]))`.
       - Pinta el formulario y llena `#dlFasesReglas` con las fases existentes.
     - `generarIdRegla()`: según D17.
     - `normalizarCriterioParaEditor(c)`: alias → canónico, según D20.
     - `renderBloqueCondiciones(contenedorId, bloque)` / `leerBloqueCondiciones(contenedorId)`: filas con columna (`input list="dlColumnasDatos"`), operador (`select` desde `metadatosEditorReglas.operadores`) y parámetros dinámicos según `parametros`:
       - `valor` → input texto (numérico si el operador es `LESS_THAN` o `DAYS_PASSED_LESS_THAN`).
       - `valores` → textarea, uno por línea.
       - `columna_destino` → input con lista.
       - `min_pct` / `max_pct` → números.
       - Un operador que no esté en los metadatos se muestra marcado en rojo.
     - `onCambioOperadorCriterio(fila)`: repinta solo los parámetros de esa fila.
     - `agregarCriterio(contenedorId)`, `quitarCriterio(boton)`, `agregarBloqueExcepcion()`, `quitarBloqueExcepcion(boton)`.
     - `onCambioTipoAlerta()`: si pasa a un tipo cuando la regla trae la otra clave, `confirm('Se eliminará la configuración de … ¿continuar?')`.
     - `construirReglaDesdeFormulario()`: parte de `reglaEnEdicion` (clon), sobrescribe **solo** las claves gestionadas (`id_regla, nombre, descripcion, fase, activa, condiciones, excepciones, regla_tiempo | alerta_bloqueo`) y conserva cualquier otra (incluida `evaluacion_cruzada`). Escribe `excepciones` como array y la omite si queda vacía.
     - `validarReglaCliente(regla, indice)` → array de mensajes según D22 (nombre único contra las otras reglas; cada criterio con columna no vacía y presente en `metadatosEditorReglas.columnas`; operador conocido; parámetros completos; IN/NOT_IN con al menos un valor; `columna_destino` válida; `min_pct ≤ max_pct`; regla de tiempo con columna de fecha válida, `dias_vida_util > 0`, al menos un umbral y orden estrictamente creciente; bloqueo con nivel y mensaje).
     - `previsualizarReglaJSON()`: repinta el `<pre>` en cada `input`/`change` del modal.
     - `persistirConfigReglas(nuevaConfig, mensajeOk)`: `JSON.stringify(nuevaConfig, null, 4)`.
       - Si `#editorJSONReglas` difiere de `JSON.stringify(motorReglasData, null, 4)` (cambios sin guardar en el Modo JSON), `confirm('Hay cambios sin guardar en el Modo JSON que se descartarán. ¿Continuar?')`.
       - Llama `.guardarReglasJSON(json, currentUser, motorReglasVersion)`.
       - Éxito: toast + `cargarJSONenPantalla()`.
       - `conflicto`: aviso + `cargarJSONenPantalla()`.
       - Error: pintarlo en `#crErrores` o en un toast.
     - `guardarReglaDesdeConstructor()`: construir → validar (si hay errores, pintarlos en `#crErrores` y salir) → clonar `motorReglasData` → reemplazar en `indiceReglaEnEdicion` o hacer `push` → `persistirConfigReglas` → cerrar el modal en éxito.
     - `alternarActivaRegla(index)`: `confirm` → clonar → invertir `activa` → `persistirConfigReglas`.
     - Todo el texto de usuario que se inserte con `innerHTML` pasa por `escapeHtml`.
- **No tocar:** el Modo JSON (salvo mover el botón), la bandeja, `pac_seccion.html`.
- **Hecho cuando:** `rg -n "modalEditarReglaVis|abrirEditorVisual|guardarEdicionReglaVisual" --glob "*.html"` no devuelve nada; `rg -n "include\('app_reglas_editor_js'\)" Index.html` devuelve 1; la regla nueva guardada por el constructor solo contiene claves de §3 D20 + las preservadas.
- **Verificar:** `node scripts/lint-html-scripts.js app_reglas_editor_js.html app_alertas_js.html Index.html` + revisión manual de que ningún `let`/`const` de nivel superior del partial nuevo choca con otro partial (`rg -n "^(let|const) (metadatosEditorReglas|reglaEnEdicion|indiceReglaEnEdicion|motorReglasVersion|motorReglasJsonCargado)\b" --glob "*.html"`: una sola aparición de cada uno).

### F9 — Cierre documental (sin código)
- **Archivos:** `DOCUMENTACION_TECNICA_VIVA.md`, `TODOS.md` (opcional), `graphify-out/` (regenerado).
- **Hacer:**
  1. Entrada "Motor de reglas y alertas — después del cambio", firmada **Cursor**: funciones tocadas, añadidas y borradas por archivo; impacto funcional (§1); validaciones ejecutadas (salidas de lint y arnés); referencias a líneas; pasos manuales pendientes (instalar trigger, checklist de §6 en la Web App); decisiones abiertas de §8.
  2. `graphify update .`
  3. Si el usuario pide commit de cierre `docs(reflect)`, regenerar en el mismo commit `Documento_Tecnico_Aplicacion_Predios.docx` y `.pdf` con los comandos de `CLAUDE.md`.
- **Hecho cuando:** la entrada existe y graphify está actualizado.

### F10 — Subida al script `18vY9…` (**SOLO SI EL USUARIO LO PIDE**)
- **Hacer, en orden:**
  1. Releer `.clasp.json` y confirmar `scriptId == 18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`. Si no coincide: detenerse.
  2. Confirmar que ninguna otra IA está empujando en paralelo.
  3. Pedir al usuario un **respaldo** del JSON actual: abrir Motor de Reglas → Modo Desarrollador, copiar a un archivo local fuera del repo. Hacerlo **antes** del push.
  4. `clasp push` (sin `deploy` salvo que lo pida).
  5. Indicarle al usuario que ejecute **él** `instalarTriggerMotorReglas()` desde el editor con la cuenta Administrador y que verifique en "Activadores" que aparece `triggerDiarioMotorReglas` diario 6:00 junto a los PAC, que no cambian.
  6. Ejecutar con el usuario el checklist de Web App de §6.

---

## 5. Archivos

Seis archivos de código (menos de 8) más la bitácora obligatoria.

| Archivo | Obligatorio / diferible | Fases | Qué cambia |
|---------|------------------------|-------|-----------|
| `motor_reglas.js` | **Obligatorio** | F1, F2, F5, F7 | Queda como módulo de almacenamiento: `obtenerReglasJSON` (+`version`), `guardarReglasJSON` (admin, Session, crea hoja, valida, versión optimista), `_obtenerHojaConfigReglas_`, `_exigirAdminMotorReglas_`, `obtenerMetadatosEditorReglas`, `_leerEncabezadosDatosReglas_`, `validarConfigReglas_`, `_versionReglas_`. **Se borra** `class MotorReglas`. |
| `evaluador_alertas.js` | **Obligatorio** | F1–F5, F7 | Se borran las copias de obtener/guardar, `evaluarAlertasDataset` y `_normalizarSeveridadAlertas`. `ejecutarMotor` lee con `obtenerReglasJSON`, cuenta `reglasNoEvaluables` e invalida el caché. Nuevos: `resumirAlertasActivasParaDashboard_`, `OPERADORES_CONDICION_REGLAS`, `NIVELES_ALERTA_REGLAS`, `TIPOS_DIAS_REGLAS`, `ejecutarMotorReglasInterno_`, `triggerDiarioMotorReglas`, `instalarTriggerMotorReglas`, `eliminarTriggerMotorReglas`, `_eliminarTriggerMotorReglas_`. |
| `Codigo.js` | **Obligatorio** | F2, F5 | Dos cambios puntuales: la línea 537 de `getDashboardData` (+ fallback del catch) y la guarda de admin en `procesarReporteAlertas`. |
| `app_alertas_js.html` | **Obligatorio** | F2–F6, F8 | Badges ROJO/NARANJA/AMARILLO, tarjetas con badges de "no evaluado", fuentes con aviso, borrado de `programarReporte` y del editor viejo, CSV corregido, visibilidad de admin, versión al guardar el JSON. |
| `Index.html` | **Obligatorio** | F2–F5, F8 | Badge del menú, pestaña renombrada, encabezado de Permisos vacío, clase de admin, botón "Nueva Regla" conectado, "Guardar JSON" movido, modal nuevo que reemplaza `#modalEditarReglaVis`, `include` del partial nuevo. |
| `app_reglas_editor_js.html` (nuevo) | **Obligatorio** para B; podría fusionarse en `app_alertas_js.html` (diferible solo como decisión de organización, no funcional) | F8 | El constructor gráfico. |
| `DOCUMENTACION_TECNICA_VIVA.md` | **Obligatorio** (regla del repo) | F0, F9 | Bitácora antes y después. |
| `TODOS.md` | Diferible | F9 | Marcar ítems y anotar los pendientes de §7. |
| `Documento_Tecnico_Aplicacion_Predios.docx/.pdf` | Solo con commit `docs(reflect)` | F9 | Regenerar. |

**No se tocan:** `.clasp.json`, `appsscript.json` (salvo que se decida la §8-1), `export_pdf_backend.js`, `app_herramientas_js.html`, `app_core_js.html`, `cache_backend.js`, `permisos.js`, `config.js`, `pac_*`, `gestion_equipos_backend.js`.

---

## 6. Pruebas

### 6.1 Sin dominio IDU (local, el ejecutor puede hacerlas)
1. **Sintaxis:** `node scripts/lint-html-scripts.js motor_reglas.js evaluador_alertas.js Codigo.js app_alertas_js.html app_reglas_editor_js.html Index.html`. Solo se aceptan los fallos que ya había en la línea base de F0.
2. **Invariantes por grep** (en la raíz):
   - `rg -c "function obtenerReglasJSON|function guardarReglasJSON" *.js` → 1 y 1, en `motor_reglas.js`.
   - `rg -n "MotorReglas\b|evaluarAlertasDataset|programarReporte|programarEnvioAutomatico|modalEditarReglaVis" --glob "*.{js,html}"` → vacío (salvo el comentario de `gestion_equipos_backend.js:17`, que es aceptable).
   - `rg -o 'case "[A-Z_]+"' evaluador_alertas.js` → los 10 operadores, iguales a las claves de `OPERADORES_CONDICION_REGLAS`.
   - `rg -n "_exigirAdminMotorReglas_\(" *.js` → 1 definición + 6 llamadas.
3. **Arnés local fuera del repo** (D29): un archivo en `%TEMP%\arnes_reglas.js` que use `vm` de Node para cargar `evaluador_alertas.js` y `motor_reglas.js` con stubs mínimos (`getConfig`, `SpreadsheetApp`, `LockService`, `Utilities`, `Session`, `logAction`, `CalendarApp` lanzando error). Debe probar:
   - `_cumpleCondiciones` (con `Object.create(MotorEvaluadorReglas.prototype)` y `hoy` fijo), un caso verdadero y uno falso por cada uno de los 10 operadores, AND/OR, criterio suelto sin `criterios` y alias `columna_estado`/`valores_estado`.
   - `validarConfigReglas_`: operador desconocido → error; nombre duplicado → error; columna desconocida → advertencia, no error; nivel inválido → error.
   - `resumirAlertasActivasParaDashboard_` con una hoja falsa: filtra por el Set de RT y cuenta ROJO/NARANJA/AMARILLO.
   - `_evaluarReglaTiempo` con umbrales y `{DIAS}`.

   No se guarda en el repo. Se pega la salida en la bitácora de F9.
4. **Revisión estática de la UI:** cada `innerHTML` nuevo pasa por `escapeHtml`; no hay `let`/`const` de nivel superior duplicados entre partials.

### 6.2 Requieren la Web App (tras F10, con el usuario)
1. Admin abre Motor de Reglas: las tarjetas cargan; las reglas con `evaluacion_cruzada` muestran sus badges; la pestaña de fuentes muestra el aviso.
2. "Nueva Regla" carga los encabezados reales de `Datos` en la lista de columnas (comparar con la fila 1 de la hoja).
3. Crear una regla de tiempo de prueba (por ejemplo, "PRUEBA PLAN — borrar"), guardar y comprobar en `CONFIG_REGLAS!B1` que aparece con la forma canónica y que las demás reglas quedan intactas (diff contra el respaldo de F10).
4. Editar la regla, desactivarla desde la tarjeta y reactivarla.
5. Validaciones en cliente: columna vacía, operador desconocido pegado en el Modo JSON, JSON roto, nombre duplicado, umbrales desordenados. Cada caso debe bloquear con un mensaje claro.
6. Conflicto: dos pestañas de admin; guardar en una y luego en la otra → mensaje de conflicto y recarga.
7. "Forzar Evaluación": se genera `ALERTAS_ACTIVAS`; recargar el dashboard → los badges ROJO/NARANJA/AMARILLO coinciden con los KPI de la Bandeja (para Admin, sin Filtro Matriz); el badge del menú muestra el total; el toast informa las reglas no evaluables.
8. Con un usuario **Editor o Lector**: "Forzar Evaluación" no se ve; llamar `google.script.run.ejecutarEvaluadorAlertas()` desde la consola → `Requiere rol Administrador.` y una fila `EJECUTAR_MOTOR_REGLAS_DENEGADO` en los logs. Lo mismo con `guardarReglasJSON` y `procesarReporteAlertas`. El CSV local sí funciona.
9. Con un **Articulador**: el resumen del dashboard solo cuenta sus RT (D4); la bandeja sigue el filtro de proyectos (ver §8-2).
10. CSV local: las columnas "DIAS RESTANTES" y "ESTADO PREDIAL ACTUAL" traen datos; un mensaje con comillas no rompe la columna.
11. Página Permisos: sin los cuatro botones; la tabla de permisos sigue funcionando.
12. Trigger: tras `instalarTriggerMotorReglas()`, ejecutar el handler desde "Activadores → Ejecutar ahora" no es posible directamente; esperar a la ejecución de las 6:00 o crear un trigger temporal `.after(60*1000)` en staging y revisar en "Ejecuciones" que no hay error. `google.script.run.triggerDiarioMotorReglas({triggerUid:'x'})` desde la consola → `{success:false}`.
13. Tiempo: anotar en "Ejecuciones" la duración de `ejecutarEvaluadorAlertas`; si pasa de 3 min, registrarlo como riesgo (ver §9).
14. Registrar los tiempos y la evidencia en `DOCUMENTACION_TECNICA_VIVA.md`.

---

## 7. Fuera de alcance

- **Evaluación cruzada real** contra `FuentesDeDatos` (otros spreadsheets, llave de cruce). Se conserva el dato y no se ejecuta.
- **Operadores nuevos** (`GREATER_THAN`, rangos de fecha, etc.) y la corrección de las particularidades de los existentes (§9).
- **Envío automático de correos** desde el trigger (el antiguo "Programar Envío"). El trigger solo recalcula.
- **Optimizar** `_calcularDiasHabiles` (bucle día a día) y la carga de festivos, salvo lo que se decida en §8-1.
- **RBAC por RT en la bandeja** (ver §8-2): la bandeja conserva el filtro por proyecto.
- **"Probar regla" / vista de impacto en seco** antes de guardar.
- PAC (incluido su propio "Nueva Regla" en `pac_seccion.html`), Equipos, Normalización y el caché cliente IndexedDB del dashboard.
- Revisar qué más sube clasp (`MatrizSeguimiento_script/` y `scripts/*.js` no están en `.claspignore`): es una nota para el auditor, no un trabajo de esta entrega.

---

## 8. Decisiones cerradas por Fabian (2026-10-18)

1. **Festivos.** Se añade `https://www.googleapis.com/auth/calendar.readonly` en `appsscript.json`. Después del `clasp push` hay que reautorizar el script. Si Calendar sigue fallando, el motor usa lun–vie, no traga el error en silencio, y la UI dice que los festivos no se pudieron cargar.
2. **Bandeja.** Se acepta la diferencia: el tablero filtra por RT y la bandeja por proyecto visible. Una línea en la bandeja lo dice para Articulador y Gestor. No se recorta la bandeja.
3. **Correo y ejecución.** Solo Administrador guarda reglas, fuerza la evaluación, envía el correo e instala el trigger. Editor y Articulador conservan CSV y PDF.
4. **Dashboard sin corrida.** Si `ALERTAS_ACTIVAS` no existe o nunca se evaluó, el tablero muestra "Sin evaluar" y pide a un Administrador ejecutar el motor. Si hay corrida, muestra "Última evaluación: …". Si pasaron más de 36 horas, muestra un aviso. Nunca "Estado limpio" en ese caso.

---

## 9. Notas para el auditor

**Operadores de condición encontrados** (`evaluador_alertas.js`, `_cumpleCondiciones`, líneas 259–290), con su semántica real:

| Operador | Parámetros | Semántica literal del código | Particularidad (no se corrige) |
|----------|-----------|------------------------------|----------------------------|
| `EQUALS` | `valor` | `celda.toUpperCase().trim() === String(valor).toUpperCase()` | No hace trim de `valor`; una celda Date se compara como string largo |
| `NOT_EQUAL` | `valor` | lo inverso | ídem |
| `IN` | `valores[]` | celda ∈ valores (en mayúsculas) | si no es array → `false` |
| `NOT_IN` | `valores[]` | celda ∉ valores | si no es array → **`true` siempre** |
| `IS_NULL` | — | celda ∈ {"", "N/A", "-"} | "0" **no** es nulo |
| `IS_NOT_NULL` | — | celda ∉ {"", "0", "N/A"} | "-" **sí** cuenta como dato (asimétrico con IS_NULL) |
| `LESS_THAN` | `valor` | `parseFloat(celdaCruda) < parseFloat(valor)` | `$1.234` → NaN → false; no hay GREATER_THAN |
| `DATE_BEFORE_COLUMN` | `columna_destino` | fecha(columna) < fecha(columna_destino) | fechas vía `_parseFechaSegura` (dd/mm/aaaa) |
| `PERCENTAGE_BETWEEN_COLUMNS` | `columna_destino`, `min_pct`, `max_pct` | (parcial/total)·100 ∈ [min, max]; total 0 → false | `max_pct: 0` se vuelve 100 por `||` |
| `DAYS_PASSED_LESS_THAN` | `valor` | días desde la fecha hasta hoy **≤** valor | el nombre dice "<", el código hace "≤" |

Un operador desconocido cae en `default: return false`, en silencio. Por eso la validación de operador bloquea en cliente y en servidor. Alias que el motor acepta: `columna_estado | columna_A | columna`, `valores_estado | valores | valor`, `operador_estado | operador`. `operador_logico`: `"OR"` → `some`; cualquier otro valor → `every`.

**Riesgos y puntos a revisar:**
1. **Forma real del JSON en producción: desconocida.** No hay ejemplo en el repo. Por eso el constructor clona y conserva las claves que no gestiona (D6, D20), F10 exige respaldo previo y la prueba 6.2-3 compara contra ese respaldo.
2. **D13 (handler del trigger público + chequeo de `triggerUid`).** Se eligió en lugar de un handler con `_` final porque no está verificado que un trigger instalable pueda invocar una función privada. Si el auditor lo confirma, se puede simplificar.
3. **`Session.getEffectiveUser()` en el trigger** devuelve al instalador (el admin), que es el destinatario del correo de fallo. No depende de hojas PAC.
4. **El caché del dashboard** se invalida tras cada ejecución del motor (D27). El caché IndexedDB del cliente puede mostrar el resumen viejo hasta recargar: aceptado.
5. **Límite de 6 min:** `_calcularDiasHabiles` itera día a día por fila y por regla de tiempo. No se optimiza; se mide en 6.2-13.
6. **`alerta_bloqueo` se ignora si hay `regla_tiempo`** (línea 179). Mitigado con D19 en el constructor, pero el Modo JSON aún permite la combinación: el servidor no lo bloquea. ¿Debería ser advertencia del servidor? Es barato añadirlo en `validarConfigReglas_`.
7. **Deduplicación por `RT + nombre`:** D18 hace obligatoria la unicidad del nombre. Renombrar una regla cambia la llave, sin efecto persistente porque la hoja se reescribe completa en cada ejecución.
8. **Escala de niveles:** el ordenamiento de `_guardarAlertasEnHoja` usa `pesoNivel[a.NIVEL]`; un nivel fuera de la escala da `undefined` → orden `NaN`. La validación de nivel del servidor (F7) lo previene para JSON nuevo.
9. **`filePushOrder` vacío (D2):** el auditor debería confirmar que no queda ninguna sentencia de nivel superior que dependa de otro archivo tras F1/F2. `MAX_ALERTAS_PAYLOAD` y `OPERADORES_CONDICION_REGLAS` son `const` de nivel superior usados solo dentro de funciones.
10. **`.claspignore`:** `MatrizSeguimiento_script/` no está excluido y `skipSubdirectories:false`, así que posiblemente se sube al proyecto GAS. Ajeno a este plan, pero relevante para cualquier `clasp push`.
11. **El correo solo para admin (A5)** es un cambio de comportamiento para Editor y Articulador (ver §8-3).
12. **Tamaño de fases:** F8 es la más grande (~400 líneas nuevas + modal). Si el ejecutor es un modelo económico, conviene dividirla en F8a (markup + include + borrado del editor viejo) y F8b (lógica del partial). El criterio de hecho de F8 sirve para ambas.

## 10. Plan conjunto (vincula al ejecutor)

La auditoría (sección siguiente) dio **APROBAR CON CAMBIOS**. F0, F6, F9 y F10 se ejecutan como están. F1, F2, F3, F4, F5, F7 y F8 se ejecutan con estos ajustes, que ya no son opcionales:

1. **F1.** Si `guardarReglasJSON` ya tiene el lock, crear la hoja `CONFIG_REGLAS` sin pedir `getScriptLock()` otra vez. Si no hay reglas, el motor no debe dejar `ALERTAS_ACTIVAS` con filas de una corrida anterior: dejar la hoja con solo el encabezado y registrar el motivo.
2. **F2.** El resumen del dashboard devuelve `estado: SIN_EVALUAR | OK` y el texto `ultimaEvaluacion` tal como está en la hoja (no parsear el `TIMESTAMP` local). Sin corrida: "Sin evaluar" y pedir a un Administrador que ejecute el motor. Con corrida: "Última evaluación: …". Aviso si pasaron más de 36 horas. Nunca "Estado limpio" cuando no hubo evaluación.
3. **F3.** Si una regla tiene `regla_tiempo` y también `evaluacion_cruzada`, se evalúa el plazo y se ignora el cruce. El aviso dice "cruce ignorado; la regla se evalúa sin él". Contador aparte: `reglasConCruceIgnorado`.
4. **F4.** El trigger registra con `GestorAuditoria`, no con `logAction` (en un trigger el email de sesión sale vacío). Si escribir `ALERTAS_ACTIVAS` falla, la función del trigger debe fallar de verdad para que salga el correo de error. Quitar los cuatro botones de Permisos sigue siendo seguro.
5. **F5.** Al cerrar F5 hay 5 llamadas a la guarda de admin. La sexta (`obtenerMetadatosEditorReglas`) aparece en F7. Confirmado: solo Administrador guarda, fuerza la evaluación y envía el correo. En F4/F7 se añade el scope `calendar.readonly`; el push de F10 exige reautorizar.
6. **F7 y F8.** Prohibido guardar una regla con `condiciones.criterios` vacío o con un bloque de excepción vacío: hoy eso haría que la regla dispare en todas las filas, o que la excepción anule todas las alertas. Exigir umbral con mensaje, columnas contra los encabezados reales, y rechazar un JSON de más de 49.000 caracteres. El MD5 a hex tiene que tratar los bytes con signo. Una regla mala no puede tumbar todo el motor: cada regla va en su propio try/catch. El constructor se parte en F8a (formulario y validación) y F8b (editar reglas ya guardadas, criterios anidados solo en Modo JSON).
7. **Criterios de "hecho".** En PowerShell no usar `*.js` suelto. Para comprobar que `MotorReglas` desapareció, buscar `class MotorReglas`, `globalThis.MotorReglas`, `new MotorReglas` y `evaluarAlertasDataset`. No buscar la palabra `MotorReglas` a secas: el trigger nuevo y el PAC también la contienen.

El ejecutor barato no amplía alcance, no hace `clasp push` y no toca otro script que no sea `18vY9…`.

## GSTACK REVIEW REPORT

> Auditor: Claude Sonnet (Cursor), 2026-10-18. Alcance: validación del plan contra el código real. No se implementó código, no se usó `clasp`, `.clasp.json` verificado sin cambios (`scriptId` = `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`). Las secciones 1–9 no se modificaron.
> Limitación del entorno: el shell no pudo ejecutarse (sandbox sin backend en Windows), así que `graphify explain/query` y `git status` **no corrieron**. Todo se verificó con lectura directa (Read/Grep). Los números de línea se contrastaron contra los archivos actuales. No tengo visibilidad de las respuestas del usuario a las preguntas A1–A7; abajo distingo lo que el propio plan declara como pedido por el usuario.

| Run | Status | Findings |
|-----|--------|----------|
| R1 `graphify explain "obtenerReglasJSON"` y `graphify query ...` | FALLÓ (entorno) | Terminal no disponible; se continuó con lectura directa, como permitía la instrucción. |
| R2 Existencia de funciones y líneas citadas (F1–F8) | OK con 1 matiz | Todas las funciones y líneas del plan existen y casi todas coinciden (`obtenerReglasJSON`/`guardarReglasJSON` duplicadas en `motor_reglas.js:8,49` y `evaluador_alertas.js:8,49`; `Codigo.js:537`; `evaluador_alertas.js:179,514–623`; `Index.html:94,524,886–898,938–940,960,975,994,1007–1054,1908`; `app_alertas_js.html:54–55,70,114,720–746,892–918`; `config.js:183`; `cache_backend.js:138`; `app_core_js.html:57,438`). Matiz: los typedef/clase de `MotorReglas` empiezan en la línea ~85 (clase en 121, `globalThis` en 331), no exactamente en 88. Ninguna función del plan es falsa. |
| R3 Call sites de `MotorReglas` / `evaluarAlertasDataset` | OK | Único consumidor real: `Codigo.js:537` (`getDashboardData`). `motor_reglas.js` y `evaluador_alertas.js` los definen; `gestion_equipos_backend.js:17` es solo comentario. `ejecutarEvaluadorAlertas` solo se llama desde `app_alertas_js.html:359`; `procesarReporteAlertas` desde `app_alertas_js.html:886`. Quitarlos **no rompe** otra llamada, siempre que se cambie la línea 537 y el fallback del catch (`Codigo.js:577–585`). `app_alertas_js.html` (líneas 208, 222–267, 306) también consume la escala vieja y el plan lo cubre en F2. |
| R4 Guarda de administrador | OK | Coincide con el sistema: `GestorPermisos.validarPermiso('ADMIN_SISTEMA')` (`permisos.js:293`), solo `Administrador` lo tiene (`config.js:183`); ya se usa en `initializeSystem` (`Codigo.js:1381`). `pac_verificarRolAdmin` (`pac_api.js:346`) usa el mismo mecanismo con `'PAC_APROBAR'` (mismo conjunto: solo Administrador). El plan **no inventa** mecanismo. Matiz: `export_pdf_backend.js:273,305` usa `'REPORTES'` (todos los roles), no es precedente de guarda de admin; el precedente correcto es `initializeSystem`/`obtenerUrlNormalizacion`. |
| R5 Operadores vs `_cumpleCondiciones` | OK | Los 10 operadores del plan = los 10 `case` del `switch` (`evaluador_alertas.js:260–288`). Faltan **dos particularidades** en §9 (ver hallazgos H2 y H7). |
| R6 UI huérfana en Permisos | OK | El `div.page-actions` de `#page-permisos` (`Index.html:885–899`) contiene solo esos cuatro botones y no hay otro control en él. `programarReporte` solo se usa en `Index.html:893`; `programarEnvioAutomatico` **no existe** en ningún `.js` (solo se invoca en `app_alertas_js.html:917`): borrarlo es seguro. Las tres acciones válidas siguen en `#page-alertas` (`Index.html:524–531`). |
| R7 Dashboard desde `ALERTAS_ACTIVAS` (F2) | HALLAZGO DE PRODUCTO | Con la hoja inexistente o nunca evaluada el dashboard muestra 0 alertas y el modal dice "Estado limpio" (`app_alertas_js.html:301–303`): **miente**. Ver B1. |
| R8 Alcance script 18vY9 / PAC | OK | Ninguna fase toca `pac_*.js` ni `pac_seccion.html`; el `Nueva Regla` de PAC (`pac_seccion.html:239`, `pac_abrirMotorReglas`) queda fuera. Trigger propio separado de `instalarTriggersPAC`. Todo el trabajo es sobre el script `18vY9…` (`.clasp.json` correcto). |
| R9 Ejecutable por modelo más barato | AJUSTAR | Varias instrucciones ambiguas o con criterios de "hecho" que fallarán (ver B3 y lista de ambigüedades). |
| R10 Complejidad | OK, justificada | 6 archivos de código (< 8) + bitácora obligatoria; `TODOS.md` y docx/pdf son opcionales/condicionales. El partial nuevo `app_reglas_editor_js.html` se justifica (CONC-FE-02). 29 decisiones es mucho, pero las de D1–D5/D9–D15 sostienen el cambio; F8 debe dividirse (F8a/F8b), como ya sugiere §9.12. |

**VERDICT: APROBAR CON CAMBIOS**

**Veredicto por fase**

| Fase | Veredicto | Ajuste concreto |
|------|-----------|-----------------|
| F0 | ACEPTAR | Sin cambios. Anotar que los comandos `rg`/`node` se ejecutan en PowerShell (ver ambigüedades). |
| F1 | AJUSTAR | (a) `guardarReglasJSON` ya tiene el script lock tomado; llamar a `_obtenerHojaConfigReglas_(ss, true)`, que vuelve a tomar `getScriptLock()`, contradice D14 y puede esperar 20 s. Dentro de `guardarReglasJSON`, si la hoja falta, crearla sin pedir el lock otra vez (parámetro `yaTieneLock`). (b) En `ejecutarMotor`, el caso "no hay reglas / `{}`" retorna sin tocar `ALERTAS_ACTIVAS` (línea 113–116): quedan alertas viejas; indicar si se limpia o se deja y se documenta. |
| F2 | AJUSTAR | Hacer que `resumirAlertasActivasParaDashboard_` devuelva `estado: 'SIN_EVALUAR' \| 'OK'` y `ultimaEvaluacion`, y que la UI muestre "Sin evaluar — pida a un Administrador ejecutar el motor" en vez de "Estado limpio" (ver B1). Además: `TIMESTAMP` se escribe con `toLocaleString('es-CO')` (`evaluador_alertas.js:427`), no es ISO; hay que exponerlo como texto, no parsearlo. El motor solo lee `DATA_FILES.PRINCIPAL`, mientras `getDashboardData` itera varios archivos (`Codigo.js:260`): registros de archivos secundarios dejan de tener alertas (documentar). Corregir el grep de "Hecho cuando" (B3). |
| F3 | AJUSTAR | La línea 179 solo suprime `alerta_bloqueo`; una regla con `regla_tiempo` + `evaluacion_cruzada` **sí dispara** ignorando el cruce. El badge "Evaluación cruzada: no se evalúa" debe decir "cruce ignorado; la regla se evalúa sin él" en ese caso, y `reglasNoEvaluables` no la cuenta (correcto), pero conviene un contador aparte `reglasConCruceIgnorado`. |
| F4 | AJUSTAR | (a) `logAction` **ignora** su primer parámetro y usa `Session.getActiveUser().getEmail()` (`Codigo.js:1162–1166`); en un trigger ese email suele ir vacío: el log queda sin actor. Usar `GestorAuditoria().registrarAccion('SISTEMA', …)` directamente en el trigger. (b) `_guardarAlertasEnHoja` captura sus errores y `ejecutarMotor` devuelve `success:true` aunque la escritura falle (`evaluador_alertas.js:451–453`): un trigger puede fallar en silencio. Hacer que `_guardarAlertasEnHoja` devuelva `true/false` o relance, para que el correo de fallo del trigger se dispare. (c) Quitar los 4 botones de Permisos es seguro (R6). |
| F5 | AJUSTAR | El "Hecho cuando" (`_exigirAdminMotorReglas_(` = 6 llamadas) falla al cerrar F5: la sexta (`obtenerMetadatosEditorReglas`) se crea en F7. Decir "5 llamadas al cerrar F5, 6 al cerrar F7". Aclarar que `Forzar Evaluación` también deja de estar disponible para Editor/Articulador (hoy cualquier rol puede ejecutarlo y, desde consola, guardar reglas). |
| F6 | ACEPTAR | Correcto: la hoja usa `DIAS RESTANTES` y `ESTADO PREDIAL ACTUAL` (`evaluador_alertas.js:412`) y el CSV lee `a.DIAS_RESTANTES`/`a.ESTADO_PREDIAL` (`app_alertas_js.html:731–733`). |
| F7 | AJUSTAR | (a) `Utilities.computeDigest` devuelve bytes **con signo**; indicar la conversión a hex (`(b < 0 ? b + 256 : b).toString(16).padStart(2,'0')`). (b) Una celda admite como máximo 50.000 caracteres: `JSON.stringify(cfg, null, 4)` infla el JSON; el servidor debe rechazar `jsonString.length > 49000` con mensaje claro y el constructor debe guardar con sangría 2 o compacto. (c) El validador debe exigir: `umbrales[].mensaje` string no vacío (`_evaluarReglaTiempo` hace `mensaje.includes`, línea 337, y aborta **todo** el motor si falta), `umbrales` array no vacío, y `condiciones.criterios`/bloques de `excepciones` con al menos 1 criterio (B2). (d) Validar también `columna_fecha_inicio` y `columna_destino` contra los encabezados (el motor los indexa en mayúsculas exactas, sin alias). (e) Ver H2 para `valor: 0`. (f) Envolver cada regla en try/catch dentro de `ejecutarMotor` para que una regla mala no deje `ALERTAS_ACTIVAS` obsoleta: es 5 líneas y no cambia la semántica. |
| F8 | AJUSTAR | (a) **B2:** el constructor inicializa `criterios: []` y no obliga a ≥1 criterio. (b) Criterios anidados (un criterio con su propio `criterios`) no los soporta `_cumpleCondiciones`; si `normalizarCriterioParaEditor` encuentra uno, la regla debe abrirse como "solo Modo JSON". (c) Si una regla de producción trae `regla_tiempo` **y** `alerta_bloqueo` (el segundo se ignora hoy), el plan no dice qué radio se marca ni si al guardar se borra `alerta_bloqueo`: especificar (marcar "Por plazo", mostrar aviso y borrar `alerta_bloqueo` solo tras confirmar). (d) Dividir en F8a/F8b como en §9.12. |
| F9 | ACEPTAR | Sin cambios. |
| F10 | ACEPTAR | Añadir al aviso de §9.10 que `normalizacion_script/` (incluido `prueba.js`) y `debug_temp.js` en la raíz tampoco están en `.claspignore` y también se suben; confirmar con el usuario antes del push. |

**Hallazgos bloqueantes** (corregir el plan antes de entregarlo al ejecutor)

- **B1 — F2 deja el dashboard vacío o mentiroso.** Antes el dashboard calculaba en vivo (`Codigo.js:537`); después depende de que alguien haya ejecutado el motor. Si `ALERTAS_ACTIVAS` no existe, está vacía, o el trigger de 6:00 aún no se instaló (el plan lo deja manual), el modal dice "Estado limpio: no hay alertas activas" (`app_alertas_js.html:301–303`), contradiciendo §1.3 "La UI deja de mentir". También hay obsolescencia: ningún guardado de seguimiento recalcula alertas. Ajuste mínimo: `resumirAlertasActivasParaDashboard_` devuelve `estado` y `ultimaEvaluacion`; la UI muestra "Sin evaluar" / "Última evaluación: …" (y aviso si supera ~36 h). Es una decisión de producto (ver abiertas).
- **B2 — Reglas vacías peligrosas.** `_cumpleCondiciones` con `criterios: []` y `operador_logico` AND devuelve `true` (`[].every`): la regla dispara en **todas** las filas; en un bloque de `excepciones` con `criterios: []` anula **todas** las alertas de la regla. El constructor crea reglas nuevas con `criterios: []` (F8) y el validador (F7/D22) no lo prohíbe. Exigir ≥1 criterio en `condiciones` y en cada bloque de excepción (cliente y servidor).
- **B3 — Criterios "Hecho cuando" que fallan y harían divagar al ejecutor.** `rg "MotorReglas\b"` coincide también con `instalarTriggerMotorReglas`, `eliminarTriggerMotorReglas`, `triggerDiarioMotorReglas` (se crean en F4) y con `pac_abrirMotorReglas`/`pac_renderMotorReglas` en `pac_seccion.html`; el invariante de §6.1-2 y el "Hecho cuando" de F2 nunca darán vacío. Usar `class MotorReglas\b|globalThis\.MotorReglas|new MotorReglas\b|evaluarAlertasDataset`. Además, en PowerShell `rg ... *.js` no expande el comodín: usar `rg -c "…" --glob "*.js"`. Y el conteo de F5 (ver tabla).

**Hallazgos no bloqueantes**

- H1. `ejecutarMotor` devuelve `success:true` aunque `_guardarAlertasEnHoja` falle (F4a). `hojaAlertas.clear()` se ejecuta antes de reescribir, así que un fallo deja la hoja vacía.
- H2. Particularidad no documentada en §9: `valorEsperado = valores_estado || valores || valor` (`evaluador_alertas.js:257`); un `valor: 0` (o `""`) es falsy y se ignora, así que `LESS_THAN 0` y `DAYS_PASSED_LESS_THAN 0` evalúan `NaN` → `false`, y `EQUALS 0` compara con `"UNDEFINED"`. El constructor debe bloquear `valor` vacío y avisar con `0` (o guardar `"0"` como texto para EQUALS).
- H3. D13 (handler público + `triggerUid`): `triggerUid` sí viaja en el evento de un trigger de tiempo y `script.scriptapp` está en `appsscript.json`. Es aceptable; si una invocación falsa acierta un UID real solo recalcula la hoja (sin correos, salvo el de fallo al administrador). No verifiqué si un trigger puede invocar una función privada (`_`); dejar D13 como está.
- H4. D2 (no tocar `filePushOrder`): revisé los archivos que el plan toca; no hay sentencias de nivel superior que dependan de otro archivo, y ninguno de los nombres nuevos (`OPERADORES_CONDICION_REGLAS`, `NIVELES_ALERTA_REGLAS`, `TIPOS_DIAS_REGLAS`, etc.) existe ya en el repo (sin colisiones). No audité los 57 archivos completos.
- H5. El caché IndexedDB del cliente (`dashboardData_<email>`) puede traer `alertasResumen` con la escala vieja `{CRITICA…}`; el nuevo render lo mostrará en 0 hasta recargar. Aceptado en §9.4, solo anotarlo en el "Hecho cuando" de F2 para que no se tome por bug.
- H6. D22: la advertencia de columna desconocida debe comparar exactamente contra la lista en mayúsculas; así detecta reglas de producción con columnas en minúsculas, que el motor nunca encuentra (`filaMatriz[columna]` con claves en mayúsculas).
- H7. D20/§9: el motor aplica `umbrales.sort` de menor a mayor `dias_restantes` y elige el primero que cumple; la regla "ROJO < NARANJA < AMARILLO" de D22 es correcta, pero debe permitir valores negativos (vencidos). `replace("{DIAS}")` solo reemplaza la primera ocurrencia: anotarlo.
- H8. Etiqueta de `PERCENTAGE_BETWEEN_COLUMNS`: la semántica es `(columna ÷ columna_destino) × 100`; la etiqueta propuesta es ambigua. Sugerida: "(Columna ÷ otra columna) × 100 entre min y max".
- H9. D10 afirma que `export_pdf_backend.js:273,305` es el patrón de guarda; usa `'REPORTES'` (todos los roles). No cambia el diseño, solo la cita.

**Ambigüedades para un modelo más barato (corregir o aclarar en el plan)**

- Comandos `rg` con comodines `*.js` / `*.{js,html}` y `\|`: dar la forma PowerShell/`--glob`.
- F1.2: "conserva tal cual el lock" y D14 "sin lock externo" se contradicen (ver F1).
- F2.1: no dice cómo ordenar dentro del mismo nivel ni qué hacer cuando `RT` es numérico en la hoja (usar `String(...).trim()` en ambos lados).
- F4: "mensaje escapado" del correo sin indicar qué función usar; existe `_escapeHtmlAlertaEmail` en `Codigo.js` pero es de otro módulo.
- F7: "hex" de MD5 sin conversión de bytes con signo; "helper compartido" sin firma.
- F8: "pinta el formulario" sin nombrar funciones de render por sección; no especifica el orden de inicialización del `<datalist id="dlFasesReglas">` ni qué pasa si `metadatosEditorReglas` falla (¿se bloquea el constructor o se permite escribir columnas libres?). Recomendado: bloquear con mensaje.
- §6.1-3: el arnés en `%TEMP%` carga archivos con `vm` pero `evaluador_alertas.js` usa `class`/`const` de nivel superior; en `vm.runInContext` hay que evaluar ambos archivos en el mismo contexto y exponer las clases (`vm.runInContext('MotorEvaluadorReglas', ctx)`), porque `class`/`const` no quedan como propiedades del contexto.

**Decisiones abiertas del plan (§8) y decisiones nuevas**

- Ya contestadas por el usuario según el propio plan (A1–A7): fuente única `ALERTAS_ACTIVAS`; constructor gráfico; conservar y marcar `evaluacion_cruzada`/`FuentesDeDatos` (A3, D6); trigger diario sin correos; solo Administrador guarda/ejecuta/envía (A5, "Está pedido"); quitar "Programar Envío" y arreglar el CSV (A6/A7). No las reabro.
- §8-1 (festivos / scope Calendar): **real**. Confirmado en `appsscript.json`: hay `oauthScopes` explícitos y **no** incluye Calendar, por lo que `CalendarApp` falla y el `catch` (`evaluador_alertas.js:472–474`) lo traga; HÁBILES = solo lun–vie. El default del plan (rotular "Hábiles (lun–vie, sin festivos)" y dejar el scope para otra entrega) es seguro y reversible; el ejecutor puede aplicarlo si el usuario no responde.
- §8-2 (RBAC bandeja vs dashboard): **real pero de bajo riesgo**. Default del plan (aceptar y documentar la diferencia para Articulador/Gestor) es seguro.
- §8-3 (correo solo Administrador): **real, requiere confirmación explícita**, porque cambia el trabajo diario de Editor/Articulador y también retira `Forzar Evaluación` a esos roles (hoy cualquier rol puede ejecutarlo). Alternativa del plan: `REPORTES` para correo y `ADMIN_SISTEMA` para guardar/ejecutar.
- **Nueva (B1):** qué debe mostrar el dashboard cuando `ALERTAS_ACTIVAS` no existe, está vacía por no haberse evaluado, o tiene más de ~36 h. Es decisión de producto; el plan no la contempla.

VERDICT: APROBAR CON CAMBIOS

Decisiones de Fabian, 2026-10-18: solo Administrador en correo y evaluación; dashboard "Sin evaluar" / última corrida / aviso a las 36 h; scope Calendar para festivos; bandeja por proyecto, documentada, sin recortar por RT. Quedan aplicadas en las secciones 8 y 10.

NO UNRESOLVED DECISIONS
