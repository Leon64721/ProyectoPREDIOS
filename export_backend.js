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

  global.EXPORT_BACKEND = {
    ENGINE: EXPORT_ENGINE,
    sanitizeExportValue: sanitizeExportValue,
    buildInstitutionHeader: buildInstitutionHeader,
    normalizeExportDataset: normalizeExportDataset,
    buildCsvExport: buildCsvExport,
    buildWorkbookPayload: buildWorkbookPayload,
    chunkRows: chunkRows,
    exportInBatches: exportInBatches
  };

  global.buildCsvExport = buildCsvExport;
  global.buildWorkbookPayload = buildWorkbookPayload;
  global.exportInBatches = exportInBatches;
  global.buildInstitutionHeader = buildInstitutionHeader;
})(typeof globalThis !== 'undefined' ? globalThis : this);
