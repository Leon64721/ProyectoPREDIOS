// ═══════════════════════════════════════════════════════════════════════════════
// PAC_API.GS — API pública PAC v3.0
// ═══════════════════════════════════════════════════════════════════════════════

function getPACData(filtros, modoEjecucion) {
  try {
    filtros = filtros || {};
    modoEjecucion = modoEjecucion || PAC_CONFIG.MODOS_EJECUCION.RADICADO;

    var ss = pac_getSpreadsheet();
    var hVig = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.VIGENTE);
    if (!hVig || hVig.getLastRow() < 2) {
      return JSON.stringify({
        success: false,
        necesitaInstalacion: true,
        error: 'PAC no inicializado. Ejecute instalarModuloPACCompleto()'
      });
    }

    var matrizData = pac_leerMatrizPredial();
    // ✅ FASE 5b: esta sincronización es una ESCRITURA (actualiza ESTADO_PREDIAL_ACTUAL
    // en PAC_Vigente desde la matriz) — corre SIEMPRE, en cache-hit y cache-miss por
    // igual. Solo se cachea el cálculo de abajo (lectura pura), nunca este paso.
    pac_actualizarEstadosDesdeMatrizBatch(ss, hVig, matrizData);

    var cache = CacheService.getScriptCache();
    var cacheKey = _pac_buildCacheKey(filtros, modoEjecucion);
    var cached = cache.get(cacheKey);
    if (cached) return cached; // ya es el JSON.stringify final, se retorna tal cual

    var resultado = calcularSemaforoPAC(filtros, modoEjecucion, matrizData);
    if (!resultado.success) return JSON.stringify(resultado);

    var proyectos = [];
    var articuladores = [];
    var gestores = [];

    var mapProy = {}, mapArt = {}, mapGest = {};
    (resultado.registros || []).forEach(function(r) {
      if (r.proyecto && !mapProy[r.proyecto]) {
        mapProy[r.proyecto] = true;
        proyectos.push(r.proyecto);
      }
      if (r.articulador && !mapArt[r.articulador]) {
        mapArt[r.articulador] = true;
        articuladores.push(r.articulador);
      }
      if (r.gestor && !mapGest[r.gestor]) {
        mapGest[r.gestor] = true;
        gestores.push(r.gestor);
      }
    });

    proyectos.sort();
    articuladores.sort();
    gestores.sort();

    var payload = JSON.stringify({
      success: true,
      necesitaInstalacion: false,
      registros: resultado.registros,
      totales: resultado.totales,
      pctEjecucionRad: resultado.pctEjecucionRadicado,
      pctEjecucionEjec: resultado.pctEjecucionEjecutado,
      pctMesRadicado: resultado.pctMesRadicado,
      pctMesEjecutado: resultado.pctMesEjecutado,
      modoEjecucion: modoEjecucion,
      mesActual: resultado.mesActual,
      meses: PAC_CONFIG.MESES,
      proyectos: proyectos,
      articuladores: articuladores,
      gestores: gestores,
      recomendaciones: resultado.recomendaciones,
      reglasMotor: pac_cargarReglasReemplazo(),
      timestamp: new Date().toISOString()
    });

    // ✅ FASE 5b: put() lanza síncronamente si supera 100KB — fallback a no-cachear
    // (fail-open), el payload ya calculado se retorna igual.
    try {
      cache.put(cacheKey, payload, 900); // 15 min TTL — PAC cambia más seguido que el dashboard
    } catch (e) {
      pac_log('No se pudo cachear getPACData (posible overflow 100KB de CacheService): ' + e.message, 'ADVERTENCIA');
    }

    return payload;
  } catch(e) {
    pac_log('Error getPACData: ' + e.message, 'ERROR');
    return JSON.stringify({ success:false, error:e.message });
  }
}

/**
 * ✅ FASE 5b: construye la cache-key de getPACData a partir de filtros+modoEjecucion.
 * Incluye CACHE_KEY_PAC_VERSION (cache_backend.gs) para que invalidateDataCache()
 * invalide todas las combinaciones de filtros a la vez sin tener que enumerarlas.
 */
function _pac_buildCacheKey(filtros, modoEjecucion) {
  var version = CacheService.getScriptCache().get(CACHE_KEY_PAC_VERSION) || '0';
  var serializado = JSON.stringify(filtros || {}) + '|' + String(modoEjecucion || '');
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, serializado);
  var hash = digestBytes.map(function(b) { return (b + 256).toString(16).slice(-2); }).join('');
  return 'pac_v' + version + '_' + hash;
}

function pac_actualizarEstadosDesdeMatrizBatch(ss, hVig, matrizData) {
  try {
    if (!hVig || hVig.getLastRow() < 2 || !matrizData) return;

    var datos = hVig.getDataRange().getValues();
    var headers = datos[0].map(function(h) { return String(h).trim(); });
    var idxRT = pac_getColIdx(headers, 'RT');
    if (idxRT < 0) return;

    var idxEstado = pac_getColIdx(headers, 'ESTADO_PREDIAL_ACTUAL');
    if (idxEstado < 0) {
      hVig.getRange(1, headers.length + 1).setValue('ESTADO_PREDIAL_ACTUAL');
      idxEstado = headers.length;
      headers.push('ESTADO_PREDIAL_ACTUAL');
      datos = hVig.getDataRange().getValues();
    }

    var salida = [];
    var cambios = 0;

    for (var i = 1; i < datos.length; i++) {
      var rt = String(datos[i][idxRT] || '').trim();
      var estadoActual = String(datos[i][idxEstado] || '').trim();
      var matrizReg = matrizData[rt] || {};
      var estadoNuevo = String(
        matrizReg['ESTADO PREDIAL AJUSTADO'] || matrizReg['ESTADO PREDIAL'] || estadoActual || ''
      ).trim();

      if (estadoNuevo !== estadoActual) cambios++;
      salida.push([estadoNuevo]);
    }

    hVig.getRange(2, idxEstado + 1, salida.length, 1).setValues(salida);
    if (cambios) pac_log('Estados actualizados en batch real: ' + cambios);
  } catch(e) {
    pac_log('Error actualizando estados batch: ' + e.message, 'ERROR');
  }
}

function guardarReglasMotorPACApi(reglasJSON) {
  try {
    pac_verificarRolAdmin();
    var reglas = JSON.parse(reglasJSON);
    return JSON.stringify(pac_guardarReglasReemplazo(reglas));
  } catch(e) {
    return JSON.stringify({ success:false, error:e.message });
  }
}

function pac_guardarReglasReemplazo(reglas) {
  try {
    var ss = pac_getSpreadsheet();
    var hoja = ss.getSheetByName('PAC_ReglasPAC');
    if (!hoja) hoja = ss.insertSheet('PAC_ReglasPAC');

    hoja.clearContents();
    var filas = [['ID','NOMBRE','CAMPO','OPERADOR','VALORES','ACTIVA','DESCRIPCION']];

    reglas.forEach(function(r) {
      filas.push([
        r.id,
        r.nombre,
        r.campo,
        r.operador,
        Array.isArray(r.valores) ? r.valores.join('|') : String(r.valores || ''),
        r.activa ? 'TRUE' : 'FALSE',
        r.descripcion || ''
      ]);
    });

    hoja.getRange(1, 1, filas.length, filas[0].length).setValues(filas);
    _PAC_RUNTIME_CACHE.reglas = null;
    return { success:true };
  } catch(e) {
    return { success:false, error:e.message };
  }
}

function pac_obtenerArticuladores() {
  try {
    var matriz = pac_leerMatrizPredial();
    var map = {};
    Object.keys(matriz).forEach(function(rt) {
      var m = matriz[rt] || {};
      var art = String(
        m['ARTICULADOR JURIDICO'] || m['ARTICULADOR JUIRIDICO'] || m['ARTICULADOR'] || ''
      ).trim();
      var ges = String(m['GESTOR JURÍDICO'] || m['GESTOR JURIDICO'] || m['GESTOR'] || '').trim();
      var proy = String(m['PROYECTO'] || m['NOMBRE PROYECTO'] || m['TRONCAL'] || '').trim();

      if (art) map['A|' + art + '|' + proy] = { tipo:'ARTICULADOR', NOMBRE:art, PROYECTO:proy, CORREO:'' };
      if (ges) map['G|' + ges + '|' + proy] = { tipo:'GESTOR', NOMBRE:ges, PROYECTO:proy, CORREO:'' };
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  } catch(e) {
    return [];
  }
}

function pac_obtenerUsuariosReporte() {
  try {
    var ss = pac_getSpreadsheet();
    var hoja = ss.getSheetByName('USUARIOS');
    if (!hoja || hoja.getLastRow() < 2) return [];

    var datos = hoja.getDataRange().getValues();
    var headers = datos[0].map(function(h) { return String(h).trim(); });

    var idxNombre = pac_getColIdx(headers, 'NOMBRE');
    var idxCorreo = pac_getColIdx(headers, 'CORREO');
    var idxProyecto = pac_getColIdx(headers, 'PROYECTO');
    var idxRol = pac_getColIdx(headers, 'ROL');
    var idxActivo = pac_getColIdx(headers, 'ACTIVO');

    var usuarios = [];

    for (var i = 1; i < datos.length; i++) {
      var correo = idxCorreo >= 0 ? String(datos[i][idxCorreo] || '').trim() : '';
      if (!correo || correo.indexOf('@') < 0) continue;

      var activo = idxActivo >= 0 ? datos[i][idxActivo] : true;
      if (activo === false || String(activo).toUpperCase() === 'FALSE') continue;

      usuarios.push({
        nombre: idxNombre >= 0 ? String(datos[i][idxNombre] || '').trim() : '',
        correo: correo,
        proyecto: idxProyecto >= 0 ? String(datos[i][idxProyecto] || '').trim() : 'ALL',
        rol: idxRol >= 0 ? String(datos[i][idxRol] || '').trim() : ''
      });
    }

    return usuarios;
  } catch(e) {
    pac_log('Error leyendo usuarios de reporte: ' + e.message, 'ERROR');
    return [];
  }
}

function enviarReportesSeguimientoPACApi() {
  try {
    pac_verificarRolAdmin();

    var data = JSON.parse(getPACData({}, PAC_CONFIG.MODOS_EJECUCION.RADICADO));
    if (!data.success) return JSON.stringify(data);

    var usuarios = pac_obtenerUsuariosReporte();
    if (!usuarios.length) {
      return JSON.stringify({ success:false, error:'No hay usuarios activos con correo en hoja USUARIOS' });
    }

    var enviados = 0;

    usuarios.forEach(function(u) {
      var registros = (data.registros || []).filter(function(r) {
        if (!u.proyecto || u.proyecto === 'ALL') return (r.semaforo === 'ROJO' || r.semaforo === 'NARANJA' || r.semaforo === 'AMARILLO');
        return r.proyecto === u.proyecto && (r.semaforo === 'ROJO' || r.semaforo === 'NARANJA' || r.semaforo === 'AMARILLO');
      });

      if (!registros.length) return;

      var html = pac_construirReporteSeguimientoHTML(u, registros, data);
      GmailApp.sendEmail(u.correo, 'Seguimiento PAC 2026 — Reporte manual', 'Reporte PAC', { htmlBody: html });
      enviados++;
    });

    return JSON.stringify({ success:true, enviados:enviados });
  } catch(e) {
    return JSON.stringify({ success:false, error:e.message });
  }
}
function pac_construirReporteSeguimientoHTML(usuario, registros, data) {
  var filas = registros.slice(0, 50).map(function(r) {
    return '<tr>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + r.rt + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + r.proyecto + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + (r.articulador || '—') + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + (r.gestor || '—') + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + r.estadoPredial + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + r.semaforo + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + pac_formatMoney(r.programadoMes || 0) + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + (r.semaforoRazon || '') + '</td>' +
      '</tr>';
  }).join('');

  return '<div style="font-family:Arial,sans-serif;max-width:1000px;margin:0 auto;">' +
    '<h2 style="background:#2c3e50;color:white;padding:14px 18px;border-radius:8px 8px 0 0;">Seguimiento PAC 2026</h2>' +
    '<div style="padding:18px;border:1px solid #ddd;background:#f8f9fa;">' +
    '<p><strong>Destinatario:</strong> ' + (usuario.nombre || usuario.correo) + '</p>' +
    '<p><strong>Proyecto:</strong> ' + (usuario.proyecto || 'ALL') + '</p>' +
    '<p><strong>Fecha:</strong> ' + new Date().toLocaleString('es-CO') + '</p>' +
    '<p><strong>Registros incluidos:</strong> ' + registros.length + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<thead><tr style="background:#34495e;color:white;">' +
    '<th style="padding:8px;">RT</th>' +
    '<th style="padding:8px;">Proyecto</th>' +
    '<th style="padding:8px;">Articulador</th>' +
    '<th style="padding:8px;">Gestor</th>' +
    '<th style="padding:8px;">Estado Predial</th>' +
    '<th style="padding:8px;">Semáforo</th>' +
    '<th style="padding:8px;">Programado Mes</th>' +
    '<th style="padding:8px;">Razón</th>' +
    '</tr></thead><tbody>' + filas + '</tbody></table></div></div>';
}


function sincronizarPACApi() {
  try {
    pac_verificarRolAdmin();
    return JSON.stringify(sincronizarPAC());
  } catch(e) {
    return JSON.stringify({ success:false, error:e.message });
  }
}

function aprobarBorradorPACApi(observacion) {
  try {
    pac_verificarRolAdmin();
    return JSON.stringify(aprobarBorradorPAC(observacion));
  } catch(e) {
    return JSON.stringify({ success:false, error:e.message });
  }
}

function pac_verificarRolAdmin() {
  try {
    if (typeof CONFIG === 'undefined') return;
    if (typeof verificarRol === 'function') verificarRol(CONFIG.ROLES.ADMIN);
  } catch(e) {
    throw new Error('Acceso denegado: ' + e.message);
  }
}
