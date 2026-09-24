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

  // IDs de los archivos
  const archivos = {
    'DATA_FILES_PRINCIPAL_ID': {
      id: '1FHC6Z6BeMvgnAMlDY_c3ZE5aokOqyRjah9v_leXkhXM',
      nombre: 'Sistema Predial IDU - Principal'
    },
    'DATA_FILES_LOGS_ID': {
      id: '1ClFAgntVtjHwnmeTcf3br3eYqZggNTYu8XJZrNaL-LY',
      nombre: 'Sistema Predial IDU - Logs'
    },
    'DATA_FILES_USUARIOS_ID': {
      id: '1TWMKWt9eOK0eVxcqo-vlWLAGzJQFEDx7kuvtOQEjpVo',
      nombre: 'Sistema Predial IDU - Usuarios'
    },
    'MAESTRO_PERMISOS_ID': {
      id: '1kWiMu5P0HZwJdoE0_LMwPGmN928gAEBsNYvtL9E0q28',
      nombre: 'Sistema Predial IDU - Permisos RBAC'
    },
    'PAC_SPREADSHEET_ID': {
      id: '11gmGF1mGBKmUDm4xGGBUGFc3-h9gZPsS9m8eWiEQaYU',
      nombre: 'Sistema Predial IDU - PAC'
    }
  };

  try {
    // 1. Buscar o crear la carpeta "PROGRAMAPREDIOS"
    console.log('\n📂 PASO 1: Buscando/creando carpeta "PROGRAMAPREDIOS"...');

    let folder;
    const folders = DriveApp.getFoldersByName(FOLDER_NAME);

    if (folders.hasNext()) {
      folder = folders.next();
      console.log(`  ✅ Carpeta encontrada: ${folder.getName()}`);
      console.log(`     ID: ${folder.getId()}`);
      console.log(`     URL: ${folder.getUrl()}`);
    } else {
      folder = DriveApp.createFolder(FOLDER_NAME);
      console.log(`  ✅ Carpeta creada: ${folder.getName()}`);
      console.log(`     ID: ${folder.getId()}`);
      console.log(`     URL: ${folder.getUrl()}`);
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
    console.log(`  📁 Carpeta: ${folder.getName()}`);
    console.log(`  🆔 ID: ${folder.getId()}`);
    console.log(`  🔗 URL: ${folder.getUrl()}`);
    console.log(`  📦 Archivos movidos: ${movidosCount}/5`);
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
 * Obtiene las URLs de todos los archivos organizados
 */
function obtenerURLsArchivos() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔗 URLS DE LOS ARCHIVOS');
  console.log('═══════════════════════════════════════════════════════\n');

  const archivos = {
    'DATA_FILES_PRINCIPAL_ID': '1FHC6Z6BeMvgnAMlDY_c3ZE5aokOqyRjah9v_leXkhXM',
    'DATA_FILES_LOGS_ID': '1ClFAgntVtjHwnmeTcf3br3eYqZggNTYu8XJZrNaL-LY',
    'DATA_FILES_USUARIOS_ID': '1TWMKWt9eOK0eVxcqo-vlWLAGzJQFEDx7kuvtOQEjpVo',
    'MAESTRO_PERMISOS_ID': '1kWiMu5P0HZwJdoE0_LMwPGmN928gAEBsNYvtL9E0q28',
    'PAC_SPREADSHEET_ID': '11gmGF1mGBKmUDm4xGGBUGFc3-h9gZPsS9m8eWiEQaYU'
  };

  const urls = {};

  for (const [key, id] of Object.entries(archivos)) {
    try {
      const file = DriveApp.getFileById(id);
      const url = file.getUrl();
      const nombre = file.getName();

      urls[key] = {
        nombre: nombre,
        id: id,
        url: url
      };

      console.log(`✅ ${nombre}`);
      console.log(`   ID: ${id}`);
      console.log(`   URL: ${url}\n`);

    } catch (error) {
      console.error(`❌ Error obteniendo ${key}: ${error.message}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════');

  return urls;
}
