/**
 * ═══════════════════════════════════════════════════════════
 * CAPA DE DATOS - LECTURA/ESCRITURA (CORREGIDO)
 * ═══════════════════════════════════════════════════════════
 */

class GestorDatos {
  constructor(fileId = null) {
    try {
      validateConfig();
      this.fileId = fileId || getConfig('DATA_FILES.PRINCIPAL');
      
      if (!this.fileId) {
        throw new Error('FILE_ID no configurado');
      }
      
      this.ss = SpreadsheetApp.openById(this.fileId);
      this.cache = {};
      
      console.log(`✅ GestorDatos inicializado: ${this.fileId.substring(0, 10)}...`);
    } catch (e) {
      console.error(`❌ Error en GestorDatos: ${e.message}`);
      throw e;
    }
  }
  
  /**
   * Obtiene hoja por nombre (V1 + V2)
   */
  getSheet(sheetName) {
    try {
      if (!sheetName) {
        throw new Error('sheetName es requerido');
      }
      
      const sheet = this.ss.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Hoja "${sheetName}" no encontrada en el archivo`);
      }
      return sheet;
    } catch (e) {
      console.error(`Error en getSheet: ${e.message}`);
      throw e;
    }
  }
  
  /**
   * Lee todos los datos con headers (V1 + V2)
   */
  leerDatos(sheetName) {
    try {
      const sheet = this.getSheet(sheetName);
      const data = sheet.getDataRange().getDisplayValues();
      
      if (!data || data.length < 1) {
        console.warn(`⚠️ Hoja ${sheetName} vacía o sin datos`);
        return { headers: [], rows: [] };
      }
      
      const headers = data[0].map(h => {
        if (h === null || h === undefined) return '';
        return String(h).toUpperCase().trim().replace(/\n/g, ' ');
      });
      
      const rows = [];
      if (data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const obj = {};
          headers.forEach((header, idx) => {
            obj[header] = (row[idx] !== null && row[idx] !== undefined) ? row[idx] : '';
          });
          rows.push(obj);
        }
      }
      
      console.log(`✅ Datos leídos: ${rows.length} filas, ${headers.length} columnas`);
      return { headers, rows };
    } catch (e) {
      console.error(`Error en leerDatos: ${e.message}`);
      return { headers: [], rows: [] };
    }
  }
  
  /**
   * Busca RT en datos (V2)
   */
  buscarRT(rt) {
    try {
      if (!rt) throw new Error('RT es requerido');
      
      const { headers, rows } = this.leerDatos(getConfig('SHEETS.DATOS'));
      
      if (!headers || headers.length === 0) {
        throw new Error('No se pudieron obtener los headers');
      }
      
      const rtCol = getConfig('COLUMNS.RT');
      const rtIndex = findColumnIndex(headers, rtCol);
      
      if (rtIndex < 0) {
        throw new Error(`Columna RT "${rtCol}" no encontrada`);
      }
      
      for (let i = 0; i < rows.length; i++) {
        const headerName = headers[rtIndex];
        if (safeCompare(rows[i][headerName], rt)) {
          return { 
            rowIndex: i + 2, 
            rowData: rows[i], 
            headers,
            colMap: mapColumnsFlexible(headers)
          };
        }
      }
      
      return null;
    } catch (e) {
      console.error(`Error en buscarRT: ${e.message}`);
      throw e;
    }
  }
  
  /**
   * Actualiza celda (V2)
   */
  actualizarCelda(sheetName, row, col, valor) {
    try {
      if (!sheetName || row < 1 || col < 0) {
        throw new Error('Parámetros inválidos en actualizarCelda');
      }
      
      const sheet = this.getSheet(sheetName);
      sheet.getRange(row, col + 1).setValue(valor);
      this.cache = {};
      console.log(`✅ Celda actualizada: ${sheetName}!${row}:${col}`);
    } catch (e) {
      console.error(`Error en actualizarCelda: ${e.message}`);
      throw e;
    }
  }
  
  /**
   * Agrega fila (V2)
   */
  agregarFila(sheetName, valores) {
    try {
      if (!sheetName || !valores || !Array.isArray(valores)) {
        throw new Error('Parámetros inválidos en agregarFila');
      }
      
      const sheet = this.getSheet(sheetName);
      sheet.appendRow(valores);
      this.cache = {};
      console.log(`✅ Fila agregada a ${sheetName}`);
    } catch (e) {
      console.error(`Error en agregarFila: ${e.message}`);
      throw e;
    }
  }
  
  /**
   * Obtiene última fila (V2)
   */
  obtenerUltimaFila(sheetName) {
    try {
      const sheet = this.getSheet(sheetName);
      return sheet.getLastRow();
    } catch (e) {
      console.error(`Error en obtenerUltimaFila: ${e.message}`);
      return 0;
    }
  }
  
  /**
   * Busca valor en columna (V1)
   */
  buscarEnColumna(sheetName, columnIndex, valor) {
    try {
      const { rows, headers } = this.leerDatos(sheetName);
      
      if (!headers || headers.length === 0) {
        console.warn('⚠️ No hay headers disponibles');
        return -1;
      }
      
      if (columnIndex < 0 || columnIndex >= headers.length) {
        console.warn(`⚠️ Índice de columna inválido: ${columnIndex}`);
        return -1;
      }
      
      const colName = headers[columnIndex];
      return rows.findIndex(row => 
        safeCompare(row[colName], valor)
      );
    } catch (e) {
      console.error(`Error en buscarEnColumna: ${e.message}`);
      return -1;
    }
  }
  
  /**
   * Obtiene rango de datos (V1)
   */
  obtenerRango(sheetName, startRow, endRow, startCol, endCol) {
    try {
      if (startRow < 1 || endRow < startRow || startCol < 1 || endCol < startCol) {
        throw new Error('Rango inválido');
      }
      
      const sheet = this.getSheet(sheetName);
      return sheet.getRange(startRow, startCol, endRow - startRow + 1, endCol - startCol + 1)
        .getValues();
    } catch (e) {
      console.error(`Error en obtenerRango: ${e.message}`);
      return [];
    }
  }
  
  /**
   * Actualiza rango (V1)
   */
  actualizarRango(sheetName, startRow, startCol, valores) {
    try {
      if (!valores || !Array.isArray(valores) || valores.length === 0) {
        throw new Error('Valores inválidos en actualizarRango');
      }
      
      const sheet = this.getSheet(sheetName);
      const range = sheet.getRange(startRow, startCol, valores.length, valores[0].length);
      range.setValues(valores);
      this.cache = {};
      console.log(`✅ Rango actualizado`);
    } catch (e) {
      console.error(`Error en actualizarRango: ${e.message}`);
      throw e;
    }
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * GESTOR DE FILTRO MATRIZ - NUEVO MÓDULO
 * Gestiona agrupaciones de proyectos para salidas
 * ═══════════════════════════════════════════════════════════
 */

class GestorFiltroMatriz {
  constructor(fileId = null) {
    try {
      validateConfig();
      this.gestor = new GestorDatos(fileId);
      this.auditoria = new GestorAuditoria(fileId);
      this._asegurarHojaFiltroMatriz();
      console.log('✅ GestorFiltroMatriz inicializado');
    } catch (e) {
      console.error(`❌ Error en GestorFiltroMatriz: ${e.message}`);
      throw e;
    }
  }

  /**
   * ✅ Obtiene todos los filtros matriz
   */
  obtenerTodos() {
    try {
      const { rows, headers } = this.gestor.leerDatos(
        getConfig('FILTRO_MATRIZ.SHEET_NAME')
      );

      if (!headers || headers.length === 0) {
        console.warn('⚠️ No hay headers en FiltroMatriz');
        return [];
      }

      return rows
        .filter(row => {
          const activoIdx = findColumnIndex(headers, 'ACTIVO');
          return activoIdx >= 0 && row[headers[activoIdx]] !== 'NO';
        })
        .map(row => {
          const idIdx = findColumnIndex(headers, 'ID');
          const nomIdx = findColumnIndex(headers, 'NOMBRE_FILTRO');
          const descIdx = findColumnIndex(headers, 'DESCRIPCION');
          const inclIdx = findColumnIndex(headers, 'PROYECTOS_INCLUIDOS');
          const exclIdx = findColumnIndex(headers, 'PROYECTOS_EXCLUIDOS');
          const activoIdx = findColumnIndex(headers, 'ACTIVO');
          const tipoIdx = findColumnIndex(headers, 'TIPO');
          const usrIdx = findColumnIndex(headers, 'USUARIO_CREADOR');
          const fechaIdx = findColumnIndex(headers, 'FECHA_CREACION');
          const modIdx = findColumnIndex(headers, 'ULTIMA_MODIFICACION');

          return {
            id: idIdx >= 0 ? row[headers[idIdx]] || '' : '',
            nombre: nomIdx >= 0 ? row[headers[nomIdx]] || '' : '',
            descripcion: descIdx >= 0 ? row[headers[descIdx]] || '' : '',
            proyectosIncluidos: inclIdx >= 0 
              ? String(row[headers[inclIdx]] || '').split(',').map(p => p.trim()).filter(p => p)
              : [],
            proyectosExcluidos: exclIdx >= 0
              ? String(row[headers[exclIdx]] || '').split(',').map(p => p.trim()).filter(p => p)
              : [],
            activo: activoIdx >= 0 ? row[headers[activoIdx]] || 'SI' : 'SI',
            tipo: tipoIdx >= 0 ? row[headers[tipoIdx]] || 'INDIVIDUAL' : 'INDIVIDUAL',
            usuarioCreador: usrIdx >= 0 ? row[headers[usrIdx]] || '' : '',
            fechaCreacion: fechaIdx >= 0 ? row[headers[fechaIdx]] || '' : '',
            ultimaModificacion: modIdx >= 0 ? row[headers[modIdx]] || '' : ''
          };
        });
    } catch (e) {
      console.error(`Error en obtenerTodos: ${e.message}`);
      return [];
    }
  }

  // ✅ FASE 6: activarFiltro()/eliminarFiltro() removidas de aquí — eran copias
  // muertas/sombreadas (esta misma clase las redeclara más abajo; en JS la
  // última declaración de un método en un cuerpo de clase gana en silencio,
  // así que esas eran las que realmente se ejecutaban — ver más abajo en
  // esta clase). Confirmado por TODOS.md ítem 10.


  /**
   * ✅ Obtiene un filtro específico por ID
   */
  obtenerPorId(id) {
    try {
      const filtros = this.obtenerTodos();
      return filtros.find(f => f.id === id) || null;
    } catch (e) {
      console.error(`Error en obtenerPorId: ${e.message}`);
      return null;
    }
  }

  /**
   * ✅ Obtiene el filtro activo (solo uno puede estar activo)
   */
  obtenerFiltroActivo() {
    try {
      const { rows, headers } = this.gestor.leerDatos(
        getConfig('FILTRO_MATRIZ.SHEET_NAME')
      );

      if (!headers || headers.length === 0) {
        console.warn('⚠️ No hay headers en FiltroMatriz');
        return null;
      }

      const activoIndex = findColumnIndex(headers, 'ACTIVO');
      if (activoIndex < 0) {
        console.warn('⚠️ Columna ACTIVO no encontrada');
        return null;
      }

      const filaActiva = rows.find(
        row => row[headers[activoIndex]] === 'ACTIVO_PRINCIPAL'
      );

      if (!filaActiva) return null;

      const idIndex = findColumnIndex(headers, 'ID');
      if (idIndex < 0) return null;

      return this.obtenerPorId(filaActiva[headers[idIndex]]);
    } catch (e) {
      console.error(`Error en obtenerFiltroActivo: ${e.message}`);
      return null;
    }
  }

  /**
   * ✅ Crea nuevo filtro matriz
   */
  crearFiltro(nombre, descripcion, proyectosIncluidos, proyectosExcluidos, usuario) {
    try {
      if (!nombre || nombre.trim() === '') {
        throw new Error('Nombre de filtro requerido');
      }

      const id = generarId();
      const ahora = new Date();

      const fila = [
        id,
        nombre.trim(),
        descripcion || '',
        Array.isArray(proyectosIncluidos) ? proyectosIncluidos.join(',') : '',
        Array.isArray(proyectosExcluidos) ? proyectosExcluidos.join(',') : '',
        'SI',
        usuario,
        ahora,
        ahora,
        (Array.isArray(proyectosIncluidos) && proyectosIncluidos.length > 1) ? 'AGRUPADO' : 'INDIVIDUAL'
      ];

      this.gestor.agregarFila(getConfig('FILTRO_MATRIZ.SHEET_NAME'), fila);

      this.auditoria.registrarAccion(
        usuario,
        'CREAR_FILTRO_MATRIZ',
        `Nombre: ${nombre}, Proyectos: ${Array.isArray(proyectosIncluidos) ? proyectosIncluidos.length : 0}`
      );

      console.log(`✅ Filtro creado: ${nombre} (${id})`);

      return {
        success: true,
        message: `Filtro "${nombre}" creado exitosamente`,
        id: id
      };
    } catch (e) {
      console.error(`Error en crearFiltro: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }

  /**
   * ✅ Actualiza un filtro existente
   */
  actualizarFiltro(id, nombre, descripcion, proyectosIncluidos, proyectosExcluidos, usuario) {
    try {
      const { rows, headers } = this.gestor.leerDatos(
        getConfig('FILTRO_MATRIZ.SHEET_NAME')
      );

      if (!headers || headers.length === 0) {
        throw new Error('No hay headers disponibles');
      }

      const idIndex = findColumnIndex(headers, 'ID');
      if (idIndex < 0) throw new Error('Columna ID no encontrada');

      const rowIndex = rows.findIndex(r => r[headers[idIndex]] === id);

      if (rowIndex < 0) {
        throw new Error(`Filtro no encontrado: ${id}`);
      }

      const nombreIndex = findColumnIndex(headers, 'NOMBRE_FILTRO');
      const descIndex = findColumnIndex(headers, 'DESCRIPCION');
      const inclIndex = findColumnIndex(headers, 'PROYECTOS_INCLUIDOS');
      const exclIndex = findColumnIndex(headers, 'PROYECTOS_EXCLUIDOS');
      const modIndex = findColumnIndex(headers, 'ULTIMA_MODIFICACION');
      const tipoIndex = findColumnIndex(headers, 'TIPO');

      // Batch update contiguous block (nombre..tipo) when possible
      const indices = [nombreIndex, descIndex, inclIndex, exclIndex, modIndex, tipoIndex].filter(i => i >= 0);
      if (indices.length > 0) {
        const minIdx = Math.min.apply(null, indices);
        const maxIdx = Math.max.apply(null, indices);
        const width = maxIdx - minIdx + 1;

        // Build row values array of length 'width'
        const newRow = new Array(width).fill('');
        if (nombreIndex >= 0) newRow[nombreIndex - minIdx] = nombre;
        if (descIndex >= 0) newRow[descIndex - minIdx] = descripcion;
        if (inclIndex >= 0) newRow[inclIndex - minIdx] = Array.isArray(proyectosIncluidos) ? proyectosIncluidos.join(',') : '';
        if (exclIndex >= 0) newRow[exclIndex - minIdx] = Array.isArray(proyectosExcluidos) ? proyectosExcluidos.join(',') : '';
        if (modIndex >= 0) newRow[modIndex - minIdx] = new Date();
        if (tipoIndex >= 0) newRow[tipoIndex - minIdx] = (Array.isArray(proyectosIncluidos) && proyectosIncluidos.length > 1) ? 'AGRUPADO' : 'INDIVIDUAL';

        this.gestor.actualizarRango(
          getConfig('FILTRO_MATRIZ.SHEET_NAME'),
          rowIndex + 2,
          minIdx + 1,
          [newRow]
        );
      }

      this.auditoria.registrarAccion(
        usuario,
        'ACTUALIZAR_FILTRO_MATRIZ',
        `ID: ${id}, Nombre: ${nombre}`
      );

      console.log(`✅ Filtro actualizado: ${nombre}`);

      return {
        success: true,
        message: `Filtro actualizado exitosamente`
      };
    } catch (e) {
      console.error(`Error en actualizarFiltro: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }

  /**
   * ✅ Activa un filtro (desactiva los demás)
   */
  activarFiltro(id, usuario) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);

      const { rows, headers } = this.gestor.leerDatos(
        getConfig('FILTRO_MATRIZ.SHEET_NAME')
      );

      if (!headers || headers.length === 0) {
        throw new Error('No hay headers disponibles');
      }

      const idIndex = findColumnIndex(headers, 'ID');
      const activoIndex = findColumnIndex(headers, 'ACTIVO');

      if (idIndex < 0 || activoIndex < 0) {
        throw new Error('Columnas requeridas no encontradas');
      }

      // Batch: preparar valores para columna ACTIVO
      const numRows = rows.length;
      if (numRows === 0) throw new Error('No hay filas en FiltroMatriz');

      const activos = [];
      for (let i = 0; i < numRows; i++) {
        const rowId = rows[i][headers[idIndex]];
        activos.push([ rowId === id ? 'ACTIVO_PRINCIPAL' : 'SI' ]);
      }

      const sheet = this.gestor.getSheet(getConfig('FILTRO_MATRIZ.SHEET_NAME'));
      sheet.getRange(2, activoIndex + 1, activos.length, 1).setValues(activos);

      // Invalidar cache
      this.gestor.cache = {};

      this.auditoria.registrarAccion(
        usuario,
        'ACTIVAR_FILTRO_MATRIZ',
        `ID: ${id}`
      );

      console.log(`✅ Filtro activado: ${id}`);

      return {
        success: true,
        message: 'Filtro activado'
      };
    } catch (e) {
      console.error(`Error en activarFiltro: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    } finally {
      try { lock.releaseLock(); } catch (er) {}
    }
  }

  /**
   * ✅ Elimina un filtro (lo marca como inactivo)
   */
  eliminarFiltro(id, usuario) {
    try {
      const { rows, headers } = this.gestor.leerDatos(
        getConfig('FILTRO_MATRIZ.SHEET_NAME')
      );

      if (!headers || headers.length === 0) {
        throw new Error('No hay headers disponibles');
      }

      const idIndex = findColumnIndex(headers, 'ID');
      const activoIndex = findColumnIndex(headers, 'ACTIVO');

      if (idIndex < 0 || activoIndex < 0) {
        throw new Error('Columnas requeridas no encontradas');
      }

      const rowIndex = rows.findIndex(r => r[headers[idIndex]] === id);
      if (rowIndex < 0) {
        throw new Error(`Filtro no encontrado: ${id}`);
      }

      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(30000);
        this.gestor.actualizarRango(
          getConfig('FILTRO_MATRIZ.SHEET_NAME'),
          rowIndex + 2,
          activoIndex + 1,
          [[ 'NO' ]]
        );

        this.auditoria.registrarAccion(
          usuario,
          'ELIMINAR_FILTRO_MATRIZ',
          `ID: ${id}`
        );

        console.log(`✅ Filtro eliminado: ${id}`);

        return {
          success: true,
          message: 'Filtro eliminado'
        };
      } finally {
        try { lock.releaseLock(); } catch (er) {}
      }
    } catch (e) {
      console.error(`Error en eliminarFiltro: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }

  /**
 * Obtiene lista de proyectos visibles según filtro activo
 */
obtenerProyectosVisibles() {
  try {
    const filtroActivo = this.obtenerFiltroActivo();
    
    if (!filtroActivo) {
      return { todos: true, proyectos: [], excluidos: [] };
    }
    
    if (filtroActivo.proyectosIncluidos && filtroActivo.proyectosIncluidos.length > 0) {
      return { 
        todos: false, 
        proyectos: filtroActivo.proyectosIncluidos, 
        excluidos: [] 
      };
    }
    
    if (filtroActivo.proyectosExcluidos && filtroActivo.proyectosExcluidos.length > 0) {
      return { 
        todos: false, 
        proyectos: [], 
        excluidos: filtroActivo.proyectosExcluidos 
      };
    }
    
    return { todos: true, proyectos: [], excluidos: [] };
  } catch (e) {
    console.error(`Error en obtenerProyectosVisibles: ${e.message}`);
    return { todos: true, proyectos: [], excluidos: [] };
  }
}

  /**
   * ✅ Filtra datos según el filtro matriz activo
   */
  filtrarDatos(datos) {
    try {
      if (!datos || !Array.isArray(datos)) {
        console.warn('⚠️ datos no es un array válido');
        return [];
      }

      const proyectosVisibles = this.obtenerProyectosVisibles();

      if (proyectosVisibles.todos) {
        return datos;
      }

      const proyectoCol = getConfig('COLUMNS.PROYECTO');

      if (proyectosVisibles.proyectos && proyectosVisibles.proyectos.length > 0) {
        return datos.filter(row =>
          proyectosVisibles.proyectos.includes(row[proyectoCol])
        );
      }

      if (proyectosVisibles.excluidos && proyectosVisibles.excluidos.length > 0) {
        return datos.filter(
          row => !proyectosVisibles.excluidos.includes(row[proyectoCol])
        );
      }

      return datos;
    } catch (e) {
      console.error(`Error en filtrarDatos: ${e.message}`);
      return datos;
    }
  }

  /**
   * ✅ Asegura que exista la hoja de Filtro Matriz
   */
  _asegurarHojaFiltroMatriz() {
  try {
    const sheetName = getConfig('FILTRO_MATRIZ.SHEET_NAME');
    let sheet = this.gestor.ss.getSheetByName(sheetName);
    
    if (!sheet) {
      console.log(`📋 Creando hoja ${sheetName}...`);
      sheet = this.gestor.ss.insertSheet(sheetName);
      
      // Crear headers
      const headers = [
        'ID',
        'NOMBRE_FILTRO',
        'DESCRIPCION',
        'PROYECTOS_INCLUIDOS',
        'PROYECTOS_EXCLUIDOS',
        'ACTIVO',
        'USUARIO_CREADOR',
        'FECHA_CREACION',
        'ULTIMA_MODIFICACION',
        'TIPO'
      ];
      
      sheet.appendRow(headers);
      
      // Formato de headers
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#34495e');
      headerRange.setFontColor('#ffffff');
      
      console.log(`✅ Hoja ${sheetName} creada con headers`);
    }
    
    return sheet;
  } catch (e) {
    console.error(`Error en _asegurarHojaFiltroMatriz: ${e.message}`);
    // No lanzar error — si falla, el sistema sigue funcionando sin filtros
  }
}
}
