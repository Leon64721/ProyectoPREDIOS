/**
 * Seguimiento del correo de alertas.
 * Hoja SEGUIMIENTO_ALERTAS en el spreadsheet principal.
 * No envía el reporte: eso sigue en procesarReporteAlertas.
 */

var ENCABEZADOS_SEGUIMIENTO_ALERTAS = [
  'ID', 'TOKEN', 'ESTADO', 'CREADO_EN', 'RESPONDIDO_EN', 'PERIODO', 'RT', 'REGLA', 'NIVEL',
  'PROYECTO', 'GESTOR_EMAIL', 'ARTICULADOR_EMAIL', 'JEFE_EMAIL', 'REMITENTE_EMAIL',
  'HILO_GMAIL_ID', 'MENSAJE_GMAIL_ID', 'OBSERVACION_PREVIA', 'OBSERVACION_NUEVA',
  'OBSERVACION_VIGENTE', 'NO_USO', 'AVISO_ACEPTADO', 'ARCHIVO_JURIDICO_URL', 'ARCHIVO_TECNICO_URL',
  'REVISION_ESTADO', 'FECHA_DOCUMENTO', 'REVISOR_NOMBRE', 'REVISOR_EMAIL'
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
  var requiere = false;
  var exigeObservacion = false;
  for (var i = 0; i < lista.length; i++) {
    var p = politicaSeguimientoDeRegla_(lista[i] && lista[i].regla, lista[i] && lista[i].nivel, mapa);
    if (!p) continue;
    exigeObservacion = true;
    if (p.permitir_no_uso) requiere = true;
  }
  return { success: true, requiere: requiere, exigeObservacion: exigeObservacion };
}

function textosInicialesSeguimiento_() {
  var mapa = {};
  var leido = obtenerReglasJSON();
  if (!leido || !leido.success) return mapa;
  var parsed;
  try { parsed = JSON.parse(leido.data || '{}'); } catch (e) { return mapa; }
  var reglas = parsed && Array.isArray(parsed.ReglasDeNegocio) ? parsed.ReglasDeNegocio : [];
  reglas.forEach(function(regla) {
    var nombre = String(regla && regla.nombre || '').trim().toUpperCase();
    var texto = String(regla && regla.texto_inicial_correo || '').trim();
    if (nombre && texto) mapa[nombre] = texto;
  });
  return mapa;
}

function _completarEncabezadosSeguimiento_(hoja) {
  var ancho = Math.max(hoja.getLastColumn(), 1);
  var actuales = hoja.getRange(1, 1, 1, ancho).getValues()[0].map(function(h) { return String(h || '').trim(); });
  while (actuales.length && !actuales[actuales.length - 1]) actuales.pop();
  if (!actuales.length) {
    hoja.getRange(1, 1, 1, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setValues([ENCABEZADOS_SEGUIMIENTO_ALERTAS]);
    hoja.getRange(1, 1, 1, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
    return;
  }
  for (var i = 0; i < actuales.length; i++) {
    if (actuales[i] !== ENCABEZADOS_SEGUIMIENTO_ALERTAS[i]) {
      throw new Error('La hoja SEGUIMIENTO_ALERTAS tiene encabezados distintos. No se agregan columnas para no mezclar los datos.');
    }
  }
  var faltan = ENCABEZADOS_SEGUIMIENTO_ALERTAS.slice(actuales.length);
  if (!faltan.length) return;
  hoja.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan]);
  hoja.getRange(1, actuales.length + 1, 1, faltan.length).setFontWeight('bold');
}

function _hojaSeguimientoAlertas_(crearSiFalta) {
  var ss = SpreadsheetApp.openById(getConfig('DATA_FILES.PRINCIPAL'));
  var hoja = ss.getSheetByName('SEGUIMIENTO_ALERTAS');
  if (!hoja && !crearSiFalta) return null;
  if (!hoja) {
    hoja = ss.insertSheet('SEGUIMIENTO_ALERTAS');
    hoja.getRange(1, 1, 1, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setValues([ENCABEZADOS_SEGUIMIENTO_ALERTAS]);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setFontWeight('bold');
    return hoja;
  }
  _completarEncabezadosSeguimiento_(hoja);
  return hoja;
}

function _fechaDocumentoSeguimiento_(valor) {
  var t = String(valor || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
  var partes = t.split('-');
  var anio = Number(partes[0]);
  var mes = Number(partes[1]);
  var dia = Number(partes[2]);
  var fecha = new Date(anio, mes - 1, dia, 12, 0, 0);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return '';
  if (t > _fechaSeguimiento_('yyyy-MM-dd')) return '';
  return t;
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

function _personasPendiente_(fila) {
  var gestor = String(fila && fila.GESTOR_EMAIL || '').trim().toLowerCase();
  var art = String(fila && fila.ARTICULADOR_EMAIL || '').trim().toLowerCase();
  if (gestor && art && gestor === art) return [{ GESTOR_EMAIL: gestor, ARTICULADOR_EMAIL: art }];
  var personas = [];
  if (gestor) personas.push({ GESTOR_EMAIL: gestor, ARTICULADOR_EMAIL: '' });
  if (art && art !== gestor) personas.push({ GESTOR_EMAIL: '', ARTICULADOR_EMAIL: art });
  if (!personas.length) personas.push({ GESTOR_EMAIL: '', ARTICULADOR_EMAIL: '' });
  return personas;
}

function registrarPendientesSeguimiento_(filasAlerta, meta) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    throw new Error('La hoja de seguimiento está ocupada. Reintenta el envío.');
  }
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
    var nuevas = [];
    (filasAlerta || []).forEach(function(fila) {
      _personasPendiente_(fila).forEach(function(persona) {
        nuevas.push(_filaDesdeObjeto_({
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
        GESTOR_EMAIL: persona.GESTOR_EMAIL,
        ARTICULADOR_EMAIL: persona.ARTICULADOR_EMAIL,
        JEFE_EMAIL: String(meta.jefeEmail || '').trim().toLowerCase(),
        REVISOR_NOMBRE: String(meta.revisorNombre || '').trim(),
        REVISOR_EMAIL: String(meta.revisorEmail || '').trim().toLowerCase(),
        REVISION_ESTADO: '',
        FECHA_DOCUMENTO: '',
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
      }));
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
  var textos = o.textos || textosInicialesSeguimiento_();
  var htmlBody = _buildResumenHtmlAgrupado(rows, o.filtros, o.etiqueta, url, mapa, textos);
  var texto = _textoPlanoAlertas_(rows, o.etiqueta, url, mapa, textos);
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
        jefeEmail: o.jefeEmail || '',
        revisorNombre: o.revisorNombre || '',
        revisorEmail: o.revisorEmail || ''
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
        textoNoUso: pol.texto_no_uso || '',
        dirigidoA: (String(fila.GESTOR_EMAIL || '').trim() && !String(fila.ARTICULADOR_EMAIL || '').trim()) ? 'Gestor' : ((String(fila.ARTICULADOR_EMAIL || '').trim() && !String(fila.GESTOR_EMAIL || '').trim()) ? 'Articulador' : '')
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
  var lecturaInicial = _leerSeguimientoAlertas_();
  var visibles = _filasVisiblesDelToken_(lecturaInicial.filas, cuerpo.token, email, esAdmin);
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
      var revision = entrada.revisionEstado === true;
      if (revision && noUso) return { success: false, error: 'Revisar observación y no uso no pueden marcarse en el mismo RT.' };
      var informe = null;
      var fechaDocumento = '';
      if (noUso) {
        if (entrada.avisoAceptado !== true) return { success: false, error: 'Debes confirmar que leíste el aviso de no uso.' };
        if (!_esCorreoValidoAlertas(pendiente.JEFE_EMAIL)) return { success: false, error: 'Este envío no tiene correo de jefatura. No se puede declarar el no uso.' };
        if (!entrada.informe) return { success: false, error: 'Si no se va a usar, adjunta el informe técnico / jurídico.' };
        informe = _blobAnexoSeguimiento_(entrada.informe, _nombreAnexo_(pendiente.RT, pendiente.REGLA, 'informe'));
      }
      if (revision) {
        fechaDocumento = _fechaDocumentoSeguimiento_(entrada.fechaDocumento);
        if (!fechaDocumento) return { success: false, error: 'Si marcas Revisar observación, indica la fecha del documento. No puede ser posterior a hoy. Falta ' + (pendiente.RT || 'un RT') + '.' };
        if (!_esCorreoValidoAlertas(pendiente.REVISOR_EMAIL)) return { success: false, error: 'Este envío no tiene correo de quien revisa soportes.' };
      }
      var previa = _observacionVigente_(lecturaInicial.filas, pendiente.RT, pendiente.REGLA);
      var marca = _fechaSeguimiento_('yyyy-MM-dd HH:mm');
      var vigente = previa ? (previa + '\n' + marca + ' ' + texto) : texto;
      preparados.push({
        pendiente: pendiente,
        texto: texto,
        previa: previa,
        vigente: vigente,
        noUso: noUso,
        revision: revision,
        fechaDocumento: fechaDocumento,
        informe: informe
      });
    }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    return { success: false, error: 'El sistema está ocupado. Intenta de nuevo en unos segundos.' };
  }
  try {
    var lectura = _leerSeguimientoAlertas_();
    var siguen = _filasVisiblesDelToken_(lectura.filas, cuerpo.token, email, esAdmin);
    var porId = {};
    siguen.forEach(function(fila) { porId[String(fila.ID || '')] = fila; });
    for (var j = 0; j < preparados.length; j++) {
      var actual = porId[String(preparados[j].pendiente.ID || '')];
      if (!actual) return { success: false, error: 'Otro envío ya cerró alguna de estas alertas. Vuelve a abrir el enlace.' };
      preparados[j].pendiente = actual;
      preparados[j].previa = _observacionVigente_(lectura.filas, actual.RT, actual.REGLA);
      var marcaLock = _fechaSeguimiento_('yyyy-MM-dd HH:mm');
      preparados[j].vigente = preparados[j].previa ? (preparados[j].previa + '\n' + marcaLock + ' ' + preparados[j].texto) : preparados[j].texto;
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
        ARCHIVO_JURIDICO_URL: item.informe ? item.informe.url : '',
        ARCHIVO_TECNICO_URL: '',
        REVISION_ESTADO: item.revision ? 'SI' : 'NO',
        FECHA_DOCUMENTO: item.fechaDocumento || '',
        REVISOR_NOMBRE: p.REVISOR_NOMBRE || '',
        REVISOR_EMAIL: p.REVISOR_EMAIL || ''
      });
    });
    preparados.forEach(function(item) {
      hoja.getRange(item.pendiente._fila, colEstado).setValue('CERRADA');
    });
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, ENCABEZADOS_SEGUIMIENTO_ALERTAS.length).setValues(nuevas);
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

    var primero = preparados[0].pendiente;
    var anexos = [];
    var anexosNoUso = [];
    var lineas = preparados.map(function(item) {
      var linea = item.pendiente.RT + ' · ' + item.pendiente.REGLA + ' · ' + item.pendiente.NIVEL + '\n' + item.texto;
      if (item.noUso && item.informe && item.informe.blob) {
        linea += '\nDeclaró que no se va a usar. Adjunto: informe técnico / jurídico.';
        anexos.push(item.informe.blob);
        anexosNoUso.push(item.informe.blob);
      }
      if (item.revision) {
        linea += '\nPidió revisión de estado. Fecha del documento: ' + item.fechaDocumento + '. La evidencia debe estar cargada en los repositorios.';
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
    var conRevision = preparados.filter(function(item) { return item.revision; });
    if (conRevision.length) {
      try {
        var revisor = String(primero.REVISOR_EMAIL || '');
        var nombreRevisor = String(primero.REVISOR_NOMBRE || '').trim() || revisor;
        var lineasRevision = conRevision.map(function(item) {
          return item.pendiente.RT + ' · ' + item.pendiente.REGLA + '\nObservación: ' + item.texto + '\nFecha del documento: ' + item.fechaDocumento;
        });
        var textoRevision = 'Para ' + nombreRevisor + '.\n\nEstos RT se marcaron para revisión de estado. El sistema no cambia el estado predial. Actualiza el estado en la base y corrobora que el documento, con la fecha indicada, esté cargado en los repositorios institucionales.\n\n' + lineasRevision.join('\n\n');
        var htmlRevision = '<div style="font-family:Segoe UI,Arial,sans-serif"><p>Para <b>' + _escapeHtmlAlertaEmail(nombreRevisor) + '</b>.</p><p>Estos RT se marcaron para revisión de estado. El sistema no cambia el estado predial. Actualiza el estado en la base y corrobora que el documento, con la fecha indicada, esté cargado en los repositorios institucionales.</p><pre style="white-space:pre-wrap">' + _escapeHtmlAlertaEmail(lineasRevision.join('\n\n')) + '</pre></div>';
        GmailApp.sendEmail(revisor, 'Revisión de estado - Alertas tempranas', textoRevision, { htmlBody: htmlRevision });
      } catch (revError) {
        var extraRevision = 'La observación quedó guardada, pero el correo a quien revisa soportes no salió: ' + revError.message;
        avisoCorreo = avisoCorreo ? (avisoCorreo + ' ' + extraRevision) : (' ' + extraRevision);
      }
    }
    try {
      new GestorAuditoria().registrarAccion(email || 'desconocido', 'GUARDAR_SEGUIMIENTO_ALERTAS', 'Token ' + cuerpo.token + ' filas ' + preparados.length);
    } catch (auditError) {}
    return { success: !avisoCorreo, error: avisoCorreo ? avisoCorreo.trim() : '', message: avisoCorreo ? avisoCorreo.trim() : 'Observaciones guardadas y correo respondido.' };
}
