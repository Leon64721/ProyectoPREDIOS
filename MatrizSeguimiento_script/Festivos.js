/**
 * IMPORTAR FESTIVOS COLOMBIA (2015 - ACTUALIDAD)
 * Consulta el calendario oficial de Google y actualiza la hoja 'FESTIVOS'
 */
function importarFestivosColombia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hojaFestivos = ss.getSheetByName('FESTIVOS');
  
  // Si no existe la hoja, la crea
  if (!hojaFestivos) {
    hojaFestivos = ss.insertSheet('FESTIVOS');
    LoggerSistema.info('Hoja FESTIVOS creada.');
  }

  // Limpieza total para evitar duplicados o fechas viejas
  hojaFestivos.clear();
  hojaFestivos.getRange('A1:B1').setValues([['Nombre del Festivo', 'Fecha']])
              .setFontWeight('bold').setBackground('#4285f4').setFontColor('white');

  const calId = 'es.co#holiday@group.v.calendar.google.com';
  const cal = CalendarApp.getCalendarById(calId);
  
  if (!cal) {
    throw new Error('No se pudo acceder al calendario de festivos de Colombia. Verifica los permisos.');
  }

  // Definimos el rango: Desde 2015 hasta el 31 de diciembre del año actual
  const anioActual = new Date().getFullYear();
  const fechaInicio = new Date('2015-01-01T00:00:00Z');
  const fechaFin = new Date(anioActual + '-12-31T23:59:59Z');

  LoggerSistema.info(`Consultando festivos desde 2015 hasta ${anioActual}...`);
  
  const eventos = cal.getEvents(fechaInicio, fechaFin);
  
  if (eventos.length === 0) {
    LoggerSistema.warning('No se encontraron eventos en el calendario.');
    return;
  }

  // Procesamos los datos (Nombre en A, Fecha en B)
  const datosFestivos = eventos.map(e => {
    return [e.getTitle(), e.getStartTime()];
  });

  // Ordenar por fecha (Ascendente)
  datosFestivos.sort((a, b) => a[1] - b[1]);

  // Pegamos los datos empezando en la fila 2
  hojaFestivos.getRange(2, 1, datosFestivos.length, 2).setValues(datosFestivos);
  
  // Aplicar formato de fecha a la columna B
  hojaFestivos.getRange(2, 2, datosFestivos.length, 1).setNumberFormat('dd/mm/yyyy');
  
  LoggerSistema.success(`✅ Calendario actualizado: ${datosFestivos.length} festivos importados.`);
}