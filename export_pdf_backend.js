'use strict';

/**
 * Motor de generación de PDF institucional — Sprint 4, Fase B [CONC-FE-09].
 * Recibe payloads ya resueltos en cliente (currentData / IndexedDB); no lee SpreadsheetApp.
 * Procesa el reporte de alertas por lotes de PDF_ENGINE.batchSize (Directiva 3) y devuelve
 * el PDF como base64 para que el cliente dispare la descarga (sin MailApp, sin Drive persistente).
 */
(function(global) {
  const PDF_ENGINE = {
    institutionName: 'INSTITUTO DE DESARROLLO URBANO',
    institutionShort: 'IDU',
    batchSize: 1000
  };

  function sanitize(value) {
    if (typeof EXPORT_BACKEND !== 'undefined' && EXPORT_BACKEND.sanitizeExportValue) {
      return EXPORT_BACKEND.sanitizeExportValue(value);
    }
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r?\n/g, ' ').trim();
  }

  function s(value, fallback) {
    const out = sanitize(value);
    return out === '' ? (fallback || '-') : out;
  }

  function styleAttrs(overrides) {
    const base = {};
    base[DocumentApp.Attribute.FONT_SIZE] = 9;
    base[DocumentApp.Attribute.FOREGROUND_COLOR] = '#000000';
    return Object.assign(base, overrides || {});
  }

  function appendInstitutionHeader(body, title, metadata) {
    const entity = body.appendParagraph(PDF_ENGINE.institutionName);
    entity.setAttributes(styleAttrs({
      [DocumentApp.Attribute.FONT_SIZE]: 14,
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#2c3e50'
    }));
    entity.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const titleP = body.appendParagraph(title);
    titleP.setAttributes(styleAttrs({
      [DocumentApp.Attribute.FONT_SIZE]: 12,
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#34495e'
    }));
    titleP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const meta = body.appendParagraph(
      'Generado: ' + new Date().toLocaleString('es-CO') + '\n' +
      'Usuario: ' + s(metadata && metadata.user, 'Sistema')
    );
    meta.setAttributes(styleAttrs({
      [DocumentApp.Attribute.FONT_SIZE]: 8,
      [DocumentApp.Attribute.ITALIC]: true
    }));
    meta.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    body.appendHorizontalRule();
  }

  function appendFieldTable(body, pairs) {
    const table = body.appendTable();
    pairs.forEach(function(pair) {
      const row = table.appendTableRow();
      row.appendTableCell(pair[0]).setAttributes(styleAttrs({
        [DocumentApp.Attribute.BOLD]: true,
        [DocumentApp.Attribute.BACKGROUND_COLOR]: '#f8f9fa'
      }));
      row.appendTableCell(pair[1]).setAttributes(styleAttrs({}));
    });
  }

  function severityColor(nivel) {
    const n = String(nivel || '').toUpperCase();
    if (n === 'CRITICA' || n === 'ROJO') return '#c0392b';
    if (n === 'ADVERTENCIA' || n === 'NARANJA' || n === 'AMARILLO') return '#d68910';
    return '#7f8c8d';
  }

  function severityRank(nivel) {
    const n = String(nivel || '').toUpperCase();
    if (n === 'CRITICA' || n === 'ROJO') return 0;
    if (n === 'ADVERTENCIA' || n === 'NARANJA' || n === 'AMARILLO') return 1;
    return 2;
  }

  function severityBadgeLabel(nivel) {
    const n = String(nivel || 'INFO').toUpperCase();
    return '[' + n + ']';
  }

  function appendAlertaItem(body, alerta) {
    const nivel = alerta.NIVEL || alerta.severidad;
    const cabecera = body.appendParagraph(severityBadgeLabel(nivel) + ' ' + s(alerta.REGLA || alerta.regla));
    cabecera.setAttributes(styleAttrs({
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: severityColor(nivel)
    }));

    const mensaje = alerta.MENSAJE || alerta.mensaje;
    if (mensaje) {
      const detalle = body.appendParagraph(s(mensaje));
      detalle.setAttributes(styleAttrs({ [DocumentApp.Attribute.FONT_SIZE]: 8 }));
    }
  }

  function appendAlertasSection(body, alertas) {
    if (!alertas.length) {
      const empty = body.appendParagraph('Sin alertas activas registradas.');
      empty.setAttributes(styleAttrs({
        [DocumentApp.Attribute.ITALIC]: true,
        [DocumentApp.Attribute.FOREGROUND_COLOR]: '#27ae60'
      }));
      return;
    }
    alertas.forEach(function(alerta) { appendAlertaItem(body, alerta); });
  }

  // Agrupa por severidad (crítica > advertencia > info) y, dentro de cada severidad, por proyecto.
  function ordenarPorSeveridadYProyecto(alertas) {
    return alertas.slice().sort(function(a, b) {
      const rankDiff = severityRank(a.NIVEL || a.severidad) - severityRank(b.NIVEL || b.severidad);
      if (rankDiff !== 0) return rankDiff;
      const proyectoA = String(a.PROYECTO || a.proyecto || '').toUpperCase();
      const proyectoB = String(b.PROYECTO || b.proyecto || '').toUpperCase();
      return proyectoA.localeCompare(proyectoB);
    });
  }

  function docToBase64AndDiscard(doc) {
    doc.saveAndClose();
    const file = DriveApp.getFileById(doc.getId());
    const pdfBlob = file.getAs('application/pdf');
    const base64 = Utilities.base64Encode(pdfBlob.getBytes());
    try {
      file.setTrashed(true);
    } catch (eTrash) {
      console.warn('No se pudo mover a la papelera el documento temporal: ' + eTrash.message);
    }
    return base64;
  }

  function buildFichaPredial(predioData, metadata) {
    const predio = predioData || {};
    const docName = 'Ficha_Predial_' + s(predio.RT, 'SIN_RT').replace(/[^A-Za-z0-9_-]/g, '_') + '_' + new Date().getTime();
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();
    body.setMarginTop(15);
    body.setMarginBottom(15);
    body.setMarginLeft(15);
    body.setMarginRight(15);

    appendInstitutionHeader(body, 'FICHA PREDIAL', metadata);

    appendFieldTable(body, [
      ['RT', s(predio.RT)],
      ['PROYECTO', s(predio.PROYECTO)],
      ['TRAMO', s(predio.TRAMO)],
      ['ESTADO', s(predio.ESTADO)],
      ['DISPONIBILIDAD', s(predio.DISPONIBILIDAD)],
      ['VALOR ESTIMADO', s(predio.VALOR_ESTIMADO)],
      ['VALOR PAGADO', s(predio.VALOR_PAGADO)],
      ['FECHA ACTUALIZACIÓN', s(predio.FECHA_ACTUALIZACION)]
    ]);

    body.appendParagraph('');
    const alertasTitle = body.appendParagraph('ALERTAS ACTIVAS');
    alertasTitle.setAttributes(styleAttrs({ [DocumentApp.Attribute.FONT_SIZE]: 11, [DocumentApp.Attribute.BOLD]: true }));
    appendAlertasSection(body, Array.isArray(predio.ALERTAS) ? predio.ALERTAS : []);

    body.appendParagraph('');
    const obsTitle = body.appendParagraph('OBSERVACIONES');
    obsTitle.setAttributes(styleAttrs({ [DocumentApp.Attribute.BOLD]: true }));
    body.appendParagraph(s(predio.OBSERVACIONES, 'Sin observaciones registradas.'));

    body.appendParagraph('');
    const footer = body.appendParagraph('Trazabilidad: generado por ' + s(metadata && metadata.user, 'Sistema') + ' el ' + new Date().toLocaleString('es-CO'));
    footer.setAttributes(styleAttrs({ [DocumentApp.Attribute.ITALIC]: true, [DocumentApp.Attribute.FONT_SIZE]: 7, [DocumentApp.Attribute.FOREGROUND_COLOR]: '#666666' }));
    footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const base64 = docToBase64AndDiscard(doc);
    return { fileName: docName + '.pdf', base64: base64 };
  }

  function buildReporteAlertas(alertasArray, metadata) {
    const alertas = Array.isArray(alertasArray) ? alertasArray : [];
    const docName = 'Reporte_Alertas_' + new Date().toISOString().split('T')[0] + '_' + new Date().getTime();
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();
    body.setMarginTop(15);
    body.setMarginBottom(15);
    body.setMarginLeft(15);
    body.setMarginRight(15);

    appendInstitutionHeader(body, 'REPORTE DE ALERTAS ACTIVAS', metadata);

    const agrupadas = ordenarPorSeveridadYProyecto(alertas);
    const chunks = (typeof EXPORT_BACKEND !== 'undefined' && EXPORT_BACKEND.chunkRows)
      ? EXPORT_BACKEND.chunkRows(agrupadas, PDF_ENGINE.batchSize)
      : [agrupadas];

    if (!agrupadas.length) {
      const empty = body.appendParagraph('Sin alertas activas registradas.');
      empty.setAttributes(styleAttrs({ [DocumentApp.Attribute.ITALIC]: true, [DocumentApp.Attribute.FOREGROUND_COLOR]: '#27ae60' }));
    }

    let total = 0;
    let currentSeveridad = null;
    let currentProyecto = null;

    chunks.forEach(function(chunk, chunkIndex) {
      if (chunks.length > 1) {
        const loteTitle = body.appendParagraph('Lote ' + (chunkIndex + 1) + '/' + chunks.length);
        loteTitle.setAttributes(styleAttrs({ [DocumentApp.Attribute.ITALIC]: true, [DocumentApp.Attribute.FONT_SIZE]: 8 }));
      }

      chunk.forEach(function(alerta) {
        const nivel = String(alerta.NIVEL || alerta.severidad || 'INFO').toUpperCase();
        const proyecto = s(alerta.PROYECTO || alerta.proyecto, 'SIN PROYECTO');

        if (nivel !== currentSeveridad) {
          currentSeveridad = nivel;
          currentProyecto = null;
          body.appendParagraph('');
          const sevTitle = body.appendParagraph('SEVERIDAD: ' + nivel);
          sevTitle.setAttributes(styleAttrs({
            [DocumentApp.Attribute.FONT_SIZE]: 11,
            [DocumentApp.Attribute.BOLD]: true,
            [DocumentApp.Attribute.FOREGROUND_COLOR]: severityColor(nivel)
          }));
        }

        if (proyecto !== currentProyecto) {
          currentProyecto = proyecto;
          const proyTitle = body.appendParagraph('Proyecto: ' + proyecto);
          proyTitle.setAttributes(styleAttrs({ [DocumentApp.Attribute.BOLD]: true, [DocumentApp.Attribute.FONT_SIZE]: 9 }));
        }

        appendAlertaItem(body, alerta);
        total += 1;
      });
    });

    body.appendParagraph('');
    const footer = body.appendParagraph('Total de alertas incluidas: ' + total);
    footer.setAttributes(styleAttrs({ [DocumentApp.Attribute.ITALIC]: true, [DocumentApp.Attribute.FONT_SIZE]: 8 }));

    const base64 = docToBase64AndDiscard(doc);
    return { fileName: docName + '.pdf', base64: base64, totalAlertas: total };
  }

  global.PDF_BACKEND = {
    ENGINE: PDF_ENGINE,
    buildFichaPredial: buildFichaPredial,
    buildReporteAlertas: buildReporteAlertas
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/**
 * Endpoint público: ficha PDF de un solo predio.
 * `predioData` viene ya armado en cliente desde currentData/IndexedDB — cero lectura de Sheets aquí.
 */
function generarFichaPredialPdfBackend(predioData, metadata) {
  try {
    const meta = metadata || {};
    if (!meta.user) {
      meta.user = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || 'Sistema';
    }
    const result = PDF_BACKEND.buildFichaPredial(predioData || {}, meta);
    return { success: true, fileName: result.fileName, base64: result.base64, mimeType: 'application/pdf' };
  } catch (e) {
    console.error('❌ Error generando ficha predial PDF: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Endpoint público: reporte PDF de alertas activas, agrupado por severidad y proyecto,
 * procesado en lotes de PDF_ENGINE.batchSize (Directiva 3).
 * `alertasArray` viene ya resuelto en cliente (alertasResumenActivo, tope MAX_ALERTAS_PAYLOAD=100).
 */
function generarReporteAlertasPdfBackend(alertasArray, metadata) {
  try {
    const meta = metadata || {};
    if (!meta.user) {
      meta.user = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || 'Sistema';
    }
    const result = PDF_BACKEND.buildReporteAlertas(alertasArray || [], meta);
    return {
      success: true,
      fileName: result.fileName,
      base64: result.base64,
      mimeType: 'application/pdf',
      totalAlertas: result.totalAlertas
    };
  } catch (e) {
    console.error('❌ Error generando reporte de alertas PDF: ' + e.message);
    return { success: false, error: e.message };
  }
}
