/**
 * Backend: Cache queue, RBAC checks and endpoints for frontend (Apps Script)
 * - getUserRoles(): devuelve rol y permisos del usuario activo
 * - forceCacheInvalidation(reportId, params): encola invalidación y dispara procesamiento
 * - getSearchHints(term, size): busca sugerencias en la hoja `Datos`
 * - processCacheQueue(): worker que procesa la cola y materializa cache en `CacheStore`
 * - installCacheTriggers(): helper para instalar trigger nocturno
 */

/**
 * ✅ FASE 5b/PAC — token de versión del caché de getPACData(). Es un símbolo puramente
 * SERVER-SIDE: solo lo leen/escriben funciones .gs (_pac_buildCacheKey() en pac_api.js).
 * No tiene contraparte en el cliente — google.script.run no comparte variables globales
 * entre el sandbox del navegador y el runtime de Apps Script, solo resultados de función,
 * así que no hay nada que "exponer" del lado del cliente para este símbolo.
 * (Bug reparado 2026-08-06: la declaración original de esta constante se perdió de este
 * archivo, dejando a _pac_buildCacheKey() referenciar un identificador sin declarar —
 * causa raíz exacta de "Error cargando módulo PAC: CACHE_KEY_PAC_VERSION is not defined".)
 */
var CACHE_KEY_PAC_VERSION = 'pac_cache_version';

/** Helper: obtener email del usuario activo con fallback */
function getCurrentUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) email = Session.getEffectiveUser().getEmail();
    return String(email || '').toLowerCase();
  } catch (e) {
    console.error('getCurrentUserEmail error: ' + e.message);
    return '';
  }
}

/** Devuelve rol y permisos para el usuario actual (llamable vía google.script.run) */
function getUserRoles() {
  try {
    var email = getCurrentUserEmail();
    var gestor = new GestorPermisos();
    var rol = gestor.obtenerRol(email) || getConfig('ROLES.LECTOR');

    // Normalizar roles para frontend
    var roles = [];
    // Mapear exactamente a los valores que usa el frontend
    if (rol === getConfig('ROLES.ADMIN')) roles.push('Admin');
    if (rol === getConfig('ROLES.EDITOR')) roles.push('Editor');
    if (rol === getConfig('ROLES.LECTOR')) roles.push('Viewer');

    // Permisos granulares desde CONFIG
    var permisos = getConfig('PERMISOS_POR_ROL')[rol] || [];

    // PowerEditor lista opcional en Properties (comma-separated emails)
    try {
      var props = PropertiesService.getScriptProperties().getProperty('POWER_EDITORS') || '';
      var powerList = props.split(',').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean);
      if (powerList.indexOf(email) >= 0) {
        // Solo promover a PowerEditor si ya es Editor o Admin en la hoja
        if (roles.indexOf('Editor') >= 0 || roles.indexOf('Admin') >= 0) roles.push('PowerEditor');
      }
    } catch (e) {}

    return { email: email, role: rol, roles: roles, permissions: permisos };
  } catch (e) {
    console.error('getUserRoles error: ' + e.message);
    return { email: '', role: '', roles: [], permissions: [] };
  }
}

/** Wrapper seguro para que google.script.run pueda consultar el estado de una operación */
function checkCacheOperation(operationId) {
  try {
    return getCacheOperationStatus(operationId);
  } catch (e) {
    console.error('checkCacheOperation error: ' + e.message);
    return { status: 'ERROR', error: e.message };
  }
}

/** Test helper para ejecutar un flujo de encolado y procesado (ejecutar manualmente en Editor) */
function stagingCacheTest() {
  try {
    var enq = forceCacheInvalidation('searchHints', {});
    if (!enq || !enq.operationId) return { success: false, error: 'Enqueue failed', detail: enq };

    // Llamar worker directamente para test (sin trigger)
    processCacheQueue();

    // Leer estado
    var status = getCacheOperationStatus(enq.operationId);
    var fileId = getConfig('DATA_FILES.PRINCIPAL');
    var ss = SpreadsheetApp.openById(fileId);
    var store = ss.getSheetByName('CacheStore');
    var storeData = store ? store.getDataRange().getValues() : [];

    return { success: true, operation: status, cacheStoreRows: storeData.length };
  } catch (e) {
    console.error('stagingCacheTest error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/** Encola una solicitud de invalidación de caché y devuelve operationId */
function forceCacheInvalidation(reportId, params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var email = getCurrentUserEmail();
    var gestorPerm = new GestorPermisos();
    var rol = gestorPerm.obtenerRol(email) || '';

    // Permisos: solo Admins y PowerEditors pueden forzar
    var isAdmin = (rol === getConfig('ROLES.ADMIN'));
    var isPower = false;
    var powerProp = PropertiesService.getScriptProperties().getProperty('POWER_EDITORS') || '';
    if (powerProp.toLowerCase().split(',').map(function(s){ return s.trim(); }).indexOf(email) >= 0) isPower = true;

    if (!isAdmin && !isPower) {
      return { success: false, error: 'Unauthorized' };
    }

    // Preparar hoja de cola
    var fileId = getConfig('DATA_FILES.PRINCIPAL');
    var ss = SpreadsheetApp.openById(fileId);
    var queueSheet = ss.getSheetByName('CacheQueue');
    if (!queueSheet) {
      queueSheet = ss.insertSheet('CacheQueue');
      queueSheet.appendRow(['operationId','reportId','params','status','requestedBy','requestedAt','finishedAt','result']);
    }

    var operationId = 'op_' + Utilities.getUuid();
    var now = new Date();
    queueSheet.appendRow([operationId, reportId, JSON.stringify(params || {}), 'PENDING', email, now, '', '']);

    // Crear trigger a corto plazo para procesar cola (1 minuto después)
    try {
      ScriptApp.newTrigger('processCacheQueue').timeBased().after(60 * 1000).create();
    } catch (e) {
      console.warn('No se pudo crear trigger programado: ' + e.message);
    }

    return { success: true, operationId: operationId };
  } catch (e) {
    console.error('forceCacheInvalidation error: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/** Procesa la cola de cache (trabajador). Usa LockService para evitar races */
function processCacheQueue() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var fileId = getConfig('DATA_FILES.PRINCIPAL');
    var ss = SpreadsheetApp.openById(fileId);
    var queueSheet = ss.getSheetByName('CacheQueue');
    if (!queueSheet) return;

    var data = queueSheet.getDataRange().getValues();
    if (!data || data.length < 2) return;

    var headers = data[0];
    var rows = data.slice(1);

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var opId = row[0];
      var reportId = row[1];
      var paramsStr = row[2] || '{}';
      var status = row[3];
      var requestedBy = row[4];
      if (status !== 'PENDING') continue;

      // Marcar como IN_PROGRESS
      queueSheet.getRange(i+2, 4).setValue('IN_PROGRESS');

      try {
        var params = {};
        try { params = JSON.parse(paramsStr); } catch(e) { params = {}; }
        var result = computeCacheForReport(reportId, params);
        queueSheet.getRange(i+2, 7).setValue(new Date()); // finishedAt
        queueSheet.getRange(i+2, 8).setValue(JSON.stringify({ success:true, info: result }));
        queueSheet.getRange(i+2, 4).setValue('COMPLETED');
      } catch (e) {
        queueSheet.getRange(i+2, 7).setValue(new Date());
        queueSheet.getRange(i+2, 8).setValue(JSON.stringify({ success:false, error: e.message }));
        queueSheet.getRange(i+2, 4).setValue('FAILED');
      }
    }
  } catch (e) {
    console.error('processCacheQueue error: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/** Calcula y persiste cache para un reportId específico (ejemplo 'searchHints') */
function computeCacheForReport(reportId, params) {
  try {
    var fileId = getConfig('DATA_FILES.PRINCIPAL');
    var ss = SpreadsheetApp.openById(fileId);

    // Garantizar hoja CacheStore
    var store = ss.getSheetByName('CacheStore');
    if (!store) {
      store = ss.insertSheet('CacheStore');
      store.appendRow(['key','etag','payload','lastUpdated']);
    }

    if (reportId === 'searchHints') {
      // Precompute unique RT, PROYECTO y TRAMO lists
      var gestor = new GestorDatos(fileId);
      var d = gestor.leerDatos(getConfig('SHEETS.DATOS'));
      var headers = d.headers;
      var rows = d.rows;
      var colRT = getConfig('COLUMNS.RT');
      var colProyecto = getConfig('COLUMNS.PROYECTO');
      var colTramo = getConfig('COLUMNS.TRAMO');
      var setRT = {};
      var setProyecto = {};
      var setTramo = {};

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r[colRT]) setRT[String(r[colRT]).trim()] = true;
        if (r[colProyecto]) setProyecto[String(r[colProyecto]).trim()] = true;
        if (r[colTramo]) setTramo[String(r[colTramo]).trim()] = true;
      }

      var result = {
        RT: Object.keys(setRT).filter(Boolean).slice(0, 1000),
        PROYECTO: Object.keys(setProyecto).filter(Boolean).slice(0, 1000),
        TRAMO: Object.keys(setTramo).filter(Boolean).slice(0, 1000)
      };

      var payload = JSON.stringify(result);
      var etagBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload);
      var etag = etagBytes.map(function(b){ return (b+256).toString(16).slice(-2); }).join('');

      // Upsert into CacheStore (key = reportId)
      var data = store.getDataRange().getValues();
      var found = false;
      for (var r = 1; r < data.length; r++) {
        if (data[r][0] === reportId) {
          store.getRange(r+1, 2, 1, 3).setValues([[etag, payload, new Date()]]);
          found = true; break;
        }
      }
      if (!found) store.appendRow([reportId, etag, payload, new Date()]);

      return { key: reportId, etag: etag, size: payload.length };
    }

    // Default: nothing computed
    return { key: reportId, message: 'No computation implemented for this reportId' };
  } catch (e) {
    console.error('computeCacheForReport error: ' + e.message);
    throw e;
  }
}

/** Endpoint: obtiene hints de búsqueda (limitado) */
function getSearchHints(term, size) {
  try {
    term = String(term || '').trim();
    size = parseInt(size, 10) || 50;
    if (!term || term.length < 2) return { data: [], etag: '', meta: { total: 0 } };

    var gestor = new GestorDatos();
    var d = gestor.leerDatos(getConfig('SHEETS.DATOS'));
    var headers = d.headers;
    var rows = d.rows;
    var matches = {};

    var fields = [ getConfig('COLUMNS.RT'), getConfig('COLUMNS.PROYECTO'), getConfig('COLUMNS.TRAMO') ];

    for (var i = 0; i < rows.length && Object.keys(matches).length < 1000; i++) {
      var row = rows[i];
      for (var f = 0; f < fields.length; f++) {
        var key = fields[f];
        if (!key) continue;
        var val = String(row[key] || '').trim();
        if (!val) continue;
        if (val.toLowerCase().indexOf(term.toLowerCase()) >= 0) {
          matches[val] = true;
        }
      }
    }

    var list = Object.keys(matches).slice(0, size).map(function(v){ return { label: v, value: v }; });
    var payload = JSON.stringify(list);
    var etagBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload);
    var etag = etagBytes.map(function(b){ return (b+256).toString(16).slice(-2); }).join('');

    return { data: list, etag: etag, meta: { total: list.length } };
  } catch (e) {
    console.error('getSearchHints error: ' + e.message);
    return { data: [], etag: '', meta: { total: 0, error: e.message } };
  }
}

/** Instala trigger nocturno para procesar cola (02:00) */
function installCacheTriggers() {
  try {
    // Eliminar triggers previos con mismo handler
    var existing = ScriptApp.getProjectTriggers();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getHandlerFunction() === 'runNightlyPrecompute' || existing[i].getHandlerFunction() === 'processCacheQueue') {
        ScriptApp.deleteTrigger(existing[i]);
      }
    }

    ScriptApp.newTrigger('processCacheQueue').timeBased().atHour(2).everyDays(1).create();
    return { success: true, message: 'Trigger instalado (02:00 diario)' };
  } catch (e) {
    console.error('installCacheTriggers error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/** Helper de status de operación: lee CacheQueue por operationId */
function getCacheOperationStatus(operationId) {
  try {
    var fileId = getConfig('DATA_FILES.PRINCIPAL');
    var ss = SpreadsheetApp.openById(fileId);
    var queue = ss.getSheetByName('CacheQueue');
    if (!queue) return { status: 'UNKNOWN' };
    var data = queue.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === operationId) {
        return { operationId: operationId, status: data[r][3], requestedBy: data[r][4], requestedAt: data[r][5], finishedAt: data[r][6], result: data[r][7] };
      }
    }
    return { status: 'NOT_FOUND' };
  } catch (e) {
    console.error('getCacheOperationStatus error: ' + e.message);
    return { status: 'ERROR', error: e.message };
  }
}
