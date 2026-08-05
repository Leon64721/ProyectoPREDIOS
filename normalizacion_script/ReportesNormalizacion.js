/**
 * ═══════════════════════════════════════════════════════════════
 * REPORTES v6.0
 * ═══════════════════════════════════════════════════════════════
 */

function crearHojaNormalizada(ss, datosNormalizados, conflictos) {
  var hoja = crearOLimpiarHoja(ss, CONFIG_NORMALIZACION.hojas.destino);

  hoja.getRange(1, 1, 1, datosNormalizados.columnas.length).setValues([datosNormalizados.columnas]);
  aplicarFormatoEncabezado(hoja, 1, datosNormalizados.columnas.length);

  if (datosNormalizados.datos.length > 0) {
    var matriz = convertirAMatrizNormalizada(datosNormalizados.datos, datosNormalizados.columnas);
    escribirDatosEnBloques(hoja, matriz, 2);
    aplicarColoresConflictos(hoja, datosNormalizados, conflictos);
    aplicarColoresColumnasInsertadas(hoja, datosNormalizados);
  }

  Logger.log('✓ DATOS_NORMALIZADOS: ' + datosNormalizados.datos.length + ' filas x ' + datosNormalizados.columnas.length + ' columnas');
}

function aplicarColoresConflictos(hoja, datosNormalizados, conflictos) {
  var cConfl = CONFIG_NORMALIZACION.colores.conflicto;
  var cUni   = CONFIG_NORMALIZACION.colores.unificada;
  var datos = datosNormalizados.datos, columnas = datosNormalizados.columnas;

  if (conflictos && conflictos.length > 0) {
    var porCol = {};
    for (var i = 0; i < conflictos.length; i++) {
      var idx = columnas.indexOf(conflictos[i].columna) + 1;
      if (idx <= 0) continue;
      if (!porCol[idx]) porCol[idx] = [];
      porCol[idx].push({ fila: conflictos[i].fila, nota: construirNotaConflicto(conflictos[i]) });
    }
    for (var col in porCol) {
      var items = porCol[col]; items.sort(function(a,b){ return a.fila - b.fila; });
      var g = agruparFilasContiguas(items);
      for (var k = 0; k < g.length; k++) {
        try { hoja.getRange(g[k].filaInicio, parseInt(col), g[k].cantidad, 1).setBackground(cConfl); } catch(e) {}
      }
      if (items.length <= 200) {
        try {
          var fMin = items[0].fila, fMax = items[items.length-1].fila, alt = fMax - fMin + 1;
          var notas = [];
          for (var r = 0; r < alt; r++) notas.push([null]);
          for (var n = 0; n < items.length; n++) notas[items[n].fila - fMin][0] = items[n].nota;
          hoja.getRange(fMin, parseInt(col), alt, 1).setNotes(notas);
        } catch(e) {}
      }
    }
  }

  var colsUni = {};
  for (var d = 0; d < datos.length; d++) {
    for (var k in datos[d]) {
      if (k.indexOf('__UNIFICADA_') === 0) {
        var nc = k.replace('__UNIFICADA_', '');
        if (!colsUni[nc]) colsUni[nc] = [];
        colsUni[nc].push(d + 2);
      }
    }
  }
  for (var nc in colsUni) {
    var idx = columnas.indexOf(nc) + 1;
    if (idx <= 0) continue;
    var items2 = colsUni[nc].map(function(f){ return { fila: f }; });
    items2.sort(function(a,b){ return a.fila - b.fila; });
    var g2 = agruparFilasContiguas(items2);
    for (var g = 0; g < g2.length; g++) {
      try { hoja.getRange(g2[g].filaInicio, idx, g2[g].cantidad, 1).setBackground(cUni); } catch(e) {}
    }
  }
  SpreadsheetApp.flush();
}

function construirNotaConflicto(conf) {
  var n = 'VALORES UNIFICADOS:\n\n';
  for (var v = 0; v < conf.valores.length; v++) n += '• ' + conf.valores[v].columna + ': ' + conf.valores[v].valor + '\n';
  n += '\nValor final: ' + conf.valorFinal;
  return n;
}

function aplicarColoresColumnasInsertadas(hoja, datosNormalizados) {
  if (!datosNormalizados.columnasInsertadas || datosNormalizados.columnasInsertadas.length === 0) return;
  var uF = hoja.getLastRow(), color = CONFIG_NORMALIZACION.colores.columnaInsertada;
  for (var i = 0; i < datosNormalizados.columnasInsertadas.length; i++) {
    var ci = datosNormalizados.columnasInsertadas[i];
    var idx = datosNormalizados.columnas.indexOf(ci.nombre) + 1;
    if (idx > 0) {
      try {
        hoja.getRange(1, idx, uF, 1).setBackground(color);
        hoja.getRange(1, idx).setNote('COLUMNA INSERTADA\n\n' + ci.motivo);
      } catch(e) {}
    }
  }
  SpreadsheetApp.flush();
}

function generarReporteUnificacion(ss, unificaciones, conflictos) {
  var hoja = crearOLimpiarHoja(ss, CONFIG_NORMALIZACION.hojas.reporteUnificacion);
  var enc = ['ID Regla','Columna Final','Columnas Origen','Tipo','Estrategia','Cant. Unificadas','Conflictos'];
  hoja.getRange(1, 1, 1, enc.length).setValues([enc]);
  aplicarFormatoEncabezado(hoja, 1, enc.length);
  var idxConf = {};
  for (var c = 0; c < conflictos.length; c++) idxConf[conflictos[c].columna] = (idxConf[conflictos[c].columna] || 0) + 1;
  var datos = [], fAmar = [];
  for (var i = 0; i < unificaciones.length; i++) {
    var u = unificaciones[i], cc = idxConf[u.nombreFinal] || 0;
    datos.push([u.reglaId, u.nombreFinal, u.columnasOrigen.join(', '), u.tipo, u.estrategia, u.cantidadUnificadas, cc]);
    if (cc > 0) fAmar.push(i + 2);
  }
  if (datos.length > 0) {
    hoja.getRange(2, 1, datos.length, enc.length).setValues(datos);
    var g = agruparFilasContiguas(fAmar.map(function(f){ return { fila: f }; }));
    for (var k = 0; k < g.length; k++) hoja.getRange(g[k].filaInicio, 1, g[k].cantidad, enc.length).setBackground('#FFF3CD');
  }
  hoja.autoResizeColumns(1, enc.length);
  SpreadsheetApp.flush();
}

function generarReporteConvenciones(ss, columnasInsertadas) {
  var hoja = crearOLimpiarHoja(ss, CONFIG_NORMALIZACION.hojas.reporteConvenciones);
  hoja.getRange(1, 1, 1, 3).merge()
    .setValue('CONVENCIONES DE COLORES').setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('center').setBackground('#4A86E8').setFontColor('#FFFFFF');
  var conv = [
    ['Color','Significado','Descripción'],
    ['','Conflicto Unificado','Valores diferentes concatenados con " | "'],
    ['','Columna Insertada','No estaba en estructura objetivo'],
    ['','Columna Unificada','Resultado de unificar columnas duplicadas'],
    ['','RT Problemático','RT vacío o duplicado']
  ];
  hoja.getRange(3, 1, conv.length, 3).setValues(conv);
  hoja.getRange(3, 1, 1, 3).setFontWeight('bold').setBackground('#E0E0E0');
  hoja.getRange(4, 1).setBackground(CONFIG_NORMALIZACION.colores.conflicto);
  hoja.getRange(5, 1).setBackground(CONFIG_NORMALIZACION.colores.columnaInsertada);
  hoja.getRange(6, 1).setBackground(CONFIG_NORMALIZACION.colores.unificada);
  hoja.getRange(7, 1).setBackground(CONFIG_NORMALIZACION.colores.rtProblematico);
  hoja.autoResizeColumns(1, 3);
  SpreadsheetApp.flush();
}

function generarReporteRTProblematicos(ss, rtProb) {
  var hoja = crearOLimpiarHoja(ss, CONFIG_NORMALIZACION.hojas.reporteRTProblematicos);
  var enc = ['Fila Origen','RT','Motivo','Severidad','Fila Original'];
  hoja.getRange(1, 1, 1, enc.length).setValues([enc]);
  aplicarFormatoEncabezado(hoja, 1, enc.length);
  var datos = [], alt = [], med = [];
  for (var i = 0; i < rtProb.length; i++) {
    var r = rtProb[i];
    datos.push([r.fila, r.rt, r.motivo, r.severidad, r.filaOriginal || '']);
    if (r.severidad === 'ALTA') alt.push(i + 2); else med.push(i + 2);
  }
  if (datos.length > 0) hoja.getRange(2, 1, datos.length, enc.length).setValues(datos);
  hoja.autoResizeColumns(1, enc.length);
  SpreadsheetApp.flush();
}

function generarReporteColumnasSimilares(ss, similares) {
  var hoja = crearOLimpiarHoja(ss, CONFIG_NORMALIZACION.hojas.reporteSimilares);
  var enc = ['Columna 1','Columna 2','Similitud','Pos 1','Pos 2'];
  hoja.getRange(1, 1, 1, enc.length).setValues([enc]);
  aplicarFormatoEncabezado(hoja, 1, enc.length);
  var d = [];
  for (var i = 0; i < similares.length; i++) {
    d.push([similares[i].col1, similares[i].col2, similares[i].similitud, similares[i].indice1, similares[i].indice2]);
  }
  if (d.length > 0) hoja.getRange(2, 1, d.length, enc.length).setValues(d);
  hoja.autoResizeColumns(1, enc.length);
  SpreadsheetApp.flush();
}

function guardarLogNormalizacion(ss, log) {
  var hoja = crearOLimpiarHoja(ss, CONFIG_NORMALIZACION.hojas.logProceso);
  var d = log.map(function(l){ return [l]; });
  if (d.length > 0) hoja.getRange(1, 1, d.length, 1).setValues(d);
  hoja.setColumnWidth(1, 800);
  SpreadsheetApp.flush();
}