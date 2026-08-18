'use strict';

/**
 * Motor de homologación difusa de usuarios — Sprint 5, Fase A [CONC-BE-07].
 * Cruza los nombres libres de Datos.ARTICULADOR JUIRIDICO / Datos.GESTOR JURÍDICO contra el
 * directorio USUARIOS (spreadsheet separado, CONFIG.DATA_FILES.USUARIOS). Combina Token Set
 * Ratio + Levenshtein para tolerar nombres informales/incompletos y typos.
 * No lee PAC_Articuladores — deprecado para este propósito (ARCHITECTURE_V4.md Sección 6.1).
 *
 * ✅ SPRINT6 [CONC-BE-12]: se retiró el fallback al directorio de Grupos de Workspace vía
 * Admin SDK (`sincronizarGruposGoogleIDU()` y su cadena) — nunca se pudo habilitar
 * "Admin SDK API" en Cloud Console pese a dos intentos (ver histórico en
 * DOCUMENTACION_TECNICA_VIVA.md Secciones 20 y 22), y el sembrado manual + Línea Cero
 * (`sembrado_usuarios_grupos.js`, `ejecutarCargaLineaCero()`) ya es la solución operativa
 * vigente. `homologarUsuariosMatriz()` vuelve a leer solo USUARIOS. El estado de confianza
 * `ENCONTRADO_SIN_PERFIL` queda como código defensivo inalcanzable en la práctica (ninguna
 * fila de USUARIOS debería tener `fuente` distinto a 'USUARIOS' ahora) — no se retiró porque
 * no rompe nada y evita reintroducir un bug si algún día se agrega otra fuente.
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

function _leerDirectorioUsuariosSheet() {
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
        componente: String(row['COMPONENTE'] || '').trim(),
        fuente: 'USUARIOS'
      };
    })
    .filter(function(u) { return u.nombre !== ''; });
}

/**
 * ✅ SPRINT6 [CONC-BE-12]: simplificada — antes fusionaba USUARIOS con el fallback de Grupos
 * (retirado, ver docstring del archivo). Se mantiene el nombre de la función porque
 * homologarUsuariosMatriz() ya la llama así; el cuerpo ahora es una lectura directa.
 */
function _leerDirectorioCombinado() {
  return _leerDirectorioUsuariosSheet();
}

function _esActivo(usuario) {
  return usuario.activo === 'SI' || usuario.activo === 'ACTIVO' || usuario.activo === 'S';
}

function _tokenizarNombre(nombreNormalizado) {
  return nombreNormalizado.split(' ').filter(function(t) { return t.length > 0; });
}

function _ratioLevenshtein(a, b) {
  if (!a && !b) return 1;
  const distancia = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - (distancia / maxLen);
}

/**
 * Token Set Ratio (mismo algoritmo que fuzzywuzzy.token_set_ratio): resuelve nombres
 * informales que son subconjunto de un nombre oficial más largo — "Juan Pérez" contra
 * "Juan Carlos Pérez Rodríguez" da 1.0 aquí (intersección de tokens = todo "Juan Pérez"),
 * mientras que Levenshtein sobre el string completo lo penalizaría fuerte por longitud.
 */
function _tokenSetRatio(nombreNormalizadoA, nombreNormalizadoB) {
  const tokensA = _tokenizarNombre(nombreNormalizadoA);
  const tokensB = _tokenizarNombre(nombreNormalizadoB);
  if (!tokensA.length || !tokensB.length) return 0;

  const setA = {};
  tokensA.forEach(function(t) { setA[t] = true; });
  const setB = {};
  tokensB.forEach(function(t) { setB[t] = true; });

  const interseccion = Object.keys(setA).filter(function(t) { return setB[t]; }).sort();
  const soloA = Object.keys(setA).filter(function(t) { return !setB[t]; }).sort();
  const soloB = Object.keys(setB).filter(function(t) { return !setA[t]; }).sort();

  const t0 = interseccion.join(' ');
  const t1 = interseccion.concat(soloA).join(' ').trim();
  const t2 = interseccion.concat(soloB).join(' ').trim();

  return Math.max(
    _ratioLevenshtein(t0, t1),
    _ratioLevenshtein(t0, t2),
    _ratioLevenshtein(t1, t2)
  );
}

/**
 * Busca la mejor coincidencia de `nombreBuscado` en `directorio` (combinado USUARIOS+Grupos).
 * 1. Igualdad exacta normalizada (sin tildes) → ENCONTRADO_ACTIVO / ENCONTRADO_INACTIVO /
 *    ENCONTRADO_SIN_PERFIL (coincide, pero la fila viene solo de Grupos, sin ROL/ACTIVO).
 * 2. Token Set Ratio + Levenshtein sobre nombres normalizados (se toma el mayor de los dos,
 *    porque cubren casos distintos: Levenshtein detecta typos dentro del mismo nombre,
 *    Token Set Ratio detecta nombres informales/incompletos) → SIMILITUD_APROXIMADA si > umbral.
 * 3. Si no hay nada por encima del umbral → NO_ENCONTRADO.
 */
function _mejorCoincidenciaUsuario(nombreBuscado, directorio) {
  const nombreNormalizado = _normalizarNombreUsuario(nombreBuscado);
  if (!nombreNormalizado) {
    return { usuario: null, puntaje: 0, confianza: 'NO_ENCONTRADO' };
  }

  const exacto = directorio.find(function(u) { return u.nombreNormalizado === nombreNormalizado; });
  if (exacto) {
    let confianza;
    if (exacto.fuente === 'GRUPOS') {
      confianza = 'ENCONTRADO_SIN_PERFIL';
    } else {
      confianza = _esActivo(exacto) ? 'ENCONTRADO_ACTIVO' : 'ENCONTRADO_INACTIVO';
    }
    return { usuario: exacto, puntaje: 1, confianza: confianza };
  }

  let mejor = null;
  let mejorPuntaje = 0;
  directorio.forEach(function(u) {
    const puntajeLevenshtein = _ratioLevenshtein(nombreNormalizado, u.nombreNormalizado);
    const puntajeTokenSet = _tokenSetRatio(nombreNormalizado, u.nombreNormalizado);
    const puntaje = Math.max(puntajeLevenshtein, puntajeTokenSet);
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
      fuente: r.usuario ? r.usuario.fuente : null,
      puntaje: Number(r.puntaje.toFixed(3)),
      confianza: r.confianza
    };
  });
}

/**
 * Cruza Datos (ARTICULADOR JUIRIDICO / GESTOR JURÍDICO) contra el directorio combinado
 * (USUARIOS + fallback de Grupos). Procesa por lotes de 1000 filas (Directiva 3) — solo
 * lectura, no toca Datos.
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
    const directorio = _leerDirectorioCombinado();

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
 * Subconjunto de homologarUsuariosMatriz() en confianza NO_ENCONTRADO, ENCONTRADO_INACTIVO
 * o ENCONTRADO_SIN_PERFIL — la cola lista-para-modal de cuentas desactualizadas/ausentes/
 * sin perfil completo (Fase B).
 */
function detectarUsuariosHuerfanos() {
  try {
    const homologacion = homologarUsuariosMatriz();
    if (!homologacion.success) return homologacion;

    const huerfanos = homologacion.articuladores
      .concat(homologacion.gestores)
      .filter(function(item) {
        return item.confianza === 'NO_ENCONTRADO' ||
          item.confianza === 'ENCONTRADO_INACTIVO' ||
          item.confianza === 'ENCONTRADO_SIN_PERFIL';
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

// Umbral MÁS ESTRICTO que HOMOLOGACION_ENGINE.umbralPuntaje (0.75). Ese 0.75 es para
// SUGERIR una coincidencia a un humano en el modal de homologación (con revisión antes de
// vincular). obtenerMapeoLineaCero() en cambio alimenta una escritura AUTOMÁTICA y masiva
// sobre Datos, sin revisión fila por fila — exige 0.85 para SIMILITUD_APROXIMADA, evitando
// que una coincidencia dudosa termine asignando un RT a la persona equivocada.
const LINEA_CERO_UMBRAL_APROXIMADA = 0.85;

/**
 * Diccionario {nombreViejo → emailOficial} para la carga de Línea Cero (Baseline) del
 * módulo de equipos — ver ejecutarCargaLineaCero() en gestion_equipos_backend.js. Solo
 * incluye coincidencias suficientemente confiables para escribirse sin revisión humana:
 * ENCONTRADO_ACTIVO, ENCONTRADO_SIN_PERFIL (persona real, solo le falta el perfil en
 * USUARIOS — igual de confiable en cuanto a IDENTIDAD) y SIMILITUD_APROXIMADA con puntaje
 * ≥ 0.85. Deja fuera ENCONTRADO_INACTIVO (persona ya no activa, no se le debe asignar
 * trabajo nuevo) y NO_ENCONTRADO.
 */
function obtenerMapeoLineaCero() {
  try {
    const homologacion = homologarUsuariosMatriz();
    if (!homologacion.success) return homologacion;

    const CONFIANZAS_AUTOMATIZABLES = ['ENCONTRADO_ACTIVO', 'ENCONTRADO_SIN_PERFIL'];
    const mapeo = {};

    homologacion.articuladores.concat(homologacion.gestores).forEach(function(item) {
      if (!item.email || !item.nombreEnDatos) return;
      const califica = CONFIANZAS_AUTOMATIZABLES.indexOf(item.confianza) >= 0 ||
        (item.confianza === 'SIMILITUD_APROXIMADA' && item.puntaje >= LINEA_CERO_UMBRAL_APROXIMADA);
      if (califica) mapeo[item.nombreEnDatos] = item.email;
    });

    return {
      success: true,
      mapeo: mapeo,
      totalMapeados: Object.keys(mapeo).length
    };
  } catch (e) {
    console.error('❌ Error en obtenerMapeoLineaCero: ' + e.message);
    return { success: false, error: e.message };
  }
}
