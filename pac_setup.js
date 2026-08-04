// ═══════════════════════════════════════════════════════════════════════════════
// PAC_SETUP.GS — Instalación y Diagnóstico v2.0
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Instalación completa del módulo PAC.
 */
function instalarModuloPACCompleto() {
  try {
    console.log('=== INSTALACIÓN MÓDULO PAC v2.0 INICIADA ===');
    console.log('SS_PADRE_ID: ' + PAC_CONFIG.SS_PADRE_ID);

    // ── Activar buffer de logs — evita timeouts durante la instalación ──────
    pac_logIniciarBuffer();

    pac_clearSSCache();
    var ss;
    try {
      ss = pac_getSpreadsheet();
      console.log('✅ SS conectado: ' + ss.getName());
    } catch(e) {
      console.error('❌ No se pudo conectar al SS: ' + e.message);
      return { success: false, error: 'Sin acceso al Spreadsheet: ' + e.message };
    }

    const reporte = [];

    // ── PASO 0: Crear hoja LOG ───────────────────────────────────────────────
    const pasoLog = pac_crearHojaInterna(ss, PAC_CONFIG.HOJAS_INTERNAS.LOG, 'LOG');
    reporte.push(pasoLog);
    console.log('LOG: ' + pasoLog.status);

    // ── PASO 1: Verificar acceso al PAC externo ──────────────────────────────
    const accesoExt = pac_verificarAccesoExterno();
    reporte.push(accesoExt);
    console.log('PAC externo: ' + accesoExt.status + ' | ' + accesoExt.msg);

    if (accesoExt.status === 'ERROR') {
      pac_logVaciarBuffer();
      return { success: false, error: accesoExt.msg, reporte };
    }

    // ── PASO 2: Crear hojas internas ─────────────────────────────────────────
    Object.entries(PAC_CONFIG.HOJAS_INTERNAS).forEach(([key, nombre]) => {
      if (nombre === PAC_CONFIG.HOJAS_INTERNAS.LOG) return;
      const paso = pac_crearHojaInterna(ss, nombre, key);
      reporte.push(paso);
      console.log('Hoja ' + nombre + ': ' + paso.status);
    });

    // ── PASO 3: Reglas del motor ─────────────────────────────────────────────
    try {
      pac_guardarReglasReemplazo(PAC_REGLAS_REEMPLAZO_DEFAULT);
      reporte.push({ paso: 'REGLAS_MOTOR', status: 'OK', msg: 'Reglas instaladas' });
      console.log('Reglas motor: OK');
    } catch(eR) {
      reporte.push({ paso: 'REGLAS_MOTOR', status: 'ERROR', msg: eR.message });
      console.log('Reglas motor: ERROR — ' + eR.message);
    }

    // ── PASO 4: Sincronización — con reintentos ──────────────────────────────
    console.log('Sincronizando PAC externo...');
    let sync = { success: false };
    let intentoSync = 0;
    const MAX_INTENTOS_SYNC = 2;

    while (!sync.success && intentoSync < MAX_INTENTOS_SYNC) {
      intentoSync++;
      try {
        console.log('Intento sync ' + intentoSync + '/' + MAX_INTENTOS_SYNC + '...');
        sync = sincronizarPAC();
        console.log('Sync: ' + JSON.stringify({
          success: sync.success, total: sync.total, cambios: sync.cambios
        }));
      } catch(eS) {
        console.log('Sync intento ' + intentoSync + ' ERROR: ' + eS.message);
        if (intentoSync < MAX_INTENTOS_SYNC) {
          console.log('Esperando 3 segundos antes de reintentar...');
          Utilities.sleep(3000);
        } else {
          sync = { success: false, error: eS.message };
        }
      }
    }

    reporte.push({
      paso: 'SYNC_INICIAL',
      status: sync.success ? 'OK' : 'ERROR',
      msg: 'Total: ' + (sync.total || 0) + ' | Cambios: ' + (sync.cambios || 0)
    });

    // ── PASO 5: Aprobar borrador ─────────────────────────────────────────────
    if (sync.success && (sync.total || 0) > 0) {
      try {
        const aprobacion = aprobarBorradorPAC('Instalación inicial automática');
        reporte.push({
          paso: 'APROBACION_INICIAL',
          status: aprobacion.success ? 'OK' : 'ERROR',
          msg: 'Registros: ' + (aprobacion.registros || 0)
        });
        console.log('Aprobación: ' + (aprobacion.success ? 'OK' : 'ERROR'));
      } catch(eA) {
        reporte.push({ paso: 'APROBACION_INICIAL', status: 'ERROR', msg: eA.message });
        console.log('Aprobación ERROR: ' + eA.message);
      }
    } else {
      const razon = !sync.success ? 'Sync falló' : 'Sin registros que aprobar';
      reporte.push({ paso: 'APROBACION_INICIAL', status: 'OMITIDO', msg: razon });
      console.log('Aprobación: OMITIDA (' + razon + ')');
    }

    // ── PASO 6: Articuladores ────────────────────────────────────────────────
    try {
      pac_poblarArticuladores(ss);
      reporte.push({ paso: 'ARTICULADORES', status: 'OK' });
      console.log('Articuladores: OK');
    } catch(eArt) {
      reporte.push({ paso: 'ARTICULADORES', status: 'ERROR', msg: eArt.message });
      console.log('Articuladores ERROR: ' + eArt.message);
    }

    // ── PASO 7: Triggers ─────────────────────────────────────────────────────
    try {
      const triggers = instalarTriggersPAC();
      reporte.push({
        paso: 'TRIGGERS',
        status: triggers.success ? 'OK' : 'ERROR',
        msg: triggers.mensaje || triggers.error
      });
      console.log('Triggers: ' + (triggers.success ? 'OK' : 'ERROR'));
    } catch(eTr) {
      reporte.push({ paso: 'TRIGGERS', status: 'ERROR', msg: eTr.message });
      console.log('Triggers ERROR: ' + eTr.message);
    }

    // ── Vaciar buffer de logs AL FINAL (una sola escritura) ──────────────────
    pac_logVaciarBuffer();

    // ── Resumen ──────────────────────────────────────────────────────────────
    const errores = reporte.filter(r => r.status === 'ERROR').length;
    const resumen = errores === 0
      ? '✅ Instalación completada sin errores (' + reporte.length + ' pasos)'
      : '⚠️ Instalación con ' + errores + ' error(es) de ' + reporte.length + ' pasos';

    console.log(resumen);
    console.log('REPORTE COMPLETO: ' + JSON.stringify(reporte, null, 2));

    return { success: true, resumen, errores, reporte };

  } catch(e) {
    pac_logVaciarBuffer();
    console.error('❌ Error crítico en instalación: ' + e.message);
    return { success: false, error: e.message };
  }
}




/**
 * Verifica el acceso al archivo PAC externo.
 */
function pac_verificarAccesoExterno() {
  try {
    const extSS = SpreadsheetApp.openById(PAC_CONFIG.PAC_SPREADSHEET_ID);
    const hojasNecesarias  = ['PAC IDU', 'PAC TRANSMILENIO', 'PAC VIGENCIA TMM'];
    const hojasOpcionales  = ['PAC INICIAL']; // ← no bloquea la instalación
    const hojasEncontradas = [];
    const hojasFaltantes   = [];

    // Solo verificar las hojas NECESARIAS para el error
    hojasNecesarias.forEach(nombre => {
      const h = extSS.getSheetByName(nombre);
      if (h) hojasEncontradas.push(nombre);
      else   hojasFaltantes.push(nombre);
    });

    // Verificar opcionales solo para info
    hojasOpcionales.forEach(nombre => {
      const h = extSS.getSheetByName(nombre);
      if (h) hojasEncontradas.push(nombre + ' (opcional)');
    });

    if (hojasFaltantes.length > 0) {
      // Solo es ERROR si faltan hojas NECESARIAS
      return {
        paso: 'ACCESO_EXTERNO',
        status: 'ERROR',
        msg: 'Hojas necesarias no encontradas: ' + hojasFaltantes.join(', '),
        hojasEncontradas,
        hojasFaltantes
      };
    }

    return {
      paso: 'ACCESO_EXTERNO',
      status: 'OK',
      msg: 'Acceso correcto. Hojas: ' + hojasEncontradas.join(', '),
      hojasEncontradas,
      hojasFaltantes: []
    };

  } catch(e) {
    return {
      paso: 'ACCESO_EXTERNO',
      status: 'ERROR',
      msg: 'Sin acceso al PAC externo: ' + e.message
    };
  }
}


/**
 * Crea e inicializa una hoja interna con sus encabezados.
 */
function pac_crearHojaInterna(ss, nombre, tipo) {
  try {
    let hoja = ss.getSheetByName(nombre);
    if (!hoja) {
      hoja = ss.insertSheet(nombre);
    }

    // Solo inicializar si está vacía
    if (hoja.getLastRow() > 0) {
      return { paso: 'HOJA_' + tipo, status: 'YA_EXISTE', msg: nombre + ' ya existe' };
    }

    // Headers según tipo de hoja
    const headersMap = {
      VIGENTE:       ['RT','CRP','TIPO_NEG','BENEFICIARIO','PROYECTO','FUENTE','SALDO_2026','CDP','CDP_VALOR','OBSERVACIONES','ESTADO_PREDIAL_ACTUAL'],
      BORRADOR:      ['RT','CRP','TIPO_NEG','BENEFICIARIO','PROYECTO','FUENTE','SALDO_2026','CDP','CDP_VALOR','OBSERVACIONES'],
      HISTORIAL:     ['FECHA','USUARIO','TIPO','DETALLE'],
      ALERTAS:       ['FECHA','CORREO','CANT_PREDIOS','MES','ESTADO'],
      ARTICULADORES: ['NOMBRE','CORREO','PROYECTO','FECHA_ACTUALIZACION'],
      LOG:           ['FECHA','NIVEL','MODULO','MENSAJE','USUARIO']
    };

    const headers = headersMap[tipo] || ['FECHA','DETALLE'];
    hoja.appendRow(headers);

    // Formato del encabezado
    hoja.getRange(1, 1, 1, headers.length)
        .setBackground('#2c3e50')
        .setFontColor('white')
        .setFontWeight('bold');

    return { paso: 'HOJA_' + tipo, status: 'OK', msg: nombre + ' creada' };

  } catch(e) {
    return { paso: 'HOJA_' + tipo, status: 'ERROR', msg: e.message };
  }
}

/**
 * Puebla el directorio de articuladores desde los datos del PAC.
 */
function pac_poblarArticuladores(ss) {
  try {
    const extSS = SpreadsheetApp.openById(PAC_CONFIG.PAC_SPREADSHEET_ID);
    const hoja  = extSS.getSheetByName(PAC_CONFIG.PAC_SHEETS.IDU.nombre);
    if (!hoja) return;

    const datos   = hoja.getDataRange().getValues();
    const headers = datos[0].map(h => String(h).trim());
    const idxArt  = pac_getColIdx(headers, 'ARTICULADOR');
    const idxProy = pac_getColIdx(headers, 'PROYECTO');
    if (idxArt < 0) return;

    // Recopilar articuladores únicos
    const articuladores = {};
    for (let i = 1; i < datos.length; i++) {
      const nombre  = String(datos[i][idxArt]  || '').trim();
      const proyecto= String(datos[i][idxProy] || '').trim();
      if (!nombre) continue;
      if (!articuladores[nombre]) {
        articuladores[nombre] = { nombre, proyecto, correo: '' };
      }
    }

    // Guardar en PAC_Articuladores
    let hArt = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.ARTICULADORES);
    if (!hArt) hArt = ss.insertSheet(PAC_CONFIG.HOJAS_INTERNAS.ARTICULADORES);

    Object.values(articuladores).forEach(art => {
      hArt.appendRow([art.nombre, art.correo, art.proyecto, new Date()]);
    });

    pac_log('Articuladores poblados: ' + Object.keys(articuladores).length);

  } catch(e) {
    pac_log('Error poblando articuladores: ' + e.message, 'ERROR');
  }
}

/**
 * Diagnóstico completo del módulo PAC.
 */
function diagnosticarModuloPAC() {
  try {
    const ss = pac_getSpreadsheet();
    const reporte = {};

    // 1. Verificar hojas internas
    Object.entries(PAC_CONFIG.HOJAS_INTERNAS).forEach(([key, nombre]) => {
      const hoja = ss.getSheetByName(nombre);
      reporte['HOJA_' + key] = {
        existe:    !!hoja,
        registros: hoja ? Math.max(0, hoja.getLastRow() - 1) : 0,
        status:    hoja ? 'OK' : 'FALTA'
      };
    });

    // 2. Verificar PAC Vigente
    const hVig = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.VIGENTE);
    if (hVig && hVig.getLastRow() > 1) {
      const headers = hVig.getRange(1, 1, 1, hVig.getLastColumn()).getValues()[0];
      reporte.PAC_VIGENTE_COLUMNAS = {
        total:      headers.length,
        tieneMeses: PAC_CONFIG.MESES.some(m => headers.some(h => String(h).includes(m))),
        status:     'OK'
      };
    }

    // 3. Verificar triggers
    reporte.TRIGGERS = pac_verificarTriggers();

    // 4. Verificar articuladores
    const hArt = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.ARTICULADORES);
    if (hArt && hArt.getLastRow() > 1) {
      const datos   = hArt.getDataRange().getValues();
      const headers = datos[0].map(h => String(h).trim());
      const idxCor  = pac_getColIdx(headers, 'CORREO');
      const sinCorreo = datos.slice(1).filter(f =>
        !String(f[idxCor] || '').includes('@')
      ).length;

      reporte.ARTICULADORES = {
        total:      hArt.getLastRow() - 1,
        sinCorreo,
        status:     sinCorreo === 0 ? 'OK' : 'ADVERTENCIA'
      };
    }

    // 5. Verificar acceso externo
    reporte.ACCESO_EXTERNO = pac_verificarAccesoExterno();

    // 6. Verificar reglas del motor
    const reglas = pac_cargarReglasReemplazo();
    reporte.MOTOR_REGLAS = {
      total:   reglas.length,
      activas: reglas.filter(r => r.activa).length,
      status:  'OK'
    };

    pac_log('Diagnóstico completado');
    return { success: true, reporte, timestamp: new Date().toISOString() };

  } catch(e) {
    pac_log('Error en diagnóstico: ' + e.message, 'ERROR');
    return { success: false, error: e.message };
  }
}
