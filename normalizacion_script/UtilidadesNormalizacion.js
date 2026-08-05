/**
 * ═══════════════════════════════════════════════════════════════
 * UTILIDADES v6.0
 * ═══════════════════════════════════════════════════════════════
 */

function calcularSimilitud(str1, str2) {
  if (!str1 || !str2) return 0;
  var s1 = str1.toUpperCase().trim(), s2 = str2.toUpperCase().trim();
  if (s1 === s2) return 1.0;
  var longer = s1.length > s2.length ? s1 : s2;
  var shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

function levenshteinDistance(str1, str2) {
  var m = [];
  for (var i = 0; i <= str2.length; i++) m[i] = [i];
  for (var j = 0; j <= str1.length; j++) m[0][j] = j;
  for (var i = 1; i <= str2.length; i++) {
    for (var j = 1; j <= str1.length; j++) {
      if (str2.charAt(i-1) === str1.charAt(j-1)) m[i][j] = m[i-1][j-1];
      else m[i][j] = Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
    }
  }
  return m[str2.length][str1.length];
}

function esFilaVaciaCompleta(fila) {
  for (var i = 0; i < fila.length; i++) {
    if (fila[i] !== '' && fila[i] !== null && fila[i] !== undefined) return false;
  }
  return true;
}

function crearOLimpiarHoja(ss, nombreHoja) {
  var hoja = ss.getSheetByName(nombreHoja);
  if (hoja) { hoja.clear(); hoja.clearFormats(); }
  else hoja = ss.insertSheet(nombreHoja);
  return hoja;
}

function aplicarFormatoEncabezado(hoja, fila, columnas) {
  hoja.getRange(fila, 1, 1, columnas)
    .setFontWeight('bold')
    .setBackground(CONFIG_NORMALIZACION.colores.encabezado)
    .setFontColor(CONFIG_NORMALIZACION.colores.encabezadoTexto)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  hoja.setFrozenRows(fila);
}

function escribirDatosEnBloques(hoja, datos, filaInicio) {
  if (!datos || datos.length === 0) return;
  var tam = CONFIG_NORMALIZACION.rendimiento.tamañoBloque;
  var tC = datos[0].length;
  for (var i = 0; i < datos.length; i += tam) {
    var fin = Math.min(i + tam, datos.length);
    hoja.getRange(filaInicio + i, 1, fin - i, tC).setValues(datos.slice(i, fin));
  }
}

function generarTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

function formatearDuracion(s) {
  if (s < 60) return s.toFixed(2) + ' seg';
  if (s < 3600) return Math.floor(s/60) + ' min ' + (s%60).toFixed(0) + ' seg';
  return Math.floor(s/3600) + ' h ' + Math.floor((s%3600)/60) + ' min';
}

function obtenerInfoUsuario() {
  try { return Session.getActiveUser().getEmail() || 'Desconocido'; }
  catch(e) { return 'Desconocido'; }
}

function validarHojaExiste(ss, nombre) {
  var h = ss.getSheetByName(nombre);
  if (!h) throw new Error('Hoja no encontrada: "' + nombre + '"');
  return h;
}

function limpiarTodosFiltros() {
  var hojas = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var c = 0;
  for (var i = 0; i < hojas.length; i++) {
    try { var f = hojas[i].getFilter(); if (f) { f.remove(); c++; } } catch(e) {}
  }
  Logger.log('✓ Filtros eliminados: ' + c);
  return c;
}

function obtenerOCrearHoja(ss, nombre) {
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

function agruparFilasContiguas(items) {
  var grupos = [];
  if (items.length === 0) return grupos;
  var inicio = items[0].fila, anterior = items[0].fila, cant = 1;
  for (var i = 1; i < items.length; i++) {
    if (items[i].fila === anterior + 1) { cant++; anterior = items[i].fila; }
    else { grupos.push({ filaInicio: inicio, cantidad: cant }); inicio = items[i].fila; anterior = items[i].fila; cant = 1; }
  }
  grupos.push({ filaInicio: inicio, cantidad: cant });
  return grupos;
}