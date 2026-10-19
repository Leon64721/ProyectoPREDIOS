/**
 * Seguimiento del correo de alertas.
 * Hoja SEGUIMIENTO_ALERTAS en el spreadsheet principal.
 * No envía el reporte: eso sigue en procesarReporteAlertas.
 */

var ENCABEZADOS_SEGUIMIENTO_ALERTAS = [
  'ID', 'TOKEN', 'ESTADO', 'CREADO_EN', 'RESPONDIDO_EN', 'PERIODO', 'RT', 'REGLA', 'NIVEL',
  'PROYECTO', 'GESTOR_EMAIL', 'ARTICULADOR_EMAIL', 'JEFE_EMAIL', 'REMITENTE_EMAIL',
  'HILO_GMAIL_ID', 'MENSAJE_GMAIL_ID', 'OBSERVACION_PREVIA', 'OBSERVACION_NUEVA',
  'OBSERVACION_VIGENTE', 'NO_USO', 'AVISO_ACEPTADO', 'ARCHIVO_JURIDICO_URL', 'ARCHIVO_TECNICO_URL'
];

var MAX_BYTES_ANEXO_SEGUIMIENTO = 5 * 1024 * 1024;

function _tzSeguimiento_() {
  try { return Session.getScriptTimeZone() || 'America/Bogota'; } catch (e) { return 'America/Bogota'; }
}

function _fechaSeguimiento_(formato) {
  return Utilities.formatDate(new Date(), _tzSeguimiento_(), formato);
}

function _claveRtRegla_(rt, regla) {
  return String(rt || '').trim().toUpperCase() + '||' + String(regla || '').trim().toUpperCase();
}

function _sesionEsAdminSeguimiento_() {
  try {
    new GestorPermisos().validarPermiso('ADMIN_SISTEMA');
    return true;
  } catch (e) {
    return false;
  }
}

function mapaPoliticasSeguimiento_() {
  var mapa = {};
  var leido = obtenerReglasJSON();
  if (!leido || !leido.success) return mapa;
  var parsed;
  try { parsed = JSON.parse(leido.data || '{}'); } catch (e) { return mapa; }
  var reglas = parsed && Array.isArray(parsed.ReglasDeNegocio) ? parsed.ReglasDeNegocio : [];
  reglas.forEach(function(regla) {
    var nombre = String(regla && regla.nombre || '').trim().toUpperCase();
    if (nombre && regla.seguimiento_correo && typeof regla.seguimiento_correo === 'object' && !Array.isArray(regla.seguimiento_correo)) {
      mapa[nombre] = regla.seguimiento_correo;
    }
  });
  return mapa;
}

function politicaSeguimientoDeRegla_(nombreRegla, nivel, mapa) {
  var fuente = mapa || mapaPoliticasSeguimiento_();
  var pol = fuente[String(nombreRegla || '').trim().toUpperCase()];
  if (!pol) return null;
  var n = String(nivel || '').toUpperCase();
  if (typeof NIVELES_ALERTA_REGLAS !== 'undefined' && NIVELES_ALERTA_REGLAS.indexOf(n) < 0) return null;
  var item = pol[n];
  if (!item || item.exigir_observacion !== true) return null;
  return {
    exigir_observacion: true,
    permitir_no_uso: item.permitir_no_uso === true,
    nota_correo: String(item.nota_correo || ''),
    texto_no_uso: item.permitir_no_uso === true ? String(item.texto_no_uso || '') : ''
  };
}

function requiereCorreoJefeSeguimiento(pares) {
  var denegado = _exigirAdminMotorReglas_('ENVIAR_REPORTE_ALERTAS');
  if (denegado) return denegado;
  var mapa = mapaPoliticasSeguimiento_();
  var lista = Array.isArray(pares) ? pares : [];
  for (var i = 0; i < lista.length; i++) {
    var p = politicaSeguimientoDeRegla_(lista[i] && lista[i].regla, lista[i] && lista[i].nivel, mapa);
    if (p && p.permitir_no_uso) return { success: true, requiere: true };
  }
  return { success: true, requiere: false };
}

function _hojaSeguimientoAlertas_(crearSiFalta) {
  var ss = SpreadsheetApp.openById(getConfig('DATA_FILES.PRINCIPAL'));
  var hoja = ss.getSheetByName('SEGUIMIENTO_ALERTAS');
  if (hoja || !crearSiFalta) return hoja;
  hoja = ss.insertSheet('SEGUIMIENTO_ALERTAS');
  hoja.getRange(1, 1, 1, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setValues([ENCABEZADOS_SEGUIMIENTO_ALERTAS]);
  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setFontWeight('bold');
  return hoja;
}

function _carpetaSeguimientoAlertas_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SEGUIMIENTO_ALERTAS_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { id = ''; }
  }
  var carpeta = DriveApp.createFolder('Seguimiento alertas');
  props.setProperty('SEGUIMIENTO_ALERTAS_FOLDER_ID', carpeta.getId());
  return carpeta;
}

function _leerSeguimientoAlertas_() {
  var hoja = _hojaSeguimientoAlertas_(false);
  if (!hoja) return { hoja: null, filas: [] };
  var values = hoja.getDataRange().getValues();
  if (!values || values.length < 2) return { hoja: hoja, filas: [] };
  var headers = values[0].map(function(h) { return String(h || '').trim(); });
  var filas = [];
  for (var r = 1; r < values.length; r++) {
    var obj = { _fila: r + 1 };
    headers.forEach(function(h, i) { if (h) obj[h] = values[r][i]; });
    filas.push(obj);
  }
  return { hoja: hoja, filas: filas };
}

function _observacionVigente_(filas, rt, regla) {
  var clave = _claveRtRegla_(rt, regla);
  var vigente = '';
  (filas || []).forEach(function(fila) {
    if (String(fila.ESTADO || '') !== 'RESPONDIDA') return;
    if (_claveRtRegla_(fila.RT, fila.REGLA) !== clave) return;
    vigente = String(fila.OBSERVACION_VIGENTE || '');
  });
  return vigente;
}

function _filaDesdeObjeto_(obj) {
  return ENCABEZADOS_SEGUIMIENTO_ALERTAS.map(function(h) { return obj[h] !== undefined && obj[h] !== null ? obj[h] : ''; });
}

function registrarPendientesSeguimiento_(filasAlerta, meta) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hoja = _hojaSeguimientoAlertas_(true);
    var lectura = _leerSeguimientoAlertas_();
    var ahora = _fechaSeguimiento_('yyyy-MM-dd HH:mm:ss');
    var periodo = _fechaSeguimiento_('yyyy-MM');
    var clavesNuevas = {};
    (filasAlerta || []).forEach(function(fila) {
      clavesNuevas[_claveRtRegla_(fila.RT, fila.REGLA)] = true;
    });
    var colEstado = ENCABEZADOS_SEGUIMIENTO_ALERTAS.indexOf('ESTADO') + 1;
    var cambios = [];
    lectura.filas.forEach(function(fila) {
      if (String(fila.ESTADO || '') !== 'PENDIENTE') return;
      if (String(fila.TOKEN || '') === String(meta.token || '')) return;
      if (!clavesNuevas[_claveRtRegla_(fila.RT, fila.REGLA)]) return;
      cambios.push(fila._fila);
    });
    cambios.forEach(function(nFila) {
      hoja.getRange(nFila, colEstado).setValue('VENCIDA');
    });
    var nuevas = (filasAlerta || []).map(function(fila) {
      return _filaDesdeObjeto_({
        ID: Utilities.getUuid(),
        TOKEN: meta.token,
        ESTADO: 'PENDIENTE',
        CREADO_EN: ahora,
        RESPONDIDO_EN: '',
        PERIODO: periodo,
        RT: fila.RT || '',
        REGLA: fila.REGLA || '',
        NIVEL: fila.NIVEL || '',
        PROYECTO: fila.PROYECTO || '',
        GESTOR_EMAIL: String(fila.GESTOR_EMAIL || '').trim().toLowerCase(),
        ARTICULADOR_EMAIL: String(fila.ARTICULADOR_EMAIL || '').trim().toLowerCase(),
        JEFE_EMAIL: String(meta.jefeEmail || '').trim().toLowerCase(),
        REMITENTE_EMAIL: String(meta.remitente || '').trim().toLowerCase(),
        HILO_GMAIL_ID: meta.hiloId || '',
        MENSAJE_GMAIL_ID: meta.mensajeId || '',
        OBSERVACION_PREVIA: '',
        OBSERVACION_NUEVA: '',
        OBSERVACION_VIGENTE: '',
        NO_USO: '',
        AVISO_ACEPTADO: '',
        ARCHIVO_JURIDICO_URL: '',
        ARCHIVO_TECNICO_URL: ''
      });
    });
    if (nuevas.length) {
      hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setValues(nuevas);
    }
    return true;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function _urlSeguimientoAlertas_(token) {
  var base = '';
  try { base = ScriptApp.getService().getUrl() || ''; } catch (e) { base = ''; }
  if (!base || !token) return '';
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'sa=' + encodeURIComponent(token);
}

function despacharCorreoAlertas_(opts) {
  var o = opts || {};
  var mapa = o.mapa || mapaPoliticasSeguimiento_();
  var rows = o.rows || [];
  var exigidas = rows.filter(function(r) { return !!politicaSeguimientoDeRegla_(r.REGLA, r.NIVEL, mapa); });
  var hayNoUso = exigidas.some(function(r) {
    var p = politicaSeguimientoDeRegla_(r.REGLA, r.NIVEL, mapa);
    return p && p.permitir_no_uso;
  });
  if (hayNoUso && !_esCorreoValidoAlertas(o.jefeEmail)) {
    return { success: false, error: 'Indica el correo de la jefatura inmediata. Hay alertas que permiten declarar que un proceso no se va a usar.' };
  }
  var token = exigidas.length ? Utilities.getUuid() : '';
  var url = _urlSeguimientoAlertas_(token);
  var htmlBody = _buildResumenHtmlAgrupado(rows, o.filtros, o.etiqueta, url, mapa);
  var texto = _textoPlanoAlertas_(rows, o.etiqueta, url, mapa);
  var draftOpts = { htmlBody: htmlBody, attachments: [o.attachment] };
  if (o.ccStr) draftOpts.cc = o.ccStr;
  var draft = GmailApp.createDraft(o.to, o.subject, texto, draftOpts);
  var msg;
  try {
    msg = draft.send();
  } catch (e) {
    try { draft.deleteDraft(); } catch (ignore) {}
    throw e;
  }
  var seguimiento = { ok: true, token: token };
  if (token) {
    try {
      registrarPendientesSeguimiento_(exigidas, {
        token: token,
        hiloId: msg.getThread().getId(),
        mensajeId: msg.getId(),
        remitente: o.remitente,
        jefeEmail: o.jefeEmail || ''
      });
    } catch (e2) {
      seguimiento = { ok: false, error: e2.message, token: token };
    }
  }
  return { success: true, seguimiento: seguimiento };
}

function autorizarGmailSeguimiento() {
  var denegado = _exigirAdminMotorReglas_('AUTORIZAR_GMAIL');
  if (denegado) {
    console.log(denegado.error || 'Requiere rol Administrador.');
    return denegado;
  }
  var yo = String(Session.getActiveUser().getEmail() || '').trim();
  if (!yo) throw new Error('No se pudo leer el correo de la sesión.');
  var draft = GmailApp.createDraft(yo, 'Autorización Gmail - no enviar', 'Este borrador solo pide el permiso. No se envía.');
  draft.deleteDraft();
  console.log('Permiso de Gmail aceptado. No se envió ningún correo.');
  return { success: true };
}

function _tokenSeguimientoValido_(token) {
  return /^[A-Za-z0-9-]{20,64}$/.test(String(token || ''));
}

function _filasVisiblesDelToken_(filas, token, email, esAdmin) {
  return (filas || []).filter(function(fila) {
    if (String(fila.TOKEN || '') !== String(token)) return false;
    if (String(fila.ESTADO || '') !== 'PENDIENTE') return false;
    if (esAdmin) return true;
    var gestor = String(fila.GESTOR_EMAIL || '').trim().toLowerCase();
    var art = String(fila.ARTICULADOR_EMAIL || '').trim().toLowerCase();
    return email && (email === gestor || email === art);
  });
}

function obtenerSeguimientoPorToken(token) {
  if (!_tokenSeguimientoValido_(token)) return { success: false, error: 'El enlace no es válido.' };
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  var esAdmin = _sesionEsAdminSeguimiento_();
  var lectura = _leerSeguimientoAlertas_();
  var delToken = (lectura.filas || []).filter(function(fila) { return String(fila.TOKEN || '') === String(token); });
  if (!delToken.length) return { success: false, error: 'Este enlace no existe.' };
  var visibles = _filasVisiblesDelToken_(lectura.filas, token, email, esAdmin);
  if (!visibles.length) {
    var hayPendientes = delToken.some(function(fila) { return String(fila.ESTADO || '') === 'PENDIENTE'; });
    if (!hayPendientes) return { success: false, error: 'Este enlace ya no tiene observaciones pendientes.' };
    return { success: false, error: 'Este enlace no corresponde a tu usuario.' };
  }
  var mapa = mapaPoliticasSeguimiento_();
  return {
    success: true,
    filas: visibles.map(function(fila) {
      var pol = politicaSeguimientoDeRegla_(fila.REGLA, fila.NIVEL, mapa) || {};
      return {
        id: String(fila.ID || ''),
        rt: String(fila.RT || ''),
        regla: String(fila.REGLA || ''),
        nivel: String(fila.NIVEL || ''),
        proyecto: String(fila.PROYECTO || ''),
        observacionVigente: _observacionVigente_(lectura.filas, fila.RT, fila.REGLA),
        permitirNoUso: pol.permitir_no_uso === true,
        textoNoUso: pol.texto_no_uso || ''
      };
    })
  };
}

function _mimeAnexoPermitido_(nombre, mime) {
  var m = String(mime || '').toLowerCase();
  var permitidos = {
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'image/png': true,
    'image/jpeg': true,
    'image/jpg': true,
    'image/gif': true,
    'image/webp': true
  };
  if (permitidos[m]) return m === 'image/jpg' ? 'image/jpeg' : m;
  var ext = String(nombre || '').toLowerCase().split('.').pop();
  var porExt = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
  return porExt[ext] || '';
}

function _blobAnexoSeguimiento_(archivo, nombreBase) {
  if (!archivo || !archivo.base64) throw new Error('Falta un archivo.');
  var limpio = String(archivo.base64 || '');
  var coma = limpio.indexOf(',');
  if (limpio.indexOf('base64') >= 0 && coma >= 0) limpio = limpio.substring(coma + 1);
  var bytes = Utilities.base64Decode(limpio);
  if (!bytes || bytes.length > MAX_BYTES_ANEXO_SEGUIMIENTO) throw new Error('Cada anexo debe pesar 5 MB o menos.');
  var mime = _mimeAnexoPermitido_(archivo.nombre, archivo.mime);
  if (!mime) throw new Error('Solo se admiten PDF, DOC, DOCX o imagen.');
  var blob = Utilities.newBlob(bytes, mime, nombreBase);
  var file = _carpetaSeguimientoAlertas_().createFile(blob);
  return { url: file.getUrl(), blob: blob };
}

function _nombreAnexo_(rt, regla, tipo) {
  var base = (String(rt || '') + '_' + String(regla || '') + '_' + tipo + '_' + _fechaSeguimiento_('yyyyMMdd'))
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_');
  return base.substring(0, 80);
}

function guardarSeguimientoAlertas(payload) {
  var cuerpo = payload || {};
  if (!_tokenSeguimientoValido_(cuerpo.token)) return { success: false, error: 'El enlace no es válido.' };
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  var esAdmin = _sesionEsAdminSeguimiento_();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    return { success: false, error: 'El sistema está ocupado. Intenta de nuevo en unos segundos.' };
  }
  try {
    var lectura = _leerSeguimientoAlertas_();
    var visibles = _filasVisiblesDelToken_(lectura.filas, cuerpo.token, email, esAdmin);
    if (!visibles.length) return { success: false, error: 'Este enlace ya no tiene observaciones pendientes.' };
    var enviadas = {};
    (cuerpo.filas || []).forEach(function(fila) { if (fila && fila.id) enviadas[String(fila.id)] = fila; });
    if (Object.keys(enviadas).length !== visibles.length) {
      return { success: false, error: 'Debes responder todas las alertas del cuadro.' };
    }
    var mapa = mapaPoliticasSeguimiento_();
    var preparados = [];
    for (var i = 0; i < visibles.length; i++) {
      var pendiente = visibles[i];
      var entrada = enviadas[String(pendiente.ID || '')];
      if (!entrada) return { success: false, error: 'Falta una alerta del cuadro.' };
      var texto = String(entrada.observacionNueva || '').trim();
      if (!texto) return { success: false, error: 'Cada RT necesita una observación. Falta ' + (pendiente.RT || 'un RT') + '.' };
      var pol = politicaSeguimientoDeRegla_(pendiente.REGLA, pendiente.NIVEL, mapa) || {};
      var noUso = entrada.noUso === true && pol.permitir_no_uso === true;
      var juridico = null;
      var tecnico = null;
      if (noUso) {
        if (entrada.avisoAceptado !== true) return { success: false, error: 'Debes confirmar que leíste el aviso de no uso.' };
        if (!_esCorreoValidoAlertas(pendiente.JEFE_EMAIL)) return { success: false, error: 'Este envío no tiene correo de jefatura. No se puede declarar el no uso.' };
        juridico = _blobAnexoSeguimiento_(entrada.juridico, _nombreAnexo_(pendiente.RT, pendiente.REGLA, 'juridico'));
        tecnico = _blobAnexoSeguimiento_(entrada.tecnico, _nombreAnexo_(pendiente.RT, pendiente.REGLA, 'tecnico'));
      }
      var previa = _observacionVigente_(lectura.filas, pendiente.RT, pendiente.REGLA);
      var marca = _fechaSeguimiento_('yyyy-MM-dd HH:mm');
      var vigente = previa ? (previa + '\n' + marca + ' ' + texto) : texto;
      preparados.push({
        pendiente: pendiente,
        texto: texto,
        previa: previa,
        vigente: vigente,
        noUso: noUso,
        juridico: juridico,
        tecnico: tecnico
      });
    }

    var ahora = _fechaSeguimiento_('yyyy-MM-dd HH:mm:ss');
    var hoja = lectura.hoja || _hojaSeguimientoAlertas_(true);
    var colEstado = ENCABEZADOS_SEGUIMIENTO_ALERTAS.indexOf('ESTADO') + 1;
    var nuevas = preparados.map(function(item) {
      var p = item.pendiente;
      return _filaDesdeObjeto_({
        ID: Utilities.getUuid(),
        TOKEN: p.TOKEN,
        ESTADO: 'RESPONDIDA',
        CREADO_EN: ahora,
        RESPONDIDO_EN: ahora,
        PERIODO: _fechaSeguimiento_('yyyy-MM'),
        RT: p.RT,
        REGLA: p.REGLA,
        NIVEL: p.NIVEL,
        PROYECTO: p.PROYECTO,
        GESTOR_EMAIL: p.GESTOR_EMAIL,
        ARTICULADOR_EMAIL: p.ARTICULADOR_EMAIL,
        JEFE_EMAIL: p.JEFE_EMAIL,
        REMITENTE_EMAIL: p.REMITENTE_EMAIL,
        HILO_GMAIL_ID: p.HILO_GMAIL_ID,
        MENSAJE_GMAIL_ID: p.MENSAJE_GMAIL_ID,
        OBSERVACION_PREVIA: item.previa,
        OBSERVACION_NUEVA: item.texto,
        OBSERVACION_VIGENTE: item.vigente,
        NO_USO: item.noUso ? 'SI' : 'NO',
        AVISO_ACEPTADO: item.noUso ? 'SI' : '',
        ARCHIVO_JURIDICO_URL: item.juridico ? item.juridico.url : '',
        ARCHIVO_TECNICO_URL: item.tecnico ? item.tecnico.url : ''
      });
    });
    preparados.forEach(function(item) {
      hoja.getRange(item.pendiente._fila, colEstado).setValue('CERRADA');
    });
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setValues(nuevas);

    var primero = preparados[0].pendiente;
    var anexos = [];
    var anexosNoUso = [];
    var lineas = preparados.map(function(item) {
      var linea = item.pendiente.RT + ' · ' + item.pendiente.REGLA + ' · ' + item.pendiente.NIVEL + '\n' + item.texto;
      if (item.noUso) {
        linea += '\nDeclaró que no se va a usar. Adjuntos: concepto jurídico y concepto técnico.';
        anexos.push(item.juridico.blob, item.tecnico.blob);
        anexosNoUso.push(item.juridico.blob, item.tecnico.blob);
      }
      return linea;
    });
    var quien = email || 'usuario sin correo de sesión';
    var texto = 'Observaciones cargadas por ' + quien + '.\n\n' + lineas.join('\n\n');
    var html = '<div style="font-family:Segoe UI,Arial,sans-serif"><p><b>Observaciones cargadas por ' + _escapeHtmlAlertaEmail(quien) + '.</b></p><pre style="white-space:pre-wrap">' + _escapeHtmlAlertaEmail(lineas.join('\n\n')) + '</pre></div>';
    var replyOpts = { htmlBody: html };
    if (_esCorreoValidoAlertas(primero.REMITENTE_EMAIL)) replyOpts.cc = String(primero.REMITENTE_EMAIL);
    if (anexos.length) replyOpts.attachments = anexos;
    var avisoCorreo = '';
    try {
      GmailApp.getMessageById(String(primero.MENSAJE_GMAIL_ID)).replyAll(texto, replyOpts);
      var conNoUso = preparados.filter(function(item) { return item.noUso; });
      if (conNoUso.length) {
        var jefe = String(primero.JEFE_EMAIL || '');
        var directoOpts = { htmlBody: html, attachments: anexosNoUso };
        if (_esCorreoValidoAlertas(primero.REMITENTE_EMAIL)) directoOpts.cc = String(primero.REMITENTE_EMAIL);
        GmailApp.sendEmail(jefe, 'No uso declarado en alerta crítica', texto, directoOpts);
      }
    } catch (mailError) {
      avisoCorreo = ' La observación quedó guardada, pero el correo de respuesta no salió: ' + mailError.message;
    }
    try {
      new GestorAuditoria().registrarAccion(email || 'desconocido', 'GUARDAR_SEGUIMIENTO_ALERTAS', 'Token ' + cuerpo.token + ' filas ' + preparados.length);
    } catch (auditError) {}
    return { success: !avisoCorreo, error: avisoCorreo ? avisoCorreo.trim() : '', message: avisoCorreo ? avisoCorreo.trim() : 'Observaciones guardadas y correo respondido.' };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
