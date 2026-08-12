/**
 * ═══════════════════════════════════════════════════════════
 * CÓDIGO PRINCIPAL - ORQUESTADOR INTEGRADO V3.0
 * Integra funcionalidad de matriz + seguimiento + PDF
 * ═══════════════════════════════════════════════════════════
 */


// ══════════════════════════════════════════════════════════
// ✅ FUNCIÓN CRÍTICA: INCLUDE PARA PLANTILLAS HTML
// DEBE SER LA PRIMERA FUNCIÓN — SIN ELLA LA APP NO CARGA
// ══════════════════════════════════════════════════════════
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    console.error(`❌ include() falló para '${filename}': ${e.message}`);
    // Retorna HTML de error visible en la página para identificar el archivo faltante
    return `<!-- ERROR: No se pudo incluir '${filename}': ${e.message} -->
            <div style="background:#c0392b;color:#fff;padding:10px;font-family:sans-serif;">
              ❌ Archivo faltante: <strong>${filename}.html</strong>
            </div>`;
  }
}

// ══════════════════════════════════════════════════════════
// ✅ FUNCIÓN: parseDateRobust (requerida por verificacion.gs)
// ══════════════════════════════════════════════════════════
function parseDateRobust(value) {
  try {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) return value;
    const str = String(value).trim();
    if (!str || str === 'null' || str === 'undefined') return null;
    // Formato DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return new Date(+dmy[3], +dmy[2]-1, +dmy[1]);
    // Formato YYYY-MM-DD
    const iso = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (iso) return new Date(+iso[1], +iso[2]-1, +iso[3]);
    const d = new Date(value);
    return isNaN(d) ? null : d;
  } catch (e) {
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// ✅ FUNCIÓN: saveFollowupData (llamada desde el HTML del PAC)
// ══════════════════════════════════════════════════════════
function saveFollowupData(dataJson) {
  try {
    const userEmail = Session.getActiveUser().getEmail();

    // ✅ SEC-P1: validación de autorización server-side (no confiar solo en la UI)
    const gestorPermisos = new GestorPermisos();
    const rolUsuario = gestorPermisos.obtenerRol(userEmail);
    const rolesAutorizados = [getConfig('ROLES.EDITOR'), getConfig('ROLES.ADMIN')];
    if (!rolUsuario || rolesAutorizados.indexOf(rolUsuario) === -1) {
      console.warn(`⚠️ Acceso denegado a saveFollowupData para ${userEmail} (rol: ${rolUsuario || 'ninguno'})`);
      return { success: false, error: 'No tiene permisos para registrar seguimiento. Se requiere rol Editor o Administrador.' };
    }

    const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
    const formObject = {
      rt:             data['RT']            || data['rt']            || '',
      estadoPredial:  data['ESTADO PREDIAL']|| data['estadoPredial'] || '',
      estadoAjustado: data['ESTADO PREDIAL AJUSTADO'] || data['estadoAjustado'] || '',
      disp:           data['PREDIOS DISPONIBLES (INCLUYE CESIONES)'] || data['disp'] || '',
      estadoRt:       data['ESTADO RT']     || data['estadoRt']      || '',
      estadoTitulos:  data['ESTADO ESTUDIO DE TITULOS'] || data['estadoTitulos'] || '',
      estadoTasacion: data['ESTADO TASACIÓN']|| data['estadoTasacion']|| '',
      estadoAvaluo:   data['ESTADO AVALUO'] || data['estadoAvaluo']  || '',
      fechaAvaluo:    data['FECHA AVALUO']  || data['fechaAvaluo']   || '',
      situaciones:    data['SITUACIONES ESPECIALES'] || data['situaciones'] || '',
      observaciones:  data['OBSERVACIONES'] || data['observaciones'] || ''
    };
    if (!formObject.rt) return { success: false, error: 'RT es requerido' };
    const result = saveTrackingData(formObject, userEmail);
    return { success: result.status === 'success', message: result.message, error: result.status !== 'success' ? result.message : null };
  } catch (e) {
    console.error('Error en saveFollowupData: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ✅ PUNTO DE ENTRADA - CON VALIDACIÓN DE CONFIG
function doGet(e) {
  try {
    // 0️⃣ NUEVO: VERIFICAR MODO MANTENIMIENTO DINÁMICO
    const enMantenimiento = PropertiesService.getScriptProperties().getProperty('MODO_MANTENIMIENTO') === 'true';

    if (enMantenimiento || (CONFIG.MANTENIMIENTO && CONFIG.MANTENIMIENTO.ACTIVO)) {
      const htmlMantenimiento = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sistema en Mantenimiento</title>
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
          <style>
            body { background-color: #ecf0f1; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #333; }
            .maint-container { background: white; padding: 50px 40px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; max-width: 550px; border-top: 5px solid #f39c12; width: 90%; }
            h1 { color: #2c3e50; font-weight: 800; margin-top: 20px; font-size: 2rem; }
            p { color: #555; font-size: 1.05rem; line-height: 1.6; margin-bottom: 25px; }
            .contact { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; text-align: left; }
            .contact strong { color: #2c3e50; display: block; margin-bottom: 8px; }
            .contact a { color: #3498db; text-decoration: none; font-weight: bold; word-break: break-all; }
            .contact a:hover { text-decoration: underline; }
            .icon-spin { animation: spin 4s linear infinite; color: #f39c12; font-size: 4rem; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="maint-container">
            <i class="fas fa-cog icon-spin"></i>
            <h1>Actualización en Curso</h1>
            <p>${CONFIG.MANTENIMIENTO.MENSAJE}</p>
            <div class="contact">
              <strong><i class="fas fa-headset"></i> ¿Requieres información urgente?</strong>
              Comunícate con nuestro equipo técnico:<br>
              <a href="mailto:fabian.montanez@idu.gov.co">fabian.montanez@idu.gov.co</a><br>
              <a href="mailto:sistemasdtdp@idu.gov.co">sistemasdtdp@idu.gov.co</a>
            </div>
          </div>
        </body>
        </html>
      `;
      return HtmlService.createHtmlOutput(htmlMantenimiento)
        .setTitle('Sistema en Mantenimiento')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

     // 1️⃣ VALIDAR CONFIGURACIÓN PRIMERO
    try {
      validateConfig();
      console.log('✅ Configuración validada en doGet');
    } catch (configError) {
      console.error(`❌ Error de configuración: ${configError.message}`);
      return HtmlService.createHtmlOutput(`
        <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
          <h2 style="color:#c0392b">⚠️ Error de Configuración</h2>
          <p>El sistema no está correctamente configurado.</p>
          <p><strong>Error:</strong> ${configError.message}</p>
          <p>Contacta al administrador.</p>
        </div>
      `);
    }

    // 2️⃣ OBTENER USUARIO
    // ✅ CONC-FE-05-hotfix: fallback defensivo — getEmail() ya devuelve string
    // por contrato de la API (nunca null/undefined), pero el || '' deja el
    // invariante explícito para quien lea/toque este valor más adelante.
    const userEmail = Session.getActiveUser().getEmail() || '';
    console.log(`👤 Usuario: ${userEmail}`);

    // 3️⃣ OBTENER ROL (CON MANEJO DE ERRORES)
    let role = null;
    try {
      const gestorPermisos = new GestorPermisos();
      role = gestorPermisos.obtenerRol(userEmail);
      console.log(`👥 Rol: ${role}`);
    } catch (permError) {
      console.warn(`⚠️ Error obteniendo rol: ${permError.message}`);
      role = getConfig('ROLES.LECTOR');
    }

    // 4️⃣ VALIDAR ACCESO
    if (!role) {
      return HtmlService.createHtmlOutput(`
        <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
          <h2 style="color:#c0392b">⛔ Acceso Denegado</h2>
          <p>El usuario <b>${userEmail}</b> no tiene permisos registrados.</p>
          <p>Contacta al administrador.</p>
        </div>
      `);
    }

    // 5️⃣ REGISTRAR INGRESO
    try {
      const auditoria = new GestorAuditoria();
      auditoria.registrarAccion(userEmail, 'Ingreso al Tablero', `Rol: ${role}`);
      console.log('✅ Ingreso registrado en auditoría');
    } catch (auditError) {
      console.warn(`⚠️ Error registrando ingreso: ${auditError.message}`);
    }

    // 6️⃣ CARGAR PLANTILLA
    try {
      const template = HtmlService.createTemplateFromFile('Index');
      template.currentUser = userEmail;
      template.currentRole = role;
      // ✅ CONC-FE-05-hotfix3: modo seguro GAS. Generamos un literal JS válido
      // en el backend para evitar que el motor de plantillas falle al evaluar
      // expresiones complejas dentro de <?!= ... ?>.
      template.userEmail = userEmail;
      template.safeUserEmailJS = JSON.stringify(userEmail || '');

      return template.evaluate()
        .setTitle('Tablero de Gestión Predial - Enterprise Modular')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    } catch (templateError) {
      console.error(`❌ Error cargando plantilla: ${templateError.message}`);
      return HtmlService.createHtmlOutput(`
        <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
          <h2 style="color:#c0392b">❌ Error al cargar la interfaz</h2>
          <p>${templateError.message}</p>
        </div>
      `);
    }

  } catch (e) {
    console.error(`❌ Error crítico en doGet: ${e.message}`);
    console.error(`📍 Stack: ${e.stack}`);
    return HtmlService.createHtmlOutput(`
      <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
        <h2 style="color:#c0392b">❌ Error al cargar</h2>
        <p>${e.message}</p>
        <p style="font-size: 0.8rem; color: #999;">Revisa los logs de ejecución</p>
      </div>
    `);
  }
}

/**
 * ✅ OBTIENE TIMELINE DE SEGUIMIENTO POR RT CON FILTROS CRONOLÓGICOS
 */
function getRtFollowupTimeline(rt, filterType = 'ALL') {
  try {
    console.log(`📅 Obteniendo timeline para RT: ${rt}, Filtro: ${filterType}`);
    
    const timeline = [];
    const today = new Date();
    let startDate = null;
    
    // Determinar rango de fechas según filtro
    switch(filterType) {
      case 'LAST_MONTH':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        break;
      case 'LAST_3_MONTHS':
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
        break;
      case 'LAST_6_MONTHS':
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
        break;
      case 'LAST_YEAR':
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        break;
      case 'ALL':
      default:
        startDate = new Date(2000, 0, 1);
    }
    
    const dataFilesIds = getDataFilesIds();
    
    dataFilesIds.forEach(id => {
      try {
        const ss = SpreadsheetApp.openById(id);
        let wsSeg = ss.getSheetByName(getConfig('SHEETS.SEGUIMIENTO'));
        
        if (!wsSeg) return;
        
        const data = wsSeg.getDataRange().getValues();
        const headers = data[0].map(h => h.toString().toUpperCase().trim());
        
        const rtIdx = headers.findIndex(h => h.includes("RT"));
        const fechaIdx = headers.findIndex(h => h.includes("FECHA"));
        const obsIdx = headers.findIndex(h => h.includes("OBSERVACIONES"));
        const estadoIdx = headers.findIndex(h => h.includes("ESTADO") && !h.includes("AJUSTADO"));
        const dispIdx = headers.findIndex(h => h.includes("DISPONIBILIDAD"));
        
        if (rtIdx === -1) return;
        
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][rtIdx]).trim() === String(rt).trim()) {
            // Parsear fecha
            let fechaObj = null;
            if (fechaIdx > -1 && data[i][fechaIdx]) {
              fechaObj = new Date(data[i][fechaIdx]);
            }
            
            // Filtrar por rango de fechas
            if (fechaObj && fechaObj >= startDate && fechaObj <= today) {
              timeline.push({
                fecha: fechaObj.toISOString().split('T')[0],
                fechaCompleta: fechaObj.toLocaleString('es-CO'),
                estado: estadoIdx > -1 ? data[i][estadoIdx] : '-',
                disponibilidad: dispIdx > -1 ? data[i][dispIdx] : '-',
                observaciones: obsIdx > -1 ? cleanTextUpper(data[i][obsIdx]) : '-',
                usuario: data[i][headers.findIndex(h => h.includes("USUARIO"))] || '-'
              });
            }
          }
        }
      } catch(e) {
        console.error("Error leyendo seguimiento: " + e.message);
      }
    });
    
    // Ordenar cronológicamente (más reciente primero)
    timeline.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    console.log(`✅ Timeline generado: ${timeline.length} registros`);
    
    return JSON.stringify({
      rt: rt,
      filterType: filterType,
      totalRecords: timeline.length,
      timeline: timeline
    });
    
  } catch (e) {
    console.error(`Error en getRtFollowupTimeline: ${e.message}`);
    return JSON.stringify({
      error: e.message,
      timeline: []
    });
  }
}

/**
 * ✅ OBTIENE DATOS DEL DASHBOARD + SEGUIMIENTO (VERSIÓN COMPATIBLE V3)
 */
/**
 * ✅ OBTIENE DATOS DEL DASHBOARD (FILTRADOS DESDE EL SERVIDOR PARA TODOS)
 */
function getDashboardData() {
  try {
    console.log('🔍 Iniciando getDashboardData...');
    console.time('dashboard:total');

    const enMantenimiento = PropertiesService.getScriptProperties().getProperty('MODO_MANTENIMIENTO') === 'true';
    if (enMantenimiento) {
      console.log('⛔ Petición bloqueada: Sistema en mantenimiento');
      console.timeEnd('dashboard:total');
      return { success: false, mantenimiento: true, message: "Sistema en mantenimiento" };
    }

    const cache = CacheService.getScriptCache();
    console.time('dashboard:cacheRead');
    const cached = getDashboardCachePayload(cache);
    console.timeEnd('dashboard:cacheRead');
    if (cached) {
      try {
        const cachedResponse = JSON.parse(cached);
        cachedResponse.user = Session.getActiveUser().getEmail();
        console.timeEnd('dashboard:total');
        return cachedResponse;
      } catch (e) {
        console.warn('⚠️ Caché de dashboard corrupto, recalculando: ' + e.message);
      }
    }

    const allRecords = [];
    const allProyectosSet = new Set();
    let headers = [];
    let headersFound = false;
    const seguimientoRecords = [];

    const dataFilesIds = getDataFilesIds();

    let filtroActivo = null;
    try {
      const gestorFiltro = new GestorFiltroMatriz();
      filtroActivo = gestorFiltro.obtenerFiltroActivo();
    } catch (e) {}

    let proyectosVisibles = { todos: true, proyectos: [], excluidos: [] };
    if (filtroActivo) {
      if (filtroActivo.proyectosIncluidos && filtroActivo.proyectosIncluidos.length > 0) {
        proyectosVisibles = { todos: false, proyectos: filtroActivo.proyectosIncluidos, excluidos: [] };
      } else if (filtroActivo.proyectosExcluidos && filtroActivo.proyectosExcluidos.length > 0) {
        proyectosVisibles = { todos: false, proyectos: [], excluidos: filtroActivo.proyectosExcluidos };
      }
    }

    console.time('dashboard:sheetRead');
    dataFilesIds.forEach((id) => {
      try {
        const ss = SpreadsheetApp.openById(id);
        const ws = ss.getSheetByName(getConfig('SHEETS.DATOS', 'Datos'));
        if (!ws) return;

        const lastRow = ws.getLastRow();
        const lastCol = ws.getLastColumn();
        if (lastRow < 2 || lastCol < 1) return;

        const data = ws.getRange(1, 1, lastRow, lastCol).getDisplayValues();
        const usableRows = data.filter(row => row && row.some(cell => String(cell || '').trim() !== ''));
        if (usableRows.length <= 1) return;

        if (!headersFound) {
          headers = usableRows[0].map(h => String(h || '').toUpperCase().trim());
          headersFound = true;
        }

        const proyectoIndex = headers.findIndex(h => h.includes('PROYECTO'));

        for (let i = 1; i < usableRows.length; i++) {
          const row = usableRows[i];
          const proyecto = String(row[proyectoIndex] || '').trim();

          if (proyecto) {
            allProyectosSet.add(proyecto);
          }

          let incluirRegistro = true;
          if (!proyectosVisibles.todos) {
            if (proyectosVisibles.proyectos.length > 0) {
              incluirRegistro = proyectosVisibles.proyectos.includes(proyecto);
            } else if (proyectosVisibles.excluidos.length > 0) {
              incluirRegistro = !proyectosVisibles.excluidos.includes(proyecto);
            }
          }

          if (!incluirRegistro) continue;

          const rowObject = { _FILE_ID: id };
          for (let j = 0; j < headers.length; j++) {
            const cellVal = row[j];
            const colName = headers[j];
            if (colName.includes('VALOR') || colName.includes('PAGADO') || colName.includes('ESTIMADO') || colName.includes('SALDO')) {
              rowObject[colName] = parseMoneyRobust(cellVal);
            } else {
              rowObject[colName] = cellVal || '';
            }
          }
          allRecords.push(rowObject);
        }

        const wsSeg = ss.getSheetByName(getConfig('SHEETS.SEGUIMIENTO', 'Seguimiento'));
        if (wsSeg) {
          const segLastRow = wsSeg.getLastRow();
          const segLastCol = wsSeg.getLastColumn();
          if (segLastRow > 1 && segLastCol > 0) {
            const segData = wsSeg.getRange(1, 1, segLastRow, segLastCol).getDisplayValues();
            const segUsableRows = segData.filter(row => row && row.some(cell => String(cell || '').trim() !== ''));
            if (segUsableRows.length > 1) {
              const segHeaders = segUsableRows[0].map(h => String(h || '').toUpperCase().trim());
              for (let i = 1; i < segUsableRows.length; i++) {
                const segRow = {};
                for (let j = 0; j < segHeaders.length; j++) segRow[segHeaders[j]] = segUsableRows[i][j] || '';
                if (segRow['RT']) seguimientoRecords.push(segRow);
              }
            }
          }
        }
      } catch (e) {
        console.error(`❌ Error archivo ${id}:`, e.message);
      }
    });
    console.timeEnd('dashboard:sheetRead');

    const alertasResumen = evaluarAlertasDataset(allRecords);

    console.time('dashboard:serialize');
    const cacheableResponse = {
      success: true,
      records: JSON.stringify(allRecords),
      columns: JSON.stringify(headers),
      seguimiento: JSON.stringify(seguimientoRecords),
      allProyectos: JSON.stringify(Array.from(allProyectosSet).sort()),
      filtroMatrizActivo: JSON.stringify(filtroActivo || {}),
      alertasResumen: JSON.stringify(alertasResumen)
    };

    try {
      const serializedResponse = JSON.stringify(cacheableResponse);
      const writeInfo = putDashboardCachePayload(cache, serializedResponse, 1800);
      console.log('✅ Cache dashboard actualizado: ' + writeInfo.payloadSize + ' chars en ' + writeInfo.chunkCount + ' chunk(s)');
    } catch (e) {
      console.warn('⚠️ No se pudo cachear getDashboardData (posible overflow 100KB de CacheService): ' + e.message);
    }
    console.timeEnd('dashboard:serialize');

    cacheableResponse.user = Session.getActiveUser().getEmail();
    console.timeEnd('dashboard:total');
    return cacheableResponse;
  } catch (e) {
    console.error('❌ Error crítico en getDashboardData:', e.message);
    console.timeEnd('dashboard:total');
    return {
      success: false,
      message: e.message,
      records: '[]',
      columns: '[]',
      seguimiento: '[]',
      allProyectos: '[]',
      alertasResumen: JSON.stringify({
        success: false,
        totalAlertas: 0,
        severidades: { CRITICA: 0, ALERTA: 0, ADVERTENCIA: 0, INFO: 0 },
        proyectosImpactados: 0,
        rtImpactados: 0,
        alertas: [],
        error: e.message
      })
    };
  }
}

/**
 * ✅ GUARDA Y ACTIVA EL FILTRO RÁPIDO PARA TODOS LOS USUARIOS
 */
function guardarYActivarFiltroManual(proyectosIncluidos, usuario) {
  try {
    const gestor = new GestorFiltroMatriz();
    const todos = gestor.obtenerTodos();
    
    // Buscar si ya existe el registro del filtro rápido
    let filtroAdhoc = todos.find(f => f.nombre === 'FILTRO MANUAL VISTA RÁPIDA');
    
    if (filtroAdhoc) {
        // Actualizar y activar
        gestor.actualizarFiltro(filtroAdhoc.id, 'FILTRO MANUAL VISTA RÁPIDA', 'Filtro rápido temporal aplicado por el administrador', proyectosIncluidos, [], usuario);
        return gestor.activarFiltro(filtroAdhoc.id, usuario);
    } else {
        // Crear y activar
        const res = gestor.crearFiltro('FILTRO MANUAL VISTA RÁPIDA', 'Filtro rápido temporal aplicado por el administrador', proyectosIncluidos, [], usuario);
        if (res.success) {
            return gestor.activarFiltro(res.id, usuario);
        }
        return res;
    }
  } catch(e) {
    return { success: false, error: e.message };
  }
}


/**
 * ✅ PARSING ROBUSTO DE NÚMEROS (INTEGRADO DEL CÓDIGO 1)
 */
function parseMoneyRobust(cellValue) {
  if (!cellValue) return 0;
  
  let str = String(cellValue).trim();
  
  if (!isNaN(str) && str !== '') return parseFloat(str);
  
  str = str.replace(/[^\d.,]/g, '');
  if (!str) return 0;
  
  const lastCommaPos = str.lastIndexOf(',');
  const lastDotPos = str.lastIndexOf('.');
  
  let normalized = str;
  
  if (lastCommaPos > lastDotPos) {
    normalized = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDotPos > lastCommaPos) {
    normalized = str.replace(/,/g, '');
  } else if (lastCommaPos === -1 && lastDotPos === -1) {
    normalized = str;
  } else if (lastCommaPos >= 0 && lastDotPos === -1) {
    normalized = str.replace(/,/g, '');
  }
  
  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : result;
}

/**
 * ✅ OBTIENE LISTAS DESPLEGABLES UNIFICADAS (V1 + V2)
 */
function getDropdownLists() {
  try {
    let uniqueLists = {
      estadoPredial: new Set(), 
      estadoAjustado: new Set(), 
      disp: new Set(),
      estadoRt: new Set(), 
      estadoTitulos: new Set(), 
      estadoTasacion: new Set(),
      estadoAvaluo: new Set(), 
      situaciones: new Set()
    };

    const dataFilesIds = getDataFilesIds();
    
    dataFilesIds.forEach(id => {
      try {
        const ss = SpreadsheetApp.openById(id);
        const ws = ss.getSheetByName(getConfig('SHEETS.DATOS'));
        if(!ws) return;
        
        const data = ws.getDataRange().getValues();
        if(data.length < 2) return;
        const headers = data[0].map(h => h.toString().toUpperCase().trim());
        
        const addUnique = (keywords, setObj) => {
          if (typeof keywords === 'string') keywords = [keywords];
          const idx = headers.findIndex(h => 
            keywords.some(k => h.includes(k))
          );
          if (idx > -1) {
            data.slice(1).forEach(r => { 
              if(r[idx]) setObj.add(String(r[idx]).trim()); 
            });
          }
        };

        addUnique(["ESTADO PREDIAL"], uniqueLists.estadoPredial);
        addUnique(["AJUSTADO"], uniqueLists.estadoAjustado);
        addUnique(["DISPONIBLE"], uniqueLists.disp);
        addUnique(["ESTADO RT"], uniqueLists.estadoRt);
        addUnique(["TITULOS"], uniqueLists.estadoTitulos);
        addUnique(["TASACI"], uniqueLists.estadoTasacion);
        addUnique(["ESTADO AVALUO"], uniqueLists.estadoAvaluo);
        addUnique(["SITUACION"], uniqueLists.situaciones);
        
      } catch(e) {
        console.error(`Error procesando listas: ${e.message}`);
      }
    });

    return JSON.stringify({
      estadoPredial: [...uniqueLists.estadoPredial].sort(),
      estadoAjustado: [...uniqueLists.estadoAjustado].sort(),
      disp: [...uniqueLists.disp].sort(),
      estadoRt: [...uniqueLists.estadoRt].sort(),
      estadoTitulos: [...uniqueLists.estadoTitulos].sort(),
      estadoTasacion: [...uniqueLists.estadoTasacion].sort(),
      estadoAvaluo: [...uniqueLists.estadoAvaluo].sort(),
      situaciones: [...uniqueLists.situaciones].sort()
    });
  } catch (e) {
    console.error(`Error en getDropdownLists: ${e.message}`);
    return JSON.stringify({});
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES DE SEGUIMIENTO (V2 - ORQUESTADAS + V1)
 * ═══════════════════════════════════════════════════════════
 */

/**
 * ✅ GUARDA SEGUIMIENTO MANTENIENDO ESTRUCTURA ORIGINAL (INTEGRADO)
 */
function saveTrackingData(formObject, userEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const timestamp = new Date();
    let targetFileId = null;
    let targetRowIndex = -1;

    const dataFilesIds = getDataFilesIds();

    // 1. BUSCAR RT EN LAS BASES (lectura)
    for (const id of dataFilesIds) {
      try {
        const ss = SpreadsheetApp.openById(id);
        const ws = ss.getSheetByName(getConfig('SHEETS.DATOS'));
        if(!ws) continue;

        const data = ws.getDataRange().getValues();
        if (!data || data.length < 2) continue;
        const headers = data[0].map(h => String(h).toUpperCase().trim());
        const rtIndex = headers.indexOf('RT');
        if (rtIndex === -1) continue;

        for (let i = 1; i < data.length; i++) {
          if (String(data[i][rtIndex]).trim() === String(formObject.rt).trim()) {
            targetFileId = id;
            targetRowIndex = i + 1;
            break;
          }
        }
        if (targetFileId) break;
      } catch (err) {
        console.error('Error buscando RT en archivo ' + id + ': ' + err.message);
      }
    }

    if (!targetFileId || targetRowIndex === -1) {
      throw new Error(`El RT ${formObject.rt} no fue encontrado en las bases conectadas.`);
    }

    // PRINCIPAL (matriz bajo nuestro control)
    const principalId = getConfig('DATA_FILES.PRINCIPAL');
    const gestorPrincipal = new GestorDatos(principalId);

    // Asegurar hoja Seguimiento en la matriz principal
    let wsSegPrincipal = gestorPrincipal.getSheet(getConfig('SHEETS.SEGUIMIENTO'));
    if (!wsSegPrincipal) {
      // crear hoja si no existe (GestorDatos.getSheet lanzará si no existe)
      try {
        gestorPrincipal.ss.insertSheet(getConfig('SHEETS.SEGUIMIENTO'));
        wsSegPrincipal = gestorPrincipal.getSheet(getConfig('SHEETS.SEGUIMIENTO'));
        wsSegPrincipal.appendRow([
          'FECHA_REGISTRO','RT','ESTADO_PREDIAL','ESTADO_AJUSTADO',
          'DISPONIBILIDAD','ESTADO_RT','TITULOS','TASACION','AVALUO',
          'FECHA_AVALUO','SITUACIONES','OBSERVACIONES','USUARIO',
          'CAMBIOS_DETECTADOS','ORIGEN_FILEID'
        ]);
      } catch (e) {
        // si falla por permisos u otro motivo, continuar y loggear
        console.error('No se pudo crear hoja SEGUIMIENTO en matriz principal: ' + e.message);
      }
    }

    // Obtener wsDatos del archivo donde se encontró el RT (solo para lectura)
    const foundSS = SpreadsheetApp.openById(targetFileId);
    const wsDatosFound = foundSS.getSheetByName(getConfig('SHEETS.DATOS'));

    // 2. GUARDAR EN HISTÓRICO (AUDITORÍA) y en hoja Seguimiento PRINCIPAL (siempre)
    const cambios = detectarCambios(formObject, wsDatosFound, targetRowIndex);

    const rowDataHistory = [
      timestamp,
      formObject.rt,
      formObject.estadoPredial,
      formObject.estadoAjustado,
      formObject.disp,
      formObject.estadoRt,
      formObject.estadoTitulos,
      formObject.estadoTasacion,
      formObject.estadoAvaluo,
      formObject.fechaAvaluo || '',
      formObject.situaciones,
      cleanTextUpper(formObject.observaciones),
      userEmail,
      cambios.join(' | '),
      targetFileId
    ];

    try {
      gestorPrincipal.agregarFila(getConfig('SHEETS.SEGUIMIENTO'), rowDataHistory);
    } catch (e) {
      // fallback: intentar appendRow directo
      try {
        const ss = SpreadsheetApp.openById(principalId);
        const s = ss.getSheetByName(getConfig('SHEETS.SEGUIMIENTO'));
        if (s) s.appendRow(rowDataHistory);
      } catch (err) {
        console.error('No se pudo registrar seguimiento: ' + err.message);
      }
    }

    // 3. ACTUALIZAR HOJA "DATOS": Solo si la fila se encontró EN NUESTRA MATRIZ PRINCIPAL
    if (targetFileId === principalId) {
      try {
        const sheetDatos = gestorPrincipal.getSheet(getConfig('SHEETS.DATOS'));
        const lastCol = sheetDatos.getLastColumn();
        const headers = sheetDatos.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).toUpperCase().trim());
        const currentRow = sheetDatos.getRange(targetRowIndex, 1, 1, lastCol).getValues()[0];

        const colMap = mapearColumnasFlexible(headers);

        // Construir fila actualizada en memoria
        const updatedRow = currentRow.slice();
        const setIf = (colKey, val) => {
          const idx = colMap[colKey];
          if (idx > -1) updatedRow[idx] = (val === undefined || val === null) ? '' : val;
        };

        setIf('ESTADO PREDIAL', formObject.estadoPredial);
        setIf('ESTADO PREDIAL AJUSTADO', formObject.estadoAjustado);
        setIf('PREDIOS DISPONIBLES', formObject.disp);
        setIf('ESTADO RT', formObject.estadoRt);
        setIf('ESTADO ESTUDIO DE TITULOS', formObject.estadoTitulos);
        setIf('ESTADO TASACIÓN', formObject.estadoTasacion);
        setIf('ESTADO AVALUO', formObject.estadoAvaluo);
        setIf('FECHA AVALUO', formObject.fechaAvaluo);
        setIf('SITUACIONES ESPECIALES', formObject.situaciones);
        setIf('OBSERVACIONES', cleanTextUpper(formObject.observaciones));

        // Escritura en batch usando GestorDatos.actualizarRango
        gestorPrincipal.actualizarRango(
          getConfig('SHEETS.DATOS'),
          targetRowIndex,
          1,
          [updatedRow]
        );
      } catch (e) {
        console.error('Error actualizando DATOS en matriz principal: ' + e.message);
      }
    } else {
      pac_log('saveTrackingData: RT encontrado en archivo externo. Escrituras dirigidas exclusivamente a la matriz principal.', 'ADVERTENCIA');
    }

    // 4. REGISTRAR EN AUDITORÍA MODULAR (EN MATRIZ PRINCIPAL)
    try {
      const auditoria = new GestorAuditoria(principalId);
      auditoria.registrarAccion(
        userEmail,
        'Actualizar RT',
        `RT: ${formObject.rt}, Cambios: ${cambios.length}, origen: ${targetFileId}`
      );
    } catch (audError) {
      console.warn('⚠️ Error registrando auditoría: ' + audError.message);
    }

    // ✅ FASE 8 (perf, restaurado): invalida el caché del tablero — este RT cambió
    // Seguimiento y/o Datos.
    invalidateDataCache();

    return {
      status: 'success',
      message: `✅ Seguimiento guardado en matriz principal para RT: ${formObject.rt}`,
      cambios: cambios.length,
      detalles: cambios,
      origen: targetFileId
    };

  } catch (e) {
    console.error(`Error en saveTrackingData: ${e.message}`);
    return {
      status: 'error',
      message: e.message,
      stack: e.stack
    };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/**
 * ✅ MAPEO FLEXIBLE DE COLUMNAS (DEL CÓDIGO 1)
 */
function mapearColumnasFlexible(headers) {
  const findCol = (keywords) => {
    if (typeof keywords === 'string') keywords = [keywords];
    return headers.findIndex(h => 
      keywords.some(k => h.includes(k.toUpperCase()))
    );
  };

  return {
    "ESTADO PREDIAL": findCol(["ESTADO PREDIAL"]),
    "ESTADO PREDIAL AJUSTADO": findCol(["AJUSTADO"]),
    "PREDIOS DISPONIBLES": findCol(["DISPONIBLE"]),
    "ESTADO RT": findCol(["ESTADO RT"]),
    "ESTADO ESTUDIO DE TITULOS": findCol(["TITULOS", "ESTUDIO"]),
    "ESTADO TASACIÓN": findCol(["TASACI"]),
    "ESTADO AVALUO": findCol(["AVALUO"]),
    "FECHA AVALUO": findCol(["FECHA AVALUO"]),
    "SITUACIONES ESPECIALES": findCol(["SITUACION"]),
    "OBSERVACIONES": findCol(["OBSERVACIONES"])
  };
}

/**
 * ✅ DETECTA CAMBIOS PARA AUDITORÍA (DEL CÓDIGO 1)
 */
function detectarCambios(formObj, wsDatos, rowIndex) {
  const cambios = [];
  const headers = wsDatos.getRange(1, 1, 1, wsDatos.getLastColumn())
      .getValues()[0].map(h => h.toString().toUpperCase().trim());
  const colMap = mapearColumnasFlexible(headers);
  
  const getValorActual = (colIdx) => {
    if(colIdx < 0) return null;
    return wsDatos.getRange(rowIndex, colIdx + 1).getValue();
  };

  const registrarCambio = (campo, nuevo) => {
    const anterior = getValorActual(colMap[campo]);
    if (String(anterior) !== String(nuevo)) {
      cambios.push(`${campo}: "${anterior}" → "${nuevo}"`);
    }
  };

  registrarCambio("ESTADO PREDIAL", formObj.estadoPredial);
  registrarCambio("ESTADO PREDIAL AJUSTADO", formObj.estadoAjustado);
  registrarCambio("PREDIOS DISPONIBLES", formObj.disp);
  registrarCambio("ESTADO RT", formObj.estadoRt);
  registrarCambio("ESTADO ESTUDIO DE TITULOS", formObj.estadoTitulos);
  registrarCambio("ESTADO TASACIÓN", formObj.estadoTasacion);
  registrarCambio("ESTADO AVALUO", formObj.estadoAvaluo);

  return cambios;
}

/**
 * ✅ OBTIENE HISTORIAL DE UN RT (INTEGRADO)
 */
function getRtHistory(rt) {
  const historial = [];
  const dataFilesIds = getDataFilesIds();

  dataFilesIds.forEach(id => {
    try {
      const ss = SpreadsheetApp.openById(id);
      let wsSeg = ss.getSheetByName(getConfig('SHEETS.SEGUIMIENTO'));
      
      if (!wsSeg) return;

      const data = wsSeg.getDataRange().getValues();
      const headers = data[0];
      const rtIdx = headers.findIndex(h => 
        String(h).toUpperCase().includes("RT")
      );

      if (rtIdx === -1) return;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][rtIdx]).trim() === String(rt).trim()) {
          historial.push({
            fecha: data[i][0],
            rt: data[i][1],
            estado: data[i][3],
            disponibilidad: data[i][4],
            observaciones: data[i][11],
            usuario: data[i][12],
            cambios: data[i][13]
          });
        }
      }
    } catch(e) {
      console.error("Error leyendo historial: " + e);
    }
  });

  return JSON.stringify(historial.reverse());
}

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES DE PERMISOS (V2 - MANTENIDAS)
 * ═══════════════════════════════════════════════════════════
 */

function getPermissionsData() {
  try {
    const gestor = new GestorPermisos();
    const datos = gestor.obtenerTodos();
    return JSON.stringify(datos);
  } catch (e) {
    console.error(`Error en getPermissionsData: ${e.message}`);
    return JSON.stringify({ permissions: [], roles: [] });
  }
}

// ✅ FASE 6: savePermission()/deletePermission() removidas de este archivo —
// eran copias muertas/sombreadas (permisos.js declara las mismas funciones y,
// por orden de carga de Apps Script, esa copia era la que realmente se
// ejecutaba). GestorPermisos en permisos.js queda como única fuente de verdad
// para guardar/eliminar permisos — ver permisos.js:265-283.

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

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES DE REPORTES (V2 - MANTENIDAS)
 * ═══════════════════════════════════════════════════════════
 */

function getSavedReports(usuario) {
  try {
    const gestor = new GestorReportes();
    const reportes = gestor.obtenerGuardados(usuario);
    return JSON.stringify(reportes);
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
    const resultado = gestor.ejecutarReporte(reporteId, usuario);
    return JSON.stringify(resultado);
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

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES DE AUDITORÍA (V1 + V2 - ORQUESTADAS)
 * ═══════════════════════════════════════════════════════════
 */

function logAction(user, action, details) {
  try {
    const auditoria = new GestorAuditoria();
    return auditoria.registrarAccion(user, action, details);
  } catch (e) {
    console.error(`Error en logAction: ${e.message}`);
  }
}

function getUserLogs(usuario) {
  try {
    const auditoria = new GestorAuditoria();
    const logs = auditoria.obtenerLogsUsuario(usuario);
    return JSON.stringify(logs);
  } catch (e) {
    console.error(`Error en getUserLogs: ${e.message}`);
    return JSON.stringify([]);
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES DE UTILIDAD (V1 + V2)
 * ═══════════════════════════════════════════════════════════
 */

function getUserAndRole() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const gestorPermisos = new GestorPermisos();
    const role = gestorPermisos.obtenerRol(userEmail);
    
    return {
      user: userEmail,
      role: role || getConfig('ROLES.LECTOR')
    };
  } catch (e) {
    console.error(`❌ Error en getUserAndRole: ${e.message}`);
    return {
      user: 'Usuario',
      role: getConfig('ROLES.LECTOR')
    };
  }
}

function getSystemInfo() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const gestorPermisos = new GestorPermisos();
    const role = gestorPermisos.obtenerRol(userEmail);
    
    return JSON.stringify({
      user: userEmail,
      role: role,
      timestamp: new Date().toISOString(),
      version: '3.0.0-integrated',
      config: {
        sheets: getConfig('SHEETS'),
        roles: getConfig('ROLES')
      }
    });
  } catch (e) {
    console.error(`Error en getSystemInfo: ${e.message}`);
    return JSON.stringify({
      error: e.message
    });
  }
}

function validateDataIntegrity() {
  try {
    const gestor = new GestorDatos();
    const resultados = {};
    
    const hojasCriticas = [
      getConfig('SHEETS.DATOS'),
      getConfig('SHEETS.PERMISOS'),
      getConfig('SHEETS.LOGS')
    ];
    
    hojasCriticas.forEach(hoja => {
      try {
        const { headers, rows } = gestor.leerDatos(hoja);
        resultados[hoja] = {
          status: 'OK',
          headers: headers.length,
          rows: rows.length
        };
      } catch (e) {
        resultados[hoja] = {
          status: 'ERROR',
          message: e.message
        };
      }
    });
    
    return JSON.stringify(resultados);
  } catch (e) {
    console.error(`Error en validateDataIntegrity: ${e.message}`);
    return JSON.stringify({
      error: e.message
    });
  }
}

function exportDataToCSV(sheetName) {
  try {
    const gestor = new GestorDatos();
    const { headers, rows } = gestor.leerDatos(sheetName);
    
    let csv = headers.join(',') + '\n';
    
    rows.forEach(row => {
      const valores = headers.map(h => {
        const val = row[h] || '';
        const escaped = String(val).replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      });
      csv += valores.join(',') + '\n';
    });
    
    return csv;
  } catch (e) {
    console.error(`Error en exportDataToCSV: ${e.message}`);
    return `Error: ${e.message}`;
  }
}

function getGeneralStats() {
  try {
    const gestor = new GestorDatos();
    const { rows } = gestor.leerDatos(getConfig('SHEETS.DATOS'));
    
    const stats = {
      totalRegistros: rows.length,
      proyectos: [...new Set(rows.map(r => r[getConfig('COLUMNS.PROYECTO')]))].length,
      tramos: [...new Set(rows.map(r => r[getConfig('COLUMNS.TRAMO')]))].length,
      disponibles: rows.filter(r => 
        String(r[getConfig('COLUMNS.DISPONIBILIDAD')]).includes('DISPONIBLE')
      ).length,
      pendientes: rows.filter(r => 
        String(r[getConfig('COLUMNS.DISPONIBILIDAD')]).includes('PENDIENTE')
      ).length,
      totalEstimado: rows.reduce((sum, r) => 
        sum + parseMoneyRobust(r[getConfig('COLUMNS.ESTIMADO')]), 0
      ),
      totalPagado: rows.reduce((sum, r) => 
        sum + parseMoneyRobust(r[getConfig('COLUMNS.PAGADO')]), 0
      )
    };
    
    stats.porcentajePago = stats.totalEstimado > 0 
      ? (stats.totalPagado / stats.totalEstimado * 100).toFixed(2)
      : 0;
    
    return JSON.stringify(stats);
  } catch (e) {
    console.error(`Error en getGeneralStats: ${e.message}`);
    return JSON.stringify({
      error: e.message
    });
  }
}

function initializeSystem() {
  try {
    validateConfig();
    
    const gestor = new GestorDatos();
    const auditoria = new GestorAuditoria();
    
    const hojas = [
      getConfig('SHEETS.DATOS'),
      getConfig('SHEETS.PERMISOS'),
      getConfig('SHEETS.LOGS'),
      getConfig('SHEETS.SEGUIMIENTO'),
      getConfig('SHEETS.AUDITORIA'),
      getConfig('SHEETS.REPORTES')
    ];
    
    hojas.forEach(hoja => {
      try {
        gestor.getSheet(hoja);
      } catch (e) {
        console.log(`Creando hoja: ${hoja}`);
      }
    });
    
    return {
      success: true,
      message: 'Sistema inicializado correctamente'
    };
  } catch (e) {
    console.error(`Error en initializeSystem: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

function getVersion() {
  return {
    version: '3.0.0-integrated',
    buildDate: '2026-02-02',
    modules: [
      'config.gs',
      'utilidades.gs',
      'validaciones.gs',
      'datos.gs',
      'auditoria.gs',
      'permisos.gs',
      'reportes.gs',
      'codigo.gs'
    ],
    features: [
      'Dashboard interactivo con matriz',
      'Control de acceso robusto',
      'Auditoría completa',
      'Seguimiento de cambios con historial',
      'Reportería dinámica con PDF',
      'Gestión de permisos',
      'Exportación de datos',
      'Cronograma trimestral',
      'KPIs financieros',
      'Parsing robusto de números'
    ]
  };
}

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES GLOBALES - FILTRO MATRIZ
 * ═══════════════════════════════════════════════════════════
 */

/**
 * ✅ Obtiene todos los filtros matriz
 */
function getFiltrosMatriz() {
  try {
    const gestor = new GestorFiltroMatriz();
    const filtros = gestor.obtenerTodos();
    return JSON.stringify(filtros);
  } catch (e) {
    console.error(`Error en getFiltrosMatriz: ${e.message}`);
    return JSON.stringify([]);
  }
}

/**
 * ✅ Obtiene el filtro activo
 */
function getFiltroMatrizActivo() {
  try {
    const gestor = new GestorFiltroMatriz();
    const filtro = gestor.obtenerFiltroActivo();
    return JSON.stringify(filtro || {});
  } catch (e) {
    console.error(`Error en getFiltroMatrizActivo: ${e.message}`);
    return JSON.stringify({});
  }
}

/**
 * ✅ Crea nuevo filtro matriz
 */
function crearFiltroMatriz(nombre, descripcion, proyectosIncluidos, proyectosExcluidos, usuario) {
  try {
    const gestor = new GestorFiltroMatriz();
    const incluidos = typeof proyectosIncluidos === 'string' 
      ? proyectosIncluidos.split(',').map(p => p.trim())
      : proyectosIncluidos;
    const excluidos = typeof proyectosExcluidos === 'string'
      ? proyectosExcluidos.split(',').map(p => p.trim())
      : proyectosExcluidos;
    
    return gestor.crearFiltro(nombre, descripcion, incluidos, excluidos, usuario);
  } catch (e) {
    console.error(`Error en crearFiltroMatriz: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * ✅ Actualiza un filtro matriz
 */
function actualizarFiltroMatriz(id, nombre, descripcion, proyectosIncluidos, proyectosExcluidos, usuario) {
  try {
    const gestor = new GestorFiltroMatriz();
    const incluidos = typeof proyectosIncluidos === 'string'
      ? proyectosIncluidos.split(',').map(p => p.trim())
      : proyectosIncluidos;
    const excluidos = typeof proyectosExcluidos === 'string'
      ? proyectosExcluidos.split(',').map(p => p.trim())
      : proyectosExcluidos;
    
    return gestor.actualizarFiltro(id, nombre, descripcion, incluidos, excluidos, usuario);
  } catch (e) {
    console.error(`Error en actualizarFiltroMatriz: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * ✅ Activa un filtro matriz
 */
function activarFiltroMatriz(id, usuario) {
  try {
    const gestor = new GestorFiltroMatriz();
    return gestor.activarFiltro(id, usuario);
  } catch (e) {
    console.error(`Error en activarFiltroMatriz: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * ✅ Elimina un filtro matriz
 */
function eliminarFiltroMatriz(id, usuario) {
  try {
    const gestor = new GestorFiltroMatriz();
    return gestor.eliminarFiltro(id, usuario);
  } catch (e) {
    console.error(`Error en eliminarFiltroMatriz: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * ✅ Obtiene proyectos visibles según filtro activo
 */
function getProyectosVisibles() {
  try {
    const gestor = new GestorFiltroMatriz();
    return JSON.stringify(gestor.obtenerProyectosVisibles());
  } catch (e) {
    console.error(`Error en getProyectosVisibles: ${e.message}`);
    return JSON.stringify({ todos: true, proyectos: [] });
  }
}


/**
 * ✅ GENERA PDF EN EL SERVIDOR - VERSIÓN COMPLETA V7
 * SIN LÍMITES - TODOS LOS REGISTROS - COLORES CORREGIDOS
 */
function generateServerPdfReport(dataStructure) {
  try {
    console.log('📄 Generando PDF COMPLETO en servidor...');
    
    const data = JSON.parse(dataStructure);
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    
    // 1. CREAR DOCUMENTO
    const docName = `Reporte_Gestion_Predial_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}`;
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();
    
    // 2. CONFIGURAR MÁRGENES Y ESTILOS
    body.setMarginTop(15);
    body.setMarginBottom(15);
    body.setMarginLeft(15);
    body.setMarginRight(15);
    
    const titleStyle = {};
    titleStyle[DocumentApp.Attribute.FONT_SIZE] = 18;
    titleStyle[DocumentApp.Attribute.BOLD] = true;
    titleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#2c3e50';
    
    const headerStyle = {};
    headerStyle[DocumentApp.Attribute.FONT_SIZE] = 12;
    headerStyle[DocumentApp.Attribute.BOLD] = true;
    headerStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#34495e';
    
    const normalStyle = {};
    normalStyle[DocumentApp.Attribute.FONT_SIZE] = 9;
    normalStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#000000';
    
    const smallStyle = {};
    smallStyle[DocumentApp.Attribute.FONT_SIZE] = 7;
    smallStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#000000';
    
    // 3. TÍTULO
    const title = body.appendParagraph('REPORTE DE GESTIÓN PREDIAL');
    title.setAttributes(titleStyle);
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    
    const subtitle = body.appendParagraph(`Generado: ${new Date().toLocaleString('es-CO')}`);
    subtitle.setAttributes(normalStyle);
    subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    
    body.appendHorizontalRule();
    
    // 4. FILTROS
    const filtrosTitle = body.appendParagraph('FILTROS APLICADOS');
    filtrosTitle.setAttributes(headerStyle);
    
    // ✅ Aquí añadimos la Agrupación
    const filtrosText = 
      `Agrupación Matriz Activa: ${data.filtros.agrupacion}\n` +
      `Proyecto: ${data.filtros.proyecto}\n` +
      `Tramo: ${data.filtros.tramo}\n` +
      `Fecha Corte: ${data.filtros.fecha} (${data.filtros.modo})\n` +
      `Filtro KPI: ${data.filtros.kpi}`;
    
    const filtrosP = body.appendParagraph(filtrosText);
    filtrosP.setAttributes(normalStyle);
    
    // 5. MATRIZ
    const matrizTitle = body.appendParagraph('MATRIZ DE SEGUIMIENTO');
    matrizTitle.setAttributes(headerStyle);
    body.appendParagraph('');
    
    const matrizTable = body.appendTable();
    
    // Headers
    const headerRow = matrizTable.appendTableRow();
    headerRow.appendTableCell('TRAMO').setAttributes({
      [DocumentApp.Attribute.BACKGROUND_COLOR]: '#34495e',
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#ffffff',
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FONT_SIZE]: 8
    });
    
    data.matriz.states.forEach(state => {
      const cell = headerRow.appendTableCell(state.substring(0, 12));
      cell.setAttributes({
        [DocumentApp.Attribute.BACKGROUND_COLOR]: '#34495e',
        [DocumentApp.Attribute.FOREGROUND_COLOR]: '#ffffff',
        [DocumentApp.Attribute.BOLD]: true,
        [DocumentApp.Attribute.FONT_SIZE]: 7
      });
    });
    
    headerRow.appendTableCell('TOTAL').setAttributes({
      [DocumentApp.Attribute.BACKGROUND_COLOR]: '#34495e',
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#ffffff',
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FONT_SIZE]: 8
    });
    
    headerRow.appendTableCell('%DISP').setAttributes({
      [DocumentApp.Attribute.BACKGROUND_COLOR]: '#34495e',
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#ffffff',
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FONT_SIZE]: 8
    });
    
    // Datos de la matriz
    data.matriz.data.forEach((row, idx) => {
      const dataRow = matrizTable.appendTableRow();
      
      dataRow.appendTableCell(row.tramo).setAttributes({
        [DocumentApp.Attribute.BOLD]: true,
        [DocumentApp.Attribute.BACKGROUND_COLOR]: '#f1f3f5',
        [DocumentApp.Attribute.FONT_SIZE]: 8,
        [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
      });
      
      row.valores.forEach(val => {
        const cellText = val.count > 0 ? val.count.toString() : '-';
        const cell = dataRow.appendTableCell(cellText);
        
        if (val.count > 0) {
          cell.setAttributes({
            [DocumentApp.Attribute.FONT_SIZE]: 8,
            [DocumentApp.Attribute.FOREGROUND_COLOR]: '#3498db',
            [DocumentApp.Attribute.BOLD]: true
          });
        } else {
          cell.setAttributes({
            [DocumentApp.Attribute.FONT_SIZE]: 8,
            [DocumentApp.Attribute.FOREGROUND_COLOR]: '#d0d0d0',
            [DocumentApp.Attribute.BOLD]: false
          });
        }
      });
      
      dataRow.appendTableCell(row.total.toString()).setAttributes({
        [DocumentApp.Attribute.BOLD]: true,
        [DocumentApp.Attribute.FONT_SIZE]: 8,
        [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
      });
      
      dataRow.appendTableCell(row.percDisp.toFixed(0) + '%').setAttributes({
        [DocumentApp.Attribute.FONT_SIZE]: 8,
        [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
      });
    });
    
    // Total
    const totalRow = matrizTable.appendTableRow();
    totalRow.appendTableCell('TOTAL').setAttributes({
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.BACKGROUND_COLOR]: '#e9ecef',
      [DocumentApp.Attribute.FONT_SIZE]: 8,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
    });
    
    data.matriz.colTotales.forEach(total => {
      totalRow.appendTableCell(total.toString()).setAttributes({
        [DocumentApp.Attribute.BOLD]: true,
        [DocumentApp.Attribute.FONT_SIZE]: 8,
        [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
      });
    });
    
    totalRow.appendTableCell(data.matriz.granTotal.toString()).setAttributes({
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FONT_SIZE]: 8,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
    });
    
    totalRow.appendTableCell('-').setAttributes({
      [DocumentApp.Attribute.FONT_SIZE]: 8,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
    });
    
    // 6. DETALLES COMPLETOS (SIN LÍMITES)
    console.log(`📋 Generando TODOS los detalles (${data.detalles.length})...`);
    
    for (let i = 0; i < data.detalles.length; i++) {
      const detalle = data.detalles[i];
      
      body.appendPageBreak();
      
      const detalleTitle = body.appendParagraph(
        `DETALLE ${i+1}/${data.detalles.length}: ${detalle.tramo} / ${detalle.estado} (${detalle.count} registros)`
      );
      detalleTitle.setAttributes(headerStyle);
      body.appendParagraph('');
      
      const detalleTable = body.appendTable();
      
      // Headers
      const detHeaderRow = detalleTable.appendTableRow();
      ['RT', 'ID', 'DIRECCIÓN', 'DISPONIBILIDAD', 'OBSERVACIONES', 'VALOR'].forEach(header => {
        detHeaderRow.appendTableCell(header).setAttributes({
          [DocumentApp.Attribute.BOLD]: true,
          [DocumentApp.Attribute.BACKGROUND_COLOR]: '#34495e',
          [DocumentApp.Attribute.FOREGROUND_COLOR]: '#ffffff',
          [DocumentApp.Attribute.FONT_SIZE]: 7
        });
      });
      
      // TODOS LOS REGISTROS (SIN LÍMITE)
      for (let j = 0; j < detalle.registros.length; j++) {
        const reg = detalle.registros[j];
        const detRow = detalleTable.appendTableRow();
        
        // RT
        detRow.appendTableCell(String(reg.rt || '')).setAttributes({
          [DocumentApp.Attribute.BOLD]: true,
          [DocumentApp.Attribute.FOREGROUND_COLOR]: '#3498db',
          [DocumentApp.Attribute.FONT_SIZE]: 7
        });
        
        // ID
        detRow.appendTableCell(String(reg.id || '').substring(0, 15)).setAttributes({
          [DocumentApp.Attribute.FONT_SIZE]: 7,
          [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
        });
        
        // DIRECCIÓN
        detRow.appendTableCell(String(reg.direccion || '').substring(0, 40)).setAttributes({
          [DocumentApp.Attribute.FONT_SIZE]: 7,
          [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
        });
        
        // DISPONIBILIDAD
        detRow.appendTableCell(String(reg.disponibilidad || '').substring(0, 20)).setAttributes({
          [DocumentApp.Attribute.FONT_SIZE]: 7,
          [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
        });
        
        // OBSERVACIONES COMPLETAS (SIN TRUNCAR)
        detRow.appendTableCell(String(reg.observaciones || '')).setAttributes({
          [DocumentApp.Attribute.FONT_SIZE]: 6,
          [DocumentApp.Attribute.ITALIC]: true,
          [DocumentApp.Attribute.FOREGROUND_COLOR]: '#333333'
        });
        
        // VALOR
        detRow.appendTableCell(fmt.format(reg.valorPagado)).setAttributes({
          [DocumentApp.Attribute.FONT_SIZE]: 7,
          [DocumentApp.Attribute.FOREGROUND_COLOR]: '#000000'
        });
      }
      
      console.log(`✅ Detalle ${i+1}/${data.detalles.length} completado (${detalle.registros.length} registros)`);
    }
    
    // 7. PIE DE PÁGINA
    body.appendParagraph('');
    const footer = body.appendParagraph(
      `\nReporte generado por Sistema de Gestión Predial Enterprise v3.0\n` +
      `Fecha: ${new Date().toLocaleString('es-CO')}\n` +
      `Detalles incluidos: ${data.detalles.length} secciones con ${data.detalles.reduce((sum, d) => sum + d.count, 0)} registros totales`
    );
    footer.setAttributes({
      [DocumentApp.Attribute.FONT_SIZE]: 7,
      [DocumentApp.Attribute.ITALIC]: true,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#666666'
    });
    footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    
    // 8. GUARDAR Y CONVERTIR
    doc.saveAndClose();
    Utilities.sleep(5000);
    
    const docFile = DriveApp.getFileById(doc.getId());
    const pdfBlob = docFile.getAs('application/pdf');
    pdfBlob.setName(docName + '.pdf');

    // Enviar el PDF por correo al usuario que solicitó la generación
    try {
      const recipient = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
      MailApp.sendEmail({
        to: recipient,
        subject: `Reporte PDF - ${docName}`,
        htmlBody: `<p>Adjunto el reporte generado: <strong>${docName}.pdf</strong></p>`,
        attachments: [pdfBlob]
      });
      console.log('📧 PDF enviado por correo a: ' + recipient);
    } catch (eEmail) {
      console.error('❌ Error enviando PDF por correo: ' + eEmail.message);
    }

    // Eliminar el documento temporal creado
    try { docFile.setTrashed(true); } catch (e) { console.warn('No se pudo mover a la papelera el doc temporal: ' + e.message); }

    return {
      success: true,
      emailSent: true,
      emailedTo: Session.getActiveUser().getEmail(),
      fileName: docName + '.pdf',
      detallesIncluidos: data.detalles.length,
      detallesTotal: data.detalles.length,
      registrosTotales: data.detalles.reduce((sum, d) => sum + d.count, 0),
      message: 'PDF enviado por correo al solicitante'
    };
    
  } catch (e) {
    console.error('❌ Error generando PDF: ' + e.message);
    console.error('📍 Línea: ' + e.lineNumber);
    console.error('📍 Stack: ' + e.stack);
    return {
      success: false,
      error: e.message,
      stack: e.stack,
      line: e.lineNumber
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * MODULO DE EXPORTACIÓN Y AUTOMATIZACIÓN DE ALERTAS
 * ═══════════════════════════════════════════════════════════
 */

// Genera un Excel de las alertas filtradas y lo envía por correo con un informe detallado
function procesarReporteAlertas(emailDestino, filtros) {
  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    const ss = SpreadsheetApp.openById(fileId);
    const hoja = ss.getSheetByName("ALERTAS_ACTIVAS");
    
    if (!hoja) throw new Error("Hoja ALERTAS_ACTIVAS no encontrada. Ejecuta el motor primero.");

    const datos = hoja.getDataRange().getValues();
    if (datos.length < 2) return { success: false, error: "No hay alertas activas para reportar." };

    const headers = datos[0];
    let filas = datos.slice(1);

    // 1. APLICAR FILTROS DESDE LA INTERFAZ
    if (filtros) {
      filas = filas.filter(f => {
        let ok = true;
        // f[1]=NIVEL, f[3]=PROYECTO, f[4]=ARTICULADOR, f[6]=REGLA
        if (filtros.nivel && filtros.nivel !== 'ALL') ok = ok && (f[1] === filtros.nivel);
        if (filtros.regla && filtros.regla !== 'ALL') ok = ok && (f[6] === filtros.regla);
        if (filtros.proyecto && filtros.proyecto !== 'ALL') ok = ok && (f[3] === filtros.proyecto);
        if (filtros.articulador && filtros.articulador !== 'ALL') ok = ok && (f[4] === filtros.articulador);
        return ok;
      });
    }

    if (filas.length === 0) return { success: false, error: "No hay alertas que coincidan con los filtros actuales." };

    // 2. CALCULAR MÉTRICAS PARA EL INFORME DE CORREO
    let countRojo = 0, countNaranja = 0, countAmarillo = 0;
    filas.forEach(f => {
        if (f[1] === 'ROJO') countRojo++;
        else if (f[1] === 'NARANJA') countNaranja++;
        else if (f[1] === 'AMARILLO') countAmarillo++;
    });

    // 3. GENERAR ARCHIVO EN MEMORIA (CSV) - evita crear archivos temporales en Drive
    function escapeCsv(val) {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    // Encabezado CSV
    const csvRows = [];
    csvRows.push(headers.map(h => escapeCsv(h)).join(','));

    // Filas
    for (let i = 0; i < filas.length; i++) {
      const row = filas[i];
      const rowEsc = row.map(c => escapeCsv(c));
      csvRows.push(rowEsc.join(','));
    }

    const csvContent = csvRows.join('\r\n');
    const fileName = 'Reporte_Alertas_GP_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.csv';
    const blob = Utilities.newBlob(csvContent, 'text/csv', fileName);

    // 5. CONSTRUIR EL INFORME HTML PARA EL CORREO
    // Formateamos las etiquetas de los filtros para que se vean bonitas
    const lblNivel = (!filtros || filtros.nivel === 'ALL') ? 'Todas las alertas' : filtros.nivel;
    const lblProyecto = (!filtros || filtros.proyecto === 'ALL') ? 'Todos los proyectos' : filtros.proyecto;
    const lblRegla = (!filtros || filtros.regla === 'ALL') ? 'Todas las reglas' : filtros.regla;
    const lblArtic = (!filtros || filtros.articulador === 'ALL') ? 'Todos los articuladores' : filtros.articulador;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          
          <div style="background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%); padding: 25px 20px; text-align: center; border-bottom: 4px solid #3498db;">
              <h2 style="margin: 0; color: #ffffff; font-size: 22px; letter-spacing: 1px;">INFORME DE SEGUIMIENTO</h2>
              <p style="margin: 5px 0 0 0; color: #aeb6bf; font-size: 14px;">Módulo de Alertas Tempranas - Gestión Predial</p>
          </div>
          
          <div style="padding: 30px 25px; background-color: #ffffff;">
              <p style="font-size: 15px; line-height: 1.6;">Cordial saludo,</p>
              <p style="font-size: 15px; line-height: 1.6;">A continuación, se presenta el resumen ejecutivo del estado actual de las alertas tempranas generadas por el Motor de Reglas, de acuerdo con los parámetros seleccionados en el sistema.</p>
              
              <div style="background-color: #f8f9fa; padding: 15px 20px; border-radius: 6px; border-left: 4px solid #3498db; margin: 25px 0;">
                  <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px; text-transform: uppercase;">Parámetros del Reporte</h4>
                  <table style="width: 100%; font-size: 14px;">
                      <tr><td style="padding: 4px 0; width: 35%;"><strong>Proyecto:</strong></td><td style="color: #555;">${lblProyecto}</td></tr>
                      <tr><td style="padding: 4px 0;"><strong>Articulador:</strong></td><td style="color: #555;">${lblArtic}</td></tr>
                      <tr><td style="padding: 4px 0;"><strong>Nivel Riesgo:</strong></td><td style="color: #555;">${lblNivel}</td></tr>
                      <tr><td style="padding: 4px 0;"><strong>Regla Evaluada:</strong></td><td style="color: #555;">${lblRegla}</td></tr>
                  </table>
              </div>

              <h4 style="color: #2c3e50; font-size: 16px; margin-bottom: 15px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px;">Consolidado de Alertas Detectadas: <span style="color:#3498db; font-size:18px;">${filas.length}</span></h4>
              
              <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-bottom: 25px;">
                  <tr>
                      <td style="background-color: #fce8e6; border-left: 5px solid #c0392b; padding: 12px 15px; border-radius: 4px 0 0 4px; width: 80%;">
                          <strong style="color: #c0392b;">🔴 CRÍTICAS (Incumplimiento Normativo / Bloqueo)</strong>
                      </td>
                      <td style="background-color: #fce8e6; padding: 12px 15px; border-radius: 0 4px 4px 0; text-align: right; color: #c0392b;">
                          <strong style="font-size: 18px;">${countRojo}</strong>
                      </td>
                  </tr>
                  <tr>
                      <td style="background-color: #fdf2e9; border-left: 5px solid #e67e22; padding: 12px 15px; border-radius: 4px 0 0 4px;">
                          <strong style="color: #d35400;">🟠 RIESGO (Vencimiento Urgente)</strong>
                      </td>
                      <td style="background-color: #fdf2e9; padding: 12px 15px; border-radius: 0 4px 4px 0; text-align: right; color: #d35400;">
                          <strong style="font-size: 18px;">${countNaranja}</strong>
                      </td>
                  </tr>
                  <tr>
                      <td style="background-color: #fef9e7; border-left: 5px solid #f1c40f; padding: 12px 15px; border-radius: 4px 0 0 4px;">
                          <strong style="color: #b48600;">🟡 PREVENTIVAS (En Tiempo)</strong>
                      </td>
                      <td style="background-color: #fef9e7; padding: 12px 15px; border-radius: 0 4px 4px 0; text-align: right; color: #b48600;">
                          <strong style="font-size: 18px;">${countAmarillo}</strong>
                      </td>
                  </tr>
              </table>

              <p style="font-size: 14px; line-height: 1.6; color: #555; background-color: #e8f4f8; padding: 12px; border-radius: 4px;">
                  📌 <b>Documento Anexo:</b> Se adjunta a este correo el archivo Excel (.xlsx) con la base de datos detallada de los ${filas.length} predios reportados para su revisión y respectiva gestión jurídica/técnica.
              </p>
          </div>
          
          <div style="background-color: #f1f3f5; padding: 20px; text-align: center; font-size: 12px; color: #7f8c8d; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 5px 0;"><strong>Sistema Integral Enterprise - Gestión Predial IDU</strong></p>
              <p style="margin: 0;">Generado de forma automática por el Motor Dinámico de Reglas.</p>
              <p style="margin: 5px 0 0 0;">Solicitado por: ${filtros.usuario || 'Ejecución Automática (Trigger)'}</p>
          </div>
      </div>
    `;

    MailApp.sendEmail({
      to: emailDestino,
      subject: `📊 Informe de Alertas Tempranas [${lblProyecto}] - Gestión Predial`,
      htmlBody: htmlBody,
      attachments: [blob]
    });
    
    return { success: true, message: "El informe ha sido enviado exitosamente al correo: " + emailDestino };

  } catch (e) {
    console.error("Error procesando reporte Excel/Correo: " + e.message);
    return { success: false, error: e.message };
  }
}
// Función exclusiva para forzar la ventana de permisos de Google
function solicitarPermisosFaltantes() {
  try {
    // Estas 4 líneas obligan a Google a detectar que necesitas estos 4 permisos
    UrlFetchApp.fetch("https://www.google.com"); // Permiso para descargas externas
    MailApp.getRemainingDailyQuota();            // Permiso para enviar correos
    DriveApp.getRootFolder();                    // Permiso para manejar archivos/Drive
    SpreadsheetApp.create("Test_Borrar");        // Permiso para crear Excel
    
    console.log("✅ Permisos otorgados correctamente.");
  } catch (e) {
    console.log("Nota: " + e.message);
  }
}
/**
 * ═══════════════════════════════════════════════════════════
 * CONTROLES DINÁMICOS DE MANTENIMIENTO
 * Selecciona una de estas funciones y dale "Ejecutar" arriba.
 * ═══════════════════════════════════════════════════════════
 */
function ACTIVAR_MANTENIMIENTO() {
  PropertiesService.getScriptProperties().setProperty('MODO_MANTENIMIENTO', 'true');
  console.log('🚧 Mantenimiento ACTIVADO. Los usuarios verán la pantalla de bloqueo.');
}

function DESACTIVAR_MANTENIMIENTO() {
  PropertiesService.getScriptProperties().setProperty('MODO_MANTENIMIENTO', 'false');
  console.log('✅ Mantenimiento DESACTIVADO. Sistema en línea.');
}
/**
 * ═══════════════════════════════════════════════════════════
 * CONTROLES DINÁMICOS DE MANTENIMIENTO (MENÚ EN GOOGLE SHEETS)
 * ═══════════════════════════════════════════════════════════
 */

// Esta función crea un menú en la parte superior de tu Google Sheet
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🛠️ Control Web')
    .addItem('🛑 Activar Mantenimiento (Bloquear Web)', 'ACTIVAR_MANTENIMIENTO')
    .addItem('✅ Desactivar Mantenimiento (Abrir Web)', 'DESACTIVAR_MANTENIMIENTO')
    .addSeparator()
    .addItem('🔍 Validar Staging Dato 2', 'validarStaging')
    .addItem('🚀 Promover Dato 2 a Dato 1', 'promoverDato2aDato1')
    .addToUi();
}

function _isAdminOrPowerEditor() {
  try {
    const email = Session.getActiveUser().getEmail().toLowerCase();
    const gestor = new GestorPermisos();
    const rol = gestor.obtenerRol(email) || '';
    const adminRole = getConfig('ROLES.ADMIN');
    const editorRole = getConfig('ROLES.EDITOR');

    if (rol === adminRole) return true;

    const powerProp = PropertiesService.getScriptProperties().getProperty('POWER_EDITORS') || '';
    const powerList = powerProp.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
    return powerList.indexOf(email) >= 0 && (rol === editorRole || rol === adminRole);
  } catch (e) {
    console.error('Error verificando permisos avanzados: ' + e.message);
    return false;
  }
}

function validarStaging() {
  const ui = SpreadsheetApp.getUi();
  try {
    const stagingId = getStagingFileId();
    if (!stagingId) {
      ui.alert('Validación Staging', 'No está configurado DATA_FILES.STAGING. Por favor define el ID de Dato 2 en config.js.', ui.ButtonSet.OK);
      return;
    }

    const principalId = getConfig('DATA_FILES.PRINCIPAL');
    if (stagingId === principalId) {
      ui.alert('Validación Staging', 'El ID de staging no puede ser igual al ID del archivo principal.', ui.ButtonSet.OK);
      return;
    }

    const ssStaging = SpreadsheetApp.openById(stagingId);
    const ssPrincipal = SpreadsheetApp.openById(principalId);
    const sheetNames = [getConfig('SHEETS.DATOS'), getConfig('SHEETS.SEGUIMIENTO')];
    const diffs = [];

    sheetNames.forEach(function(name) {
      const stagingSheet = ssStaging.getSheetByName(name);
      const principalSheet = ssPrincipal.getSheetByName(name);
      if (!stagingSheet) {
        diffs.push(`Hoja '${name}' no existe en staging`);
        return;
      }
      if (!principalSheet) {
        diffs.push(`Hoja '${name}' no existe en el archivo principal`);
        return;
      }

      const stagingHeaders = stagingSheet.getRange(1, 1, 1, stagingSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
      const principalHeaders = principalSheet.getRange(1, 1, 1, principalSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
      const onlyInStaging = stagingHeaders.filter(function(h) { return principalHeaders.indexOf(h) < 0; });
      const onlyInPrincipal = principalHeaders.filter(function(h) { return stagingHeaders.indexOf(h) < 0; });
      if (onlyInStaging.length || onlyInPrincipal.length) {
        diffs.push(`Hoja '${name}' desalineada: Staging sólo ${onlyInStaging.length} columnas, Principal sólo ${onlyInPrincipal.length} columnas.`);
      }
      diffs.push(`Hoja '${name}': Staging ${Math.max(0, stagingSheet.getLastRow() - 1)} filas, Principal ${Math.max(0, principalSheet.getLastRow() - 1)} filas.`);
    });

    const message = diffs.length > 0 ? diffs.join('\n') : 'Staging verificado correctamente. No se encontraron diferencias estructurales graves.';
    ui.alert('Resultado de validación de Staging', message, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Validación Staging', 'Error al validar staging: ' + e.message, ui.ButtonSet.OK);
    console.error('Error en validarStaging: ' + e.message);
  }
}

function promoverDato2aDato1() {
  const ui = SpreadsheetApp.getUi();
  if (!_isAdminOrPowerEditor()) {
    ui.alert('Promoción Staging', 'No tienes permisos suficientes para promover Dato 2 a Dato 1.', ui.ButtonSet.OK);
    return;
  }

  const answer = ui.alert('Promover Dato 2 a Dato 1', 'Esta acción reemplazará los datos de producción con los datos del staging. Asegúrate de haber validado staging primero. ¿Deseas continuar?', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) {
    ui.alert('Promoción Staging', 'Operación cancelada.', ui.ButtonSet.OK);
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const stagingId = getStagingFileId();
    const principalId = getConfig('DATA_FILES.PRINCIPAL');
    if (!stagingId) throw new Error('No está configurado DATA_FILES.STAGING.');
    if (stagingId === principalId) throw new Error('El archivo staging no puede ser igual al archivo principal.');

    const ssStaging = SpreadsheetApp.openById(stagingId);
    const ssPrincipal = SpreadsheetApp.openById(principalId);
    const sheetNames = [getConfig('SHEETS.DATOS'), getConfig('SHEETS.SEGUIMIENTO')];

    sheetNames.forEach(function(name) {
      copiarHojaDeStaging(ssStaging, ssPrincipal, name);
    });

    invalidateDataCache(); // ✅ FASE 8 (perf, restaurado): promoción sobrescribe Datos/Seguimiento

    ui.alert('Promoción Staging', 'Promoción completada correctamente. Revisa el archivo principal para verificar los datos.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Promoción Staging', 'Error promoviendo staging: ' + e.message, ui.ButtonSet.OK);
    console.error('Error en promoverDato2aDato1: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

function copiarHojaDeStaging(sourceSS, targetSS, sheetName) {
  try {
    const sourceSheet = sourceSS.getSheetByName(sheetName);
    const targetSheet = targetSS.getSheetByName(sheetName);
    if (!sourceSheet) throw new Error(`Hoja '${sheetName}' no existe en staging.`);
    if (!targetSheet) throw new Error(`Hoja '${sheetName}' no existe en producción.`);

    const values = sourceSheet.getDataRange().getValues();
    if (!values || values.length === 0) {
      targetSheet.clearContents();
      return;
    }

    const rows = values.length;
    const cols = values[0].length;
    if (targetSheet.getMaxRows() < rows) targetSheet.insertRowsAfter(targetSheet.getMaxRows(), rows - targetSheet.getMaxRows());
    if (targetSheet.getMaxColumns() < cols) targetSheet.insertColumnsAfter(targetSheet.getMaxColumns(), cols - targetSheet.getMaxColumns());
    targetSheet.clearContents();
    targetSheet.getRange(1, 1, rows, cols).setValues(values);
    SpreadsheetApp.flush();
  } catch (e) {
    throw new Error('Error copiando hoja ' + sheetName + ': ' + e.message);
  }
}
