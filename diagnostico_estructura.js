// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTICO_ESTRUCTURA.GS — Diagnóstico post-migración [2026-10-06]
// Solo lectura. NUNCA escribir IDs reales de spreadsheet en este archivo.
// Contexto completo en DOCUMENTACION_TECNICA_VIVA.md, Secciones 44-48.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ✅ [2026-10-06] Mapa de a qué Script Property corresponde el archivo destino de cada
 * hoja del origen monolítico, según la tabla `mapeoMigracion` real de
 * migracion_automatica_v2.js:224-247 (NO se repite aquí ningún ID, solo el nombre de la
 * Script Property). Las hojas que no aparecen en este mapa se asumen destinadas a
 * DATA_FILES_PRINCIPAL_ID por defecto (todas las de ese bloque en el script de migración
 * original quedan ahí).
 */
const _DIAG_MAPA_DESTINO_HOJA = {
  'LOGS_AUDITORIA':        'DATA_FILES_LOGS_ID',
  'Logs':                  'DATA_FILES_LOGS_ID',
  '📈 Historial de Cambios': 'DATA_FILES_LOGS_ID',
  '📋 Auditoría de Cambios': 'DATA_FILES_LOGS_ID',
  '📊 Logs del Sistema':     'DATA_FILES_LOGS_ID',
  'USUARIOS':              'DATA_FILES_USUARIOS_ID',
  'ASIGNACIONES_EQUIPOS':  'DATA_FILES_USUARIOS_ID',
  'Asignacion_RT':         'DATA_FILES_USUARIOS_ID',
  'Permisos':              'MAESTRO_PERMISOS_ID',
  'PAC_ReglasPAC':         'PAC_DESTINO_SPREADSHEET_ID',
  'LOG_PAC_SISTEMA':       'PAC_DESTINO_SPREADSHEET_ID',
  'ALERTAS_ACTIVAS':       'PAC_DESTINO_SPREADSHEET_ID',
  'PAC_Vigente':           'PAC_DESTINO_SPREADSHEET_ID',
  'PAC_Borrador':          'PAC_DESTINO_SPREADSHEET_ID',
  'PAC_Historial':         'PAC_DESTINO_SPREADSHEET_ID',
  'PAC_Alertas':           'PAC_DESTINO_SPREADSHEET_ID',
  'PAC_Articuladores':     'PAC_DESTINO_SPREADSHEET_ID'
};

/**
 * Lee una hoja y devuelve su resumen de estructura, sin exponer datos de usuarios.
 * Solo lectura. Nunca escribe ni crea nada.
 */
function _diagResumenHoja(ss, nombreHoja) {
  const hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) {
    return { nombre: nombreHoja, existe: false };
  }
  const lastRow = hoja.getLastRow();
  const lastCol = hoja.getLastColumn();
  const filasDatos = Math.max(0, lastRow - 1); // sin contar encabezado
  let headers = [];
  try {
    if (lastRow >= 1 && lastCol >= 1) {
      const anchoHeaders = Math.min(12, lastCol);
      headers = hoja.getRange(1, 1, 1, anchoHeaders).getValues()[0].map(h => String(h || '').trim());
    }
  } catch (e) {
    headers = ['(error leyendo encabezados: ' + e.message + ')'];
  }

  const resumen = {
    nombre: nombreHoja,
    existe: true,
    filasDatos: filasDatos,
    columnas: lastCol,
    oculta: (function () { try { return hoja.isSheetHidden(); } catch (e) { return null; } })(),
    headers: headers
  };

  if (nombreHoja === 'CONFIG_REGLAS') {
    try {
      const b1 = String(hoja.getRange('B1').getValue() || '');
      resumen.configReglasLongitudB1 = b1.length;
      resumen.configReglasPreviewB1 = b1.substring(0, 200);
    } catch (e) {
      resumen.configReglasError = e.message;
    }
  }

  return resumen;
}

/**
 * ✅ [2026-10-06] Diagnóstico completo de solo lectura. NO crea, borra ni escribe nada en
 * ningún spreadsheet. Lee Script Properties sin imprimir sus valores (solo si están
 * configuradas o no), abre cada archivo configurado, resume estructura de hojas, y arma
 * una tabla comparativa de filas entre el origen y los destinos migrados.
 *
 * @param {boolean} [escribirInforme=false] Si es true (y SOLO si es exactamente true),
 *   además escribe este mismo resultado en una hoja nueva "DIAGNOSTICO_MIGRACION" dentro
 *   de DATA_FILES.PRINCIPAL. Por defecto no escribe nada.
 * @returns {Object} Resultado completo del diagnóstico.
 */
function diagnosticarEstructuraArchivos(escribirInforme) {
  const debeEscribir = (escribirInforme === true);
  console.log('=== DIAGNÓSTICO DE ESTRUCTURA — INICIO (solo lectura) ===');

  // 1. Leer Script Properties sin imprimir valores
  const CLAVES = [
    'ORIGEN_STAGING_ID',
    'DATA_FILES_PRINCIPAL_ID',
    'DATA_FILES_LOGS_ID',
    'DATA_FILES_USUARIOS_ID',
    'MAESTRO_PERMISOS_ID',
    'PAC_DESTINO_SPREADSHEET_ID'
  ];

  const propiedades = {};
  const idsResueltos = {}; // vive solo en memoria de esta ejecución, nunca se imprime completo
  CLAVES.forEach(function (clave) {
    const valor = getConfigProperty(clave, '');
    propiedades[clave] = valor ? 'CONFIGURADA' : 'NO CONFIGURADA';
    idsResueltos[clave] = valor || null;
    console.log('  ' + clave + ': ' + propiedades[clave]);
  });

  const resultado = {
    scriptProperties: propiedades,
    archivos: {},
    tablaComparativa: [],
    hojasOcultasEnPrincipal: [],
    hojasEnPrincipalQueNoEstanEnOrigen: [],
    festivosCacheReporte: {
      FESTIVOS: 'No la usa esta app. MotorEvaluadorReglas._cargarFestivosColombia() ' +
        '(evaluador_alertas.js) consulta CalendarApp (calendario público de festivos de ' +
        'Colombia), no lee ninguna hoja. La hoja FESTIVOS solo la usa ' +
        'MatrizSeguimiento_script/Festivos.js, un proyecto de Apps Script distinto con su ' +
        'propio spreadsheet contenedor — no DATA_FILES.PRINCIPAL de este proyecto.',
      CacheStore: 'cache_backend.js, vía getConfig(\'DATA_FILES.PRINCIPAL\'). Se autocrea ' +
        'con insertSheet() si falta — no tiene el mismo riesgo que las hojas migradas.',
      CacheQueue: 'cache_backend.js, vía getConfig(\'DATA_FILES.PRINCIPAL\'). Misma ' +
        'autocreación que CacheStore.'
    }
  };

  // 2. Abrir cada archivo configurado y resumir su estructura
  const spreadsheetsAbiertos = {}; // clave -> objeto Spreadsheet, para reusar en el cruce
  CLAVES.forEach(function (clave) {
    const id = idsResueltos[clave];
    if (!id) {
      resultado.archivos[clave] = { status: 'NO CONFIGURADA' };
      return;
    }
    try {
      const ss = SpreadsheetApp.openById(id);
      spreadsheetsAbiertos[clave] = ss;
      const hojas = ss.getSheets().map(function (h) {
        return _diagResumenHoja(ss, h.getSheetName());
      });
      resultado.archivos[clave] = {
        status: 'OK',
        nombreArchivo: ss.getName(),
        totalHojas: hojas.length,
        hojas: hojas
      };
      console.log('✅ ' + clave + ' — "' + ss.getName() + '" — ' + hojas.length + ' hoja(s)');
      hojas.forEach(function (h) {
        console.log('    · ' + h.nombre + ' — ' + h.filasDatos + ' fila(s) de datos, ' +
          h.columnas + ' columna(s)' + (h.oculta ? ' [OCULTA]' : ''));
        if (h.nombre === 'CONFIG_REGLAS' && h.configReglasPreviewB1 !== undefined) {
          console.log('      B1 (' + h.configReglasLongitudB1 + ' caracteres): ' + h.configReglasPreviewB1);
        }
      });
    } catch (e) {
      resultado.archivos[clave] = { status: 'ERROR', mensaje: e.message };
      console.error('❌ ' + clave + ': ' + e.message);
    }
  });

  // 3. Tabla comparativa: todas las hojas del ORIGEN vs PRINCIPAL vs destino migrado
  const origenInfo = resultado.archivos['ORIGEN_STAGING_ID'];
  const principalInfo = resultado.archivos['DATA_FILES_PRINCIPAL_ID'];

  if (origenInfo && origenInfo.status === 'OK') {
    origenInfo.hojas.forEach(function (hojaOrigen) {
      const nombre = hojaOrigen.nombre;
      const filasOrigen = hojaOrigen.filasDatos;

      let filasPrincipal = null;
      if (principalInfo && principalInfo.status === 'OK') {
        const enPrincipal = principalInfo.hojas.find(function (h) { return h.nombre === nombre; });
        filasPrincipal = enPrincipal ? enPrincipal.filasDatos : 'NO EXISTE';
      } else {
        filasPrincipal = 'PRINCIPAL NO DISPONIBLE';
      }

      const claveDestino = _DIAG_MAPA_DESTINO_HOJA[nombre] || null;
      let filasMigrado = 'N/A (no mapeada, se asume PRINCIPAL)';
      let archivoMigrado = 'DATA_FILES_PRINCIPAL_ID (por defecto)';
      if (claveDestino && claveDestino !== 'DATA_FILES_PRINCIPAL_ID') {
        archivoMigrado = claveDestino;
        const infoDestino = resultado.archivos[claveDestino];
        if (infoDestino && infoDestino.status === 'OK') {
          const enDestino = infoDestino.hojas.find(function (h) { return h.nombre === nombre; });
          filasMigrado = enDestino ? enDestino.filasDatos : 'NO EXISTE EN EL DESTINO';
        } else if (infoDestino) {
          filasMigrado = infoDestino.status;
        } else {
          filasMigrado = 'DESTINO NO CONFIGURADO';
        }
      } else {
        filasMigrado = filasPrincipal; // su destino migrado ES principal
      }

      const diferencia = (typeof filasOrigen === 'number' && typeof filasPrincipal === 'number')
        ? (filasOrigen - filasPrincipal)
        : 'N/C';

      resultado.tablaComparativa.push({
        hoja: nombre,
        filasOrigen: filasOrigen,
        filasPrincipal: filasPrincipal,
        archivoMigradoCorrespondiente: archivoMigrado,
        filasEnMigrado: filasMigrado,
        diferenciaOrigenVsPrincipal: diferencia
      });
    });

    console.log('\n=== TABLA COMPARATIVA ===');
    resultado.tablaComparativa.forEach(function (fila) {
      console.log(fila.hoja + ' | origen:' + fila.filasOrigen + ' | principal:' + fila.filasPrincipal +
        ' | ' + fila.archivoMigradoCorrespondiente + ':' + fila.filasEnMigrado +
        ' | diff:' + fila.diferenciaOrigenVsPrincipal);
    });
  } else {
    console.warn('⚠️ No se pudo leer ORIGEN_STAGING_ID — tabla comparativa omitida.');
  }

  // 4. En PRINCIPAL: hojas ocultas y hojas que NO existen en el origen
  if (principalInfo && principalInfo.status === 'OK') {
    resultado.hojasOcultasEnPrincipal = principalInfo.hojas
      .filter(function (h) { return h.oculta; })
      .map(function (h) { return h.nombre; });

    if (origenInfo && origenInfo.status === 'OK') {
      const nombresOrigen = origenInfo.hojas.map(function (h) { return h.nombre; });
      resultado.hojasEnPrincipalQueNoEstanEnOrigen = principalInfo.hojas
        .map(function (h) { return h.nombre; })
        .filter(function (nombre) { return nombresOrigen.indexOf(nombre) === -1; });
    }

    console.log('\nHojas ocultas en PRINCIPAL: ' + (resultado.hojasOcultasEnPrincipal.join(', ') || '(ninguna)'));
    console.log('Hojas en PRINCIPAL que no están en el origen: ' +
      (resultado.hojasEnPrincipalQueNoEstanEnOrigen.join(', ') || '(ninguna)'));
  }

  // 5. FESTIVOS / CacheStore / CacheQueue — ya resuelto por análisis de código, ver arriba
  console.log('\n=== FESTIVOS / CacheStore / CacheQueue (análisis de código, no de hojas) ===');
  console.log(JSON.stringify(resultado.festivosCacheReporte, null, 2));

  // 6. Escribir informe en PRINCIPAL SOLO si se pidió explícitamente
  if (debeEscribir) {
    try {
      if (!principalInfo || principalInfo.status !== 'OK') {
        console.error('❌ No se pudo escribir el informe: DATA_FILES_PRINCIPAL_ID no está disponible.');
      } else {
        const ssPrincipal = spreadsheetsAbiertos['DATA_FILES_PRINCIPAL_ID'];
        let hojaInforme = ssPrincipal.getSheetByName('DIAGNOSTICO_MIGRACION');
        if (!hojaInforme) {
          hojaInforme = ssPrincipal.insertSheet('DIAGNOSTICO_MIGRACION');
        } else {
          hojaInforme.clear();
        }
        const headers = ['HOJA', 'FILAS_ORIGEN', 'FILAS_PRINCIPAL', 'ARCHIVO_MIGRADO', 'FILAS_MIGRADO', 'DIFERENCIA'];
        hojaInforme.getRange(1, 1, 1, headers.length).setValues([headers])
          .setFontWeight('bold').setBackground('#34495e').setFontColor('white');
        if (resultado.tablaComparativa.length > 0) {
          const filas = resultado.tablaComparativa.map(function (f) {
            return [f.hoja, f.filasOrigen, f.filasPrincipal, f.archivoMigradoCorrespondiente,
              f.filasEnMigrado, f.diferenciaOrigenVsPrincipal];
          });
          hojaInforme.getRange(2, 1, filas.length, headers.length).setValues(filas);
        }
        console.log('✅ Informe escrito en la hoja DIAGNOSTICO_MIGRACION de PRINCIPAL.');
      }
    } catch (e) {
      console.error('❌ Error escribiendo el informe: ' + e.message);
    }
  }

  console.log('=== DIAGNÓSTICO DE ESTRUCTURA — FIN ===');
  return resultado;
}


/**
 * ✅ [2026-10-06] Compara PAC_Vigente del origen (ORIGEN_STAGING_ID) contra PAC_Vigente
 * del archivo PAC migrado (PAC_DESTINO_SPREADSHEET_ID). Solo lectura, no escribe nada.
 * Clave de fila: columna 'RT' (la misma que usa pac_gestor.js:974 en
 * _pac_compararYGenerarBorrador() para detectar nuevos/eliminados). No imprime datos
 * personales, solo encabezados, conteos y la lista de RT (identificadores de predio,
 * no PII) que sobran en el archivo PAC.
 * @returns {Object} Resumen de la comparación.
 */
function diagnosticarPACVigente() {
  console.log('=== DIAGNÓSTICO PAC_Vigente: origen vs archivo PAC — INICIO (solo lectura) ===');

  const origenId = getConfigProperty('ORIGEN_STAGING_ID', '');
  const pacId = getConfigProperty('PAC_DESTINO_SPREADSHEET_ID', '');

  if (!origenId || !pacId) {
    const msg = 'Faltan Script Properties: ORIGEN_STAGING_ID y/o PAC_DESTINO_SPREADSHEET_ID.';
    console.error('❌ ' + msg);
    return { error: msg };
  }

  function leerHoja(ssId, nombreHoja) {
    const ss = SpreadsheetApp.openById(ssId);
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return null;
    const lastRow = hoja.getLastRow();
    const lastCol = hoja.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return { headers: [], filas: [] };
    const datos = hoja.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = datos[0].map(function (h) { return String(h || '').trim(); });
    return { headers: headers, filas: datos.slice(1) };
  }

  let origen, pac;
  try {
    origen = leerHoja(origenId, 'PAC_Vigente');
    pac = leerHoja(pacId, 'PAC_Vigente');
  } catch (e) {
    console.error('❌ Error abriendo PAC_Vigente: ' + e.message);
    return { error: e.message };
  }

  if (!origen || !pac) {
    const msg = 'PAC_Vigente no existe en ' + (!origen ? 'el origen' : 'el archivo PAC') + '.';
    console.error('❌ ' + msg);
    return { error: msg };
  }

  // 1. Diferencias de encabezados
  const headersOrigen = origen.headers;
  const headersPac = pac.headers;
  const soloEnOrigen = headersOrigen.filter(function (h) { return headersPac.indexOf(h) === -1; });
  const soloEnPac = headersPac.filter(function (h) { return headersOrigen.indexOf(h) === -1; });

  console.log('Encabezados — origen: ' + headersOrigen.length + ' columnas, PAC: ' + headersPac.length + ' columnas.');
  console.log('Columnas solo en origen (faltan en PAC): ' + (soloEnOrigen.join(', ') || '(ninguna)'));
  console.log('Columnas solo en PAC (no están en origen): ' + (soloEnPac.join(', ') || '(ninguna)'));

  // 2. Clave RT: únicos, duplicados, y filas de PAC que no están en el origen
  const iRtOrigen = headersOrigen.indexOf('RT');
  const iRtPac = headersPac.indexOf('RT');

  function analizarClaves(filas, iRt) {
    if (iRt < 0) return { error: 'No se encontró columna RT' };
    const conteo = {};
    filas.forEach(function (fila) {
      const rt = String(fila[iRt] || '').trim();
      if (!rt) return;
      conteo[rt] = (conteo[rt] || 0) + 1;
    });
    const claves = Object.keys(conteo);
    const duplicadas = claves.filter(function (rt) { return conteo[rt] > 1; });
    return { totalFilas: filas.length, clavesUnicas: claves.length, filasDuplicadas: duplicadas.length, mapa: conteo };
  }

  const analisisOrigen = analizarClaves(origen.filas, iRtOrigen);
  const analisisPac = analizarClaves(pac.filas, iRtPac);

  console.log('Origen — ' + analisisOrigen.totalFilas + ' filas, ' + analisisOrigen.clavesUnicas +
    ' RT únicos, ' + analisisOrigen.filasDuplicadas + ' RT duplicados.');
  console.log('PAC — ' + analisisPac.totalFilas + ' filas, ' + analisisPac.clavesUnicas +
    ' RT únicos, ' + analisisPac.filasDuplicadas + ' RT duplicados.');

  let rtSoloEnPac = [];
  if (analisisOrigen.mapa && analisisPac.mapa) {
    rtSoloEnPac = Object.keys(analisisPac.mapa).filter(function (rt) { return !(rt in analisisOrigen.mapa); });
  }
  console.log('RT en PAC que no existen en el origen: ' + rtSoloEnPac.length);
  if (rtSoloEnPac.length > 0 && rtSoloEnPac.length <= 50) {
    console.log('  RT: ' + rtSoloEnPac.join(', '));
  } else if (rtSoloEnPac.length > 50) {
    console.log('  (más de 50, se omite la lista completa; primeros 50): ' + rtSoloEnPac.slice(0, 50).join(', '));
  }

  console.log('=== DIAGNÓSTICO PAC_Vigente — FIN ===');

  return {
    headers: { origen: headersOrigen.length, pac: headersPac.length, soloEnOrigen: soloEnOrigen, soloEnPac: soloEnPac },
    origen: { totalFilas: analisisOrigen.totalFilas, clavesUnicas: analisisOrigen.clavesUnicas, filasDuplicadas: analisisOrigen.filasDuplicadas },
    pac: { totalFilas: analisisPac.totalFilas, clavesUnicas: analisisPac.clavesUnicas, filasDuplicadas: analisisPac.filasDuplicadas },
    rtEnPacQueNoEstanEnOrigen: rtSoloEnPac
  };
}


/**
 * ✅ [2026-10-06, reescrita] Restaura hojas específicas en DATA_FILES.PRINCIPAL desde el
 * origen monolítico (ORIGEN_STAGING_ID), con reglas distintas por hoja (ya no genéricas).
 *
 * REGLA DE SEGURIDAD: con opciones.ejecutar !== true (incluye omitirlo, undefined, 0,
 * cualquier valor que no sea literalmente el booleano true), esta función NO escribe NADA.
 * Solo imprime qué haría.
 *
 * Reglas por hoja (en este orden):
 * 1. CONFIG_REGLAS — copia el TEXTO de B1 del origen al B1 del destino (NO usa copyTo).
 *    Solo si B1 del destino es "{}" o vacío; si no, CONFLICTO. Valida JSON.parse del
 *    origen antes de escribir; si no es válido, aborta esa hoja. Tras escribir, relee y
 *    compara longitud. Mantiene la hoja oculta. Reporta si el origen tiene contenido en
 *    A1:A2 (no lo copia, solo informa).
 * 2. ASIGNACIONES_EQUIPOS — si el destino ya tiene filas de datos, CONFLICTO, no se toca.
 *    Si no, compara encabezados (sin distinguir mayúsculas/espacios); si coinciden,
 *    escribe las filas del ORIGEN en bloques de 1000 con setValues(), y verifica
 *    getLastRow() al final.
 * 3. ReportesGuardados, LOGS_AUDITORIA, ALERTAS_ACTIVAS — si no existen en el destino, se
 *    copian completas desde el ORIGEN (nunca desde el archivo PAC) con copyTo() y se
 *    renombran al nombre exacto. Si ya existen con datos, no se tocan. Si existen pero
 *    vacías, se reporta como caso no cubierto por la regla (no se asume qué hacer).
 * 4. Todo lo demás (Permisos, Logs, Datos, Datos2, Seguimiento, Compromisos,
 *    CASOS ESPECIALES, FiltroMatriz, FESTIVOS, CacheStore, CacheQueue, USUARIOS,
 *    Asignacion_RT, PAC_*) — NO se toca, ni se abre siquiera. 'Configuracion' de
 *    Principal se reporta solo informativamente (quién la usa), sin acción.
 *
 * @param {{ejecutar?: boolean}} [opciones] Por defecto { ejecutar: false }.
 * @returns {{resumen: Array, conflictos: Array}} Resumen de acciones (reales o simuladas).
 */
function restaurarHojasDesdeOrigen(opciones) {
  const opts = opciones || {};
  const ejecutar = (opts.ejecutar === true);

  console.log('=== RESTAURACIÓN DE HOJAS — modo: ' + (ejecutar ? 'EJECUCIÓN REAL' : 'SIMULACIÓN (nada se escribe)') + ' ===');

  const origenId = getConfigProperty('ORIGEN_STAGING_ID', '');
  const principalId = getConfigProperty('DATA_FILES_PRINCIPAL_ID', '');
  // Se leen por completitud / consistencia con diagnosticarEstructuraArchivos(), aunque
  // esta función no escribe en Usuarios ni en Logs (ver regla 4 arriba).
  getConfigProperty('DATA_FILES_USUARIOS_ID', '');
  getConfigProperty('DATA_FILES_LOGS_ID', '');
  getConfigProperty('PAC_DESTINO_SPREADSHEET_ID', '');

  if (!origenId || !principalId) {
    const msg = 'Faltan Script Properties: ORIGEN_STAGING_ID y/o DATA_FILES_PRINCIPAL_ID. Abortando sin tocar nada.';
    console.error('❌ ' + msg);
    return { resumen: [], conflictos: [], error: msg };
  }

  let ssOrigen, ssPrincipal;
  try {
    ssOrigen = SpreadsheetApp.openById(origenId);
    ssPrincipal = SpreadsheetApp.openById(principalId);
  } catch (e) {
    console.error('❌ No se pudo abrir origen o destino: ' + e.message);
    return { resumen: [], conflictos: [], error: e.message };
  }

  const resumen = [];
  const conflictos = [];

  function agregar(hoja, accion, filasAntes, filasDespues) {
    resumen.push({ hoja: hoja, accion: accion, filasAntes: filasAntes, filasDespues: filasDespues });
    console.log(hoja + ' | ' + accion + ' | antes:' + filasAntes + ' | después:' + filasDespues);
  }

  // ── 1. CONFIG_REGLAS ──────────────────────────────────────────────────────────────
  (function restaurarConfigReglas() {
    const nombreHoja = 'CONFIG_REGLAS';
    const hojaOrigen = ssOrigen.getSheetByName(nombreHoja);
    const hojaDestino = ssPrincipal.getSheetByName(nombreHoja);

    if (!hojaOrigen) {
      agregar(nombreHoja, 'OMITIDA — no existe en el origen', '-', '-');
      return;
    }
    if (!hojaDestino) {
      agregar(nombreHoja, 'CONFLICTO — no existe en Principal, requiere crear la hoja primero (fuera de esta regla)', '-', '-');
      conflictos.push({ hoja: nombreHoja, tipo: 'NO_EXISTE_EN_DESTINO', mensaje: 'CONFIG_REGLAS no existe en Principal.' });
      return;
    }

    const b1Destino = String(hojaDestino.getRange('B1').getValue() || '').trim();
    const destinoVacio = (b1Destino === '{}' || b1Destino === '');
    if (!destinoVacio) {
      conflictos.push({ hoja: nombreHoja, tipo: 'B1_DESTINO_NO_VACIO', mensaje: 'B1 de Principal no es "{}" ni está vacío — no se toca.' });
      agregar(nombreHoja, 'CONFLICTO — B1 de Principal ya tiene contenido, no se toca', 1, 1);
      return;
    }

    const b1Origen = String(hojaOrigen.getRange('B1').getValue() || '');
    try {
      JSON.parse(b1Origen);
    } catch (e) {
      conflictos.push({ hoja: nombreHoja, tipo: 'JSON_INVALIDO_EN_ORIGEN', mensaje: 'B1 del origen no es JSON válido: ' + e.message });
      agregar(nombreHoja, 'ABORTADA — JSON inválido en el origen, no se toca nada', 1, 1);
      return;
    }

    const a1Origen = hojaOrigen.getRange('A1').getValue();
    const a2Origen = hojaOrigen.getRange('A2').getValue();
    const notaA1A2 = (a1Origen || a2Origen)
      ? ('El origen tiene contenido en A1/A2 que esta regla NO copia — revisar a mano si hace falta: A1="' + a1Origen + '", A2="' + a2Origen + '".')
      : 'A1:A2 del origen están vacías, no hay nada que copiar ahí.';
    console.log('CONFIG_REGLAS — ' + notaA1A2);

    if (ejecutar) {
      try {
        const estabaOculta = (function () { try { return hojaDestino.isSheetHidden(); } catch (e) { return false; } })();
        hojaDestino.getRange('B1').setValue(b1Origen);
        if (estabaOculta) { try { hojaDestino.hideSheet(); } catch (e) { /* no crítico */ } }

        const b1Releido = String(hojaDestino.getRange('B1').getValue() || '');
        const longitudCoincide = (b1Releido.length === b1Origen.length);
        if (!longitudCoincide) {
          console.error('❌ CONFIG_REGLAS: longitud tras escribir (' + b1Releido.length + ') no coincide con el origen (' + b1Origen.length + ').');
        }
        _diagRegistrarAccion(nombreHoja, 'B1_COPIADO_DESDE_ORIGEN', 1);
        agregar(nombreHoja, 'B1 copiado desde el origen' + (longitudCoincide ? ' (longitud verificada OK)' : ' (ADVERTENCIA: longitud no coincide)') + '. ' + notaA1A2, 0, 1);
      } catch (e) {
        agregar(nombreHoja, 'ERROR al escribir B1: ' + e.message, '-', '-');
      }
    } else {
      agregar(nombreHoja, 'SE COPIARÍA el texto de B1 desde el origen (' + b1Origen.length + ' caracteres, JSON válido). ' + notaA1A2, 0, '-');
    }
  })();

  // ── 2. ASIGNACIONES_EQUIPOS ───────────────────────────────────────────────────────
  (function restaurarAsignacionesEquipos() {
    const nombreHoja = 'ASIGNACIONES_EQUIPOS';
    const hojaOrigen = ssOrigen.getSheetByName(nombreHoja);
    const hojaDestino = ssPrincipal.getSheetByName(nombreHoja);

    if (!hojaOrigen) {
      agregar(nombreHoja, 'OMITIDA — no existe en el origen', '-', '-');
      return;
    }
    if (!hojaDestino) {
      agregar(nombreHoja, 'CONFLICTO — no existe en Principal, requiere crear la hoja primero (fuera de esta regla)', '-', '-');
      conflictos.push({ hoja: nombreHoja, tipo: 'NO_EXISTE_EN_DESTINO', mensaje: 'ASIGNACIONES_EQUIPOS no existe en Principal.' });
      return;
    }

    const filasDestinoAntes = Math.max(0, hojaDestino.getLastRow() - 1);
    if (filasDestinoAntes > 0) {
      conflictos.push({ hoja: nombreHoja, tipo: 'DESTINO_YA_TIENE_DATOS', mensaje: 'El destino ya tiene ' + filasDestinoAntes + ' fila(s) de datos — no se toca.' });
      agregar(nombreHoja, 'CONFLICTO — destino ya tiene ' + filasDestinoAntes + ' fila(s), no se toca', filasDestinoAntes, filasDestinoAntes);
      return;
    }

    const lastColOrigen = hojaOrigen.getLastColumn();
    const lastColDestino = hojaDestino.getLastColumn();
    const headersOrigen = hojaOrigen.getRange(1, 1, 1, lastColOrigen).getValues()[0]
      .map(function (h) { return String(h || '').trim().toUpperCase(); });
    const headersDestino = hojaDestino.getRange(1, 1, 1, lastColDestino).getValues()[0]
      .map(function (h) { return String(h || '').trim().toUpperCase(); });

    const headersCoinciden = (headersOrigen.length === headersDestino.length) &&
      headersOrigen.every(function (h, i) { return h === headersDestino[i]; });

    if (!headersCoinciden) {
      conflictos.push({
        hoja: nombreHoja, tipo: 'ENCABEZADOS_NO_COINCIDEN',
        mensaje: 'Encabezados de origen (' + headersOrigen.join(',') + ') no coinciden con destino (' + headersDestino.join(',') + ').'
      });
      agregar(nombreHoja, 'CONFLICTO — encabezados no coinciden, no se toca', 0, 0);
      return;
    }

    const filasOrigen = Math.max(0, hojaOrigen.getLastRow() - 1);
    if (filasOrigen === 0) {
      agregar(nombreHoja, 'OMITIDA — el origen no tiene filas de datos', 0, 0);
      return;
    }

    if (ejecutar) {
      try {
        const BLOQUE = 1000;
        const datos = hojaOrigen.getRange(2, 1, filasOrigen, lastColOrigen).getValues();
        for (let i = 0; i < datos.length; i += BLOQUE) {
          const bloque = datos.slice(i, i + BLOQUE);
          hojaDestino.getRange(2 + i, 1, bloque.length, lastColOrigen).setValues(bloque);
        }
        const filasDespues = Math.max(0, hojaDestino.getLastRow() - 1);
        const coincide = (filasDespues === filasOrigen);
        if (!coincide) {
          console.error('❌ ASIGNACIONES_EQUIPOS: getLastRow tras escribir (' + filasDespues + ') no coincide con el origen (' + filasOrigen + ').');
        }
        _diagRegistrarAccion(nombreHoja, 'FILAS_COPIADAS_DESDE_ORIGEN', filasOrigen);
        agregar(nombreHoja, 'Copiadas ' + filasOrigen + ' fila(s) desde el origen en bloques de 1000' + (coincide ? ' (verificado OK)' : ' (ADVERTENCIA: no coincide)'), 0, filasDespues);
      } catch (e) {
        agregar(nombreHoja, 'ERROR al copiar filas: ' + e.message, 0, '-');
      }
    } else {
      agregar(nombreHoja, 'SE COPIARÍAN ' + filasOrigen + ' fila(s) desde el origen en bloques de 1000 (encabezados coinciden)', 0, '-');
    }
  })();

  // ── 3. ReportesGuardados, LOGS_AUDITORIA, ALERTAS_ACTIVAS — copia completa si falta ──
  function restaurarHojaCompletaSiFalta(nombreHoja) {
    const hojaOrigen = ssOrigen.getSheetByName(nombreHoja);
    if (!hojaOrigen) {
      agregar(nombreHoja, 'OMITIDA — no existe en el origen', '-', '-');
      return;
    }
    const filasOrigen = Math.max(0, hojaOrigen.getLastRow() - 1);
    const hojaDestino = ssPrincipal.getSheetByName(nombreHoja);

    if (hojaDestino) {
      const filasDestino = Math.max(0, hojaDestino.getLastRow() - 1);
      if (filasDestino > 0) {
        conflictos.push({ hoja: nombreHoja, tipo: 'YA_EXISTE_CON_DATOS', mensaje: 'Ya existe en Principal con ' + filasDestino + ' fila(s) — no se toca.' });
        agregar(nombreHoja, 'NO TOCADA — ya existe en Principal con ' + filasDestino + ' fila(s)', filasDestino, filasDestino);
        return;
      }
      conflictos.push({ hoja: nombreHoja, tipo: 'EXISTE_VACIA_SIN_REGLA', mensaje: 'Existe en Principal pero vacía. La regla pedida solo cubre "no existe"; este caso no está definido, se omite por seguridad.' });
      agregar(nombreHoja, 'OMITIDA — existe vacía en Principal, caso no cubierto por la regla, requiere decisión', 0, 0);
      return;
    }

    if (ejecutar) {
      try {
        const copia = hojaOrigen.copyTo(ssPrincipal); // crea "Copia de <nombre>"
        copia.setName(nombreHoja);
        _diagRegistrarAccion(nombreHoja, 'COPIADA_COMPLETA_DESDE_ORIGEN', filasOrigen);
        agregar(nombreHoja, 'Copiada completa desde el origen (no existía en Principal)', 0, filasOrigen);
      } catch (e) {
        agregar(nombreHoja, 'ERROR al copiar: ' + e.message, 0, '-');
      }
    } else {
      agregar(nombreHoja, 'SE COPIARÍA completa desde el origen (no existe en Principal), ' + filasOrigen + ' fila(s)', 0, '-');
    }
  }

  restaurarHojaCompletaSiFalta('ReportesGuardados');
  restaurarHojaCompletaSiFalta('LOGS_AUDITORIA');
  restaurarHojaCompletaSiFalta('ALERTAS_ACTIVAS'); // ⚠️ siempre desde ssOrigen, nunca desde el archivo PAC

  // ── 4. Todo lo demás: NO se toca, ni se abre. Solo una nota informativa. ───────────
  const EXCLUIDAS_A_PROPOSITO = [
    'Permisos', 'Logs', 'Datos', 'Datos2', 'Seguimiento', 'Compromisos', 'CASOS ESPECIALES',
    'FiltroMatriz', 'FESTIVOS', 'CacheStore', 'CacheQueue', 'USUARIOS', 'Asignacion_RT',
    'PAC_Vigente', 'PAC_Borrador', 'PAC_Historial', 'PAC_Alertas', 'PAC_Articuladores',
    'PAC_ReglasPAC', 'LOG_PAC_SISTEMA'
  ];
  console.log('\nExcluidas a propósito, no evaluadas ni abiertas en esta ejecución: ' + EXCLUIDAS_A_PROPOSITO.join(', '));
  console.log('"Configuracion" (Principal): solo la crea y la lee migracion_automatica_v2.js:100-106 ' +
    '(VERSION_SISTEMA, MODO_MANTENIMIENTO) — ningún otro código del proyecto la usa hoy. ' +
    'El MODO_MANTENIMIENTO real se controla por Script Property, no por esta hoja.');

  console.log('\n=== RESUMEN FINAL ===');
  resumen.forEach(function (r) {
    console.log(r.hoja + ' | ' + r.accion + ' | antes:' + r.filasAntes + ' | después:' + r.filasDespues);
  });
  if (conflictos.length > 0) {
    console.log('\n=== CONFLICTOS QUE REQUIEREN DECISIÓN ===');
    conflictos.forEach(function (c) {
      console.log(c.hoja + ' (' + c.tipo + '): ' + c.mensaje);
    });
  }
  console.log('=== RESTAURACIÓN DE HOJAS — FIN ===');

  return { resumen: resumen, conflictos: conflictos };
}

/**
 * Compara EMAIL/ROL entre la hoja Permisos del origen y la del destino. Solo lectura.
 * No expone nada más que email y rol (ya son columnas administrativas conocidas, no PII
 * sensible como contraseñas o tokens).
 */
function _diagCompararPermisos(hojaOrigen, hojaDestino) {
  function leerEmailRol(hoja) {
    const datos = hoja.getDataRange().getValues();
    if (datos.length < 2) return {};
    const headers = datos[0].map(function (h) { return String(h).trim().toUpperCase(); });
    const idxEmail = headers.indexOf('EMAIL');
    const idxRol = headers.indexOf('ROL');
    const mapa = {};
    for (let i = 1; i < datos.length; i++) {
      const email = String(datos[i][idxEmail] || '').trim().toLowerCase();
      if (!email) continue;
      mapa[email] = String(datos[i][idxRol] || '').trim();
    }
    return mapa;
  }

  const origenMap = leerEmailRol(hojaOrigen);
  const destinoMap = leerEmailRol(hojaDestino);
  const soloEnOrigen = Object.keys(origenMap).filter(function (e) { return !(e in destinoMap); });
  const soloEnDestino = Object.keys(destinoMap).filter(function (e) { return !(e in origenMap); });
  const rolDistinto = Object.keys(origenMap)
    .filter(function (e) { return (e in destinoMap) && destinoMap[e] !== origenMap[e]; })
    .map(function (e) { return { email: e, rolOrigen: origenMap[e], rolDestino: destinoMap[e] }; });

  return { soloEnOrigen: soloEnOrigen, soloEnDestino: soloEnDestino, rolDistinto: rolDistinto };
}

/**
 * Registra una acción de restauración, sin IDs ni datos personales, por console y en el
 * log de acciones del sistema si está disponible.
 * ⚠️ Nota de interpretación: se usa GestorAuditoria.registrarAccion() (escribe en la hoja
 * 'Logs' de DATA_FILES.LOGS), NO registrarCambio() (que escribe en la hoja LOGS_AUDITORIA
 * dentro de PRINCIPAL, pensada para diffs de campo RT/CAMPO/VALOR_ANTERIOR/VALOR_NUEVO, no
 * para eventos de sistema como este). Si se prefiere que quede específicamente en
 * LOGS_AUDITORIA, avisar para ajustarlo — es un cambio de una línea.
 */
function _diagRegistrarAccion(hoja, accion, filas) {
  const mensaje = 'restaurarHojasDesdeOrigen: ' + hoja + ' — ' + accion + ' — ' + filas + ' fila(s)';
  console.log(mensaje);
  try {
    if (typeof GestorAuditoria === 'function') {
      const auditoria = new GestorAuditoria();
      auditoria.registrarAccion('SISTEMA_RESTAURACION', 'RESTAURAR_HOJA_MIGRACION', mensaje);
    }
  } catch (e) {
    console.warn('No se pudo registrar en el log de acciones (no crítico): ' + e.message);
  }
}
