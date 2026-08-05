// ============================================================
//  CONFIGURACIÓN CENTRAL — ajusta solo aquí si algo cambia
// ============================================================
var CFG = {
  origen: {
    hoja:    'Consolidado_Script',          // Nombre del archivo origen
    pestana: 'DATOS_NORMALIZADOS'           // Pestaña origen
  },
  destino: {
    pestana: 'Datos2'                        // Pestaña destino en Matriz Seguimiento
  },
  colsIntocables: {
    inicio: 'E',                            // Primera columna intocable
    fin: 'R'                                // Última columna intocable
  },
  filaEncabezado: 1,                        // Fila donde están los encabezados
  filaInicioDatos: 2                        // Primera fila de datos
};

// ============================================================
//  UTILIDADES
// ============================================================

/** Convierte letra(s) de columna a índice base 1 (A=1, Z=26, AA=27...) */
function colLetraANum(letra) {
  if (!letra) return 0; // 🛡️ Protección contra valores vacíos o indefinidos
  letra = String(letra).toUpperCase();
  var resultado = 0;
  for (var i = 0; i < letra.length; i++) {
    resultado = resultado * 26 + (letra.charCodeAt(i) - 64);
  }
  return resultado;
}

/** Convierte índice base 1 a letra(s) de columna (1=A, 26=Z, 27=AA...) */
function colNumALetra(num) {
  var letra = '';
  while (num > 0) {
    num--;
    letra = String.fromCharCode(65 + (num % 26)) + letra;
    num = Math.floor(num / 26);
  }
  return letra;
}

/** Normaliza texto para comparación: trim + uppercase */
function normalizar(texto) {
  if (!texto) return '';
  return String(texto).trim().toUpperCase();
}

/** Construye índice de encabezados: { NOMBRE_NORMALIZADO: indiceColumna } */
function construirIndiceEncabezados(encabezados) {
  var indice = {};
  for (var i = 0; i < encabezados.length; i++) {
    var clave = normalizar(encabezados[i]);
    if (clave) indice[clave] = i;
  }
  return indice;
}

/** Verifica si una columna está en el rango intocable */
function esColumnaIntocable(numCol) {
  var inicioIntocable = colLetraANum(CFG.colsIntocables.inicio);
  var finIntocable = colLetraANum(CFG.colsIntocables.fin);
  return numCol >= inicioIntocable && numCol <= finIntocable;
}

/** Genera mapeo dinámico basado en encabezados de destino */
function generarMapeoDinamico(encabezadosDestino, indiceOrigen) {
  var mapeo = [];
  var cambiosDetectados = [];
  var encabezadosNoEncontrados = [];
  
  for (var i = 0; i < encabezadosDestino.length; i++) {
    var numColDestino = i + 1; // Columnas base 1
    var letraColDestino = colNumALetra(numColDestino);
    var encabezadoDestino = normalizar(encabezadosDestino[i]);
    
    // Saltar columnas intocables
    if (esColumnaIntocable(numColDestino)) {
      continue;
    }
    
    // Buscar encabezado en origen
    var indiceEnOrigen = indiceOrigen[encabezadoDestino];
    
    if (indiceEnOrigen !== undefined) {
      // Encabezado encontrado - mapear
      mapeo.push({
        colDestino: numColDestino,
        letraDestino: letraColDestino,
        encabezadoDestino: encabezadosDestino[i],
        indiceOrigen: indiceEnOrigen,
        encontrado: true
      });
    } else if (encabezadoDestino) {
      // Encabezado no encontrado en origen
      encabezadosNoEncontrados.push({
        columna: letraColDestino,
        encabezado: encabezadosDestino[i]
      });
      
      mapeo.push({
        colDestino: numColDestino,
        letraDestino: letraColDestino,
        encabezadoDestino: encabezadosDestino[i],
        indiceOrigen: null,
        encontrado: false
      });
    }
  }
  
  return {
    mapeo: mapeo,
    encabezadosNoEncontrados: encabezadosNoEncontrados
  };
}

// ============================================================
//  FUNCIÓN PRINCIPAL
// ============================================================
function importarDatosNormalizados() {

  var ui = SpreadsheetApp.getUi();

  try {
    // ── 1. Abrir hoja origen ──────────────────────────────────
    var ssOrigen;
    try {
      var archivos = DriveApp.getFilesByName(CFG.origen.hoja);
      if (!archivos.hasNext()) {
        ui.alert('❌ Error', 'No se encontró el archivo "' + CFG.origen.hoja + '" en Drive.', ui.ButtonSet.OK);
        return;
      }
      ssOrigen = SpreadsheetApp.open(archivos.next());
    } catch (e) {
      ui.alert('❌ Error abriendo origen', e.message, ui.ButtonSet.OK);
      return;
    }

    var hojaOrigen = ssOrigen.getSheetByName(CFG.origen.pestana);
    if (!hojaOrigen) {
      ui.alert('❌ Error', 'No se encontró la pestaña "' + CFG.origen.pestana + '" en "' + CFG.origen.hoja + '".', ui.ButtonSet.OK);
      return;
    }

    // ── 2. Abrir hoja destino ─────────────────────────────────
    var ssDestino  = SpreadsheetApp.getActiveSpreadsheet();
    var hojaDestino = ssDestino.getSheetByName(CFG.destino.pestana);
    if (!hojaDestino) {
      ui.alert('❌ Error', 'No se encontró la pestaña "' + CFG.destino.pestana + '" en este archivo.', ui.ButtonSet.OK);
      return;
    }

    // ── 3. Leer encabezados origen y destino ─────────────────
    var ultimaColOrigen = hojaOrigen.getLastColumn();
    var ultimaFilaOrigen = hojaOrigen.getLastRow();
    var ultimaColDestino = hojaDestino.getLastColumn();

    if (ultimaFilaOrigen < 2) {
      ui.alert('⚠️ Aviso', 'La hoja origen no tiene datos.', ui.ButtonSet.OK);
      return;
    }

    // Leer encabezados de ambas hojas
    var encabezadosOrigen = hojaOrigen
      .getRange(CFG.filaEncabezado, 1, 1, ultimaColOrigen)
      .getValues()[0];
      
    var encabezadosDestino = hojaDestino
      .getRange(CFG.filaEncabezado, 1, 1, ultimaColDestino)
      .getValues()[0];

    // Construir índices
    var indiceOrigen = construirIndiceEncabezados(encabezadosOrigen);
    
    // ── 4. Generar mapeo dinámico ────────────────────────────
    var resultadoMapeo = generarMapeoDinamico(encabezadosDestino, indiceOrigen);
    var mapeo = resultadoMapeo.mapeo;
    var encabezadosNoEncontrados = resultadoMapeo.encabezadosNoEncontrados;

    // ── 5. Confirmación con resumen de cambios ───────────────
    var mensaje = '🔄 MAPEO DINÁMICO DETECTADO\n\n';
    mensaje += '📊 Total columnas destino: ' + ultimaColDestino + '\n';
    mensaje += '🔒 Columnas intocables: ' + CFG.colsIntocables.inicio + '-' + CFG.colsIntocables.fin + '\n';
    mensaje += '✅ Columnas a mapear: ' + mapeo.filter(function(m) { return m.encontrado; }).length + '\n';
    
    if (encabezadosNoEncontrados.length > 0) {
      mensaje += '⚠️ Columnas sin datos origen: ' + encabezadosNoEncontrados.length + '\n\n';
      mensaje += 'Columnas que se omitirán (quedarán intactas):\n';
      for (var i = 0; i < Math.min(encabezadosNoEncontrados.length, 5); i++) {
        mensaje += '• ' + encabezadosNoEncontrados[i].columna + ': "' + encabezadosNoEncontrados[i].encabezado + '"\n';
      }
      if (encabezadosNoEncontrados.length > 5) {
        mensaje += '... y ' + (encabezadosNoEncontrados.length - 5) + ' más\n';
      }
    }
    
    mensaje += '\n¿Continuar con la importación?';

    var respuesta = ui.alert('⚠️ Confirmación de Mapeo Dinámico', mensaje, ui.ButtonSet.YES_NO);
    if (respuesta !== ui.Button.YES) {
      ui.alert('Operación cancelada.');
      return;
    }

    // ── 6. Leer datos origen ─────────────────────────────────
    var totalFilasDatos = ultimaFilaOrigen - CFG.filaEncabezado;
    var datosOrigen = hojaOrigen
      .getRange(CFG.filaInicioDatos, 1, totalFilasDatos, ultimaColOrigen)
      .getValues();

    // Leer formatos de origen
    var formatosOrigen = hojaOrigen
      .getRange(CFG.filaInicioDatos, 1, totalFilasDatos, ultimaColOrigen)
      .getNumberFormats();

    // ── 7. Limpiar rango destino (solo columnas no intocables) ─
    var filasDest = hojaDestino.getLastRow() - CFG.filaEncabezado;
    if (filasDest > 0) {
      // Limpiar desde columna T hasta la última columna
      var colInicioLimpieza = colLetraANum(CFG.colsIntocables.fin) + 1; // T = S + 1
      if (colInicioLimpieza <= ultimaColDestino) {
        var anchoLimpieza = ultimaColDestino - colInicioLimpieza + 1;
        hojaDestino.getRange(
          CFG.filaInicioDatos,
          colInicioLimpieza,
          filasDest,
          anchoLimpieza
        ).clearContent();
      }
    }

    // ── 8. Escribir datos por columna ────────────────────────
    var columnasEscritas = 0;
    var columnasVacias = 0;

    for (var m = 0; m < mapeo.length; m++) {
      var item = mapeo[m];
      
      // 🛡️ SOLO CRUZAR SI LA COLUMNA EXISTE EN EL ORIGEN
      if (item.encontrado && item.indiceOrigen !== null) {
        var valores = [];
        var formatos = [];
        
        for (var f = 0; f < totalFilasDatos; f++) {
          var valorOriginal = datosOrigen[f][item.indiceOrigen];
          var formatoOriginal = formatosOrigen[f][item.indiceOrigen];
          
          // Manejar conversión de formatos
          if (formatoOriginal === '@' || formatoOriginal === '@STRING@') {
            if (valorOriginal instanceof Date) {
              valores.push([Utilities.formatDate(valorOriginal, Session.getScriptTimeZone(), 'MM/dd/yyyy')]);
            } else if (typeof valorOriginal === 'number') {
              valores.push([String(valorOriginal)]);
            } else {
              valores.push([valorOriginal]);
            }
            formatos.push(['@']);
          } else {
            valores.push([valorOriginal]);
            formatos.push([formatoOriginal || 'General']);
          }
        }
        
        // Escribir en destino
        var rangoDestino = hojaDestino.getRange(
          CFG.filaInicioDatos,
          item.colDestino,
          totalFilasDatos,
          1
        );
        
        rangoDestino.setNumberFormats(formatos);
        rangoDestino.setValues(valores);
        columnasEscritas++;
        
      } else {
        // 🛡️ COLUMNA NO ENCONTRADA EN ORIGEN (ej. B y C)
        // Se ignora completamente para no sobrescribir fórmulas, ArrayFormulas ni texto manual
        columnasVacias++;
      }
    }

    SpreadsheetApp.flush();

    // ── 9. Reporte final ──────────────────────────────────────
    var mensajeFinal = '✅ IMPORTACIÓN COMPLETADA\n\n';
    mensajeFinal += '📊 Filas importadas: ' + totalFilasDatos + '\n';
    mensajeFinal += '✅ Columnas con datos: ' + columnasEscritas + '\n';
    mensajeFinal += '⚪ Columnas omitidas (intactas): ' + columnasVacias + '\n';
    mensajeFinal += '🔒 Columnas ' + CFG.colsIntocables.inicio + '-' + CFG.colsIntocables.fin + ': inalteradas\n';
    mensajeFinal += '🎨 Formatos preservados: SÍ\n';
    mensajeFinal += '🔄 Mapeo: DINÁMICO';

    ui.alert('✅ Resultado', mensajeFinal, ui.ButtonSet.OK);

    // Log detallado para debugging
    Logger.log('=== MAPEO DINÁMICO COMPLETADO ===');
    Logger.log('Columnas mapeadas: ' + columnasEscritas);
    Logger.log('Columnas omitidas/protegidas: ' + columnasVacias);
    Logger.log('Encabezados no encontrados: ' + encabezadosNoEncontrados.length);

  } catch (e) {
    ui.alert('❌ Error inesperado', e.message + '\n\nRevisa el log (Ver > Registros).', ui.ButtonSet.OK);
    Logger.log('ERROR importarDatosNormalizados: ' + e.message + '\n' + e.stack);
  }
}

// ============================================================
//  FUNCIÓN AUXILIAR PARA DEBUGGING
// ============================================================
function mostrarMapeoDinamico() {
  try {
    var ssDestino = SpreadsheetApp.getActiveSpreadsheet();
    var hojaDestino = ssDestino.getSheetByName(CFG.destino.pestana);
    
    if (!hojaDestino) {
      Logger.log('No se encontró la hoja destino');
      return;
    }
    
    var ultimaColDestino = hojaDestino.getLastColumn();
    var encabezadosDestino = hojaDestino
      .getRange(CFG.filaEncabezado, 1, 1, ultimaColDestino)
      .getValues()[0];
    
    Logger.log('=== ESTRUCTURA ACTUAL DESTINO ===');
    for (var i = 0; i < encabezadosDestino.length; i++) {
      var numCol = i + 1;
      var letraCol = colNumALetra(numCol);
      var esIntocable = esColumnaIntocable(numCol);
      Logger.log(letraCol + ' (' + numCol + '): "' + encabezadosDestino[i] + '"' + (esIntocable ? ' [INTOCABLE]' : ''));
    }
    
  } catch (e) {
    Logger.log('Error en mostrarMapeoDinamico: ' + e.message);
  }
}