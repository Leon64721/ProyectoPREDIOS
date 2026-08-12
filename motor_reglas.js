/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE REGLAS - ALMACENAMIENTO Y LECTURA
 * ═══════════════════════════════════════════════════════════
 */

// Función para obtener el JSON actual de las reglas
function obtenerReglasJSON() {
  try {
    const fileId = getConfig('DATA_FILES.PRINCIPAL'); // Toma el ID de tu config actual
    const ss = SpreadsheetApp.openById(fileId);
    let hojaReglas = ss.getSheetByName('CONFIG_REGLAS');

    // Si la hoja no existe, la crea (Instalación automática)
    if (!hojaReglas) {
      // ✅ SEC-P1.5: LockService para evitar creación duplicada de la hoja bajo concurrencia
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(20000);
        // Re-chequear tras adquirir el lock: otro proceso pudo haberla creado mientras esperábamos
        hojaReglas = ss.getSheetByName('CONFIG_REGLAS');
        if (!hojaReglas) {
          hojaReglas = ss.insertSheet('CONFIG_REGLAS');
          hojaReglas.hideSheet(); // La oculta para que los usuarios no la dañen
          hojaReglas.getRange("A1").setValue("MOTOR_DE_REGLAS_JSON");
          hojaReglas.getRange("A1").setFontWeight("bold").setBackground("#34495e").setFontColor("white");
          hojaReglas.getRange("B1").setValue("{}"); // JSON vacío por defecto
        }
      } catch (lockError) {
        // ✅ CONC-P2.1: diferenciar timeout de lock de otros errores (antes se tragaba en silencio
        // y caía al TypeError de hojaReglas null, con mensaje técnico confuso)
        console.error("Error adquiriendo lock para crear CONFIG_REGLAS:", lockError);
        return { success: false, message: 'El sistema se encuentra ocupado por otro administrador. Por favor intente de nuevo en unos segundos.' };
      } finally {
        try { lock.releaseLock(); } catch (er) {}
      }
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
  // ✅ CONC-P2.1: validar el JSON ANTES de tocar el lock, para que un JSON invalido
  // nunca se reporte como timeout ni un timeout se reporte como JSON invalido
  try {
    JSON.parse(jsonString);
  } catch (parseError) {
    return { success: false, error: "El formato JSON es inválido. Revisa la sintaxis." };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockError) {
    return { success: false, message: 'El sistema se encuentra ocupado por otro administrador. Por favor intente de nuevo en unos segundos.' };
  }

  try {
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
    return { success: false, error: 'Error al guardar las reglas: ' + error.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}

/**
 * @typedef {Object} Regla
 * @property {string} id
 * @property {string} nombre
 * @property {string} descripcion
 * @property {string} codigo
 * @property {'ACTIVA'|'INACTIVA'} estado
 * @property {'FINANCIERO'|'PLAZO'|'ESTADO'|'GENERAL'} categoria
 * @property {'INFO'|'ADVERTENCIA'|'ALERTA'|'CRITICA'} severidad
 * @property {number} prioridad
 * @property {Object} parametros
 * @property {string[]} camposRequeridos
 * @property {boolean} activa
 */

/**
 * @typedef {Object} AlertaGenerada
 * @property {string} id
 * @property {string} reglaId
 * @property {string} nombre
 * @property {string} codigo
 * @property {'INFO'|'ADVERTENCIA'|'ALERTA'|'CRITICA'} severidad
 * @property {number} prioridad
 * @property {string} mensaje
 * @property {string} rt
 * @property {string} proyecto
 * @property {string} tramo
 * @property {string} estado
 * @property {string} fechaEvaluacion
 * @property {string} detalle
 * @property {boolean} resuelta
 */

class MotorReglas {
  constructor(reglas = MotorReglas.reglasBase()) {
    this.reglas = Array.isArray(reglas) ? reglas.filter(Boolean) : [];
  }

  static reglasBase() {
    return [
      {
        id: 'REG-001',
        nombre: 'Inconsistencia Financiera',
        descripcion: 'Detecta cuando el valor ejecutado supera el valor programado.',
        codigo: 'INCONSISTENCIA_FINANCIERA',
        estado: 'ACTIVA',
        categoria: 'FINANCIERO',
        severidad: 'ALERTA',
        prioridad: 100,
        activa: true,
        parametros: { umbral: 0 },
        camposRequeridos: ['VALOR PAGADO', 'ESTIMADO $']
      },
      {
        id: 'REG-002',
        nombre: 'Alerta de Vencimiento',
        descripcion: 'Detecta fechas próximas de compromiso o vencimiento.',
        codigo: 'ALERTA_VENCIMIENTO',
        estado: 'ACTIVA',
        categoria: 'PLAZO',
        severidad: 'ADVERTENCIA',
        prioridad: 80,
        activa: true,
        parametros: { dias: 30 },
        camposRequeridos: ['FECHA COMPROMISO', 'FECHA ESTIMADA DE ENTREGA']
      },
      {
        id: 'REG-003',
        nombre: 'Falta de Estado',
        descripcion: 'Detecta RT activos sin estado definido o no normalizado.',
        codigo: 'FALTA_DE_ESTADO',
        estado: 'ACTIVA',
        categoria: 'ESTADO',
        severidad: 'INFO',
        prioridad: 60,
        activa: true,
        parametros: { activo: 'ACTIVO' },
        camposRequeridos: ['ACTIVO/INACTIVO', 'ESTADO PREDIAL AJUSTADO']
      }
    ];
  }

  _normalizarTexto(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  _parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[$.\s]/g, '').replace(',', '.');
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  _parseDate(value) {
    if (!value && value !== 0) return null;
    const str = this._normalizarTexto(value);
    if (!str) return null;

    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;

    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      if (!isNaN(d.getTime())) return d;
    }

    return null;
  }

  _coalesceField(rtData, candidateKeys) {
    if (!rtData || typeof rtData !== 'object') return '';
    const upperMap = {};
    Object.keys(rtData).forEach((key) => {
      upperMap[String(key).toUpperCase().trim()] = rtData[key];
    });

    for (let i = 0; i < candidateKeys.length; i++) {
      const key = candidateKeys[i];
      const normalized = String(key).toUpperCase().trim();
      if (upperMap[normalized] !== undefined) return upperMap[normalized];
    }
    return '';
  }

  _buildAlerta(regla, rtData, mensaje, detalle, override = {}) {
    const rt = this._normalizarTexto(this._coalesceField(rtData, ['RT', 'NÚMERO RT', 'NUMERO RT']));
    const proyecto = this._normalizarTexto(this._coalesceField(rtData, ['PROYECTO', 'NOMBRE PROYECTO']));
    const tramo = this._normalizarTexto(this._coalesceField(rtData, ['TRAMO', 'CÓDIGO TRAMO', 'CODIGO TRAMO']));
    const estado = this._normalizarTexto(this._coalesceField(rtData, ['ESTADO PREDIAL AJUSTADO', 'ESTADO PREDIAL', 'ESTADO']));

    return {
      id: `${regla.codigo}-${rt || 'sin-rt'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      reglaId: regla.id,
      nombre: regla.nombre,
      codigo: regla.codigo,
      severidad: override.severidad || regla.severidad,
      prioridad: override.prioridad || regla.prioridad,
      mensaje,
      rt,
      proyecto,
      tramo,
      estado,
      fechaEvaluacion: new Date().toISOString(),
      detalle,
      resuelta: false
    };
  }

  _evalInconsistenciaFinanciera(rtData, regla) {
    const ejecutado = this._parseNumber(this._coalesceField(rtData, ['VALOR PAGADO', 'VALOR EJECUTADO', 'PAGADO', 'EJECUTADO']));
    const programado = this._parseNumber(this._coalesceField(rtData, ['ESTIMADO $', 'VALOR PROGRAMADO', 'PROGRAMADO', 'ESTIMADO']));
    const umbral = Number(regla.parametros && regla.parametros.umbral !== undefined ? regla.parametros.umbral : 0);

    if (programado > 0 && ejecutado > programado + umbral) {
      return this._buildAlerta(
        regla,
        rtData,
        'El valor ejecutado supera el valor programado.',
        `Ejecutado: ${ejecutado.toLocaleString('es-CO')} > Programado: ${programado.toLocaleString('es-CO')}`,
        { severidad: 'ALERTA', prioridad: regla.prioridad }
      );
    }

    return null;
  }

  _evalAlertaVencimiento(rtData, regla) {
    const diasAlerta = Number(regla.parametros && regla.parametros.dias !== undefined ? regla.parametros.dias : 30);
    const fechaCompromiso = this._parseDate(this._coalesceField(rtData, ['FECHA COMPROMISO', 'FECHA DE COMPROMISO', 'FECHA VENCIMIENTO', 'FECHA ESTIMADA DE ENTREGA']));
    if (!fechaCompromiso) return null;

    const diffMs = fechaCompromiso.getTime() - Date.now();
    const diffDias = diffMs / (1000 * 60 * 60 * 24);

    if (diffDias <= diasAlerta && diffDias >= 0) {
      return this._buildAlerta(
        regla,
        rtData,
        `Falta poco tiempo para la fecha de compromiso o entrega.`,
        `Quedan ${Math.ceil(diffDias)} días para la fecha de compromiso: ${fechaCompromiso.toISOString().slice(0, 10)}`,
        { severidad: diffDias <= 7 ? 'CRITICA' : 'ADVERTENCIA', prioridad: regla.prioridad }
      );
    }

    return null;
  }

  _evalFaltaDeEstado(rtData, regla) {
    const activoRaw = this._coalesceField(rtData, ['ACTIVO/INACTIVO', 'ACTIVO_INACTIVO', 'ESTADO ACTIVO', 'ESTADO']);
    const estadoActual = this._normalizarTexto(this._coalesceField(rtData, ['ESTADO PREDIAL AJUSTADO', 'ESTADO PREDIAL', 'ESTADO']));
    const activo = this._normalizarTexto(activoRaw).toUpperCase();
    const activoFlag = activo === 'ACTIVO' || activo === 'SI' || activo === 'S' || activo === '1';

    if (activoFlag && (!estadoActual || estadoActual === '')) {
      return this._buildAlerta(
        regla,
        rtData,
        'El RT está activo pero no tiene estado definido.',
        'El registro requiere asignar un estado para activar la clasificación operativa.',
        { severidad: 'INFO', prioridad: regla.prioridad }
      );
    }

    return null;
  }

  _evaluarRegla(regla, rtData) {
    if (!regla || !regla.activa) return null;
    const codigo = String(regla.codigo || '').toUpperCase();

    switch (codigo) {
      case 'INCONSISTENCIA_FINANCIERA':
        return this._evalInconsistenciaFinanciera(rtData, regla);
      case 'ALERTA_VENCIMIENTO':
        return this._evalAlertaVencimiento(rtData, regla);
      case 'FALTA_DE_ESTADO':
        return this._evalFaltaDeEstado(rtData, regla);
      default:
        return null;
    }
  }

  evaluarRegistro(rtData) {
    if (!rtData || typeof rtData !== 'object') {
      return [];
    }

    const resultados = [];
    for (let i = 0; i < this.reglas.length; i++) {
      const regla = this.reglas[i];
      const alerta = this._evaluarRegla(regla, rtData);
      if (alerta) {
        resultados.push(alerta);
      }
    }
    return resultados;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.MotorReglas = MotorReglas;
}