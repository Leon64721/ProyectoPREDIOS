// ═══════════════════════════════════════════════════════════════════════════════
// PAC_GESTOR.GS — Motor Principal PAC v3.0
// Optimizado: filtros desde MATRIZ, score reemplazo, batch real, índices precalculados
// ═══════════════════════════════════════════════════════════════════════════════

function pac_leerHojaExterna(nombreHoja, fuente) {
  try {
    var cacheKey = PAC_CONFIG.PAC_SPREADSHEET_ID + '::' + nombreHoja;
    if (typeof _PAC_RUNTIME_CACHE === 'undefined') _PAC_RUNTIME_CACHE = {};
    if (!_PAC_RUNTIME_CACHE.externas) _PAC_RUNTIME_CACHE.externas = {};
    if (_PAC_RUNTIME_CACHE.externas[cacheKey]) return _PAC_RUNTIME_CACHE.externas[cacheKey];

    var extSS = SpreadsheetApp.openById(PAC_CONFIG.PAC_SPREADSHEET_ID);
    var hoja = extSS.getSheetByName(nombreHoja);
    if (!hoja) return null;
    // Leer solo el rango de datos real para evitar overhead
    var lastRow = hoja.getLastRow();
    var lastCol = hoja.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return null;
    var datos = hoja.getRange(1, 1, lastRow, lastCol).getValues();
    if (datos.length < 2) return null;

    var headers = datos[0].map(function(h) { return String(h).trim(); });
    var C = PAC_CONFIG.COLUMNAS;
    var idx = {
      CRP:             pac_getColIdx(headers, C.CRP),
      RT:              pac_getColIdx(headers, C.RT),
      TIPO_NEG:        pac_getColIdx(headers, C.TIPO_NEG),
      BENEFICIARIO:    pac_getColIdx(headers, C.BENEFICIARIO),
      PROYECTO:        pac_getColIdx(headers, C.PROYECTO),
      SALDO_2026:      pac_getColIdx(headers, C.SALDO_2026),
      CDP:             pac_getColIdx(headers, C.CDP),
      CDP_VALOR:       pac_getColIdx(headers, C.CDP_VALOR),
      OBSERVACIONES:   pac_getColIdx(headers, C.OBSERVACIONES),
      SALDO_POR_PAGAR: pac_getColIdx(headers, C.SALDO_POR_PAGAR),
      FORMA_PAGO:      pac_getColIdx(headers, C.FORMA_PAGO),
      NUM_PAGOS:       pac_getColIdx(headers, C.NUM_PAGOS),
      CDP_TOTAL:       pac_getColIdx(headers, C.CDP_TOTAL),
      CRP_TOTAL:       pac_getColIdx(headers, C.CRP_TOTAL)
    };

    var mapaMensual = pac_construirMapaMensual(headers);
    var filas = [];

    for (var i = 1; i < datos.length; i++) {
      var fila = datos[i];
      var rt = idx.RT >= 0 ? String(fila[idx.RT] || '').trim() : '';
      if (!rt) continue;

      var reg = {
        CRP:             idx.CRP             >= 0 ? fila[idx.CRP] : '',
        RT:              rt,
        TIPO_NEG:        idx.TIPO_NEG        >= 0 ? fila[idx.TIPO_NEG] : '',
        BENEFICIARIO:    idx.BENEFICIARIO    >= 0 ? fila[idx.BENEFICIARIO] : '',
        PROYECTO:        idx.PROYECTO        >= 0 ? fila[idx.PROYECTO] : '',
        FUENTE:          fuente,
        SALDO_2026:      idx.SALDO_2026      >= 0 ? pac_parseMoney(fila[idx.SALDO_2026]) : 0,
        CDP:             idx.CDP             >= 0 ? fila[idx.CDP] : '',
        CDP_VALOR:       idx.CDP_VALOR       >= 0 ? pac_parseMoney(fila[idx.CDP_VALOR]) : 0,
        OBSERVACIONES:   idx.OBSERVACIONES   >= 0 ? fila[idx.OBSERVACIONES] : '',
        SALDO_POR_PAGAR: idx.SALDO_POR_PAGAR >= 0 ? pac_parseMoney(fila[idx.SALDO_POR_PAGAR]) : 0,
        FORMA_PAGO:      idx.FORMA_PAGO      >= 0 ? fila[idx.FORMA_PAGO] : '',
        NUM_PAGOS:       idx.NUM_PAGOS       >= 0 ? fila[idx.NUM_PAGOS] : '',
        CDP_TOTAL:       idx.CDP_TOTAL       >= 0 ? pac_parseMoney(fila[idx.CDP_TOTAL]) : 0,
        CRP_TOTAL:       idx.CRP_TOTAL       >= 0 ? pac_parseMoney(fila[idx.CRP_TOTAL]) : 0,
        meses: {}
      };

      PAC_CONFIG.MESES.forEach(function(mes) {
        var b = mapaMensual[mes];
        reg.meses[mes] = {
          PROGRAMADO:      b.PROG  >= 0 ? pac_parseMoney(fila[b.PROG]) : 0,
          VALOR_RADICADO:  b.RAD   >= 0 ? pac_parseMoney(fila[b.RAD]) : 0,
          FECHA_RADICADO:  b.FECHA >= 0 ? fila[b.FECHA] : '',
          OP:              b.OP    >= 0 ? fila[b.OP] : '',
          VALOR_EJECUTADO: b.EJEC  >= 0 ? pac_parseMoney(fila[b.EJEC]) : 0,
          LIBERACION:      b.LIB   >= 0 ? pac_parseMoney(fila[b.LIB]) : 0
        };
      });

      filas.push(reg);
    }
      var result = { headers: headers, mapaMensual: mapaMensual, filas: filas };
      // Cache por ejecución para evitar relecturas costosas
      try { _PAC_RUNTIME_CACHE.externas[cacheKey] = result; } catch(e) {}
      return result;
  } catch(e) {
    pac_log('Error leyendo hoja externa ' + nombreHoja + ': ' + e.message, 'ERROR');
    return null;
  }
}

function pac_leerMatrizPredial() {
  if (_PAC_RUNTIME_CACHE.matriz) return _PAC_RUNTIME_CACHE.matriz;

  try {
    var ss = pac_getSpreadsheet();
    var nombreHoja = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS && CONFIG.SHEETS.DATOS)
      ? CONFIG.SHEETS.DATOS : 'Datos';

    var hoja = ss.getSheetByName(nombreHoja);
    if (!hoja || hoja.getLastRow() < 2) return {};

    var datos = hoja.getDataRange().getValues();
    var headers = datos[0].map(function(h) { return String(h).trim(); });
    var idxRT = pac_getColIdx(headers, 'RT');
    if (idxRT < 0) return {};

    var mapa = {};
    for (var i = 1; i < datos.length; i++) {
      var rt = String(datos[i][idxRT] || '').trim();
      if (!rt) continue;
      var reg = {};
      for (var c = 0; c < headers.length; c++) reg[headers[c]] = datos[i][c];
      mapa[rt] = reg;
    }

    _PAC_RUNTIME_CACHE.matriz = mapa;
    return mapa;
  } catch(e) {
    pac_log('Error leyendo Matriz Predial: ' + e.message, 'ERROR');
    return {};
  }
}

function pac_construirMapaObservaciones() {
  if (_PAC_RUNTIME_CACHE.observaciones) return _PAC_RUNTIME_CACHE.observaciones;

  try {
    var ss = pac_getSpreadsheet();
    var nombreHoja = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS && CONFIG.SHEETS.SEGUIMIENTO)
      ? CONFIG.SHEETS.SEGUIMIENTO : 'SEGUIMIENTO';

    var hoja = ss.getSheetByName(nombreHoja);
    if (!hoja || hoja.getLastRow() < 2) return {};

    var datos = hoja.getDataRange().getValues();
    var headers = datos[0].map(function(h) { return String(h).trim(); });
    var idxRT = pac_getColIdx(headers, 'RT');
    var idxObs = pac_getColIdx(headers, 'OBSERVACIONES');
    var idxFecha = pac_getColIdx(headers, 'FECHA_REGISTRO');
    var idxUser = pac_getColIdx(headers, 'USUARIO');

    var mapa = {};
    for (var i = 1; i < datos.length; i++) {
      var rt = String(datos[i][idxRT] || '').trim().toUpperCase();
      var obs = String(datos[i][idxObs] || '').trim();
      if (!rt || !obs) continue;
      if (!mapa[rt]) mapa[rt] = [];
      mapa[rt].push({
        fecha: idxFecha >= 0 ? datos[i][idxFecha] : '',
        obs: obs,
        usuario: idxUser >= 0 ? datos[i][idxUser] : ''
      });
    }

    Object.keys(mapa).forEach(function(rt) {
      mapa[rt].sort(function(a, b) {
        return new Date(b.fecha) - new Date(a.fecha);
      });
    });

    _PAC_RUNTIME_CACHE.observaciones = mapa;
    return mapa;
  } catch(e) {
    pac_log('Error construyendo observaciones: ' + e.message, 'ERROR');
    return {};
  }
}

function pac_leerVigente() {
  if (_PAC_RUNTIME_CACHE.vigente) return _PAC_RUNTIME_CACHE.vigente;

  try {
    var ss = pac_getSpreadsheet();
    var hoja = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.VIGENTE);
    if (!hoja || hoja.getLastRow() < 2) return {};

    var datos = hoja.getDataRange().getValues();
    var headers = datos[0].map(function(h) { return String(h).trim(); });
    var idxRT = pac_getColIdx(headers, 'RT');

    var mapa = {
      headers: headers,
      rows: datos,
      byRT: {}
    };

    for (var i = 1; i < datos.length; i++) {
      var rt = String(datos[i][idxRT] || '').trim();
      if (!rt) continue;
      if (!mapa.byRT[rt]) mapa.byRT[rt] = [];
      mapa.byRT[rt].push({ fila: i + 1, datos: datos[i] });
    }

    _PAC_RUNTIME_CACHE.vigente = mapa;
    return mapa;
  } catch(e) {
    pac_log('Error leyendo vigente: ' + e.message, 'ERROR');
    return {};
  }
}

function pac_construirDatosMensualesDesdeMapa(fila, mapaMensual, modoEjecucion) {
  var meses = {};
  PAC_CONFIG.MESES.forEach(function(mes) {
    var b = mapaMensual[mes] || {};
    var prog = b.PROG >= 0 ? pac_parseMoney(fila[b.PROG]) : 0;
    var rad  = b.RAD  >= 0 ? pac_parseMoney(fila[b.RAD])  : 0;
    var ejec = b.EJEC >= 0 ? pac_parseMoney(fila[b.EJEC]) : 0;
    var ejecActual = modoEjecucion === PAC_CONFIG.MODOS_EJECUCION.EJECUTADO ? ejec : rad;
    var pct = prog > 0 ? Math.min(100, (ejecActual / prog) * 100) : (ejecActual > 0 ? 100 : 0);

    meses[mes] = {
      PROGRAMADO:             prog,
      VALOR_RADICADO:         rad,
      FECHA_RADICADO:         b.FECHA >= 0 ? fila[b.FECHA] : '',
      OP:                     b.OP >= 0 ? fila[b.OP] : '',
      VALOR_EJECUTADO:        ejec,
      LIBERACION:             b.LIB >= 0 ? pac_parseMoney(fila[b.LIB]) : 0,
      VALOR_EJECUCION_ACTUAL: ejecActual,
      PCT_EJECUCION:          pct.toFixed(1)
    };
  });
  return meses;
}

function pac_extraerInfoMatriz(matrizReg, fallbackProyecto) {
  matrizReg = matrizReg || {};

  var proyecto = String(
    matrizReg['PROYECTO'] ||
    matrizReg['NOMBRE PROYECTO'] ||
    matrizReg['TRONCAL'] ||
    fallbackProyecto ||
    ''
  ).trim();

  var articulador = String(
    matrizReg['ARTICULADOR JURIDICO'] ||
    matrizReg['ARTICULADOR JUIRIDICO'] ||
    matrizReg['ARTICULADOR'] ||
    ''
  ).trim();

  var gestor = String(
    matrizReg['GESTOR JURÍDICO'] ||
    matrizReg['GESTOR JURIDICO'] ||
    matrizReg['GESTOR'] ||
    ''
  ).trim();

  var estadoPredial = String(
    matrizReg['ESTADO PREDIAL AJUSTADO'] ||
    matrizReg['ESTADO PREDIAL'] ||
    ''
  ).trim().toUpperCase();

  var saldoPorPagar = pac_parseMoney(
    matrizReg['VALOR CRP PASIVOS 2026'] ||
    matrizReg['SALDO CTS X PAGAR 2026'] ||
    matrizReg['SALDO POR PAGAR'] ||
    0
  );

  return {
    proyecto: proyecto,
    proyectoNorm: pac_normalizarTexto(proyecto),
    articulador: articulador,
    gestor: gestor,
    estadoPredial: estadoPredial,
    saldoPorPagar: saldoPorPagar,
    formaPago: matrizReg['FORMA DE PAGO'] || '',
    numeroPagos: matrizReg['NUMERO DE PAGOS'] || '',
    cdpTotal: pac_parseMoney(matrizReg['CDP TOTAL'] || 0),
    crpTotal: pac_parseMoney(matrizReg['CRP TOTAL'] || 0),
    escritura: matrizReg['ESCRITURA'] || matrizReg['NRO ESCRITURA'] || '',
    fechaEscritura: matrizReg['FECHA ESCRITURA'] || '',
    disponibilidad: matrizReg['PREDIOS DISPONIBLES (INCLUYE CESIONES)'] || '',
    estadoTitulos: matrizReg['ESTADO TITULOS'] || '',
    estadoAvaluo: matrizReg['ESTADO AVALUO'] || '',
    _todosLosCampos: matrizReg
  };
}

function pac_calcularColorSemaforo(programadoMes, ejecMes, estadoPredial, hoy, acumProgHasta, acumEjecHasta) {
  var infoEstado = PAC_ESTADOS[pac_normalizarTexto(estadoPredial)] || { nivel:0, elegible:false };
  var esElegible = !!infoEstado.elegible;
  var finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  var diasRestantes = Math.floor((finMes - hoy) / (1000 * 60 * 60 * 24));

  if (acumProgHasta > 0 && acumEjecHasta >= acumProgHasta * 0.95) {
    return { color:'VERDE', label:'Al día', razon:'Cobertura acumulada suficiente' };
  }
  if (ejecMes > 0 && programadoMes === 0) {
    return { color:'VERDE', label:'Pago adelantado', razon:'Pago ejecutado fuera del mes programado' };
  }
  if (programadoMes <= 0 && ejecMes <= 0) {
    return { color:'VERDE', label:'Sin Programación', razon:'No tiene programación en el período actual' };
  }

  var pct = programadoMes > 0 ? (ejecMes / programadoMes) * 100 : 0;
  if (pct >= 95) return { color:'VERDE', label:'En Tiempo', razon:'Cumplimiento del período >= 95%' };
  if (diasRestantes >= 30 && esElegible) return { color:'AMARILLO', label:'En Riesgo', razon:'Predio elegible pero sin ejecución suficiente' };
  if (diasRestantes >= 0 && esElegible) return { color:'NARANJA', label:'Crítico', razon:'Predio elegible con urgencia de radicación' };
  if (!esElegible && programadoMes > 0) return { color:'ROJO', label:'Incumplimiento', razon:'Predio no elegible con valor programado' };

  return { color:'AMARILLO', label:'En Riesgo', razon:'Seguimiento requerido' };
}

function calcularSemaforoPAC(filtros, modoEjecucion, matrizDataExterno) {
  try {
    filtros = filtros || {};
    modoEjecucion = modoEjecucion || PAC_CONFIG.MODOS_EJECUCION.RADICADO;

    var ss = pac_getSpreadsheet();
    var hoja = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.VIGENTE);
    if (!hoja || hoja.getLastRow() < 2) {
      return { success:false, error:'PAC Vigente vacío' };
    }

    var datos = hoja.getDataRange().getValues();
    var headers = datos[0].map(function(h) { return String(h).trim(); });
    var mapaMensual = pac_construirMapaMensual(headers);
    var matrizData = matrizDataExterno || pac_leerMatrizPredial();
    var mapaObs = pac_construirMapaObservaciones();

    var idx = {
      RT:          pac_getColIdx(headers, 'RT'),
      CRP:         pac_getColIdx(headers, 'CRP'),
      PROYECTO:    pac_getColIdx(headers, 'PROYECTO'),
      FUENTE:      pac_getColIdx(headers, 'FUENTE'),
      TIPO_NEG:    pac_getColIdx(headers, 'TIPO_NEG'),
      BENEF:       pac_getColIdx(headers, 'BENEFICIARIO'),
      SALDO_2026:  pac_getColIdx(headers, 'SALDO_2026'),
      CDP:         pac_getColIdx(headers, 'CDP'),
      CDP_VALOR:   pac_getColIdx(headers, 'CDP_VALOR')
    };

    var hoy = new Date();
    var mesActual = filtros.mesActual || PAC_CONFIG.MESES[hoy.getMonth()];
    var idxMesActual = PAC_CONFIG.MESES.indexOf(mesActual);
    var resultados = [];
    var totales = {
      VERDE:0, AMARILLO:0, NARANJA:0, ROJO:0,
      totalProgramado:0, totalRadicado:0, totalEjecutado:0,
      totalProgMes:0, totalRadMes:0, totalEjecMes:0
    };

    for (var i = 1; i < datos.length; i++) {
      var fila = datos[i];
      var rt = String(fila[idx.RT] || '').trim();
      if (!rt) continue;

      var crp = String(fila[idx.CRP] || '').trim();
      var llavePac = crp ? (crp + '_' + rt) : rt;
      var fuente = String(fila[idx.FUENTE] || '').trim();
      var matrizReg = matrizData[rt] || {};
      var infoMatriz = pac_extraerInfoMatriz(matrizReg, fila[idx.PROYECTO]);

      // ── Filtros desde MATRIZ ─────────────────────────────────────────────
      if (filtros.proyecto && filtros.proyecto !== 'ALL' && infoMatriz.proyecto !== filtros.proyecto) continue;
      if (filtros.fuente && filtros.fuente !== 'ALL' && fuente !== filtros.fuente) continue;
      if (filtros.rt && String(rt).toUpperCase().indexOf(String(filtros.rt).toUpperCase()) < 0) continue;
      if (filtros.articulador && filtros.articulador !== 'ALL' && infoMatriz.articulador !== filtros.articulador) continue;
      if (filtros.gestor && filtros.gestor !== 'ALL' && infoMatriz.gestor !== filtros.gestor) continue;

      var datosMensuales = pac_construirDatosMensualesDesdeMapa(fila, mapaMensual, modoEjecucion);

      var acumProgAnual = 0, acumRadAnual = 0, acumEjecAnual = 0;
      var acumProgHasta = 0, acumRadHasta = 0, acumEjecHasta = 0;
      PAC_CONFIG.MESES.forEach(function(mes, idxMes) {
        var m = datosMensuales[mes];
        acumProgAnual += m.PROGRAMADO || 0;
        acumRadAnual  += m.VALOR_RADICADO || 0;
        acumEjecAnual += m.VALOR_EJECUTADO || 0;
        if (idxMes <= idxMesActual) {
          acumProgHasta += m.PROGRAMADO || 0;
          acumRadHasta  += m.VALOR_RADICADO || 0;
          acumEjecHasta += m.VALOR_EJECUTADO || 0;
        }
      });

      var mActual = datosMensuales[mesActual] || {};
      var progMes = mActual.PROGRAMADO || 0;
      var radMes = mActual.VALOR_RADICADO || 0;
      var ejecMes = mActual.VALOR_EJECUTADO || 0;
      var ejecMesActual = modoEjecucion === PAC_CONFIG.MODOS_EJECUCION.EJECUTADO ? ejecMes : radMes;
      var ejecHastaActual = modoEjecucion === PAC_CONFIG.MODOS_EJECUCION.EJECUTADO ? acumEjecHasta : acumRadHasta;

      var semaforo = pac_calcularColorSemaforo(
        progMes, ejecMesActual, infoMatriz.estadoPredial, hoy, acumProgHasta, ejecHastaActual
      );

      if (filtros.semaforo && filtros.semaforo !== 'ALL' && semaforo.color !== filtros.semaforo) continue;
      if (filtros.tipoNeg && filtros.tipoNeg !== 'ALL' &&
          pac_normalizarTexto(fila[idx.TIPO_NEG]) !== pac_normalizarTexto(filtros.tipoNeg)) continue;

      totales[semaforo.color]++;
      totales.totalProgramado += acumProgAnual;
      totales.totalRadicado += acumRadAnual;
      totales.totalEjecutado += acumEjecAnual;
      totales.totalProgMes += progMes;
      totales.totalRadMes += radMes;
      totales.totalEjecMes += ejecMes;

      resultados.push({
        llavePac: llavePac,
        rt: rt,
        crp: crp,
        proyecto: infoMatriz.proyecto,
        proyectoNorm: infoMatriz.proyectoNorm,
        fuente: fuente,
        tipoNeg: String(fila[idx.TIPO_NEG] || ''),
        articulador: infoMatriz.articulador,
        gestor: infoMatriz.gestor,
        beneficiario: String(fila[idx.BENEF] || ''),
        saldo2026: pac_parseMoney(fila[idx.SALDO_2026] || 0),
        cdp: String(fila[idx.CDP] || ''),
        cdpValor: pac_parseMoney(fila[idx.CDP_VALOR] || 0),
        estadoPredial: infoMatriz.estadoPredial,
        observaciones: mapaObs[String(rt).toUpperCase()] || [],
        semaforo: semaforo.color,
        semaforoLabel: semaforo.label,
        semaforoRazon: semaforo.razon,
        mesActual: mesActual,
        programadoMes: progMes,
        valorRadicadoMes: radMes,
        valorEjecutadoMes: ejecMes,
        valorEjecucionActual: ejecMesActual,
        fechaRadicado: mActual.FECHA_RADICADO || '',
        acumProgAnual: acumProgAnual,
        acumRadAnual: acumRadAnual,
        acumEjecAnual: acumEjecAnual,
        acumProgHasta: acumProgHasta,
        acumRadHasta: acumRadHasta,
        acumEjecHasta: acumEjecHasta,
        pctEjecucion: (acumProgHasta > 0 ? Math.min(100, (ejecHastaActual / acumProgHasta) * 100) : 0).toFixed(1),
        pctEjecucionMes: (progMes > 0 ? Math.min(100, (ejecMesActual / progMes) * 100) : (ejecMesActual > 0 ? 100 : 0)).toFixed(1),
        pctEjecAcum: (acumProgHasta > 0 ? Math.min(100, (ejecHastaActual / acumProgHasta) * 100) : 0).toFixed(1),
        datosMensuales: datosMensuales,
        matrizInfo: infoMatriz
      });
    }

    var pctRad = totales.totalProgramado > 0 ? (totales.totalRadicado / totales.totalProgramado * 100).toFixed(1) : '0.0';
    var pctEjec = totales.totalProgramado > 0 ? (totales.totalEjecutado / totales.totalProgramado * 100).toFixed(1) : '0.0';

    var recomendaciones = pac_generarRecomendaciones(resultados, modoEjecucion, matrizData);

    return {
      success: true,
      registros: resultados,
      totales: totales,
      pctEjecucionRadicado: pctRad,
      pctEjecucionEjecutado: pctEjec,
      pctMesRadicado: totales.totalProgMes > 0 ? (totales.totalRadMes / totales.totalProgMes * 100).toFixed(1) : '0.0',
      pctMesEjecutado: totales.totalProgMes > 0 ? (totales.totalEjecMes / totales.totalProgMes * 100).toFixed(1) : '0.0',
      modoEjecucion: modoEjecucion,
      mesActual: mesActual,
      recomendaciones: recomendaciones
    };
  } catch(e) {
    pac_log('Error calculando semáforo: ' + e.message, 'ERROR');
    return { success:false, error:e.message };
  }
}

function pac_cargarReglasReemplazo() {
  if (_PAC_RUNTIME_CACHE.reglas) return _PAC_RUNTIME_CACHE.reglas;

  try {
    var ss = pac_getSpreadsheet();
    var hoja = ss.getSheetByName('PAC_ReglasPAC');
    if (!hoja || hoja.getLastRow() < 2) {
      _PAC_RUNTIME_CACHE.reglas = PAC_REGLAS_REEMPLAZO_DEFAULT;
      return PAC_REGLAS_REEMPLAZO_DEFAULT;
    }

    var datos = hoja.getDataRange().getValues();
    var headers = datos[0].map(function(h) { return String(h).trim(); });
    var reglas = [];

    for (var i = 1; i < datos.length; i++) {
      var fila = datos[i];
      var get = function(col) {
        var idx = pac_getColIdx(headers, col);
        return idx >= 0 ? fila[idx] : '';
      };

      reglas.push({
        id: String(get('ID')),
        nombre: String(get('NOMBRE')),
        campo: String(get('CAMPO')),
        operador: String(get('OPERADOR')),
        valores: String(get('VALORES')).split('|').map(function(v) { return v.trim(); }),
        activa: String(get('ACTIVA')).toUpperCase() === 'TRUE' || get('ACTIVA') === true,
        descripcion: String(get('DESCRIPCION'))
      });
    }

    _PAC_RUNTIME_CACHE.reglas = reglas.length ? reglas : PAC_REGLAS_REEMPLAZO_DEFAULT;
    return _PAC_RUNTIME_CACHE.reglas;
  } catch(e) {
    return PAC_REGLAS_REEMPLAZO_DEFAULT;
  }
}

function pac_getValorCampoReemplazo(registro, reglaCampo, mesesPeriodo) {
  mesesPeriodo = mesesPeriodo || [registro.mesActual];

  switch (reglaCampo) {
    case 'ESTADO PREDIAL AJUSTADO':
      return registro.estadoPredial || '';

    case 'PROYECTO':
      return registro.proyecto || '';

    case 'FUENTE':
      return registro.fuente || '';

    case 'SALDO 2026':
      return registro.saldo2026 || 0;

    case 'SALDO_REEMPLAZO':
      return pac_parseMoney(
        (registro.matrizInfo && registro.matrizInfo.saldoPorPagar) ||
        registro.saldo2026 ||
        0
      );

    case 'PROGRAMADO_PERIODO':
      var totalProg = 0;
      mesesPeriodo.forEach(function(m) {
        totalProg += ((registro.datosMensuales || {})[m] || {}).PROGRAMADO || 0;
      });
      return totalProg;

    case 'VALOR_RADICADO_MES':
      var totalRad = 0;
      mesesPeriodo.forEach(function(m) {
        totalRad += ((registro.datosMensuales || {})[m] || {}).VALOR_RADICADO || 0;
      });
      return totalRad;

    case 'VALOR_EJECUTADO_MES':
      var totalEjec = 0;
      mesesPeriodo.forEach(function(m) {
        totalEjec += ((registro.datosMensuales || {})[m] || {}).VALOR_EJECUTADO || 0;
      });
      return totalEjec;

    default:
      return ((registro.matrizInfo || {})._todosLosCampos || {})[reglaCampo] || '';
  }
}

function pac_getValorOrigenPorCampo(rtOrigen, campo, mesesPeriodo) {
  return pac_getValorCampoReemplazo(rtOrigen, campo, mesesPeriodo);
}

function pac_evaluarReglasReemplazo(candidato, rtOrigen, reglas, mesesPeriodo) {
  for (var i = 0; i < reglas.length; i++) {
    var regla = reglas[i];
    if (!regla.activa) continue;

    var valorCampo = pac_getValorCampoReemplazo(candidato, regla.campo, mesesPeriodo);
    var valorOrigen = pac_getValorOrigenPorCampo(rtOrigen, regla.campo, mesesPeriodo);
    var cumple = false;

    switch (regla.operador) {
      case 'EN_LISTA':
        cumple = regla.valores.some(function(v) {
          return pac_normalizarTexto(valorCampo).indexOf(pac_normalizarTexto(v)) >= 0;
        });
        break;

      case 'IGUAL_A':
        cumple = pac_normalizarTexto(valorCampo) === pac_normalizarTexto(regla.valores[0]);
        break;

      case 'IGUAL_A_RT_ORIGEN':
        cumple = pac_normalizarTexto(valorCampo) === pac_normalizarTexto(valorOrigen);
        break;

      case 'MAYOR_QUE':
        cumple = pac_parseMoney(valorCampo) > pac_parseMoney(regla.valores[0]);
        break;

      case 'MENOR_QUE':
        cumple = pac_parseMoney(valorCampo) < pac_parseMoney(regla.valores[0]);
        break;

      case 'CONTIENE':
        cumple = pac_normalizarTexto(valorCampo).indexOf(pac_normalizarTexto(regla.valores[0])) >= 0;
        break;

      case 'NO_CONTIENE':
        cumple = pac_normalizarTexto(valorCampo).indexOf(pac_normalizarTexto(regla.valores[0])) < 0;
        break;

      default:
        cumple = true;
    }

    if (!cumple) return false;
  }

  return true;
}

function pac_scoreCandidatoReemplazo(c, rtRiesgo, mesesPeriodo) {
  var score = 0;

  var estadoScore = {
    'ADQUIRIDO': 45,
    'ENTREGADO': 38,
    'ESCRITURADO': 30,
    'PROMESA DE COMPRAVENTA': 22,
    'OFERTA FORMAL': 8
  }[pac_normalizarTexto(c.estadoPredial)] || 0;

  var saldoReal = pac_parseMoney((c.matrizInfo || {}).saldoPorPagar || 0);
  var saldoPac = pac_parseMoney(c.saldo2026 || 0);
  var saldoBase = saldoReal > 0 ? saldoReal : saldoPac;
  var saldoScore = Math.min(25, saldoBase > 0 ? Math.floor(saldoBase / 50000000) : 0);

  var programadoPeriodo = 0, radicadoPeriodo = 0, ejecutadoPeriodo = 0;
  (mesesPeriodo || []).forEach(function(mes) {
    var m = (c.datosMensuales || {})[mes] || {};
    programadoPeriodo += m.PROGRAMADO || 0;
    radicadoPeriodo += m.VALOR_RADICADO || 0;
    ejecutadoPeriodo += m.VALOR_EJECUTADO || 0;
  });

  score += estadoScore;
  score += saldoScore;
  if (programadoPeriodo === 0) score += 15;
  if (radicadoPeriodo === 0 && ejecutadoPeriodo === 0) score += 10;
  if ((c.matrizInfo || {}).escritura) score += 8;
  if ((c.matrizInfo || {}).disponibilidad) score += 5;

  return score;
}


function pac_generarRecomendaciones(registrosPAC, modoEjecucion, matrizDataExterno) {
  try {
    var reglas = pac_cargarReglasReemplazo();

    var rtEnRiesgo = registrosPAC.filter(function(r) {
      return (r.semaforo === 'ROJO' || r.semaforo === 'NARANJA') && (r.acumProgAnual || 0) > 0;
    });

    if (!rtEnRiesgo.length) return [];

    var recomendaciones = [];

    rtEnRiesgo.forEach(function(rtRiesgo) {
      var mesesPeriodo = [rtRiesgo.mesActual];
      var diagnostico = {
        totalEvaluados: 0,
        descartadosProyecto: 0,
        descartadosFuente: 0,
        descartadosSaldo: 0,
        descartadosReglas: 0,
        candidatosFinales: 0
      };

      var proyectoOrigen = pac_normalizarTexto(rtRiesgo.proyecto || '');
      var fuenteOrigen = pac_normalizarTexto(rtRiesgo.fuente || '');

      var candidatos = registrosPAC.filter(function(c) {
        if (c.llavePac === rtRiesgo.llavePac) return false;

        diagnostico.totalEvaluados++;

        var proyectoCand = pac_normalizarTexto(c.proyecto || '');
        var fuenteCand = pac_normalizarTexto(c.fuente || '');

        if (proyectoOrigen && proyectoCand && proyectoOrigen !== proyectoCand) {
          diagnostico.descartadosProyecto++;
          return false;
        }

        if (fuenteOrigen && fuenteCand && fuenteOrigen !== fuenteCand) {
          diagnostico.descartadosFuente++;
          return false;
        }

        var saldoReal = pac_parseMoney((c.matrizInfo || {}).saldoPorPagar || 0);
        var saldoAlterno = pac_parseMoney(c.saldo2026 || 0);
        var tieneCapacidad = saldoReal > 0 || saldoAlterno > 0 || (c.acumProgAnual || 0) > 0;

        if (!tieneCapacidad) {
          diagnostico.descartadosSaldo++;
          return false;
        }

        if (!pac_evaluarReglasReemplazo(c, rtRiesgo, reglas, mesesPeriodo)) {
          diagnostico.descartadosReglas++;
          return false;
        }

        return true;
      });

      candidatos = candidatos.map(function(c) {
        var score = pac_scoreCandidatoReemplazo(c, rtRiesgo, mesesPeriodo);

        var programadoPeriodo = 0, radicadoPeriodo = 0, ejecutadoPeriodo = 0;
        mesesPeriodo.forEach(function(mes) {
          var m = (c.datosMensuales || {})[mes] || {};
          programadoPeriodo += m.PROGRAMADO || 0;
          radicadoPeriodo += m.VALOR_RADICADO || 0;
          ejecutadoPeriodo += m.VALOR_EJECUTADO || 0;
        });

        var saldoReal = pac_parseMoney((c.matrizInfo || {}).saldoPorPagar || 0);
        var saldoAlterno = pac_parseMoney(c.saldo2026 || 0);

        var razones = [];
        if (pac_normalizarTexto(c.estadoPredial) === 'ADQUIRIDO') razones.push('Estado adquirido');
        if (pac_normalizarTexto(c.estadoPredial) === 'ENTREGADO') razones.push('Estado entregado');
        if (pac_normalizarTexto(c.estadoPredial) === 'ESCRITURADO') razones.push('Estado escriturado');
        if (saldoReal > 0) razones.push('Saldo real disponible');
        else if (saldoAlterno > 0) razones.push('Saldo PAC disponible');
        if (programadoPeriodo === 0) razones.push('Sin programación en período');
        if ((c.matrizInfo || {}).escritura) razones.push('Tiene soporte escritura');

        return {
          rt: c.rt,
          llavePac: c.llavePac,
          beneficiario: c.beneficiario,
          estadoPredial: c.estadoPredial,
          saldo2026: c.saldo2026,
          saldoReemplazo: saldoReal > 0 ? saldoReal : saldoAlterno,
          programadoPeriodo: programadoPeriodo,
          radicadoPeriodo: radicadoPeriodo,
          ejecutadoPeriodo: ejecutadoPeriodo,
          score: score,
          semaforo: c.semaforo,
          matrizInfo: c.matrizInfo,
          escritura: (c.matrizInfo || {}).escritura || '',
          disponibilidad: (c.matrizInfo || {}).disponibilidad || '',
          razones: razones
        };
      }).sort(function(a, b) {
        return b.score - a.score;
      });

      diagnostico.candidatosFinales = candidatos.length;

      recomendaciones.push({
        rtEnRiesgo: rtRiesgo.rt,
        llavePacRiesgo: rtRiesgo.llavePac,
        proyecto: rtRiesgo.proyecto,
        fuente: rtRiesgo.fuente,
        semaforo: rtRiesgo.semaforo,
        programado: rtRiesgo.acumProgAnual,
        programadoMes: rtRiesgo.programadoMes,
        estadoPredial: rtRiesgo.estadoPredial,
        articulador: rtRiesgo.articulador,
        gestor: rtRiesgo.gestor,
        candidatos: candidatos.slice(0, 10),
        diagnostico: diagnostico
      });
    });

    return recomendaciones;
  } catch(e) {
    pac_log('Error generando recomendaciones: ' + e.message, 'ERROR');
    return [];
  }
}
function sincronizarPAC() {
  const respuesta = {
    success: false, cambios: 0, nuevos: 0,
    modificados: 0, eliminados: 0, mensaje: ''
  };

  try {
    pac_log('sincronizarPAC: iniciando...');

    const ss = pac_getSpreadsheet();

    // ── FIX #1: Leer TODAS las fuentes con sus parámetros correctos ──────
    // pac_leerHojaExterna(nombreHoja, fuente) requiere ambos parámetros
    const fuentes = PAC_CONFIG.FUENTES || [
      { nombre: 'PAC IDU',          fuente: 'IDU' },
      { nombre: 'PAC TRANSMILENIO', fuente: 'TM'  }
    ];

    let todasLasFilas = [];

    fuentes.forEach(function(f) {
      try {
        const resultado = pac_leerHojaExterna(f.nombre, f.fuente);
        // pac_leerHojaExterna retorna { headers, mapaMensual, filas[] } o null
        if (resultado && resultado.filas && resultado.filas.length > 0) {
          todasLasFilas = todasLasFilas.concat(resultado.filas);
          pac_log('sincronizarPAC: leídos ' + resultado.filas.length +
                  ' registros de fuente "' + f.nombre + '"');
        } else {
          pac_log('sincronizarPAC: fuente "' + f.nombre + '" sin datos o no encontrada',
                  'ADVERTENCIA');
        }
      } catch (eFuente) {
        pac_log('sincronizarPAC: error en fuente "' + f.nombre + '": ' +
                eFuente.message, 'ERROR');
      }
    });

    if (todasLasFilas.length === 0) {
      respuesta.mensaje = 'Ninguna fuente PAC devolvió datos. ' +
                          'Verifique que las hojas "PAC IDU" y "PAC TRANSMILENIO" ' +
                          'existan en el archivo externo (ID: ' +
                          PAC_CONFIG.PAC_SPREADSHEET_ID + ').';
      pac_log('sincronizarPAC: ' + respuesta.mensaje, 'ADVERTENCIA');
      return respuesta;
    }

    // ── FIX #2: Nombres correctos de hojas internas ───────────────────────
    // PAC_CONFIG.HOJAS_INTERNAS.VIGENTE  (NO .PAC_VIGENTE)
    // PAC_CONFIG.HOJAS_INTERNAS.BORRADOR (NO .PAC_BORRADOR)
    const nombreVigente  = PAC_CONFIG.HOJAS_INTERNAS.VIGENTE  || 'PAC_Vigente';
    const nombreBorrador = PAC_CONFIG.HOJAS_INTERNAS.BORRADOR || 'PAC_Borrador';

    let hojaVigente  = ss.getSheetByName(nombreVigente);
    let hojaBorrador = ss.getSheetByName(nombreBorrador);
    if (!hojaVigente)  hojaVigente  = ss.insertSheet(nombreVigente);
    if (!hojaBorrador) hojaBorrador = ss.insertSheet(nombreBorrador);

    // ── FIX #3: Pasar el array de filas (objetos planos) al comparador ────
    const diff = _pac_compararYGenerarBorrador(hojaVigente, hojaBorrador, todasLasFilas);

    respuesta.success     = true;
    respuesta.cambios     = diff.totalCambios || 0;
    respuesta.nuevos      = diff.nuevos       || 0;
    respuesta.modificados = diff.modificados  || 0;
    respuesta.eliminados  = diff.eliminados   || 0;
    respuesta.mensaje     = diff.totalCambios === 0
      ? 'Sincronización exitosa. ' + todasLasFilas.length + ' registros procesados sin cambios.'
      : diff.totalCambios + ' cambio(s) detectado(s) en ' + todasLasFilas.length + ' registros.';

    if (diff.totalCambios === 0) {
      respuesta.aprobadoAutomaticamente = true;
      try { aprobarBorradorPAC('Auto-aprobado: sin cambios'); } catch(e) { /* no crítico */ }
    } else {
      respuesta.aprobadoAutomaticamente = false;
    }

    pac_log('sincronizarPAC: OK — ' + respuesta.mensaje);
    return respuesta;

  } catch (e) {
    respuesta.mensaje = 'Error inesperado: ' + e.message;
    pac_log('sincronizarPAC EXCEPCIÓN: ' + e.message, 'ERROR');
    return respuesta;
  }
}

/**
 * aprobarBorradorPAC() — v2.2 corregida
 * FIX #2: Usa PAC_CONFIG.HOJAS_INTERNAS.VIGENTE y .BORRADOR (nombres reales)
 */
function aprobarBorradorPAC(motivo) {
  pac_log('aprobarBorradorPAC: ' + (motivo || 'aprobación manual'));
  try {
    const ss = pac_getSpreadsheet();

    // FIX: nombres correctos de hojas
    const nombreVigente  = PAC_CONFIG.HOJAS_INTERNAS.VIGENTE  || 'PAC_Vigente';
    const nombreBorrador = PAC_CONFIG.HOJAS_INTERNAS.BORRADOR || 'PAC_Borrador';

    const hojaVigente  = ss.getSheetByName(nombreVigente);
    const hojaBorrador = ss.getSheetByName(nombreBorrador);

    if (!hojaBorrador || hojaBorrador.getLastRow() < 2) {
      return { success: false, mensaje: 'No hay borrador pendiente de aprobación.' };
    }
    if (!hojaVigente) {
      return { success: false, mensaje: 'No se encontró la hoja "' + nombreVigente + '".' };
    }

    const datosBorrador = hojaBorrador.getDataRange().getValues();
    hojaVigente.clearContents();
    hojaVigente.getRange(1, 1, datosBorrador.length, datosBorrador[0].length)
               .setValues(datosBorrador);
    hojaVigente.getRange(1, 1, 1, datosBorrador[0].length)
      .setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');

    if (hojaBorrador.getLastRow() > 1) {
      hojaBorrador.deleteRows(2, hojaBorrador.getLastRow() - 1);
    }

    // Limpiar caché para que calcularSemaforoPAC lea datos frescos
    if (typeof _PAC_RUNTIME_CACHE !== 'undefined') {
      _PAC_RUNTIME_CACHE.vigente = null;
    }

    pac_log('aprobarBorradorPAC: vigente actualizado con ' +
            (datosBorrador.length - 1) + ' registros');
    return {
      success: true,
      mensaje: 'Borrador aprobado. ' + (datosBorrador.length - 1) + ' registros en PAC_Vigente.'
    };

  } catch (e) {
    pac_log('aprobarBorradorPAC ERROR: ' + e.message, 'ERROR');
    return { success: false, mensaje: 'Error al aprobar borrador: ' + e.message };
  }
}

/**
 * rechazarBorradorPAC() — v2.2 corregida
 * FIX #2: Usa PAC_CONFIG.HOJAS_INTERNAS.BORRADOR (nombre real)
 */
function rechazarBorradorPAC() {
  pac_log('rechazarBorradorPAC: descartando borrador');
  try {
    const ss = pac_getSpreadsheet();
    const nombreBorrador = PAC_CONFIG.HOJAS_INTERNAS.BORRADOR || 'PAC_Borrador';
    const hojaBorrador   = ss.getSheetByName(nombreBorrador);

    if (!hojaBorrador) {
      return { success: false, mensaje: 'No existe hoja "' + nombreBorrador + '".' };
    }
    if (hojaBorrador.getLastRow() > 1) {
      hojaBorrador.deleteRows(2, hojaBorrador.getLastRow() - 1);
    }

    pac_log('rechazarBorradorPAC: borrador descartado');
    return { success: true, mensaje: 'Borrador rechazado. PAC_Vigente sin cambios.' };

  } catch (e) {
    pac_log('rechazarBorradorPAC ERROR: ' + e.message, 'ERROR');
    return { success: false, mensaje: 'Error al rechazar borrador: ' + e.message };
  }
}

/**
 * _pac_compararYGenerarBorrador() — v2.2 corregida
 *
 * FIX #3: datosExternos es un array de objetos planos { RT, CRP, PROYECTO, meses:{} ... }
 *         (resultado de pac_leerHojaExterna().filas)
 *         El borrador se escribe aplanando los datos mensuales en columnas.
 */
function _pac_compararYGenerarBorrador(hojaVigente, hojaBorrador, filasExternas) {
  var res = { totalCambios: 0, nuevos: 0, modificados: 0, eliminados: 0 };

  try {
    hojaBorrador.clearContents();

    // ── 1. Detectar nuevos y eliminados ───────────────────────────────────
    var mapaVigente = {};
    if (hojaVigente.getLastRow() > 1) {
      var hV  = hojaVigente.getRange(1, 1, 1, hojaVigente.getLastColumn())
                           .getValues()[0];
      var dV  = hojaVigente.getRange(2, 1,
                  hojaVigente.getLastRow() - 1,
                  hojaVigente.getLastColumn()).getValues();
      var hVU = hV.map(function(h){ return String(h).trim(); });
      var iRT = hVU.indexOf('RT');
      if (iRT >= 0) {
        dV.forEach(function(fila) {
          var rt = String(fila[iRT]).trim();
          if (rt) mapaVigente[rt] = true;
        });
      }
    }

    filasExternas.forEach(function(item) {
      var rt = String(item.RT || '').trim();
      if (rt && !mapaVigente[rt]) { res.nuevos++;    res.totalCambios++; }
    });
    Object.keys(mapaVigente).forEach(function(rt) {
      var existe = filasExternas.some(function(i) {
        return String(i.RT || '').trim() === rt;
      });
      if (!existe) { res.eliminados++; res.totalCambios++; }
    });

    if (filasExternas.length === 0) return res;

    // ── 2. Construir encabezados con nombres ÚNICOS por mes ───────────────
    // Formato: "PROGRAMADO MAYO", "VALOR RADICADO MAYO", etc.
    // pac_construirMapaMensual los encontrará por posición relativa
    var meses = PAC_CONFIG.MESES || [];

    var camposBase = [
      'CRP', 'RT', 'TIPO_NEG', 'BENEFICIARIO', 'PROYECTO', 'FUENTE',
      'SALDO_2026', 'CDP', 'CDP_VALOR', 'OBSERVACIONES',
      'SALDO_POR_PAGAR', 'FORMA_PAGO', 'NUM_PAGOS', 'CDP_TOTAL', 'CRP_TOTAL'
    ];

    var headersFinales = camposBase.slice();

    // Por cada mes: 6 columnas con nombre único
    meses.forEach(function(mes) {
      headersFinales.push('PROGRAMADO '      + mes);  // +0
      headersFinales.push('VALOR RADICADO '  + mes);  // +1
      headersFinales.push('FECHA RADICADO '  + mes);  // +2
      headersFinales.push('OP '              + mes);  // +3
      headersFinales.push('VALOR EJECUTADO ' + mes);  // +4
      headersFinales.push('LIBERACION '      + mes);  // +5
    });

    // ── 3. Construir filas ────────────────────────────────────────────────
    var filasBorrador = [headersFinales];

    filasExternas.forEach(function(item) {
      var fila = [];

      // Campos base
      camposBase.forEach(function(campo) {
        var val = item[campo];
        fila.push(val !== undefined && val !== null ? val : '');
      });

      // Datos mensuales — cada mes tiene sus propios valores
      meses.forEach(function(mes) {
        var mData = (item.meses && item.meses[mes]) ? item.meses[mes] : {};
        fila.push(typeof mData.PROGRAMADO      === 'number' ? mData.PROGRAMADO      : 0);
        fila.push(typeof mData.VALOR_RADICADO  === 'number' ? mData.VALOR_RADICADO  : 0);
        fila.push(mData.FECHA_RADICADO  || '');
        fila.push(mData.OP              || '');
        fila.push(typeof mData.VALOR_EJECUTADO === 'number' ? mData.VALOR_EJECUTADO : 0);
        fila.push(typeof mData.LIBERACION      === 'number' ? mData.LIBERACION      : 0);
      });

      filasBorrador.push(fila);
    });

    // ── 4. Escribir en borrador ───────────────────────────────────────────
    hojaBorrador.getRange(1, 1, filasBorrador.length, headersFinales.length)
                .setValues(filasBorrador);
    hojaBorrador.getRange(1, 1, 1, headersFinales.length)
      .setBackground('#f39c12').setFontColor('#fff').setFontWeight('bold');

    // Log de verificación con valores de muestra
    var muestra = filasExternas[0];
    var mesMuestra = meses[4] || 'MAYO'; // índice 4 = MAYO
    var mMuestra = (muestra && muestra.meses && muestra.meses[mesMuestra])
                   ? muestra.meses[mesMuestra] : {};
    pac_log('_pac_compararYGenerarBorrador OK: ' + filasExternas.length +
            ' filas | ' + headersFinales.length + ' cols | ' +
            'RT[0]=' + (muestra ? muestra.RT : '?') +
            ' PROG_' + mesMuestra + '=' + (mMuestra.PROGRAMADO || 0) +
            ' RAD_' + mesMuestra + '=' + (mMuestra.VALOR_RADICADO || 0) +
            ' EJEC_' + mesMuestra + '=' + (mMuestra.VALOR_EJECUTADO || 0));

  } catch (e) {
    pac_log('_pac_compararYGenerarBorrador ERROR: ' + e.message, 'ERROR');
  }

  return res;
}