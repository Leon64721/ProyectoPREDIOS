/**
 * ═══════════════════════════════════════════════════════════
 * CONFIGURACIÓN CENTRAL DEL SISTEMA - V3.0 COMPATIBLE
 * ═══════════════════════════════════════════════════════════
 */

const CONFIG = {
  // ✅ NUEVO: CONTROL DE MANTENIMIENTO
  MANTENIMIENTO: {
    ACTIVO: false, // Cambia true a false  cuando termines de actualizar la base
    MENSAJE: "Estamos actualizando nuestra base de datos para brindarte un mejor servicio. En breve volveremos a estar en funcionamiento.",
    CORREOS_CONTACTO: "fabian.montanez@idu.gov.co o sistemasdtdp@idu.gov.co"
  },

  // ✅ ARCHIVOS DE DATOS (ESTRUCTURA ORIGINAL + COMPATIBILIDAD)
  DATA_FILES: {
    PRINCIPAL: '', // Usar el Spreadsheet activo si no se especifica otro ID
    SECUNDARIOS: [],
    STAGING: '', // ID de Dato 2 / Staging para validaciones y promoción manual
    LOGS: '***REMOVED***', // ✅ FASE 5b: spreadsheet separado (BD_OPERACIONAL_PREDIOS) para logs de auditoría (registrarAccion/getUserLogs)
    USUARIOS: '***REMOVED***', // ✅ SPRINT5-FASE-A: directorio de identidad/rol (EMAIL/ROL/NOMBRE/ACTIVO/COMPONENTE), spreadsheet separado — ver ARCHITECTURE_V4.md Sección 6.1
    LOGS_ASIGNACION: 'ID_SPREADSHEET_LOGS_ASIGNACION_AQUI' // ⚠️ SPRINT5-FASE-A: placeholder sin reemplazar — crear spreadsheet dedicado y pegar su ID aquí antes de operar en producción (registrarLogAsignacion() se autodeshabilita mientras esto siga así, ver auditoria.js:31 para el mismo patrón)
  },
  
  // ✅ NUEVO: Compatibilidad con código que usa DATA_FILES_IDS
  DATA_FILES_IDS: [],
  
  // ✅ COMPATIBILIDAD: Alias para código antiguo
  MAESTRO_PERMISOS: '***REMOVED***',
  
  // ✅ HOJAS DE CÁLCULO (V1 + V2 + NUEVAS) - SIN CAMBIOS
  SHEETS: {
    DATOS: 'Datos',
    SEGUIMIENTO: 'Seguimiento',
    PERMISOS: 'Permisos',
    REPORTES: 'ReportesGuardados',
    LOGS: 'Logs',
    AUDITORIA: 'LOGS_AUDITORIA',
    HISTORIAL_PERMISOS: 'Historial_Permisos',
    USUARIOS: 'USUARIOS', // ✅ SPRINT5-FASE-A: pestaña dentro de DATA_FILES.USUARIOS
    LOGS_ASIGNACION: 'LOGS_ASIGNACION' // ✅ SPRINT5-FASE-A: pestaña dentro de DATA_FILES.LOGS_ASIGNACION, creada automáticamente por registrarLogAsignacion() si no existe
  },
  
  // ✅ COLUMNAS DE DATOS (V1 + V2 completo) - SIN CAMBIOS
  COLUMNS: {
    // Identificadores
    RT: 'RT',
    CHIP: 'CHIP',
    
    // Ubicación
    PROYECTO: 'PROYECTO',
    TRAMO: 'TRAMO',
    DIRECCION: 'DIRECCIÓN',
    
    // Estados (V1 + V2)
    ESTADO: 'ESTADO PREDIAL AJUSTADO',
    ESTADO_PREDIAL: 'ESTADO PREDIAL',
    ESTADO_RT: 'ESTADO RT',
    ESTADO_TITULOS: 'ESTADO ESTUDIO DE TITULOS',
    ESTADO_TASACION: 'ESTADO TASACIÓN',
    ESTADO_AVALUO: 'ESTADO AVALUO',
    
    // Disponibilidad
    DISPONIBILIDAD: 'PREDIOS DISPONIBLES (INCLUYE CESIONES)',
    
    // Financiero
    ESTIMADO: 'ESTIMADO $',
    PAGADO: 'VALOR PAGADO',
    SALDO: 'SALDO',
    
    // Fechas
    FECHA_ENTREGA: 'FECHA ESTIMADA DE ENTREGA',
    FECHA_AVALUO: 'FECHA AVALUO',
    
    // Especiales
    SITUACIONES: 'SITUACIONES ESPECIALES',
    OBSERVACIONES: 'OBSERVACIONES',

    // Virtual (creado en cliente)
    FECHA_ISO: 'FECHA_ISO',

    // ✅ SPRINT5-FASE-A: responsables jurídicos — nombres EXACTOS de producción.
    // ARTICULADOR_JURIDICO tiene un typo real en la hoja ("JUIRIDICO", no "JURIDICO") — NO corregir,
    // debe matchear el header literal o findColumnIndex() no lo encuentra.
    ARTICULADOR_JURIDICO: 'ARTICULADOR JUIRIDICO',
    GESTOR_JURIDICO: 'GESTOR JURÍDICO'
  },
  
  // ✅ COLUMNAS DE SEGUIMIENTO (V2) - SIN CAMBIOS
  COLUMNS_SEGUIMIENTO: [
    'FECHA',
    'RT',
    'ESTADO_PREDIAL',
    'ESTADO_PREDIAL_AJUSTADO',
    'PREDIOS_DISPONIBLES',
    'ESTADO_RT',
    'ESTADO_TITULOS',
    'ESTADO_TASACION',
    'ESTADO_AVALUO',
    'FECHA_AVALUO',
    'SITUACIONES',
    'OBSERVACIONES'
  ],
  
  // ✅ COLUMNAS DE AUDITORIA (NUEVA) - SIN CAMBIOS
  COLUMNS_AUDITORIA: [
    'TIMESTAMP',
    'USUARIO',
    'RT',
    'CAMPO',
    'VALOR_ANTERIOR',
    'VALOR_NUEVO',
    'ACCION'
  ],
  
  // ✅ COLUMNAS DE PERMISOS - SIN CAMBIOS
  COLUMNS_PERMISOS: [
    'EMAIL',
    'ROL',
    'PROYECTOS',
    'ACTIVO',
    'FECHA_CREACION'
  ],

  // ✅ COLUMNAS DE USUARIOS (SPRINT5-FASE-A) — esquema confirmado por el usuario, hoja en DATA_FILES.USUARIOS
  COLUMNS_USUARIOS: [
    'No',
    'EMAIL',
    'ROL',
    'NOMBRE',
    'ACTIVO',
    'COMPONENTE'
  ],

  // ✅ COLUMNAS DE LOGS_ASIGNACION (SPRINT5-FASE-A) — ver ARCHITECTURE_V4.md Sección 3
  COLUMNS_LOG_ASIGNACION: [
    'TIMESTAMP',
    'NIVEL',
    'ID_TARGET',
    'ROL',
    'USUARIO_ANTERIOR',
    'USUARIO_NUEVO',
    'EJECUTOR_EMAIL',
    'OBSERVACIONES'
  ],

  // ✅ ROLES Y PERMISOS — SPRINT5-FASE-A añade ARTICULADOR/GESTOR (jerarquía de negocio,
  // ver ARCHITECTURE_V4.md Sección 6.1: se decidió extender CONFIG.ROLES, no una capa paralela)
  ROLES: {
    EDITOR: 'Editor',
    LECTOR: 'Lector',
    ADMIN: 'Administrador',
    ARTICULADOR: 'Articulador',
    GESTOR: 'Gestor'
  },

  // ✅ PERMISOS POR ROL — SPRINT5-FASE-A añade Articulador/Gestor
  PERMISOS_POR_ROL: {
    'Administrador': ['LEER', 'EDITAR', 'ELIMINAR', 'PERMISOS', 'REPORTES'],
    'Editor': ['LEER', 'EDITAR', 'REPORTES'],
    'Lector': ['LEER', 'REPORTES'],
    'Articulador': ['LEER', 'EDITAR', 'REPORTES', 'ASIGNAR_EQUIPO'], // alcance recortado a sus proyectos — aplicado en backend, no solo UI
    'Gestor': ['LEER', 'REPORTES'] // alcance recortado a los RTs de su Articulador
  },
  
  // ✅ FORMATOS - SIN CAMBIOS
  FORMATS: {
    FECHA_ISO: 'YYYY-MM-DD',
    MONEDA: 'COP',
    LOCALE: 'es-CO'
  },
  
  // ✅ ESTADOS PERMITIDOS (V2) - SIN CAMBIOS
  ESTADOS_PERMITIDOS: {
    DISPONIBILIDAD: ['DISPONIBLE', 'PENDIENTE', 'CESIÓN'],
    PREDIAL: ['ADQUIRIDO', 'EN PROCESO', 'PENDIENTE'],
    RT: ['ACTIVO', 'INACTIVO', 'EN REVISIÓN'],
    TITULOS: ['COMPLETO', 'INCOMPLETO', 'EN REVISIÓN'],
    TASACION: ['COMPLETADA', 'PENDIENTE', 'EN REVISIÓN'],
    AVALUO: ['COMPLETADO', 'PENDIENTE', 'EN REVISIÓN']
  },
  
  // ✅ TRIMESTRES PARA PROYECCIÓN - SIN CAMBIOS
  TRIMESTRES: {
    Q1: [1, 2, 3],
    Q2: [4, 5, 6],
    Q3: [7, 8, 9],
    Q4: [10, 11, 12]
  },
  
  // ✅ FINANCIACIÓN (NUEVA - para futura mejora #3) - SIN CAMBIOS
  FINANCIACION_TIPOS: {
    'TRANSMILENIO': 'TM',
    'IDU': 'IDU',
    'OTROS': 'OTR'
  },

  // ✅ NUEVA SECCIÓN: CONFIGURACIÓN DE FILTRO MATRIZ
  FILTRO_MATRIZ: {
    SHEET_NAME: 'FiltroMatriz',
    COLUMNS: {
      ID: 'ID',
      NOMBRE: 'NOMBRE_FILTRO',
      DESCRIPCION: 'DESCRIPCION',
      PROYECTOS_INCLUIDOS: 'PROYECTOS_INCLUIDOS',
      PROYECTOS_EXCLUIDOS: 'PROYECTOS_EXCLUIDOS',
      ACTIVO: 'ACTIVO',
      USUARIO_CREADOR: 'USUARIO_CREADOR',
      FECHA_CREACION: 'FECHA_CREACION',
      ULTIMA_MODIFICACION: 'ULTIMA_MODIFICACION',
      TIPO: 'TIPO'
    }
  }
};

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES DE CONFIGURACIÓN - ROBUSTAS Y VALIDADAS
 * ═══════════════════════════════════════════════════════════
 */

/**
 * ✅ MEJORADO: Obtiene valor de configuración con validación completa
 * @param {string} path - Ruta de la configuración (ej: 'SHEETS.DATOS')
 * @param {*} defaultValue - Valor por defecto si no encuentra
 * @returns {*} Valor de configuración o null
 */
function getConfig(path, defaultValue = null) {
  try {
    // ✅ VALIDACIÓN 1: Verificar que path existe
    if (!path) {
      console.warn(`⚠️ getConfig: path no proporcionado, usando defaultValue`);
      return defaultValue;
    }
    
    // ✅ VALIDACIÓN 2: Verificar que path es string
    if (typeof path !== 'string') {
      console.error(`❌ getConfig: path no es string, es ${typeof path}`);
      return defaultValue;
    }
    
    // ✅ VALIDACIÓN 3: Verificar que path no está vacío
    if (path.trim() === '') {
      console.warn(`⚠️ getConfig: path está vacío`);
      return defaultValue;
    }
    
    // ✅ Dividir el path
    const keys = path.split('.');
    
    // ✅ Navegar por la configuración
    let value = CONFIG;
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      
      // Validar que value es un objeto
      if (!value || typeof value !== 'object') {
        console.warn(`⚠️ Config: ${path} - No se puede acceder a '${key}' en nivel ${i}`);
        return defaultValue;
      }
      
      // Validar que la clave existe
      if (!(key in value)) {
        console.warn(`⚠️ Config: Clave '${key}' no encontrada en ${path}`);
        return defaultValue;
      }
      
      value = value[key];
    }
    
    // ✅ Si solicitamos el archivo principal y no hay valor configurado,
    // usar el spreadsheet activo como fallback para staging y pruebas locales.
    if (path === 'DATA_FILES.PRINCIPAL' && (value === null || value === undefined || value === '')) {
      try {
        const activeId = SpreadsheetApp.getActiveSpreadsheet().getId();
        console.log(`✅ DATA_FILES.PRINCIPAL no configurado, usando hoja activa: ${activeId}`);
        return activeId;
      } catch (err) {
        console.warn('⚠️ No se pudo obtener Spreadsheet activo para DATA_FILES.PRINCIPAL: ' + err.message);
      }
    }

    // ✅ Retornar el valor encontrado
    return value;
    
  } catch (e) {
    console.error(`❌ Error en getConfig('${path}'): ${e.message}`);
    return defaultValue;
  }
}

/**
 * Obtiene configuración con valor por defecto seguro
 * @param {string} path - Ruta de la configuración
 * @param {*} defaultValue - Valor por defecto
 * @returns {*} Valor de configuración o defaultValue
 */
function getConfigOrDefault(path, defaultValue) {
  const value = getConfig(path);
  return value !== null && value !== undefined ? value : defaultValue;
}

/**
 * Obtiene lista de archivos de datos utilizando DATA_FILES_IDS o fallback de MAESTRO_PERMISOS.
 * @returns {string[]} Array de IDs de hojas de cálculo.
 */
function getDataFilesIds() {
  try {
    const ids = getConfig('DATA_FILES_IDS', []);
    if (Array.isArray(ids) && ids.length > 0) {
      return ids;
    }
    const allIds = getAllFileIds();
    if (Array.isArray(allIds) && allIds.length > 0) {
      return allIds;
    }
    const maestro = getConfig('MAESTRO_PERMISOS');
    return maestro ? [maestro] : [];
  } catch (e) {
    console.error(`Error en getDataFilesIds: ${e.message}`);
    const maestro = getConfig('MAESTRO_PERMISOS');
    return maestro ? [maestro] : [];
  }
}

/**
 * ✅ MEJORADO: Valida que la configuración sea completa y correcta
 * @returns {boolean} true si es válida, false si no
 * @throws {Error} Si hay configuración crítica faltante
 */
function validateConfig() {
  try {
    console.log('🔍 Validando configuración...');
    
    const required = [
      'DATA_FILES.PRINCIPAL',
      'SHEETS.DATOS',
      'SHEETS.PERMISOS',
      'SHEETS.LOGS',
      'COLUMNS.RT',
      'COLUMNS.PROYECTO',
      'ROLES.ADMIN',
      'ROLES.EDITOR',
      'ROLES.LECTOR',
      'FILTRO_MATRIZ.SHEET_NAME',
      'FILTRO_MATRIZ.COLUMNS.ID'
    ];
    
    const missing = [];
    const invalid = [];
    
    for (const path of required) {
      const value = getConfig(path);
      
      if (value === null || value === undefined) {
        missing.push(path);
      }
      
      if (typeof value === 'string' && value.trim() === '') {
        invalid.push(path);
      }
      
      // Validación especial para arrays
      if (path === 'DATA_FILES_IDS' && (!Array.isArray(value) || value.length === 0)) {
        invalid.push(path + ' (debe ser array con elementos)');
      }
    }
    
    // Reportar errores
    if (missing.length > 0) {
      const error = `Config incompleta: ${missing.join(', ')}`;
      console.error(`❌ ${error}`);
      throw new Error(error);
    }
    
    if (invalid.length > 0) {
      const error = `Config inválida: ${invalid.join(', ')}`;
      console.error(`❌ ${error}`);
      throw new Error(error);
    }

    const resolvedIds = getDataFilesIds();
    if (!Array.isArray(resolvedIds) || resolvedIds.length === 0) {
      const error = 'Config inválida: no se encontraron archivos de datos válidos en DATA_FILES.PRINCIPAL, DATA_FILES.SECUNDARIOS, DATA_FILES_IDS o MAESTRO_PERMISOS';
      console.error(`❌ ${error}`);
      throw new Error(error);
    }
    
    console.log('✅ Configuración válida');
    console.log(`   DATA_FILES.PRINCIPAL: ${getConfig('DATA_FILES.PRINCIPAL')}`);
    console.log(`   DATA_FILES_IDS: ${JSON.stringify(getConfig('DATA_FILES_IDS'))}`);
    
    return true;
    
  } catch (e) {
    console.error(`❌ Error validando config: ${e.message}`);
    throw e;
  }
}

/**
 * ✅ NUEVO: Función de diagnóstico completa
 */
function diagnosticarSistema() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DEL SISTEMA');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // 1. Verificar CONFIG
    console.log('\n📋 VERIFICANDO CONFIG:');
    console.log('  typeof CONFIG:', typeof CONFIG);
    console.log('  CONFIG existe:', CONFIG !== undefined);
    
    // 2. Verificar ambas estructuras de archivos
    console.log('\n📂 VERIFICANDO ARCHIVOS:');
    console.log('  DATA_FILES.PRINCIPAL:', CONFIG.DATA_FILES.PRINCIPAL);
    console.log('  DATA_FILES.SECUNDARIOS:', CONFIG.DATA_FILES.SECUNDARIOS);
    console.log('  DATA_FILES_IDS:', CONFIG.DATA_FILES_IDS);
    console.log('  MAESTRO_PERMISOS:', CONFIG.MAESTRO_PERMISOS);
    
    // 3. Validar configuración
    console.log('\n🔍 VALIDANDO CONFIGURACIÓN:');
    validateConfig();
    
    // 4. Verificar Spreadsheet
    console.log('\n📊 VERIFICANDO ARCHIVO:');
    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    if (!fileId) {
      throw new Error('DATA_FILES.PRINCIPAL no configurado y no hay hoja activa disponible');
    }
    const ss = SpreadsheetApp.openById(fileId);
    console.log(`  Nombre: ${ss.getName()}`);
    console.log(`  ID: ${ss.getId()}`);
    
    // 5. Listar hojas
    console.log('\n📋 HOJAS DISPONIBLES:');
    ss.getSheets().forEach((sheet, index) => {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      console.log(`  ${index + 1}. ${sheet.getName()} - ${lastRow} filas x ${lastCol} columnas`);
    });
    
    // 6. Verificar hoja Datos
    console.log('\n📂 VERIFICANDO HOJA "Datos":');
    const wsDatos = ss.getSheetByName('Datos');
    
    if (wsDatos) {
      const data = wsDatos.getDataRange().getValues();
      console.log(`  ✅ Hoja encontrada`);
      console.log(`  📊 Total filas: ${data.length}`);
      console.log(`  📋 Total columnas: ${data[0] ? data[0].length : 0}`);
      
      if (data.length > 0) {
        console.log(`  📝 Headers (primeros 5): ${data[0].slice(0, 5).join(', ')}`);
      }
      
      if (data.length > 1) {
        console.log(`  📄 Primera fila (primeros 3): ${data[1].slice(0, 3).join(', ')}`);
      }
    } else {
      console.error('  ❌ Hoja "Datos" NO encontrada');
      console.log('  💡 Hojas disponibles:', ss.getSheets().map(s => s.getName()).join(', '));
    }
    
    // 7. Probar getConfig con ambas estructuras
    console.log('\n🧪 PROBANDO getConfig():');
    const testPaths = [
      'DATA_FILES.PRINCIPAL',
      'DATA_FILES_IDS',
      'MAESTRO_PERMISOS',
      'SHEETS.DATOS',
      'COLUMNS.RT',
      'ROLES.EDITOR'
    ];
    
    testPaths.forEach(path => {
      const value = getConfig(path);
      console.log(`  ${path}: ${JSON.stringify(value)}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ DIAGNÓSTICO COMPLETADO');
    console.log('═══════════════════════════════════════════════════════');
    
    return {
      success: true,
      spreadsheet: ss.getName(),
      sheets: ss.getSheets().length,
      dataRows: wsDatos ? wsDatos.getLastRow() : 0
    };
    
  } catch (e) {
    console.error('\n❌ ERROR EN DIAGNÓSTICO:', e.message);
    console.error('📍 Stack:', e.stack);
    return {
      success: false,
      error: e.message,
      stack: e.stack
    };
  }
}

// ✅ MANTENER TODAS LAS FUNCIONES ORIGINALES (SIN CAMBIOS)

function getConfigInfo() {
  try {
    return {
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      sheets: Object.keys(getConfig('SHEETS')),
      columns: Object.keys(getConfig('COLUMNS')),
      roles: Object.keys(getConfig('ROLES')),
      dataFileId: getConfig('DATA_FILES.PRINCIPAL').substring(0, 15) + '...',
      isValid: validateConfig()
    };
  } catch (e) {
    console.error(`Error obteniendo info: ${e.message}`);
    return { error: e.message };
  }
}

function getAllSheets() {
  try {
    const sheets = getConfig('SHEETS');
    if (!sheets || typeof sheets !== 'object') {
      console.warn('⚠️ SHEETS no es un objeto válido');
      return [];
    }
    return Object.values(sheets);
  } catch (e) {
    console.error(`Error obteniendo hojas: ${e.message}`);
    return [];
  }
}

function getAllColumns() {
  try {
    const columns = getConfig('COLUMNS');
    if (!columns || typeof columns !== 'object') {
      console.warn('⚠️ COLUMNS no es un objeto válido');
      return [];
    }
    return Object.values(columns);
  } catch (e) {
    console.error(`Error obteniendo columnas: ${e.message}`);
    return [];
  }
}

function getAllRoles() {
  try {
    const roles = getConfig('ROLES');
    if (!roles || typeof roles !== 'object') {
      console.warn('⚠️ ROLES no es un objeto válido');
      return [];
    }
    return Object.values(roles);
  } catch (e) {
    console.error(`Error obteniendo roles: ${e.message}`);
    return [];
  }
}

function roleExists(rol) {
  try {
    if (!rol) return false;
    const roles = getAllRoles();
    return roles.includes(rol);
  } catch (e) {
    console.error(`Error verificando rol: ${e.message}`);
    return false;
  }
}

function getPermisosForRole(rol) {
  try {
    if (!rol) {
      console.warn('⚠️ Rol no especificado');
      return [];
    }
    
    const permisos = getConfig(`PERMISOS_POR_ROL.${rol}`);
    
    if (!permisos) {
      console.warn(`⚠️ Rol '${rol}' no tiene permisos configurados`);
      return [];
    }
    
    if (!Array.isArray(permisos)) {
      console.warn(`⚠️ Permisos para '${rol}' no es un array`);
      return [];
    }
    
    return permisos;
  } catch (e) {
    console.error(`Error obteniendo permisos: ${e.message}`);
    return [];
  }
}

function hasPermission(rol, permiso) {
  try {
    if (!rol || !permiso) {
      console.warn('⚠️ Rol o permiso no especificado');
      return false;
    }
    
    const permisos = getPermisosForRole(rol);
    return permisos.includes(permiso);
  } catch (e) {
    console.error(`Error verificando permiso: ${e.message}`);
    return false;
  }
}

function getEstadosPermitidos(categoria) {
  try {
    if (!categoria) {
      console.warn('⚠️ Categoría no especificada');
      return [];
    }
    
    const estados = getConfig(`ESTADOS_PERMITIDOS.${categoria}`);
    
    if (!estados) {
      console.warn(`⚠️ Categoría '${categoria}' no tiene estados configurados`);
      return [];
    }
    
    if (!Array.isArray(estados)) {
      console.warn(`⚠️ Estados para '${categoria}' no es un array`);
      return [];
    }
    
    return estados;
  } catch (e) {
    console.error(`Error obteniendo estados: ${e.message}`);
    return [];
  }
}

function isEstadoValido(categoria, estado) {
  try {
    if (!categoria || !estado) {
      console.warn('⚠️ Categoría o estado no especificado');
      return false;
    }
    
    const estados = getEstadosPermitidos(categoria);
    return estados.includes(estado);
  } catch (e) {
    console.error(`Error verificando estado: ${e.message}`);
    return false;
  }
}

function getSheetName(key) {
  try {
    if (!key) {
      console.warn('⚠️ Clave de hoja no especificada');
      return null;
    }
    
    return getConfig(`SHEETS.${key}`);
  } catch (e) {
    console.error(`Error obteniendo nombre de hoja: ${e.message}`);
    return null;
  }
}

function getColumnName(key) {
  try {
    if (!key) {
      console.warn('⚠️ Clave de columna no especificada');
      return null;
    }
    
    return getConfig(`COLUMNS.${key}`);
  } catch (e) {
    console.error(`Error obteniendo nombre de columna: ${e.message}`);
    return null;
  }
}

function getRoleName(key) {
  try {
    if (!key) {
      console.warn('⚠️ Clave de rol no especificada');
      return null;
    }
    
    return getConfig(`ROLES.${key}`);
  } catch (e) {
    console.error(`Error obteniendo nombre de rol: ${e.message}`);
    return null;
  }
}

function getPrincipalFileId() {
  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    
    if (!fileId) {
      throw new Error('DATA_FILES.PRINCIPAL no configurado');
    }
    
    return fileId;
  } catch (e) {
    console.error(`Error obteniendo archivo principal: ${e.message}`);
    return null;
  }
}

function getStagingFileId() {
  try {
    const fileId = getConfig('DATA_FILES.STAGING');
    return fileId || null;
  } catch (e) {
    console.error(`Error obteniendo archivo staging: ${e.message}`);
    return null;
  }
}

function getSecondaryFileIds() {
  try {
    const fileIds = getConfig('DATA_FILES.SECUNDARIOS');
    
    if (!Array.isArray(fileIds)) {
      console.warn('⚠️ SECUNDARIOS no es un array');
      return [];
    }
    
    return fileIds;
  } catch (e) {
    console.error(`Error obteniendo archivos secundarios: ${e.message}`);
    return [];
  }
}

/**
 * ✅ MEJORADO: Obtiene todos los IDs de archivos (compatible con ambas estructuras)
 */
function getAllFileIds() {
  try {
    // Método 1: Usar DATA_FILES_IDS si existe
    const dataFilesIds = getConfig('DATA_FILES_IDS');
    if (dataFilesIds && Array.isArray(dataFilesIds) && dataFilesIds.length > 0) {
      console.log('✅ Usando DATA_FILES_IDS');
      return dataFilesIds;
    }
    
    // Método 2: Construir desde DATA_FILES
    const principal = getPrincipalFileId();
    const secundarios = getSecondaryFileIds();
    
    if (!principal) {
      console.warn('⚠️ No hay archivo principal configurado');
      return secundarios;
    }
    
    console.log('✅ Usando DATA_FILES.PRINCIPAL + SECUNDARIOS');
    return [principal, ...secundarios];
    
  } catch (e) {
    console.error(`Error obteniendo todos los archivos: ${e.message}`);
    return [];
  }
}

function getFormatConfig() {
  try {
    return getConfig('FORMATS') || {
      FECHA_ISO: 'YYYY-MM-DD',
      MONEDA: 'COP',
      LOCALE: 'es-CO'
    };
  } catch (e) {
    console.error(`Error obteniendo formato: ${e.message}`);
    return {
      FECHA_ISO: 'YYYY-MM-DD',
      MONEDA: 'COP',
      LOCALE: 'es-CO'
    };
  }
}

function printConfig() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 CONFIGURACIÓN COMPLETA DEL SISTEMA');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    console.log('📁 ARCHIVOS DE DATOS:');
    console.log('  Principal:', getPrincipalFileId());
    console.log('  Secundarios:', getSecondaryFileIds());
    console.log('  DATA_FILES_IDS:', getConfig('DATA_FILES_IDS'));
    console.log('');
    
    console.log('📊 HOJAS DE CÁLCULO:');
    Object.entries(getConfig('SHEETS')).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('');
    
    console.log('📋 COLUMNAS PRINCIPALES:');
    Object.entries(getConfig('COLUMNS')).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('');
    
    console.log('👥 ROLES:');
    Object.entries(getConfig('ROLES')).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('');
    
    console.log('🔐 PERMISOS POR ROL:');
    Object.entries(getConfig('PERMISOS_POR_ROL')).forEach(([rol, permisos]) => {
      console.log(`  ${rol}: ${permisos.join(', ')}`);
    });
    console.log('');
    
    console.log('✅ Estados permitidos:');
    Object.entries(getConfig('ESTADOS_PERMITIDOS')).forEach(([cat, estados]) => {
      console.log(`  ${cat}: ${estados.join(', ')}`);
    });
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (e) {
    console.error(`Error imprimiendo config: ${e.message}`);
  }
}

function testConfig() {
  console.log('🧪 Iniciando pruebas de configuración...\n');
  
  try {
    // Test 1: Obtener valor simple
    console.log('✅ Test 1: Obtener SHEETS.DATOS');
    const sheetDatos = getConfig('SHEETS.DATOS');
    console.log(`   Resultado: ${sheetDatos}\n`);
    
    // Test 2: Obtener con valor por defecto
    console.log('✅ Test 2: Obtener valor inexistente con default');
    const inexistente = getConfig('INEXISTENTE.VALOR', 'default-value');
    console.log(`   Resultado: ${inexistente}\n`);
    
    // Test 3: Validar configuración
    console.log('✅ Test 3: Validar configuración');
    validateConfig();
    console.log('   Configuración válida!\n');
    
    // Test 4: Verificar permisos
    console.log('✅ Test 4: Verificar permisos de Editor');
    const tieneEditar = hasPermission('Editor', 'EDITAR');
    console.log(`   ¿Editor puede EDITAR? ${tieneEditar}\n`);
    
    // Test 5: Estados permitidos
    console.log('✅ Test 5: Obtener estados de DISPONIBILIDAD');
    const estados = getEstadosPermitidos('DISPONIBILIDAD');
    console.log(`   Estados: ${estados.join(', ')}\n`);
    
    // Test 6: NUEVO - Verificar compatibilidad de archivos
    console.log('✅ Test 6: Verificar compatibilidad de IDs de archivos');
    const allIds = getAllFileIds();
    console.log(`   IDs encontrados: ${JSON.stringify(allIds)}\n`);
    
    console.log('🎉 TODOS LOS TESTS PASARON!\n');
    
  } catch (e) {
    console.error(`❌ Error en tests: ${e.message}`);
  }
}

/**
 * Ejecuta el diagnóstico y lo guarda en la hoja `DIAGNOSTICO` (staging)
 * Útil para ejecutar desde staging sin revisar logs manualmente
 */
function staging_diagnosticar() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const resultado = diagnosticarSistema();

    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    const ss = SpreadsheetApp.openById(fileId);
    let sheet = ss.getSheetByName('DIAGNOSTICO');
    if (!sheet) {
      sheet = ss.insertSheet('DIAGNOSTICO');
      sheet.appendRow(['TIMESTAMP', 'SUCCESS', 'SUMMARY', 'DETAILS']);
    }

    const summary = resultado.success ? 'OK' : 'ERROR';
    const details = JSON.stringify(resultado);
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, 4).setValues([[new Date(), summary, resultado.spreadsheet || '', details]]);

    return { success: true, message: 'Diagnóstico ejecutado y guardado en DIAGNOSTICO' };
  } catch (e) {
    console.error(`Error en staging_diagnosticar: ${e.message}`);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}
