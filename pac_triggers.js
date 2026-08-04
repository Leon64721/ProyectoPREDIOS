// ═══════════════════════════════════════════════════════════════════════════════
// PAC_TRIGGERS.GS — Automatización y Triggers v2.0
// Fusión completa: conserva lógica anterior + integra nuevas funciones v2.0
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Instala todos los triggers del módulo PAC.
 * Ejecutar UNA SOLA VEZ por el Administrador.
 */
function instalarTriggersPAC() {
  try {
    eliminarTriggersPAC();

    // Trigger semanal: lunes 7am — ciclo completo
    ScriptApp.newTrigger('triggerSemanalPAC')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(7)
      .create();

    // Trigger diario: 8am — solo alertas críticas ROJO
    ScriptApp.newTrigger('triggerDiarioAlertasCriticas')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();

    pac_log('✅ Triggers PAC instalados: semanal (lunes 7am) + diario (8am)');
    console.log('✅ Triggers PAC instalados correctamente');
    return { success: true, mensaje: 'Triggers instalados: semanal (lunes 7am) + diario (8am)' };

  } catch (e) {
    console.error('❌ Error instalando triggers: ' + e.message);
    pac_log('Error instalando triggers: ' + e.message, 'ERROR');
    return { success: false, error: e.message };
  }
}

// ── Alias para compatibilidad con pac_setup.gs ──────────────────────────────
function pac_instalarTriggers() {
  return instalarTriggersPAC();
}

/**
 * Elimina todos los triggers relacionados con el PAC.
 */
function eliminarTriggersPAC() {
  const triggers = ScriptApp.getProjectTriggers();
  const nombresPAC = [
    'triggerSemanalPAC',
    'triggerDiarioAlertasCriticas',
    'triggerMensualReprogramacion',
    // Aliases v2.0 por si acaso quedaron instalados
    'pac_triggerSemanal',
    'pac_triggerDiario'
  ];

  let eliminados = 0;
  triggers.forEach(trigger => {
    if (nombresPAC.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
      eliminados++;
    }
  });

  console.log(`🗑️ ${eliminados} triggers PAC eliminados`);
  pac_log(`Triggers eliminados: ${eliminados}`);
  return { success: true, eliminados };
}

// ── Alias para compatibilidad ───────────────────────────────────────────────
function pac_eliminarTriggers() {
  return eliminarTriggersPAC();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGER SEMANAL — Lunes 7:00 AM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Trigger semanal: sincroniza PAC externo, actualiza estados prediales,
 * calcula semáforo completo y envía alertas a articuladores.
 * Se ejecuta automáticamente cada lunes a las 7am.
 */
function triggerSemanalPAC() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    console.log('⏰ Trigger semanal PAC iniciado - ' + new Date().toISOString());
    pac_log('=== TRIGGER SEMANAL PAC INICIADO ===');

    try {
    const adminEmail = _obtenerEmailAdmin();

    // ── 1. Sincronizar PAC externo ──────────────────────────────────────────
    const sync = sincronizarPAC();
    console.log('   Sync: ' + (sync.mensaje || JSON.stringify(sync)));
    pac_log('Sync semanal: ' + JSON.stringify(sync));

    // ── 2. Gestión del borrador ─────────────────────────────────────────────
    if (sync.success) {
      if (!sync.cambios || sync.cambios === 0) {
        // Sin cambios → aprobar automáticamente
        aprobarBorradorPAC('Auto-aprobado trigger semanal: sin cambios');
        pac_log('Borrador auto-aprobado: sin cambios detectados');
      } else {
        // Con cambios → notificar al admin para revisión manual
        _notificarAdminCambiosPendientes(adminEmail, sync);
        pac_log('Admin notificado: ' + sync.cambios + ' cambios pendientes de aprobación');
      }
    }

    // ── 3. Actualizar estados prediales desde la Matriz ─────────────────────
    pac_actualizarEstadosDesdeMatriz();
    pac_log('Estados prediales actualizados desde Matriz');

    // ── 4. Calcular semáforo completo ───────────────────────────────────────
    const semaforo = calcularSemaforoPAC({}, PAC_CONFIG.MODOS_EJECUCION.RADICADO);
    pac_log('Semáforo calculado: ' + (semaforo.registros || []).length + ' registros');

    // ── 5. Enviar alertas a articuladores con RT en riesgo ──────────────────
    const totalEnRiesgo = (semaforo.totales
      ? (semaforo.totales.ROJO || 0) + (semaforo.totales.NARANJA || 0)
      : 0);

    if (semaforo.success && totalEnRiesgo > 0) {
      const alertas = enviarAlertasPAC();
      console.log('   Alertas enviadas: ' + (alertas.enviados || 0) + ' articuladores');
      pac_log('Alertas semanales enviadas: ' + (alertas.enviados || 0) + ' articuladores');
    } else {
      pac_log('Sin RT en riesgo — no se enviaron alertas');
    }

    // ── 6. Registrar ejecución del trigger ──────────────────────────────────
    _registrarEjecucionTrigger('SEMANAL', {
      sync:      sync.cambios    || 0,
      totalRT:   (semaforo.registros || []).length,
      enRiesgo:  totalEnRiesgo
    });

    pac_log('=== TRIGGER SEMANAL PAC COMPLETADO ===');
    console.log('✅ Trigger semanal PAC completado');

    } catch (e) {
      console.error('❌ Error en trigger semanal PAC: ' + e.message);
      pac_log('Error crítico en trigger semanal: ' + e.message, 'ERROR');
      _notificarErrorTrigger(e.message);
    }
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGER DIARIO — 8:00 AM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Trigger diario: solo envía alertas para RT en estado ROJO.
 * Evita saturar con correos — solo los críticos reciben alerta diaria.
 */
function triggerDiarioAlertasCriticas() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    console.log('⏰ Trigger diario alertas críticas - ' + new Date().toISOString());
    pac_log('=== TRIGGER DIARIO ALERTAS CRÍTICAS INICIADO ===');

    try {
    // ── 1. Actualizar estados prediales ────────────────────────────────────
    pac_actualizarEstadosDesdeMatriz();

    // ── 2. Calcular semáforo ────────────────────────────────────────────────
    const semaforo = calcularSemaforoPAC(
      { semaforo: 'ROJO' },
      PAC_CONFIG.MODOS_EJECUCION.RADICADO
    );

    if (!semaforo.success) {
      pac_log('Error calculando semáforo en trigger diario: ' + (semaforo.error || ''), 'ERROR');
      return;
    }

    const rtRojos = (semaforo.registros || []).filter(r => r.semaforo === 'ROJO');

    if (rtRojos.length === 0) {
      console.log('   Sin RT en estado ROJO hoy');
      pac_log('Trigger diario: sin RT en ROJO');
      return;
    }

    console.log('   ⚠️ ' + rtRojos.length + ' RT en ROJO - enviando alertas críticas');
    pac_log('RT en ROJO: ' + rtRojos.length + ' — enviando alertas críticas');

    // ── 3. Enviar alertas críticas por articulador ──────────────────────────
    const ss = pac_getSpreadsheet();
    const hArt = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.ARTICULADORES);

    if (!hArt || hArt.getLastRow() < 2) {
      pac_log('No hay articuladores configurados para alertas diarias', 'ADVERTENCIA');
      return;
    }

    const datosArt = hArt.getDataRange().getValues();
    const headArt  = datosArt[0].map(h => String(h).trim());
    const idxNom   = pac_getColIdx(headArt, 'NOMBRE');
    const idxCor   = pac_getColIdx(headArt, 'CORREO');
    const idxProy  = pac_getColIdx(headArt, 'PROYECTO');

    // Agrupar RT rojos por articulador
    const porArt = {};
    rtRojos.forEach(reg => {
      for (let i = 1; i < datosArt.length; i++) {
        const correo  = String(datosArt[i][idxCor]  || '').trim();
        const nombre  = String(datosArt[i][idxNom]  || '').trim();
        const proyecto= String(datosArt[i][idxProy] || '').trim();

        if (!correo || !correo.includes('@')) continue;

        if (proyecto === reg.proyecto || proyecto === 'ALL') {
          if (!porArt[correo]) porArt[correo] = { nombre, correo, predios: [] };
          porArt[correo].predios.push(reg);
          break;
        }
      }
    });

    // Enviar correos críticos
    let enviados = 0;
    Object.values(porArt).forEach(art => {
      try {
        MailApp.sendEmail({
          to:       art.correo,
          subject:  `🚨 ALERTA CRÍTICA PAC — ${art.predios.length} predio(s) en INCUMPLIMIENTO`,
          htmlBody: pac_construirEmailHTML(art.nombre, art.predios, semaforo.mesActual)
        });
        pac_registrarAlerta(art.correo, art.predios.length, semaforo.mesActual);
        enviados++;
      } catch (eCorreo) {
        pac_log('Error enviando correo a ' + art.correo + ': ' + eCorreo.message, 'ERROR');
      }
    });

    // ── 4. Registrar ejecución ──────────────────────────────────────────────
    _registrarEjecucionTrigger('DIARIO', {
      sync:     0,
      totalRT:  rtRojos.length,
      enRiesgo: rtRojos.length
    });

    pac_log('Alertas críticas enviadas: ' + enviados + ' articuladores');
    pac_log('=== TRIGGER DIARIO COMPLETADO ===');

    } catch (e) {
      console.error('❌ Error en trigger diario: ' + e.message);
      pac_log('Error en trigger diario: ' + e.message, 'ERROR');
    }
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICACIONES INTERNAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Notifica al administrador que hay cambios en el PAC pendientes de aprobación.
 * @param {string} adminEmail
 * @param {Object} syncResult — resultado de sincronizarPAC()
 */
function _notificarAdminCambiosPendientes(adminEmail, syncResult) {
  try {
    if (!adminEmail) {
      pac_log('No se encontró email de admin para notificar cambios pendientes', 'ADVERTENCIA');
      return;
    }

    const cambios = syncResult.cambios || 0;
    const asunto  = `[PAC IDU] ${cambios} cambio(s) pendiente(s) de aprobación`;

    // Construir lista de cambios para el correo
    const detalleItems = [];
    if (syncResult.nuevos     > 0) detalleItems.push(`<li>${syncResult.nuevos} registro(s) nuevo(s)</li>`);
    if (syncResult.modificados> 0) detalleItems.push(`<li>${syncResult.modificados} registro(s) modificado(s)</li>`);
    if (syncResult.eliminados > 0) detalleItems.push(`<li>${syncResult.eliminados} registro(s) eliminado(s)</li>`);

    const cuerpo = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <div style="background:#1a73e8;color:white;padding:16px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">📋 Cambios detectados en el PAC</h2>
          <p style="margin:6px 0 0 0;opacity:0.85;font-size:13px;">
            Sistema de Seguimiento PAC — IDU Gestión Predial
          </p>
        </div>
        <div style="padding:16px;background:#f8f9fa;border:1px solid #dee2e6;
                    border-radius:0 0 8px 8px;">
          <p>Se detectaron <strong>${cambios} cambio(s)</strong> en la última
          sincronización automática del PAC (${new Date().toLocaleString('es-CO')}).</p>

          <p>Como Administrador del sistema, debe revisar y aprobar estos cambios
          para que queden vigentes en el módulo de seguimiento.</p>

          <div style="margin-top:12px;padding:12px;background:#fff3e0;
                      border-left:4px solid #f39c12;border-radius:4px;">
            <strong>Resumen de cambios detectados:</strong>
            <ul style="margin-top:8px;font-size:13px;">
              ${detalleItems.join('') || '<li>Sin detalle disponible</li>'}
            </ul>
          </div>

          <div style="margin-top:16px;padding:12px;background:#e8f5e9;
                      border-left:4px solid #27ae60;border-radius:4px;font-size:13px;">
            <strong>¿Cómo aprobar?</strong><br>
            Ingrese al sistema → Módulo PAC → botón
            <strong>"Sync"</strong> → <strong>"Aprobar borrador"</strong>
          </div>

          <p style="margin-top:16px;font-size:11px;color:#999;">
            Generado automáticamente el ${new Date().toLocaleString('es-CO')} —
            Sistema PAC IDU v2.0
          </p>
        </div>
      </div>`;

    GmailApp.sendEmail(adminEmail, asunto, '', { htmlBody: cuerpo });
    console.log('📧 Admin notificado: ' + adminEmail);
    pac_log('Admin notificado por cambios pendientes: ' + adminEmail);

  } catch (e) {
    console.error('❌ Error notificando admin: ' + e.message);
    pac_log('Error notificando admin: ' + e.message, 'ERROR');
  }
}

/**
 * Notifica al admin si el trigger falla con un error crítico.
 * @param {string} mensajeError
 */
function _notificarErrorTrigger(mensajeError) {
  try {
    const adminEmail = _obtenerEmailAdmin();
    if (!adminEmail) return;

    GmailApp.sendEmail(
      adminEmail,
      '[ERROR CRÍTICO PAC IDU] Fallo en trigger automático',
      '',
      {
        htmlBody: `
          <div style="font-family:Arial,sans-serif;max-width:600px;">
            <div style="background:#c0392b;color:white;padding:16px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;">🚨 Error en trigger automático PAC</h2>
            </div>
            <div style="padding:16px;background:#fce8e6;border:1px solid #f5c6cb;
                        border-radius:0 0 8px 8px;">
              <p>El trigger automático del módulo PAC falló con el siguiente error:</p>
              <div style="background:white;padding:12px;border-radius:4px;
                          font-family:monospace;font-size:13px;color:#c0392b;">
                ${mensajeError}
              </div>
              <p style="margin-top:12px;">Por favor revise los logs del sistema
              (hoja <strong>LOG_PAC_SISTEMA</strong>) para más detalles.</p>
              <p style="font-size:11px;color:#999;margin-top:16px;">
                ${new Date().toLocaleString('es-CO')} — Sistema PAC IDU v2.0
              </p>
            </div>
          </div>`
      }
    );
    pac_log('Notificación de error enviada al admin: ' + adminEmail);

  } catch (e) {
    console.error('No se pudo notificar el error al admin: ' + e.message);
    pac_log('No se pudo notificar error al admin: ' + e.message, 'ERROR');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO Y DIAGNÓSTICO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registra cada ejecución de trigger en el historial PAC.
 * @param {string} tipo — 'SEMANAL' | 'DIARIO'
 * @param {Object} datos — { sync, totalRT, enRiesgo }
 */
function _registrarEjecucionTrigger(tipo, datos) {
  try {
    const ss = pac_getSpreadsheet();
    const hoja = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.HISTORIAL);
    if (!hoja) return;

    if (hoja.getLastRow() === 0) {
      hoja.appendRow(['FECHA', 'USUARIO', 'TIPO', 'DETALLE']);
    }

    hoja.appendRow([
      new Date(),
      'SISTEMA_TRIGGER',
      `TRIGGER_${tipo}`,
      `Trigger ${tipo}: ${datos.totalRT} RT procesados | ` +
      `${datos.sync} cambios sync | ` +
      `${datos.enRiesgo} en riesgo`
    ]);

    pac_log(`Ejecución trigger ${tipo} registrada en historial`);

  } catch (e) {
    console.error('❌ Error registrando ejecución trigger: ' + e.message);
    pac_log('Error registrando trigger en historial: ' + e.message, 'ERROR');
  }
}

/**
 * Obtiene el email del primer Administrador activo registrado en el sistema.
 * Compatible con el sistema de permisos del sistema padre.
 * @returns {string|null}
 */
function _obtenerEmailAdmin() {
  try {
    const ss = pac_getSpreadsheet();

    // Intentar con CONFIG del sistema padre
    const nombreHojaPermisos = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS && CONFIG.SHEETS.PERMISOS)
      ? CONFIG.SHEETS.PERMISOS
      : 'PERMISOS';

    const rolAdmin = (typeof CONFIG !== 'undefined' && CONFIG.ROLES && CONFIG.ROLES.ADMIN)
      ? CONFIG.ROLES.ADMIN
      : 'ADMIN';

    const hoja = ss.getSheetByName(nombreHojaPermisos);
    if (!hoja || hoja.getLastRow() < 2) {
      // Fallback: devolver el email del usuario activo
      return Session.getActiveUser().getEmail() || null;
    }

    const datos   = hoja.getDataRange().getValues();
    const headers = datos[0].map(h => String(h).trim());
    const idxEmail = pac_getColIdx(headers, 'EMAIL');
    const idxRol   = pac_getColIdx(headers, 'ROL');
    const idxActivo= pac_getColIdx(headers, 'ACTIVO');

    for (let i = 1; i < datos.length; i++) {
      const email  = idxEmail  >= 0 ? String(datos[i][idxEmail]  || '').trim() : '';
      const rol    = idxRol    >= 0 ? String(datos[i][idxRol]    || '').trim() : '';
      const activo = idxActivo >= 0 ? datos[i][idxActivo]                      : true;

      if (rol === rolAdmin && activo !== false && email.includes('@')) {
        return email;
      }
    }

    // Fallback final
    return Session.getActiveUser().getEmail() || null;

  } catch (e) {
    pac_log('Error obteniendo email admin: ' + e.message, 'ERROR');
    return null;
  }
}

/**
 * Verifica el estado actual de los triggers instalados.
 * Útil para diagnóstico desde pac_setup.gs
 * @returns {Object}
 */
function pac_verificarTriggers() {
  const triggers    = ScriptApp.getProjectTriggers();
  const nombresPAC  = [
    'triggerSemanalPAC',
    'triggerDiarioAlertasCriticas',
    'pac_triggerSemanal',
    'pac_triggerDiario'
  ];

  const pacTriggers = triggers
    .filter(t => nombresPAC.includes(t.getHandlerFunction()))
    .map(t => ({
      funcion:    t.getHandlerFunction(),
      tipo:       t.getEventType().toString(),
      id:         t.getUniqueId()
    }));

  return {
    instalados: pacTriggers.length,
    detalle:    pacTriggers,
    esperados:  2,
    status:     pacTriggers.length >= 2 ? 'OK' : 'INCOMPLETO'
  };
}

/**
 * Ejecuta manualmente el ciclo completo (útil para pruebas).
 * Solo debe usarlo el Administrador.
 */
function pac_ejecutarCicloManual() {
  pac_log('=== CICLO MANUAL PAC INICIADO ===');
  try {
    pac_actualizarEstadosDesdeMatriz();
    const sync = sincronizarPAC();
    pac_log('Sync manual: ' + JSON.stringify(sync));

    if (sync.success) {
      aprobarBorradorPAC('Ejecución manual del ciclo PAC');
    }

    const semaforo = calcularSemaforoPAC({}, PAC_CONFIG.MODOS_EJECUCION.RADICADO);
    pac_log('Semáforo manual: ' + (semaforo.registros || []).length + ' registros');

    _registrarEjecucionTrigger('MANUAL', {
      sync:     sync.cambios    || 0,
      totalRT:  (semaforo.registros || []).length,
      enRiesgo: (semaforo.totales
        ? (semaforo.totales.ROJO || 0) + (semaforo.totales.NARANJA || 0)
        : 0)
    });

    pac_log('=== CICLO MANUAL PAC COMPLETADO ===');
    return { success: true, sync, totalRT: (semaforo.registros || []).length };

  } catch (e) {
    pac_log('Error en ciclo manual: ' + e.message, 'ERROR');
    return { success: false, error: e.message };
  }
}
