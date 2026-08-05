/**
 * ═══════════════════════════════════════════════════════════════
 * IMPORTADOR AUTOMÁTICO DE CSV VÍA GOOGLE SHEETS
 * ═══════════════════════════════════════════════════════════════
 * Versión: 4.0 (Método Google Sheets)
 * Autor: Asistente IA
 * 
 * CARACTERÍSTICAS:
 * - Convierte CSV a Google Sheets temporalmente
 * - Sin problemas de parseo de separadores
 * - Más rápido y confiable
 * - Búsqueda automática en "Compartido conmigo"
 * - Selector interactivo
 * 
 * REQUISITOS:
 * - Drive API v2 habilitada (Servicios → + Agregar → Drive)
 * 
 * CONFIGURACIÓN:
 * Edita solo las variables en CONFIG_IMPORTADOR
 */

// ═══════════════════════════════════════════════════════════════
// ⚙️ CONFIGURACIÓN (EDITAR AQUÍ)
// ═══════════════════════════════════════════════════════════════

var CONFIG_IMPORTADOR = {
  // Nombre del archivo a buscar (puedes usar parte del nombre)
  nombreArchivo: 'CONSOLIDADO_SNAPSHOT_V21.csv',
  
  // Nombre de la hoja destino en tu archivo actual
  hojaDestino: 'CONSOLIDADO_SNAPSHOT_V19',
  
  // Filtros de búsqueda (opcional)
  filtros: {
    extension: '.csv',           // Solo archivos CSV
    palabraClave: 'CONSOLIDADO', // Debe contener esta palabra
    diasMaximos: 30              // Solo archivos modificados en últimos X días
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔍 FUNCIÓN PRINCIPAL: Buscar y Seleccionar Archivo
// ═══════════════════════════════════════════════════════════════

/**
 * Muestra un selector de archivos CSV disponibles
 */
function seleccionarYImportarCSV() {
  try {
    var ui = SpreadsheetApp.getUi();
    
    // 1️⃣ Buscar archivos CSV
    ui.alert(
      '🔍 Buscando archivos...',
      'Se buscarán archivos CSV en "Compartido conmigo"\n\n' +
      'Método: Conversión a Google Sheets\n' +
      '(Más confiable, sin errores de parseo)\n\n' +
      'Filtros:\n' +
      '• Nombre: ' + CONFIG_IMPORTADOR.filtros.palabraClave + '\n' +
      '• Extensión: ' + CONFIG_IMPORTADOR.filtros.extension + '\n' +
      '• Modificados en últimos ' + CONFIG_IMPORTADOR.filtros.diasMaximos + ' días',
      ui.ButtonSet.OK
    );
    
    var archivosEncontrados = buscarArchivosCSV();
    
    if (archivosEncontrados.length === 0) {
      ui.alert(
        '❌ No se encontraron archivos',
        'No hay archivos CSV que coincidan con los filtros.\n\n' +
        'Verifica:\n' +
        '• Que el archivo esté compartido contigo\n' +
        '• Que el nombre contenga "' + CONFIG_IMPORTADOR.filtros.palabraClave + '"\n' +
        '• Que tenga extensión .csv',
        ui.ButtonSet.OK
      );
      return;
    }
    
    // 2️⃣ Mostrar selector
    var archivoSeleccionado = mostrarSelectorArchivos(archivosEncontrados);
    
    if (!archivoSeleccionado) {
      ui.alert('❌ Importación cancelada', 'No se seleccionó ningún archivo', ui.ButtonSet.OK);
      return;
    }
    
    // 3️⃣ Importar usando el método de Google Sheets
    importarArchivoCSVDesdeSheets(archivoSeleccionado);
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.message);
    Logger.log('ERROR en seleccionarYImportarCSV: ' + e.message + '\n' + e.stack);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔎 BUSCAR ARCHIVOS CSV
// ═══════════════════════════════════════════════════════════════

/**
 * Busca archivos CSV en Drive con los filtros configurados
 * @return {Array} Lista de archivos encontrados
 */
function buscarArchivosCSV() {
  Logger.log('🔍 Buscando archivos CSV...');
  
  var archivos = [];
  var fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - CONFIG_IMPORTADOR.filtros.diasMaximos);
  
  // Construir query de búsqueda
  var query = 'mimeType="text/csv" or mimeType="application/vnd.google-apps.spreadsheet"';
  
  if (CONFIG_IMPORTADOR.filtros.palabraClave) {
    query += ' and title contains "' + CONFIG_IMPORTADOR.filtros.palabraClave + '"';
  }
  
  query += ' and trashed=false';
  
  Logger.log('Query: ' + query);
  
  // Buscar en Drive
  var files = DriveApp.searchFiles(query);
  
  while (files.hasNext()) {
    var file = files.next();
    var nombre = file.getName();
    var fechaMod = file.getLastUpdated();
    
    // Filtrar por extensión
    if (CONFIG_IMPORTADOR.filtros.extension) {
      if (!nombre.toLowerCase().endsWith(CONFIG_IMPORTADOR.filtros.extension.toLowerCase())) {
        continue;
      }
    }
    
    // Filtrar por fecha
    if (fechaMod < fechaLimite) {
      continue;
    }
    
    archivos.push({
      id: file.getId(),
      nombre: nombre,
      fechaModificacion: fechaMod,
      propietario: file.getOwner().getName(),
      tamanio: formatearTamanio(file.getSize()),
      url: file.getUrl()
    });
  }
  
  // Ordenar por fecha de modificación (más reciente primero)
  archivos.sort(function(a, b) {
    return b.fechaModificacion - a.fechaModificacion;
  });
  
  Logger.log('✅ Archivos encontrados: ' + archivos.length);
  
  return archivos;
}

// ═══════════════════════════════════════════════════════════════
// 📋 MOSTRAR SELECTOR DE ARCHIVOS
// ═══════════════════════════════════════════════════════════════

/**
 * Muestra un diálogo con la lista de archivos para seleccionar
 * @param {Array} archivos - Lista de archivos encontrados
 * @return {Object} Archivo seleccionado o null
 */
function mostrarSelectorArchivos(archivos) {
  var ui = SpreadsheetApp.getUi();
  
  // Construir mensaje con lista de archivos
  var mensaje = '📁 ARCHIVOS DISPONIBLES:\n\n';
  
  for (var i = 0; i < archivos.length; i++) {
    var archivo = archivos[i];
    mensaje += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    mensaje += (i + 1) + '. ' + archivo.nombre + '\n';
    mensaje += '   📅 Modificado: ' + formatearFecha(archivo.fechaModificacion) + '\n';
    mensaje += '   👤 Propietario: ' + archivo.propietario + '\n';
    mensaje += '   📦 Tamaño: ' + archivo.tamanio + '\n';
    mensaje += '\n';
  }
  
  mensaje += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  mensaje += '💡 Ingresa el número del archivo a importar (1-' + archivos.length + '):';
  
  // Mostrar diálogo de selección
  var respuesta = ui.prompt(
    '📂 Seleccionar Archivo CSV',
    mensaje,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (respuesta.getSelectedButton() !== ui.Button.OK) {
    return null;
  }
  
  var seleccion = parseInt(respuesta.getResponseText());
  
  if (isNaN(seleccion) || seleccion < 1 || seleccion > archivos.length) {
    ui.alert('❌ Selección inválida', 'Debes ingresar un número entre 1 y ' + archivos.length, ui.ButtonSet.OK);
    return null;
  }
  
  return archivos[seleccion - 1];
}

// ═══════════════════════════════════════════════════════════════
// 📥 IMPORTAR ARCHIVO CSV VÍA GOOGLE SHEETS
// ═══════════════════════════════════════════════════════════════

/**
 * Importa el archivo CSV convirtiéndolo primero a Google Sheets
 * @param {Object} archivo - Información del archivo a importar
 */
function importarArchivoCSVDesdeSheets(archivo) {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('🚀 IMPORTACIÓN VÍA GOOGLE SHEETS');
    Logger.log('═══════════════════════════════════════════════════');
    
    var tiempoInicio = new Date();
    
    // 1️⃣ Obtener archivo CSV
    Logger.log('📂 Paso 1/6: Abriendo archivo CSV...');
    ss.toast('📂 Abriendo archivo...', 'Paso 1/6', 3);
    
    var archivoCSV = DriveApp.getFileById(archivo.id);
    var tamanioMB = (archivoCSV.getSize() / (1024 * 1024)).toFixed(2);
    Logger.log('  ✓ Archivo: ' + archivo.nombre);
    Logger.log('  ✓ Tamaño: ' + tamanioMB + ' MB');
    
    // 2️⃣ Convertir CSV a Google Sheets
    Logger.log('🔄 Paso 2/6: Convirtiendo a Google Sheets...');
    ss.toast('🔄 Convirtiendo a Google Sheets...', 'Paso 2/6', 5);
    
    var archivoTemporal = convertirCSVaSheets(archivoCSV);
    Logger.log('  ✓ Archivo temporal creado: ' + archivoTemporal.getId());
    
    // 3️⃣ Abrir como Spreadsheet
    Logger.log('📊 Paso 3/6: Abriendo Spreadsheet...');
    ss.toast('📊 Leyendo datos...', 'Paso 3/6', 3);
    
    var spreadsheetTemporal = SpreadsheetApp.open(archivoTemporal);
    var hojaTemporal = spreadsheetTemporal.getSheets()[0];
    
    // Obtener dimensiones
    var ultimaFila = hojaTemporal.getLastRow();
    var ultimaColumna = hojaTemporal.getLastColumn();
    
    Logger.log('  ✓ Dimensiones: ' + ultimaFila + ' filas × ' + ultimaColumna + ' columnas');
    
    if (ultimaFila === 0 || ultimaColumna === 0) {
      throw new Error('El archivo está vacío o no se pudo leer correctamente');
    }
    
    // 4️⃣ Leer todos los datos
    Logger.log('📖 Paso 4/6: Leyendo datos...');
    ss.toast('📖 Leyendo ' + ultimaFila.toLocaleString() + ' filas...', 'Paso 4/6', 3);
    
    var datos = hojaTemporal.getRange(1, 1, ultimaFila, ultimaColumna).getValues();
    Logger.log('  ✓ Datos leídos: ' + datos.length + ' filas');
    
    // 5️⃣ Preparar hoja destino
    Logger.log('📋 Paso 5/6: Preparando hoja destino...');
    ss.toast('📋 Preparando hoja destino...', 'Paso 5/6', 3);
    
    var hojaDestino = ss.getSheetByName(CONFIG_IMPORTADOR.hojaDestino);
    
    if (!hojaDestino) {
      hojaDestino = ss.insertSheet(CONFIG_IMPORTADOR.hojaDestino);
      Logger.log('  ✓ Hoja creada: ' + CONFIG_IMPORTADOR.hojaDestino);
    } else {
      Logger.log('  ✓ Hoja existente: ' + CONFIG_IMPORTADOR.hojaDestino);
    }
    
    // Limpiar hoja
    hojaDestino.clear();
    
    // Ajustar dimensiones
    if (hojaDestino.getMaxColumns() < ultimaColumna) {
      hojaDestino.insertColumnsAfter(hojaDestino.getMaxColumns(), ultimaColumna - hojaDestino.getMaxColumns());
    }
    
    if (hojaDestino.getMaxRows() < ultimaFila) {
      hojaDestino.insertRowsAfter(hojaDestino.getMaxRows(), ultimaFila - hojaDestino.getMaxRows());
    }
    
    Logger.log('  ✓ Hoja preparada: ' + ultimaFila + ' filas × ' + ultimaColumna + ' columnas');
    
    // 6️⃣ Escribir datos en lotes
    Logger.log('💾 Paso 6/6: Escribiendo datos...');
    ss.toast('💾 Escribiendo datos (0%)...', 'Paso 6/6', -1);
    
    escribirDatosOptimizado(hojaDestino, datos, ultimaColumna, ultimaFila, ss);
    
    // 7️⃣ Formatear encabezados
    Logger.log('🎨 Aplicando formato...');
    ss.toast('🎨 Aplicando formato...', 'Finalizando', 3);
    
    try {
      hojaDestino.getRange(1, 1, 1, ultimaColumna)
        .setFontWeight('bold')
        .setBackground('#4A86E8')
        .setFontColor('#FFFFFF');
      
      hojaDestino.setFrozenRows(1);
      
      // Ajustar ancho de columnas automáticamente (solo primeras 10)
      for (var i = 1; i <= Math.min(10, ultimaColumna); i++) {
        hojaDestino.autoResizeColumn(i);
      }
      
    } catch (e) {
      Logger.log('⚠️ No se pudo aplicar formato: ' + e.message);
    }
    
    // 8️⃣ Eliminar archivo temporal
    Logger.log('🗑️ Limpiando archivos temporales...');
    try {
      Drive.Files.remove(archivoTemporal.getId());
      Logger.log('  ✓ Archivo temporal eliminado');
    } catch (e) {
      Logger.log('  ⚠️ No se pudo eliminar archivo temporal: ' + e.message);
      Logger.log('  ℹ️ Puedes eliminarlo manualmente desde Drive');
    }
    
    var tiempoFin = new Date();
    var duracion = Math.round((tiempoFin - tiempoInicio) / 1000);
    
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('✅ IMPORTACIÓN COMPLETADA');
    Logger.log('  Tiempo total: ' + duracion + ' segundos');
    Logger.log('  Filas: ' + (ultimaFila - 1).toLocaleString());
    Logger.log('  Columnas: ' + ultimaColumna);
    Logger.log('═══════════════════════════════════════════════════');
    
    ss.toast('✅ Completado en ' + duracion + 's', 'Éxito', 5);
    
    // Mostrar resumen
    ui.alert(
      '✅ Importación exitosa',
      '📁 Archivo: ' + archivo.nombre + '\n' +
      '📦 Tamaño: ' + tamanioMB + ' MB\n' +
      '📅 Modificado: ' + formatearFecha(archivo.fechaModificacion) + '\n\n' +
      '📊 Datos importados:\n' +
      '   • Filas de datos: ' + (ultimaFila - 1).toLocaleString() + '\n' +
      '   • Columnas: ' + ultimaColumna + '\n' +
      '   • Tiempo: ' + duracion + ' segundos\n\n' +
      '✨ Método: Google Sheets\n' +
      '   (Sin errores de parseo de separadores)',
      ui.ButtonSet.OK
    );
    
  } catch (e) {
    Logger.log('❌ ERROR CRÍTICO: ' + e.message);
    Logger.log('Stack trace: ' + e.stack);
    
    ui.alert(
      '❌ Error al importar',
      'Error: ' + e.message + '\n\n' +
      'Revisa el registro de ejecución para más detalles:\n' +
      'Extensiones → Apps Script → Ver registros',
      ui.ButtonSet.OK
    );
  }
}

/**
 * Convierte un archivo CSV a Google Sheets
 * @param {File} archivoCSV - Archivo CSV de Drive
 * @return {File} Archivo de Google Sheets creado
 */
function convertirCSVaSheets(archivoCSV) {
  try {
    Logger.log('  🔄 Iniciando conversión...');
    
    // Crear recurso para el nuevo archivo
    var resource = {
      title: 'TEMP_IMPORT_' + new Date().getTime(),
      mimeType: MimeType.GOOGLE_SHEETS
    };
    
    var blob = archivoCSV.getBlob();
    
    // Usar Drive API para convertir CSV a Google Sheets
    var file = Drive.Files.insert(resource, blob, {
      convert: true
    });
    
    Logger.log('  ✓ Conversión completada');
    Logger.log('  ✓ ID del archivo temporal: ' + file.id);
    
    return DriveApp.getFileById(file.id);
    
  } catch (e) {
    Logger.log('  ❌ Error en conversión: ' + e.message);
    throw new Error('No se pudo convertir el CSV a Google Sheets: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 💾 FUNCIONES DE ESCRITURA
// ═══════════════════════════════════════════════════════════════

/**
 * Escribe datos de forma optimizada en la hoja
 * @param {Sheet} hoja - Hoja destino
 * @param {Array} datos - Datos a escribir
 * @param {number} numCols - Número de columnas
 * @param {number} numFilas - Número de filas
 * @param {Spreadsheet} ss - Spreadsheet para toast
 */
function escribirDatosOptimizado(hoja, datos, numCols, numFilas, ss) {
  var TAMANO_LOTE = 1000; // Lotes de 1000 filas
  var lotesEscritos = 0;
  var totalLotes = Math.ceil(numFilas / TAMANO_LOTE);
  
  Logger.log('  📦 Escribiendo en ' + totalLotes + ' lotes de ' + TAMANO_LOTE + ' filas');
  
  for (var i = 0; i < numFilas; i += TAMANO_LOTE) {
    var filaInicio = i;
    var filaFin = Math.min(i + TAMANO_LOTE, numFilas);
    var lote = datos.slice(filaInicio, filaFin);
    
    try {
      // Escribir lote completo
      hoja.getRange(filaInicio + 1, 1, lote.length, numCols).setValues(lote);
      
      lotesEscritos++;
      var progreso = Math.round((lotesEscritos / totalLotes) * 100);
      
      Logger.log('  ✓ Lote ' + lotesEscritos + '/' + totalLotes + ' (' + progreso + '%)');
      ss.toast('💾 Escribiendo datos (' + progreso + '%)...', 'Paso 6/6', 1);
      
    } catch (e) {
      Logger.log('  ⚠️ Error en lote ' + lotesEscritos + ': ' + e.message);
      Logger.log('  🔄 Intentando escritura fila por fila...');
      
      // Fallback: escribir fila por fila
      for (var j = filaInicio; j < filaFin; j++) {
        try {
          hoja.getRange(j + 1, 1, 1, numCols).setValues([datos[j]]);
        } catch (e2) {
          Logger.log('  ❌ Error en fila ' + (j + 1) + ': ' + e2.message);
        }
      }
    }
    
    // Forzar flush cada 5 lotes para evitar timeout
    if (lotesEscritos % 5 === 0) {
      SpreadsheetApp.flush();
    }
  }
  
  Logger.log('  ✅ Escritura completada: ' + lotesEscritos + ' lotes');
}

// ═══════════════════════════════════════════════════════════════
// 🚀 FUNCIÓN RÁPIDA: Importar Archivo por Nombre Exacto
// ═══════════════════════════════════════════════════════════════

/**
 * Importa directamente el archivo configurado sin selector
 * (Útil para automatización con triggers)
 */
function importarCSVDirecto() {
  var archivos = buscarArchivosCSV();
  
  if (archivos.length === 0) {
    SpreadsheetApp.getUi().alert('❌ No se encontró el archivo: ' + CONFIG_IMPORTADOR.nombreArchivo);
    return;
  }
  
  // Buscar archivo con nombre exacto
  var archivoEncontrado = null;
  for (var i = 0; i < archivos.length; i++) {
    if (archivos[i].nombre === CONFIG_IMPORTADOR.nombreArchivo) {
      archivoEncontrado = archivos[i];
      break;
    }
  }
  
  if (!archivoEncontrado) {
    // Si no hay coincidencia exacta, tomar el más reciente
    archivoEncontrado = archivos[0];
  }
  
  importarArchivoCSVDesdeSheets(archivoEncontrado);
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════

/**
 * Formatea fecha a string legible
 * @param {Date} fecha
 * @return {string}
 */
function formatearFecha(fecha) {
  var dia = fecha.getDate();
  var mes = fecha.getMonth() + 1;
  var anio = fecha.getFullYear();
  var hora = fecha.getHours();
  var minuto = fecha.getMinutes();
  
  return dia + '/' + mes + '/' + anio + ' ' + 
         (hora < 10 ? '0' : '') + hora + ':' + 
         (minuto < 10 ? '0' : '') + minuto;
}

/**
 * Formatea tamaño de archivo
 * @param {number} bytes
 * @return {string}
 */
function formatearTamanio(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ═══════════════════════════════════════════════════════════════
// 🧪 FUNCIONES DE DIAGNÓSTICO
// ═══════════════════════════════════════════════════════════════

/**
 * Diagnóstico: Prueba la conversión CSV → Google Sheets
 */
function diagnosticarConversionSheets() {
  try {
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('🔍 DIAGNÓSTICO DE CONVERSIÓN A GOOGLE SHEETS');
    Logger.log('═══════════════════════════════════════════════════\n');
    
    var archivos = buscarArchivosCSV();
    
    if (archivos.length === 0) {
      Logger.log('❌ No se encontraron archivos CSV');
      return;
    }
    
    var archivo = archivos[0];
    Logger.log('📁 Archivo: ' + archivo.nombre);
    Logger.log('📦 Tamaño: ' + archivo.tamanio);
    Logger.log('');
    
    var tiempoInicio = new Date();
    
    // Obtener archivo
    Logger.log('📂 Abriendo archivo...');
    var archivoCSV = DriveApp.getFileById(archivo.id);
    Logger.log('  ✓ Archivo obtenido');
    
    // Convertir
    Logger.log('\n🔄 Convirtiendo a Google Sheets...');
    var archivoTemporal = convertirCSVaSheets(archivoCSV);
    
    var tiempoConversion = new Date();
    var duracionConversion = Math.round((tiempoConversion - tiempoInicio) / 1000);
    
    Logger.log('  ✓ Conversión completada en ' + duracionConversion + ' segundos');
    Logger.log('  ✓ ID: ' + archivoTemporal.getId());
    
    // Abrir y analizar
    Logger.log('\n📊 Analizando resultado...');
    var spreadsheet = SpreadsheetApp.open(archivoTemporal);
    var hoja = spreadsheet.getSheets()[0];
    
    var filas = hoja.getLastRow();
    var columnas = hoja.getLastColumn();
    
    Logger.log('  ✓ Filas: ' + filas.toLocaleString());
    Logger.log('  ✓ Columnas: ' + columnas);
    
    // Mostrar primeras 3 filas
    if (filas > 0 && columnas > 0) {
      Logger.log('\n📄 PRIMERAS 3 FILAS:');
      Logger.log('─────────────────────────────────────────────────');
      
      var datosPreview = hoja.getRange(1, 1, Math.min(3, filas), columnas).getValues();
      
      for (var i = 0; i < datosPreview.length; i++) {
        Logger.log('\nFila ' + (i + 1) + ':');
        for (var j = 0; j < Math.min(10, datosPreview[i].length); j++) {
          var valor = datosPreview[i][j];
          if (valor.toString().length > 50) {
            valor = valor.toString().substring(0, 47) + '...';
          }
          Logger.log('  [' + (j + 1) + '] ' + valor);
        }
        if (datosPreview[i].length > 10) {
          Logger.log('  ... y ' + (datosPreview[i].length - 10) + ' columnas más');
        }
      }
    }
    
    // Limpiar
    Logger.log('\n🗑️ Eliminando archivo temporal...');
    try {
      Drive.Files.remove(archivoTemporal.getId());
      Logger.log('  ✓ Archivo temporal eliminado');
    } catch (e) {
      Logger.log('  ⚠️ No se pudo eliminar: ' + e.message);
    }
    
    var tiempoFin = new Date();
    var duracionTotal = Math.round((tiempoFin - tiempoInicio) / 1000);
    
    Logger.log('\n═══════════════════════════════════════════════════');
    Logger.log('✅ DIAGNÓSTICO COMPLETADO en ' + duracionTotal + ' segundos');
    Logger.log('═══════════════════════════════════════════════════');
    
  } catch (e) {
    Logger.log('❌ Error en diagnóstico: ' + e.message);
    Logger.log(e.stack);
  }
}

/**
 * Diagnóstico: Lista archivos temporales para limpiar
 */
function listarArchivosTemporales() {
  try {
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('🗑️ ARCHIVOS TEMPORALES');
    Logger.log('═══════════════════════════════════════════════════\n');
    
    var query = 'title contains "TEMP_IMPORT_" and mimeType="application/vnd.google-apps.spreadsheet"';
    var files = DriveApp.searchFiles(query);
    
    var contador = 0;
    
    while (files.hasNext()) {
      var file = files.next();
      contador++;
      
      Logger.log(contador + '. ' + file.getName());
      Logger.log('   ID: ' + file.getId());
      Logger.log('   Creado: ' + formatearFecha(file.getDateCreated()));
      Logger.log('');
    }
    
    if (contador === 0) {
      Logger.log('✓ No hay archivos temporales');
    } else {
      Logger.log('Total: ' + contador + ' archivos temporales');
    }
    
    Logger.log('\n═══════════════════════════════════════════════════');
    
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

/**
 * Limpia todos los archivos temporales
 */
function limpiarArchivosTemporales() {
  try {
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('🗑️ LIMPIANDO ARCHIVOS TEMPORALES');
    Logger.log('═══════════════════════════════════════════════════\n');
    
    var query = 'title contains "TEMP_IMPORT_" and mimeType="application/vnd.google-apps.spreadsheet"';
    var files = DriveApp.searchFiles(query);
    
    var eliminados = 0;
    var errores = 0;
    
    while (files.hasNext()) {
      var file = files.next();
      
      try {
        Logger.log('Eliminando: ' + file.getName());
        Drive.Files.remove(file.getId());
        eliminados++;
      } catch (e) {
        Logger.log('  ❌ Error: ' + e.message);
        errores++;
      }
    }
    
    Logger.log('\n═══════════════════════════════════════════════════');
    Logger.log('✅ Archivos eliminados: ' + eliminados);
    if (errores > 0) {
      Logger.log('⚠️ Errores: ' + errores);
    }
    Logger.log('═══════════════════════════════════════════════════');
    
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}
