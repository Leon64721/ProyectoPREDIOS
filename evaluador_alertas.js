/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE REGLAS - ALMACENAMIENTO Y LECTURA
 * ═══════════════════════════════════════════════════════════
 */

// Función para obtener el JSON actual de las reglas
function obtenerReglasJSON() {
  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL'); 
    const ss = SpreadsheetApp.openById(fileId);
    let hojaReglas = ss.getSheetByName('CONFIG_REGLAS');
    
    // Si la hoja no existe, la crea (Instalación automática)
    if (!hojaReglas) {
      hojaReglas = ss.insertSheet('CONFIG_REGLAS');
      hojaReglas.hideSheet(); // La oculta para que los usuarios no la dañen
      hojaReglas.getRange("A1").setValue("MOTOR_DE_REGLAS_JSON");
      hojaReglas.getRange("A1").setFontWeight("bold").setBackground("#34495e").setFontColor("white");
      hojaReglas.getRange("B1").setValue("{}"); // JSON vacío por defecto
    }
    
    const jsonString = hojaReglas.getRange("B1").getValue();
    return { success: true, data: jsonString };
    
  } catch (error) {
    console.error("Error leyendo reglas:", error);
    return { success: false, error: error.message };
  }
}

// Función para que el Administrador guarde cambios en el JSON desde la UI
function guardarReglasJSON(jsonString, usuario) {
  try {
    // 1. Validar que sea un JSON bien formado antes de guardar
    JSON.parse(jsonString); 
    
    const fileId = getConfig('DATA_FILES.PRINCIPAL');
    const ss = SpreadsheetApp.openById(fileId);
    let hojaReglas = ss.getSheetByName('CONFIG_REGLAS');
    
    // 2. Guardar en la celda B1
    hojaReglas.getRange("B1").setValue(jsonString);
    
    // 3. Registrar en auditoría (usando tu Gestor de Auditoría actual)
    try {
      const auditoria = new GestorAuditoria(fileId);
      auditoria.registrarAccion(usuario, 'ACTUALIZAR_MOTOR_REGLAS', 'Se actualizó el JSON maestro de reglas de negocio');
    } catch(e) { console.warn("No se pudo auditar:", e); }

    return { success: true, message: "Reglas actualizadas correctamente en la base de datos." };
    
  } catch (error) {
    return { success: false, error: "El formato JSON es inválido. Revisa la sintaxis." };
  }
}

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
    this.festivosColombia = this._cargarFestivosColombia(this.hoy.getFullYear());
    this.alertasGeneradas = [];
  }

  /**
   * FUNCIÓN PRINCIPAL: Ejecuta todo el motor
   */
  ejecutarMotor() {
    console.log("🚀 Iniciando Motor Evaluador de Reglas...");
    
    // 1. Obtener el JSON de Reglas
    const jsonString = this.ss.getSheetByName('CONFIG_REGLAS').getRange("B1").getValue();
    if (!jsonString || jsonString === "{}") {
      console.warn("⚠️ No hay reglas JSON configuradas.");
      return { success: false, error: "No hay reglas configuradas" };
    }
    
    const configReglas = JSON.parse(jsonString);
    const reglasActivas = configReglas.ReglasDeNegocio.filter(r => r.activa);
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

    // 3. Evaluar fila por fila contra cada regla
    matriz.forEach((filaMatriz, indexFila) => {
      const rt = filaMatriz["RT"];
      if (!rt) return; // Saltar filas vacías

      reglasActivas.forEach(regla => {
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
      });
    });

    // 4. Guardar resultados en hoja separada (Aplica Deduplicación antes de guardar)
    this._guardarAlertasEnHoja();

    console.log(`✅ Motor finalizado. ${this.alertasGeneradas.length} alertas generadas únicas.`);
    return { success: true, totalAlertas: this.alertasGeneradas.length };
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

      this._registrarAlerta(rt, filaMatriz, regla, umbralAplicable.nivel, mensajeDinamico, diasRestantes);
    }
  }

  /**
   * Acumula las alertas en la memoria antes de escribirlas
   */
  _registrarAlerta(rt, filaMatriz, regla, nivel, mensaje, diasRestantes) {
    
    // Lógica de prioridad para el articulador
    let articuladorFinal = "SIN ASIGNAR";
    if (filaMatriz["ARTICULADOR JUIRIDICO"] && String(filaMatriz["ARTICULADOR JUIRIDICO"]).trim() !== "") {
        articuladorFinal = filaMatriz["ARTICULADOR JUIRIDICO"];
    } else if (filaMatriz["GESTOR JURÍDICO"] && String(filaMatriz["GESTOR JURÍDICO"]).trim() !== "") {
        articuladorFinal = filaMatriz["GESTOR JURÍDICO"];
    }

    this.alertasGeneradas.push({
      RT: rt,
      PROYECTO: filaMatriz["PROYECTO"] || "SIN PROYECTO",
      ARTICULADOR: articuladorFinal,
      FASE: regla.fase,
      REGLA: regla.nombre,
      NIVEL: nivel, 
      MENSAJE: mensaje,
      DIAS_RESTANTES: diasRestantes !== null ? Math.round(diasRestantes) : "N/A",
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
    let hojaAlertas = this.ss.getSheetByName("ALERTAS_ACTIVAS");
    
    if (!hojaAlertas) {
      hojaAlertas = this.ss.insertSheet("ALERTAS_ACTIVAS");
    } else {
      hojaAlertas.clear();
    }

    const headers = ["TIMESTAMP", "NIVEL", "RT", "PROYECTO", "ARTICULADOR", "FASE", "REGLA", "DIAS RESTANTES", "MENSAJE", "ESTADO PREDIAL ACTUAL"];
    hojaAlertas.getRange(1, 1, 1, headers.length).setValues([headers]);
    hojaAlertas.getRange(1, 1, 1, headers.length).setBackground("#c0392b").setFontColor("white").setFontWeight("bold");

    if (this.alertasGeneradas.length === 0) {
      hojaAlertas.getRange(2, 1).setValue("No hay alertas activas en el sistema.");
      return;
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
      a.FASE,
      a.REGLA,
      a.DIAS_RESTANTES,
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
      }
    } catch (e) {
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
}

/**
 * ═══════════════════════════════════════════════════════════
 * FUNCIONES PARA LLAMAR DESDE LA INTERFAZ Y TRIGGERS
 * ═══════════════════════════════════════════════════════════
 */

// Ejecución manual desde el botón "Recargar Motor" o Trigger Diario
function ejecutarEvaluadorAlertas() {
  const motor = new MotorEvaluadorReglas();
  return motor.ejecutarMotor();
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

    const resultado = filas.map(fila => {
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