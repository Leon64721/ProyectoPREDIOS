/**
 * ═══════════════════════════════════════════════════════════════
 * MOTOR DE NORMALIZACIÓN v6.0 — Pipeline ETL sin pérdida
 * ═══════════════════════════════════════════════════════════════
 * GARANTÍA: DATOS_NORMALIZADOS tendrá EXACTAMENTE el mismo
 *           número de filas que CONSOLIDADO_SNAPSHOT_V19
 * ═══════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════
// FASE 0 — Mapeo maestro y sanitización V8
// ═════════════════════════════════════════════════════════════
function obtenerAliasCanonico(nombreCampo) {
  if (!nombreCampo && nombreCampo !== 0) return '';
  var raw = nombreCampo.toString().trim();
  if (raw === '') return '';

  var normalizado = normalizarEncabezado(raw).toUpperCase();
  var diccionario = CONFIG_NORMALIZACION && CONFIG_NORMALIZACION.diccionarioSinonimos ? CONFIG_NORMALIZACION.diccionarioSinonimos : {};
  var claves = Object.keys(diccionario);

  for (var i = 0; i < claves.length; i++) {
    var key = claves[i];
    var entrada = diccionario[key];
    var aliases = entrada && entrada.aliases ? entrada.aliases : [];
    for (var j = 0; j < aliases.length; j++) {
      if (normalizarEncabezado(aliases[j]).toUpperCase() === normalizado) {
        return entrada.canonico;
      }
    }
  }

  return normalizarEncabezado(raw).toUpperCase().replace(/\s+/g, '_');
}

function normalizarEncabezados(matrizCruda) {
  if (!matrizCruda || !Array.isArray(matrizCruda) || matrizCruda.length === 0) {
    return { columnas: [], filas: [] };
  }

  var filasResultado = [];
  var columnasBase = [];
  var primeraFila = matrizCruda[0];
  var propiedades = Array.isArray(primeraFila) ? primeraFila.slice() : Object.keys(primeraFila || {});

  for (var i = 0; i < propiedades.length; i++) {
    var nombreOriginal = Array.isArray(primeraFila) ? propiedades[i] : propiedades[i].toString();
    var nombreCanonico = obtenerAliasCanonico(nombreOriginal);
    columnasBase.push(nombreCanonico);
  }

  for (var filaIndex = 0; filaIndex < matrizCruda.length; filaIndex++) {
    var filaOriginal = matrizCruda[filaIndex];
    var filaMapeada = {};
    for (var colIndex = 0; colIndex < propiedades.length; colIndex++) {
      var nombreOriginal = Array.isArray(primeraFila) ? propiedades[colIndex] : propiedades[colIndex].toString();
      var valor = Array.isArray(filaOriginal) ? filaOriginal[colIndex] : filaOriginal[nombreOriginal];
      var nombreCanonico = obtenerAliasCanonico(nombreOriginal);
      filaMapeada[nombreCanonico] = valor;
    }
    filasResultado.push(filaMapeada);
  }

  return { columnas: columnasBase, filas: filasResultado };
}

function normalizarTextoBasico(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var texto = valor.toString().trim();
  return texto.replace(/\s+/g, ' ');
}

function convertirNumeroMonetario(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number' && !isNaN(valor)) return valor;

  var texto = valor.toString().trim();
  if (texto === '') return 0;

  var limpio = texto.replace(/[$\.\s]/g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
  if (limpio === '' || limpio === '-' || limpio === '.') return 0;
  var numero = parseFloat(limpio);
  return isNaN(numero) ? 0 : numero;
}

function convertirFechaIso(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  var texto = valor.toString().trim();
  if (texto === '') return '';

  var fecha = new Date(texto);
  if (!isNaN(fecha.getTime())) {
    return Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  var patrones = [
    [/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, function(m) { return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])); }],
    [/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, function(m) { return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])); }]
  ];

  for (var i = 0; i < patrones.length; i++) {
    var match = texto.match(patrones[i][0]);
    if (match) {
      var fechaConvertida = patrones[i][1](match);
      if (!isNaN(fechaConvertida.getTime())) {
        return Utilities.formatDate(fechaConvertida, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
    }
  }

  return texto;
}

function sanitizarTiposDatos(matrizMapeada) {
  if (!matrizMapeada || !Array.isArray(matrizMapeada) || matrizMapeada.length === 0) {
    return [];
  }

  var salida = [];
  var loteSize = 1000;

  for (var batchStart = 0; batchStart < matrizMapeada.length; batchStart += loteSize) {
    var lote = matrizMapeada.slice(batchStart, batchStart + loteSize);
    for (var i = 0; i < lote.length; i++) {
      var fila = lote[i];
      var filaSanitizada = {};
      var claves = Object.keys(fila || {});
      for (var j = 0; j < claves.length; j++) {
        var clave = claves[j];
        var valor = fila[clave];
        var claveUpper = clave.toString().toUpperCase();

        if (valor === null || valor === undefined) {
          filaSanitizada[clave] = '';
          continue;
        }

        if (typeof valor === 'string') {
          valor = valor.trim();
          valor = valor.replace(/\s+/g, ' ');
        }

        if (claveUpper.indexOf('MONTO') !== -1 || claveUpper.indexOf('VALOR') !== -1 || claveUpper.indexOf('ESTIMADO') !== -1) {
          filaSanitizada[clave] = convertirNumeroMonetario(valor);
        } else if (claveUpper.indexOf('FECHA') !== -1 || claveUpper.indexOf('FEC') !== -1) {
          filaSanitizada[clave] = convertirFechaIso(valor);
        } else if (typeof valor === 'string') {
          filaSanitizada[clave] = valor;
        } else {
          filaSanitizada[clave] = valor;
        }
      }
      salida.push(filaSanitizada);
    }
  }

  return salida;
}

function identificarConflictos(matrizSanitizada) {
  var reporte = [];
  var vistos = {};
  var camposObligatorios = CONFIG_NORMALIZACION && CONFIG_NORMALIZACION.camposObligatorios ? CONFIG_NORMALIZACION.camposObligatorios : ['RT_NORMALIZADO'];

  for (var i = 0; i < matrizSanitizada.length; i++) {
    var fila = matrizSanitizada[i] || {};
    var rt = fila.RT_NORMALIZADO || fila.RT || fila['RT_NORMALIZADO'] || '';
    var rtTexto = rt.toString().trim();
    if (rtTexto !== '') {
      if (vistos[rtTexto] !== undefined) {
        reporte.push({
          fila: i + 1,
          filaOriginal: vistos[rtTexto] + 1,
          rt: rtTexto,
          tipo: 'RT_DUPLICADO',
          detalle: 'El RT aparece más de una vez en la matriz.'
        });
      } else {
        vistos[rtTexto] = i;
      }
    }

    for (var j = 0; j < camposObligatorios.length; j++) {
      var campo = camposObligatorios[j];
      var valorCampo = fila[campo];
      if (valorCampo === null || valorCampo === undefined || valorCampo === '' || valorCampo.toString().trim() === '') {
        reporte.push({
          fila: i + 1,
          campo: campo,
          tipo: 'CAMPO_OBLIGATORIO_NULO',
          detalle: 'El campo obligatorio está vacío.'
        });
        break;
      }
    }
  }

  return {
    conflictos: reporte,
    resumen: {
      filasConRTDuplicado: reporte.filter(function(item){ return item.tipo === 'RT_DUPLICADO'; }).length,
      filasConCamposObligatoriosNulos: reporte.filter(function(item){ return item.tipo === 'CAMPO_OBLIGATORIO_NULO'; }).length
    }
  };
}

// ═════════════════════════════════════════════════════════════
// FASE 2 — Normalización de encabezados
// ═════════════════════════════════════════════════════════════
function normalizarEncabezado(texto) {
  if (!texto && texto !== 0) return '';
  var s = texto.toString().trim();
  if (s.charAt(0) === '.') s = s.substring(1).trim();
  s = s.replace(/À/g,'Á').replace(/à/g,'á')
       .replace(/È/g,'É').replace(/è/g,'é')
       .replace(/Ì/g,'Í').replace(/ì/g,'í')
       .replace(/Ò/g,'Ó').replace(/ò/g,'ó')
       .replace(/Ù/g,'Ú').replace(/ù/g,'ú');
  s = s.replace(/_/g,' ').replace(/\s+/g,' ').trim();
  return s;
}

// ═════════════════════════════════════════════════════════════
// FASE 1 — Extracción (LEE TODAS LAS FILAS)
// No descarta ninguna fila. Preserva Date como Date.
// ═════════════════════════════════════════════════════════════
function leerHojaCompleta(hoja) {
  var ultimaFila = hoja.getLastRow();
  var ultimaCol  = hoja.getLastColumn();
  if (ultimaFila < 1) throw new Error('La hoja está vacía');

  var valores = hoja.getRange(1, 1, ultimaFila, ultimaCol).getValues();

  var encabezados = valores[0].map(function(e) {
    var enc = normalizarEncabezado((e || '').toString()).toUpperCase();
    return enc === '' ? 'COLUMNA_VACIA_' + Math.random().toString(36).substr(2,9) : enc;
  });

  var datos = [];
  for (var i = 1; i < valores.length; i++) {
    // ✅ PRESERVAR TODAS LAS FILAS: no se descarta ninguna
    var obj = { __FILA_ORIGEN: i + 1 };
    for (var j = 0; j < encabezados.length; j++) {
      var v = valores[i][j];
      // Preservar Date como Date; el resto sin modificar
      if (v instanceof Date) obj[encabezados[j]] = v;
      else if (typeof v === 'number') obj[encabezados[j]] = v;
      else if (v === null || v === undefined) obj[encabezados[j]] = '';
      else obj[encabezados[j]] = v.toString();
    }
    datos.push(obj);
  }

  Logger.log('✓ Fase 1 — Filas leídas: ' + datos.length + ' | Columnas: ' + encabezados.length);
  return { datos: datos, columnas: encabezados, totalFilas: ultimaFila, totalColumnas: ultimaCol };
}

// ═════════════════════════════════════════════════════════════
// FASE 3 — Tipado estricto (ÚNICA capa que limpia tipos)
// ═════════════════════════════════════════════════════════════
function preprocesarTiposDatos(hojaLeida) {
  Logger.log('\n═══ FASE 3: TIPADO ESTRICTO ═══');

  // Mapa: nombreColumna (en cualquier forma) → tipo
  var mapa = {};
  for (var r = 0; r < CONFIG_NORMALIZACION.reglasUnificacion.length; r++) {
    var regla = CONFIG_NORMALIZACION.reglasUnificacion[r];
    for (var v = 0; v < regla.variantes.length; v++) {
      var clave = regla.variantes[v].toString().toUpperCase().trim();
      mapa[clave] = regla.tipo;
      mapa[clave.replace(/_/g,' ')]   = regla.tipo;
      mapa[clave.replace(/\s+/g,'_')] = regla.tipo;
    }
  }

  var totalConversiones = 0;

  for (var i = 0; i < hojaLeida.datos.length; i++) {
    var registro = hojaLeida.datos[i];
    for (var j = 0; j < hojaLeida.columnas.length; j++) {
      var col  = hojaLeida.columnas[j];
      var tipo = mapa[col] || mapa[col.replace(/_/g,' ')] || mapa[col.replace(/\s+/g,'_')] || null;
      if (tipo === null) continue;

      var valorOrig = registro[col];
      if (valorOrig === '' || valorOrig === null || valorOrig === undefined) continue;

      var valorNuevo = valorOrig;
      try {
        switch (tipo) {
          case 'fecha':         valorNuevo = convertirATipoFecha(valorOrig); break;
          case 'numero':        valorNuevo = convertirATipoNumero(valorOrig); break;
          case 'moneda':        valorNuevo = convertirATipoMoneda(valorOrig); break;
          case 'texto':         valorNuevo = convertirATipoTexto(valorOrig, false); break;
          case 'texto_plano':   valorNuevo = convertirATipoTexto(valorOrig, true); break;
          case 'texto_forzado': valorNuevo = convertirATipoTextoForzado(valorOrig); break;
        }
        if (valorNuevo !== valorOrig) {
          hojaLeida.datos[i][col] = valorNuevo;
          totalConversiones++;
        }
      } catch (e) {
        Logger.log('  ⚠ Error col ' + col + ' fila ' + registro.__FILA_ORIGEN + ': ' + e.message);
      }
    }
  }

  Logger.log('  ✓ Conversiones realizadas: ' + totalConversiones);
  return hojaLeida;
}

// ═════════════════════════════════════════════════════════════
// CONVERSORES DE TIPO — Cada uno definido UNA sola vez y Ajustado
// ═════════════════════════════════════════════════════════════

function convertirATipoFecha(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  // Si es un número (serial de Excel/Sheets)
  if (typeof valor === 'number' && valor > 0) {
    try {
      var d = new Date((valor - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      }
    } catch(e) {}
  }
  // SI NO PUDO CONVERTIR: En lugar de devolver '', devolvemos el valor original convertido a string
  return valor.toString().trim(); 
}

function convertirATipoNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  // ── Date ─────────────────────────────────────────────
  if (valor instanceof Date) {
    var anio = valor.getFullYear();

    // Fecha 1899/1900 → reversión a número original
    if (anio === 1899 || anio === 1900) {
      var base = new Date(1899, 11, 30);
      var msDia = 24 * 60 * 60 * 1000;
      var serial = Math.round((valor.getTime() - base.getTime()) / msDia);
      if (serial >= 0 && serial < 100) {
        return serial; // ✅ número original recuperado
      }
    }
    // [AJUSTE QX] Retorna la fecha como texto en vez de borrarla ('')
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  // ── Número ───────────────────────────────────────────
  if (typeof valor === 'number') {
    if (isNaN(valor)) return valor; // [AJUSTE QX]
    if (valor === 0) return 0;
    // Número pequeño (1-99) probablemente es el valor real
    if (Number.isInteger(valor) && valor >= 1 && valor < 100) {
      return valor;
    }
    // Serial "medio" (100-25000) → probablemente valor original, no fecha
    if (Number.isInteger(valor) && valor >= 100 && valor <= 25000) {
      return valor;
    }
    // Serial alto (25001-60000) → fecha moderna disfrazada → no es número
    if (Number.isInteger(valor) && valor > 25000 && valor <= 60000) {
      return valor; // [AJUSTE QX]
    }
    if (valor < -999999999999 || valor > 999999999999) return valor; // [AJUSTE QX]
    return Math.round(valor);
  }

  // ── Texto ────────────────────────────────────────────
  var s = valor.toString().trim();
  if (s === '') return '';

  // ✅ Texto con formato fecha 1899/1900 → reversión
  var matchDmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchDmy) {
    var dia = parseInt(matchDmy[1]), mes = parseInt(matchDmy[2]) - 1, anioM = parseInt(matchDmy[3]);
    if (anioM === 1899 || anioM === 1900) {
      var base2 = new Date(1899, 11, 30);
      var fecha = new Date(anioM, mes, dia);
      var msDia2 = 24 * 60 * 60 * 1000;
      var serial2 = Math.round((fecha.getTime() - base2.getTime()) / msDia2);
      if (serial2 >= 0 && serial2 < 100) {
        return serial2; // ✅ número original recuperado
      }
    }
    return s; // [AJUSTE QX] Retorna el texto original en vez de ''
  }

  // Formato yyyy-mm-dd
  var matchYmd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchYmd) {
    var anioY = parseInt(matchYmd[1]);
    if (anioY === 1899 || anioY === 1900) {
      var diaY = parseInt(matchYmd[3]), mesY = parseInt(matchYmd[2]) - 1;
      var base3 = new Date(1899, 11, 30);
      var fechaY = new Date(anioY, mesY, diaY);
      var msDia3 = 24 * 60 * 60 * 1000;
      var serialY = Math.round((fechaY.getTime() - base3.getTime()) / msDia3);
      if (serialY >= 0 && serialY < 100) return serialY;
    }
    return s; // [AJUSTE QX]
  }

  // Limpiar y convertir texto numérico
  var limpio = s.replace(/[$\s]/g,'').replace(/,(?=\d{3})/g,'').replace(/[^\d.\-]/g,'');
  var n = parseFloat(limpio);
  if (isNaN(n)) return s; // [AJUSTE QX] Salva el texto original si no es un número limpio
  if (n === 0) return 0;
  if (n < -999999999999 || n > 999999999999) return s; // [AJUSTE QX]
  return Math.round(n);
}

function convertirATipoMoneda(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  // [AJUSTE QX] Retorna formato fecha en texto si aplica
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy'); 

  if (typeof valor === 'number') {
    if (isNaN(valor)) return valor; // [AJUSTE QX]
    if (valor === 0) return 0;
    if (Number.isInteger(valor) && valor >= 1 && valor <= 60000) {
      var test = new Date((valor - 25569) * 86400 * 1000);
      if (!isNaN(test.getTime())) return valor; // [AJUSTE QX]
    }
    if (valor < -999999999999 || valor > 999999999999) return valor; // [AJUSTE QX]
    return valor;
  }
  var s = valor.toString().trim();
  if (s === '') return '';
  
  var limpio = s.replace(/[$\s]/g,'').replace(/,(?=\d{3})/g,'').replace(/[^\d.\-]/g,'');
  var n = parseFloat(limpio);
  if (isNaN(n)) return s; // [AJUSTE QX] Salva el texto si la limpieza falló
  if (n === 0) return 0;
  if (n < -999999999999 || n > 999999999999) return s; // [AJUSTE QX]
  return n;
}

function convertirATipoTexto(valor, esPlano) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date) {
    var a = valor.getFullYear();
    if (a < 1970 || a > 2100) return '';
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  if (typeof valor === 'number') return String(valor);
  var s = valor.toString();
  if (esPlano) return s.trim();
  return s.trim().replace(/\s+/g,' ').toUpperCase();
}

function convertirATipoTextoForzado(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  // ── Date ─────────────────────────────────────────────
  if (valor instanceof Date) {
    var anio = valor.getFullYear();
    if (anio === 1899 || anio === 1900) {
      return '100';
    }
    // [AJUSTE QX] Fecha con año distinto → dato válido que preservamos
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy'); 
  }

  // ── Número ───────────────────────────────────────────
  if (typeof valor === 'number') {
    if (isNaN(valor)) return valor.toString(); // [AJUSTE QX]
    // 100 exacto
    if (valor === 100 || valor === 1) return '100';
    // Representaciones decimales de 80-20
    if (valor === 80.20 || valor === 80.2 || valor === 0.8 || valor === 0.80) return '80-20';
    // [AJUSTE QX] Cualquier otro número en esta columna se preserva
    return valor.toString(); 
  }

  // ── Texto ────────────────────────────────────────────
  var s = valor.toString().trim();
  if (s === '') return '';

  var sUpper = s.toUpperCase().replace(/\s+/g, '');

  // Variantes de '80-20'
  if (sUpper === '80-20' || sUpper === '80/20' || sUpper === '8020' ||
      sUpper === '80_20' || sUpper === '80.20' || sUpper === '80,20') {
    return '80-20';
  }

  // Variantes de '100'
  if (sUpper === '100' || sUpper === '100%' || sUpper === '100.0' ||
      sUpper === '100,0' || sUpper === '100.00') {
    return '100';
  }

  // Texto que representa una fecha del rango 1899/1900 → es un '100'
  var matchDmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (matchDmy) {
    var anioM = parseInt(matchDmy[3]);
    if (anioM === 1899 || anioM === 1900) {
      return '100';
    }
    return s; // [AJUSTE QX]
  }

  var matchYmd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (matchYmd) {
    var anioY = parseInt(matchYmd[1]);
    if (anioY === 1899 || anioY === 1900) {
      return '100';
    }
    return s; // [AJUSTE QX]
  }

  // [AJUSTE QX] Cualquier otro texto fuera del dominio se preserva
  return s;
}

// ═════════════════════════════════════════════════════════════
// FASE 4 — Enriquecimiento (TRAMO desde PROYECTO)
// ═════════════════════════════════════════════════════════════
function completarTramoDesdeProyecto(hojaLeida) {
  var cfg = CONFIG_NORMALIZACION.validacionEstructura.completarTramoDesdeProyecto;
  var vacio = { datos: hojaLeida.datos, columnas: hojaLeida.columnas, totalFilas: hojaLeida.totalFilas, totalColumnas: hojaLeida.totalColumnas, filasModificadas: [] };
  if (!cfg || !cfg.activa) return vacio;

  var cP = cfg.columnaProyecto.toUpperCase(), cT = cfg.columnaTramo.toUpperCase();
  var nP = null, nT = null;
  for (var i = 0; i < hojaLeida.columnas.length; i++) {
    var c = hojaLeida.columnas[i].toUpperCase();
    if (c === cP) nP = hojaLeida.columnas[i];
    if (c === cT) nT = hojaLeida.columnas[i];
  }
  if (!nP || !nT) return vacio;

  var mod = [];
  for (var i = 0; i < hojaLeida.datos.length; i++) {
    var vP = (hojaLeida.datos[i][nP] || '').toString().trim();
    var vT = (hojaLeida.datos[i][nT] || '').toString().trim();
    if (vT === '' && vP !== '') {
      hojaLeida.datos[i][nT] = vP;
      mod.push({ filaOrigen: hojaLeida.datos[i].__FILA_ORIGEN, valorCopiado: vP });
    }
  }
  return { datos: hojaLeida.datos, columnas: hojaLeida.columnas, totalFilas: hojaLeida.totalFilas, totalColumnas: hojaLeida.totalColumnas, filasModificadas: mod };
}

// ═════════════════════════════════════════════════════════════
// FASE 5 — Integración (unificación sin pérdida de filas)
// ═════════════════════════════════════════════════════════════
function unificarColumnas(datosOriginales) {
  var unificaciones = [], conflictos = [], mapeoColumnas = {};

  Logger.log('\n═══ FASE 5: UNIFICACIÓN ═══');

  for (var r = 0; r < CONFIG_NORMALIZACION.reglasUnificacion.length; r++) {
    var regla = CONFIG_NORMALIZACION.reglasUnificacion[r];
    var encontradas = [], usados = {};
    for (var v = 0; v < regla.variantes.length; v++) {
      var vBuscar = regla.variantes[v].toString().trim().toUpperCase();
      var vAlts = [vBuscar, vBuscar.replace(/_/g,' '), vBuscar.replace(/\s+/g,'_')];
      for (var ci = 0; ci < datosOriginales.columnas.length; ci++) {
        if (usados[ci]) continue;
        var col = datosOriginales.columnas[ci].toString().trim().toUpperCase();
        var cAlts = [col, col.replace(/_/g,' '), col.replace(/\s+/g,'_')];
        var coincide = false;
        for (var ca = 0; ca < cAlts.length && !coincide; ca++)
          for (var va = 0; va < vAlts.length && !coincide; va++)
            if (cAlts[ca] === vAlts[va]) coincide = true;
        if (coincide) {
          encontradas.push({ nombre: datosOriginales.columnas[ci], indice: ci });
          usados[ci] = true;
          break;
        }
      }
    }
    if (encontradas.length >= 1) {
      unificaciones.push({
        reglaId: regla.id, nombreFinal: regla.nombreFinal,
        columnasOrigen: encontradas.map(function(c){ return c.nombre; }),
        tipo: regla.tipo, estrategia: regla.estrategiaConflicto,
        reglaCompleta: regla, cantidadUnificadas: encontradas.length
      });
      for (var i = 0; i < encontradas.length; i++) {
        mapeoColumnas[encontradas[i].nombre.toString().trim()] = regla.nombreFinal;
      }
    }
  }

  // ✅ UNIFICAR SIN DESCARTAR FILAS
  var datosUnificados = [];
  for (var i = 0; i < datosOriginales.datos.length; i++) {
    var registro = datosOriginales.datos[i];
    var nuevo = { __FILA_ORIGEN: registro.__FILA_ORIGEN };

    for (var u = 0; u < unificaciones.length; u++) {
      var unif = unificaciones[u];
      var valores = recolectarValoresParaRegla(registro, unif.columnasOrigen);
      if (valores.length === 0) {
        nuevo[unif.nombreFinal] = '';
        continue;
      }
      var res = aplicarEstrategia(valores, unif.estrategia, unif.reglaCompleta);
      nuevo[unif.nombreFinal] = res.valor;
      if (res.esUnificada) nuevo['__UNIFICADA_' + unif.nombreFinal] = true;
      if (res.esConflicto) {
        nuevo['__CONFLICTO_' + unif.nombreFinal] = true;
        conflictos.push({ rt: registro.RT || '[Sin RT]', fila: registro.__FILA_ORIGEN,
          columna: unif.nombreFinal, valores: valores, valorFinal: res.valor });
      }
    }
    copiarColumnasSinRegla(registro, nuevo, mapeoColumnas);
    datosUnificados.push(nuevo);
  }

  // Construir columnas finales
  var columnasFinales = [], agregados = {};
  for (var c = 0; c < datosOriginales.columnas.length; c++) {
    var col = datosOriginales.columnas[c], colTrim = col.toString().trim();
    if (mapeoColumnas[colTrim]) {
      var nf = mapeoColumnas[colTrim];
      if (!agregados[nf]) { columnasFinales.push(nf); agregados[nf] = true; }
    } else if (!agregados[colTrim]) {
      columnasFinales.push(col); agregados[colTrim] = true;
    }
  }
  for (var u = 0; u < unificaciones.length; u++) {
    var nf = unificaciones[u].nombreFinal;
    if (!agregados[nf]) { columnasFinales.push(nf); agregados[nf] = true; }
  }

  Logger.log('  ✓ Unificaciones: ' + unificaciones.length + ' | Conflictos: ' + conflictos.length + ' | Filas: ' + datosUnificados.length);
  return { datos: datosUnificados, columnasFinales: columnasFinales, unificaciones: unificaciones, conflictos: conflictos };
}

// ═════════════════════════════════════════════════════════════
// MOTOR DE ESTRATEGIAS
// ═════════════════════════════════════════════════════════════
function aplicarEstrategia(valores, estrategia, regla) {
  if (!valores || valores.length === 0) return { valor:'', esConflicto:false, esUnificada:false };

  switch (estrategia) {
    case 'tomar_primero':
      for (var i = 0; i < valores.length; i++) {
        var v = valores[i].valor;
        if (v !== '' && v !== null && v !== undefined) {
          // Ya no filtramos el "-" aquí, dejamos que pase si tiene contenido
          return { valor: v, esConflicto: false, esUnificada: true };
        }
      }
      return { valor: '', esConflicto: false, esUnificada: false };

    case 'tomar_primero_numerico':
      for (var i = 0; i < valores.length; i++) {
        var v = valores[i].valor;
        if (v === 0 || v === '0') return { valor: 0, esConflicto:false, esUnificada:true };
        if (typeof v === 'number' && !isNaN(v)) return { valor: v, esConflicto:false, esUnificada:true };
        if (v !== '' && v !== null && v !== undefined) {
          var n = convertirATipoNumero(v);
          if (n !== '') return { valor: n, esConflicto:false, esUnificada:true };
        }
      }
      return { valor:'', esConflicto:false, esUnificada:false };

    case 'concatenar':
      var unicos = [], strs = [];
      for (var i = 0; i < valores.length; i++) {
        var s = valores[i].valor.toString().trim();
        if (s !== '' && strs.indexOf(s) === -1) { strs.push(s); unicos.push(s); }
      }
      if (unicos.length === 0) return { valor:'', esConflicto:false, esUnificada:false };
      if (unicos.length === 1) return { valor: unicos[0], esConflicto:false, esUnificada:true };
      return { valor: unicos.join(' | '), esConflicto:true, esUnificada:true };

    case 'evaluar_contenido':
      if (!regla || !regla.prioridades) return { valor:'', esConflicto:false, esUnificada:false };
      var texto = valores.map(function(v){ return v.valor.toString(); }).join(' ').toLowerCase().trim();
      if (texto.replace(/[\.\s\|0]/g,'') === '') return { valor:'', esConflicto:false, esUnificada:false };
      for (var p = 0; p < regla.prioridades.length; p++) {
        if (texto.indexOf(regla.prioridades[p].contiene.toLowerCase()) !== -1) {
          return { valor: regla.prioridades[p].resultado, esConflicto:false, esUnificada:true };
        }
      }
      for (var i = 0; i < valores.length; i++) {
        var s = valores[i].valor.toString().trim();
        if (s !== '') return { valor: s, esConflicto:false, esUnificada:true };
      }
      return { valor:'', esConflicto:false, esUnificada:false };

    case 'estado_predial':
      var ep = valores.map(function(v){ return v.valor.toString().trim(); });
      if (ep[0] && ep[0] !== '') return { valor: ep[0], esConflicto:false, esUnificada:true };
      if (ep[1] && ep[1] !== '') return { valor: ep[1], esConflicto: (ep[2] && ep[2] !== '' && ep[1] !== ep[2]), esUnificada:true };
      if (ep[2] && ep[2] !== '') return { valor: ep[2], esConflicto:false, esUnificada:true };
      return { valor:'', esConflicto:false, esUnificada:false };

    case 'mutacion_texto_simple':
      var mv = [];
      for (var i = 0; i < valores.length; i++) {
        var s = valores[i].valor.toString().trim().toUpperCase();
        if (s !== '' && s !== '-' && mv.indexOf(s) === -1) mv.push(s);
      }
      if (mv.length === 0) return { valor:'', esConflicto:false, esUnificada:false };
      for (var i = 0; i < mv.length; i++) {
        if (mv[i].indexOf('MUTADO') !== -1 || mv[i].indexOf('MUTACION') !== -1 || mv[i].indexOf('MUTACIÓN') !== -1) {
          return { valor:'MUTACIÓN', esConflicto:false, esUnificada:true };
        }
      }
      if (mv.length === 1) return { valor: mv[0], esConflicto:false, esUnificada:true };
      return { valor: mv.join(' | '), esConflicto:true, esUnificada:true };

    case 'logica_aceptaron':                   return aplicarLogicaAceptaron(valores);
    case 'limpiar_aceptaron2_fechas':          return aplicarLimpiarAceptaron2(valores);
    case 'prioridades_viabilidad':             return aplicarPrioridadesViabilidad(valores);
    case 'logica_predios_disponibles_cesiones':return aplicarLogicaPrediosDisponiblesCesiones(valores);
    case 'logica_predios_recibidos':           return aplicarLogicaPrediosRecibidos(valores);
    case 'logica_valor_estimado_tres_columnas':return aplicarLogicaValorEstimadoTresColumnas(valores);
    case 'logica_adquisicion_cesion':          return aplicarLogicaAdquisicionCesion(valores);
    case 'logica_estado_del_avaluo':           return aplicarLogicaEstadoDelAvaluo(valores);

    default:
      var uds = [], ss = [];
      for (var i = 0; i < valores.length; i++) {
        var sv = valores[i].valor.toString().trim();
        if (sv !== '' && ss.indexOf(sv) === -1) { ss.push(sv); uds.push(sv); }
      }
      if (uds.length === 0) return { valor:'', esConflicto:false, esUnificada:false };
      if (uds.length === 1) return { valor: uds[0], esConflicto:false, esUnificada:true };
      return { valor: uds.join(' | '), esConflicto:true, esUnificada:true };
  }
}

// Estrategias específicas

function aplicarLogicaAceptaron(valores) {
  var vAc = '', vA2 = '';
  for (var i = 0; i < valores.length; i++) {
    var col = valores[i].columna.toString().toUpperCase().trim().replace(/\s+/g,'_');
    var val = (valores[i].valor || '').toString().trim();
    if (col === 'ACEPTARON' || col === 'ACEPTARON_') { if (val !== '') vAc = val; }
    else if (col === 'ACEPTARON2' || col === 'ACEPTARON2_' || col === 'ACEPTARON_2') { if (val !== '') vA2 = val; }
  }
  if (vAc !== '' && vA2 === '') return { valor:vAc,  esConflicto:false, esUnificada:true };
  if (vAc === '' && vA2 !== '') return { valor:'N/A', esConflicto:false, esUnificada:true };
  if (vAc !== '' && vA2 !== '') return { valor:vAc,  esConflicto:false, esUnificada:true };
  return { valor:'', esConflicto:false, esUnificada:false };
}

function aplicarLimpiarAceptaron2(valores) {
  if (!valores || valores.length === 0) return { valor:'', esConflicto:false, esUnificada:false };
  for (var i = 0; i < valores.length; i++) {
    var v = valores[i].valor;
    if (typeof v === 'number' && v >= 1 && v <= 10) return { valor:Math.round(v), esConflicto:false, esUnificada:true };
    if (v instanceof Date) { var d = v.getDate(); if (d >= 1 && d <= 10) return { valor:d, esConflicto:false, esUnificada:true }; }
    if (typeof v === 'string') {
      var n = parseInt(v.trim());
      if (!isNaN(n) && n >= 1 && n <= 10) return { valor:n, esConflicto:false, esUnificada:true };
    }
  }
  return { valor:'', esConflicto:false, esUnificada:false };
}

function aplicarPrioridadesViabilidad(valores) {
  if (!valores || valores.length === 0) return { valor:'', esConflicto:false, esUnificada:false };
  var vV='', vVP='', vVS='';
  for (var i = 0; i < valores.length; i++) {
    var col = valores[i].columna.toString().toUpperCase().trim().replace(/\s+/g,'_');
    var val = (valores[i].valor || '').toString().trim();
    if (val === '' || val === '-' || val === 'N/A') continue;
    if (col === 'VIABILIDADES') vVS = val;
    else if (col === 'VIABILIDAD_PREDIAL' || col === 'VIABILIDAD PREDIAL') vVP = val;
    else if (col === 'VIABILIDAD') vV = val;
  }
  var r = vVS || vVP || vV;
  var cnt = [vVS, vVP, vV].filter(function(x){ return x !== ''; }).length;
  if (!r) return { valor:'', esConflicto:false, esUnificada:false };
  return { valor:r, esConflicto:cnt > 1, esUnificada:true };
}

function aplicarLogicaPrediosDisponiblesCesiones(valores) {
  // [AJUSTE QX] No inventar PENDIENTE si estaba vacía desde el origen
  if (!valores || valores.length === 0) return { valor:'', esConflicto:false, esUnificada:false }; 
  var vIC = '', vG = '';
  for (var i = 0; i < valores.length; i++) {
    var col = valores[i].columna.toString().toUpperCase().trim();
    var val = (valores[i].valor || '').toString().trim();
    if (val === '' || val === '-' || val === 'N/A') continue;
    var cN = col.replace(/\s+/g,'_');
    if (cN === 'PREDIOS_DISPONIBLES_INCLUYE_CESIONES') vG = val;
    else if (col === 'PREDIOS DISPONIBLES INCLUYE CESIONES' || col === 'PREDIOS DISPONIBLES (INCLUYE CESIONES)') vIC = val;
  }
  var src = vIC || vG;
  if (!src) return { valor:'', esConflicto:false, esUnificada:false }; 

  var u = src.toUpperCase();
  if (u.indexOf('CESION') !== -1 || u.indexOf('CESIÓN') !== -1) return { valor:'DISPONIBLE CESIÓN', esConflicto:false, esUnificada:true };
  if (u.indexOf('ADQUIRIR') !== -1) return { valor:'A ADQUIRIR DISPONIBLE', esConflicto:false, esUnificada:true };
  if (src === '1') return { valor:'A ADQUIRIR DISPONIBLE', esConflicto:false, esUnificada:true };
  
  // [AJUSTE QX] Si no cuadra con la lógica, pasa el texto original directamente
  return { valor: src, esConflicto:false, esUnificada:true }; 
}

function aplicarLogicaPrediosRecibidos(valores) {
  var u = [];
  for (var i = 0; i < valores.length; i++) {
    var s = (valores[i].valor || '').toString().trim();
    if (s !== '' && u.indexOf(s) === -1) u.push(s);
  }
  if (u.length === 0) return { valor:'', esConflicto:false, esUnificada:false };
  return { valor: u.join(' | '), esConflicto: u.length > 1, esUnificada:true };
}

function aplicarLogicaValorEstimadoTresColumnas(valores) {
  var nums = [];
  for (var i = 0; i < valores.length; i++) {
    var n = convertirATipoNumero(valores[i].valor);
    if (n !== '' && n > 0) nums.push(n);
  }
  if (nums.length === 0) return { valor:'', esConflicto:false, esUnificada:false };
  return { valor: Math.max.apply(Math, nums), esConflicto: nums.length > 1, esUnificada:true };
}

function aplicarLogicaAdquisicionCesion(valores) {
  var vA = '', vC = '';
  for (var i = 0; i < valores.length; i++) {
    var col = valores[i].columna.toString().toUpperCase().trim().replace(/\s+/g,'_');
    var val = (valores[i].valor || '').toString().trim();
    if (val === '' || val === '-') continue;
    if (col.indexOf('ADQUISICION_ADQUISICION') !== -1) vA = val;
    else if (col.indexOf('ADQUISICION_CESION') !== -1)    vC = val;
  }
  if (vA !== '' && vC === '') return { valor:'ADQUIRIR',          esConflicto:false, esUnificada:true };
  if (vA === '' && vC !== '') return { valor:'CESIÓN',            esConflicto:false, esUnificada:true };
  if (vA !== '' && vC !== '') return { valor:'ADQUIRIR | CESIÓN', esConflicto:true,  esUnificada:true };
  return { valor:'', esConflicto:false, esUnificada:false };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * ESTRATEGIA: logica_estado_del_avaluo
 * ═══════════════════════════════════════════════════════════════
 */
function aplicarLogicaEstadoDelAvaluo(valores) {
  if (!valores || valores.length === 0) {
    return { valor:'', esConflicto:false, esUnificada:false }; // [AJUSTE QX]
  }

  var vAvaluo  = '';  
  var vAvaluos = '';  

  // Separar los dos campos
  for (var i = 0; i < valores.length; i++) {
    var col = valores[i].columna.toString().toUpperCase().trim().replace(/\s+/g,'_');
    var val = (valores[i].valor || '').toString().trim();
    if (val === '' || val === '-' || val === 'N/A') continue;

    // ESTADO AVALUOS (plural)
    if (col === 'ESTADO_AVALUOS') {
      vAvaluos = val;
    }
    // ESTADO AVALUO (singular) — también capturar variantes con tilde
    else if (col === 'ESTADO_AVALUO' ||
             col === 'ESTADO_DEL_AVALUO' || col === 'ESTADO_DEL_AVALÚO' ||
             col === 'ESTADO_DEL_AVALUO_' || col === 'ESTADO_AVALUO_') {
      vAvaluo = val;
    }
  }

  // ─── PRIORIDAD 1: Evaluar ESTADO AVALUOS ─────────────
  if (vAvaluos !== '') {
    var uAvaluos = vAvaluos.toLowerCase();
    if (uAvaluos.indexOf('elaboración') !== -1 || uAvaluos.indexOf('elaboracion') !== -1) {
      return { valor:'ELABORACIÓN', esConflicto:false, esUnificada:true };
    }
    if (uAvaluos.indexOf('aprobado') !== -1) {
      return { valor:'APROBADO', esConflicto:false, esUnificada:true };
    }
    if (uAvaluos.indexOf('pendiente') !== -1) {
      return { valor:'PENDIENTE', esConflicto:false, esUnificada:true };
    }
  }

  // ─── PRIORIDAD 2: Evaluar ESTADO AVALUO ──────────────
  if (vAvaluo !== '') {
    var uAvaluo = vAvaluo.toLowerCase();
    if (uAvaluo.indexOf('aprobado') !== -1) {
      return { valor:'APROBADO', esConflicto:false, esUnificada:true };
    }
    if (uAvaluo.indexOf('elaboración') !== -1 || uAvaluo.indexOf('elaboracion') !== -1) {
      return { valor:'ELABORACIÓN', esConflicto:false, esUnificada:true };
    }
    if (uAvaluo.indexOf('pendiente') !== -1) {
      return { valor:'PENDIENTE', esConflicto:false, esUnificada:true };
    }
  }

  // ─── Fallback: ambas vacías o sin match ──────────────
  // [AJUSTE QX] En vez de devolver PENDIENTE a ciegas, devolvemos el texto original que haya ingresado el usuario
  var textoOriginal = vAvaluos || vAvaluo;
  if (textoOriginal) {
     return { valor: textoOriginal, esConflicto: false, esUnificada: true };
  }
  return { valor:'', esConflicto:false, esUnificada:false };
}

// ═════════════════════════════════════════════════════════════
// FASE 6 — Estructura objetivo
// ═════════════════════════════════════════════════════════════
function aplicarEstructuraObjetivo(datos, columnasActuales) {
  var mapa = {};
  for (var i = 0; i < columnasActuales.length; i++) {
    mapa[columnasActuales[i].toString().toUpperCase().trim()] = columnasActuales[i];
  }
  var estructuraFinal = [], insertadas = [];
  for (var i = 0; i < CONFIG_NORMALIZACION.estructuraObjetivo.length; i++) {
    var colObj = CONFIG_NORMALIZACION.estructuraObjetivo[i].toString().toUpperCase().trim();
    if (colObj === 'VERSION') { estructuraFinal.push('VERSION'); continue; }
    if (mapa[colObj] !== undefined) { estructuraFinal.push(mapa[colObj]); delete mapa[colObj]; }
    else { estructuraFinal.push(CONFIG_NORMALIZACION.estructuraObjetivo[i]); }
  }
  for (var col in mapa) {
    if (col.indexOf('__') === 0 || col.indexOf('COLUMNA_VACIA_') === 0 || col === 'VERSION') continue;
    estructuraFinal.push(mapa[col]);
    insertadas.push({ nombre: mapa[col], posicion: estructuraFinal.length, motivo:'No estaba en estructura objetivo' });
  }
  return { datos: datos, columnas: estructuraFinal, columnasInsertadas: insertadas };
}

// ═════════════════════════════════════════════════════════════
// FASE 7 — Matriz final
// ═════════════════════════════════════════════════════════════
function convertirAMatrizNormalizada(datos, columnas) {
  var matriz = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = [];
    for (var j = 0; j < columnas.length; j++) {
      var col = columnas[j];
      if (col.indexOf('__') === 0) { fila.push(''); continue; }
      var colN = col.toString().toUpperCase().trim();
      if (colN === 'VERSION') {
        var rt = datos[i]['RT'];
        fila.push(rt ? separarRT(rt.toString()).version : '');
        continue;
      }
      if (colN === 'RT') {
        var rt = datos[i][col];
        fila.push(rt ? separarRT(rt.toString()).numero : '');
        continue;
      }
      var val = datos[i][col];
      fila.push(val !== undefined && val !== null ? val : '');
    }
    matriz.push(fila);
  }
  return matriz;
}

// ═════════════════════════════════════════════════════════════
// Auxiliares
// ═════════════════════════════════════════════════════════════
function recolectarValoresParaRegla(registro, columnasOrigen) {
  var valores = [];
  for (var c = 0; c < columnasOrigen.length; c++) {
    var val = registro[columnasOrigen[c]];
    if (val !== '' && val !== null && val !== undefined) {
      valores.push({ columna: columnasOrigen[c], valor: val });
    }
  }
  return valores;
}

function copiarColumnasSinRegla(registro, nuevo, mapeoColumnas) {
  for (var prop in registro) {
    if (prop === '__FILA_ORIGEN' || prop.indexOf('__') === 0) continue;
    if (mapeoColumnas.hasOwnProperty(prop.toString().trim())) continue;
    nuevo[prop] = registro[prop];
  }
}

function separarRT(valorRT) {
  if (!valorRT) return { numero:'', version:'' };
  var s = valorRT.toString().trim().toUpperCase();
  var m = s.match(/^(\d+)([A-Z\-]*)$/);
  if (m) return { numero: m[1], version: m[2] || '' };
  var num = '', ver = '';
  for (var i = 0; i < s.length; i++) {
    if (/\d/.test(s[i])) num += s[i];
    else if (/[A-Z\-]/.test(s[i])) ver += s[i];
  }
  return { numero: num || s, version: ver };
}

function validarRTs(datos) {
  var prob = [], vistos = {};
  for (var i = 0; i < datos.length; i++) {
    var rt = datos[i].RT, fila = datos[i].__FILA_ORIGEN;
    if (!rt || rt === '') { prob.push({ fila: fila, rt:'[VACÍO]', motivo:'RT vacío', severidad:'ALTA' }); continue; }
    var s = rt.toString().trim();
    if (vistos[s]) prob.push({ fila: fila, rt: s, motivo:'RT duplicado (primera: fila ' + vistos[s] + ')', severidad:'MEDIA', filaOriginal: vistos[s] });
    else vistos[s] = fila;
  }
  return prob;
}

function analizarColumnas(columnas) {
  var dup = [], sim = [], vistos = {};
  for (var i = 0; i < columnas.length; i++) {
    var col = columnas[i];
    if (!col || col.indexOf('COLUMNA_VACIA_') === 0) continue;
    if (vistos[col] !== undefined) dup.push({ nombre: col, indices:[vistos[col], i] });
    else vistos[col] = i;
  }
  if (CONFIG_NORMALIZACION.deteccionAutomatica.activada) {
    var variantes = obtenerTodasLasVariantes();
    var umbral = CONFIG_NORMALIZACION.deteccionAutomatica.umbralSimilitud;
    for (var i = 0; i < columnas.length; i++) {
      for (var j = i + 1; j < columnas.length; j++) {
        if (!columnas[i] || !columnas[j]) continue;
        if (variantes[columnas[i]] && variantes[columnas[j]]) continue;
        var s = calcularSimilitud(columnas[i], columnas[j]);
        if (s >= umbral && s < 1.0) sim.push({ col1: columnas[i], col2: columnas[j], similitud:(s*100).toFixed(1)+'%', indice1:i+1, indice2:j+1 });
      }
    }
  }
  return { duplicadas: dup, similares: sim, totalColumnas: columnas.length };
}