/**
 * SCRIPT DE MIGRACIÓN AUTOMÁTICA V2
 * Sistema Predial IDU - Migración desde archivo único a arquitectura distribuida
 *
 * BASADO EN LA ESTRUCTURA REAL DEL ARCHIVO:
 * [STAGING] Matriz Principal (1FHC6Z6BeMvgnAMlDY_c3ZE5aokOqyRjah9v_leXkhXM)
 */

const ARCHIVO_ORIGEN = '1FHC6Z6BeMvgnAMlDY_c3ZE5aokOqyRjah9v_leXkhXM';
const CARPETA_DESTINO = null; // null = raíz de Drive

// ═══════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

function setupAutomaticoCompleto() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 MIGRACIÓN AUTOMÁTICA V2 - Sistema Predial IDU');
  console.log('   Archivo origen: [STAGING] Matriz Principal');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // PASO 1: Analizar archivo origen
    console.log('📊 PASO 1: Analizando archivo origen...');
    const archivoOrigen = analizarArchivoOrigen();
    console.log(`✅ Archivo: "${archivoOrigen.nombre}"`);
    console.log(`   Total de hojas: ${archivoOrigen.hojas.length}`);
    console.log('   Hojas encontradas:');
    archivoOrigen.hojas.forEach(h => console.log(`   - ${h}`));

    // PASO 2: Crear nuevos archivos
    console.log('\n📁 PASO 2: Creando estructura de 5 archivos...');
    const nuevosArchivos = crearEstructuraArchivos();

    // PASO 3: Migrar datos
    console.log('\n📦 PASO 3: Migrando datos del archivo origen...');
    migrarDatosCompletos(archivoOrigen, nuevosArchivos);

    // PASO 4: Configurar Script Properties
    console.log('\n⚙️ PASO 4: Configurando Script Properties...');
    configurarScriptProperties(nuevosArchivos);

    // PASO 5: Validar instalación
    console.log('\n✅ PASO 5: Validando instalación...');
    const validacion = validarInstalacion();

    // RESUMEN FINAL
    mostrarResumenFinal(archivoOrigen, nuevosArchivos, validacion);

    return nuevosArchivos;

  } catch (error) {
    console.error('❌ ERROR EN LA MIGRACIÓN:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PASO 1: ANALIZAR ARCHIVO ORIGEN
// ═══════════════════════════════════════════════════════════════════

function analizarArchivoOrigen() {
  try {
    const ss = SpreadsheetApp.openById(ARCHIVO_ORIGEN);
    const hojas = ss.getSheets().map(h => h.getName());

    return {
      id: ARCHIVO_ORIGEN,
      nombre: ss.getName(),
      url: ss.getUrl(),
      hojas: hojas,
      spreadsheet: ss
    };
  } catch (error) {
    throw new Error(`No se pudo acceder al archivo origen: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PASO 2: CREAR ESTRUCTURA DE ARCHIVOS
// ═══════════════════════════════════════════════════════════════════

function crearEstructuraArchivos() {
  const nuevosArchivos = {};

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVO 1: Principal (Datos operativos)
  // ─────────────────────────────────────────────────────────────────
  console.log('  📄 Creando: Sistema Predial IDU - Principal...');
  const ssPrincipal = SpreadsheetApp.create('Sistema Predial IDU - Principal');

  // Crear hojas con estructura
  crearHojaSiNoExiste(ssPrincipal, 'Datos', null);
  crearHojaSiNoExiste(ssPrincipal, 'Datos2', null);
  crearHojaSiNoExiste(ssPrincipal, 'Seguimiento', null);
  crearHojaSiNoExiste(ssPrincipal, 'Compromisos', null);
  crearHojaSiNoExiste(ssPrincipal, 'CASOS ESPECIALES', null);
  crearHojaSiNoExiste(ssPrincipal, 'FiltroMatriz', null);
  crearHojaSiNoExiste(ssPrincipal, 'Configuracion', ['Clave', 'Valor', 'Descripcion', 'FechaActualizacion']);

  // Datos iniciales de configuración
  const hojaConfig = ssPrincipal.getSheetByName('Configuracion');
  hojaConfig.getRange(2, 1, 2, 4).setValues([
    ['VERSION_SISTEMA', '2.0', 'Versión actual del sistema', new Date()],
    ['MODO_MANTENIMIENTO', 'false', 'Sistema en mantenimiento', new Date()]
  ]);

  eliminarHojaPorDefecto(ssPrincipal);

  nuevosArchivos.principal = {
    id: ssPrincipal.getId(),
    nombre: 'Sistema Predial IDU - Principal',
    url: ssPrincipal.getUrl(),
    spreadsheet: ssPrincipal
  };
  console.log(`    ✅ ID: ${ssPrincipal.getId()}`);

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVO 2: Logs (Auditoría y trazabilidad)
  // ─────────────────────────────────────────────────────────────────
  console.log('  📄 Creando: Sistema Predial IDU - Logs...');
  const ssLogs = SpreadsheetApp.create('Sistema Predial IDU - Logs');

  crearHojaSiNoExiste(ssLogs, 'LOGS_AUDITORIA', null);
  crearHojaSiNoExiste(ssLogs, 'Logs', null);
  crearHojaSiNoExiste(ssLogs, '📈 Historial de Cambios', null);
  crearHojaSiNoExiste(ssLogs, '📋 Auditoría de Cambios', null);
  crearHojaSiNoExiste(ssLogs, '📊 Logs del Sistema', null);
  crearHojaSiNoExiste(ssLogs, 'LOGS_ASIGNACION', ['Timestamp', 'Usuario', 'TipoAsignacion', 'PredioID', 'AsignadoA', 'Observaciones']);

  eliminarHojaPorDefecto(ssLogs);

  nuevosArchivos.logs = {
    id: ssLogs.getId(),
    nombre: 'Sistema Predial IDU - Logs',
    url: ssLogs.getUrl(),
    spreadsheet: ssLogs
  };
  console.log(`    ✅ ID: ${ssLogs.getId()}`);

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVO 3: Usuarios (Directorio y asignaciones)
  // ─────────────────────────────────────────────────────────────────
  console.log('  📄 Creando: Sistema Predial IDU - Usuarios...');
  const ssUsuarios = SpreadsheetApp.create('Sistema Predial IDU - Usuarios');

  crearHojaSiNoExiste(ssUsuarios, 'USUARIOS', null);
  crearHojaSiNoExiste(ssUsuarios, 'ASIGNACIONES_EQUIPOS', null);
  crearHojaSiNoExiste(ssUsuarios, 'Asignacion_RT', null);

  eliminarHojaPorDefecto(ssUsuarios);

  nuevosArchivos.usuarios = {
    id: ssUsuarios.getId(),
    nombre: 'Sistema Predial IDU - Usuarios',
    url: ssUsuarios.getUrl(),
    spreadsheet: ssUsuarios
  };
  console.log(`    ✅ ID: ${ssUsuarios.getId()}`);

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVO 4: Permisos RBAC
  // ─────────────────────────────────────────────────────────────────
  console.log('  📄 Creando: Sistema Predial IDU - Permisos RBAC...');
  const ssPermisos = SpreadsheetApp.create('Sistema Predial IDU - Permisos RBAC');

  crearHojaSiNoExiste(ssPermisos, 'Permisos', null);

  eliminarHojaPorDefecto(ssPermisos);

  nuevosArchivos.permisos = {
    id: ssPermisos.getId(),
    nombre: 'Sistema Predial IDU - Permisos RBAC',
    url: ssPermisos.getUrl(),
    spreadsheet: ssPermisos
  };
  console.log(`    ✅ ID: ${ssPermisos.getId()}`);

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVO 5: PAC (Motor de reglas y alertas)
  // ─────────────────────────────────────────────────────────────────
  console.log('  📄 Creando: Sistema Predial IDU - PAC...');
  const ssPAC = SpreadsheetApp.create('Sistema Predial IDU - PAC');

  crearHojaSiNoExiste(ssPAC, 'PAC_ReglasPAC', null);
  crearHojaSiNoExiste(ssPAC, 'LOG_PAC_SISTEMA', null);
  crearHojaSiNoExiste(ssPAC, 'ALERTAS_ACTIVAS', null);
  crearHojaSiNoExiste(ssPAC, 'PAC_Vigente', null);
  crearHojaSiNoExiste(ssPAC, 'PAC_Borrador', null);
  crearHojaSiNoExiste(ssPAC, 'PAC_Historial', null);
  crearHojaSiNoExiste(ssPAC, 'PAC_Alertas', null);
  crearHojaSiNoExiste(ssPAC, 'PAC_Articuladores', null);
  crearHojaSiNoExiste(ssPAC, 'PAC_Motor', ['Clave', 'Valor', 'Descripcion']);

  // Configuración inicial del motor
  const hojaMotor = ssPAC.getSheetByName('PAC_Motor');
  hojaMotor.getRange(2, 1, 2, 3).setValues([
    ['VERSION_MOTOR', '2.0', 'Versión del motor PAC'],
    ['ULTIMA_EJECUCION', '', 'Timestamp última ejecución']
  ]);

  eliminarHojaPorDefecto(ssPAC);

  nuevosArchivos.pac = {
    id: ssPAC.getId(),
    nombre: 'Sistema Predial IDU - PAC',
    url: ssPAC.getUrl(),
    spreadsheet: ssPAC
  };
  console.log(`    ✅ ID: ${ssPAC.getId()}`);

  return nuevosArchivos;
}

// ═══════════════════════════════════════════════════════════════════
// PASO 3: MIGRAR DATOS COMPLETOS
// ═══════════════════════════════════════════════════════════════════

function migrarDatosCompletos(archivoOrigen, nuevosArchivos) {
  const ssOrigen = archivoOrigen.spreadsheet;

  // Mapeo completo basado en la estructura real
  const mapeoMigracion = [
    { origen: 'Datos', destino: 'principal', hoja: 'Datos' },
    { origen: 'Datos2', destino: 'principal', hoja: 'Datos2' },
    { origen: 'Seguimiento', destino: 'principal', hoja: 'Seguimiento' },
    { origen: 'Compromisos', destino: 'principal', hoja: 'Compromisos' },
    { origen: 'CASOS ESPECIALES', destino: 'principal', hoja: 'CASOS ESPECIALES' },
    { origen: 'FiltroMatriz', destino: 'principal', hoja: 'FiltroMatriz' },
    { origen: 'LOGS_AUDITORIA', destino: 'logs', hoja: 'LOGS_AUDITORIA' },
    { origen: 'Logs', destino: 'logs', hoja: 'Logs' },
    { origen: '📈 Historial de Cambios', destino: 'logs', hoja: '📈 Historial de Cambios' },
    { origen: '📋 Auditoría de Cambios', destino: 'logs', hoja: '📋 Auditoría de Cambios' },
    { origen: '📊 Logs del Sistema', destino: 'logs', hoja: '📊 Logs del Sistema' },
    { origen: 'USUARIOS', destino: 'usuarios', hoja: 'USUARIOS' },
    { origen: 'ASIGNACIONES_EQUIPOS', destino: 'usuarios', hoja: 'ASIGNACIONES_EQUIPOS' },
    { origen: 'Asignacion_RT', destino: 'usuarios', hoja: 'Asignacion_RT' },
    { origen: 'Permisos', destino: 'permisos', hoja: 'Permisos' },
    { origen: 'PAC_ReglasPAC', destino: 'pac', hoja: 'PAC_ReglasPAC' },
    { origen: 'LOG_PAC_SISTEMA', destino: 'pac', hoja: 'LOG_PAC_SISTEMA' },
    { origen: 'ALERTAS_ACTIVAS', destino: 'pac', hoja: 'ALERTAS_ACTIVAS' },
    { origen: 'PAC_Vigente', destino: 'pac', hoja: 'PAC_Vigente' },
    { origen: 'PAC_Borrador', destino: 'pac', hoja: 'PAC_Borrador' },
    { origen: 'PAC_Historial', destino: 'pac', hoja: 'PAC_Historial' },
    { origen: 'PAC_Alertas', destino: 'pac', hoja: 'PAC_Alertas' },
    { origen: 'PAC_Articuladores', destino: 'pac', hoja: 'PAC_Articuladores' }
  ];

  let datosCopiados = 0;
  let hojasCopiadas = 0;

  console.log('  Iniciando migración de datos...\n');

  mapeoMigracion.forEach(mapeo => {
    const hojaOrigen = ssOrigen.getSheetByName(mapeo.origen);

    if (hojaOrigen) {
      const hojaDestino = nuevosArchivos[mapeo.destino].spreadsheet.getSheetByName(mapeo.hoja);

      if (hojaDestino) {
        try {
          const ultimaFila = hojaOrigen.getLastRow();
          const ultimaColumna = hojaOrigen.getLastColumn();

          if (ultimaFila > 0 && ultimaColumna > 0) {
            const datos = hojaOrigen.getRange(1, 1, ultimaFila, ultimaColumna).getValues();
            const formatos = hojaOrigen.getRange(1, 1, ultimaFila, ultimaColumna).getBackgrounds();

            hojaDestino.getRange(1, 1, datos.length, datos[0].length).setValues(datos);
            hojaDestino.getRange(1, 1, formatos.length, formatos[0].length).setBackgrounds(formatos);

            for (let col = 1; col <= ultimaColumna; col++) {
              const ancho = hojaOrigen.getColumnWidth(col);
              hojaDestino.setColumnWidth(col, ancho);
            }

            if (hojaOrigen.getFrozenRows() > 0) {
              hojaDestino.setFrozenRows(1);
            }

            console.log(`  ✅ ${mapeo.origen} → ${mapeo.destino}/${mapeo.hoja} (${ultimaFila} filas, ${ultimaColumna} cols)`);
            datosCopiados += ultimaFila;
            hojasCopiadas++;
          } else {
            console.log(`  ⚠️ ${mapeo.origen}: Hoja vacía (omitida)`);
          }
        } catch (error) {
          console.log(`  ❌ Error copiando ${mapeo.origen}: ${error.message}`);
        }
      } else {
        console.log(`  ⚠️ Hoja destino no encontrada: ${mapeo.hoja}`);
      }
    } else {
      console.log(`  ⚠️ Hoja origen no encontrada: ${mapeo.origen}`);
    }
  });

  console.log(`\n  📊 Resumen de migración:`);
  console.log(`     - Hojas copiadas: ${hojasCopiadas}/${mapeoMigracion.length}`);
  console.log(`     - Total de filas migradas: ${datosCopiados}`);
}

// ═══════════════════════════════════════════════════════════════════
// PASO 4: CONFIGURAR SCRIPT PROPERTIES
// ═══════════════════════════════════════════════════════════════════

function configurarScriptProperties(nuevosArchivos) {
  const props = PropertiesService.getScriptProperties();

  const propiedades = {
    'DATA_FILES_PRINCIPAL_ID': nuevosArchivos.principal.id,
    'DATA_FILES_LOGS_ID': nuevosArchivos.logs.id,
    'DATA_FILES_USUARIOS_ID': nuevosArchivos.usuarios.id,
    'MAESTRO_PERMISOS_ID': nuevosArchivos.permisos.id,
    'PAC_SPREADSHEET_ID': nuevosArchivos.pac.id
  };

  props.setProperties(propiedades);

  Object.keys(propiedades).forEach(key => {
    console.log(`  ✅ ${key}: ${propiedades[key]}`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// PASO 5: VALIDAR INSTALACIÓN
// ═══════════════════════════════════════════════════════════════════

function validarInstalacion() {
  const props = PropertiesService.getScriptProperties();
  const propiedadesRequeridas = [
    'DATA_FILES_PRINCIPAL_ID',
    'DATA_FILES_LOGS_ID',
    'DATA_FILES_USUARIOS_ID',
    'MAESTRO_PERMISOS_ID',
    'PAC_SPREADSHEET_ID'
  ];

  let todasOK = true;

  propiedadesRequeridas.forEach(prop => {
    const valor = props.getProperty(prop);
    if (valor && valor.length > 20) {
      try {
        const ss = SpreadsheetApp.openById(valor);
        console.log(`  ✅ ${prop}: ${ss.getName()}`);
      } catch (e) {
        console.log(`  ❌ ${prop}: ERROR - ${e.message}`);
        todasOK = false;
      }
    } else {
      console.log(`  ❌ ${prop}: NO CONFIGURADA`);
      todasOK = false;
    }
  });

  return todasOK;
}

// ═══════════════════════════════════════════════════════════════════
// RESUMEN FINAL
// ═══════════════════════════════════════════════════════════════════

function mostrarResumenFinal(archivoOrigen, nuevosArchivos, validacion) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 RESUMEN DE MIGRACIÓN');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📂 Archivo origen:`);
  console.log(`   Nombre: ${archivoOrigen.nombre}`);
  console.log(`   ID: ${archivoOrigen.id}`);
  console.log(`   URL: ${archivoOrigen.url}`);

  console.log(`\n📁 Archivos creados:\n`);
  Object.keys(nuevosArchivos).forEach(key => {
    const archivo = nuevosArchivos[key];
    console.log(`✅ ${archivo.nombre}`);
    console.log(`   ID: ${archivo.id}`);
    console.log(`   URL: ${archivo.url}\n`);
  });

  if (validacion) {
    console.log('🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO!');
    console.log('\n🔗 URL del sistema:');
    console.log('https://script.google.com/a/macros/idu.gov.co/s/AKfycbyfD70GGwc4DlnFW48B0xvUX8LFaGKWPxnSGjW08wQ/dev');
    console.log('\n✅ El sistema está listo para usarse.');
  } else {
    console.log('⚠️ MIGRACIÓN COMPLETADA CON ADVERTENCIAS');
    console.log('Revisa los mensajes de validación arriba.');
  }

  console.log('═══════════════════════════════════════════════════════════');
}

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

function crearHojaSiNoExiste(spreadsheet, nombreHoja, encabezados) {
  let hoja = spreadsheet.getSheetByName(nombreHoja);

  if (!hoja) {
    hoja = spreadsheet.insertSheet(nombreHoja);
  }

  if (encabezados && encabezados.length > 0) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }

  return hoja;
}

function eliminarHojaPorDefecto(spreadsheet) {
  const hojas = spreadsheet.getSheets();
  hojas.forEach(hoja => {
    if (hoja.getName().includes('Hoja') || hoja.getName().includes('Sheet')) {
      try {
        if (spreadsheet.getSheets().length > 1) {
          spreadsheet.deleteSheet(hoja);
        }
      } catch (e) {
        // Ignorar si no se puede eliminar
      }
    }
  });
}
