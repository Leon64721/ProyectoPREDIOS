/**
 * ═══════════════════════════════════════════════════════════
 * GESTIÓN DE REPORTES - IMPLEMENTACIÓN COMPLETA (V2.1)
 * Auditoría: Implementa stubs de V2 + reportería dinámica
 * ═══════════════════════════════════════════════════════════
 */

class GestorReportes {
  constructor(fileId = null) {
    this.gestor = new GestorDatos(fileId);
    this.auditoria = new GestorAuditoria(fileId);
  }
  
  /**
   * Obtiene reportes guardados (V2 - CORREGIDO V2.1)
   */
  obtenerGuardados(usuario) {
    try {
      this._asegurarHojaReportes();
      
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.REPORTES'));
      
      // ✅ VALIDACIÓN: Verificar que headers existe
      if (!headers || headers.length === 0) {
        console.warn('⚠️ No hay headers en la hoja de reportes');
        return [];
      }
      
      // ✅ BÚSQUEDA SEGURA DE COLUMNAS
      const usuarioIndex = findColumnIndex(headers, 'USUARIO');
      const activoIndex = findColumnIndex(headers, 'ACTIVO');
      
      // ✅ ÍNDICES POR DEFECTO SI NO ENCUENTRA
      const idIndex = 0;
      const nombreIndex = 1;
      const descIndex = 2;
      const configIndex = 3;
      const filtrosIndex = 4;
      const usuarioIdx = usuarioIndex >= 0 ? usuarioIndex : 5;
      const fechaIndex = 6;
      const ultimaEjIndex = 7;
      
      return rows
        .filter(row => {
          try {
            const rowUser = row[headers[usuarioIdx]] || '';
            return safeCompare(rowUser, usuario);
          } catch (e) {
            return false;
          }
        })
        .filter(row => {
          try {
            const activo = row[headers[activoIndex >= 0 ? activoIndex : 8]] || 'SI';
            return activo !== 'NO';
          } catch (e) {
            return true;
          }
        })
        .map(row => ({
          id: row[headers[idIndex]] || '',
          nombre: row[headers[nombreIndex]] || '',
          descripcion: row[headers[descIndex]] || '',
          config: tryParseJSON(row[headers[configIndex]]),
          filtros: tryParseJSON(row[headers[filtrosIndex]]),
          usuario: row[headers[usuarioIdx]] || '',
          fechaCreacion: row[headers[fechaIndex]] || '',
          ultimaEjecucion: row[headers[ultimaEjIndex]] || ''
        }));
    } catch (e) {
      console.error(`❌ Error en obtenerGuardados: ${e.message}`);
      return [];
    }
  }
  
  /**
   * Guarda nuevo reporte (V2 - saveReport)
   */
  guardarReporte(nombre, config, filtros, usuario) {
    try {
      if (!nombre || nombre.trim() === '') {
        throw new Error('Nombre de reporte requerido');
      }
      
      if (!config || typeof config !== 'object') {
        throw new Error('Configuración inválida');
      }
      
      this._asegurarHojaReportes();
      
      const id = generarId();
      const fila = [
        id,
        nombre,
        config.descripcion || '',
        JSON.stringify(config),
        JSON.stringify(filtros || {}),
        usuario,
        new Date(),
        null
      ];
      
      this.gestor.agregarFila(getConfig('SHEETS.REPORTES'), fila);
      
      this.auditoria.registrarAccion(
        usuario,
        'CREAR_REPORTE',
        `Nombre: ${nombre}`
      );
      
      return {
        success: true,
        message: `Reporte "${nombre}" guardado`,
        id: id
      };
    } catch (e) {
      console.error(`Error guardando reporte: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }
  
  /**
   * Ejecuta reporte y retorna datos (NUEVA)
   */
  ejecutarReporte(reporteId, usuario) {
    try {
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.REPORTES'));
      
      const idIndex = 0;
      const reporte = rows.find(r => r[headers[idIndex]] === reporteId);
      
      if (!reporte) {
        throw new Error(`Reporte no encontrado: ${reporteId}`);
      }
      
      const config = JSON.parse(reporte[headers[3]]);
      const filtros = JSON.parse(reporte[headers[4]]);
      const { rows: datosRows } = this.gestor.leerDatos(getConfig('SHEETS.DATOS'));
      
      // --- NUEVO: FILTRAR INACTIVOS DE LOS REPORTES ---
      let datosFiltr = datosRows.filter(r => String(r['ACTIVO/INACTIVO']).toUpperCase().trim() !== 'INACTIVO');
                 
      if (filtros.proyecto) {
        datosFiltr = datosFiltr.filter(r => 
          r[getConfig('COLUMNS.PROYECTO')] === filtros.proyecto
        );
      }
      
      if (filtros.tramo) {
        datosFiltr = datosFiltr.filter(r => 
          r[getConfig('COLUMNS.TRAMO')] === filtros.tramo
        );
      }
      
      if (filtros.estado) {
        datosFiltr = datosFiltr.filter(r => 
          r[getConfig('COLUMNS.ESTADO')] === filtros.estado
        );
      }
      
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(30000);
        const rowIndex = rows.indexOf(reporte);
        const ultimaEjIndex = findColumnIndex(headers, 'ULTIMA_EJECUCION') >= 0 ? findColumnIndex(headers, 'ULTIMA_EJECUCION') : 7;
        this.gestor.actualizarRango(
          getConfig('SHEETS.REPORTES'),
          rowIndex + 2,
          ultimaEjIndex + 1,
          [[ new Date() ]]
        );
      } finally {
        try { lock.releaseLock(); } catch (er) {}
      }
      
      return {
        success: true,
        reporte: reporte[headers[1]],
        datos: datosFiltr,
        totalRegistros: datosFiltr.length
      };
    } catch (e) {
      console.error(`Error ejecutando reporte: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }
  
  /**
   * Elimina reporte (NUEVA)
   */
  eliminarReporte(reporteId, usuario) {
    try {
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.REPORTES'));
      
      const idIndex = 0;
      const rowIndex = rows.findIndex(r => r[headers[idIndex]] === reporteId);
      
      if (rowIndex < 0) {
        throw new Error(`Reporte no encontrado: ${reporteId}`);
      }
      
      const activoCol = findColumnIndex(headers, 'ACTIVO');
      if (activoCol >= 0) {
        const lock = LockService.getScriptLock();
        try {
          lock.waitLock(30000);
          this.gestor.actualizarRango(
            getConfig('SHEETS.REPORTES'),
            rowIndex + 2,
            activoCol + 1,
            [[ 'NO' ]]
          );
        } finally {
          try { lock.releaseLock(); } catch (er) {}
        }
      }
      
      this.auditoria.registrarAccion(
        usuario,
        'ELIMINAR_REPORTE',
        `ID: ${reporteId}`
      );
      
      return {
        success: true,
        message: 'Reporte eliminado'
      };
    } catch (e) {
      console.error(`Error eliminando reporte: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }
  
  /**
   * Asegura que exista hoja de reportes
   */
  _asegurarHojaReportes() {
    try {
      this.gestor.getSheet(getConfig('SHEETS.REPORTES'));
    } catch (e) {
      const sheet = this.gestor.ss.insertSheet(getConfig('SHEETS.REPORTES'));
      sheet.appendRow([
        'ID', 'NOMBRE', 'DESCRIPCION', 'CONFIG',
        'FILTROS', 'USUARIO', 'FECHA_CREACION', 'ULTIMA_EJECUCION', 'ACTIVO'
      ]);
      sheet.setTabColor('green');
    }
  }
}

/**
 * Funciones globales (V2 - Implementación de stubs)
 */

function getSavedReports(usuario) {
  try {
    const gestor = new GestorReportes();
    return JSON.stringify(gestor.obtenerGuardados(usuario));
  } catch (e) {
    console.error(`Error en getSavedReports: ${e.message}`);
    return JSON.stringify([]);
  }
}

function saveReport(nombre, config, filtros, usuario) {
  try {
    const gestor = new GestorReportes();
    return gestor.guardarReporte(nombre, config, filtros, usuario);
  } catch (e) {
    console.error(`Error en saveReport: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

function executeReport(reporteId, usuario) {
  try {
    const gestor = new GestorReportes();
    return JSON.stringify(gestor.ejecutarReporte(reporteId, usuario));
  } catch (e) {
    console.error(`Error en executeReport: ${e.message}`);
    return JSON.stringify({
      success: false,
      error: e.message
    });
  }
}

function deleteReport(reporteId, usuario) {
  try {
    const gestor = new GestorReportes();
    return gestor.eliminarReporte(reporteId, usuario);
  } catch (e) {
    console.error(`Error en deleteReport: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}