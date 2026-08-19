'use strict';

/**
 * Motor backend de asignación de equipos y auditoría dedicada — Sprint 5 [CONC-BE-07],
 * desacoplado de `Datos` en Sprint 6 [CONC-BE-12].
 *
 * Desde Sprint 6, `Datos` es 100% LECTURA — nunca se escribe en `ARTICULADOR JUIRIDICO` ni
 * `GESTOR JURÍDICO` ahí. Toda asignación/reasignación se escribe en la hoja dedicada
 * `ASIGNACIONES_EQUIPOS` (`[RT, ARTICULADOR_EMAIL, GESTOR_EMAIL, FECHA_ACTUALIZACION,
 * EJECUTOR]`, clave primaria RT), vía el único punto de escritura `_upsertAsignacionesEquipos()`.
 * Todo lo que necesita saber "quién tiene qué RT hoy" (tableros, árbol, RBAC, alertas) fusiona
 * en memoria `Datos` (base/legado, incluye lo que ya escribió la Línea Cero antes de este
 * desacople) con `ASIGNACIONES_EQUIPOS` (capa viva) vía `_fusionarAsignacionesConMatriz()` —
 * el overlay gana cuando hay valor, Datos es el fallback. `_fusionarAsignacionesConMatriz()`
 * y `_leerAsignacionesEquipos()` son funciones globales a propósito (mismo scope compartido
 * de Apps Script): también las usan `Codigo.js` (`getDashboardData()`, RBAC) y
 * `evaluador_alertas.js` (`evaluarAlertasDataset()`, enrutamiento de alertas).
 *
 * Toda escritura sigue bajo LockService + una sola llamada setValues() por columna afectada
 * (Directiva 3): se lee la columna completa una vez, se parcha en memoria por lotes de 1000,
 * se reescribe en un único setValues() — nunca N escrituras individuales sobre filas dispersas.
 */

const EQUIPOS_ENGINE = {
  batchSize: 1000,
  // 60s en vez de los 30s de permisos.js/eliminarPermiso(): reasignarUsuarioMasivo() y
  // asignarEquipoGranularLote() pueden tocar cientos/miles de filas bajo el mismo lock.
  lockTimeoutMs: 60000
};

const REGEX_EMAIL_SIMPLE_EQUIPOS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ✅ [CONC-BE-15]: dominio institucional — usado en ejecutarCargaLineaCero() como
// verificación directa e independiente de obtenerMapeoLineaCero(). Si Datos ya trae un
// email @idu.gov.co en Articulador/Gestor, se usa tal cual sin pasar por el mapeo de
// homologación — defensa en profundidad: el mapeo YA reconoce este caso (ver
// _mejorCoincidenciaUsuario en homologacion_usuarios.js), pero esta función no debe
// depender de esa ruta para garantizar la dupla oficial cuando el dato ya es correcto.
const REGEX_EMAIL_IDU_LINEA_CERO = /^[^\s@]+@idu\.gov\.co$/i;

/**
 * Regla estricta de completitud (Sprint 6, feedback de usuario): un RT solo cuenta como
 * asignado si TIENE Articulador Y Gestor — falta cualquiera de los dos y cuenta como
 * "sin asignar". Es exactamente la misma regla en getEstadisticasCargaEquipos(),
 * getProyectosConteo(), getTramosPorProyecto() y getRTsPorTramo() porque las 4 comparten
 * la misma fuente (_leerFilasVisiblesRBACEquipos()) — así los badges de Proyecto/Tramo
 * siempre coinciden exactamente con la suma de las filas del árbol, por construcción.
 */
function _esRTCompleto(articuladorEmail, gestorEmail) {
  return Boolean(
    articuladorEmail && gestorEmail &&
    articuladorEmail !== 'Sin asignar' && gestorEmail !== 'Sin asignar'
  );
}

function _asegurarHojaAsignacionesEquipos(gestor, sheetName) {
  let sheet = gestor.ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = gestor.ss.insertSheet(sheetName);
  const headers = getConfig('COLUMNS_ASIGNACIONES_EQUIPOS');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#2c3e50')
    .setFontColor('white')
    .setFontWeight('bold');
  return sheet;
}

/**
 * Lee ASIGNACIONES_EQUIPOS completa en un diccionario {RT: {articuladorEmail, gestorEmail}}.
 * Crea la hoja con headers si todavía no existe (primera vez que corre cualquier función de
 * este archivo después del desacople).
 */
function _leerAsignacionesEquipos() {
  const gestorAsig = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
  const sheetName = getConfig('SHEETS.ASIGNACIONES_EQUIPOS', 'ASIGNACIONES_EQUIPOS');
  _asegurarHojaAsignacionesEquipos(gestorAsig, sheetName);
  const { rows } = gestorAsig.leerDatos(sheetName);

  const mapa = {};
  rows.forEach(function(row) {
    const rt = String(row['RT'] || '').trim();
    if (!rt) return;
    mapa[rt] = {
      articuladorEmail: String(row['ARTICULADOR_EMAIL'] || '').trim(),
      gestorEmail: String(row['GESTOR_EMAIL'] || '').trim()
    };
  });
  return mapa;
}

/**
 * Fusión en memoria — el corazón del desacople. Para un RT dado, el valor EFECTIVO de
 * Articulador/Gestor es el de ASIGNACIONES_EQUIPOS si existe ahí; si no, el que ya tenía
 * Datos (compatibilidad con lo que la Línea Cero ya escribió ahí antes de este desacople).
 * Global a propósito — Codigo.js y evaluador_alertas.js la llaman directo (mismo scope GAS).
 */
function _fusionarAsignacionesConMatriz(rt, articuladorDatos, gestorDatos, asignacionesMap) {
  const rtKey = String(rt || '').trim();
  const override = rtKey ? asignacionesMap[rtKey] : null;

  const articuladorEmail = (override && override.articuladorEmail)
    ? override.articuladorEmail
    : String(articuladorDatos || '').trim();
  const gestorEmail = (override && override.gestorEmail)
    ? override.gestorEmail
    : String(gestorDatos || '').trim();

  return {
    articuladorEmail: articuladorEmail,
    gestorEmail: gestorEmail,
    articuladorEsEmail: REGEX_EMAIL_SIMPLE_EQUIPOS.test(articuladorEmail),
    gestorEsEmail: REGEX_EMAIL_SIMPLE_EQUIPOS.test(gestorEmail)
  };
}

/**
 * Lee Datos (SOLO LECTURA) una vez, fusiona cada fila con ASIGNACIONES_EQUIPOS, y aplica el
 * recorte RBAC (Articulador solo sus filas, Gestor las suyas + las de su(s) Articulador(es)).
 * Fuente compartida de getEstadisticasCargaEquipos()/getProyectosConteo()/
 * getTramosPorProyecto()/getRTsPorTramo() — garantiza que KPIs y árbol siempre coincidan.
 */
function _leerFilasVisiblesRBACEquipos() {
  const gestorDatos = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
  const { headers, rows } = gestorDatos.leerDatos(getConfig('SHEETS.DATOS'));
  if (!headers.length) throw new Error('No se pudo leer la hoja Datos');

  const idxProyecto = findColumnIndex(headers, getConfig('COLUMNS.PROYECTO'));
  const idxTramo = findColumnIndex(headers, getConfig('COLUMNS.TRAMO'));
  const idxRT = findColumnIndex(headers, getConfig('COLUMNS.RT'));
  const idxArticulador = findColumnIndex(headers, getConfig('COLUMNS.ARTICULADOR_JURIDICO'));
  const idxGestor = findColumnIndex(headers, getConfig('COLUMNS.GESTOR_JURIDICO'));

  if (idxProyecto < 0 || idxTramo < 0 || idxRT < 0 || idxArticulador < 0 || idxGestor < 0) {
    throw new Error('Columnas requeridas (PROYECTO/TRAMO/RT/ARTICULADOR/GESTOR) no encontradas en Datos');
  }

  const colProyecto = headers[idxProyecto];
  const colTramo = headers[idxTramo];
  const colRT = headers[idxRT];
  const colArticulador = headers[idxArticulador];
  const colGestor = headers[idxGestor];

  const asignacionesMap = _leerAsignacionesEquipos();

  const currentUserEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const rolUsuario = getUserRole(currentUserEmail) || getConfig('ROLES.LECTOR');
  const esArticulador = rolUsuario === getConfig('ROLES.ARTICULADOR');
  const esGestor = rolUsuario === getConfig('ROLES.GESTOR');

  // Una sola pasada de fusión sobre todas las filas — se reutiliza tanto para el pre-cálculo
  // de "qué Articuladores tiene este Gestor" como para el filtrado principal de abajo.
  const fusionadas = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rt = String(row[colRT] || '').trim();
    const fusion = _fusionarAsignacionesConMatriz(rt, row[colArticulador], row[colGestor], asignacionesMap);
    fusionadas[i] = {
      proyecto: String(row[colProyecto] || '').trim() || 'SIN PROYECTO',
      tramo: String(row[colTramo] || '').trim() || 'SIN TRAMO',
      rt: rt,
      articulador: fusion.articuladorEmail,
      articuladorEsEmail: fusion.articuladorEsEmail,
      gestor: fusion.gestorEmail,
      gestorEsEmail: fusion.gestorEsEmail,
      esCompleto: _esRTCompleto(fusion.articuladorEmail, fusion.gestorEmail)
    };
  }

  let articuladoresPermitidosGestor = null;
  if (esGestor) {
    articuladoresPermitidosGestor = new Set();
    for (let i = 0; i < fusionadas.length; i++) {
      if (fusionadas[i].gestor.toLowerCase() === currentUserEmail && fusionadas[i].articulador) {
        articuladoresPermitidosGestor.add(fusionadas[i].articulador.toLowerCase());
      }
    }
  }

  const filas = [];
  for (let i = 0; i < fusionadas.length; i++) {
    const f = fusionadas[i];
    if (esArticulador && f.articulador.toLowerCase() !== currentUserEmail) continue;
    if (esGestor) {
      const visible = f.gestor.toLowerCase() === currentUserEmail ||
        (articuladoresPermitidosGestor && articuladoresPermitidosGestor.has(f.articulador.toLowerCase()));
      if (!visible) continue;
    }
    filas.push(f);
  }

  return filas;
}

/**
 * ✅ [CONC-FE-13]: endpoint público que alimenta los selectores reactivos del modal de
 * Asignación Granular (Articulador -> Gestor en cascada, ver app_equipos_js.html). Reutiliza
 * el mismo lector de USUARIOS que ya usa el motor de homologación (_leerDirectorioUsuariosSheet()
 * / _esActivo(), homologacion_usuarios.js — funciones globales, mismo scope de Apps Script),
 * filtrado a solo usuarios activos con rol Articulador o Gestor. Separado de getUserRoles()/
 * getDashboardData() porque este roster es un catálogo estático para poblar <select>, no datos
 * operativos filtrados por RBAC del usuario que lo pide.
 */
function getUsuariosParaAsignacionEquipos() {
  try {
    const directorio = _leerDirectorioUsuariosSheet();
    const rolArticulador = getConfig('ROLES.ARTICULADOR');
    const rolGestor = getConfig('ROLES.GESTOR');
    const activos = directorio.filter(_esActivo);

    function porNombre(a, b) { return a.nombre.localeCompare(b.nombre); }
    function proyectarUsuario(u) { return { email: u.email, nombre: u.nombre, componente: u.componente }; }

    const articuladores = activos.filter(function(u) { return u.rol === rolArticulador; }).map(proyectarUsuario).sort(porNombre);
    const gestores = activos.filter(function(u) { return u.rol === rolGestor; }).map(proyectarUsuario).sort(porNombre);

    return { success: true, articuladores: articuladores, gestores: gestores };
  } catch (e) {
    console.error('❌ Error en getUsuariosParaAsignacionEquipos: ' + e.message);
    return { success: false, error: e.message, articuladores: [], gestores: [] };
  }
}

/**
 * ✅ [CONC-FE-17]: alta rápida de funcionario in-line desde el modal de Asignación
 * Granular ("+ Crear Funcionario") — evita que el usuario tenga que salir a editar
 * USUARIOS manualmente cuando necesita asignar a alguien que aún no está en el catálogo.
 *
 * Mapea la nueva fila por NOMBRE DE COLUMNA leído en vivo de la hoja (findColumnIndex()),
 * NUNCA por posición fija — a diferencia de un array literal `[email, nombre, 'SI', ...]`,
 * esto no depende de que el orden real de columnas de USUARIOS coincida con ningún supuesto
 * hardcodeado (mismo principio que el resto del proyecto, CLAUDE.md: "evitar IDs hardcodeadas,
 * usar CONFIG"). Si la hoja tiene alguna columna de fecha de alta (cualquier header que
 * contenga "FECHA"), se rellena con la fecha actual; si no existe, se omite sin error.
 */
function crearUsuarioRapidoBackend(nombre, email, rol, componente) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (eLock) {
    return { success: false, error: 'No se pudo adquirir el lock: ' + eLock.message };
  }

  try {
    const nombreLimpio = String(nombre || '').trim();
    const emailLimpio = String(email || '').trim().toLowerCase();
    const rolLimpio = String(rol || '').trim();
    const componenteLimpio = String(componente || '').trim().toUpperCase();

    if (!nombreLimpio) throw new Error('El nombre es obligatorio.');
    if (!/^[^\s@]+@idu\.gov\.co$/i.test(emailLimpio)) {
      throw new Error('El email debe pertenecer al dominio @idu.gov.co.');
    }

    const rolesValidos = [getConfig('ROLES.ARTICULADOR'), getConfig('ROLES.GESTOR')];
    if (rolesValidos.indexOf(rolLimpio) < 0) {
      throw new Error('Rol inválido: "' + rolLimpio + '". Debe ser ' + rolesValidos.join(' o ') + '.');
    }
    const componentesValidos = ['DTDP', 'STAP'];
    if (componentesValidos.indexOf(componenteLimpio) < 0) {
      throw new Error('Componente inválido: "' + componenteLimpio + '". Debe ser ' + componentesValidos.join(' o ') + '.');
    }

    const usuariosFileId = getConfig('DATA_FILES.USUARIOS');
    if (!usuariosFileId) throw new Error('CONFIG.DATA_FILES.USUARIOS no está configurado.');

    const gestorUsuarios = new GestorDatos(usuariosFileId);
    const sheetName = getConfig('SHEETS.USUARIOS', 'USUARIOS');
    const { headers, rows } = gestorUsuarios.leerDatos(sheetName);
    if (!headers.length) throw new Error('No se pudo leer la hoja USUARIOS.');

    const yaExiste = rows.some(function(r) {
      return String(r['EMAIL'] || '').trim().toLowerCase() === emailLimpio;
    });
    if (yaExiste) throw new Error('Ya existe un usuario con ese email en USUARIOS: ' + emailLimpio);

    const idxEmail = findColumnIndex(headers, 'EMAIL');
    const idxNombre = findColumnIndex(headers, 'NOMBRE');
    const idxActivo = findColumnIndex(headers, 'ACTIVO');
    const idxComponente = findColumnIndex(headers, 'COMPONENTE');
    const idxRol = findColumnIndex(headers, 'ROL');
    const idxFecha = findColumnIndex(headers, 'FECHA');

    if (idxEmail < 0 || idxNombre < 0 || idxActivo < 0 || idxComponente < 0 || idxRol < 0) {
      throw new Error('La hoja USUARIOS no tiene el esquema esperado (EMAIL/NOMBRE/ACTIVO/COMPONENTE/ROL).');
    }

    const fila = new Array(headers.length).fill('');
    fila[idxEmail] = emailLimpio;
    fila[idxNombre] = nombreLimpio;
    fila[idxActivo] = 'SI';
    fila[idxComponente] = componenteLimpio;
    fila[idxRol] = rolLimpio;
    if (idxFecha >= 0) fila[idxFecha] = new Date();

    const sheet = gestorUsuarios.ss.getSheetByName(sheetName);
    sheet.appendRow(fila);

    _invalidarCacheDatosSiExiste();

    return {
      success: true,
      usuario: { email: emailLimpio, nombre: nombreLimpio, componente: componenteLimpio, rol: rolLimpio }
    };
  } catch (e) {
    console.error('❌ Error en crearUsuarioRapidoBackend: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/**
 * ✅ [CONC-FE-14]: mapa de co-ocurrencia real Articulador -> [Gestores] — quién ha trabajado
 * efectivamente con quién, según la matriz fusionada (Datos + overlay ASIGNACIONES_EQUIPOS,
 * vía _leerFilasVisiblesRBACEquipos()/_fusionarAsignacionesConMatriz()). Es HISTÓRICO Y
 * ACTUAL a la vez porque no distingue origen: cualquier RT cuya pareja Articulador/Gestor
 * fusionada sea email-email (ambos homologados, `articuladorEsEmail`/`gestorEsEmail`) cuenta,
 * sin importar si ese valor vino de `Datos` (legado) o de un `ASIGNACIONES_EQUIPOS` reciente.
 * Alimenta la cascada de sugerencias del modal (handleArticuladorChangeInModal en
 * app_equipos_js.html) — NO es una jerarquía de reporte formal, es una sugerencia derivada
 * de patrones de trabajo reales, para reducir el ruido de "todos los gestores del componente"
 * a "con quién trabajó de verdad este Articulador".
 *
 * Respeta el mismo alcance RBAC que el resto del módulo (Articulador/Gestor solo ven su
 * propio subgrafo; Admin/Editor ven el grafo completo) — no es un endpoint separado sin
 * filtrar, reutiliza _leerFilasVisiblesRBACEquipos() tal cual.
 */
function obtenerMapaRelacionesEquipos() {
  try {
    const filas = _leerFilasVisiblesRBACEquipos();
    const mapa = {};

    filas.forEach(function(f) {
      if (!f.articuladorEsEmail || !f.gestorEsEmail) return; // solo parejas email-email confiables
      const claveArticulador = f.articulador.trim().toLowerCase();
      if (!mapa[claveArticulador]) mapa[claveArticulador] = [];
      if (mapa[claveArticulador].indexOf(f.gestor) < 0) mapa[claveArticulador].push(f.gestor);
    });

    Object.keys(mapa).forEach(function(k) { mapa[k].sort(); });

    return { success: true, mapaRelaciones: mapa };
  } catch (e) {
    console.error('❌ Error en obtenerMapaRelacionesEquipos: ' + e.message);
    return { success: false, error: e.message, mapaRelaciones: {} };
  }
}

/**
 * ✅ [CONC-FE-14]: endpoint unificado "todo en un solo viaje" para abrir el modal de
 * Asignación Granular sin cascada de round-trips (antes: 1 llamada para Proyectos + 1 por
 * cada expansión de Tramo/RT + 1 para el directorio de Articulador/Gestor). Una sola lectura
 * de `Datos`/`ASIGNACIONES_EQUIPOS` (_leerFilasVisiblesRBACEquipos(), ya fusionada y RBAC-
 * filtrada) alimenta simultáneamente Proyectos/Tramos/RTs, y se reutilizan
 * getUsuariosParaAsignacionEquipos() + obtenerMapaRelacionesEquipos() para el resto.
 *
 * `rtsPorTramo` usa clave compuesta `"proyecto||tramo"` (no solo el nombre del tramo) porque
 * el mismo nombre de tramo puede repetirse en proyectos distintos — una clave plana los
 * mezclaría. El cliente siempre tiene ambos valores seleccionados a la vez, así que construir
 * la clave compuesta en `app_equipos_js.html` es trivial.
 *
 * Garantiza que `proyectos` nunca venga vacío mientras `Datos` tenga filas: a diferencia del
 * flujo previo del modal (que dependía de `window.currentData`/`rawData`, poblados solo si el
 * usuario ya había visitado la pestaña Matriz), este endpoint lee `Datos` directo en el
 * servidor sin depender de qué otras pestañas visitó el cliente antes.
 */
function getProyectosYListaUsuarios() {
  try {
    const filas = _leerFilasVisiblesRBACEquipos();

    const proyectosSet = {};
    const tramosPorProyectoSet = {};
    const rtsPorTramo = {};

    filas.forEach(function(f) {
      proyectosSet[f.proyecto] = true;

      if (!tramosPorProyectoSet[f.proyecto]) tramosPorProyectoSet[f.proyecto] = {};
      tramosPorProyectoSet[f.proyecto][f.tramo] = true;

      const claveRT = f.proyecto + '||' + f.tramo;
      if (!rtsPorTramo[claveRT]) rtsPorTramo[claveRT] = [];
      rtsPorTramo[claveRT].push(f.rt);
    });

    const proyectos = Object.keys(proyectosSet).sort();

    const tramosPorProyecto = {};
    Object.keys(tramosPorProyectoSet).forEach(function(p) {
      tramosPorProyecto[p] = Object.keys(tramosPorProyectoSet[p]).sort();
    });

    Object.keys(rtsPorTramo).forEach(function(k) { rtsPorTramo[k].sort(); });

    const usuarios = getUsuariosParaAsignacionEquipos();
    const relaciones = obtenerMapaRelacionesEquipos();

    return {
      success: true,
      proyectos: proyectos,
      tramosPorProyecto: tramosPorProyecto,
      rtsPorTramo: rtsPorTramo,
      articuladores: usuarios.success ? usuarios.articuladores : [],
      gestores: usuarios.success ? usuarios.gestores : [],
      mapaRelaciones: relaciones.success ? relaciones.mapaRelaciones : {}
    };
  } catch (e) {
    console.error('❌ Error en getProyectosYListaUsuarios: ' + e.message);
    return {
      success: false, error: e.message,
      proyectos: [], tramosPorProyecto: {}, rtsPorTramo: {},
      articuladores: [], gestores: [], mapaRelaciones: {}
    };
  }
}

/**
 * KPIs del tablero de carga: Total RTs, RTs por Asignar (regla estricta: falta Articulador
 * O Gestor), distribución por Articulador/Gestor. `userContext` es solo un hint del cliente —
 * el rol/email real se resuelve SIEMPRE server-side.
 */
function getEstadisticasCargaEquipos(userContext) {
  try {
    const filas = _leerFilasVisiblesRBACEquipos();

    const currentUserEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    const rolUsuario = getUserRole(currentUserEmail) || getConfig('ROLES.LECTOR');
    const esArticulador = rolUsuario === getConfig('ROLES.ARTICULADOR');
    const esGestor = rolUsuario === getConfig('ROLES.GESTOR');

    const conteoArticulador = {};
    const conteoGestor = {};
    let rtsPorAsignar = 0;

    filas.forEach(function(f) {
      if (f.articuladorEsEmail) {
        const key = f.articulador.toLowerCase();
        conteoArticulador[key] = (conteoArticulador[key] || 0) + 1;
      }
      if (f.gestorEsEmail) {
        const key = f.gestor.toLowerCase();
        conteoGestor[key] = (conteoGestor[key] || 0) + 1;
      }
      if (!f.esCompleto) rtsPorAsignar++;
    });

    let distribucionArticulador = Object.keys(conteoArticulador).map(function(email) {
      return { email: email, totalRTs: conteoArticulador[email] };
    });
    let distribucionGestor = Object.keys(conteoGestor).map(function(email) {
      return { email: email, totalRTs: conteoGestor[email] };
    });

    // `filas` ya viene recortada por RBAC (Articulador→sus RTs, Gestor→sus RTs+las de su
    // Articulador) — pero un Gestor no debe ver la carga INDIVIDUAL de otros gestores del
    // mismo Articulador, solo la suya propia. Mismo criterio de privacidad ya establecido.
    if (esArticulador) {
      distribucionArticulador = distribucionArticulador.filter(function(d) { return d.email === currentUserEmail; });
    } else if (esGestor) {
      distribucionGestor = distribucionGestor.filter(function(d) { return d.email === currentUserEmail; });
    }

    distribucionArticulador.sort(function(a, b) { return b.totalRTs - a.totalRTs; });
    distribucionGestor.sort(function(a, b) { return b.totalRTs - a.totalRTs; });

    return {
      success: true,
      totalRTs: filas.length,
      rtsPorAsignar: (esArticulador || esGestor) ? null : rtsPorAsignar,
      distribucionArticulador: distribucionArticulador,
      distribucionGestor: distribucionGestor
    };
  } catch (e) {
    console.error('❌ Error en getEstadisticasCargaEquipos: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Nivel 1 del árbol de asignación: lista de Proyectos con conteo de RTs y de RTs sin asignar
 * (regla estricta). Carga liviana — Tramos/RTs se piden bajo demanda al expandir un nodo.
 */
function getProyectosConteo() {
  try {
    const filas = _leerFilasVisiblesRBACEquipos();
    const porProyecto = {};

    filas.forEach(function(f) {
      if (!porProyecto[f.proyecto]) porProyecto[f.proyecto] = { totalRTs: 0, sinAsignar: 0 };
      porProyecto[f.proyecto].totalRTs++;
      if (!f.esCompleto) porProyecto[f.proyecto].sinAsignar++;
    });

    const proyectos = Object.keys(porProyecto).sort().map(function(p) {
      return { proyecto: p, totalRTs: porProyecto[p].totalRTs, sinAsignar: porProyecto[p].sinAsignar };
    });

    return { success: true, proyectos: proyectos };
  } catch (e) {
    console.error('❌ Error en getProyectosConteo: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Nivel 2 del árbol: Tramos de un Proyecto específico, con sus conteos (regla estricta).
 */
function getTramosPorProyecto(proyecto) {
  try {
    const filas = _leerFilasVisiblesRBACEquipos().filter(function(f) { return f.proyecto === proyecto; });
    const porTramo = {};

    filas.forEach(function(f) {
      if (!porTramo[f.tramo]) porTramo[f.tramo] = { totalRTs: 0, sinAsignar: 0 };
      porTramo[f.tramo].totalRTs++;
      if (!f.esCompleto) porTramo[f.tramo].sinAsignar++;
    });

    const tramos = Object.keys(porTramo).sort().map(function(t) {
      return { tramo: t, totalRTs: porTramo[t].totalRTs, sinAsignar: porTramo[t].sinAsignar };
    });

    return { success: true, proyecto: proyecto, tramos: tramos };
  } catch (e) {
    console.error('❌ Error en getTramosPorProyecto: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Nivel 3 del árbol ("línea cero" visual): detalle de RTs de un Tramo específico, cada uno
 * con su Articulador/Gestor EFECTIVO (ya fusionado) — la vista que dispara la reasignación.
 */
function getRTsPorTramo(proyecto, tramo) {
  try {
    const filas = _leerFilasVisiblesRBACEquipos().filter(function(f) {
      return f.proyecto === proyecto && f.tramo === tramo;
    });

    const rts = filas.map(function(f) {
      return {
        rt: f.rt,
        articulador: f.articulador,
        articuladorEsEmail: f.articuladorEsEmail,
        gestor: f.gestor,
        gestorEsEmail: f.gestorEsEmail,
        sinAsignar: !f.esCompleto
      };
    }).sort(function(a, b) { return a.rt.localeCompare(b.rt); });

    return { success: true, proyecto: proyecto, tramo: tramo, rts: rts };
  } catch (e) {
    console.error('❌ Error en getRTsPorTramo: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * ✅ [CONC-FE-15]: índice inverso RT -> ubicación+asignación, para lookup O(1) en el
 * cliente tras una sola carga (buscador directo de RT en el modal de Asignación Granular,
 * ver handleRTSelectionDirecta() en app_equipos_js.html) — evita un round-trip por cada RT
 * que el usuario escribe/selecciona. Misma fuente fusionada y mismo alcance RBAC que el
 * resto del módulo (_leerFilasVisiblesRBACEquipos()), reutilizada tal cual.
 */
function getIndiceInversoRTs() {
  try {
    const filas = _leerFilasVisiblesRBACEquipos();
    const indice = {};

    // ✅ [CONC-FE-17]: coacciona explícitamente la clave a texto limpio — aunque
    // _leerFilasVisiblesRBACEquipos() ya normaliza f.rt vía String().trim() internamente,
    // este endpoint es el punto de contrato con el cliente (window.mapaInversoRTs), así que
    // garantiza el tipo aquí también en vez de asumirlo por transitividad. Cubre tanto RT
    // guardados como número entero en Datos (Sheets los entrega como Number) como los
    // guardados como texto — ambos terminan siendo la misma clave de string.
    filas.forEach(function(f) {
      const rtKey = String(f.rt || '').trim();
      if (!rtKey) return;
      indice[rtKey] = {
        proyecto: f.proyecto,
        tramo: f.tramo,
        articulador: f.articuladorEsEmail ? f.articulador : '',
        gestor: f.gestorEsEmail ? f.gestor : ''
      };
    });

    return { success: true, indice: indice, totalRTs: Object.keys(indice).length };
  } catch (e) {
    console.error('❌ Error en getIndiceInversoRTs: ' + e.message);
    return { success: false, error: e.message, indice: {}, totalRTs: 0 };
  }
}

/**
 * ✅ [CONC-FE-15]: jerarquía consolidada Articulador -> Gestores con conteos, para el panel
 * "Equipos de Trabajo" del módulo (reemplaza las 2 tablas planas de distribución previas).
 * Solo agrupa RTs cuyo Articulador ya está homologado a un email real — un RT sin
 * Articulador no tiene bajo cuál cabecera colgarse; esos ya se reflejan en el KPI "RTs por
 * Asignar" de getEstadisticasCargaEquipos(). Dentro de cada Articulador, un Gestor sin
 * homologar (o ausente) se agrupa bajo la clave literal "Sin asignar", listada al final.
 */
function getEquiposConsolidados() {
  try {
    const filas = _leerFilasVisiblesRBACEquipos();
    const conteosPorArticulador = {}; // { emailArticulador: { claveGestor: count } }
    const ordenArticuladores = [];
    const ordenGestoresPorArticulador = {};

    filas.forEach(function(f) {
      if (!f.articuladorEsEmail) return;
      const art = f.articulador;
      if (!conteosPorArticulador[art]) {
        conteosPorArticulador[art] = {};
        ordenArticuladores.push(art);
        ordenGestoresPorArticulador[art] = [];
      }
      const claveGestor = f.gestorEsEmail ? f.gestor : 'Sin asignar';
      if (conteosPorArticulador[art][claveGestor] === undefined) {
        conteosPorArticulador[art][claveGestor] = 0;
        ordenGestoresPorArticulador[art].push(claveGestor);
      }
      conteosPorArticulador[art][claveGestor]++;
    });

    const equipos = ordenArticuladores.sort().map(function(art) {
      const gestoresOrdenados = ordenGestoresPorArticulador[art].slice().sort(function(a, b) {
        if (a === 'Sin asignar') return 1;
        if (b === 'Sin asignar') return -1;
        return a.localeCompare(b);
      });
      return {
        articuladorEmail: art,
        gestores: gestoresOrdenados.map(function(g) {
          return { email: g, rtsAsignados: conteosPorArticulador[art][g] };
        })
      };
    });

    return { success: true, equipos: equipos };
  } catch (e) {
    console.error('❌ Error en getEquiposConsolidados: ' + e.message);
    return { success: false, error: e.message, equipos: [] };
  }
}

function _invalidarCacheDatosSiExiste() {
  try {
    if (typeof invalidateDataCache === 'function') invalidateDataCache();
  } catch (e) {
    console.warn('⚠️ No se pudo invalidar caché tras asignación: ' + e.message);
  }
}

function _asegurarHojaLogsAsignacion(gestor, sheetName) {
  let sheet = gestor.ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = gestor.ss.insertSheet(sheetName);
  const headers = getConfig('COLUMNS_LOG_ASIGNACION');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#2c3e50')
    .setFontColor('white')
    .setFontWeight('bold');
  return sheet;
}

/**
 * Escribe una fila en LOGS_ASIGNACION (spreadsheet dedicado, CONFIG.DATA_FILES.LOGS_ASIGNACION).
 * eventoData: { nivel, idTarget, rol, usuarioAnterior, usuarioNuevo, ejecutorEmail, observaciones }
 */
function registrarLogAsignacion(eventoData) {
  try {
    const logsFileId = getConfig('DATA_FILES.LOGS_ASIGNACION');
    if (!logsFileId || logsFileId === 'ID_SPREADSHEET_LOGS_ASIGNACION_AQUI') {
      console.error('❌ CONFIG.DATA_FILES.LOGS_ASIGNACION sigue en el valor de placeholder — registrarLogAsignacion() deshabilitado hasta configurar un ID de spreadsheet real en config.js.');
      return { success: false, error: 'DATA_FILES.LOGS_ASIGNACION no configurado' };
    }

    const evento = eventoData || {};
    const gestor = new GestorDatos(logsFileId);
    const sheetName = getConfig('SHEETS.LOGS_ASIGNACION');
    _asegurarHojaLogsAsignacion(gestor, sheetName);

    const fila = [
      new Date(),
      evento.nivel || '',
      evento.idTarget || '',
      evento.rol || '',
      evento.usuarioAnterior || '',
      evento.usuarioNuevo || '',
      evento.ejecutorEmail || '',
      evento.observaciones || ''
    ];

    gestor.agregarFila(sheetName, fila);
    return { success: true };
  } catch (e) {
    console.error('❌ Error registrando log de asignación: ' + e.message);
    return { success: false, error: e.message };
  }
}

function _construirPredicadoNivel(nivelUpper, idTarget, headers) {
  const idxPorNivel = {
    RT: findColumnIndex(headers, getConfig('COLUMNS.RT')),
    TRAMO: findColumnIndex(headers, getConfig('COLUMNS.TRAMO')),
    PROYECTO: findColumnIndex(headers, getConfig('COLUMNS.PROYECTO'))
  };

  const idxColumnaNivel = idxPorNivel[nivelUpper];
  if (idxColumnaNivel < 0) {
    throw new Error('Columna requerida para nivel ' + nivelUpper + ' no encontrada en Datos');
  }

  const columnaNivel = headers[idxColumnaNivel];
  const idTargetTrim = String(idTarget || '').trim();

  return function(row) {
    return String(row[columnaNivel] || '').trim() === idTargetTrim;
  };
}

/**
 * Resuelve, a partir de Datos (SOLO LECTURA), la lista de {rt, articuladorEmail?, gestorEmail?}
 * que corresponde a un nivel/idTarget — usada tanto por asignarEquipoGranular() (un nodo) como
 * por asignarEquipoGranularLote() (N nodos, misma Datos ya leída una sola vez para todos).
 */
function _resolverCambiosPorNivel(headers, rows, nivelUpper, idTarget, articuladorEmail, gestorEmail) {
  const idxRT = findColumnIndex(headers, getConfig('COLUMNS.RT'));
  if (idxRT < 0) throw new Error('Columna RT no encontrada en Datos');

  const predicado = _construirPredicadoNivel(nivelUpper, idTarget, headers);
  const rtCol = headers[idxRT];
  const cambios = [];

  rows.forEach(function(row) {
    if (!predicado(row)) return;
    const rt = String(row[rtCol] || '').trim();
    if (!rt) return;
    const cambio = { rt: rt };
    if (articuladorEmail) cambio.articuladorEmail = articuladorEmail;
    if (gestorEmail) cambio.gestorEmail = gestorEmail;
    cambios.push(cambio);
  });

  return cambios;
}

/**
 * ÚNICO punto de escritura sobre ASIGNACIONES_EQUIPOS — Datos nunca se toca desde aquí.
 * `cambios`: [{rt, articuladorEmail?, gestorEmail?}, ...] — cada entrada solo aplica los
 * campos presentes (omitir un rol para un RT no lo toca). Lee las 4 columnas de datos una
 * vez, parcha en memoria por lotes de 1000, escribe con como máximo 4 setValues() (una por
 * columna realmente afectada) + 1 más si hay filas nuevas que agregar — Directiva 3.
 * `contexto.logPorFila` (default true): si es false, no genera logs aquí — el llamador
 * (ejecutarCargaLineaCero) registra un único evento resumen para no inundar LOGS_ASIGNACION
 * en una migración masiva.
 */
function _upsertAsignacionesEquipos(cambios, ejecutorEmail, contexto) {
  const ctx = contexto || {};
  const logPorFila = ctx.logPorFila !== false;

  const gestorAsig = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
  const sheetName = getConfig('SHEETS.ASIGNACIONES_EQUIPOS', 'ASIGNACIONES_EQUIPOS');
  const sheet = _asegurarHojaAsignacionesEquipos(gestorAsig, sheetName);
  const { headers, rows } = gestorAsig.leerDatos(sheetName);

  const idxRT = findColumnIndex(headers, 'RT');
  const idxArt = findColumnIndex(headers, 'ARTICULADOR_EMAIL');
  const idxGes = findColumnIndex(headers, 'GESTOR_EMAIL');
  const idxFecha = findColumnIndex(headers, 'FECHA_ACTUALIZACION');
  const idxEjecutor = findColumnIndex(headers, 'EJECUTOR');

  if (idxRT < 0 || idxArt < 0 || idxGes < 0 || idxFecha < 0 || idxEjecutor < 0) {
    throw new Error('La hoja ASIGNACIONES_EQUIPOS no tiene el esquema esperado [RT, ARTICULADOR_EMAIL, GESTOR_EMAIL, FECHA_ACTUALIZACION, EJECUTOR]');
  }

  const indicePorRT = {};
  rows.forEach(function(row, i) {
    const rt = String(row['RT'] || '').trim();
    if (rt) indicePorRT[rt] = i;
  });

  const totalFilas = rows.length;
  const colArtValores = totalFilas > 0 ? sheet.getRange(2, idxArt + 1, totalFilas, 1).getValues() : [];
  const colGesValores = totalFilas > 0 ? sheet.getRange(2, idxGes + 1, totalFilas, 1).getValues() : [];
  const colFechaValores = totalFilas > 0 ? sheet.getRange(2, idxFecha + 1, totalFilas, 1).getValues() : [];
  const colEjecutorValores = totalFilas > 0 ? sheet.getRange(2, idxEjecutor + 1, totalFilas, 1).getValues() : [];

  const ahora = new Date();
  const filasNuevas = [];
  const eventos = [];
  let cambiosAplicados = 0;
  let tocoArticulador = false;
  let tocoGestor = false;

  for (let start = 0; start < cambios.length; start += EQUIPOS_ENGINE.batchSize) {
    const fin = Math.min(start + EQUIPOS_ENGINE.batchSize, cambios.length);
    for (let i = start; i < fin; i++) {
      const cambio = cambios[i];
      const rt = String(cambio.rt || '').trim();
      if (!rt) continue;

      const tieneArticulador = !!cambio.articuladorEmail;
      const tieneGestor = !!cambio.gestorEmail;
      if (!tieneArticulador && !tieneGestor) continue;

      const filaIdx = indicePorRT[rt];
      let tocado = false;
      let usuarioAnteriorArt = '';
      let usuarioAnteriorGes = '';

      if (filaIdx === undefined) {
        const filaNueva = new Array(headers.length).fill('');
        filaNueva[idxRT] = rt;
        if (tieneArticulador) filaNueva[idxArt] = cambio.articuladorEmail;
        if (tieneGestor) filaNueva[idxGes] = cambio.gestorEmail;
        filaNueva[idxFecha] = ahora;
        filaNueva[idxEjecutor] = ejecutorEmail || 'Sistema';
        filasNuevas.push(filaNueva);
        tocado = true;
        if (tieneArticulador) tocoArticulador = true;
        if (tieneGestor) tocoGestor = true;
      } else {
        if (tieneArticulador) {
          usuarioAnteriorArt = String(colArtValores[filaIdx][0] || '');
          if (usuarioAnteriorArt !== cambio.articuladorEmail) {
            colArtValores[filaIdx][0] = cambio.articuladorEmail;
            tocado = true;
            tocoArticulador = true;
          }
        }
        if (tieneGestor) {
          usuarioAnteriorGes = String(colGesValores[filaIdx][0] || '');
          if (usuarioAnteriorGes !== cambio.gestorEmail) {
            colGesValores[filaIdx][0] = cambio.gestorEmail;
            tocado = true;
            tocoGestor = true;
          }
        }
        if (tocado) {
          colFechaValores[filaIdx][0] = ahora;
          colEjecutorValores[filaIdx][0] = ejecutorEmail || 'Sistema';
        }
      }

      if (tocado) {
        cambiosAplicados++;
        if (logPorFila) {
          if (tieneArticulador) {
            eventos.push({
              nivel: ctx.nivel || 'RT', idTarget: rt, rol: 'ARTICULADOR',
              usuarioAnterior: usuarioAnteriorArt, usuarioNuevo: cambio.articuladorEmail,
              ejecutorEmail: ejecutorEmail, observaciones: ctx.observaciones || ('Asignación sobre RT ' + rt)
            });
          }
          if (tieneGestor) {
            eventos.push({
              nivel: ctx.nivel || 'RT', idTarget: rt, rol: 'GESTOR',
              usuarioAnterior: usuarioAnteriorGes, usuarioNuevo: cambio.gestorEmail,
              ejecutorEmail: ejecutorEmail, observaciones: ctx.observaciones || ('Asignación sobre RT ' + rt)
            });
          }
        }
      }
    }
  }

  if (tocoArticulador && totalFilas > 0) sheet.getRange(2, idxArt + 1, totalFilas, 1).setValues(colArtValores);
  if (tocoGestor && totalFilas > 0) sheet.getRange(2, idxGes + 1, totalFilas, 1).setValues(colGesValores);
  if ((tocoArticulador || tocoGestor) && totalFilas > 0) {
    sheet.getRange(2, idxFecha + 1, totalFilas, 1).setValues(colFechaValores);
    sheet.getRange(2, idxEjecutor + 1, totalFilas, 1).setValues(colEjecutorValores);
  }
  if (filasNuevas.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, filasNuevas.length, headers.length).setValues(filasNuevas);
  }

  let logsOk = 0, logsError = 0;
  eventos.forEach(function(ev) {
    const r = registrarLogAsignacion(ev);
    if (r && r.success) logsOk++; else logsError++;
  });

  return { cambiosAplicados: cambiosAplicados, logsRegistrados: logsOk, logsConError: logsError };
}

/**
 * Asignación en cascada Proyecto→Tramo→RT. Datos se lee para saber qué RTs matchean el
 * nivel/idTarget; la escritura va íntegra a ASIGNACIONES_EQUIPOS vía _upsertAsignacionesEquipos().
 */
function asignarEquipoGranular(nivel, idTarget, articuladorEmail, gestorEmail, ejecutorEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(EQUIPOS_ENGINE.lockTimeoutMs);
  } catch (eLock) {
    return { success: false, error: 'No se pudo adquirir el lock: ' + eLock.message };
  }

  try {
    const nivelUpper = String(nivel || '').toUpperCase();
    if (['PROYECTO', 'TRAMO', 'RT'].indexOf(nivelUpper) < 0) {
      throw new Error('Nivel inválido: ' + nivel + ' (esperado PROYECTO, TRAMO o RT)');
    }
    if (!articuladorEmail && !gestorEmail) {
      throw new Error('Debe indicar al menos articuladorEmail o gestorEmail');
    }

    const gestorDatos = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
    const { headers, rows } = gestorDatos.leerDatos(getConfig('SHEETS.DATOS'));
    if (!headers.length) throw new Error('No se pudo leer la hoja Datos');

    const cambios = _resolverCambiosPorNivel(headers, rows, nivelUpper, idTarget, articuladorEmail, gestorEmail);

    const resultado = cambios.length
      ? _upsertAsignacionesEquipos(cambios, ejecutorEmail || 'Sistema', {
          nivel: nivelUpper,
          observaciones: 'Asignación en cascada por ' + nivelUpper + ': ' + idTarget
        })
      : { cambiosAplicados: 0, logsRegistrados: 0, logsConError: 0 };

    _invalidarCacheDatosSiExiste();

    return {
      success: true,
      filasCoincidentes: cambios.length,
      cambiosAplicados: resultado.cambiosAplicados,
      logsRegistrados: resultado.logsRegistrados,
      logsConError: resultado.logsConError
    };
  } catch (e) {
    console.error('❌ Error en asignarEquipoGranular: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/**
 * Guardado en lote del árbol en Modo Borrador (Sprint 6): recibe TODOS los nodos modificados
 * en un solo payload y los aplica bajo UN ÚNICO LockService — en vez de N llamadas a
 * asignarEquipoGranular() (que serían N locks secuenciales). `cambiosArray`:
 * [{nivel, idTarget, articuladorEmail?, gestorEmail?}, ...]. Un nodo inválido no tumba el
 * lote completo — se reporta en `erroresPorNodo` y el resto sigue procesándose.
 */
function asignarEquipoGranularLote(cambiosArray, ejecutorEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(EQUIPOS_ENGINE.lockTimeoutMs);
  } catch (eLock) {
    return { success: false, error: 'No se pudo adquirir el lock: ' + eLock.message };
  }

  try {
    if (!Array.isArray(cambiosArray) || !cambiosArray.length) {
      throw new Error('cambiosArray vacío o inválido');
    }

    const gestorDatos = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
    const { headers, rows } = gestorDatos.leerDatos(getConfig('SHEETS.DATOS'));
    if (!headers.length) throw new Error('No se pudo leer la hoja Datos');

    const ejecutor = ejecutorEmail || (Session.getActiveUser().getEmail() || 'Sistema');
    let cambiosConsolidados = [];
    const erroresPorNodo = [];

    cambiosArray.forEach(function(entrada) {
      try {
        const nivelUpper = String(entrada.nivel || '').toUpperCase();
        if (['PROYECTO', 'TRAMO', 'RT'].indexOf(nivelUpper) < 0) {
          throw new Error('Nivel inválido: ' + entrada.nivel);
        }
        if (!entrada.articuladorEmail && !entrada.gestorEmail) {
          throw new Error('Nodo sin articuladorEmail ni gestorEmail');
        }
        const cambiosEntrada = _resolverCambiosPorNivel(
          headers, rows, nivelUpper, entrada.idTarget, entrada.articuladorEmail, entrada.gestorEmail
        );
        cambiosConsolidados = cambiosConsolidados.concat(cambiosEntrada);
      } catch (eEntrada) {
        erroresPorNodo.push({ idTarget: entrada.idTarget, error: eEntrada.message });
      }
    });

    const resultado = cambiosConsolidados.length
      ? _upsertAsignacionesEquipos(cambiosConsolidados, ejecutor, {
          nivel: 'LOTE',
          observaciones: 'Guardado en lote (Draft Mode) — ' + cambiosArray.length + ' nodo(s) del árbol.'
        })
      : { cambiosAplicados: 0, logsRegistrados: 0, logsConError: 0 };

    _invalidarCacheDatosSiExiste();

    return {
      success: true,
      totalNodosRecibidos: cambiosArray.length,
      totalRTsAfectados: cambiosConsolidados.length,
      cambiosAplicados: resultado.cambiosAplicados,
      logsRegistrados: resultado.logsRegistrados,
      logsConError: resultado.logsConError,
      erroresPorNodo: erroresPorNodo
    };
  } catch (e) {
    console.error('❌ Error en asignarEquipoGranularLote: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/**
 * Handover 1-click: reemplaza usuarioOrigen por usuarioDestino en TODOS los RT donde aparece
 * como Articulador o Gestor (según `rol`) en la vista FUSIONADA (ASIGNACIONES_EQUIPOS
 * override, o Datos si no hay override todavía) — sin importar en cuál de las dos capas
 * vivía el valor anterior, el resultado siempre se escribe en ASIGNACIONES_EQUIPOS.
 */
function reasignarUsuarioMasivo(usuarioOrigen, usuarioDestino, rol, ejecutorEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(EQUIPOS_ENGINE.lockTimeoutMs);
  } catch (eLock) {
    return { success: false, error: 'No se pudo adquirir el lock: ' + eLock.message };
  }

  try {
    const rolUpper = String(rol || '').toUpperCase();
    if (['ARTICULADOR', 'GESTOR'].indexOf(rolUpper) < 0) {
      throw new Error('Rol inválido: ' + rol + ' (esperado ARTICULADOR o GESTOR)');
    }
    if (!usuarioOrigen || !usuarioDestino) {
      throw new Error('usuarioOrigen y usuarioDestino son requeridos');
    }

    const gestorDatos = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
    const { headers, rows } = gestorDatos.leerDatos(getConfig('SHEETS.DATOS'));
    if (!headers.length) throw new Error('No se pudo leer la hoja Datos');

    const idxRT = findColumnIndex(headers, getConfig('COLUMNS.RT'));
    const idxArticulador = findColumnIndex(headers, getConfig('COLUMNS.ARTICULADOR_JURIDICO'));
    const idxGestor = findColumnIndex(headers, getConfig('COLUMNS.GESTOR_JURIDICO'));
    if (idxRT < 0 || idxArticulador < 0 || idxGestor < 0) {
      throw new Error('Columnas requeridas no encontradas en Datos');
    }

    const rtCol = headers[idxRT];
    const colArticulador = headers[idxArticulador];
    const colGestor = headers[idxGestor];

    const asignacionesMap = _leerAsignacionesEquipos();
    const cambios = [];

    rows.forEach(function(row) {
      const rt = String(row[rtCol] || '').trim();
      if (!rt) return;
      const fusion = _fusionarAsignacionesConMatriz(rt, row[colArticulador], row[colGestor], asignacionesMap);
      const valorActual = rolUpper === 'ARTICULADOR' ? fusion.articuladorEmail : fusion.gestorEmail;
      if (valorActual === usuarioOrigen) {
        const cambio = { rt: rt };
        if (rolUpper === 'ARTICULADOR') cambio.articuladorEmail = usuarioDestino;
        else cambio.gestorEmail = usuarioDestino;
        cambios.push(cambio);
      }
    });

    const resultado = cambios.length
      ? _upsertAsignacionesEquipos(cambios, ejecutorEmail || 'Sistema', {
          nivel: 'RT',
          observaciones: 'Handover masivo de ' + usuarioOrigen + ' a ' + usuarioDestino
        })
      : { cambiosAplicados: 0, logsRegistrados: 0, logsConError: 0 };

    _invalidarCacheDatosSiExiste();

    return {
      success: true,
      filasAfectadas: cambios.length,
      logsRegistrados: resultado.logsRegistrados,
      logsConError: resultado.logsConError
    };
  } catch (e) {
    console.error('❌ Error en reasignarUsuarioMasivo: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/**
 * Carga de "Línea Cero" (Baseline). Lee Datos (SOLO LECTURA) para encontrar nombres libres
 * homologables vía obtenerMapeoLineaCero() (ENCONTRADO_ACTIVO, ENCONTRADO_SIN_PERFIL, o
 * SIMILITUD_APROXIMADA ≥ 0.85), y escribe los emails resueltos en ASIGNACIONES_EQUIPOS — nunca
 * en Datos. `logPorFila: false` porque esto puede tocar miles de RTs de una vez: se registra
 * UN solo evento resumen en LOGS_ASIGNACION, no una fila por RT.
 */
function ejecutarCargaLineaCero() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(EQUIPOS_ENGINE.lockTimeoutMs);
  } catch (eLock) {
    return { success: false, error: 'No se pudo adquirir el lock: ' + eLock.message };
  }

  try {
    // ✅ [CONC-BE-14]: invalida ANTES de procesar — si `Datos` fue restaurada/editada
    // manualmente justo antes de correr Línea Cero, cualquier lectura concurrente de
    // getDashboardData() (Matriz, evaluador de alertas) no debe seguir sirviendo un
    // dash_data_v1 calculado sobre la versión anterior de `Datos` mientras esta
    // operación está en curso.
    _invalidarCacheDatosSiExiste();

    const mapeoResultado = obtenerMapeoLineaCero();
    if (!mapeoResultado.success) {
      throw new Error('No se pudo calcular el mapeo de homologación: ' + (mapeoResultado.error || ''));
    }
    const mapeo = mapeoResultado.mapeo;

    const gestorDatos = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
    const { headers, rows } = gestorDatos.leerDatos(getConfig('SHEETS.DATOS'));
    if (!headers.length) throw new Error('No se pudo leer la hoja Datos');

    const idxRT = findColumnIndex(headers, getConfig('COLUMNS.RT'));
    const idxArticulador = findColumnIndex(headers, getConfig('COLUMNS.ARTICULADOR_JURIDICO'));
    const idxGestor = findColumnIndex(headers, getConfig('COLUMNS.GESTOR_JURIDICO'));
    if (idxRT < 0 || idxArticulador < 0 || idxGestor < 0) {
      throw new Error('Columnas requeridas no encontradas en Datos');
    }

    const rtCol = headers[idxRT];
    const colArticulador = headers[idxArticulador];
    const colGestor = headers[idxGestor];

    const cambios = [];
    let candidatosArticulador = 0;
    let candidatosGestor = 0;
    // ✅ [CONC-BE-14]: un RT sin ningún correo mapeable NO genera fila en
    // ASIGNACIONES_EQUIPOS (no hay nada real que escribir) — se deja que
    // _fusionarAsignacionesConMatriz() caiga de vuelta al valor crudo de Datos para
    // ese RT, exactamente igual que cualquier otro RT sin overlay. Esto es
    // intencional y no rompe los conteos del árbol (_esRTCompleto ya trata ausencia
    // de overlay como "sin asignar" si Datos tampoco tiene el dato). Se cuenta aparte
    // solo para diagnóstico/observabilidad en el resumen devuelto y en el log.
    let rtsSinMapeoAlguno = 0;

    rows.forEach(function(row) {
      const rt = String(row[rtCol] || '').trim();
      if (!rt) return;
      const articuladorActual = String(row[colArticulador] || '').trim();
      const gestorActual = String(row[colGestor] || '').trim();
      const cambio = { rt: rt };
      let tieneCambio = false;

      // Dos condiciones independientes por campo, cualquiera basta: (a) el valor ya ES
      // un email institucional válido → se usa directo, sin pasar por el mapeo; (b) si no,
      // se intenta resolver por homologación (nombre libre u otro email vía
      // obtenerMapeoLineaCero(), que también reconoce email→email — ver _mejorCoincidenciaUsuario).
      if (articuladorActual) {
        if (REGEX_EMAIL_IDU_LINEA_CERO.test(articuladorActual)) {
          cambio.articuladorEmail = articuladorActual;
          tieneCambio = true;
          candidatosArticulador++;
        } else if (mapeo[articuladorActual]) {
          cambio.articuladorEmail = mapeo[articuladorActual];
          tieneCambio = true;
          candidatosArticulador++;
        }
      }
      if (gestorActual) {
        if (REGEX_EMAIL_IDU_LINEA_CERO.test(gestorActual)) {
          cambio.gestorEmail = gestorActual;
          tieneCambio = true;
          candidatosGestor++;
        } else if (mapeo[gestorActual]) {
          cambio.gestorEmail = mapeo[gestorActual];
          tieneCambio = true;
          candidatosGestor++;
        }
      }

      if (tieneCambio) {
        cambios.push(cambio);
      } else if (articuladorActual || gestorActual) {
        // Tenía texto histórico en Datos pero ninguno de los dos nombres homologó a
        // un email — no se inventa un valor: queda pendiente de homologación manual.
        rtsSinMapeoAlguno++;
      }
    });

    const ejecutorEmail = Session.getActiveUser().getEmail() || 'Sistema';

    const resultado = cambios.length
      ? _upsertAsignacionesEquipos(cambios, ejecutorEmail, { logPorFila: false })
      : { cambiosAplicados: 0 };

    const totalAsociacionesResueltas = resultado.cambiosAplicados;

    const logResultado = registrarLogAsignacion({
      nivel: 'GLOBAL',
      idTarget: 'TODOS_LOS_RTS',
      rol: 'ARTICULADOR_Y_GESTOR',
      usuarioAnterior: '',
      usuarioNuevo: '',
      ejecutorEmail: ejecutorEmail,
      observaciones: 'Inicialización de Línea Cero (Baseline) completada — ' + totalAsociacionesResueltas +
        ' asociaciones escritas en ASIGNACIONES_EQUIPOS (' + candidatosArticulador + ' candidatas Articulador, ' +
        candidatosGestor + ' candidatas Gestor) sobre ' + rows.length + ' RTs. ' +
        rtsSinMapeoAlguno + ' RT(s) con texto histórico en Datos que no homologó a ningún email (quedan pendientes).'
    });

    // ✅ [CONC-BE-14]: invalida también DESPUÉS — la escritura en ASIGNACIONES_EQUIPOS ya
    // ocurrió, cualquier dash_data_v1 que quedara servido debe descartarse para que el
    // próximo getDashboardData() lea la fusión con el overlay recién actualizado.
    _invalidarCacheDatosSiExiste();

    return {
      success: true,
      totalRTsProcesados: rows.length,
      totalAsociacionesResueltas: totalAsociacionesResueltas,
      cambiosArticulador: candidatosArticulador,
      cambiosGestor: candidatosGestor,
      totalNombresMapeados: mapeoResultado.totalMapeados,
      rtsSinMapeoAlguno: rtsSinMapeoAlguno,
      logRegistrado: !!(logResultado && logResultado.success)
    };
  } catch (e) {
    console.error('❌ Error en ejecutarCargaLineaCero: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}
