/**
 * ═══════════════════════════════════════════════════════════════
 * MENÚ Y ORQUESTACIÓN v6.0
 * ═══════════════════════════════════════════════════════════════
 * Pipeline ETL de 8 fases SIN pérdida de filas
 * ═══════════════════════════════════════════════════════════════
 */

function onOpenNormalizacion() {
  SpreadsheetApp.getUi()
    .createMenu('🔧 Normalización IDU')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('📥 Importar CSV')
      .addItem('🔍 Buscar y Seleccionar Archivo', 'seleccionarYImportarCSV')
      .addItem('⚡ Importar Directamente',         'importarCSVDirecto'))
    .addSeparator()
    .addItem('▶️ Ejecutar Normalización Completa', 'ejecutarNormalizacionCompleta')
    .addItem('🔍 Solo Analizar (sin modificar)',   'ejecutarSoloAnalisis')
    .addItem('⚙️ Ver Configuración',                'mostrarConfiguracion')
    .addToUi();
}

function ejecutarNormalizacionCompleta() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('🔧 Normalización IDU v6.0',
    'Pipeline ETL de 8 fases:\n\n' +
    '0. Limpieza previa\n' +
    '1. Extracción (lee TODAS las filas)\n' +
    '2. Normalización de encabezados\n' +
    '3. Tipado estricto (ÚNICA capa de limpieza)\n' +
    '4. Enriquecimiento TRAMO\n' +
    '5. Integración/unificación\n' +
    '6. Estructura objetivo\n' +
    '7. Materialización con colores\n' +
    '8. Reportes y log\n\n' +
    '⚠️ Duración: 3-5 min\n¿Continuar?',
    ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inicio = new Date();
  var log = [];

  try {
    log.push('═══════════════════════════════════════');
    log.push('  NORMALIZACIÓN IDU v6.0');
    log.push('═══════════════════════════════════════');
    log.push('INICIO: ' + generarTimestamp());
    log.push('Usuario: ' + obtenerInfoUsuario());
    log.push('');

    // ── FASE 0 ────────────────────────────────
    ss.toast('Fase 0: Limpiando filtros...', 'Procesando', -1);
    var filtros = limpiarTodosFiltros();
    log.push('FASE 0 — Filtros eliminados: ' + filtros);

    // ── FASE 1 ────────────────────────────────
    ss.toast('Fase 1: Leyendo datos origen...', 'Procesando', -1);
    var hojaOrigen = validarHojaExiste(ss, CONFIG_NORMALIZACION.hojas.origen);
    var filasOrigen = hojaOrigen.getLastRow() - 1;
    var datosOriginales = leerHojaCompleta(hojaOrigen);
    log.push('FASE 1 — Filas leídas: ' + datosOriginales.datos.length + ' | Columnas: ' + datosOriginales.columnas.length);

    if (datosOriginales.datos.length !== filasOrigen) {
      log.push('⚠ ALERTA: Filas origen (' + filasOrigen + ') ≠ leídas (' + datosOriginales.datos.length + ')');
    }

    // ── FASE 3 ────────────────────────────────
    ss.toast('Fase 3: Tipado estricto...', 'Procesando', -1);
    var datosConTipos = preprocesarTiposDatos(datosOriginales);
    log.push('FASE 3 — Tipado completado');

    // ── FASE 4 ────────────────────────────────
    ss.toast('Fase 4: Completando TRAMO...', 'Procesando', -1);
    var datosConTramo = completarTramoDesdeProyecto(datosConTipos);
    log.push('FASE 4 — TRAMO completado en ' + datosConTramo.filasModificadas.length + ' filas');

    // ── FASE 5 ────────────────────────────────
    ss.toast('Fase 5: Unificando columnas...', 'Procesando', -1);
    var resultado = unificarColumnas(datosConTramo);
    log.push('FASE 5 — Unificaciones: ' + resultado.unificaciones.length + ' | Conflictos: ' + resultado.conflictos.length + ' | Filas: ' + resultado.datos.length);

    // Validación crítica: las filas deben coincidir
    if (resultado.datos.length !== datosOriginales.datos.length) {
      log.push('❌ PÉRDIDA DE FILAS en Fase 5: ' + datosOriginales.datos.length + ' → ' + resultado.datos.length);
      throw new Error('Fase 5 perdió filas: ' + datosOriginales.datos.length + ' → ' + resultado.datos.length);
    }

    // ── FASE 6 ────────────────────────────────
    ss.toast('Fase 6: Aplicando estructura...', 'Procesando', -1);
    var datosNormalizados = aplicarEstructuraObjetivo(resultado.datos, resultado.columnasFinales);
    log.push('FASE 6 — Estructura final: ' + datosNormalizados.columnas.length + ' columnas');

    var rtProb = validarRTs(datosConTramo.datos);
    var analisis = analizarColumnas(datosConTramo.columnas);

    // ── FASE 7 ────────────────────────────────
    ss.toast('Fase 7: Materializando...', 'Procesando', -1);
    crearHojaNormalizada(ss, datosNormalizados, resultado.conflictos);
    log.push('FASE 7 — DATOS_NORMALIZADOS: ' + datosNormalizados.datos.length + ' filas x ' + datosNormalizados.columnas.length + ' columnas');

    // ── FASE 8 ────────────────────────────────
    ss.toast('Fase 8: Generando reportes...', 'Procesando', -1);
    try { generarReporteUnificacion(ss, resultado.unificaciones, resultado.conflictos); log.push('✓ Reporte unificación'); } catch(e) { log.push('⚠ ' + e.message); }
    try { generarReporteConvenciones(ss, datosNormalizados.columnasInsertadas); log.push('✓ Convenciones'); } catch(e) { log.push('⚠ ' + e.message); }
    if (rtProb.length > 0) { try { generarReporteRTProblematicos(ss, rtProb); log.push('✓ RTs problemáticos: ' + rtProb.length); } catch(e) {} }
    if (analisis.similares.length > 0) { try { generarReporteColumnasSimilares(ss, analisis.similares); log.push('✓ Columnas similares: ' + analisis.similares.length); } catch(e) {} }

    var duracion = (new Date() - inicio) / 1000;
    log.push('');
    log.push('═══════════════════════════════════════');
    log.push('FIN: ' + generarTimestamp() + ' — ' + formatearDuracion(duracion));
    log.push('Filas origen:      ' + filasOrigen);
    log.push('Filas destino:     ' + datosNormalizados.datos.length);
    log.push('Match:             ' + (filasOrigen === datosNormalizados.datos.length ? '✓ EXACTO' : '✗ DIFERENTE'));
    log.push('═══════════════════════════════════════');
    guardarLogNormalizacion(ss, log);

    ss.toast('✓ Normalización completada', 'Éxito', 5);
    ui.alert('✅ Completado',
      'Filas origen: ' + filasOrigen + '\n' +
      'Filas destino: ' + datosNormalizados.datos.length + '\n' +
      (filasOrigen === datosNormalizados.datos.length ? '✓ Match exacto\n\n' : '⚠ Discrepancia\n\n') +
      'Duración: ' + formatearDuracion(duracion) + '\n' +
      'Conflictos: ' + resultado.conflictos.length + '\n' +
      'RTs problemáticos: ' + rtProb.length,
      ui.ButtonSet.OK);

  } catch(e) {
    log.push('❌ ERROR: ' + e.message);
    try { guardarLogNormalizacion(ss, log); } catch(_) {}
    ui.alert('❌ Error', e.message + '\n\nRevisa LOG_NORMALIZACION', ui.ButtonSet.OK);
    Logger.log('ERROR: ' + e.message + '\n' + e.stack);
  }
}

function ejecutarSoloAnalisis() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var h = validarHojaExiste(ss, CONFIG_NORMALIZACION.hojas.origen);
    var d = leerHojaCompleta(h);
    var a = analizarColumnas(d.columnas);
    var r = validarRTs(d.datos);
    SpreadsheetApp.getUi().alert('Análisis',
      'Registros: ' + d.datos.length + '\nColumnas: ' + d.columnas.length +
      '\nDuplicadas: ' + a.duplicadas.length + '\nSimilares: ' + a.similares.length +
      '\nRTs problemáticos: ' + r.length,
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {
    SpreadsheetApp.getUi().alert('Error', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function mostrarConfiguracion() {
  var msg = 'Hojas: ' + CONFIG_NORMALIZACION.hojas.origen + ' → ' + CONFIG_NORMALIZACION.hojas.destino +
            '\nReglas: ' + CONFIG_NORMALIZACION.reglasUnificacion.length +
            '\nColumnas objetivo: ' + CONFIG_NORMALIZACION.estructuraObjetivo.length +
            '\nDetección auto: ' + (CONFIG_NORMALIZACION.deteccionAutomatica.activada ? 'Sí' : 'No');
  SpreadsheetApp.getUi().alert('Configuración v6.0', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}