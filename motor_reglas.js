/**
 * MOTOR DE REGLAS - ALMACENAMIENTO Y CONFIGURACIÓN
 * Única definición de obtenerReglasJSON / guardarReglasJSON.
 * La evaluación vive en evaluador_alertas.js.
 */

function _exigirAdminMotorReglas_(accion) {
  try {
    new GestorPermisos().validarPermiso('ADMIN_SISTEMA');
    return null;
  } catch (e) {
    try {
      logAction(Session.getActiveUser().getEmail() || 'desconocido', accion + '_DENEGADO', e.message);
    } catch (_) {}
    return { success: false, error: 'Requiere rol Administrador.' };
  }
}

function _obtenerHojaConfigReglas_(ss, crearSiFalta, yaTieneLock) {
  let hojaReglas = ss.getSheetByName('CONFIG_REGLAS');
  if (hojaReglas || !crearSiFalta) return hojaReglas;

  const lock = yaTieneLock ? null : LockService.getScriptLock();
  try {
    if (!yaTieneLock) lock.waitLock(20000);
    hojaReglas = ss.getSheetByName('CONFIG_REGLAS');
    if (!hojaReglas) {
      hojaReglas = ss.insertSheet('CONFIG_REGLAS');
      hojaReglas.hideSheet();
      hojaReglas.getRange('A1').setValue('MOTOR_DE_REGLAS_JSON');
      hojaReglas.getRange('A1').setFontWeight('bold').setBackground('#34495e').setFontColor('white');
      hojaReglas.getRange('B1').setValue('{}');
    }
    return hojaReglas;
  } catch (lockError) {
    console.error('Error adquiriendo lock para crear CONFIG_REGLAS:', lockError);
    if (yaTieneLock) throw lockError;
    return null;
  } finally {
    if (!yaTieneLock && lock) {
      try { lock.releaseLock(); } catch (er) {}
    }
  }
}

function _versionReglas_(str) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(str), Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    const n = b < 0 ? b + 256 : b;
    return n.toString(16).padStart(2, '0');
  }).join('');
}

function _leerEncabezadosDatosReglas_() {
  const fileId = getConfig('DATA_FILES.PRINCIPAL');
  const ss = SpreadsheetApp.openById(fileId);
  const hoja = ss.getSheetByName(getConfig('SHEETS.DATOS'));
  if (!hoja || hoja.getLastColumn() < 1) return [];
  const fila = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const vistos = {};
  const columnas = [];
  fila.forEach(function(h) {
    const nombre = String(h || '').trim().toUpperCase();
    if (!nombre || vistos[nombre]) return;
    vistos[nombre] = true;
    columnas.push(nombre);
  });
  return columnas;
}

function obtenerReglasJSON() {
  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    const ss = SpreadsheetApp.openById(fileId);
    const hojaReglas = _obtenerHojaConfigReglas_(ss, true, false);
    if (!hojaReglas) {
      return { success: false, message: 'El sistema se encuentra ocupado por otro administrador. Por favor intente de nuevo en unos segundos.' };
    }
    const jsonString = String(hojaReglas.getRange('B1').getValue() || '');
    return { success: true, data: jsonString, version: _versionReglas_(jsonString) };
  } catch (error) {
    console.error('Error leyendo reglas:', error);
    return { success: false, error: error.message };
  }
}

function _aliasColumnaRegla_(criterio) {
  return String((criterio && (criterio.columna_estado || criterio.columna_A || criterio.columna)) || '').trim().toUpperCase();
}

function _aliasOperadorRegla_(criterio) {
  return String((criterio && (criterio.operador_estado || criterio.operador)) || '').trim();
}

function _recorrerBloquesRegla_(regla, visitante) {
  if (regla.condiciones) visitante(regla.condiciones, 'condiciones');
  if (Array.isArray(regla.excepciones)) {
    regla.excepciones.forEach(function(bloque, i) { visitante(bloque, 'excepciones[' + i + ']'); });
  } else if (regla.excepciones) {
    visitante(regla.excepciones, 'excepciones');
  }
}

function validarConfigReglas_(config, columnasConocidas) {
  const errores = [];
  const advertencias = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errores.push('La configuración debe ser un objeto JSON.');
    return { errores: errores, advertencias: advertencias };
  }
  if (!Array.isArray(config.ReglasDeNegocio)) {
    errores.push('ReglasDeNegocio debe ser un array.');
    return { errores: errores, advertencias: advertencias };
  }
  const nombres = {};
  const columnas = Array.isArray(columnasConocidas) ? columnasConocidas : null;

  config.ReglasDeNegocio.forEach(function(regla, idx) {
    const etiqueta = 'Regla ' + (idx + 1);
    if (!regla || typeof regla !== 'object') {
      errores.push(etiqueta + ': no es un objeto.');
      return;
    }
    const nombre = String(regla.nombre || '').trim();
    if (!nombre) errores.push(etiqueta + ': falta el nombre.');
    const claveNombre = nombre.toUpperCase();
    if (nombre && nombres[claveNombre]) errores.push(etiqueta + ': el nombre "' + nombre + '" está repetido.');
    if (nombre) nombres[claveNombre] = true;

    _recorrerBloquesRegla_(regla, function(bloque, donde) {
      const criterios = bloque && Array.isArray(bloque.criterios) ? bloque.criterios : [];
      if (!criterios.length) {
        errores.push(etiqueta + ' / ' + donde + ': hace falta al menos un criterio. Un bloque vacío haría que la regla aplique a todas las filas o anule todas las alertas.');
      }
      criterios.forEach(function(criterio, cidx) {
        const op = _aliasOperadorRegla_(criterio);
        if (!op || !OPERADORES_CONDICION_REGLAS[op]) {
          errores.push(etiqueta + ' / ' + donde + ' criterio ' + (cidx + 1) + ': operador desconocido.');
          return;
        }
        const params = OPERADORES_CONDICION_REGLAS[op].parametros || [];
        if (params.indexOf('valor') >= 0 && (criterio.valor === undefined || criterio.valor === null || String(criterio.valor) === '')) {
          errores.push(etiqueta + ' / ' + donde + ' criterio ' + (cidx + 1) + ': falta el valor.');
        }
        if (params.indexOf('valores') >= 0 && (!Array.isArray(criterio.valores) || !criterio.valores.length) && (!Array.isArray(criterio.valores_estado) || !criterio.valores_estado.length)) {
          errores.push(etiqueta + ' / ' + donde + ' criterio ' + (cidx + 1) + ': la lista de valores está vacía.');
        }
        if (columnas) {
          const col = _aliasColumnaRegla_(criterio);
          if (col && columnas.indexOf(col) < 0) advertencias.push(etiqueta + ': la columna "' + col + '" no está en Datos.');
          const destino = String(criterio.columna_destino || '').trim().toUpperCase();
          if (destino && columnas.indexOf(destino) < 0) advertencias.push(etiqueta + ': la columna destino "' + destino + '" no está en Datos.');
        }
      });
    });

    if (regla.alerta_bloqueo) {
      const nivel = String(regla.alerta_bloqueo.nivel || '').toUpperCase();
      if (NIVELES_ALERTA_REGLAS.indexOf(nivel) < 0) errores.push(etiqueta + ': nivel de bloqueo inválido.');
      if (!String(regla.alerta_bloqueo.mensaje || '').trim()) errores.push(etiqueta + ': el bloqueo necesita un mensaje.');
    }
    if (regla.regla_tiempo) {
      if (!Array.isArray(regla.regla_tiempo.umbrales) || !regla.regla_tiempo.umbrales.length) {
        errores.push(etiqueta + ': la regla de tiempo necesita al menos un umbral.');
      } else {
        regla.regla_tiempo.umbrales.forEach(function(umbral, uidx) {
          const nivel = String((umbral && umbral.nivel) || '').toUpperCase();
          if (NIVELES_ALERTA_REGLAS.indexOf(nivel) < 0) errores.push(etiqueta + ': umbral ' + (uidx + 1) + ' con nivel inválido.');
          if (!umbral || typeof umbral.mensaje !== 'string' || !umbral.mensaje.trim()) {
            errores.push(etiqueta + ': el umbral ' + (uidx + 1) + ' necesita un mensaje.');
          }
        });
      }
      if (columnas) {
        const fecha = String(regla.regla_tiempo.columna_fecha_inicio || '').trim().toUpperCase();
        if (fecha && columnas.indexOf(fecha) < 0) advertencias.push(etiqueta + ': la fecha "' + fecha + '" no está en Datos.');
      }
    }
    if (regla.texto_inicial_correo !== undefined && regla.texto_inicial_correo !== null) {
      if (typeof regla.texto_inicial_correo !== 'string') errores.push(etiqueta + ': el texto inicial del correo debe ser texto.');
      else if (regla.texto_inicial_correo.length > 2000) errores.push(etiqueta + ': el texto inicial del correo supera 2000 caracteres.');
    }
    if (regla.seguimiento_correo !== undefined && regla.seguimiento_correo !== null) {
      const seg = regla.seguimiento_correo;
      if (typeof seg !== 'object' || Array.isArray(seg)) {
        errores.push(etiqueta + ': seguimiento_correo debe ser un objeto.');
      } else {
        Object.keys(seg).forEach(function(nivel) {
          if (NIVELES_ALERTA_REGLAS.indexOf(nivel) < 0) {
            errores.push(etiqueta + ': seguimiento con nivel desconocido "' + nivel + '".');
            return;
          }
          const item = seg[nivel] || {};
          if (item.exigir_observacion !== undefined && typeof item.exigir_observacion !== 'boolean') {
            errores.push(etiqueta + ': exigir_observacion de ' + nivel + ' debe ser verdadero o falso.');
          }
          if (item.permitir_no_uso !== undefined && typeof item.permitir_no_uso !== 'boolean') {
            errores.push(etiqueta + ': permitir_no_uso de ' + nivel + ' debe ser verdadero o falso.');
          }
          const nota = String(item.nota_correo || '');
          const aviso = String(item.texto_no_uso || '');
          if (nota.length > 600) errores.push(etiqueta + ': la nota de ' + nivel + ' supera 600 caracteres.');
          if (aviso.length > 600) errores.push(etiqueta + ': el aviso de no uso de ' + nivel + ' supera 600 caracteres.');
          if (item.exigir_observacion === true && !nota.trim()) errores.push(etiqueta + ': ' + nivel + ' exige observación y la nota del correo está vacía.');
          if (item.permitir_no_uso === true && item.exigir_observacion !== true) errores.push(etiqueta + ': ' + nivel + ' no puede permitir no uso sin exigir observación.');
          if (item.permitir_no_uso === true && !aviso.trim()) errores.push(etiqueta + ': ' + nivel + ' permite no uso y el aviso está vacío.');
        });
      }
    }
  });
  return { errores: errores, advertencias: advertencias };
}

function guardarReglasJSON(jsonString, _usuarioIgnorado, versionEsperada) {
  const denegado = _exigirAdminMotorReglas_('GUARDAR_REGLAS');
  if (denegado) return denegado;

  const texto = String(jsonString || '');
  if (texto.length > 49000) {
    return { success: false, error: 'El JSON supera 49.000 caracteres. Una celda de Sheets no lo puede guardar. Reduce sangría o reglas.' };
  }

  let obj;
  try {
    obj = JSON.parse(texto);
  } catch (parseError) {
    return { success: false, error: 'El formato JSON es inválido. Revisa la sintaxis.' };
  }

  let columnas = [];
  try { columnas = _leerEncabezadosDatosReglas_(); } catch (e) { columnas = []; }
  const validacion = validarConfigReglas_(obj, columnas);
  if (validacion.errores.length) {
    return { success: false, error: validacion.errores.join(' | '), errores: validacion.errores, advertencias: validacion.advertencias };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockError) {
    return { success: false, message: 'El sistema se encuentra ocupado por otro administrador. Por favor intente de nuevo en unos segundos.' };
  }

  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    const ss = SpreadsheetApp.openById(fileId);
    const hojaReglas = _obtenerHojaConfigReglas_(ss, true, true);
    const actual = String(hojaReglas.getRange('B1').getValue() || '');
    if (versionEsperada && _versionReglas_(actual) !== String(versionEsperada)) {
      return { success: false, conflicto: true, error: 'Otro administrador modificó las reglas. Recarga antes de guardar.' };
    }
    hojaReglas.getRange('B1').setValue(texto);
    const email = Session.getActiveUser().getEmail();
    try {
      const auditoria = new GestorAuditoria(fileId);
      auditoria.registrarAccion(email, 'ACTUALIZAR_MOTOR_REGLAS', 'Se actualizó el JSON maestro de reglas de negocio');
    } catch (e) { console.warn('No se pudo auditar:', e); }
    return {
      success: true,
      message: 'Reglas actualizadas correctamente en la base de datos.',
      version: _versionReglas_(texto),
      advertencias: validacion.advertencias
    };
  } catch (error) {
    return { success: false, error: 'Error al guardar las reglas: ' + error.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

function obtenerMetadatosEditorReglas() {
  const denegado = _exigirAdminMotorReglas_('LEER_METADATOS_REGLAS');
  if (denegado) return denegado;
  try {
    return {
      success: true,
      columnas: _leerEncabezadosDatosReglas_(),
      operadores: OPERADORES_CONDICION_REGLAS,
      niveles: NIVELES_ALERTA_REGLAS,
      tiposDias: TIPOS_DIAS_REGLAS
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
