/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE REGLAS - ALMACENAMIENTO Y LECTURA
 * ═══════════════════════════════════════════════════════════
 */

// Función para obtener el JSON actual de las reglas
function obtenerReglasJSON() {
  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL'); // Toma el ID de tu config actual
    const ss = SpreadsheetApp.openById(fileId);
    let hojaReglas = ss.getSheetByName('CONFIG_REGLAS');

    // Si la hoja no existe, la crea (Instalación automática)
    if (!hojaReglas) {
      // ✅ SEC-P1.5: LockService para evitar creación duplicada de la hoja bajo concurrencia
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(20000);
        // Re-chequear tras adquirir el lock: otro proceso pudo haberla creado mientras esperábamos
        hojaReglas = ss.getSheetByName('CONFIG_REGLAS');
        if (!hojaReglas) {
          hojaReglas = ss.insertSheet('CONFIG_REGLAS');
          hojaReglas.hideSheet(); // La oculta para que los usuarios no la dañen
          hojaReglas.getRange("A1").setValue("MOTOR_DE_REGLAS_JSON");
          hojaReglas.getRange("A1").setFontWeight("bold").setBackground("#34495e").setFontColor("white");
          hojaReglas.getRange("B1").setValue("{}"); // JSON vacío por defecto
        }
      } catch (lockError) {
        // ✅ CONC-P2.1: diferenciar timeout de lock de otros errores (antes se tragaba en silencio
        // y caía al TypeError de hojaReglas null, con mensaje técnico confuso)
        console.error("Error adquiriendo lock para crear CONFIG_REGLAS:", lockError);
        return { success: false, message: 'El sistema se encuentra ocupado por otro administrador. Por favor intente de nuevo en unos segundos.' };
      } finally {
        try { lock.releaseLock(); } catch (er) {}
      }
    }

    const jsonString = hojaReglas.getRange("B1").getValue();
    return { success: true, data: jsonString };

  } catch (error) {
    console.error("Error leyendo reglas:", error);
    return { success: false, error: error.message };
  }
}

// Función para que el Administrador guarde cambios en el JSON desde la UI
function guardarReglasJSON(jsonString, usuario) {
  // ✅ CONC-P2.1: validar el JSON ANTES de tocar el lock, para que un JSON invalido
  // nunca se reporte como timeout ni un timeout se reporte como JSON invalido
  try {
    JSON.parse(jsonString);
  } catch (parseError) {
    return { success: false, error: "El formato JSON es inválido. Revisa la sintaxis." };
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
    let hojaReglas = ss.getSheetByName('CONFIG_REGLAS');

    // 2. Guardar en la celda B1
    hojaReglas.getRange("B1").setValue(jsonString);

    // 3. Registrar en auditoría (usando tu Gestor de Auditoría actual)
    try {
      const auditoria = new GestorAuditoria(fileId);
      auditoria.registrarAccion(usuario, 'ACTUALIZAR_MOTOR_REGLAS', 'Se actualizó el JSON maestro de reglas de negocio');
    } catch(e) { console.warn("No se pudo auditar:", e); }

    return { success: true, message: "Reglas actualizadas correctamente en la base de datos." };

  } catch (error) {
    return { success: false, error: 'Error al guardar las reglas: ' + error.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}