/**
 * ═══════════════════════════════════════════════════════════
 * GESTIÓN DE PERMISOS - CORREGIDO
 * ═══════════════════════════════════════════════════════════
 */

class GestorPermisos {
  constructor(fileId = null) {
    try {
      this.gestor = new GestorDatos(fileId);
      this.auditoria = new GestorAuditoria(fileId);
    } catch (e) {
      console.error(`Error en GestorPermisos: ${e.message}`);
      throw e;
    }
  }
  
  /**
   * Obtiene rol de usuario (V1 + V2)
   */
  obtenerRol(email) {
    try {
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.PERMISOS'));
      
      const emailIndex = findColumnIndex(headers, 'EMAIL');
      const rolIndex = findColumnIndex(headers, 'ROL');
      
      if (emailIndex < 0 || rolIndex < 0) {
        console.warn('⚠️ Columnas EMAIL o ROL no encontradas');
        return getConfig('ROLES.LECTOR');
      }
      
      const row = rows.find(r => safeCompare(r[headers[emailIndex]], email));
      
      if (!row) return null;
      
      const rol = row[headers[rolIndex]];
      return rol || getConfig('ROLES.LECTOR');
    } catch (e) {
      console.error(`Error obteniendo rol: ${e.message}`);
      return null;
    }
  }
  
  /**
   * Obtiene proyectos permitidos (V2)
   */
  obtenerProyectos(email) {
    try {
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.PERMISOS'));
      
      const emailIndex = findColumnIndex(headers, 'EMAIL');
      const proyectosIndex = findColumnIndex(headers, 'PROYECTOS');
      
      if (emailIndex < 0) return 'ALL';
      
      const row = rows.find(r => safeCompare(r[headers[emailIndex]], email));
      
      if (!row || !row[headers[proyectosIndex]]) return 'ALL';
      
      const proyectos = String(row[headers[proyectosIndex]]).trim();
      
      if (proyectos.toUpperCase() === 'ALL') return 'ALL';
      
      return proyectos.split(',').map(p => p.trim());
    } catch (e) {
      console.error(`Error obteniendo proyectos: ${e.message}`);
      return 'ALL';
    }
  }
  
  /**
   * Obtiene todos los permisos (V2 - CORREGIDO)
   */
  obtenerTodos() {
    try {
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.PERMISOS'));
      
      const emailIndex = findColumnIndex(headers, 'EMAIL');
      const rolIndex = findColumnIndex(headers, 'ROL');
      const proyectosIndex = findColumnIndex(headers, 'PROYECTOS');
      const activoIndex = findColumnIndex(headers, 'ACTIVO');
      const fechaIndex = findColumnIndex(headers, 'FECHA_CREACION');
      
      const permissions = rows
        .filter(row => row[headers[emailIndex]])
        .map(row => ({
          email: row[headers[emailIndex]] || '',
          rol: row[headers[rolIndex]] || '',
          proyectos: String(row[headers[proyectosIndex]] || 'ALL').split(',').map(p => p.trim()),
          activo: row[headers[activoIndex]] || 'SI',
          fecha: row[headers[fechaIndex]] || new Date().toString()
        }));
      
      return {
        permissions: permissions,
        roles: Object.values(getConfig('ROLES'))
      };
    } catch (e) {
      console.error(`Error obteniendo permisos: ${e.message}`);
      return { permissions: [], roles: [] };
    }
  }
  
  /**
   * Guarda nuevo permiso (V2)
   */
  guardarPermiso(email, rol, proyectos, usuarioActual) {
    try {
      // Validaciones
      if (!isValidEmail(email)) {
        throw new Error(`Email inválido: ${email}`);
      }
      
      if (!Object.values(getConfig('ROLES')).includes(rol)) {
        throw new Error(`Rol inválido: ${rol}`);
      }
      
      // Verificar que usuario actual sea Admin
      const rolActual = this.obtenerRol(usuarioActual);
      if (rolActual !== getConfig('ROLES.ADMIN')) {
        throw new Error('Solo administradores pueden crear permisos');
      }
      
      // Buscar si ya existe
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.PERMISOS'));
      const emailIndex = findColumnIndex(headers, 'EMAIL');
      
      const existente = rows.find(r => safeCompare(r[headers[emailIndex]], email));
      
      if (existente) {
        throw new Error(`Permiso ya existe para: ${email}`);
      }
      
      // Agregar nuevo permiso
      const fila = [
        email,
        rol,
        proyectos || 'ALL',
        'SI',
        new Date()
      ];
      
      this.gestor.agregarFila(getConfig('SHEETS.PERMISOS'), fila);
      
      // Registrar en auditoría
      this.auditoria.registrarAccion(
        usuarioActual,
        'CREAR_PERMISO',
        `Email: ${email}, Rol: ${rol}`
      );
      
      return {
        success: true,
        message: `Permiso creado para ${email}`
      };
    } catch (e) {
      console.error(`Error guardando permiso: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }
  
  /**
   * Elimina permiso (V2)
   */
  eliminarPermiso(email, usuarioActual) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      // Verificar que usuario actual sea Admin
      const rolActual = this.obtenerRol(usuarioActual);
      if (rolActual !== getConfig('ROLES.ADMIN')) {
        throw new Error('Solo administradores pueden eliminar permisos');
      }

      // Evitar eliminar último admin
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.PERMISOS'));
      const emailIndex = findColumnIndex(headers, 'EMAIL');
      const rolIndex = findColumnIndex(headers, 'ROL');

      const admins = rows.filter(r => 
        r[headers[rolIndex]] === getConfig('ROLES.ADMIN')
      );

      if (admins.length === 1 && safeCompare(admins[0][headers[emailIndex]], email)) {
        throw new Error('No se puede eliminar el último administrador');
      }

      // Marcar como inactivo en lugar de eliminar
      const rowIndex = rows.findIndex(r => safeCompare(r[headers[emailIndex]], email));

      if (rowIndex < 0) {
        throw new Error(`Permiso no encontrado: ${email}`);
      }

      const activoCol = findColumnIndex(headers, 'ACTIVO');
      if (activoCol >= 0) {
        this.gestor.actualizarRango(
          getConfig('SHEETS.PERMISOS'),
          rowIndex + 2,
          activoCol + 1,
          [[ 'NO' ]]
        );
      }

      // Registrar en auditoría
      this.auditoria.registrarAccion(
        usuarioActual,
        'ELIMINAR_PERMISO',
        `Email: ${email}`
      );

      return {
        success: true,
        message: `Permiso eliminado para ${email}`
      };
    } catch (e) {
      console.error(`Error eliminando permiso: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    } finally {
      try { lock.releaseLock(); } catch (er) {}
    }
  }
  
  /**
   * Obtiene historial de cambios de permisos (NUEVA)
   */
  obtenerHistorialPermisos(email) {
    try {
      const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.LOGS'));
      
      return rows
        .filter(row => row[headers[3]].includes(email))
        .filter(row => row[headers[2]].includes('PERMISO'))
        .map(row => ({
          fecha: row[headers[0]],
          usuario: row[headers[1]],
          accion: row[headers[2]],
          detalles: row[headers[3]]
        }));
    } catch (e) {
      console.error(`Error obteniendo historial permisos: ${e.message}`);
      return [];
    }
  }
}

// Funciones globales
function getPermissionsData() {
  try {
    const gestor = new GestorPermisos();
    return JSON.stringify(gestor.obtenerTodos());
  } catch (e) {
    console.error(`Error en getPermissionsData: ${e.message}`);
    return JSON.stringify({ permissions: [], roles: [] });
  }
}

function savePermission(email, rol, proyectos, usuario) {
  try {
    const gestor = new GestorPermisos();
    return gestor.guardarPermiso(email, rol, proyectos, usuario);
  } catch (e) {
    console.error(`Error en savePermission: ${e.message}`);
    return { success: false, error: e.message };
  }
}

function deletePermission(email, usuario) {
  try {
    const gestor = new GestorPermisos();
    return gestor.eliminarPermiso(email, usuario);
  } catch (e) {
    console.error(`Error en deletePermission: ${e.message}`);
    return { success: false, error: e.message };
  }
}

function getUserRole(email) {
  try {
    const gestor = new GestorPermisos();
    return gestor.obtenerRol(email);
  } catch (e) {
    console.error(`Error en getUserRole: ${e.message}`);
    return null;
  }
}

function getAllowedProjects(email) {
  try {
    const gestor = new GestorPermisos();
    return gestor.obtenerProyectos(email);
  } catch (e) {
    console.error(`Error en getAllowedProjects: ${e.message}`);
    return 'ALL';
  }
}