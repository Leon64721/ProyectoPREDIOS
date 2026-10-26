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
  'REVISION_ESTADO', 'FECHA_DOCUMENTO', 'REVISOR_NOMBRE', 'REVISOR_EMAIL', 'RESPONDIDO_POR',
  'ASUNTO', 'INFORME_PENDIENTES_EN'
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
  return [{ GESTOR_EMAIL: gestor, ARTICULADOR_EMAIL: art }];
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
    var vistas = {};
    (filasAlerta || []).forEach(function(fila) {
      var claveFila = _claveRtRegla_(fila.RT, fila.REGLA);
      if (vistas[claveFila]) return;
      vistas[claveFila] = true;
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
        RESPONDIDO_POR: '',
        ASUNTO: String(meta.asunto || ''),
        INFORME_PENDIENTES_EN: '',
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
  if (base.length >= 4 && base.substring(base.length - 4) === '/dev') {
    base = base.substring(0, base.length - 4) + '/exec';
  }
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
    return { success: false, error: 'Indica el correo del jefe inmediato. Hay alertas que permiten declarar que un proceso no se va a usar.' };
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
        revisorEmail: o.revisorEmail || '',
        asunto: o.subject || ''
      });
    } catch (e2) {
      seguimiento = { ok: false, error: e2.message, token: token };
    }
    try { _asegurarTriggerInformeSinRespuesta_(); } catch (triggerError) {
      console.log('No se pudo dejar el aviso de faltantes: ' + triggerError.message);
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
  if (!email) return [];
  return (filas || []).filter(function(fila) {
    if (String(fila.TOKEN || '') !== String(token)) return false;
    if (String(fila.ESTADO || '') !== 'PENDIENTE') return false;
    return true;
  });
}

function obtenerSeguimientoPorToken(token) {
  if (!_tokenSeguimientoValido_(token)) return { success: false, error: 'El enlace no es válido.' };
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) return { success: false, error: 'Entra con tu cuenta del IDU para registrar la observación.' };
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
  if (!email) return { success: false, error: 'Entra con tu cuenta del IDU para registrar la observación.' };
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
        if (!_esCorreoValidoAlertas(pendiente.JEFE_EMAIL)) return { success: false, error: 'Este envío no tiene correo de jefe inmediato. No se puede declarar el no uso.' };
        if (!entrada.informe) return { success: false, error: 'Si no se va a usar, adjunta el informe técnico / jurídico.' };
        informe = _blobAnexoSeguimiento_(entrada.informe, _nombreAnexo_(pendiente.RT, pendiente.REGLA, 'informe'));
      }
      if (revision) {
        fechaDocumento = _fechaDocumentoSeguimiento_(entrada.fechaDocumento);
        if (!fechaDocumento) return { success: false, error: 'Si marcas Revisar observación, indica la fecha del documento. No puede ser posterior a hoy. Falta ' + (pendiente.RT || 'un RT') + '.' };
        if (!_esCorreoValidoAlertas(pendiente.REVISOR_EMAIL)) return { success: false, error: 'Este envío no tiene correo de quien revisa soportes.' };
      }
      var previa = _observacionVigente_(lecturaInicial.filas, pendiente.RT, pendiente.REGLA);
      var vigente = texto;
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
      preparados[j].vigente = preparados[j].texto;
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
        REVISOR_EMAIL: p.REVISOR_EMAIL || '',
        RESPONDIDO_POR: email,
        ASUNTO: p.ASUNTO || '',
        INFORME_PENDIENTES_EN: ''
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
    var quien = _quienRespondioSeguimiento_(email, primero);
    var intro = _introRespuestaSeguimiento_(primero);
    var bloques = preparados.map(function(item) {
      var frase = _fraseCondicionRegla_(item.pendiente.REGLA);
      var linea = 'RT ' + item.pendiente.RT +
        '\nProyecto: ' + (item.pendiente.PROYECTO || '') +
        '\nRegla: ' + item.pendiente.REGLA +
        '\nNivel: ' + item.pendiente.NIVEL +
        '\nCondición de la regla: ' + frase +
        '\nObservación: ' + item.texto;
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
    var cierre = 'La observación queda registrada en el seguimiento y responde al correo citado.';
    var texto = intro + '\n\nRespondió ' + quien + '.\n\n' + bloques.join('\n\n') + '\n\n' + cierre;
    var html = '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">' +
      '<p>' + _escapeHtmlAlertaEmail(intro) + '</p>' +
      '<p>Respondió <b>' + _escapeHtmlAlertaEmail(quien) + '</b>.</p>' +
      bloques.map(function(bloque) {
        return '<p style="white-space:pre-wrap;">' + _escapeHtmlAlertaEmail(bloque) + '</p>';
      }).join('') +
      '<p>' + _escapeHtmlAlertaEmail(cierre) + '</p></div>';
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
        var textoRevision = _textoRevisionBase_(quien, primero, conRevision);
        var htmlRevision = '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;"><p style="white-space:pre-wrap;">' + _escapeHtmlAlertaEmail(textoRevision) + '</p></div>';
        GmailApp.sendEmail(revisor, 'Validar estado en la base - alertas tempranas', textoRevision, { htmlBody: htmlRevision });
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

function _sumarDiasHabiles_(fechaTexto, cantidad, festivos) {
  var m = String(fechaTexto || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  var mapa = festivos || {};
  var cursor = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  var cuenta = 0;
  var guard = 0;
  var n = Number(cantidad) || 0;
  while (cuenta < n && guard < 366) {
    guard++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    var iso = cursor.toISOString().substring(0, 10);
    var dia = cursor.getUTCDay();
    if (dia === 0 || dia === 6) continue;
    if (mapa[iso]) continue;
    cuenta++;
  }
  if (cuenta < n) return '';
  return cursor.toISOString().substring(0, 10);
}

function _festivosSeguimiento_(anio) {
  var mapa = {};
  try {
    var cal = CalendarApp.getCalendarById('es.co#holiday@group.v.calendar.google.com');
    if (!cal) return { mapa: mapa, calendario: false };
    var inicio = new Date(anio - 1, 0, 1);
    var fin = new Date(anio + 1, 11, 31, 23, 59);
    cal.getEvents(inicio, fin).forEach(function(evento) {
      mapa[Utilities.formatDate(evento.getStartTime(), 'America/Bogota', 'yyyy-MM-dd')] = true;
    });
    return { mapa: mapa, calendario: Object.keys(mapa).length > 0 };
  } catch (e) {
    return { mapa: {}, calendario: false };
  }
}

function _asegurarTriggerInformeSinRespuesta_() {
  var ya = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === 'triggerInformeSinRespuestaAlertas';
  });
  if (ya) return;
  ScriptApp.newTrigger('triggerInformeSinRespuestaAlertas').timeBased().everyDays(1).atHour(7).create();
}

function eliminarTriggerInformeSinRespuestaAlertas() {
  var denegado = _exigirAdminMotorReglas_('ELIMINAR_TRIGGER_INFORME_SIN_RESPUESTA');
  if (denegado) return denegado;
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() !== 'triggerInformeSinRespuestaAlertas') return;
    ScriptApp.deleteTrigger(t);
    n++;
  });
  return { success: true, eliminados: n };
}

function _quienRespondioSeguimiento_(email, pendiente) {
  var e = String(email || '').trim().toLowerCase();
  var g = String(pendiente && pendiente.GESTOR_EMAIL || '').trim().toLowerCase();
  var a = String(pendiente && pendiente.ARTICULADOR_EMAIL || '').trim().toLowerCase();
  if (e && e === g && e !== a) return 'el gestor';
  if (e && e === a && e !== g) return 'el articulador';
  return e || 'quien respondió';
}

function _introRespuestaSeguimiento_(pendiente) {
  var fecha = String(pendiente && pendiente.CREADO_EN || '').substring(0, 10);
  var asunto = String(pendiente && pendiente.ASUNTO || '').trim();
  if (asunto) {
    return 'En virtud del correo enviado el ' + fecha + ' con asunto «' + asunto + '», se envían las observaciones pertinentes al seguimiento de esas alertas tempranas.';
  }
  return 'En virtud del correo enviado el ' + fecha + ', se envían las observaciones pertinentes al seguimiento de esas alertas tempranas.';
}

function _valorCondicionRegla_(criterio) {
  if (!criterio) return '';
  var valor = criterio.valores_estado;
  if (valor == null || valor === '') valor = criterio.valores;
  if (valor == null || valor === '') valor = criterio.valor;
  if (Array.isArray(valor)) {
    return valor.map(function(item) { return String(item); }).filter(function(item) { return item; }).join(', ');
  }
  return String(valor == null ? '' : valor);
}

function _fraseUnCriterio_(criterio) {
  if (!criterio || typeof criterio !== 'object' || criterio.criterios) return '';
  var op = typeof _aliasOperadorRegla_ === 'function'
    ? _aliasOperadorRegla_(criterio)
    : String(criterio.operador_estado || criterio.operador || '');
  var col = typeof _aliasColumnaRegla_ === 'function' ? _aliasColumnaRegla_(criterio) : '';
  var valor = _valorCondicionRegla_(criterio);
  var destino = String(criterio.columna_destino || '').trim();
  if (op === 'EQUALS') return valor;
  if (op === 'NOT_EQUAL') return 'un estado distinto de ' + valor;
  if (op === 'IN') return 'alguno de estos estados: ' + valor;
  if (op === 'NOT_IN') return 'un estado distinto de: ' + valor;
  if (op === 'IS_NULL') return col + ' sin dato';
  if (op === 'IS_NOT_NULL') return col + ' con dato';
  if (op === 'LESS_THAN') return col + ' menor que ' + valor;
  if (op === 'DATE_BEFORE_COLUMN') return col + ' anterior a ' + destino;
  if (op === 'PERCENTAGE_BETWEEN_COLUMNS') return 'el porcentaje entre ' + col + ' y ' + destino + ' dentro del rango configurado';
  if (op === 'DAYS_PASSED_LESS_THAN') return col + ' con antigüedad dentro del límite configurado';
  return '';
}

function _fraseCondicionRegla_(nombreRegla) {
  var nombre = String(nombreRegla || '').trim();
  var fallback = 'la condición configurada en la regla ' + nombre;
  var leido;
  try { leido = obtenerReglasJSON(); } catch (e) { return fallback; }
  if (!leido || !leido.success) return fallback;
  var parsed;
  try { parsed = JSON.parse(leido.data || '{}'); } catch (e2) { return fallback; }
  var reglas = parsed && Array.isArray(parsed.ReglasDeNegocio) ? parsed.ReglasDeNegocio : [];
  var regla = null;
  for (var i = 0; i < reglas.length; i++) {
    if (String(reglas[i] && reglas[i].nombre || '').trim().toUpperCase() === nombre.toUpperCase()) {
      regla = reglas[i];
      break;
    }
  }
  if (!regla || !regla.condiciones) return fallback;
  var condiciones = regla.condiciones;
  var criterios = condiciones.criterios ? condiciones.criterios : [condiciones];
  var partes = [];
  var union = String(condiciones.operador_logico || 'AND').toUpperCase() === 'OR' ? ' o ' : ' y ';
  for (var j = 0; j < criterios.length; j++) {
    if (criterios[j] && criterios[j].criterios) return fallback;
    var frase = _fraseUnCriterio_(criterios[j]);
    if (!frase) return fallback;
    partes.push(frase);
  }
  return partes.length ? partes.join(union) : fallback;
}

function _textoRevisionBase_(quien, pendiente, filas) {
  var frases = {};
  filas.forEach(function(item) { frases[_fraseCondicionRegla_(item.pendiente.REGLA)] = true; });
  var lista = Object.keys(frases);
  var condicion = lista.length === 1
    ? lista[0]
    : 'la condición de cada regla, indicada abajo';
  var encabezado = 'En virtud del seguimiento y la validación de las alertas tempranas, se requiere validar el estado actual de estos RT en la base. El sistema no cambia el estado predial.\n\n' +
    quien.charAt(0).toUpperCase() + quien.substring(1) + ' informa que ya cuentan con ' + condicion + '.\n\n' +
    _introRespuestaSeguimiento_(pendiente);
  var detalle = filas.map(function(item) {
    return 'RT ' + item.pendiente.RT +
      '\nProyecto: ' + (item.pendiente.PROYECTO || '') +
      '\nRegla: ' + item.pendiente.REGLA +
      '\nNivel: ' + item.pendiente.NIVEL +
      '\nObservación: ' + item.texto +
      '\nFecha del documento: ' + (item.fechaDocumento || '') +
      '\nCondición de la regla: ' + _fraseCondicionRegla_(item.pendiente.REGLA);
  });
  return encabezado + '\n\n' + detalle.join('\n\n');
}

function _enviarInformeSinRespuesta_(filas, calendarioOk) {
  var primero = filas[0] || {};
  var remitente = String(primero.REMITENTE_EMAIL || '').trim().toLowerCase();
  var jefe = String(primero.JEFE_EMAIL || '').trim().toLowerCase();
  var para = '';
  var copia = '';
  if (_esCorreoValidoAlertas(remitente)) {
    para = remitente;
    if (_esCorreoValidoAlertas(jefe) && jefe !== remitente) copia = jefe;
  } else if (_esCorreoValidoAlertas(jefe)) {
    para = jefe;
  }
  if (!para) return { enviado: false, motivo: 'Sin remitente ni jefe' };
  var fecha = String(primero.CREADO_EN || '').substring(0, 10);
  var asuntoOriginal = String(primero.ASUNTO || '').trim();
  var cita = asuntoOriginal
    ? 'Correo original del ' + fecha + ', asunto «' + asuntoOriginal + '».'
    : 'Correo original del ' + fecha + '.';
  var lineas = filas.map(function(fila) {
    return 'RT ' + (fila.RT || '') +
      ' · ' + (fila.PROYECTO || '') +
      ' · ' + (fila.REGLA || '') +
      ' · ' + (fila.NIVEL || '') +
      ' · Gestor: ' + (fila.GESTOR_EMAIL || '') +
      ' · Articulador: ' + (fila.ARTICULADOR_EMAIL || '');
  });
  var texto = 'Pasaron cinco días hábiles sin respuesta a las observaciones que estas alertas exigen.\n\n' +
    cita + '\n\n' + lineas.join('\n');
  if (!calendarioOk) texto += '\n\nEl calendario de festivos no estuvo disponible. Se contaron lunes a viernes.';
  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;"><p>Pasaron cinco días hábiles sin respuesta a las observaciones que estas alertas exigen.</p><p>' +
    _escapeHtmlAlertaEmail(cita) + '</p><p style="white-space:pre-wrap;">' + _escapeHtmlAlertaEmail(lineas.join('\n')) + '</p>' +
    (calendarioOk ? '' : '<p>El calendario de festivos no estuvo disponible. Se contaron lunes a viernes.</p>') +
    '</div>';
  var opts = { htmlBody: html };
  if (copia) opts.cc = copia;
  GmailApp.sendEmail(para, 'Sin respuesta - alertas tempranas [' + fecha + ']', texto, opts);
  return { enviado: true };
}

function triggerInformeSinRespuestaAlertas() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    console.log('Informe sin respuesta: la hoja está ocupada.');
    return;
  }
  try {
    var lectura = _leerSeguimientoAlertas_();
    var grupos = {};
    (lectura.filas || []).forEach(function(fila) {
      if (String(fila.ESTADO || '') !== 'PENDIENTE') return;
      if (String(fila.INFORME_PENDIENTES_EN || '').trim()) return;
      var token = String(fila.TOKEN || '');
      if (!token) return;
      if (!grupos[token]) grupos[token] = [];
      grupos[token].push(fila);
    });
    var festivos = _festivosSeguimiento_(Number(_fechaSeguimiento_('yyyy')));
    var hoy = _fechaSeguimiento_('yyyy-MM-dd');
    var enviados = 0;
    var omitidos = 0;
    var colInforme = ENCABEZADOS_SEGUIMIENTO_ALERTAS.indexOf('INFORME_PENDIENTES_EN') + 1;
    Object.keys(grupos).forEach(function(token) {
      var filas = grupos[token];
      var quinto = _sumarDiasHabiles_(filas[0].CREADO_EN, 5, festivos.mapa);
      if (!quinto || hoy < quinto) return;
      var resultado;
      try {
        resultado = _enviarInformeSinRespuesta_(filas, festivos.calendario);
      } catch (envioError) {
        omitidos++;
        console.log('Informe sin respuesta omitido ' + token + ': ' + envioError.message);
        return;
      }
      if (!resultado.enviado) {
        omitidos++;
        console.log('Informe sin respuesta omitido ' + token + ': ' + resultado.motivo);
        return;
      }
      filas.forEach(function(fila) {
        lectura.hoja.getRange(fila._fila, colInforme).setValue(hoy);
      });
      enviados++;
    });
    console.log('Informe sin respuesta. Enviados: ' + enviados + '. Omitidos: ' + omitidos + '.');
  } catch (err) {
    console.error(err);
    try {
      var destino = Session.getEffectiveUser().getEmail();
      if (destino) {
        MailApp.sendEmail({
          to: destino,
          subject: '[Seguimiento alertas] Fallo en informe sin respuesta',
          htmlBody: '<p>El informe de observaciones sin respuesta falló: ' + String(err.message || err).replace(/</g, '') + '</p>'
        });
      }
    } catch (mailErr) {}
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
