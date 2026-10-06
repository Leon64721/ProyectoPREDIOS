/**
 * Organiza los 5 Spreadsheets en una carpeta llamada "PROGRAMAPREDIOS"
 * y actualiza las Script Properties con las nuevas ubicaciones
 */
function organizarEnCarpetaProgramaPredios() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📁 ORGANIZANDO ARCHIVOS EN CARPETA "PROGRAMAPREDIOS"');
  console.log('═══════════════════════════════════════════════════════');

  const FOLDER_NAME = 'PROGRAMAPREDIOS';
  const props = PropertiesService.getScriptProperties();

  // ✅ [2026-10-06] SEGURIDAD: los IDs ya NO viven aquí en texto plano — este repo estuvo
  // público en GitHub. Se resuelven en runtime desde Script Properties (mismo patrón que
  // config.js/pac_config.js). Si alguna property no está seteada, esa entrada se omite
  // (se reporta y se sigue con las demás, no se detiene todo el proceso).
  const CLAVES_ARCHIVOS = {
    'DATA_FILES_PRINCIPAL_ID': 'Sistema Predial IDU - Principal',
    'DATA_FILES_LOGS_ID': 'Sistema Predial IDU - Logs',
    'DATA_FILES_USUARIOS_ID': 'Sistema Predial IDU - Usuarios',
    'MAESTRO_PERMISOS_ID': 'Sistema Predial IDU - Permisos RBAC',
    'PAC_SPREADSHEET_ID': 'Sistema Predial IDU - PAC'
  };
  const archivos = {};
  Object.keys(CLAVES_ARCHIVOS).forEach(function (clave) {
    const id = getConfigProperty(clave, '');
    if (!id) {
      console.warn('⚠️ ' + clave + ' no está configurada — se omite ' + CLAVES_ARCHIVOS[clave] + '.');
      return;
    }
    archivos[clave] = { id: id, nombre: CLAVES_ARCHIVOS[clave] };
  });

  try {
    // 1. Buscar o crear la carpeta "PROGRAMAPREDIOS"
    console.log('\n📂 PASO 1: Buscando/creando carpeta "PROGRAMAPREDIOS"...');

    let folder;
    const folders = DriveApp.getFoldersByName(FOLDER_NAME);

    if (folders.hasNext()) {
      folder = folders.next();
      console.log(`  ✅ Carpeta encontrada: ${folder.getName()}`); // ✅ [2026-10-06] SEGURIDAD: ya no imprime ID/URL de la carpeta
    } else {
      folder = DriveApp.createFolder(FOLDER_NAME);
      console.log(`  ✅ Carpeta creada: ${folder.getName()}`);
    }

    // 2. Mover cada archivo a la carpeta
    console.log('\n📦 PASO 2: Moviendo archivos a la carpeta...');

    let movidosCount = 0;

    for (const [key, info] of Object.entries(archivos)) {
      try {
        const file = DriveApp.getFileById(info.id);
        const nombreActual = file.getName();

        // Verificar si ya está en la carpeta
        const parents = file.getParents();
        let yaEnCarpeta = false;

        while (parents.hasNext()) {
          const parent = parents.next();
          if (parent.getId() === folder.getId()) {
            yaEnCarpeta = true;
            break;
          }
        }

        if (yaEnCarpeta) {
          console.log(`  ⚠️ ${nombreActual}: Ya está en la carpeta`);
        } else {
          // Mover a la carpeta
          file.moveTo(folder);
          console.log(`  ✅ ${nombreActual}: Movido exitosamente`);
          movidosCount++;
        }

      } catch (error) {
        console.error(`  ❌ Error moviendo ${info.nombre}: ${error.message}`);
      }
    }

    // 3. Resumen
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📁 Carpeta: ${folder.getName()}`); // ✅ [2026-10-06] SEGURIDAD: ya no imprime ID/URL de la carpeta
    console.log(`  📦 Archivos movidos: ${movidosCount}/${Object.keys(archivos).length}`);
    console.log('\n✅ ORGANIZACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════');

    // Retornar información de la carpeta
    return {
      folderId: folder.getId(),
      folderUrl: folder.getUrl(),
      folderName: folder.getName(),
      archivosMoved: movidosCount
    };

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene las URLs de todos los archivos organizados.
 * ⚠️ [2026-10-06] SEGURIDAD: esta función, a propósito, SÍ imprime URLs completas (que
 * incluyen el ID del spreadsheet) — es su función: darle al usuario un enlace clicable.
 * Ejecutarla deja esos IDs en el log de ejecución de Apps Script, visible para cualquier
 * editor del proyecto. Ejecutar solo cuando de verdad se necesiten los enlaces, no como
 * parte de un diagnóstico de rutina. Los IDs ya no están hardcodeados aquí — se resuelven
 * desde Script Properties, igual que en el resto del proyecto.
 */
function obtenerURLsArchivos() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔗 URLS DE LOS ARCHIVOS (⚠️ este log incluirá los IDs reales)');
  console.log('═══════════════════════════════════════════════════════\n');

  const CLAVES = ['DATA_FILES_PRINCIPAL_ID', 'DATA_FILES_LOGS_ID', 'DATA_FILES_USUARIOS_ID', 'MAESTRO_PERMISOS_ID', 'PAC_SPREADSHEET_ID'];
  const urls = {};

  CLAVES.forEach(function (key) {
    const id = getConfigProperty(key, '');
    if (!id) {
      console.warn(`⚠️ ${key} no está configurada, se omite.`);
      return;
    }
    try {
      const file = DriveApp.getFileById(id);
      const url = file.getUrl();
      const nombre = file.getName();

      urls[key] = { nombre: nombre, id: id, url: url };

      console.log(`✅ ${nombre}`);
      console.log(`   URL: ${url}\n`);

    } catch (error) {
      console.error(`❌ Error obteniendo ${key}: ${error.message}\n`);
    }
  });

  console.log('═══════════════════════════════════════════════════════');

  return urls;
}
