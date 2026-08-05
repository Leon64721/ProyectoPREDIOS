function verEncabezados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Datos'); // cambia el nombre según necesites
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  Logger.log(encabezados.join('\n'));
}
