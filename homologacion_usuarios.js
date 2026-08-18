'use strict';

/**
 * Motor de homologación difusa de usuarios — Sprint 5, Fase A [CONC-BE-07].
 * Cruza los nombres libres de Datos.ARTICULADOR JUIRIDICO / Datos.GESTOR JURÍDICO
 * contra el directorio de identidad USUARIOS (spreadsheet separado, ver
 * CONFIG.DATA_FILES.USUARIOS) para resolver el email real de cada responsable.
 * No lee PAC_Articuladores — deprecado para este propósito (ARCHITECTURE_V4.md Sección 6.1).
 */

const HOMOLOGACION_ENGINE = {
  umbralPuntaje: 0.75, // por debajo de esto, se considera NO_ENCONTRADO
  batchSize: 1000
};

/**
 * Normaliza un nombre para comparación: mayúsculas, sin tildes, espacios colapsados.
 * findColumnIndex()/pac_getColIdx() no ignoran tildes — este helper cierra ese gap
 * específicamente para comparación de VALORES (no de headers de columna).
 */
function _normalizarNombreUsuario(valor) {
  return String(valor || '')
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function _leerDirectorioUsuarios() {
  const usuariosFileId = getConfig('DATA_FILES.USUARIOS');
  if (!usuariosFileId) {
    throw new Error('CONFIG.DATA_FILES.USUARIOS no está configurado');
  }

  const gestor = new GestorDatos(usuariosFileId);
  const sheetName = getConfig('SHEETS.USUARIOS', 'USUARIOS');
  const { rows } = gestor.leerDatos(sheetName);

  return rows
    .map(function(row) {
      const nombre = String(row['NOMBRE'] || '').trim();
      return {
        email: String(row['EMAIL'] || '').trim(),
        rol: String(row['ROL'] || '').trim(),
        nombre: nombre,
        nombreNormalizado: _normalizarNombreUsuario(nombre),
        activo: String(row['ACTIVO'] || '').trim().toUpperCase(),
        componente: String(row['COMPONENTE'] || '').trim()
      };
    })
    .filter(function(u) { return u.nombre !== ''; });
}

function _esActivo(usuario) {
  return usuario.activo === 'SI' || usuario.activo === 'ACTIVO' || usuario.activo === 'S';
}

/**
 * Busca la mejor coincidencia de `nombreBuscado` en `directorio`.
 * 1. Igualdad exacta normalizada (sin tildes) → ENCONTRADO_ACTIVO / ENCONTRADO_INACTIVO.
 * 2. Levenshtein sobre nombres normalizados, puntaje = 1 - distancia/maxLen → SIMILITUD_APROXIMADA si > umbral.
 * 3. Si no hay nada por encima del umbral → NO_ENCONTRADO.
 */
function _mejorCoincidenciaUsuario(nombreBuscado, directorio) {
  const nombreNormalizado = _normalizarNombreUsuario(nombreBuscado);
  if (!nombreNormalizado) {
    return { usuario: null, puntaje: 0, confianza: 'NO_ENCONTRADO' };
  }

  const exacto = directorio.find(function(u) { return u.nombreNormalizado === nombreNormalizado; });
  if (exacto) {
    return {
      usuario: exacto,
      puntaje: 1,
      confianza: _esActivo(exacto) ? 'ENCONTRADO_ACTIVO' : 'ENCONTRADO_INACTIVO'
    };
  }

  let mejor = null;
  let mejorPuntaje = 0;
  directorio.forEach(function(u) {
    const distancia = levenshteinDistance(nombreNormalizado, u.nombreNormalizado);
    const maxLen = Math.max(nombreNormalizado.length, u.nombreNormalizado.length) || 1;
    const puntaje = 1 - (distancia / maxLen);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = u;
    }
  });

  if (mejor && mejorPuntaje > HOMOLOGACION_ENGINE.umbralPuntaje) {
    return { usuario: mejor, puntaje: mejorPuntaje, confianza: 'SIMILITUD_APROXIMADA' };
  }

  return { usuario: null, puntaje: mejorPuntaje, confianza: 'NO_ENCONTRADO' };
}

function _serializarResultados(mapa, rolLabel) {
  return Object.keys(mapa).map(function(nombre) {
    const r = mapa[nombre];
    return {
      nombreEnDatos: nombre,
      rol: rolLabel,
      coincidenciaSugerida: r.usuario ? r.usuario.nombre : null,
      email: r.usuario ? r.usuario.email : null,
      activo: r.usuario ? r.usuario.activo : null,
      puntaje: Number(r.puntaje.toFixed(3)),
      confianza: r.confianza
    };
  });
}

/**
 * Cruza Datos (ARTICULADOR JUIRIDICO / GESTOR JURÍDICO) contra USUARIOS.
 * Procesa por lotes de 1000 filas (Directiva 3) — solo lectura, no toca Datos.
 */
function homologarUsuariosMatriz() {
  try {
    const gestorDatos = new GestorDatos(getConfig('DATA_FILES.PRINCIPAL'));
    const { headers, rows } = gestorDatos.leerDatos(getConfig('SHEETS.DATOS'));

    if (!headers.length) {
      return { success: false, error: 'No se pudo leer la hoja Datos' };
    }

    const idxArticulador = findColumnIndex(headers, getConfig('COLUMNS.ARTICULADOR_JURIDICO'));
    const idxGestor = findColumnIndex(headers, getConfig('COLUMNS.GESTOR_JURIDICO'));

    if (idxArticulador < 0 || idxGestor < 0) {
      return {
        success: false,
        error: 'Columnas ARTICULADOR JUIRIDICO / GESTOR JURÍDICO no encontradas en Datos'
      };
    }

    const colArticulador = headers[idxArticulador];
    const colGestor = headers[idxGestor];
    const directorio = _leerDirectorioUsuarios();

    // Nombres únicos por rol — evita recalcular Levenshtein para el mismo nombre repetido en cientos de RTs.
    const resultadosArticulador = {};
    const resultadosGestor = {};

    for (let start = 0; start < rows.length; start += HOMOLOGACION_ENGINE.batchSize) {
      const fin = Math.min(start + HOMOLOGACION_ENGINE.batchSize, rows.length);
      for (let i = start; i < fin; i++) {
        const row = rows[i];
        const nombreArt = String(row[colArticulador] || '').trim();
        const nombreGes = String(row[colGestor] || '').trim();

        if (nombreArt && !resultadosArticulador[nombreArt]) {
          resultadosArticulador[nombreArt] = _mejorCoincidenciaUsuario(nombreArt, directorio);
        }
        if (nombreGes && !resultadosGestor[nombreGes]) {
          resultadosGestor[nombreGes] = _mejorCoincidenciaUsuario(nombreGes, directorio);
        }
      }
    }

    return {
      success: true,
      articuladores: _serializarResultados(resultadosArticulador, 'ARTICULADOR'),
      gestores: _serializarResultados(resultadosGestor, 'GESTOR'),
      totalFilasProcesadas: rows.length,
      totalUsuariosDirectorio: directorio.length
    };
  } catch (e) {
    console.error('❌ Error en homologarUsuariosMatriz: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Subconjunto de homologarUsuariosMatriz() en confianza NO_ENCONTRADO o ENCONTRADO_INACTIVO —
 * la cola lista-para-modal de cuentas desactualizadas/ausentes (Fase B).
 */
function detectarUsuariosHuerfanos() {
  try {
    const homologacion = homologarUsuariosMatriz();
    if (!homologacion.success) return homologacion;

    const huerfanos = homologacion.articuladores
      .concat(homologacion.gestores)
      .filter(function(item) {
        return item.confianza === 'NO_ENCONTRADO' || item.confianza === 'ENCONTRADO_INACTIVO';
      });

    return {
      success: true,
      huerfanos: huerfanos,
      total: huerfanos.length
    };
  } catch (e) {
    console.error('❌ Error en detectarUsuariosHuerfanos: ' + e.message);
    return { success: false, error: e.message };
  }
}
