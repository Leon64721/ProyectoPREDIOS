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
