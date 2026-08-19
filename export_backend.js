'use strict';

(function(global) {
  const EXPORT_ENGINE = {
    institutionName: 'INSTITUTO DE DESARROLLO URBANO',
    institutionShort: 'IDU',
    separator: ';',
    batchSize: 1000,
    defaultColumns: [
      'RT',
      'PROYECTO',
      'TRAMO',
      'ESTADO',
      'DISPONIBILIDAD',
      'VALOR_ESTIMADO',
      'FECHA_ACTUALIZACION',
      'OBSERVACIONES'
    ]
  };

  function sanitizeExportValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.replace(/\r?\n/g, ' ').trim();
    if (typeof value === 'number' && !isFinite(value)) return '';
    return String(value).replace(/\r?\n/g, ' ').trim();
  }

  function csvEscape(value, separator) {
    const text = sanitizeExportValue(value);
    const delimiter = separator || EXPORT_ENGINE.separator;
    const needsQuotes = /["\n\r]/.test(text) || text.indexOf(delimiter) >= 0;
    return needsQuotes ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function normalizeExportDataset(dataset, options) {
    const fallbackColumns = Array.isArray(options && options.columns) ? options.columns : EXPORT_ENGINE.defaultColumns;
    const rows = Array.isArray(dataset) ? dataset : (dataset && Array.isArray(dataset.rows) ? dataset.rows : []);
    const headers = Array.isArray(dataset && dataset.headers) && dataset.headers.length
      ? dataset.headers
      : ((rows.length && typeof rows[0] === 'object') ? Object.keys(rows[0]) : fallbackColumns);

    const normalizedRows = rows.map(function(row) {
      const source = row && typeof row === 'object' ? row : {};
      const next = {};
      headers.forEach(function(header) {
        next[String(header)] = source[header] !== undefined ? source[header] : '';
      });
      return next;
    });

    return {
      headers: headers.map(String),
      rows: normalizedRows
    };
  }

  function buildInstitutionHeader(metadata) {
    const stamp = metadata && metadata.generatedAt ? metadata.generatedAt : new Date();
    return [
      EXPORT_ENGINE.institutionName,
      metadata && metadata.title ? metadata.title : 'EXPORTACIÓN DE DATOS',
      'Fecha de generación: ' + (stamp instanceof Date ? stamp.toLocaleString('es-CO') : String(stamp)),
      metadata && metadata.user ? 'Usuario: ' + metadata.user : 'Usuario: Sistema',
      metadata && metadata.filterLabel ? 'Filtro: ' + metadata.filterLabel : 'Filtro: Todos'
    ];
  }

  function buildCsvExport(dataset, options) {
    const safeOptions = options || {};
    const separator = safeOptions.separator || EXPORT_ENGINE.separator;
    const normalized = normalizeExportDataset(dataset, safeOptions);
    const columns = Array.isArray(safeOptions.columns) && safeOptions.columns.length
      ? safeOptions.columns
      : normalized.headers;

    const lines = [];
    const finalHeaders = columns.map(String);
    const metadata = buildInstitutionHeader({
      generatedAt: safeOptions.generatedAt || new Date(),
      title: safeOptions.title || 'EXPORTACIÓN IDU',
      user: safeOptions.user || 'Sistema',
      filterLabel: safeOptions.filterLabel || 'Todos'
    });

    lines.push(metadata.map(function(value) { return csvEscape(value, separator); }).join(separator));
    lines.push(finalHeaders.map(function(header) { return csvEscape(header, separator); }).join(separator));

    normalized.rows.forEach(function(row) {
      const serialized = finalHeaders.map(function(header) {
        const value = row[header] !== undefined ? row[header] : (row[header.toLowerCase()] !== undefined ? row[header.toLowerCase()] : '');
        return csvEscape(value, separator);
      });
      lines.push(serialized.join(separator));
    });

    return lines.join('\r\n');
  }

  function buildWorkbookPayload(dataset, options) {
    const safeOptions = options || {};
    const normalized = normalizeExportDataset(dataset, safeOptions);
    const columns = Array.isArray(safeOptions.columns) && safeOptions.columns.length
      ? safeOptions.columns
      : normalized.headers;

    const headers = columns.map(String);
    const rows = normalized.rows.map(function(row) {
      return headers.map(function(header) {
        const value = row[header] !== undefined ? row[header] : (row[header.toLowerCase()] !== undefined ? row[header.toLowerCase()] : '');
        return sanitizeExportValue(value);
      });
    });

    return {
      metadata: buildInstitutionHeader({
        generatedAt: safeOptions.generatedAt || new Date(),
        title: safeOptions.title || 'EXPORTACIÓN IDU',
        user: safeOptions.user || 'Sistema',
        filterLabel: safeOptions.filterLabel || 'Todos'
      }),
      headers: headers,
      rows: rows,
      totalRows: rows.length,
      generatedAt: safeOptions.generatedAt || new Date().toISOString()
    };
  }

  function chunkRows(rows, chunkSize) {
    const size = chunkSize || EXPORT_ENGINE.batchSize;
    const output = [];
    for (let i = 0; i < rows.length; i += size) {
      output.push(rows.slice(i, i + size));
    }
    return output;
  }

  function exportInBatches(dataset, options, onBatch) {
    const safeOptions = options || {};
    const normalized = normalizeExportDataset(dataset, safeOptions);
    const chunks = chunkRows(normalized.rows, safeOptions.batchSize || EXPORT_ENGINE.batchSize);

    chunks.forEach(function(chunk, index) {
      const rows = chunk.map(function(row) {
        return normalized.headers.map(function(header) {
          const value = row[header] !== undefined ? row[header] : (row[header.toLowerCase()] !== undefined ? row[header.toLowerCase()] : '');
          return sanitizeExportValue(value);
        });
      });

      if (typeof onBatch === 'function') {
        onBatch({
          index: index,
          rows: rows,
          headers: normalized.headers,
          totalChunks: chunks.length,
          metadata: buildInstitutionHeader({
            generatedAt: safeOptions.generatedAt || new Date(),
            title: safeOptions.title || 'EXPORTACIÓN IDU',
            user: safeOptions.user || 'Sistema',
            filterLabel: safeOptions.filterLabel || 'Todos'
          })
        });
      }
    });
  }

  // ✅ [CONC-FE-15]: plantilla CSV plana (SIN el banner institucional de buildCsvExport) —
  // este archivo debe poder reimportarse tal cual con procesarArchivoAsignacionCSV() en
  // app_equipos_js.html, así que la primera línea tiene que ser el encabezado real, no un
  // renglón informativo. Mismo separador ';' que EXPORT_ENGINE para que el parser cliente
  // (que asume el mismo delimitador) lea el archivo sin ambigüedad.
  function buildCsvPlano(rows, headers, separator) {
    const sep = separator || EXPORT_ENGINE.separator;
    const lines = [headers.map(function(h) { return csvEscape(h, sep); }).join(sep)];
    rows.forEach(function(row) {
      lines.push(headers.map(function(h) { return csvEscape(row[h], sep); }).join(sep));
    });
    return lines.join('\r\n');
  }

  /**
   * ✅ [CONC-FE-15]: plantilla de asignación masiva — filtra los RTs visibles (RBAC) por
   * nivel/idTarget cruzando con el overlay vigente (Datos + ASIGNACIONES_EQUIPOS fusionados
   * vía _leerFilasVisiblesRBACEquipos(), función global de gestion_equipos_backend.js —
   * mismo scope compartido de Apps Script, sin imports) y devuelve un CSV con columnas
   * estrictas RT;PROYECTO;TRAMO;ARTICULADOR_EMAIL;GESTOR_EMAIL. Los RTs sin email
   * homologado quedan con esas dos columnas vacías a propósito, para que el usuario las
   * llene en Excel y vuelva a subir el archivo.
   *
   * `nivel`: 'PROYECTO' | 'TRAMO' | 'RT' | '' (vacío = sin filtro, exporta todo lo
   * visible para el usuario). `proyectoContexto` (opcional, solo relevante para nivel
   * TRAMO): el nombre de tramo por sí solo es ambiguo entre proyectos distintos (mismo
   * problema resuelto con clave compuesta en getProyectosYListaUsuarios(), CONC-FE-14) — se
   * pasa el proyecto actualmente seleccionado en el cliente para desambiguar.
   *
   * ✅ [CONC-FE-17]: contrato de retorno con nombres explícitos `csvString`/`filename` (antes
   * `csv`/`totalFilas` sin nombre de archivo) — el cliente ya no arma el nombre del archivo
   * por su cuenta a partir de idTarget, el servidor lo genera con timestamp para que dos
   * descargas seguidas nunca choquen de nombre. try/catch ya envolvía toda la función desde
   * CONC-FE-15; se mantiene, solo cambia la forma del objeto de éxito.
   */
  function generarPlantillaAsignacionCSV(nivel, idTarget, proyectoContexto) {
    try {
      if (typeof _leerFilasVisiblesRBACEquipos !== 'function') {
        throw new Error('_leerFilasVisiblesRBACEquipos no está disponible (gestion_equipos_backend.js no cargado)');
      }

      const nivelUpper = String(nivel || '').toUpperCase();
      const filas = _leerFilasVisiblesRBACEquipos();

      let filtradas;
      if (nivelUpper === 'PROYECTO') {
        filtradas = filas.filter(function(f) { return f.proyecto === idTarget; });
      } else if (nivelUpper === 'TRAMO') {
        filtradas = filas.filter(function(f) {
          return f.tramo === idTarget && (!proyectoContexto || f.proyecto === proyectoContexto);
        });
      } else if (nivelUpper === 'RT') {
        filtradas = filas.filter(function(f) { return f.rt === idTarget; });
      } else {
        filtradas = filas; // sin filtro: todo lo visible para el usuario (uso administrativo)
      }

      filtradas = filtradas.slice().sort(function(a, b) { return String(a.rt).localeCompare(String(b.rt)); });

      const columnas = ['RT', 'PROYECTO', 'TRAMO', 'ARTICULADOR_EMAIL', 'GESTOR_EMAIL'];
      const dataset = filtradas.map(function(f) {
        return {
          RT: f.rt,
          PROYECTO: f.proyecto,
          TRAMO: f.tramo,
          ARTICULADOR_EMAIL: f.articuladorEsEmail ? f.articulador : '',
          GESTOR_EMAIL: f.gestorEsEmail ? f.gestor : ''
        };
      });

      const csvString = buildCsvPlano(dataset, columnas, EXPORT_ENGINE.separator);

      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
      const alcance = String(idTarget || 'todos').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const filename = 'plantilla_asignacion_' + alcance + '_' + timestamp + '.csv';

      return { success: true, csvString: csvString, filename: filename, totalFilas: dataset.length };
    } catch (e) {
      console.error('❌ Error en generarPlantillaAsignacionCSV: ' + e.message);
      return { success: false, error: e.message };
    }
  }

  global.EXPORT_BACKEND = {
    ENGINE: EXPORT_ENGINE,
    sanitizeExportValue: sanitizeExportValue,
    buildInstitutionHeader: buildInstitutionHeader,
    normalizeExportDataset: normalizeExportDataset,
    buildCsvExport: buildCsvExport,
    buildWorkbookPayload: buildWorkbookPayload,
    chunkRows: chunkRows,
    exportInBatches: exportInBatches,
    buildCsvPlano: buildCsvPlano,
    generarPlantillaAsignacionCSV: generarPlantillaAsignacionCSV
  };

  global.buildCsvExport = buildCsvExport;
  global.buildWorkbookPayload = buildWorkbookPayload;
  global.exportInBatches = exportInBatches;
  global.buildInstitutionHeader = buildInstitutionHeader;
  global.generarPlantillaAsignacionCSV = generarPlantillaAsignacionCSV;
})(typeof globalThis !== 'undefined' ? globalThis : this);
