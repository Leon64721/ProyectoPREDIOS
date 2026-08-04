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
      hojaReglas = ss.insertSheet('CONFIG_REGLAS');
      hojaReglas.hideSheet(); // La oculta para que los usuarios no la dañen
      hojaReglas.getRange("A1").setValue("MOTOR_DE_REGLAS_JSON");
      hojaReglas.getRange("A1").setFontWeight("bold").setBackground("#34495e").setFontColor("white");
      hojaReglas.getRange("B1").setValue("{}"); // JSON vacío por defecto
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
  try {
    // 1. Validar que sea un JSON bien formado antes de guardar
    JSON.parse(jsonString); 
    
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
    return { success: false, error: "El formato JSON es inválido. Revisa la sintaxis." };
  }
}