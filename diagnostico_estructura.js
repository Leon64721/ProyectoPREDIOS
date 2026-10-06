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
 * ✅ [2026-10-06] Restaura hojas faltantes en DATA_FILES.PRINCIPAL desde el origen
 * monolítico (ORIGEN_STAGING_ID), con simulación obligatoria por defecto.
 *
 * REGLA DE SEGURIDAD: con opciones.ejecutar !== true (incluye omitirlo, undefined, 0,
 * cualquier valor que no sea literalmente el booleano true), esta función NO escribe NADA.
 * Solo imprime qué haría. Hay que llamarla explícitamente con { ejecutar: true } para que
 * escriba, y solo después de revisar la simulación.
 *
 * NUNCA sobrescribe una hoja de destino que ya tenga datos. Política por hoja, evaluada
 * en este orden:
 *   1. No existe en destino          → copiar desde el origen (copyTo + rename).
 *   2. Existe y está vacía/CONFIG_REGLAS con "{}" → renombrar la existente a
 *      BAK_<nombre>_20261006 (nunca se borra) y copiar la del origen en su lugar.
 *   3. Existe y tiene datos           → NO TOCAR. Se reporta como CONFLICTO.
 *   4. 'Permisos' específicamente     → si el destino tiene cualquier dato, nunca se toca,
 *      solo se reportan diferencias de EMAIL/ROL entre origen y destino.
 *
 * @param {{ejecutar?: boolean}} [opciones] Por defecto { ejecutar: false }.
 * @returns {{resumen: Array, conflictos: Array}} Resumen de acciones (reales o simuladas).
 */
function restaurarHojasDesdeOrigen(opciones) {
  const opts = opciones || {};
  const ejecutar = (opts.ejecutar === true);

  console.log('=== RESTAURACIÓN DE HOJAS — modo: ' + (ejecutar ? 'EJECUCIÓN REAL' : 'SIMULACIÓN (nada se escribe)') + ' ===');

  // ⚠️ Lista fija, pedida explícitamente por el usuario. NO se agregan hojas aquí sin
  // avisar — si el resultado de diagnosticarEstructuraArchivos() sugiere que falta o sobra
  // alguna, se ajusta esta lista a mano, en un commit aparte, nunca en automático.
  const HOJAS_A_RESTAURAR = [
    'CONFIG_REGLAS',
    'ReportesGuardados',
    'FESTIVOS',
    'ASIGNACIONES_EQUIPOS',
    'ALERTAS_ACTIVAS',
    'LOGS_AUDITORIA',
    'Permisos'
  ];

  const origenId = getConfigProperty('ORIGEN_STAGING_ID', '');
  const principalId = getConfigProperty('DATA_FILES_PRINCIPAL_ID', '');

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
  const SUFIJO_BAK = 'BAK_%s_20261006';

  HOJAS_A_RESTAURAR.forEach(function (nombreHoja) {
    const hojaOrigen = ssOrigen.getSheetByName(nombreHoja);
    if (!hojaOrigen) {
      resumen.push({ hoja: nombreHoja, accion: 'OMITIDA — no existe en el origen', filas: 0 });
      console.warn('⚠️ ' + nombreHoja + ': no existe en el origen, se omite.');
      return;
    }
    const filasOrigen = Math.max(0, hojaOrigen.getLastRow() - 1);
    const hojaDestino = ssPrincipal.getSheetByName(nombreHoja);

    // Caso especial: Permisos nunca se toca si el destino tiene cualquier dato.
    if (nombreHoja === 'Permisos') {
      if (hojaDestino && hojaDestino.getLastRow() > 1) {
        const diffPermisos = _diagCompararPermisos(hojaOrigen, hojaDestino);
        conflictos.push({
          hoja: 'Permisos',
          tipo: 'PERMISOS_PROTEGIDO',
          mensaje: 'Destino tiene datos — NUNCA se sobrescribe. Solo se reportan diferencias.',
          filasOrigen: filasOrigen,
          filasDestino: hojaDestino.getLastRow() - 1,
          diferencias: diffPermisos
        });
        console.warn('⚠️ Permisos: destino tiene datos, NO se toca. Diferencias: ' + JSON.stringify(diffPermisos));
        resumen.push({ hoja: 'Permisos', accion: 'PROTEGIDA — no se toca (tiene datos)', filas: hojaDestino.getLastRow() - 1 });
        return;
      }
      // Si Permisos en destino está vacía, sigue el flujo normal de abajo (caso 1 o 2).
    }

    if (!hojaDestino) {
      // Caso 1: no existe en destino → copiar.
      resumen.push({ hoja: nombreHoja, accion: ejecutar ? 'COPIADA desde origen (no existía)' : 'SE COPIARÍA desde origen (no existe en destino)', filas: filasOrigen });
      console.log((ejecutar ? '✅' : '🔎 [SIMULADO]') + ' ' + nombreHoja + ': copiar desde origen, ' + filasOrigen + ' fila(s).');
      if (ejecutar) {
        try {
          const copia = hojaOrigen.copyTo(ssPrincipal);
          copia.setName(nombreHoja);
          _diagRegistrarAccion(nombreHoja, 'COPIADA_NUEVA', filasOrigen);
        } catch (e) {
          console.error('❌ Error copiando ' + nombreHoja + ': ' + e.message);
          resumen[resumen.length - 1].accion = 'ERROR al copiar: ' + e.message;
        }
      }
      return;
    }

    const filasDestino = Math.max(0, hojaDestino.getLastRow() - 1);
    const destinoEsConfigReglasVacio = (nombreHoja === 'CONFIG_REGLAS' &&
      String(hojaDestino.getRange('B1').getValue() || '').trim() === '{}');
    const destinoEstaVacio = (filasDestino === 0) || destinoEsConfigReglasVacio;

    if (destinoEstaVacio) {
      // Caso 2: existe pero vacía (o CONFIG_REGLAS con "{}") → respaldar con BAK_ y reemplazar.
      const nombreBak = SUFIJO_BAK.replace('%s', nombreHoja);
      resumen.push({
        hoja: nombreHoja,
        accion: ejecutar
          ? ('REEMPLAZADA — existente renombrada a ' + nombreBak + ', copiada la del origen')
          : ('SE REEMPLAZARÍA — existente se renombraría a ' + nombreBak + ' (vacía/"{}"), se copiaría la del origen'),
        filas: filasOrigen
      });
      console.log((ejecutar ? '✅' : '🔎 [SIMULADO]') + ' ' + nombreHoja +
        ': destino vacío, renombrar a ' + nombreBak + ' y copiar origen (' + filasOrigen + ' fila(s)).');
      if (ejecutar) {
        try {
          const estabaOculta = (nombreHoja === 'CONFIG_REGLAS') ? (function () { try { return hojaDestino.isSheetHidden(); } catch (e) { return false; } })() : null;
          hojaDestino.setName(nombreBak);
          const copia = hojaOrigen.copyTo(ssPrincipal);
          copia.setName(nombreHoja);
          if (nombreHoja === 'CONFIG_REGLAS' && estabaOculta) {
            try { copia.hideSheet(); } catch (e) { /* no crítico */ }
          }
          _diagRegistrarAccion(nombreHoja, 'REEMPLAZADA_VACIA', filasOrigen);
        } catch (e) {
          console.error('❌ Error reemplazando ' + nombreHoja + ': ' + e.message);
          resumen[resumen.length - 1].accion = 'ERROR al reemplazar: ' + e.message;
        }
      }
      return;
    }

    // Caso 3: existe y tiene datos → NO TOCAR, reportar conflicto.
    conflictos.push({
      hoja: nombreHoja,
      tipo: 'CONFLICTO_DATOS_EN_AMBOS',
      mensaje: 'Origen y destino tienen datos — requiere decisión manual, no se toca.',
      filasOrigen: filasOrigen,
      filasDestino: filasDestino
    });
    resumen.push({ hoja: nombreHoja, accion: 'CONFLICTO — ambos tienen datos, requiere decisión', filas: filasDestino });
    console.warn('⚠️ CONFLICTO ' + nombreHoja + ': origen=' + filasOrigen + ' filas, destino=' + filasDestino + ' filas. No se toca.');
  });

  console.log('\n=== RESUMEN FINAL ===');
  resumen.forEach(function (r) {
    console.log(r.hoja + ' | ' + r.accion + ' | ' + r.filas + ' fila(s)');
  });
  if (conflictos.length > 0) {
    console.log('\n=== CONFLICTOS QUE REQUIEREN DECISIÓN ===');
    conflictos.forEach(function (c) {
      console.log(c.hoja + ': ' + c.mensaje);
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
