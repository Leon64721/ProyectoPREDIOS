// ============================================
// SISTEMA AVANZADO DE CRUZAMIENTO DE DATOS v7.5 MULTI-USUARIO + IA
// ✅ Soporte robusto para Google Sheets y Excel en Drive
// ✅ Diagnóstico de permisos, MIME y acceso
// ✅ Conversión temporal más segura
// ✅ Selección de fila de encabezados en hoja externa
// ✅ Logs, historial, auditoría y pruebas integradas
// ✅ PROTECCIÓN DE ARRAYFORMULAS Y COLUMNAS ENTERAS 🛡️
// ✅ MOTOR HEURÍSTICO DE APRENDIZAJE E IA 🧠
// ✅ SOPORTE 1:N - CONCATENACIÓN INDEXADA PARA ALERTAS LIMPIAS 🚀
// ✅ ACCESO GLOBAL: Configuraciones compartidas entre todos los editores 🌍
// ============================================

const CONFIG_PROP = 'CRUCES_CONFIG_V7';
const PROGRAMACIONES_PROP = 'PROGRAMACIONES';
const AUDIT_SHEET = '📋 Auditoría de Cambios';
const LOG_SHEET = '📊 Logs del Sistema';
const HISTORY_SHEET = '📈 Historial de Cambios';
const TEMP_SHEET_PREFIX = '📦 TEMP_';
const BATCH_SIZE = 1000;

// ============ SISTEMA DE LOGGING ============

class LoggerSistema {
  static log(mensaje, tipo = 'INFO') {
    const timestamp = new Date().toLocaleString();
    const logMsg = `[${timestamp}] [${tipo}] ${mensaje}`;
    Logger.log(logMsg);
    this.guardarEnHoja(logMsg, tipo);
  }

  static info(mensaje) { this.log(mensaje, 'INFO'); }
  static error(mensaje) { this.log(mensaje, 'ERROR'); }
  static warning(mensaje) { this.log(mensaje, 'WARNING'); }
  static success(mensaje) { this.log(mensaje, 'SUCCESS'); }
  static debug(mensaje) { this.log(mensaje, 'DEBUG'); }

  static guardarEnHoja(mensaje, tipo) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let logHoja = ss.getSheetByName(LOG_SHEET);

      if (!logHoja) {
        logHoja = ss.insertSheet(LOG_SHEET);
        logHoja.appendRow(['Timestamp', 'Tipo', 'Mensaje']);
        logHoja.getRange(1, 1, 1, 3)
          .setFontWeight('bold')
          .setBackground('#1f73e6')
          .setFontColor('white');
      }

      const match = mensaje.match(/\[(.*?)\] \[(.*?)\] (.*)/);
      if (match) {
        const timestamp = match[1];
        const tipoLog = match[2];
        const msg = match[3];
        logHoja.appendRow([timestamp, tipoLog, msg]);

        const ultimaFila = logHoja.getLastRow();
        const colorMap = {
          'ERROR': '#ffcdd2',
          'WARNING': '#fff9c4',
          'SUCCESS': '#c8e6c9',
          'INFO': '#bbdefb',
          'DEBUG': '#f0f0f0'
        };
        logHoja.getRange(ultimaFila, 1, 1, 3).setBackground(colorMap[tipoLog] || '#ffffff');
      }
    } catch (e) {}
  }

  static limpiarLogs() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const logHoja = ss.getSheetByName(LOG_SHEET);
      if (logHoja) {
        logHoja.clearContents();
        logHoja.appendRow(['Timestamp', 'Tipo', 'Mensaje']);
        logHoja.getRange(1, 1, 1, 3)
          .setFontWeight('bold')
          .setBackground('#1f73e6')
          .setFontColor('white');
      }
    } catch (e) {}
  }
}

// ============ MENÚ PRINCIPAL ============

function onOpenMatriz() {
  LoggerSistema.info('🚀 Google Sheets abierto - Sistema iniciado v7.5 Compartido con IA');

  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔗 Cruzar e Importar Datos')
    .addItem('🔄 Importar desde Consolidado_Script', 'importarDatosNormalizados')
    .addSeparator()
    .addItem('➕ Crear nuevo cruce', 'mostrarDialogoNuevoCruce')
    .addItem('📋 Mis cruces configurados', 'mostrarMisCruces')
    .addItem('▶️ Ejecutar cruce ahora', 'ejecutarCruceManual')
    .addItem('⏰ Programar ejecución', 'mostrarDialogoProgramacion')
    .addSeparator()
    .addItem('🧪 Probar URL externa', 'mostrarDialogoPruebaURL')
    .addItem('🧪 Diagnosticar archivo actual', 'probarArchivoEjemplo')
    .addSeparator()
    .addItem('📊 Ver Logs', 'mostrarLogs')
    .addItem('📈 Ver Historial', 'mostrarHistorial')
    .addItem('📋 Ver Auditoría', 'mostrarAuditoria')
    .addSeparator()
    .addItem('🛑 Activar Mantenimiento Web', 'ACTIVAR_MANTENIMIENTO')
    .addItem('✅ Desactivar Mantenimiento Web', 'DESACTIVAR_MANTENIMIENTO')
    .addToUi();
}

// ============ PASO 1: CREAR NUEVO CRUCE ============

function mostrarDialogoNuevoCruce() {
  LoggerSistema.info('📍 Usuario abrió: Crear nuevo cruce');

  const html = HtmlService.createHtmlOutput(`
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial; margin: 0; padding: 20px; background: #f5f5f5; }
      .container { max-width: 550px; }
      h2 { color: #1f73e6; margin-top: 0; }
      .form-group { margin-bottom: 18px; }
      label { display: block; font-weight: 600; margin-bottom: 6px; color: #333; font-size: 13px; }
      input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
      textarea { resize: vertical; min-height: 70px; }
      .error { color: #d32f2f; font-size: 11px; margin-top: 4px; display: none; }
      .info-box { background: #e3f2fd; border: 1px solid #1f73e6; border-radius: 4px; padding: 12px; margin-bottom: 15px; font-size: 12px; color: #1f73e6; }
      .button-group { display: flex; gap: 10px; margin-top: 20px; }
      button { flex: 1; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px; }
      .btn-primary { background-color: #1f73e6; color: white; }
      .btn-secondary { background-color: #e8e8e8; color: #333; }
      .loading { display: none; text-align: center; }
      .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #1f73e6; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .step-indicator { background: #e3f2fd; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 12px; color: #1f73e6; }
      .status-log { background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-size: 11px; font-family: 'Courier New', monospace; max-height: 150px; overflow-y: auto; margin-top: 10px; display: none; }
    </style>
    <div class="container">
      <h2>➕ Crear Nuevo Cruce de Datos</h2>
      <div class="step-indicator">Paso 1 de 6: Conectar archivo externo</div>
      <div class="info-box">
        ℹ️ Pega la URL del archivo externo (Google Sheets o Excel de Drive). El sistema detectará automáticamente el tipo de archivo.
      </div>
      <div id="formulario">
        <div class="form-group">
          <label for="urlArchivo">📎 URL del archivo externo:</label>
          <textarea id="urlArchivo" placeholder="Pega el link aquí..."></textarea>
        </div>
        <div class="form-group">
          <label for="nombreCruce">📝 Nombre para este cruce:</label>
          <input type="text" id="nombreCruce" placeholder="Ej: Cruce Avalúos - Técnico">
        </div>
        <div class="button-group">
          <button class="btn-primary" onclick="cargarHojasDisponibles()">📂 Cargar Hojas</button>
          <button class="btn-secondary" onclick="google.script.host.close()">Cancelar</button>
        </div>
      </div>
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <p>Procesando archivo... (si es Excel puede tardar unos segundos)</p>
        <div class="status-log" id="statusLog"></div>
      </div>
    </div>
    <script>
      function agregarLog(mensaje) {
        const logDiv = document.getElementById('statusLog');
        logDiv.style.display = 'block';
        const logLine = document.createElement('div');
        logLine.textContent = '[' + new Date().toLocaleTimeString() + '] ' + mensaje;
        logDiv.appendChild(logLine);
        logDiv.scrollTop = logDiv.scrollHeight;
      }

      function cargarHojasDisponibles() {
        const url = document.getElementById('urlArchivo').value.trim();
        const nombre = document.getElementById('nombreCruce').value.trim();

        if (!url || !nombre) {
          alert('URL y Nombre son obligatorios');
          return;
        }

        document.getElementById('formulario').style.display = 'none';
        document.getElementById('loading').style.display = 'block';
        agregarLog('Analizando archivo externo...');

        google.script.run
          .withSuccessHandler(function(hojas) {
            agregarLog('✅ ' + hojas.length + ' hoja(s) encontrada(s)');
            google.script.run.mostrarDialogoSeleccionarHoja(url, nombre, hojas);
          })
          .withFailureHandler(function(error) {
            document.getElementById('formulario').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
            alert('❌ Error: ' + error);
          })
          .obtenerHojasDelArchivo(url);
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModalDialog(html, '➕ Nuevo Cruce');
}

function obtenerHojasDelArchivo(url) {
  try {
    const resultado = abrirArchivoComoSpreadsheet(url);
    const ssExterno = resultado.ss;
    const idTemp = resultado.tempId;

    const hojas = ssExterno.getSheets().map(h => ({
      nombre: h.getName(),
      filas: h.getLastRow(),
      columnas: h.getLastColumn()
    }));

    if (idTemp) eliminarArchivoTemporalSeguro(idTemp);

    return hojas;
  } catch (error) {
    LoggerSistema.error('Error al leer hojas: ' + error.toString());
    throw new Error(error.toString());
  }
}

// ============ PASO 2: SELECCIONAR HOJA ============

function mostrarDialogoSeleccionarHoja(url, nombre, hojas) {
  const opcionesHTML = hojas.map(h => `<option value="${escapeHtml_(h.nombre)}">${escapeHtml_(h.nombre)} (${h.filas} filas, ${h.columnas} columnas)</option>`).join('');

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Segoe UI', Arial; padding: 20px; background: #f5f5f5; }
      select { width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ddd; margin-bottom: 12px; }
      .btn-primary { background: #1f73e6; color: white; border: none; padding: 10px; width: 100%; border-radius: 4px; font-weight: bold; margin-top: 15px; cursor: pointer; }
      .info { font-size: 12px; color: #555; margin-bottom: 10px; }
    </style>

    <h3>📂 Seleccionar Hoja</h3>
    <div class="info">Ahora selecciona la hoja del archivo externo.</div>

    <select id="hojaSeleccionada">${opcionesHTML}</select>

    <button class="btn-primary" onclick="continuar()">➡️ Continuar</button>

    <script>
      function continuar() {
        const hoja = document.getElementById('hojaSeleccionada').value;
        google.script.run.mostrarDialogoFilaEncabezados(${JSON.stringify(url)}, ${JSON.stringify(nombre)}, hoja);
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModalDialog(html, '📂 Seleccionar Hoja');
}

// ============ PASO 3: FILA DE ENCABEZADOS ============

function mostrarDialogoFilaEncabezados(url, nombreCruce, nombreHoja) {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Segoe UI', Arial; padding: 20px; background: #f5f5f5; }
      .container { max-width: 420px; }
      h3 { margin-top: 0; color: #1f73e6; }
      .info-box {
        background: #e3f2fd;
        border: 1px solid #90caf9;
        border-radius: 4px;
        padding: 12px;
        font-size: 12px;
        color: #0d47a1;
        margin-bottom: 15px;
      }
      label { display: block; font-weight: 600; margin-bottom: 6px; }
      input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
      .hint { font-size: 11px; color: #666; margin-top: 5px; }
      button { margin-top: 15px; width: 100%; padding: 10px; border: none; border-radius: 4px; background: #1f73e6; color: white; font-weight: bold; cursor: pointer; }
    </style>

    <div class="container">
      <h3>🧾 Fila de Encabezados</h3>

      <div class="info-box">
        Indica en qué fila están los títulos reales de la hoja externa.
        Ejemplos comunes: <b>1</b>, <b>2</b> o <b>3</b>.
      </div>

      <label for="filaEncabezados">Número de fila de encabezados:</label>
      <input type="number" id="filaEncabezados" min="1" value="1">

      <div class="hint">
        El sistema usará esa fila para leer columnas como <b>RT</b>, nombre, estado, etc.
      </div>

      <button onclick="continuar()">📊 Cargar Columnas</button>
    </div>

    <script>
      function continuar() {
        const fila = parseInt(document.getElementById('filaEncabezados').value, 10);

        if (!fila || fila < 1) {
          alert('Debes ingresar un número de fila válido.');
          return;
        }

        google.script.run.prepararColumnasMultiples(
          ${JSON.stringify(url)},
          ${JSON.stringify(nombreCruce)},
          ${JSON.stringify(nombreHoja)},
          fila
        );
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModalDialog(html, '🧾 Fila de Encabezados');
}

// ============ PASO 4: PREPARAR COLUMNAS ============

function prepararColumnasMultiples(url, nombreCruce, nombreHoja, filaEncabezados) {
  let idTemp = null;

  try {
    const resultado = abrirArchivoComoSpreadsheet(url);
    const ssExterno = resultado.ss;
    idTemp = resultado.tempId;

    const hojaExterna = ssExterno.getSheetByName(nombreHoja);
    if (!hojaExterna) throw new Error('No se encontró la hoja externa: ' + nombreHoja);

    const lastColumn = hojaExterna.getLastColumn();
    const lastRow = hojaExterna.getLastRow();

    if (lastColumn === 0) throw new Error('La hoja externa no tiene columnas.');
    if (lastRow < filaEncabezados) throw new Error('La fila de encabezados indicada está fuera del rango de la hoja.');

    const encabezadosExt = hojaExterna.getRange(filaEncabezados, 1, 1, lastColumn).getValues()[0];

    const columnasExternas = encabezadosExt.map((val, idx) => ({
      nombre: String(val).trim() || `Columna ${idx + 1}`,
      letra: numeroAColumna_(idx + 1)
    })).filter(c => c.nombre);

    const ssLocal = SpreadsheetApp.getActiveSpreadsheet();
    const hojaLocal = ssLocal.getSheetByName('Datos') || ssLocal.getSheets()[0];
    const lastColumnLoc = hojaLocal.getLastColumn();

    if (lastColumnLoc === 0) throw new Error('La hoja local no tiene encabezados.');

    const encabezadosLoc = hojaLocal.getRange(1, 1, 1, lastColumnLoc).getValues()[0];
    const columnasDestino = encabezadosLoc.map((val, idx) => ({
      nombre: String(val).trim() || `Columna ${idx + 1}`,
      letra: numeroAColumna_(idx + 1)
    })).filter(c => c.nombre);

    if (idTemp) eliminarArchivoTemporalSeguro(idTemp);

    mostrarDialogoSeleccionarColumnasMultiples(url, nombreCruce, nombreHoja, filaEncabezados, columnasExternas, columnasDestino);
  } catch (error) {
    if (idTemp) eliminarArchivoTemporalSeguro(idTemp);
    throw new Error('Error al preparar columnas: ' + error.toString());
  }
}

// ============ PASO 5: CONFIGURACIÓN DE MAPEOS ============

function mostrarDialogoSeleccionarColumnasMultiples(url, nombre, nombreHoja, filaEncabezados, columnas, columnasDestinoData) {
  const opcionesHTML = columnas.map(c => `<option value="${escapeHtml_(c.nombre)}">${escapeHtml_(c.letra)} - ${escapeHtml_(c.nombre)}</option>`).join('');
  const opcionesDestinoStr = JSON.stringify(columnasDestinoData);

  const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
  const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');
  const mapeosPrevios = (cruces[nombre] && cruces[nombre].mappings) ? cruces[nombre].mappings : [];
  const mapeosPreviosStr = JSON.stringify(mapeosPrevios);

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Segoe UI', Arial; padding: 15px; background: #f5f5f5; }
      .mapping-row { background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .btn-add { background: #34A853; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; }
      .btn-save { background: #1f73e6; color: white; border: none; padding: 12px; width: 100%; border-radius: 4px; font-weight: bold; margin-top: 15px; cursor: pointer; }
      select { padding: 6px; }
      .info { font-size: 12px; color: #555; margin-bottom: 10px; }
    </style>

    <h3>📊 Mapear / Editar Columnas</h3>
    <div class="info">
      Cruce: <b>${escapeHtml_(nombre)}</b><br>
      Hoja externa: <b>${escapeHtml_(nombreHoja)}</b><br>
      Fila de encabezados: <b>${filaEncabezados}</b>
    </div>

    <div style="display:flex; gap:5px; margin-bottom:15px;">
      <select id="colOrigen" style="flex:1; padding:5px;">${opcionesHTML}</select>
      <button class="btn-add" onclick="agregar()">➕ Agregar columna</button>
    </div>

    <div id="lista"></div>

    <button class="btn-save" onclick="guardar()">✅ Guardar Cambios</button>

    <script>
      let mappings = ${mapeosPreviosStr};
      const colsDestino = ${opcionesDestinoStr};

      window.onload = function() {
        dibujar();
      };

      function agregar() {
        const val = document.getElementById('colOrigen').value;
        if (mappings.some(m => m.nombreColumna === val)) return;
        mappings.push({ nombreColumna: val, nombreDestino: colsDestino[0].nombre });
        dibujar();
      }

      function dibujar() {
        const div = document.getElementById('lista');
        div.innerHTML = mappings.map((m, i) => \`
          <div class="mapping-row">
            <span><b>\${m.nombreColumna}</b> → </span>
            <select onchange="mappings[\${i}].nombreDestino = this.value">
              \${colsDestino.map(d => \`<option value="\${d.nombre}" \${d.nombre === m.nombreDestino ? 'selected' : ''}>\${d.nombre}</option>\`).join('')}
            </select>
            <button onclick="mappings.splice(\${i},1); dibujar()" style="background:none; border:none; color:red; cursor:pointer;">✖ Eliminar</button>
          </div>
        \`).join('');
      }

      function guardar() {
        if (mappings.length === 0) {
          alert('Agrega al menos una columna');
          return;
        }

        google.script.run
          .withSuccessHandler(function(r) {
            alert(r);
            google.script.host.close();
          })
          .withFailureHandler(function(error) {
            alert('❌ Error: ' + error);
          })
          .guardarConfiguracionCruceMultiple(
            ${JSON.stringify(url)},
            ${JSON.stringify(nombre)},
            ${JSON.stringify(nombreHoja)},
            ${filaEncabezados},
            mappings
          );
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModalDialog(html, '📊 Configurar Columnas');
}

function guardarConfiguracionCruceMultiple(url, nombre, hoja, filaEncabezados, mappings) {
  try {
    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
    const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');

    cruces[nombre] = {
      url: url,
      hoja: hoja,
      filaEncabezados: Number(filaEncabezados) || 1,
      mappings: mappings,
      fechaCreacion: new Date().toISOString(),
      ultimaEjecucion: null,
      activo: true
    };

    propiedades.setProperty(CONFIG_PROP, JSON.stringify(cruces));

    LoggerSistema.success(`Cruce guardado: ${nombre} con ${mappings.length} mapeo(s). Fila encabezados: ${filaEncabezados}`);
    return `Cruce "${nombre}" guardado correctamente con ${mappings.length} columna(s). Encabezados en fila ${filaEncabezados}.`;
  } catch (e) {
    throw new Error(e.toString());
  }
}

// ============ EJECUCIÓN DEL CRUCE ============

function ejecutarCruce(nombreCruce, esAutomatica = false) {
  const tiempoInicio = new Date();
  let idTemporalCruce = null;

  try {
    LoggerSistema.info('🔄 ========== INICIANDO EJECUCIÓN DEL CRUCE ==========');
    LoggerSistema.info(`Cruce: ${nombreCruce} | Modo: ${esAutomatica ? 'Automático' : 'Manual'}`);

    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
    const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');
    const config = cruces[nombreCruce];

    if (!config) throw new Error('Cruce no encontrado: ' + nombreCruce);

    const filaEncabezados = Number(config.filaEncabezados) || 1;
    const indiceEncabezado = filaEncabezados - 1;
    const indicePrimerDato = filaEncabezados;

    const resultadoApertura = abrirArchivoComoSpreadsheet(config.url);
    const ssExterno = resultadoApertura.ss;
    idTemporalCruce = resultadoApertura.tempId;

    const hojaExterna = ssExterno.getSheetByName(config.hoja);
    if (!hojaExterna) throw new Error('No se encontró la hoja externa configurada: ' + config.hoja);

    const rangoExterno = hojaExterna.getDataRange();
    const datosExternos = rangoExterno.getValues();
    
    if (!datosExternos || datosExternos.length === 0) {
      throw new Error('La hoja externa no tiene datos.');
    }
    if (datosExternos.length <= indiceEncabezado) {
      throw new Error('La fila de encabezados configurada está fuera del rango.');
    }

    // ====================================================================
    // DESCOMBINAR EN MEMORIA
    // ====================================================================
    const mergedRanges = rangoExterno.getMergedRanges();
    for (let i = 0; i < mergedRanges.length; i++) {
      const merge = mergedRanges[i];
      const startRow = merge.getRow() - 1; 
      const startCol = merge.getColumn() - 1; 
      const numRows = merge.getNumRows();
      const numCols = merge.getNumColumns();
      
      if (startRow < datosExternos.length && startCol < datosExternos[0].length) {
        const valorCombinado = datosExternos[startRow][startCol];
        for (let r = 0; r < numRows; r++) {
          for (let c = 0; c < numCols; c++) {
            if (startRow + r < datosExternos.length && startCol + c < datosExternos[0].length) {
              datosExternos[startRow + r][startCol + c] = valorCombinado;
            }
          }
        }
      }
    }

    const ssLocal = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ssLocal.getSpreadsheetTimeZone(); 
    const hojaLocal = ssLocal.getSheetByName('Datos') || ssLocal.getSheets()[0];
    
    const rangoLocal = hojaLocal.getDataRange();
    const datosLocales = rangoLocal.getValues();
    const formulasLocales = rangoLocal.getFormulas(); 

    if (!datosLocales || datosLocales.length === 0) {
      throw new Error('La hoja local no tiene datos.');
    }

    const columnasProtegidas = new Set();
    for (let c = 0; c < formulasLocales[0].length; c++) {
      for (let r = 0; r < formulasLocales.length; r++) {
        if (formulasLocales[r][c] !== '') {
          columnasProtegidas.add(c);
          break;
        }
      }
    }

    const encabezadosExtOriginal = datosExternos[indiceEncabezado].map(h => String(h || '').trim());
    const encabezadosExt = encabezadosExtOriginal.map(h => normalizarEncabezado_(h));

    const encabezadosLocOriginal = datosLocales[0].map(h => String(h || '').trim());
    const encabezadosLoc = encabezadosLocOriginal.map(h => normalizarEncabezado_(h));

    let idxRTExt = encabezadosExt.indexOf('RT');
    if (idxRTExt === -1) {
      LoggerSistema.warning('⚠️ No se encontró columna RT exacta en hoja externa. Se usará la columna A como fallback.');
      idxRTExt = 0;
    }

    let idxRTLoc = encabezadosLoc.indexOf('RT');
    if (idxRTLoc === -1) {
      LoggerSistema.warning('⚠️ No se encontró columna RT exacta en hoja local. Se usará la columna A como fallback.');
      idxRTLoc = 0;
    }

    MotorAprendizajeRT.inicializar();

    // ====================================================================
    // ALGORITMO: Agrupación Estricta por Fila para simetría 1:N
    // ====================================================================
    const datosAgrupadosPorRT = {};
    let ultimaClaveMapeo = '';
    
    for (let i = indicePrimerDato; i < datosExternos.length; i++) {
      let claveCruda = datosExternos[i][idxRTExt];
      let clave = normalizarValorClave_(claveCruda);

      if (clave !== '') {
        ultimaClaveMapeo = clave;
      } else {
        clave = ultimaClaveMapeo; 
      }

      if (clave === '') continue; 

      let filaTieneDatos = false;
      let valoresDeFila = {};

      config.mappings.forEach(m => {
        const nombreOrigenNormalizado = normalizarEncabezado_(m.nombreColumna);
        const idx = encabezadosExt.indexOf(nombreOrigenNormalizado);
        
        if (idx !== -1) {
          const rawValor = datosExternos[i][idx];
          let valorStr = '';

          if (Object.prototype.toString.call(rawValor) === '[object Date]' && !isNaN(rawValor)) {
            valorStr = Utilities.formatDate(rawValor, tz, 'dd/MM/yyyy');
          } else {
            valorStr = String(rawValor || '').trim();
          }

          valoresDeFila[m.nombreColumna] = valorStr;
          if (valorStr !== '') filaTieneDatos = true;
        }
      });

      if (filaTieneDatos) {
        if (!datosAgrupadosPorRT[clave]) {
          datosAgrupadosPorRT[clave] = [];
        }
        
        const filaString = JSON.stringify(valoresDeFila);
        const esDuplicada = datosAgrupadosPorRT[clave].some(f => JSON.stringify(f) === filaString);
        
        if (!esDuplicada) {
          datosAgrupadosPorRT[clave].push(valoresDeFila);
        }
      }
    }

    const diccionarios = {};
    const llavesDisponibles = {}; 
    let totalClavesExternas = Object.keys(datosAgrupadosPorRT).length;

    config.mappings.forEach(m => {
      diccionarios[m.nombreColumna] = {};
      llavesDisponibles[m.nombreColumna] = Object.keys(datosAgrupadosPorRT);
      
      for (const clave in datosAgrupadosPorRT) {
        const arregloFilas = datosAgrupadosPorRT[clave];
        
        if (arregloFilas.length > 1) {
          diccionarios[m.nombreColumna][clave] = arregloFilas.map((fila, index) => {
            let val = fila[m.nombreColumna];
            return val ? `${index + 1}. ${val}` : `${index + 1}. -`;
          }).join('\n');
        } else if (arregloFilas.length === 1) {
          diccionarios[m.nombreColumna][clave] = arregloFilas[0][m.nombreColumna] || "";
        }
      }
      LoggerSistema.info(`✅ Diccionario mapeado para "${m.nombreColumna}" con simetría asegurada.`);
    });

    let cambios = 0;
    let nuevos = 0;
    let coincidenciasRT = 0;
    const auditoria = [];

    for (let f = 1; f < datosLocales.length; f++) {
      const claveRT = normalizarValorClave_(datosLocales[f][idxRTLoc]);
      if (claveRT === '') continue;

      let huboCoincidenciaEnFila = false;

      config.mappings.forEach(m => {
        const idxDestino = encabezadosLoc.indexOf(normalizarEncabezado_(m.nombreDestino));
        
        if (idxDestino === -1) {
          LoggerSistema.warning(`⚠️ No se encontró columna destino local: ${m.nombreDestino}`);
          return;
        }

        if (columnasProtegidas.has(idxDestino)) return;

        const mapa = diccionarios[m.nombreColumna];
        if (!mapa) return;

        const llavesExternas = llavesDisponibles[m.nombreColumna];
        const resultadoIA = MotorAprendizajeRT.evaluar(claveRT, llavesExternas, mapa, esAutomatica);
        
        if (!resultadoIA) return; 

        huboCoincidenciaEnFila = true;

        const valAnt = datosLocales[f][idxDestino];
        const valNuevo = resultadoIA.valor; 

        const textoAnt = normalizarComparacion_(valAnt);
        const textoNuevo = normalizarComparacion_(valNuevo);

        if (textoNuevo === '') return;

        if (textoAnt !== textoNuevo) {
          if (textoAnt === '') nuevos++;
          else cambios++;

          datosLocales[f][idxDestino] = valNuevo;

          auditoria.push([
            new Date().toLocaleString(),
            nombreCruce,
            claveRT,
            m.nombreDestino,
            valAnt,
            valNuevo,
            'Actualizado (Indexado Simétrico)'
          ]);
        }
      });

      if (huboCoincidenciaEnFila) {
        coincidenciasRT++;
      }
    }

    for (let r = 0; r < datosLocales.length; r++) {
      for (let c = 0; c < datosLocales[r].length; c++) {
        if (columnasProtegidas.has(c)) {
          if (formulasLocales[r][c] !== '') {
            datosLocales[r][c] = formulasLocales[r][c];
          } else if (r > 0) {
            datosLocales[r][c] = '';
          }
        } else {
          if (formulasLocales[r][c] !== '') {
            datosLocales[r][c] = formulasLocales[r][c];
          }
        }
      }
    }

    hojaLocal.getRange(1, 1, datosLocales.length, datosLocales[0].length).setValues(datosLocales);

    if (auditoria.length > 0) {
      const auditHoja = asegurarHojaAuditoria_(ssLocal);
      for (let i = 0; i < auditoria.length; i += BATCH_SIZE) {
        const lote = auditoria.slice(i, i + BATCH_SIZE);
        auditHoja.getRange(auditHoja.getLastRow() + 1, 1, lote.length, 7).setValues(lote);
      }
    }

    const duracion = ((new Date() - tiempoInicio) / 1000).toFixed(2);

    registrarHistorial_(ssLocal, {
      fecha: new Date(),
      cruce: nombreCruce,
      cambios: cambios,
      nuevos: nuevos,
      duracion: duracion,
      estado: `OK | RT coincidentes: ${coincidenciasRT} | Bloques asimilados: ${totalClavesExternas}`
    });

    cruces[nombreCruce].ultimaEjecucion = new Date().toISOString();
    propiedades.setProperty(CONFIG_PROP, JSON.stringify(cruces));
    
    MotorAprendizajeRT.guardarSiHayCambios(); 

    if (idTemporalCruce) eliminarArchivoTemporalSeguro(idTemporalCruce);

    LoggerSistema.success(`🎉 Cruce finalizado. Coincidencias RT: ${coincidenciasRT}, Cambios: ${cambios}, Nuevos: ${nuevos}`);

    return `✅ Ejecutado correctamente\nCoincidencias RT: ${coincidenciasRT}\nCambios: ${cambios}\nNuevos: ${nuevos}`;
  } catch (e) {
    if (idTemporalCruce) eliminarArchivoTemporalSeguro(idTemporalCruce);

    try {
      const ssLocal = SpreadsheetApp.getActiveSpreadsheet();
      registrarHistorial_(ssLocal, {
        fecha: new Date(),
        cruce: nombreCruce,
        cambios: 0,
        nuevos: 0,
        duracion: ((new Date() - tiempoInicio) / 1000).toFixed(2),
        estado: 'ERROR: ' + e.toString()
      });
    } catch (_) {}

    LoggerSistema.error('❌ Error en ejecución: ' + e.toString());
    throw e;
  }
}

// ============ UTILIDADES DE ARCHIVOS ============

function extraerIdDelURL(url) {
  const patrones = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /[?&]id=([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]{20,})$/
  ];

  for (const patron of patrones) {
    const match = String(url).match(patron);
    if (match && match[1]) return match[1];
  }

  throw new Error('URL o ID inválido. Usa un enlace de Google Sheets o Drive.');
}

function abrirArchivoComoSpreadsheet(urlOId) {
  const id = extraerIdDelURL(urlOId);
  const file = DriveApp.getFileById(id);
  const mime = file.getMimeType();

  LoggerSistema.info(`Archivo detectado: ${file.getName()} | MIME: ${mime}`);

  if (mime === 'application/vnd.google-apps.spreadsheet') {
    return {
      ss: SpreadsheetApp.openById(id),
      tempId: null,
      originalId: id,
      mimeType: mime
    };
  }

  const tempId = convertirExcelASheetTemporal(id);
  if (!tempId) {
    throw new Error('No se pudo convertir el archivo a Google Sheets.');
  }

  return {
    ss: SpreadsheetApp.openById(tempId),
    tempId: tempId,
    originalId: id,
    mimeType: mime
  };
}

function convertirExcelASheetTemporal(idArchivo) {
  try {
    const file = DriveApp.getFileById(idArchivo);
    const mime = file.getMimeType();
    const nombre = file.getName();

    LoggerSistema.info(`Intentando conversión temporal: ${nombre} | MIME: ${mime}`);

    const mimeExcelValidos = [
      MimeType.MICROSOFT_EXCEL,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroenabled.12'
    ];

    if (mime === 'application/vnd.google-apps.spreadsheet') {
      return idArchivo;
    }

    if (!mimeExcelValidos.includes(mime)) {
      throw new Error('Formato no soportado para conversión. MIME: ' + mime);
    }

    const blob = file.getBlob().setName(nombre);

    const recurso = {
      name: 'TEMP_CROSS_' + nombre,
      mimeType: 'application/vnd.google-apps.spreadsheet'
    };

    const convertido = Drive.Files.create(recurso, blob);
    LoggerSistema.success('Conversición temporal exitosa. ID: ' + convertido.id);

    return convertido.id;
  } catch (e) {
    LoggerSistema.error('Fallo crítico convirtiendo Excel: ' + e.toString());
    return null;
  }
}

function eliminarArchivoTemporalSeguro(fileId) {
  try {
    if (!fileId) return;
    DriveApp.getFileById(fileId).setTrashed(true);
    LoggerSistema.info('Temporal eliminado: ' + fileId);
  } catch (e) {
    LoggerSistema.warning('No se pudo eliminar temporal: ' + e.toString());
  }
}

// ============ MIS CRUCES CONFIGURADOS ============

function mostrarMisCruces() {
  try {
    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
    const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');

    if (Object.keys(cruces).length === 0) {
      SpreadsheetApp.getUi().alert('⚠️ No hay cruces configurados.\nCrea uno nuevo desde el menú.');
      return;
    }

    let html = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 700px; }
        h2 { color: #1f73e6; margin-top: 0; }
        .cruce-item { background: white; border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .cruce-nombre { font-weight: 600; color: #1f73e6; margin-bottom: 8px; font-size: 14px; }
        .cruce-info { font-size: 12px; color: #666; margin: 4px 0; }
        .cruce-mapeos { font-size: 11px; color: #555; margin: 8px 0; padding: 8px; background: #f9f9f9; border-left: 3px solid #1f73e6; }
        .cruce-botones { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; }
        .btn-ejecutar { background-color: #34A853; color: white; }
        .btn-editar { background-color: #ff9800; color: white; }
        .btn-eliminar { background-color: #ea4335; color: white; }
        .btn-programar { background-color: #4285f4; color: white; }
      </style>
      <div class="container">
        <h2>📋 Mis Cruces Configurados (${Object.keys(cruces).length})</h2>
    `;

    for (const [nombre, config] of Object.entries(cruces)) {
      const ultima = config.ultimaEjecucion ? new Date(config.ultimaEjecucion).toLocaleString() : 'Nunca';
      const numMapeos = config.mappings ? config.mappings.length : 0;
      const filaEnc = config.filaEncabezados || 1;
      const mapeoDescripcion = config.mappings
        ? config.mappings.map(m => `<b>${escapeHtml_(m.nombreColumna)}</b> → Destino: <b>${escapeHtml_(m.nombreDestino)}</b>`).join('<br>🔗 ')
        : 'Mapeo antiguo';

      const nombreJs = escapeJsString_(nombre);

      html += `
        <div class="cruce-item">
          <div class="cruce-nombre">✓ ${escapeHtml_(nombre)}</div>
          <div class="cruce-info">📂 Hoja Externa: ${escapeHtml_(config.hoja || '')}</div>
          <div class="cruce-info">🧾 Fila encabezados externa: ${filaEnc}</div>
          <div class="cruce-info">📍 Mapeos Activos: ${numMapeos}</div>
          <div class="cruce-mapeos">🔗 ${mapeoDescripcion}</div>
          <div class="cruce-info">⏱️ Última ejecución: ${escapeHtml_(ultima)}</div>
          <div class="cruce-botones">
            <button class="btn-ejecutar" onclick="ejecutarCruceAhora('${nombreJs}')">▶️ Ejecutar</button>
            <button class="btn-editar" onclick="editarCruceUI('${nombreJs}')">⚙️ Editar mapeos</button>
            <button class="btn-programar" onclick="programarCruce('${nombreJs}')">⏰ Programar</button>
            <button class="btn-eliminar" onclick="eliminarCruceUI('${nombreJs}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    }

    html += `
      </div>
      <script>
        function ejecutarCruceAhora(nombre) {
          google.script.run
            .withSuccessHandler(function(resultado) {
              alert('✅ ' + resultado);
              location.reload();
            })
            .withFailureHandler(function(error) {
              alert('❌ Error: ' + error);
            })
            .ejecutarCruce(nombre);
        }

        function editarCruceUI(nombre) {
          google.script.host.close();
          google.script.run.iniciarEdicionCruce(nombre);
        }

        function programarCruce(nombre) {
          google.script.host.close();
          google.script.run.mostrarDialogoProgramacion();
        }

        function eliminarCruceUI(nombre) {
          if (confirm('¿Estás seguro? Se eliminará la configuración del cruce.')) {
            google.script.run
              .withSuccessHandler(function() {
                alert('✅ Cruce eliminado');
                location.reload();
              })
              .withFailureHandler(function(error) {
                alert('❌ Error: ' + error);
              })
              .eliminarCruce(nombre);
          }
        }
      </script>
    `;

    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(html), '📋 Mis Cruces');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + error.toString());
  }
}

function iniciarEdicionCruce(nombreCruce) {
  try {
    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
    const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');
    const config = cruces[nombreCruce];
    
    if (!config) throw new Error('No se encontró la configuración del cruce.');
    
    LoggerSistema.info(`🔧 Editando el cruce existente: ${nombreCruce}`);
    prepararColumnasMultiples(config.url, nombreCruce, config.hoja, config.filaEncabezados);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error al editar: ' + error.toString());
  }
}

// ============ EJECUTAR CRUCE MANUAL ============

function ejecutarCruceManual() {
  const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
  const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');
  const nombres = Object.keys(cruces);

  if (nombres.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ No hay cruces configurados');
    return;
  }

  const opcionesHTML = nombres.map(n => `<option value="${escapeHtml_(n)}">${escapeHtml_(n)}</option>`).join('');

  const html = HtmlService.createHtmlOutput(`
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial; margin: 0; padding: 20px; background: #f5f5f5; }
      .container { max-width: 400px; }
      h2 { color: #1f73e6; margin-top: 0; }
      .form-group { margin-bottom: 15px; }
      label { display: block; font-weight: 600; margin-bottom: 6px; }
      select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
      .button-group { display: flex; gap: 10px; margin-top: 20px; }
      button { flex: 1; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
      .btn-primary { background-color: #34A853; color: white; }
      .btn-secondary { background-color: #e8e8e8; color: #333; }
      .loading { display: none; text-align: center; }
      .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #34A853; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .status-log { background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-size: 11px; font-family: 'Courier New', monospace; max-height: 200px; overflow-y: auto; margin-top: 10px; display: none; }
      .log-line { margin: 2px 0; padding: 2px; }
      .log-info { color: #1f73e6; }
      .log-success { color: #34A853; }
      .log-error { color: #ea4335; }
    </style>
    <div class="container">
      <h2>▶️ Ejecutar Cruce</h2>
      <div id="formulario">
        <div class="form-group">
          <label for="cruceName">Selecciona un cruce:</label>
          <select id="cruceName">${opcionesHTML}</select>
        </div>
        <div class="button-group">
          <button class="btn-primary" onclick="ejecutar()">▶️ Ejecutar Ahora</button>
          <button class="btn-secondary" onclick="google.script.host.close()">Cancelar</button>
        </div>
      </div>
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <p>Ejecutando cruce...</p>
        <div class="status-log" id="statusLog"></div>
      </div>
    </div>
    <script>
      function agregarLog(mensaje, tipo = 'info') {
        const logDiv = document.getElementById('statusLog');
        logDiv.style.display = 'block';
        const logLine = document.createElement('div');
        logLine.className = 'log-line log-' + tipo;
        logLine.textContent = '[' + new Date().toLocaleTimeString() + '] ' + mensaje;
        logDiv.appendChild(logLine);
        logDiv.scrollTop = logDiv.scrollHeight;
      }

      function ejecutar() {
        const nombre = document.getElementById('cruceName').value;
        document.getElementById('formulario').style.display = 'none';
        document.getElementById('loading').style.display = 'block';
        agregarLog('Iniciando ejecución del cruce: ' + nombre, 'info');

        google.script.run
          .withSuccessHandler(function(resultado) {
            agregarLog('✅ ' + resultado, 'success');
            setTimeout(() => {
              alert(resultado);
              google.script.host.close();
            }, 1200);
          })
          .withFailureHandler(function(error) {
            document.getElementById('formulario').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
            agregarLog('❌ Error: ' + error, 'error');
            alert('❌ Error: ' + error);
          })
          .ejecutarCruce(nombre);
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModalDialog(html, '▶️ Ejecutar Cruce');
}

// ============ PROGRAMAR EJECUCIÓN ============

function mostrarDialogoProgramacion() {
  const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
  const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');
  const nombres = Object.keys(cruces);

  if (nombres.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ No hay cruces configurados. Primero debes crear un cruce antes de programarlo.');
    return;
  }

  const programacionesActivas = JSON.parse(propiedades.getProperty(PROGRAMACIONES_PROP) || '{}');
  
  const opcionesHTML = nombres.map(n => `<option value="${escapeHtml_(n)}">${escapeHtml_(n)}</option>`).join('');

  let filasProgramacionesHTML = '';
  if (Object.keys(programacionesActivas).length === 0) {
    filasProgramacionesHTML = `<tr><td colspan="4" style="text-align:center; color:#888;">No hay ejecuciones automáticas programadas actualmente.</td></tr>`;
  } else {
    for (const [nombre, prog] of Object.entries(programacionesActivas)) {
      if (prog.activa) {
        let detalleFrecuencia = prog.frecuencia;
        if (prog.frecuencia === 'horaria') detalleFrecuencia = 'Cada hora';
        if (prog.frecuencia === 'cada2horas') detalleFrecuencia = 'Cada 2 horas';
        if (prog.frecuencia === 'cada4horas') detalleFrecuencia = 'Cada 4 horas';
        if (prog.frecuencia === 'cada6horas') detalleFrecuencia = 'Cada 6 horas';
        if (prog.frecuencia === 'diaria') detalleFrecuencia = `Diario a las ${prog.horaProgramada || '12:00'}`;

        const nombreJs = escapeJsString_(nombre);

        filasProgramacionesHTML += `
          <tr>
            <td><strong>${escapeHtml_(nombre)}</strong></td>
            <td><span class="badge-active">● Activo</span></td>
            <td>${escapeHtml_(detalleFrecuencia)}</td>
            <td>
              <button class="btn-tabla-eliminar" onclick="eliminarProgramacionUI('${nombreJs}')" title="Quitar programación automática">✖</button>
            </td>
          </tr>
        `;
      }
    }
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial; margin: 0; padding: 15px; background: #f5f5f5; color: #333; }
      .container { max-width: 500px; }
      h2, h3 { color: #4285f4; margin-top: 0; margin-bottom: 10px; }
      h3 { border-bottom: 2px solid #4285f4; padding-bottom: 5px; margin-top: 25px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;}
      .form-group { margin-bottom: 12px; }
      label { display: block; font-weight: 600; margin-bottom: 4px; color: #333; font-size: 13px; }
      input, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
      .info { color: #666; font-size: 11px; margin-top: 2px; }
      .warning-box { background: #fff3cd; color: #856404; padding: 8px; border-radius: 4px; font-size: 11px; margin-top: 5px; border-left: 3px solid #ffeeba; }
      .button-group { display: flex; gap: 10px; margin-top: 15px; }
      button { padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px; }
      .btn-primary { background-color: #4285f4; color: white; flex: 2; }
      .btn-secondary { background-color: #e8e8e8; color: #333; flex: 1; }
      
      .tabla-contenedor { background: white; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin-top: 10px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
      th { background: #eaedf2; padding: 8px; font-weight: 600; color: #555; }
      td { padding: 8px; border-top: 1px solid #eee; vertical-align: middle; }
      .badge-active { color: #2e7d32; font-weight: bold; background: #e8f5e9; padding: 2px 6px; border-radius: 10px; font-size: 10px; }
      .btn-tabla-eliminar { background: none; border: none; color: #ea4335; font-size: 14px; cursor: pointer; padding: 2px 6px; font-weight: bold; }
      .btn-tabla-eliminar:hover { background: #fbe9e7; border-radius: 4px; }
    </style>
    
    <div class="container">
      <h2>⏰ Programar Ejecución</h2>
      
      <div class="form-group">
        <label for="cruceName">Selecciona un cruce para activar/modificar automatización:</label>
        <select id="cruceName">${opcionesHTML}</select>
      </div>

      <div class="form-group">
        <label for="frecuencia">Frecuencia de ejecución:</label>
        <select id="frecuencia" onchange="actualizarOpciones()">
          <option value="horaria">Cada hora</option>
          <option value="cada2horas">Cada 2 horas</option>
          <option value="cada4horas">Cada 4 horas</option>
          <option value="cada6horas">Cada 6 horas</option>
          <option value="diaria">Diariamente a una hora exacta</option>
        </select>
      </div>

      <div class="form-group" id="grupoHora" style="display:none;">
        <label for="horaMinuto">Hora exacta (HH:MM):</label>
        <input type="time" id="horaMinuto" value="12:00">
        <div class="warning-box">
          ⚠️ Apps Script maneja ventanas de tiempo aproximadas (±15 min) para ejecuciones diarias.
        </div>
      </div>

      <div class="button-group">
        <button class="btn-primary" onclick="guardarProgramacionUI()">💾 Guardar Programación</button>
        <button class="btn-secondary" onclick="google.script.host.close()">Cerrar</button>
      </div>

      <h3>📋 Relojes Automáticos Configurados</h3>
      <div class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Cruce</th>
              <th>Estado</th>
              <th>Horario / Frecuencia</th>
              <th style="width: 40px;"></th>
            </tr>
          </thead>
          <tbody>
            ${filasProgramacionesHTML}
          </tbody>
        </table>
      </div>
    </div>

    <script>
      document.addEventListener("DOMContentLoaded", function() {
        actualizarOpciones();
      });

      function actualizarOpciones() {
        const frecuencia = document.getElementById('frecuencia').value;
        document.getElementById('grupoHora').style.display = frecuencia === 'diaria' ? 'block' : 'none';
      }

      function guardarProgramacionUI() {
        const nombre = document.getElementById('cruceName').value;
        const frecuencia = document.getElementById('frecuencia').value;
        const horaMinuto = document.getElementById('horaMinuto').value;

        if (frecuencia === 'diaria' && !horaMinuto) {
          alert('Debes definir una hora exacta.');
          return;
        }

        google.script.run
          .withSuccessHandler(function(resultado) {
            alert('✅ ' + resultado);
            google.script.run.mostrarDialogoProgramacion();
          })
          .withFailureHandler(function(error) {
            alert('❌ Error: ' + error);
          })
          .guardarProgramacion(nombre, frecuencia, horaMinuto);
      }

      function eliminarProgramacionUI(nombre) {
        if (confirm('¿Deseas desactivar por completo la ejecución automática de "' + nombre + '"?\\nEl cruce seguirá existiendo, pero ya no se ejecutará solo.')) {
          google.script.run
            .withSuccessHandler(function(resultado) {
              alert(resultado);
              google.script.run.mostrarDialogoProgramacion();
            })
            .withFailureHandler(function(error) {
              alert('❌ Error: ' + error);
            })
            .removerProgramacionCruce(nombre);
        }
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModalDialog(html, '⏰ Programador del Sistema');
}

function guardarProgramacion(nombreCruce, frecuencia, horaMinuto) {
  try {
    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
    const programaciones = JSON.parse(propiedades.getProperty(PROGRAMACIONES_PROP) || '{}');

    programaciones[nombreCruce] = {
      frecuencia: frecuencia,
      horaProgramada: horaMinuto,
      activa: true,
      fechaCreacion: new Date().toISOString()
    };

    propiedades.setProperty(PROGRAMACIONES_PROP, JSON.stringify(programaciones));

    const msjTrigger = crearTriggers(nombreCruce, frecuencia, horaMinuto);
    return `Programación guardada.\nFrecuencia: ${frecuencia}\n${msjTrigger}`;
  } catch (error) {
    throw new Error('Error al guardar programación: ' + error.toString());
  }
}

function removerProgramacionCruce(nombreCruce) {
  try {
    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
    const programaciones = JSON.parse(propiedades.getProperty(PROGRAMACIONES_PROP) || '{}');

    if (programaciones[nombreCruce]) {
      delete programaciones[nombreCruce];
      propiedades.setProperty(PROGRAMACIONES_PROP, JSON.stringify(programaciones));
      
      LoggerSistema.warning(`⏰ Automatización removida para: ${nombreCruce}`);

      const clavesRestantes = Object.keys(programaciones);
      
      if (clavesRestantes.length === 0) {
        const triggers = ScriptApp.getProjectTriggers();
        triggers.forEach(t => {
          if (t.getHandlerFunction() === 'ejecutarCruceAutomatico') {
            ScriptApp.deleteTrigger(t);
          }
        });
        return `✅ Automatización desactivada para "${nombreCruce}".\nNo quedan más cruces programados automáticos.`;
      } else {
        const primerCruceRestante = clavesRestantes[0];
        const configRestante = programaciones[primerCruceRestante];
        crearTriggers(primerCruceRestante, configRestante.frecuencia, configRestante.horaProgramada);
        
        return `✅ Automatización desactivada para "${nombreCruce}".\nEl resto de configuraciones siguen activas.`;
      }
    }
    return 'El cruce seleccionado no tenía una programación activa.';
  } catch (error) {
    throw new Error('Error al remover la programación: ' + error.toString());
  }
}

function crearTriggers(nombreCruce, frecuencia, horaMinuto) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === 'ejecutarCruceAutomatico') {
        ScriptApp.deleteTrigger(t);
      }
    });

    let mensajeInfo = '';

    if (frecuencia === 'horaria') {
      ScriptApp.newTrigger('ejecutarCruceAutomatico').timeBased().everyHours(1).create();
      mensajeInfo = 'Ejecución: cada hora.';
    } else if (frecuencia === 'cada2horas') {
      ScriptApp.newTrigger('ejecutarCruceAutomatico').timeBased().everyHours(2).create();
      mensajeInfo = 'Ejecución: cada 2 horas.';
    } else if (frecuencia === 'cada4horas') {
      ScriptApp.newTrigger('ejecutarCruceAutomatico').timeBased().everyHours(4).create();
      mensajeInfo = 'Ejecución: cada 4 horas.';
    } else if (frecuencia === 'cada6horas') {
      ScriptApp.newTrigger('ejecutarCruceAutomatico').timeBased().everyHours(6).create();
      mensajeInfo = 'Ejecución: cada 6 horas.';
    } else if (frecuencia === 'diaria') {
      let [hh, mm] = horaMinuto.split(':');
      hh = parseInt(hh, 10);
      let min = parseInt(mm, 10);

      min = Math.round(min / 15) * 15;
      if (min === 60) {
        min = 0;
        hh = (hh + 1) % 24;
      }

      ScriptApp.newTrigger('ejecutarCruceAutomatico')
        .timeBased()
        .atHour(hh)
        .nearMinute(min)
        .everyDays(1)
        .create();

      mensajeInfo = `Ajustado a las ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')} por restricciones de Google.`;
    }

    return mensajeInfo;
  } catch (error) {
    throw new Error('Error al crear triggers: ' + error.toString());
  }
}

function ejecutarCruceAutomatico() {
  try {
    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script
    const programaciones = JSON.parse(propiedades.getProperty(PROGRAMACIONES_PROP) || '{}');

    for (const [nombre, config] of Object.entries(programaciones)) {
      if (config.activa) {
        try {
          ejecutarCruce(nombre, true); 
        } catch (error) {
          LoggerSistema.error(`❌ ${nombre}: ${error.toString()}`);
        }
      }
    }
  } catch (error) {
    LoggerSistema.error('❌ Error en ejecución automática: ' + error.toString());
  }
}

// ============ ELIMINAR CRUCE ============

function eliminarCruce(nombre) {
  try {
    const propiedades = PropertiesService.getScriptProperties(); // Cambio a propiedad de script

    const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');
    if (cruces[nombre]) {
      delete cruces[nombre];
      propiedades.setProperty(CONFIG_PROP, JSON.stringify(cruces));
    }

    const programaciones = JSON.parse(propiedades.getProperty(PROGRAMACIONES_PROP) || '{}');
    if (programaciones[nombre]) {
      delete programaciones[nombre];
      propiedades.setProperty(PROGRAMACIONES_PROP, JSON.stringify(programaciones));
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tempHoja = ss.getSheetByName(TEMP_SHEET_PREFIX + nombre);
    if (tempHoja) ss.deleteSheet(tempHoja);

    LoggerSistema.success('Cruce eliminado: ' + nombre);
  } catch (error) {
    throw new Error('Error al eliminar: ' + error.toString());
  }
}

// ============ LOGS / HISTORIAL / AUDITORÍA ============

function mostrarLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logHoja = ss.getSheetByName(LOG_SHEET);

  if (!logHoja) {
    SpreadsheetApp.getUi().alert('⚠️ No hay logs');
    return;
  }

  const datos = logHoja.getDataRange().getValues();
  let html = `
    <style>
      body { font-family:'Courier New', monospace; background:#1e1e1e; color:#d4d4d4; padding:20px; }
      table { width:100%; border-collapse:collapse; }
      th { background:#1f73e6; color:white; padding:10px; text-align:left; }
      td { padding:8px; border-bottom:1px solid #333; }
      .log-ERROR { background:#ffcdd2; color:#c62828; }
      .log-WARNING { background:#fff9c4; color:#f57f17; }
      .log-SUCCESS { background:#c8e6c9; color:#2e7d32; }
      button { padding:10px 20px; margin-right:10px; cursor:pointer; border-radius:4px; border:none; }
      .btn-limpiar { background:#ea4335; color:white; }
    </style>
    <h2>📊 Logs</h2>
    <table>
      <thead>
        <tr><th>Timestamp</th><th>Tipo</th><th>Mensaje</th></tr>
      </thead>
      <tbody>
  `;

  for (let i = datos.length - 1; i >= 1; i--) {
    html += `<tr class="log-${datos[i][1]}"><td>${escapeHtml_(datos[i][0])}</td><td><strong>${escapeHtml_(datos[i][1])}</strong></td><td>${escapeHtml_(datos[i][2])}</td></tr>`;
  }

  html += `
      </tbody>
    </table>
    <br>
    <button class="btn-limpiar" onclick="google.script.run.withSuccessHandler(()=>google.script.host.close()).limpiarLogsDelSistema()">🗑️ Limpiar Logs</button>
    <button onclick="google.script.host.close()">Cerrar</button>
  `;

  SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(html), '📊 Logs');
}

function mostrarHistorial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historyHoja = ss.getSheetByName(HISTORY_SHEET);

  if (!historyHoja) {
    SpreadsheetApp.getUi().alert('⚠️ No hay historial');
    return;
  }

  const datos = historyHoja.getDataRange().getValues();
  let html = `
    <style>
      body { font-family:'Segoe UI', Arial; padding:20px; }
      table { width:100%; border-collapse:collapse; }
      th { background:#4CAF50; color:white; padding:10px; text-align:left; }
      td { padding:8px; border-bottom:1px solid #ddd; }
    </style>
    <h2>📈 Historial</h2>
    <table>
      <thead>
        <tr><th>Fecha</th><th>Cruce</th><th>Cambios</th><th>Nuevos</th><th>Duración</th><th>Estado</th></tr>
      </thead>
      <tbody>
  `;

  for (let i = datos.length - 1; i >= 1; i--) {
    html += `<tr>
      <td>${escapeHtml_(datos[i][0])}</td>
      <td>${escapeHtml_(datos[i][1])}</td>
      <td>${escapeHtml_(datos[i][2])}</td>
      <td>${escapeHtml_(datos[i][3])}</td>
      <td>${escapeHtml_(datos[i][4])}s</td>
      <td>${escapeHtml_(datos[i][5])}</td>
    </tr>`;
  }

  html += `</tbody></table><br><button onclick="google.script.host.close()">Cerrar</button>`;
  SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(html), '📈 Historial');
}

function mostrarAuditoria() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const auditHoja = ss.getSheetByName(AUDIT_SHEET);

  if (!auditHoja) {
    SpreadsheetApp.getUi().alert('⚠️ No hay auditoría');
    return;
  }

  const datos = auditHoja.getDataRange().getValues();
  let html = `
    <style>
      body { font-family:'Segoe UI', Arial; padding:20px; }
      table { width:100%; border-collapse:collapse; }
      th { background:#1f73e6; color:white; padding:10px; text-align:left; }
      td { padding:8px; border-bottom:1px solid #ddd; }
      input { padding:8px; width:300px; margin-bottom:15px; }
    </style>
    <h2>📋 Auditoría</h2>
    <input type="text" id="f" placeholder="Filtrar por RT..." onkeyup="filtrar()">
    <table id="t">
      <thead>
        <tr><th>Fecha</th><th>Cruce</th><th>RT</th><th>Campo</th><th>Anterior</th><th>Nuevo</th><th>Estado</th></tr>
      </thead>
      <tbody>
  `;

  for (let i = datos.length - 1; i >= 1; i--) {
    html += `<tr>
      <td>${escapeHtml_(datos[i][0])}</td>
      <td>${escapeHtml_(datos[i][1])}</td>
      <td><strong>${escapeHtml_(datos[i][2])}</strong></td>
      <td>${escapeHtml_(datos[i][3])}</td>
      <td style="background:#ffebee">${escapeHtml_(datos[i][4])}</td>
      <td style="background:#e8f5e9">${escapeHtml_(datos[i][5])}</td>
      <td>${escapeHtml_(datos[i][6])}</td>
    </tr>`;
  }

  html += `
      </tbody>
    </table>
    <br>
    <button onclick="google.script.host.close()">Cerrar</button>
    <script>
      function filtrar() {
        const f = document.getElementById('f').value.toUpperCase();
        const tr = document.getElementById('t').getElementsByTagName('tr');
        for (let i = 1; i < tr.length; i++) {
          const td = tr[i].getElementsByTagName('td')[2];
          tr[i].style.display = td && td.textContent.toUpperCase().includes(f) ? '' : 'none';
        }
      }
    </script>
  `;

  SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(html), '📋 Auditoría');
}

function limpiarLogsDelSistema() {
  LoggerSistema.limpiarLogs();
}

// ============ PRUEBAS Y DIAGNÓSTICO ============

function mostrarDialogoPruebaURL() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family:'Segoe UI', Arial; padding:20px; background:#f5f5f5; }
      textarea { width:100%; min-height:90px; padding:10px; border:1px solid #ddd; border-radius:4px; }
      button { margin-top:12px; width:100%; padding:10px; border:none; background:#1f73e6; color:white; border-radius:4px; font-weight:bold; cursor:pointer; }
    </style>
    <h3>🧪 Probar URL Externa</h3>
    <p>Pega una URL o ID de Drive/Sheets para diagnosticar acceso, permisos y tipo de archivo.</p>
    <textarea id="url" placeholder="Pega aquí la URL o ID"></textarea>
    <button onclick="probar()">Diagnosticar</button>
    <script>
      function probar() {
        const url = document.getElementById('url').value.trim();
        if (!url) {
          alert('Debes ingresar una URL o ID');
          return;
        }

        google.script.run
          .withSuccessHandler(function(r) {
            alert(r);
          })
          .withFailureHandler(function(error) {
            alert('❌ Error: ' + error);
          })
          .probarURLExterna(url);
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModalDialog(html, '🧪 Probar URL');
}

function probarURLExterna(url) {
  try {
    const id = extraerIdDelURL(url);
    const file = DriveApp.getFileById(id);
    const mime = file.getMimeType();

    let mensaje = '';
    mensaje += 'ID: ' + id + '\n';
    mensaje += 'Nombre: ' + file.getName() + '\n';
    mensaje += 'MimeType: ' + mime + '\n';
    mensaje += 'Tamaño: ' + file.getSize() + '\n';

    if (mime === 'application/vnd.google-apps.spreadsheet') {
      const ss = SpreadsheetApp.openById(id);
      const hojas = ss.getSheets().map(s => s.getName()).join(', ');
      mensaje += 'Tipo: Google Sheets nativo\n';
      mensaje += 'Hojas: ' + hojas + '\n';
    } else {
      mensaje += 'Tipo: archivo no nativo, intentando conversión temporal...\n';
      const tempId = convertirExcelASheetTemporal(id);

      if (tempId) {
        const ssTemp = SpreadsheetApp.openById(tempId);
        const hojas = ssTemp.getSheets().map(s => s.getName()).join(', ');
        mensaje += 'Conversión temporal: OK\n';
        mensaje += 'Temp ID: ' + tempId + '\n';
        mensaje += 'Hojas convertidas: ' + hojas + '\n';
        eliminarArchivoTemporalSeguro(tempId);
      } else {
        mensaje += 'Conversión temporal: FALLÓ\n';
      }
    }

    LoggerSistema.success('Prueba de URL exitosa para ID: ' + id);
    return mensaje;
  } catch (e) {
    LoggerSistema.error('Prueba de URL falló: ' + e.toString());
    throw new Error(e.toString());
  }
}

function probarArchivoEjemplo() {
  const url = 'https://docs.google.com/spreadsheets/d/14ln6jiEZv3OWDxShjKLrbnXkF0hcoj3P/edit?gid=577649117#gid=577649117';

  try {
    const resultado = probarURLExterna(url);
    SpreadsheetApp.getUi().alert('Resultado de diagnóstico:\n\n' + resultado);
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Error en diagnóstico:\n\n' + e.toString());
  }
}

// ============ HELPERS ============

function asegurarHojaAuditoria_(ss) {
  let hoja = ss.getSheetByName(AUDIT_SHEET);
  if (!hoja) {
    hoja = ss.insertSheet(AUDIT_SHEET);
    hoja.appendRow(['Fecha', 'Cruce', 'RT', 'Campo', 'Anterior', 'Nuevo', 'Estado']);
    hoja.getRange(1, 1, 1, 7)
      .setFontWeight('bold')
      .setBackground('#1f73e6')
      .setFontColor('white');
  }
  return hoja;
}

function normalizarValorClave_(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizarComparacion_(valor) {
  if (valor === null || valor === undefined) return '';

  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)) {
    try {
      const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      return Utilities.formatDate(valor, tz, 'dd/MM/yyyy');
    } catch (e) {
      const dd = String(valor.getDate()).padStart(2, '0');
      const mm = String(valor.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${valor.getFullYear()}`;
    }
  }

  return String(valor)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function asegurarHojaHistorial_(ss) {
  let hoja = ss.getSheetByName(HISTORY_SHEET);
  if (!hoja) {
    hoja = ss.insertSheet(HISTORY_SHEET);
    hoja.appendRow(['Fecha', 'Cruce', 'Cambios', 'Nuevos', 'Duración', 'Estado']);
    hoja.getRange(1, 1, 1, 6)
      .setFontWeight('bold')
      .setBackground('#34A853')
      .setFontColor('white');
  }
  return hoja;
}

function registrarHistorial_(ss, data) {
  const hoja = asegurarHojaHistorial_(ss);
  hoja.appendRow([
    data.fecha instanceof Date ? data.fecha.toLocaleString() : data.fecha,
    data.cruce,
    data.cambios,
    data.nuevos,
    data.duracion,
    data.estado
  ]);
}

function normalizarEncabezado_(valor) {
  return String(valor || '').trim().toUpperCase();
}

function numeroAColumna_(num) {
  let col = '';
  while (num > 0) {
    let rem = (num - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    num = Math.floor((num - 1) / 26);
  }
  return col;
}

function escapeHtml_(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsString_(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

// ============ CONTROLES DE MANTENIMIENTO WEB ============

function ACTIVAR_MANTENIMIENTO() {
  PropertiesService.getScriptProperties().setProperty('MODO_MANTENIMIENTO', 'true');
  LoggerSistema.warning('🚧 Mantenimiento ACTIVADO manualmente desde el menú.');
  try {
    SpreadsheetApp.getUi().alert('🚧 MANTENIMIENTO ACTIVADO\n\nLos usuarios ya no pueden acceder al tablero web. Verán la pantalla de bloqueo.');
  } catch(e) {}
}

function DESACTIVAR_MANTENIMIENTO() {
  PropertiesService.getScriptProperties().setProperty('MODO_MANTENIMIENTO', 'false');
  LoggerSistema.success('✅ Mantenimiento DESACTIVADO manualmente desde el menú.');
  try {
    SpreadsheetApp.getUi().alert('✅ MANTENIMIENTO DESACTIVADO\n\nEl tablero web vuelve a estar en línea para todos los usuarios.');
  } catch(e) {}
}

// ============ MOTOR DE APRENDIZAJE E IA (SIMILITUD DE RT) ============

class MotorAprendizajeRT {
  static initialize() { // Fallback por compatibilidad de nombres
    this.inicializar();
  }

  static inicializar() {
    const prop = PropertiesService.getScriptProperties().getProperty('MEMORIA_RT_IA'); // Cambio a propiedad de script
    this.memoria = prop ? JSON.parse(prop) : {};
    this.huboCambios = false;
  }

  static guardarSiHayCambios() {
    if (this.huboCambios) {
      PropertiesService.getScriptProperties().setProperty('MEMORIA_RT_IA', JSON.stringify(this.memoria)); // Cambio a propiedad de script
      LoggerSistema.success('🧠 [IA] Nueva memoria de similitudes guardada exitosamente de forma compartida.');
    }
  }

  static evaluar(claveLocal, llavesExternas, mapaExterno, esAutomatica = false) {
    if (mapaExterno[claveLocal] !== undefined) {
      return { clave: claveLocal, valor: mapaExterno[claveLocal] };
    }

    if (this.memoria && this.memoria[claveLocal] && mapaExterno[this.memoria[claveLocal]] !== undefined) {
      return { clave: this.memoria[claveLocal], valor: mapaExterno[this.memoria[claveLocal]] };
    }

    const numLocal = this.extraerNumeros(claveLocal);
    if (!numLocal) return null; 

    const candidatos = llavesExternas.filter(cand => this.extraerNumeros(cand) === numLocal);
    if (candidatos.length === 0) return null;

    const letrasLocal = this.extraerLetrasClave(claveLocal);

    for (let cand of candidatos) {
      const letrasCand = this.extraerLetrasClave(cand);
      const diferenciaLetras = Math.abs(letrasCand.length - letrasLocal.length);

      if (diferenciaLetras <= 1) {
        this.aprender(claveLocal, cand);
        LoggerSistema.info(`🧠 [IA] Aprendizaje Automático: ${claveLocal} enlazado con ${cand}`);
        return { clave: cand, valor: mapaExterno[cand] };
      } 
      else {
        if (esAutomatica) {
          LoggerSistema.warning(`⚠️ [IA] Similitud omitida para ${claveLocal} vs ${cand}. Ejecución en modo desatendido.`);
        } 
        else if (!esAutomatica && this.preguntarUsuario(claveLocal, cand)) {
          this.aprender(claveLocal, cand);
          LoggerSistema.success(`🧠 [IA] Aprendizaje Manual Confirmado: ${claveLocal} enlazado con ${cand}`);
          return { clave: cand, valor: mapaExterno[cand] };
        }
      }
    }

    return null;
  }

  static aprender(local, externo) {
    if (!this.memoria) this.memoria = {};
    this.memoria[local] = externo;
    this.huboCambios = true;
  }

  static extraerNumeros(texto) {
    const match = String(texto).match(/\d+/g);
    return match ? match.join('') : null;
  }

  static extraerLetrasClave(texto) {
    return String(texto).toUpperCase().replace(/RT/g, '').replace(/[^A-Z]/g, '');
  }

  static preguntarUsuario(local, candidato) {
    try {
      const ui = SpreadsheetApp.getUi();
      const res = ui.alert(
        '🧠 IA: Nueva similitud detectada',
        `No se encontró el RT exacto.\n\n` +
        `RT Buscado: ${local}\n` +
        `RT Encontrado: ${candidato}\n\n` +
        `El número base coincide. ¿Es la misma llave? Si aceptas, el sistema lo aprenderá para el futuro de forma global.`,
        ui.ButtonSet.YES_NO
      );
      return res === ui.Button.YES;
    } catch (e) {
      return false;
    }
  }
}

MotorAprendizajeRT.memoria = null;
MotorAprendizajeRT.huboCambios = false;

// ============ FUNCIÓN TEMPORAL PARA VER URLs DE CRUCES ============
// Ejecuta esta función para ver en los Logs las URLs exactas de tus archivos externos
function listarUrlsDeCrucesConfigurados() {
  const propiedades = PropertiesService.getScriptProperties();
  const CONFIG_PROP = 'CRUCES_CONFIG_V7';
  
  const cruces = JSON.parse(propiedades.getProperty(CONFIG_PROP) || '{}');
  const nombres = Object.keys(cruces);
  
  if (nombres.length === 0) {
    Logger.log('⚠️ No hay ningún cruce configurado en las propiedades del Script.');
    SpreadsheetApp.getUi().alert('No hay cruces configurados aún.');
    return;
  }
  
  Logger.log('==================================================');
  Logger.log('📂 LISTA DE ARCHIVOS EXTERNOS CONFIGURADOS:');
  Logger.log('==================================================');
  
  let mensajeUi = 'Archivos encontrados:\n\n';
  
  for (const [nombre, config] of Object.entries(cruces)) {
    Logger.log(`📌 Cruce: "${nombre}"`);
    Logger.log(`   📄 Hoja destino interna: ${config.hoja}`);
    Logger.log(`   🔗 URL del Archivo: ${config.url}`);
    Logger.log('--------------------------------------------------');
    
    mensajeUi += `🔹 Cruce: ${nombre}\n🔗 URL: ${config.url}\n\n`;
  }
  
  // Esto mostrará una alerta en la pantalla del Excel con las URLs para que puedas copiarlas
  SpreadsheetApp.getUi().alert('Mira los Logs (Ctrl+Enter) o copia las URLs de aquí:\n\n' + mensajeUi);
}