'use strict';

/**
 * Motor de homologación difusa de usuarios — Sprint 5, Fase A [CONC-BE-07].
 * Cruza los nombres libres de Datos.ARTICULADOR JUIRIDICO / Datos.GESTOR JURÍDICO
 * contra el directorio de identidad USUARIOS (spreadsheet separado, ver
 * CONFIG.DATA_FILES.USUARIOS) para resolver el email real de cada responsable, combinando
 * Token Set Ratio + Levenshtein para tolerar nombres informales/incompletos y typos.
 * No lee PAC_Articuladores — deprecado para este propósito (ARCHITECTURE_V4.md Sección 6.1).
 *
 * sincronizarGruposGoogleIDU() enriquece USUARIOS desde los grupos oficiales de Workspace
 * (Admin SDK Directory API) ANTES de correr homologarUsuariosMatriz() — son dos pasos
 * independientes, no encadenados automáticamente: si Admin SDK no está habilitado/autorizado
 * todavía, homologarUsuariosMatriz() sigue funcionando igual sobre el USUARIOS actual.
 */

const HOMOLOGACION_ENGINE = {
  umbralPuntaje: 0.75, // por debajo de esto, se considera NO_ENCONTRADO
  batchSize: 1000
};

// Inventario de grupos oficiales de Google Workspace (idu.gov.co) usados para enriquecer
// USUARIOS. Requiere Admin SDK Directory API habilitado (ver appsscript.json) y que la
// cuenta ejecutora tenga privilegios de administrador de Grupos — ver sincronizarGruposGoogleIDU().
const GRUPOS_OFICIALES_IDU = [
  { email: 'dtdp@idu.gov.co', componente: 'DTDP' },
  { email: 'stap@idu.gov.co', componente: 'STAP' },
  { email: 'stgsv@idu.gov.co', componente: 'STGSV' }
];

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
 * Busca la mejor coincidencia de `nombreBuscado` en `directorio`.
 * 1. Igualdad exacta normalizada (sin tildes) → ENCONTRADO_ACTIVO / ENCONTRADO_INACTIVO.
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
    return {
      usuario: exacto,
      puntaje: 1,
      confianza: _esActivo(exacto) ? 'ENCONTRADO_ACTIVO' : 'ENCONTRADO_INACTIVO'
    };
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

function _obtenerMiembrosGrupo(grupoEmail) {
  const miembros = [];
  let pageToken = null;
  do {
    const opciones = pageToken ? { pageToken: pageToken } : {};
    const respuesta = AdminDirectory.Members.list(grupoEmail, opciones);
    (respuesta.members || []).forEach(function(m) {
      if (m.email) miembros.push(m.email);
    });
    pageToken = respuesta.nextPageToken || null;
  } while (pageToken);
  return miembros;
}

function _obtenerNombreCompleto(emailUsuario) {
  try {
    const usuario = AdminDirectory.Users.get(emailUsuario);
    return (usuario && usuario.name && usuario.name.fullName) || '';
  } catch (e) {
    console.warn('⚠️ No se pudo resolver nombre para ' + emailUsuario + ': ' + e.message);
    return '';
  }
}

/**
 * Sincroniza USUARIOS contra los grupos oficiales de Workspace (GRUPOS_OFICIALES_IDU) vía
 * Admin SDK Directory API. REQUIERE: (a) el servicio avanzado "AdminDirectory" habilitado
 * (ya declarado en appsscript.json), (b) el scope admin.directory.group.member.readonly +
 * admin.directory.user.readonly autorizados en el próximo despliegue, y (c) que la cuenta
 * que ejecuta el script tenga privilegios de administrador de Grupos en idu.gov.co — esto
 * último es una decisión de Workspace, no algo que el código pueda otorgar. Si el servicio
 * no está disponible, la función falla con un error explícito en vez de intentar leer las
 * páginas /members por HTTP (esas requieren sesión de navegador, UrlFetchApp no la tiene).
 *
 * Upsert por EMAIL, no destructivo: usuarios nuevos se agregan (ACTIVO='SI', ROL vacío — la
 * asignación de rol es una decisión de gobernanza, no algo que este sync deba inferir);
 * usuarios ya existentes en USUARIOS solo se enriquecen si su NOMBRE/COMPONENTE están vacíos,
 * nunca se sobreescribe un valor ya curado manualmente. Un mismo email en varios grupos
 * acumula todos los COMPONENTE separados por coma en vez de sobreescribirse entre grupos.
 */
function sincronizarGruposGoogleIDU() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (eLock) {
    return { success: false, error: 'No se pudo adquirir el lock: ' + eLock.message };
  }

  try {
    if (typeof AdminDirectory === 'undefined') {
      throw new Error('El servicio avanzado AdminDirectory no está habilitado en este proyecto de Apps Script (ver appsscript.json / Servicios avanzados de Google).');
    }

    const usuariosFileId = getConfig('DATA_FILES.USUARIOS');
    if (!usuariosFileId) throw new Error('CONFIG.DATA_FILES.USUARIOS no está configurado');

    const gestor = new GestorDatos(usuariosFileId);
    const sheetName = getConfig('SHEETS.USUARIOS', 'USUARIOS');
    const sheet = gestor.getSheet(sheetName);
    const { headers, rows } = gestor.leerDatos(sheetName);

    const idxEmail = findColumnIndex(headers, 'EMAIL');
    const idxNombre = findColumnIndex(headers, 'NOMBRE');
    const idxActivo = findColumnIndex(headers, 'ACTIVO');
    const idxComponente = findColumnIndex(headers, 'COMPONENTE');

    if (idxEmail < 0 || idxNombre < 0) {
      throw new Error('La hoja USUARIOS no tiene las columnas EMAIL/NOMBRE esperadas');
    }

    // Índice de filas existentes por email normalizado, para decidir upsert (nuevo vs. enriquecer).
    const indicePorEmail = {};
    rows.forEach(function(row, i) {
      const email = String(row['EMAIL'] || '').trim().toLowerCase();
      if (email) indicePorEmail[email] = i;
    });

    const errores = [];
    const gruposConsultados = [];
    const inventario = {};

    GRUPOS_OFICIALES_IDU.forEach(function(grupo) {
      try {
        const miembros = _obtenerMiembrosGrupo(grupo.email);
        gruposConsultados.push({ grupo: grupo.email, miembros: miembros.length });

        miembros.forEach(function(emailMiembro) {
          const emailNorm = String(emailMiembro || '').trim().toLowerCase();
          if (!emailNorm) return;
          if (!inventario[emailNorm]) {
            inventario[emailNorm] = { email: emailNorm, nombreCompleto: null, componentes: [] };
          }
          if (inventario[emailNorm].componentes.indexOf(grupo.componente) < 0) {
            inventario[emailNorm].componentes.push(grupo.componente);
          }
        });
      } catch (eGrupo) {
        console.error('❌ Error consultando grupo ' + grupo.email + ': ' + eGrupo.message);
        errores.push({ grupo: grupo.email, error: eGrupo.message });
      }
    });

    const emailsUnicos = Object.keys(inventario);
    const totalFilasExistentes = rows.length;

    // Una sola lectura/escritura por columna afectada (Directiva 3), en vez de N
    // setValue() individuales — mismo patrón que gestion_equipos_backend.js.
    const columnaNombreValores = totalFilasExistentes > 0
      ? sheet.getRange(2, idxNombre + 1, totalFilasExistentes, 1).getValues()
      : [];
    const columnaComponenteValores = (idxComponente >= 0 && totalFilasExistentes > 0)
      ? sheet.getRange(2, idxComponente + 1, totalFilasExistentes, 1).getValues()
      : null;

    let usuariosNuevos = 0;
    let usuariosEnriquecidos = 0;
    const filasNuevas = [];

    for (let start = 0; start < emailsUnicos.length; start += HOMOLOGACION_ENGINE.batchSize) {
      const fin = Math.min(start + HOMOLOGACION_ENGINE.batchSize, emailsUnicos.length);
      for (let i = start; i < fin; i++) {
        const email = emailsUnicos[i];
        const entrada = inventario[email];
        entrada.nombreCompleto = _obtenerNombreCompleto(email);
        const componenteTexto = entrada.componentes.join(', ');

        const filaExistenteIdx = indicePorEmail[email];

        if (filaExistenteIdx === undefined) {
          const filaNueva = new Array(headers.length).fill('');
          filaNueva[idxEmail] = email;
          filaNueva[idxNombre] = entrada.nombreCompleto || '';
          if (idxActivo >= 0) filaNueva[idxActivo] = 'SI';
          if (idxComponente >= 0) filaNueva[idxComponente] = componenteTexto;
          filasNuevas.push(filaNueva);
          usuariosNuevos++;
          continue;
        }

        const rowActual = rows[filaExistenteIdx];
        const nombreActual = String(rowActual['NOMBRE'] || '').trim();
        const componenteActual = idxComponente >= 0 ? String(rowActual['COMPONENTE'] || '').trim() : '';
        let cambios = false;

        if (!nombreActual && entrada.nombreCompleto) {
          columnaNombreValores[filaExistenteIdx][0] = entrada.nombreCompleto;
          cambios = true;
        }
        if (idxComponente >= 0 && !componenteActual && componenteTexto) {
          columnaComponenteValores[filaExistenteIdx][0] = componenteTexto;
          cambios = true;
        }
        if (cambios) usuariosEnriquecidos++;
      }
    }

    if (usuariosEnriquecidos > 0 && totalFilasExistentes > 0) {
      sheet.getRange(2, idxNombre + 1, totalFilasExistentes, 1).setValues(columnaNombreValores);
      if (columnaComponenteValores) {
        sheet.getRange(2, idxComponente + 1, totalFilasExistentes, 1).setValues(columnaComponenteValores);
      }
    }

    if (filasNuevas.length > 0) {
      const primeraFilaNueva = sheet.getLastRow() + 1;
      sheet.getRange(primeraFilaNueva, 1, filasNuevas.length, headers.length).setValues(filasNuevas);
    }

    return {
      success: true,
      gruposConsultados: gruposConsultados,
      totalMiembrosUnicos: emailsUnicos.length,
      usuariosNuevos: usuariosNuevos,
      usuariosEnriquecidos: usuariosEnriquecidos,
      errores: errores
    };
  } catch (e) {
    console.error('❌ Error en sincronizarGruposGoogleIDU: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}
