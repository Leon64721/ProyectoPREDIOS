function testSemaforo() {
  const r = calcularSemaforoPAC({}, 'RADICADO');
  Logger.log('Registros: '  + r.registros.length);
  Logger.log('Prog total: ' + r.totales.totalProgramado);
  Logger.log('Rad total: '  + r.totales.totalRadicado);
  Logger.log('% Rad: '      + r.pctEjecucionRadicado + '%');
  // Ahora DEBE mostrar valores > 0
}
