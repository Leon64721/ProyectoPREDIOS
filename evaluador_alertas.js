/**
 * Debe coincidir con el switch de _cumpleCondiciones.
 */
const OPERADORES_CONDICION_REGLAS = {
  EQUALS:                     { etiqueta: 'Es igual a',                         parametros: ['valor'] },
  NOT_EQUAL:                  { etiqueta: 'Es distinto de',                     parametros: ['valor'] },
  IN:                         { etiqueta: 'Está en la lista',                   parametros: ['valores'] },
  NOT_IN:                     { etiqueta: 'No está en la lista',                parametros: ['valores'] },
  IS_NULL:                    { etiqueta: 'Está vacío (vacío, N/A, -)',         parametros: [] },
  IS_NOT_NULL:                { etiqueta: 'Tiene dato (no vacío, 0 ni N/A)',    parametros: [] },
  LESS_THAN:                  { etiqueta: 'Número menor que',                   parametros: ['valor'] },
  DATE_BEFORE_COLUMN:         { etiqueta: 'Fecha anterior a otra columna',      parametros: ['columna_destino'] },
  PERCENTAGE_BETWEEN_COLUMNS: { etiqueta: '(Columna ÷ otra columna) × 100 entre min y max', parametros: ['columna_destino', 'min_pct', 'max_pct'] },
  DAYS_PASSED_LESS_THAN:      { etiqueta: 'Días transcurridos hasta hoy ≤',     parametros: ['valor'] }
};
const NIVELES_ALERTA_REGLAS = ['ROJO', 'NARANJA', 'AMARILLO'];
const TIPOS_DIAS_REGLAS = ['HABILES', 'CALENDARIO'];

/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR EVALUADOR DE REGLAS DE NEGOCIO V1.0
 * Lee el JSON, cruza con la Matriz y genera Alertas
 * Incluye Deduplicación y Mensajes Dinámicos
 * ═══════════════════════════════════════════════════════════
 */

class MotorEvaluadorReglas {
  constructor() {
    this.fileId = getConfig('DATA_FILES.PRINCIPAL');
    this.ss = SpreadsheetApp.openById(this.fileId);
    this.hoy = new Date();
    this.festivosCargados = false;
    this.festivosColombia = this._cargarFestivosColombia(this.hoy.getFullYear());
    this.alertasGeneradas = [];
  }

  /**
   * FUNCIÓN PRINCIPAL: Ejecuta todo el motor
   */
  ejecutarMotor() {
    console.log("🚀 Iniciando Motor Evaluador de Reglas...");

    const lectura = obtenerReglasJSON();
    if (!lectura.success) return { success: false, error: lectura.error || lectura.message };
    let configReglas;
    try {
      configReglas = JSON.parse(lectura.data || '{}');
    } catch (e) {
      return { success: false, error: 'El JSON de reglas no se pudo leer.' };
    }
    if (!configReglas || !Array.isArray(configReglas.ReglasDeNegocio)) {
      return { success: false, error: 'El JSON de reglas no tiene ReglasDeNegocio[]' };
    }
    if (!configReglas.ReglasDeNegocio.length || lectura.data === '{}' || lectura.data === '') {
      this.alertasGeneradas = [];
      const vacio = this._guardarAlertasEnHoja();
      if (!vacio) return { success: false, error: 'No se pudo limpiar ALERTAS_ACTIVAS.' };
      return { success: false, error: 'No hay reglas configuradas', totalAlertas: 0, reglasNoEvaluables: 0, reglasConCruceIgnorado: 0 };
    }

    const reglasActivas = configReglas.ReglasDeNegocio.filter(r => r.activa);
    const reglasNoEvaluables = reglasActivas.filter(r => r.evaluacion_cruzada && r.alerta_bloqueo && !r.regla_tiempo).length;
    const reglasConCruceIgnorado = reglasActivas.filter(r => r.evaluacion_cruzada && r.regla_tiempo).length;
    console.log(`📋 Se encontraron ${reglasActivas.length} reglas activas en el JSON.`);

    // 2. Leer la Matriz de Datos (Modo Solo Lectura)
    const hojaDatos = this.ss.getSheetByName(getConfig('SHEETS.DATOS'));
    const datosRaw = hojaDatos.getDataRange().getValues();
    const headers = datosRaw[0].map(h => String(h).trim().toUpperCase());
    const filas = datosRaw.slice(1);

    // Mapear datos a array de objetos
    const matriz = filas.map(fila => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = fila[i]);
      return obj;
    });

    // ✅ SPRINT6-DESACOPLE [CONC-BE-12]: Datos sigue siendo solo lectura — sobreescribe
    // ARTICULADOR/GESTOR con el valor EFECTIVO (Datos + overlay ASIGNACIONES_EQUIPOS) antes
    // de evaluar reglas, para que _registrarAlerta() (más abajo) enrute con el dato vigente
    // sin tener que tocar su lógica. _leerAsignacionesEquipos()/_fusionarAsignacionesConMatriz()
    // viven en gestion_equipos_backend.js, globales a propósito (mismo scope GAS compartido).
    if (typeof _leerAsignacionesEquipos === 'function' && typeof _fusionarAsignacionesConMatriz === 'function') {
      const colArticuladorMotor = getConfig('COLUMNS.ARTICULADOR_JURIDICO');
      const colGestorMotor = getConfig('COLUMNS.GESTOR_JURIDICO');
      const asignacionesMapMotor = _leerAsignacionesEquipos();
      matriz.forEach(function(obj) {
        const fusion = _fusionarAsignacionesConMatriz(obj['RT'], obj[colArticuladorMotor], obj[colGestorMotor], asignacionesMapMotor);
        obj[colArticuladorMotor] = fusion.articuladorEmail;
        obj[colGestorMotor] = fusion.gestorEmail;
      });
    }

    // 3. Evaluar fila por fila contra cada regla
    matriz.forEach((filaMatriz, indexFila) => {
      const rt = filaMatriz["RT"];
      if (!rt) return; // Saltar filas vacías

      reglasActivas.forEach(regla => {
        try {
        // A. Verificar si cumple las CONDICIONES previas
        if (this._cumpleCondiciones(filaMatriz, regla.condiciones)) {
          
          // NUEVO: Verificar EXCEPCIONES dinámicas (Soporta un objeto único o un Array de múltiples escenarios)
          let esExcepcion = false;
          if (regla.excepciones) {
            if (Array.isArray(regla.excepciones)) {
              // Si hay varios bloques de excepción, se anula si CUALQUIERA (some) se cumple
              esExcepcion = regla.excepciones.some(ex => this._cumpleCondiciones(filaMatriz, ex));
            } else {
              esExcepcion = this._cumpleCondiciones(filaMatriz, regla.excepciones);
            }
          }

          // Si NO es una excepción, continuamos generando la alerta
          if (!esExcepcion) {
            // B. Si tiene Regla de Tiempo, evaluarla
            if (regla.regla_tiempo) {
              this._evaluarReglaTiempo(filaMatriz, regla, rt);
            }
            
            // C. Si tiene Alerta de Bloqueo directo (ej. Diferencia de áreas)
            if (regla.alerta_bloqueo && !regla.regla_tiempo && !regla.evaluacion_cruzada) {
               this._registrarAlerta(rt, filaMatriz, regla, regla.alerta_bloqueo.nivel, regla.alerta_bloqueo.mensaje, null);
            }
          }
        }
        } catch (errorRegla) {
          console.error('Regla omitida por error:', regla && regla.nombre, errorRegla);
        }
      });
    });

    const guardado = this._guardarAlertasEnHoja();
    if (!guardado) return { success: false, error: 'No se pudo escribir ALERTAS_ACTIVAS.' };
    if (typeof invalidateDataCache === 'function') invalidateDataCache();
    try {
      PropertiesService.getScriptProperties().setProperty('MOTOR_REGLAS_ULTIMA_EVALUACION_ISO', new Date().toISOString());
    } catch (e) {}

    console.log(`✅ Motor finalizado. ${this.alertasGeneradas.length} alertas generadas únicas.`);
    return {
      success: true,
      totalAlertas: this.alertasGeneradas.length,
      reglasNoEvaluables: reglasNoEvaluables,
      reglasConCruceIgnorado: reglasConCruceIgnorado,
      festivosCargados: this.festivosCargados
    };
  }

  /**
   * Parsea fechas de forma segura evitando el formato Mes/Día
   */
  _parseFechaSegura(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    
    let s = String(valor).trim();
    let partes = s.split(/[-/]/);
    if (partes.length === 3) {
      let dia = parseInt(partes[0], 10);
      let mes = parseInt(partes[1], 10) - 1; // Meses en JS son 0-11
      let anio = partes[2].length === 2 ? 2000 + parseInt(partes[2], 10) : parseInt(partes[2], 10);
      let d = new Date(anio, mes, dia);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date(valor); // Fallback
  }

  /**
   * Verifica si una fila de Excel cumple las condiciones del JSON
   */
  /**
   * NUEVO: Parsea valores de dinero de forma segura (quita $, comas, puntos)
   */
  _parseMoneySeguro(valor) {
    if (!valor) return 0;
    let str = String(valor).trim();
    if (!isNaN(str) && str !== '') return parseFloat(str);
    
    str = str.replace(/[^\d.,]/g, '');
    if (!str) return 0;
    
    const lastCommaPos = str.lastIndexOf(',');
    const lastDotPos = str.lastIndexOf('.');
    let normalized = str;
    
    if (lastCommaPos > lastDotPos) {
        normalized = str.replace(/\./g, '').replace(',', '.');
    } else if (lastDotPos > lastCommaPos) {
        normalized = str.replace(/,/g, '');
    } else if (lastCommaPos === -1 && lastDotPos === -1) {
        normalized = str;
    } else if (lastCommaPos >= 0 && lastDotPos === -1) {
        normalized = str.replace(/,/g, '');
    }
    
    const result = parseFloat(normalized);
    return isNaN(result) ? 0 : result;
  }

  /**
   * Verifica si una fila de Excel cumple las condiciones del JSON
   */
  _cumpleCondiciones(filaMatriz, condiciones) {
    if (!condiciones) return true;
    let criterios = condiciones.criterios ? condiciones.criterios : [condiciones];
    let operadorLogico = condiciones.operador_logico || "AND";

    let resultados = criterios.map(criterio => {
      let valorCeldaOri = filaMatriz[criterio.columna_estado || criterio.columna_A || criterio.columna]; 
      let valorCelda = String(valorCeldaOri || "").toUpperCase().trim();
      let valorEsperado = criterio.valores_estado || criterio.valores || criterio.valor;
      let operador = criterio.operador_estado || criterio.operador;

      switch (operador) {
        case "EQUALS": return valorCelda === String(valorEsperado).toUpperCase();
        case "NOT_EQUAL": return valorCelda !== String(valorEsperado).toUpperCase();
        case "IN": return Array.isArray(valorEsperado) ? valorEsperado.map(v => String(v).toUpperCase()).includes(valorCelda) : false;
        case "NOT_IN": return Array.isArray(valorEsperado) ? !valorEsperado.map(v => String(v).toUpperCase()).includes(valorCelda) : true;
        case "IS_NOT_NULL": return valorCelda !== "" && valorCelda !== "0" && valorCelda !== "N/A";
        case "IS_NULL": return valorCelda === "" || valorCelda === "N/A" || valorCelda === "-"; 
        case "LESS_THAN": return parseFloat(valorCeldaOri) < parseFloat(valorEsperado);
        case "DATE_BEFORE_COLUMN": 
          let f1 = this._parseFechaSegura(valorCeldaOri);
          let f2 = this._parseFechaSegura(filaMatriz[criterio.columna_destino]);
          if (!f1 || !f2 || isNaN(f1.getTime()) || isNaN(f2.getTime())) return false;
          return f1 < f2;
        
        // ---> LÍNEA NUEVA: LÓGICA PARA EVALUAR PORCENTAJE DE PAGO <---
        case "PERCENTAGE_BETWEEN_COLUMNS":
          let valParcial = this._parseMoneySeguro(valorCeldaOri);
          let valTotal = this._parseMoneySeguro(filaMatriz[criterio.columna_destino]);
          if (valTotal === 0) return false; // Evita error matemático si el total es cero
          let porcentaje = (valParcial / valTotal) * 100;
          return porcentaje >= (criterio.min_pct || 0) && porcentaje <= (criterio.max_pct || 100);

        // ---> LÍNEA NUEVA: LÓGICA PARA EVALUAR ANTIGÜEDAD DE FECHA CONTRA HOY <---
        case "DAYS_PASSED_LESS_THAN":
          let fechaCelda = this._parseFechaSegura(valorCeldaOri);
          if (!fechaCelda || isNaN(fechaCelda.getTime())) return false;
          // Calcula los días desde la fecha de la celda hasta hoy
          let difMilisegundos = this.hoy.getTime() - fechaCelda.getTime();
          let diasPasados = Math.floor(difMilisegundos / (1000 * 60 * 60 * 24));
          return diasPasados <= parseFloat(valorEsperado);

        default: return false;
      }
    });

    return operadorLogico === "OR" ? resultados.some(r => r) : resultados.every(r => r);
  }
  /**
   * Evalúa reglas de tiempo basándose en días Calendario o Hábiles
   */
  _evaluarReglaTiempo(filaMatriz, regla, rt) {
    let conf = regla.regla_tiempo;
    let nombreColumnaFecha = conf.columna_fecha_inicio;
    
    // 1. Obtener la fecha de inicio
    let valorFechaStr = filaMatriz[nombreColumnaFecha];
    if (!valorFechaStr) return; // Si no hay fecha, no se puede evaluar vigencia
    
    let fechaInicio = this._parseFechaSegura(valorFechaStr);
    if (!fechaInicio || isNaN(fechaInicio.getTime())) return;

    // 2. Calcular días transcurridos
    let diasTranscurridos;
    if (conf.tipo_dias === "HABILES") {
      diasTranscurridos = this._calcularDiasHabiles(fechaInicio, this.hoy);
    } else {
      let diferenciaMilisegundos = this.hoy.getTime() - fechaInicio.getTime();
      diasTranscurridos = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
    }

    // 3. Determinar días restantes
    let diasRestantes = conf.dias_vida_util - diasTranscurridos;

    // 4. Buscar el umbral más crítico
    let umbralesOrdenados = conf.umbrales.sort((a, b) => a.dias_restantes - b.dias_restantes);
    
    let umbralAplicable = null;
    for (let u of umbralesOrdenados) {
      if (diasRestantes <= u.dias_restantes) {
        umbralAplicable = u;
        break;
      }
    }

    // 5. Registrar si aplica (CON MENSAJE DINÁMICO)
    if (umbralAplicable) {
      let mensajeDinamico = umbralAplicable.mensaje;
      
      // Reemplaza la etiqueta {DIAS} por el número real absoluto (positivo)
      if (mensajeDinamico.includes("{DIAS}")) {
          mensajeDinamico = mensajeDinamico.replace("{DIAS}", Math.abs(diasRestantes));
      }

      this._registrarAlerta(rt, filaMatriz, regla, umbralAplicable.nivel, mensajeDinamico, diasRestantes, this._fechaVencimiento_(fechaInicio, conf));
    }
  }

  /**
   * Acumula las alertas en la memoria antes de escribirlas
   */
  _registrarAlerta(rt, filaMatriz, regla, nivel, mensaje, diasRestantes, fechaVencimiento) {

    // Lógica de prioridad para el articulador
    let articuladorFinal = "SIN ASIGNAR";
    if (filaMatriz["ARTICULADOR JUIRIDICO"] && String(filaMatriz["ARTICULADOR JUIRIDICO"]).trim() !== "") {
        articuladorFinal = filaMatriz["ARTICULADOR JUIRIDICO"];
    } else if (filaMatriz["GESTOR JURÍDICO"] && String(filaMatriz["GESTOR JURÍDICO"]).trim() !== "") {
        articuladorFinal = filaMatriz["GESTOR JURÍDICO"];
    }

    // ✅ SPRINT5-FASE-C: email de enrutamiento, resuelto directamente del registro evaluado.
    const articuladorEmail = _resolverEmailDesdeCeldaAlertas(filaMatriz["ARTICULADOR JUIRIDICO"]);
    const gestorEmail = _resolverEmailDesdeCeldaAlertas(filaMatriz["GESTOR JURÍDICO"]);

    this.alertasGeneradas.push({
      RT: rt,
      PROYECTO: filaMatriz["PROYECTO"] || "SIN PROYECTO",
      ARTICULADOR: articuladorFinal,
      ARTICULADOR_EMAIL: articuladorEmail,
      GESTOR_EMAIL: gestorEmail,
      SIN_RESPONSABLE: !articuladorEmail && !gestorEmail,
      FASE: regla.fase,
      REGLA: regla.nombre,
      NIVEL: nivel,
      MENSAJE: mensaje,
      DIAS_RESTANTES: diasRestantes !== null ? Math.round(diasRestantes) : "N/A",
      FECHA_VENCIMIENTO: fechaVencimiento || "",
      ESTADO_PREDIAL: filaMatriz["ESTADO PREDIAL AJUSTADO"] || ""
    });
  }

  /**
   * Borra la hoja de alertas anterior y escribe la nueva con DEDUPLICACIÓN
   */
  _guardarAlertasEnHoja() {
    
    // ✅ FILTRO ANTI-DUPLICADOS (Por RT + Nombre de la Regla)
    const alertasUnicas = [];
    const mapaDuplicados = new Map();

    for (const alerta of this.alertasGeneradas) {
        const llave = alerta.RT + "_" + alerta.REGLA;
        if (!mapaDuplicados.has(llave)) {
            mapaDuplicados.set(llave, true);
            alertasUnicas.push(alerta);
        }
    }
    // Sobreescribimos el array global con el que ya no tiene repetidos
    this.alertasGeneradas = alertasUnicas;

    // --- CONTINÚA EL GUARDADO NORMAL ---
    // ✅ SEC-P1.5: LockService — esta operación borra y reescribe ALERTAS_ACTIVAS por completo
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);

      let hojaAlertas = this.ss.getSheetByName("ALERTAS_ACTIVAS");

      if (!hojaAlertas) {
        hojaAlertas = this.ss.insertSheet("ALERTAS_ACTIVAS");
      } else {
        hojaAlertas.clear();
      }

      const headers = ["TIMESTAMP", "NIVEL", "RT", "PROYECTO", "ARTICULADOR", "ARTICULADOR_EMAIL", "GESTOR_EMAIL", "FASE", "REGLA", "DIAS RESTANTES", "FECHA_VENCIMIENTO", "MENSAJE", "ESTADO PREDIAL ACTUAL"];
      hojaAlertas.getRange(1, 1, 1, headers.length).setValues([headers]);
      hojaAlertas.getRange(1, 1, 1, headers.length).setBackground("#c0392b").setFontColor("white").setFontWeight("bold");

      if (this.alertasGeneradas.length === 0) {
        const tsVacio = this.hoy.toLocaleString('es-CO');
        const vacio = headers.map(function(h) {
          if (h === "TIMESTAMP") return tsVacio;
          if (h === "MENSAJE") return "No hay alertas activas en el sistema.";
          return "";
        });
        hojaAlertas.getRange(2, 1, 1, headers.length).setValues([vacio]);
        return true;
      }

      // Ordenar alertas (ROJO primero, luego NARANJA, luego AMARILLO)
      const pesoNivel = { "ROJO": 1, "NARANJA": 2, "AMARILLO": 3, "INFO": 4 };
      this.alertasGeneradas.sort((a, b) => pesoNivel[a.NIVEL] - pesoNivel[b.NIVEL]);

      const ts = this.hoy.toLocaleString('es-CO');
      const filas = this.alertasGeneradas.map(a => [
        ts,
        a.NIVEL,
        a.RT,
        a.PROYECTO,
        a.ARTICULADOR,
        a.ARTICULADOR_EMAIL || '',
        a.GESTOR_EMAIL || '',
        a.FASE,
        a.REGLA,
        a.DIAS_RESTANTES,
        a.FECHA_VENCIMIENTO || "",
        a.MENSAJE,
        a.ESTADO_PREDIAL
      ]);

      hojaAlertas.getRange(2, 1, filas.length, headers.length).setValues(filas);

      const rangoNivel = hojaAlertas.getRange(2, 2, filas.length, 1);

      const ruleRojo = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("ROJO").setBackground("#fce8e6").setFontColor("#c5221f").setRanges([rangoNivel]).build();
      const ruleNaranja = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("NARANJA").setBackground("#fff3e0").setFontColor("#e65100").setRanges([rangoNivel]).build();
      const ruleAmarillo = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("AMARILLO").setBackground("#fef9e7").setFontColor("#b06000").setRanges([rangoNivel]).build();

      hojaAlertas.setConditionalFormatRules([ruleRojo, ruleNaranja, ruleAmarillo]);
      hojaAlertas.autoResizeColumns(1, headers.length);
      return true;
    } catch (error) {
      console.error("Error guardando ALERTAS_ACTIVAS:", error);
      return false;
    } finally {
      try { lock.releaseLock(); } catch (er) {}
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MOTOR DE CÁLCULO DE DÍAS HÁBILES Y FESTIVOS (COLOMBIA)
  // ═══════════════════════════════════════════════════════════

  _cargarFestivosColombia(year) {
    let festivosStr = [];
    try {
      const calId = 'es.co#holiday@group.v.calendar.google.com'; 
      const calendar = CalendarApp.getCalendarById(calId);
      if (calendar) {
        const startDate = new Date(year - 1, 0, 1);
        const endDate = new Date(year + 1, 11, 31);
        const events = calendar.getEvents(startDate, endDate);
        festivosStr = events.map(e => e.getStartTime().toISOString().split('T')[0]);
        this.festivosCargados = festivosStr.length > 0;
      }
    } catch (e) {
      this.festivosCargados = false;
      console.warn("⚠️ No se pudo cargar calendario de festivos. Se usarán solo fines de semana.", e);
    }
    return festivosStr;
  }

  _calcularDiasHabiles(fechaInicio, fechaFin) {
    let cuenta = 0;
    let curDate = new Date(fechaInicio);
    curDate.setHours(12, 0, 0, 0); 
    const finalDate = new Date(fechaFin);
    finalDate.setHours(12, 0, 0, 0);

    while (curDate < finalDate) {
      curDate.setDate(curDate.getDate() + 1);
      let dayOfWeek = curDate.getDay();
      let esFinDeSemana = (dayOfWeek === 0 || dayOfWeek === 6);
      let fechaIso = curDate.toISOString().split('T')[0];
      let esFestivo = this.festivosColombia.includes(fechaIso);

      if (!esFinDeSemana && !esFestivo) {
        cuenta++;
      }
    }
    return cuenta;
  }

  _sumarDiasHabiles(fechaInicio, cantidad) {
    var n = Math.round(Number(cantidad) || 0);
    var cur = new Date(fechaInicio);
    cur.setHours(12, 0, 0, 0);
    var cuenta = 0;
    var guardia = 0;
    while (cuenta < n && guardia < 10000) {
      guardia++;
      cur.setDate(cur.getDate() + 1);
      var dia = cur.getDay();
      var iso = cur.toISOString().split('T')[0];
      if (dia !== 0 && dia !== 6 && this.festivosColombia.indexOf(iso) < 0) cuenta++;
    }
    return cur;
  }

  _fechaVencimiento_(fechaInicio, conf) {
    var n = Number(conf && conf.dias_vida_util);
    if (!(n > 0) || !fechaInicio) return "";
    var fecha;
    if (conf.tipo_dias === "HABILES") {
      fecha = this._sumarDiasHabiles(fechaInicio, n);
    } else {
      fecha = new Date(fechaInicio.getTime());
      fecha.setHours(12, 0, 0, 0);
      fecha.setDate(fecha.getDate() + Math.round(n));
    }
    return Utilities.formatDate(fecha, Session.getScriptTimeZone() || "America/Bogota", "yyyy-MM-dd");
  }
}

const MAX_ALERTAS_PAYLOAD = 100;

// ✅ SPRINT5-FASE-C: distingue si una celda ARTICULADOR JUIRIDICO/GESTOR JURÍDICO ya fue
// migrada a email real (post asignarEquipoGranular()/reasignarUsuarioMasivo(), Fase A) o
// todavía tiene el nombre libre histórico. No re-ejecuta homologación difusa aquí —
// homologarUsuariosMatriz() ya existe para eso; esto es solo el chequeo barato de "¿ya es
// un email?" para poder enrutar la notificación sin costo extra por alerta.
const REGEX_EMAIL_SIMPLE_ALERTAS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function _resolverEmailDesdeCeldaAlertas(valor) {
  const texto = String(valor || '').trim();
  return REGEX_EMAIL_SIMPLE_ALERTAS.test(texto) ? texto.toLowerCase() : '';
}

function _resumenAlertasVacio_(estado, error) {
  return {
    success: estado !== 'ERROR',
    estado: estado,
    totalAlertas: 0,
    severidades: { ROJO: 0, NARANJA: 0, AMARILLO: 0 },
    proyectosImpactados: 0,
    rtImpactados: 0,
    alertas: [],
    ultimaEvaluacion: '',
    obsoleta: false,
    error: error || ''
  };
}

function resumirAlertasActivasParaDashboard_(registrosVisibles) {
  try {
    const rts = new Set((Array.isArray(registrosVisibles) ? registrosVisibles : []).map(function(r) {
      return String((r && (r.RT || r['NUMERO RT'])) || '').trim();
    }).filter(Boolean));
    const ss = SpreadsheetApp.openById(getConfig('DATA_FILES.PRINCIPAL'));
    const hoja = ss.getSheetByName('ALERTAS_ACTIVAS');
    if (!hoja || hoja.getLastRow() < 2) return _resumenAlertasVacio_('SIN_EVALUAR');
    const datos = hoja.getDataRange().getValues();
    const headers = datos[0].map(function(h) { return String(h || '').trim(); });
    const idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });
    const filas = datos.slice(1).filter(function(fila) {
      const rt = String(fila[idx.RT] || '').trim();
      return rt && rts.has(rt);
    });
    const mensajeVacio = filas.length === 1 && String(filas[0][idx.MENSAJE] || '') === 'No hay alertas activas en el sistema.';
    const peso = { ROJO: 1, NARANJA: 2, AMARILLO: 3 };
    const severidades = { ROJO: 0, NARANJA: 0, AMARILLO: 0 };
    const proyectos = new Set();
    const rtSet = new Set();
    const alertas = [];
    if (!mensajeVacio) {
      filas.forEach(function(fila) {
        const nivel = String(fila[idx.NIVEL] || '').trim().toUpperCase();
        if (!severidades.hasOwnProperty(nivel)) return;
        severidades[nivel] += 1;
        const rt = String(fila[idx.RT] || '').trim();
        const proyecto = String(fila[idx.PROYECTO] || 'SIN PROYECTO').trim() || 'SIN PROYECTO';
        proyectos.add(proyecto);
        rtSet.add(rt);
        const art = String(fila[idx.ARTICULADOR_EMAIL] || '');
        const ges = String(fila[idx.GESTOR_EMAIL] || '');
        alertas.push({
          RT: rt,
          PROYECTO: proyecto,
          REGLA: String(fila[idx.REGLA] || ''),
          NIVEL: nivel,
          MENSAJE: String(fila[idx.MENSAJE] || ''),
          FECHA_EVALUACION: String(fila[idx.TIMESTAMP] || ''),
          ARTICULADOR_EMAIL: art,
          GESTOR_EMAIL: ges,
          SIN_RESPONSABLE: !art && !ges
        });
      });
    }
    alertas.sort(function(a, b) { return (peso[a.NIVEL] || 99) - (peso[b.NIVEL] || 99); });
    let iso = '';
    try { iso = PropertiesService.getScriptProperties().getProperty('MOTOR_REGLAS_ULTIMA_EVALUACION_ISO') || ''; } catch (e) {}
    const obsoleta = iso ? (Date.now() - new Date(iso).getTime()) > (36 * 60 * 60 * 1000) : false;
    return {
      success: true,
      estado: 'OK',
      totalAlertas: mensajeVacio ? 0 : alertas.length,
      severidades: severidades,
      proyectosImpactados: proyectos.size,
      rtImpactados: rtSet.size,
      alertas: alertas.slice(0, MAX_ALERTAS_PAYLOAD),
      ultimaEvaluacion: mensajeVacio || alertas.length ? String((filas[0] && filas[0][idx.TIMESTAMP]) || '') : '',
      obsoleta: obsoleta
    };
  } catch (e) {
    return _resumenAlertasVacio_('ERROR', e && e.message ? e.message : String(e));
  }
}

/**
 * Ejecutar UNA VEZ desde el editor con la cuenta Administrador. Independiente de instalarTriggersPAC().
 */
function ejecutarMotorReglasInterno_() {
  const motor = new MotorEvaluadorReglas();
  const resultado = motor.ejecutarMotor();
  try {
    const auditoria = new GestorAuditoria(getConfig('DATA_FILES.PRINCIPAL'));
    auditoria.registrarAccion('SISTEMA', 'MOTOR_REGLAS_EJECUTADO', JSON.stringify({
      totalAlertas: resultado.totalAlertas,
      reglasNoEvaluables: resultado.reglasNoEvaluables,
      reglasConCruceIgnorado: resultado.reglasConCruceIgnorado,
      festivosCargados: resultado.festivosCargados
    }));
  } catch (e) {}
  return resultado;
}

function ejecutarEvaluadorAlertas() {
  const denegado = _exigirAdminMotorReglas_('EJECUTAR_MOTOR_REGLAS');
  if (denegado) return denegado;
  return ejecutarMotorReglasInterno_();
}

function triggerDiarioMotorReglas(e) {
  if (!e || !e.triggerUid) return { success: false, error: 'Solo invocable por el trigger instalado' };
  const conocido = ScriptApp.getProjectTriggers().some(function(t) { return t.getUniqueId() === e.triggerUid; });
  if (!conocido) return { success: false, error: 'Solo invocable por el trigger instalado' };
  try {
    const r = ejecutarMotorReglasInterno_();
    if (!r.success && r.error !== 'No hay reglas configuradas') throw new Error(r.error || 'Fallo del motor');
    return r;
  } catch (err) {
    console.error(err);
    try {
      const destino = Session.getEffectiveUser().getEmail();
      if (destino) {
        MailApp.sendEmail({
          to: destino,
          subject: '[Motor de Reglas] Fallo en trigger diario',
          htmlBody: '<p>El motor de reglas falló: ' + String(err.message || err).replace(/</g, '') + '</p>'
        });
      }
    } catch (mailErr) {}
    return { success: false, error: String(err.message || err) };
  }
}

function _eliminarTriggerMotorReglas_() {
  const triggers = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === 'triggerDiarioMotorReglas';
  });
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  return triggers.length;
}

function instalarTriggerMotorReglas() {
  const denegado = _exigirAdminMotorReglas_('INSTALAR_TRIGGER_MOTOR');
  if (denegado) return denegado;
  _eliminarTriggerMotorReglas_();
  ScriptApp.newTrigger('triggerDiarioMotorReglas').timeBased().everyDays(1).atHour(6).create();
  return { success: true, mensaje: 'Trigger diario 6:00 instalado' };
}

function eliminarTriggerMotorReglas() {
  const denegado = _exigirAdminMotorReglas_('ELIMINAR_TRIGGER_MOTOR');
  if (denegado) return denegado;
  return { success: true, eliminados: _eliminarTriggerMotorReglas_() };
}

// Función para obtener las alertas para la interfaz web (Dashboard)
function obtenerAlertasWeb() {
  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    const ss = SpreadsheetApp.openById(fileId);
    const hojaAlertas = ss.getSheetByName("ALERTAS_ACTIVAS");
    
    if (!hojaAlertas) return JSON.stringify([]);

    const datos = hojaAlertas.getDataRange().getValues();
    if (datos.length < 2) return JSON.stringify([]);

    const headers = datos[0];
    const filas = datos.slice(1);
    const proyectoIdx = headers.indexOf('PROYECTO');

    let proyectosVisibles = { todos: true, proyectos: [], excluidos: [] };
    try {
      const gestorFiltro = new GestorFiltroMatriz();
      proyectosVisibles = gestorFiltro.obtenerProyectosVisibles() || proyectosVisibles;
    } catch (filtroError) {
      console.warn('⚠️ No se pudo resolver Filtro Matriz en obtenerAlertasWeb: ' + filtroError.message);
    }

    const resultado = filas
      .filter(fila => {
        if (!proyectosVisibles || proyectosVisibles.todos || proyectoIdx < 0) return true;
        const proyecto = String(fila[proyectoIdx] || '').trim();
        if (proyectosVisibles.proyectos && proyectosVisibles.proyectos.length > 0) {
          return proyectosVisibles.proyectos.includes(proyecto);
        }
        if (proyectosVisibles.excluidos && proyectosVisibles.excluidos.length > 0) {
          return !proyectosVisibles.excluidos.includes(proyecto);
        }
        return true;
      })
      .map(fila => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = fila[i]);
        return obj;
      });

    return JSON.stringify(resultado);
  } catch (e) {
    console.error("Error obteniendo alertas web:", e);
    return JSON.stringify([]);
  }
}