'use strict';

/**
 * Motor backend de asignación de equipos y auditoría dedicada — Sprint 5, Fase A [CONC-BE-07].
 * Toda escritura en Datos usa LockService + una sola llamada setValues() por columna afectada
 * (Directiva 3): se lee la columna completa una vez, se parchan en memoria por lotes de 1000
 * solo las filas que matchean, y se reescribe en un único setValues() — en vez de N escrituras
 * individuales sobre filas dispersas. Cada cambio real genera su propia fila en LOGS_ASIGNACION
 * antes de devolver éxito (nunca una asignación sin log — antipatrón explícito del sprint).
 */

const EQUIPOS_ENGINE = {
  batchSize: 1000,
  // 60s en vez de los 30s de permisos.js/eliminarPermiso(): reasignarUsuarioMasivo() puede
  // tocar cientos de filas bajo el mismo lock — riesgo identificado en ARCHITECTURE_V4.md Sección 5.
  lockTimeoutMs: 60000
};

const REGEX_EMAIL_SIMPLE_EQUIPOS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * KPIs del tablero de carga (Fase B): Total RTs, RTs por Asignar, distribución por
 * Articulador/Gestor. `userContext` es solo un hint del cliente — el rol/email que
 * realmente decide el recorte se resuelve SIEMPRE server-side vía Session.getActiveUser()
 * + getUserRole(), nunca del parámetro (un cliente podría declarar cualquier rol).
 */
function getEstadisticasCargaEquipos(userContext) {
  try {
    const gestorDatos = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
    const { headers, rows } = gestorDatos.leerDatos(getConfig('SHEETS.DATOS'));

    if (!headers.length) {
      return { success: false, error: 'No se pudo leer la hoja Datos' };
    }

    const idxArticulador = findColumnIndex(headers, getConfig('COLUMNS.ARTICULADOR_JURIDICO'));
    const idxGestor = findColumnIndex(headers, getConfig('COLUMNS.GESTOR_JURIDICO'));

    if (idxArticulador < 0 || idxGestor < 0) {
      return { success: false, error: 'Columnas ARTICULADOR JUIRIDICO / GESTOR JURÍDICO no encontradas en Datos' };
    }

    const colArticulador = headers[idxArticulador];
    const colGestor = headers[idxGestor];

    const currentUserEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    const rolUsuario = getUserRole(currentUserEmail) || getConfig('ROLES.LECTOR');
    const esArticulador = rolUsuario === getConfig('ROLES.ARTICULADOR');
    const esGestor = rolUsuario === getConfig('ROLES.GESTOR');

    const conteoArticulador = {};
    const conteoGestor = {};
    const articuladoresDelGestor = new Set(); // solo se usa si esGestor
    let rtsPorAsignar = 0;

    for (let start = 0; start < rows.length; start += EQUIPOS_ENGINE.batchSize) {
      const fin = Math.min(start + EQUIPOS_ENGINE.batchSize, rows.length);
      for (let i = start; i < fin; i++) {
        const row = rows[i];
        const articuladorCelda = String(row[colArticulador] || '').trim().toLowerCase();
        const gestorCelda = String(row[colGestor] || '').trim().toLowerCase();
        const articuladorEsEmail = REGEX_EMAIL_SIMPLE_EQUIPOS.test(articuladorCelda);
        const gestorEsEmail = REGEX_EMAIL_SIMPLE_EQUIPOS.test(gestorCelda);

        if (articuladorEsEmail) conteoArticulador[articuladorCelda] = (conteoArticulador[articuladorCelda] || 0) + 1;
        if (gestorEsEmail) conteoGestor[gestorCelda] = (conteoGestor[gestorCelda] || 0) + 1;
        if (!articuladorEsEmail && !gestorEsEmail) rtsPorAsignar++;

        if (esGestor && gestorEsEmail && gestorCelda === currentUserEmail && articuladorEsEmail) {
          articuladoresDelGestor.add(articuladorCelda);
        }
      }
    }

    let distribucionArticulador = Object.keys(conteoArticulador).map(function(email) {
      return { email: email, totalRTs: conteoArticulador[email] };
    });
    let distribucionGestor = Object.keys(conteoGestor).map(function(email) {
      return { email: email, totalRTs: conteoGestor[email] };
    });

    // Recorte RBAC: un Articulador solo ve su propia carga (y la de sus Gestores derivada de
    // Datos); un Gestor solo ve su propia fila y la del/los Articulador(es) bajo los que trabaja.
    if (esArticulador) {
      distribucionArticulador = distribucionArticulador.filter(function(d) { return d.email === currentUserEmail; });
      const gestoresDelArticulador = new Set();
      for (let i = 0; i < rows.length; i++) {
        const articuladorCelda = String(rows[i][colArticulador] || '').trim().toLowerCase();
        const gestorCelda = String(rows[i][colGestor] || '').trim().toLowerCase();
        if (articuladorCelda === currentUserEmail && REGEX_EMAIL_SIMPLE_EQUIPOS.test(gestorCelda)) {
          gestoresDelArticulador.add(gestorCelda);
        }
      }
      distribucionGestor = distribucionGestor.filter(function(d) { return gestoresDelArticulador.has(d.email); });
    } else if (esGestor) {
      distribucionArticulador = distribucionArticulador.filter(function(d) { return articuladoresDelGestor.has(d.email); });
      distribucionGestor = distribucionGestor.filter(function(d) { return d.email === currentUserEmail; });
    }

    distribucionArticulador.sort(function(a, b) { return b.totalRTs - a.totalRTs; });
    distribucionGestor.sort(function(a, b) { return b.totalRTs - a.totalRTs; });

    return {
      success: true,
      totalRTs: rows.length,
      rtsPorAsignar: (esArticulador || esGestor) ? null : rtsPorAsignar, // cola global — solo visible para Admin/Editor/Lector
      distribucionArticulador: distribucionArticulador,
      distribucionGestor: distribucionGestor
    };
  } catch (e) {
    console.error('❌ Error en getEstadisticasCargaEquipos: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Lee Datos una vez, resuelve los índices de columnas relevantes y aplica el MISMO recorte
 * RBAC que getDashboardData() (Codigo.js) — Articulador solo ve sus filas, Gestor las suyas
 * + las de su(s) Articulador(es). Devuelto como filas ya filtradas, para que las 3 funciones
 * de árbol (getProyectosConteo/getTramosPorProyecto/getRTsPorTramo) no dupliquen esta lógica.
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

  const currentUserEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const rolUsuario = getUserRole(currentUserEmail) || getConfig('ROLES.LECTOR');
  const esArticulador = rolUsuario === getConfig('ROLES.ARTICULADOR');
  const esGestor = rolUsuario === getConfig('ROLES.GESTOR');

  let articuladoresPermitidosGestor = null;
  if (esGestor) {
    articuladoresPermitidosGestor = new Set();
    for (let i = 0; i < rows.length; i++) {
      const g = String(rows[i][colGestor] || '').trim().toLowerCase();
      if (g === currentUserEmail) {
        const a = String(rows[i][colArticulador] || '').trim().toLowerCase();
        if (a) articuladoresPermitidosGestor.add(a);
      }
    }
  }

  const filas = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const articuladorCelda = String(row[colArticulador] || '').trim();
    const gestorCelda = String(row[colGestor] || '').trim();

    if (esArticulador && articuladorCelda.toLowerCase() !== currentUserEmail) continue;
    if (esGestor) {
      const visible = gestorCelda.toLowerCase() === currentUserEmail ||
        (articuladoresPermitidosGestor && articuladoresPermitidosGestor.has(articuladorCelda.toLowerCase()));
      if (!visible) continue;
    }

    filas.push({
      proyecto: String(row[colProyecto] || '').trim() || 'SIN PROYECTO',
      tramo: String(row[colTramo] || '').trim() || 'SIN TRAMO',
      rt: String(row[colRT] || '').trim(),
      articulador: articuladorCelda,
      articuladorEsEmail: REGEX_EMAIL_SIMPLE_EQUIPOS.test(articuladorCelda),
      gestor: gestorCelda,
      gestorEsEmail: REGEX_EMAIL_SIMPLE_EQUIPOS.test(gestorCelda)
    });
  }

  return filas;
}

/**
 * Nivel 1 del árbol de asignación (Fase B — feedback 2026-08-18): lista de Proyectos con
 * conteo de RTs y de RTs sin asignar. Carga liviana — no trae Tramos ni RTs todavía
 * (esos se piden bajo demanda con getTramosPorProyecto/getRTsPorTramo al expandir un nodo,
 * para no mandar los 9691 RTs de una sola vez ni renderizar miles de filas de golpe).
 */
function getProyectosConteo() {
  try {
    const filas = _leerFilasVisiblesRBACEquipos();
    const porProyecto = {};

    filas.forEach(function(f) {
      if (!porProyecto[f.proyecto]) porProyecto[f.proyecto] = { totalRTs: 0, sinAsignar: 0 };
      porProyecto[f.proyecto].totalRTs++;
      if (!f.articuladorEsEmail && !f.gestorEsEmail) porProyecto[f.proyecto].sinAsignar++;
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
 * Nivel 2 del árbol: Tramos de un Proyecto específico, con sus conteos.
 */
function getTramosPorProyecto(proyecto) {
  try {
    const filas = _leerFilasVisiblesRBACEquipos().filter(function(f) { return f.proyecto === proyecto; });
    const porTramo = {};

    filas.forEach(function(f) {
      if (!porTramo[f.tramo]) porTramo[f.tramo] = { totalRTs: 0, sinAsignar: 0 };
      porTramo[f.tramo].totalRTs++;
      if (!f.articuladorEsEmail && !f.gestorEsEmail) porTramo[f.tramo].sinAsignar++;
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
 * Nivel 3 del árbol ("línea cero"): detalle de RTs de un Tramo específico, cada uno con su
 * Articulador/Gestor actual (email ya resuelto o nombre libre histórico) — la vista que
 * permite ver y disparar la reasignación puntual de cada RT.
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
        sinAsignar: !f.articuladorEsEmail && !f.gestorEsEmail
      };
    }).sort(function(a, b) { return a.rt.localeCompare(b.rt); });

    return { success: true, proyecto: proyecto, tramo: tramo, rts: rts };
  } catch (e) {
    console.error('❌ Error en getRTsPorTramo: ' + e.message);
    return { success: false, error: e.message };
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
 * Asignación en cascada Proyecto→Tramo→RT. Solo escribe (y solo loguea) las filas cuyo
 * valor actual difiere del nuevo — reasignar al mismo email dos veces no genera logs duplicados.
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
    const sheetName = getConfig('SHEETS.DATOS');
    const sheet = gestorDatos.getSheet(sheetName);
    const { headers, rows } = gestorDatos.leerDatos(sheetName);

    if (!headers.length) throw new Error('No se pudo leer la hoja Datos');

    const idxArticulador = findColumnIndex(headers, getConfig('COLUMNS.ARTICULADOR_JURIDICO'));
    const idxGestor = findColumnIndex(headers, getConfig('COLUMNS.GESTOR_JURIDICO'));
    const idxRT = findColumnIndex(headers, getConfig('COLUMNS.RT'));

    if (idxArticulador < 0 || idxGestor < 0) {
      throw new Error('Columnas ARTICULADOR JUIRIDICO / GESTOR JURÍDICO no encontradas en Datos');
    }

    const rtCol = headers[idxRT];
    const predicado = _construirPredicadoNivel(nivelUpper, idTarget, headers);
    const totalFilas = rows.length;

    const colArticuladorSheet = idxArticulador + 1;
    const colGestorSheet = idxGestor + 1;

    const valoresArticulador = articuladorEmail
      ? sheet.getRange(2, colArticuladorSheet, totalFilas, 1).getValues()
      : null;
    const valoresGestor = gestorEmail
      ? sheet.getRange(2, colGestorSheet, totalFilas, 1).getValues()
      : null;

    const eventos = [];
    let filasAfectadas = 0;
    const observacion = 'Asignación en cascada por ' + nivelUpper + ': ' + idTarget;

    for (let start = 0; start < totalFilas; start += EQUIPOS_ENGINE.batchSize) {
      const fin = Math.min(start + EQUIPOS_ENGINE.batchSize, totalFilas);
      for (let i = start; i < fin; i++) {
        const row = rows[i];
        if (!predicado(row)) continue;

        filasAfectadas++;
        const rtValor = String(row[rtCol] || '');

        if (valoresArticulador) {
          const anterior = String(valoresArticulador[i][0] || '');
          if (anterior !== articuladorEmail) {
            valoresArticulador[i][0] = articuladorEmail;
            eventos.push({
              nivel: nivelUpper, idTarget: rtValor, rol: 'ARTICULADOR',
              usuarioAnterior: anterior, usuarioNuevo: articuladorEmail,
              ejecutorEmail: ejecutorEmail, observaciones: observacion
            });
          }
        }

        if (valoresGestor) {
          const anterior = String(valoresGestor[i][0] || '');
          if (anterior !== gestorEmail) {
            valoresGestor[i][0] = gestorEmail;
            eventos.push({
              nivel: nivelUpper, idTarget: rtValor, rol: 'GESTOR',
              usuarioAnterior: anterior, usuarioNuevo: gestorEmail,
              ejecutorEmail: ejecutorEmail, observaciones: observacion
            });
          }
        }
      }
    }

    if (valoresArticulador) sheet.getRange(2, colArticuladorSheet, totalFilas, 1).setValues(valoresArticulador);
    if (valoresGestor) sheet.getRange(2, colGestorSheet, totalFilas, 1).setValues(valoresGestor);

    let logsOk = 0, logsError = 0;
    eventos.forEach(function(ev) {
      const r = registrarLogAsignacion(ev);
      if (r && r.success) logsOk++; else logsError++;
    });

    _invalidarCacheDatosSiExiste();

    return {
      success: true,
      filasCoincidentes: filasAfectadas,
      cambiosAplicados: eventos.length,
      logsRegistrados: logsOk,
      logsConError: logsError
    };
  } catch (e) {
    console.error('❌ Error en asignarEquipoGranular: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/**
 * Handover 1-click: reemplaza usuarioOrigen por usuarioDestino en TODAS las filas de Datos
 * donde aparece como Articulador o Gestor (según `rol`), sin importar Proyecto/Tramo.
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
    const sheetName = getConfig('SHEETS.DATOS');
    const sheet = gestorDatos.getSheet(sheetName);
    const { headers, rows } = gestorDatos.leerDatos(sheetName);

    if (!headers.length) throw new Error('No se pudo leer la hoja Datos');

    const columnaConfigPath = rolUpper === 'ARTICULADOR' ? 'COLUMNS.ARTICULADOR_JURIDICO' : 'COLUMNS.GESTOR_JURIDICO';
    const idxColumna = findColumnIndex(headers, getConfig(columnaConfigPath));
    const idxRT = findColumnIndex(headers, getConfig('COLUMNS.RT'));

    if (idxColumna < 0) throw new Error('Columna de ' + rolUpper + ' no encontrada en Datos');

    const rtCol = headers[idxRT];
    const colSheet = idxColumna + 1;
    const totalFilas = rows.length;
    const valores = sheet.getRange(2, colSheet, totalFilas, 1).getValues();

    const eventos = [];
    let filasAfectadas = 0;
    const observacion = 'Handover masivo de ' + usuarioOrigen + ' a ' + usuarioDestino;

    for (let start = 0; start < totalFilas; start += EQUIPOS_ENGINE.batchSize) {
      const fin = Math.min(start + EQUIPOS_ENGINE.batchSize, totalFilas);
      for (let i = start; i < fin; i++) {
        const actual = String(valores[i][0] || '');
        if (actual !== usuarioOrigen) continue;

        valores[i][0] = usuarioDestino;
        filasAfectadas++;

        eventos.push({
          nivel: 'RT',
          idTarget: String(rows[i][rtCol] || ''),
          rol: rolUpper,
          usuarioAnterior: usuarioOrigen,
          usuarioNuevo: usuarioDestino,
          ejecutorEmail: ejecutorEmail,
          observaciones: observacion
        });
      }
    }

    if (filasAfectadas > 0) {
      sheet.getRange(2, colSheet, totalFilas, 1).setValues(valores);
    }

    let logsOk = 0, logsError = 0;
    eventos.forEach(function(ev) {
      const r = registrarLogAsignacion(ev);
      if (r && r.success) logsOk++; else logsError++;
    });

    _invalidarCacheDatosSiExiste();

    return {
      success: true,
      filasAfectadas: filasAfectadas,
      logsRegistrados: logsOk,
      logsConError: logsError
    };
  } catch (e) {
    console.error('❌ Error en reasignarUsuarioMasivo: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}
