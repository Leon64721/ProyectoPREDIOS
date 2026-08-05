/**
 * 🧪 PRUEBA: Verificar unificación SOLICITUD DE AVALÚO
 */
function verificarUnificacionSolicitudAvaluo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaOrigen = ss.getSheetByName(CONFIG_NORMALIZACION.hojas.origen);
  var hojaDestino = ss.getSheetByName(CONFIG_NORMALIZACION.hojas.destino);
  
  if (!hojaOrigen || !hojaDestino) {
    Logger.log('❌ Falta alguna hoja');
    return;
  }
  
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('🧪 VERIFICACIÓN: SOLICITUD DE AVALÚO');
  Logger.log('═══════════════════════════════════════════════════\n');
  
  // Contar en origen
  var encabezadosOrigen = hojaOrigen.getRange(1, 1, 1, hojaOrigen.getLastColumn()).getValues()[0];
  var indiceSolicitud = -1;
  var indiceRAD = -1;
  
  for (var i = 0; i < encabezadosOrigen.length; i++) {
    var col = encabezadosOrigen[i].toString().toUpperCase().trim();
    if (col === 'SOLICITUD AVALUO') indiceSolicitud = i;
    if (col === 'RAD SOLICITUD AVALUO') indiceRAD = i;
  }
  
  var datosOrigen = hojaOrigen.getRange(2, 1, hojaOrigen.getLastRow() - 1, hojaOrigen.getLastColumn()).getValues();
  
  var conteoSolicitud = 0;
  var conteoRAD = 0;
  var conteoAmbos = 0;
  var conteoAlMenosUno = 0;
  
  for (var i = 0; i < datosOrigen.length; i++) {
    var tieneSolicitud = indiceSolicitud >= 0 && datosOrigen[i][indiceSolicitud] !== '' && datosOrigen[i][indiceSolicitud] !== null;
    var tieneRAD = indiceRAD >= 0 && datosOrigen[i][indiceRAD] !== '' && datosOrigen[i][indiceRAD] !== null;
    
    if (tieneSolicitud) conteoSolicitud++;
    if (tieneRAD) conteoRAD++;
    if (tieneSolicitud && tieneRAD) conteoAmbos++;
    if (tieneSolicitud || tieneRAD) conteoAlMenosUno++;
  }
  
  Logger.log('📊 ORIGEN:');
  Logger.log('   Solo SOLICITUD AVALUO: ' + conteoSolicitud);
  Logger.log('   Solo RAD SOLICITUD AVALUO: ' + conteoRAD);
  Logger.log('   Ambos campos: ' + conteoAmbos);
  Logger.log('   Al menos uno: ' + conteoAlMenosUno + ' ← ESPERADO EN DESTINO');
  
  // Contar en destino
  var encabezadosDestino = hojaDestino.getRange(1, 1, 1, hojaDestino.getLastColumn()).getValues()[0];
  var indiceDestinoSolicitud = -1;
  
  for (var i = 0; i < encabezadosDestino.length; i++) {
    var col = encabezadosDestino[i].toString().toUpperCase().trim();
    if (col === 'SOLICITUD DE AVALÚO' || col === 'SOLICITUD DE AVALUO') {
      indiceDestinoSolicitud = i;
      break;
    }
  }
  
  if (indiceDestinoSolicitud < 0) {
    Logger.log('\n❌ No se encontró columna SOLICITUD DE AVALÚO en destino');
    return;
  }
  
  var datosDestino = hojaDestino.getRange(2, indiceDestinoSolicitud + 1, hojaDestino.getLastRow() - 1, 1).getValues();
  var conteoDestino = 0;
  
  for (var i = 0; i < datosDestino.length; i++) {
    if (datosDestino[i][0] !== '' && datosDestino[i][0] !== null) {
      conteoDestino++;
    }
  }
  
  Logger.log('\n📊 DESTINO:');
  Logger.log('   SOLICITUD DE AVALÚO: ' + conteoDestino);
  
  Logger.log('\n═══════════════════════════════════════════════════');
  
  if (conteoDestino === conteoAlMenosUno) {
    Logger.log('✅ PERFECTO: Se unificaron correctamente');
  } else {
    Logger.log('⚠️  DIFERENCIA DETECTADA:');
    Logger.log('   Esperado: ' + conteoAlMenosUno);
    Logger.log('   Obtenido: ' + conteoDestino);
    Logger.log('   Faltantes: ' + (conteoAlMenosUno - conteoDestino));
  }
  
  Logger.log('═══════════════════════════════════════════════════');
}


/**
 * 🔍 DIAGNÓSTICO: Detectar qué columnas encuentra REGLA_018
 */
function diagnosticarREGLA_018() {
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('🔍 DIAGNÓSTICO: REGLA_018');
  Logger.log('═══════════════════════════════════════════════════\n');
  
  var regla = obtenerReglaPorId('REGLA_018');
  
  if (!regla) {
    Logger.log('❌ REGLA_018 no encontrada');
    return;
  }
  
  Logger.log('✅ REGLA_018 encontrada:');
  Logger.log('   Nombre Final: ' + regla.nombreFinal);
  Logger.log('   Estrategia: ' + regla.estrategiaConflicto);
  Logger.log('   Variantes (' + regla.variantes.length + '):');
  for (var i = 0; i < regla.variantes.length; i++) {
    Logger.log('      ' + (i + 1) + '. "' + regla.variantes[i] + '"');
  }
  
  // Verificar columnas en origen
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaOrigen = ss.getSheetByName(CONFIG_NORMALIZACION.hojas.origen);
  
  if (!hojaOrigen) {
    Logger.log('\n❌ Hoja origen no encontrada');
    return;
  }
  
  var encabezados = hojaOrigen.getRange(1, 1, 1, hojaOrigen.getLastColumn()).getValues()[0];
  
  Logger.log('\n📋 Columnas encontradas en origen:');
  var encontradas = [];
  
  for (var i = 0; i < encabezados.length; i++) {
    var colOrigen = encabezados[i].toString().toUpperCase().trim();
    
    for (var v = 0; v < regla.variantes.length; v++) {
      var variante = regla.variantes[v].toString().toUpperCase().trim();
      var varianteConGuion = variante.replace(/\s+/g, '_');
      var colConGuion = colOrigen.replace(/\s+/g, '_');
      
      if (colOrigen === variante || colConGuion === varianteConGuion) {
        encontradas.push({
          nombre: encabezados[i],
          indice: i + 1,
          variante: regla.variantes[v]
        });
        Logger.log('   ✅ Columna ' + (i + 1) + ': "' + encabezados[i] + '" → variante: "' + regla.variantes[v] + '"');
      }
    }
  }
  
  if (encontradas.length === 0) {
    Logger.log('   ❌ NO se encontraron columnas');
  } else {
    Logger.log('\n   Total encontradas: ' + encontradas.length);
  }
  
  // Verificar que la función existe
  Logger.log('\n🔧 Verificando función:');
  try {
    var prueba = aplicarLogicaPrediosDisponiblesCesiones([
      { columna: 'PREDIOS DISPONIBLES', valor: '27/7/2020' }
    ]);
    Logger.log('   ✅ Función existe y funciona');
    Logger.log('   Resultado prueba: "' + prueba.valor + '"');
  } catch (e) {
    Logger.log('   ❌ Error: ' + e.message);
  }
  
  Logger.log('\n═══════════════════════════════════════════════════');
}