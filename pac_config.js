// ═══════════════════════════════════════════════════════════════════════════════
// PAC_CONFIG.GS — Configuración Central PAC v3.0
// Optimizado para performance + reemplazos + filtros desde MATRIZ
// ═══════════════════════════════════════════════════════════════════════════════

// ⚠️ SEGURIDAD [2026-08-19]: SS_PADRE_ID y PAC_SPREADSHEET_ID ya NO están hardcodeados
// — este repo estuvo público en GitHub y esos IDs quedaron expuestos. Se resuelven en
// runtime desde Script Properties (getConfigProperty(), definida en config.js — misma
// Apps Script project, ambos archivos comparten scope global). SS_PADRE_ID reutiliza la
// MISMA Script Property que CONFIG.MAESTRO_PERMISOS en config.js (es el mismo
// spreadsheet, no un ID distinto) — no crear una property nueva para este valor. Ver
// DOCUMENTACION_TECNICA_VIVA.md, sección "Migración de IDs sensibles a Script Properties".
const PAC_CONFIG = {
  SS_PADRE_ID: getConfigProperty('MAESTRO_PERMISOS_ID', ''),
  PAC_SPREADSHEET_ID: getConfigProperty('PAC_SPREADSHEET_ID', ''),

  // --- ⚠️ AGREGAR ESTE BLOQUE FALTANTE ⚠️ ---
  HOJAS_INTERNAS: {
    PAC_VIGENTE:       'PAC_Vigente',
    PAC_BORRADOR:      'PAC_Borrador',
    PAC_HISTORIAL:     'PAC_Historial',
    PAC_ALERTAS:       'PAC_Alertas',
    PAC_ARTICULADORES: 'PAC_Articuladores',
    BORRADOR:          'PAC_Borrador', // Alias por compatibilidad
    // AQUÍ ESTÁ EL CRUCE: Definimos que los datos prediales vienen de "Datos"
    DATOS_PREDIALES:   'Datos' 
  },

  PAC_SHEETS: {
    IDU:         { nombre: 'PAC IDU',          fuente: 'IDU' },
    TM:          { nombre: 'PAC TRANSMILENIO', fuente: 'TM'  },
    VIGENCIA_TM: { nombre: 'PAC VIGENCIA TMM', fuente: 'TM'  },
    INICIAL:     { nombre: 'PAC INICIAL',      fuente: 'IDU' }
  },

  COLUMNAS: {
    CRP:             'CRP',
    RT:              'RT',
    TIPO_NEG:        'TIPO NEG',
    BENEFICIARIO:    'BENEFICIARIO',
    PROYECTO:        'PROYECTO',
    FUENTE:          'FUENTE',
    SALDO_2026:      'SALDO 2026',
    SALDO_POR_PAGAR: 'SALDO POR PAGAR',
    FORMA_PAGO:      'FORMA DE PAGO',
    NUM_PAGOS:       'NUMERO DE PAGOS',
    CDP:             'CDP',
    CDP_TOTAL:       'CDP TOTAL',
    CRP_TOTAL:       'CRP TOTAL',
    CDP_VALOR:       'VALOR CDP 2026',
    OBSERVACIONES:   'OBSERVACIONES',
    PREFIJO_PROG:    'PROGRAMADO',
    PREFIJO_RAD:     'VALOR RADICADO',
    PREFIJO_FECHA:   'FECHA RADICADO',
    PREFIJO_OP:      'OP',
    PREFIJO_EJEC:    'VALOR EJECUTADO',
    PREFIJO_LIB:     'LIBERACION'
  },

  MESES: [
    'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
    'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'
  ],

  COLUMNAS_TMM: {
    PROYECTO:       'PROYECTO',
    CDP:            'CDP',
    RT:             'RT',
    SALDO:          'SALDO',
    VALOR_PAGADO:   'VALOR PAGADO',
    PROGRAMADO:     'PROGRAMADO',
    OBSERVACIONES:  'OBSERVACIONES'
  },

  HOJAS_INTERNAS: {
    VIGENTE:       'PAC_Vigente',
    BORRADOR:      'PAC_Borrador',
    HISTORIAL:     'PAC_Historial',
    ALERTAS:       'PAC_Alertas',
    ARTICULADORES: 'PAC_Articuladores',
    LOG:           'LOG_PAC_SISTEMA'
  },

  MODOS_EJECUCION: {
    RADICADO:  'RADICADO',
    EJECUTADO: 'EJECUTADO'
  },

  CACHE: {
    CORTA_SEG: 60,
    MEDIA_SEG: 300
  }
};

const PAC_ESTADOS = {
  'IDENTIFICADO':           { nivel: 1, elegible: false },
  'EN PROCESO':             { nivel: 2, elegible: false },
  'OFERTA FORMAL':          { nivel: 3, elegible: false },
  'PROMESA DE COMPRAVENTA': { nivel: 4, elegible: true  },
  'ESCRITURADO':            { nivel: 5, elegible: true  },
  'ENTREGADO':              { nivel: 6, elegible: true  },
  'ADQUIRIDO':              { nivel: 7, elegible: true  }
};

const PAC_REGLAS_REEMPLAZO_DEFAULT = [
  {
    id:'R001',
    nombre:'Estado Predial Elegible',
    campo:'ESTADO PREDIAL AJUSTADO',
    operador:'EN_LISTA',
    valores:['PROMESA DE COMPRAVENTA','ESCRITURADO','ENTREGADO','ADQUIRIDO'],
    activa:true,
    descripcion:'El candidato debe estar en estado predial elegible para pago'
  },
  {
    id:'R002',
    nombre:'Tiene saldo disponible',
    campo:'SALDO_REEMPLAZO',
    operador:'MAYOR_QUE',
    valores:[0],
    activa:true,
    descripcion:'Debe tener saldo disponible real para reemplazo'
  },
  {
    id:'R003',
    nombre:'Sin programación del período',
    campo:'PROGRAMADO_PERIODO',
    operador:'IGUAL_A',
    valores:[0],
    activa:false,
    descripcion:'Opcional: candidato sin programación en el período actual'
  }
];

// ── Cache por ejecución ────────────────────────────────────────────────────────
var _PAC_SS_CACHE = null;
var _PAC_RUNTIME_CACHE = {
  matriz: null,
  observaciones: null,
  vigente: null,
  reglas: null,
  articuladores: null
};

function pac_getSpreadsheet() {
  if (_PAC_SS_CACHE) return _PAC_SS_CACHE;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      _PAC_SS_CACHE = ss;
      return ss;
    }
  } catch(e) {}
  _PAC_SS_CACHE = SpreadsheetApp.openById(PAC_CONFIG.SS_PADRE_ID);
  return _PAC_SS_CACHE;
}

function pac_clearSSCache() {
  _PAC_SS_CACHE = null;
  _PAC_RUNTIME_CACHE = {
    matriz: null,
    observaciones: null,
    vigente: null,
    reglas: null,
    articuladores: null
  };
}

function pac_getColIdx(headers, nombreColumna) {
  if (!headers || !nombreColumna) return -1;
  return headers.findIndex(function(h) {
    return String(h || '').toUpperCase().trim() === String(nombreColumna).toUpperCase().trim();
  });
}

function pac_parseMoney(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  var str = String(val).replace(/[^0-9.,\-]/g, '').trim();
  if (!str) return 0;
  var normalized = str.replace(/\./g, '').replace(',', '.');
  var n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function pac_formatMoney(val) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(pac_parseMoney(val));
}

function pac_normalizarTexto(v) {
  return String(v || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pac_construirMapaMensual(headers) {
  var hUpper = headers.map(function(h) { return String(h).toUpperCase().trim(); });
  var mapa   = {};
  var meses  = PAC_CONFIG.MESES || [];

  meses.forEach(function(mes) {
    var M = mes.toUpperCase();

    // ── 1. Encontrar índice de "PROGRAMADO {MES}" ─────────────────────────
    var idxProg = hUpper.indexOf('PROGRAMADO ' + M);

    var idxRad   = -1;
    var idxFecha = -1;
    var idxOp    = -1;
    var idxEjec  = -1;
    var idxLib   = -1;

    if (idxProg >= 0) {
      // ── 2. Estrategia POSICIONAL (PAC IDU y TM) ──────────────────────────
      // Las columnas de radicado/ejecutado están INMEDIATAMENTE después
      // de "PROGRAMADO {MES}". Verificar que el siguiente header no sea
      // otro "PROGRAMADO" (lo que indicaría que no hay columnas intermedias).

      var siguiente = hUpper[idxProg + 1] || '';

      if (siguiente.indexOf('PROGRAMADO') < 0 && siguiente !== '') {
        // Hay columnas entre este PROGRAMADO y el siguiente → estrategia posicional
        idxRad   = idxProg + 1;  // "VALOR RADICADO" o "VALOR RADICADO {MES}"
        idxFecha = idxProg + 2;  // "FECHA RADICADO" o "FECHA RADICADO {MES}"
        idxOp    = idxProg + 3;  // "OP" o "OP {MES}"
        idxEjec  = idxProg + 4;  // "VALOR EJECUTADO" o "VALOR EJECUTADO {MES}"
        idxLib   = idxProg + 5;  // "LIBERACION {MES}"

        // Validar que los índices posicionales apuntan a columnas correctas
        // (no a otro "PROGRAMADO" ni a columna vacía)
        var headerRad = hUpper[idxRad] || '';
        if (headerRad.indexOf('PROGRAMADO') >= 0 || headerRad === '') {
          // No hay columnas intermedias → solo PROG existe para este mes
          idxRad = idxFecha = idxOp = idxEjec = idxLib = -1;
        }

        // Para TM: verificar si realmente tiene EJEC (TM no tiene OP/EJEC)
        var headerEjec = hUpper[idxEjec] || '';
        if (headerEjec.indexOf('PROGRAMADO') >= 0 ||
            headerEjec.indexOf('LIBERACION') >= 0 ||
            headerEjec === '') {
          idxEjec = -1;
        }
        var headerOp = hUpper[idxOp] || '';
        if (headerOp.indexOf('PROGRAMADO') >= 0 ||
            headerOp.indexOf('LIBERACION') >= 0 ||
            headerOp.indexOf('VALOR RADICADO') >= 0 ||
            headerOp === '') {
          idxOp = -1;
        }
        var headerLib = hUpper[idxLib] || '';
        if (headerLib.indexOf('PROGRAMADO') >= 0 || headerLib === '') {
          idxLib = -1;
        }
      }

      // ── 3. Fallback: buscar por nombre explícito con mes ─────────────────
      // Para TM que usa "VALOR RADICADO MAYO", "FECHA RADICADO MAYO"
      if (idxRad < 0) {
        idxRad = hUpper.indexOf('VALOR RADICADO ' + M);
        if (idxRad < 0) idxRad = hUpper.indexOf('RADICADO ' + M);
      }
      if (idxFecha < 0) {
        idxFecha = hUpper.indexOf('FECHA RADICADO ' + M);
        if (idxFecha < 0) idxFecha = hUpper.indexOf('FECHA ' + M);
      }
      if (idxEjec < 0) {
        idxEjec = hUpper.indexOf('VALOR EJECUTADO ' + M);
        if (idxEjec < 0) idxEjec = hUpper.indexOf('EJECUTADO ' + M);
      }
      if (idxLib < 0) {
        idxLib = hUpper.indexOf('LIBERACION ' + M);
        if (idxLib < 0) idxLib = hUpper.indexOf('LIBERACION' + M);
      }
    }

    mapa[mes] = {
      PROG:  idxProg,
      RAD:   idxRad,
      FECHA: idxFecha,
      OP:    idxOp,
      EJEC:  idxEjec,
      LIB:   idxLib
    };
  });

  return mapa;
}


// ── Logging ────────────────────────────────────────────────────────────────────
var _PAC_LOG_BUFFER = [];
var _PAC_LOG_MODO_BUFFER = false;

function pac_logIniciarBuffer() {
  _PAC_LOG_BUFFER = [];
  _PAC_LOG_MODO_BUFFER = true;
}

function pac_logVaciarBuffer() {
  _PAC_LOG_MODO_BUFFER = false;
  if (_PAC_LOG_BUFFER.length === 0) return;

  try {
    var ss = pac_getSpreadsheet();
    var hoja = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.LOG);
    if (!hoja) return;

    if (hoja.getLastRow() === 0) {
      hoja.getRange(1,1,1,5).setValues([['FECHA','NIVEL','MODULO','MENSAJE','USUARIO']]);
    }

    var usuario = '';
    try { usuario = Session.getActiveUser().getEmail(); } catch(e) {}

    var filas = _PAC_LOG_BUFFER.map(function(x) {
      return [x.fecha, x.nivel, 'PAC_MODULE', x.mensaje, usuario];
    });

    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 5).setValues(filas);
    _PAC_LOG_BUFFER = [];
  } catch(e) {
    _PAC_LOG_BUFFER = [];
    console.log('[pac_logVaciarBuffer] ' + e.message);
  }
}

function pac_log(mensaje, nivel) {
  nivel = nivel || 'INFO';
  console.log('[PAC ' + nivel + '] ' + mensaje);

  if (_PAC_LOG_MODO_BUFFER) {
    _PAC_LOG_BUFFER.push({ fecha:new Date(), nivel:nivel, mensaje:mensaje });
    return;
  }

  try {
    var ss = pac_getSpreadsheet();
    var hoja = ss.getSheetByName(PAC_CONFIG.HOJAS_INTERNAS.LOG);
    if (!hoja) return;

    if (hoja.getLastRow() === 0) {
      hoja.getRange(1,1,1,5).setValues([['FECHA','NIVEL','MODULO','MENSAJE','USUARIO']]);
    }

    var usuario = '';
    try { usuario = Session.getActiveUser().getEmail(); } catch(e) {}

    hoja.appendRow([new Date(), nivel, 'PAC_MODULE', mensaje, usuario]);
  } catch(e) {
    console.log('[PAC LOG ERROR] ' + e.message);
  }
}
