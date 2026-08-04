/**
 * ═══════════════════════════════════════════════════════════
 * UTILIDADES Y FUNCIONES AUXILIARES
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Comparación segura de strings (case-insensitive)
 */
function safeCompare(val1, val2) {
  try {
    if (val1 === null || val1 === undefined) return false;
    if (val2 === null || val2 === undefined) return false;
    return String(val1).trim().toUpperCase() === String(val2).trim().toUpperCase();
  } catch (e) {
    console.error(`Error en safeCompare: ${e.message}`);
    return false;
  }
}

/**
 * Encuentra índice de columna por palabras clave
 */
function findColumnIndex(headers, keywords) {
  try {
    if (!headers || !Array.isArray(headers)) return -1;
    if (!keywords) return -1;
    
    if (typeof keywords === 'string') keywords = [keywords];
    
    return headers.findIndex(h => {
      const header = String(h).toUpperCase().trim();
      return keywords.some(k => header.includes(k.toUpperCase()));
    });
  } catch (e) {
    console.error(`Error en findColumnIndex: ${e.message}`);
    return -1;
  }
}

/**
 * Mapea columnas de forma flexible
 */
function mapColumnsFlexible(headers) {
  try {
    const findCol = (keywords) => {
      if (typeof keywords === 'string') keywords = [keywords];
      return headers.findIndex(h => 
        keywords.some(k => String(h).toUpperCase().includes(k.toUpperCase()))
      );
    };

    return {
      "ESTADO PREDIAL": findCol(["ESTADO PREDIAL"]),
      "ESTADO PREDIAL AJUSTADO": findCol(["AJUSTADO"]),
      "PREDIOS DISPONIBLES": findCol(["DISPONIBLE"]),
      "ESTADO RT": findCol(["ESTADO RT"]),
      "ESTADO ESTUDIO DE TITULOS": findCol(["TITULOS", "ESTUDIO"]),
      "ESTADO TASACIÓN": findCol(["TASACI"]),
      "ESTADO AVALUO": findCol(["AVALUO"]),
      "FECHA AVALUO": findCol(["FECHA AVALUO"]),
      "SITUACIONES ESPECIALES": findCol(["SITUACION"]),
      "OBSERVACIONES": findCol(["OBSERVACIONES"])
    };
  } catch (e) {
    console.error(`Error en mapColumnsFlexible: ${e.message}`);
    return {};
  }
}

/**
 * Valida email
 */
function isValidEmail(email) {
  try {
    if (!email || typeof email !== 'string') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  } catch (e) {
    console.error(`Error validando email: ${e.message}`);
    return false;
  }
}

/**
 * Genera ID único
 */
function generarId(prefijo) {
  try {
    const p = prefijo || 'FM';
    return `${p}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  } catch (e) {
    return `FM_${Date.now()}`;
  }
}

/**
 * Intenta parsear JSON de forma segura
 */
function tryParseJSON(str) {
  try {
    if (!str || str === '') return null;
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Formatea fecha a ISO
 */
function formatDateISO(date) {
  try {
    if (!date) return null;
    if (typeof date === 'string') date = new Date(date);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error(`Error formateando fecha: ${e.message}`);
    return null;
  }
}

/**
 * Limpia texto y convierte a mayúsculas sin tildes
 */
function cleanTextUpper(text) {
  try {
    if (!text) return "";
    return String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();
  } catch (e) {
    console.error(`Error limpiando texto: ${e.message}`);
    return String(text).toUpperCase().trim();
  }
}

/**
 * Obtiene timestamp actual
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Valida que un valor no sea nulo/vacío
 */
function isNotEmpty(value) {
  try {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Trunca texto a longitud máxima
 */
function truncateText(text, maxLength) {
  try {
    if (!text) return '';
    const str = String(text);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  } catch (e) {
    return String(text);
  }
}

/**
 * Convierte array a objeto usando una clave
 */
function arrayToObject(arr, keyField) {
  try {
    if (!Array.isArray(arr)) return {};
    const obj = {};
    arr.forEach(item => {
      const key = item[keyField];
      if (key) obj[key] = item;
    });
    return obj;
  } catch (e) {
    console.error(`Error en arrayToObject: ${e.message}`);
    return {};
  }
}

/**
 * Obtiene valores únicos de un array
 */
function getUniqueValues(arr) {
  try {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ''))];
  } catch (e) {
    console.error(`Error obteniendo valores únicos: ${e.message}`);
    return [];
  }
}

/**
 * Formatea número como moneda
 */
function formatCurrency(value) {
  try {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(num);
  } catch (e) {
    return '$0';
  }
}

/**
 * Calcula diferencia de días entre fechas
 */
function daysDifference(date1, date2) {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
}

/**
 * Valida que un objeto tenga las propiedades requeridas
 */
function hasRequiredProperties(obj, props) {
  try {
    if (!obj || typeof obj !== 'object') return false;
    return props.every(prop => prop in obj);
  } catch (e) {
    return false;
  }
}

/**
 * Clona objeto de forma profunda
 */
function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.error(`Error clonando objeto: ${e.message}`);
    return obj;
  }
}

/**
 * Merge de objetos
 */
function mergeObjects(obj1, obj2) {
  try {
    return Object.assign({}, obj1, obj2);
  } catch (e) {
    console.error(`Error mergeando objetos: ${e.message}`);
    return obj1;
  }
}

/**
 * Obtiene valor anidado de objeto usando path
 */
function getNestedValue(obj, path) {
  try {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  } catch (e) {
    return undefined;
  }
}

/**
 * Establece valor anidado en objeto usando path
 */
function setNestedValue(obj, path, value) {
  try {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);
    target[lastKey] = value;
    return obj;
  } catch (e) {
    console.error(`Error estableciendo valor: ${e.message}`);
    return obj;
  }
}

/**
 * Retry de función con reintentos
 */
function retryFunction(fn, maxRetries = 3, delay = 1000) {
  try {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return fn();
      } catch (e) {
        attempts++;
        if (attempts >= maxRetries) throw e;
        Utilities.sleep(delay);
      }
    }
  } catch (e) {
    console.error(`Error después de ${maxRetries} intentos: ${e.message}`);
    throw e;
  }
}

/**
 * Logging mejorado
 */
function logInfo(message, data) {
  console.log(`ℹ️ [INFO] ${message}`, data || '');
}

function logWarning(message, data) {
  console.warn(`⚠️ [WARNING] ${message}`, data || '');
}

function logError(message, error) {
  console.error(`❌ [ERROR] ${message}`, error ? error.message : '');
  if (error && error.stack) console.error(error.stack);
}

function logSuccess(message, data) {
  console.log(`✅ [SUCCESS] ${message}`, data || '');
}

/**
 * Función de test para utilidades
 */
function testUtilidades() {
  console.log('🧪 Iniciando tests de utilidades...\n');
  
  try {
    // Test 1: safeCompare
    console.log('Test 1: safeCompare');
    console.log('  Resultado:', safeCompare('HOLA', 'hola') === true ? '✅' : '❌');
    
    // Test 2: isValidEmail
    console.log('Test 2: isValidEmail');
    console.log('  Resultado:', isValidEmail('test@example.com') === true ? '✅' : '❌');
    
    // Test 3: cleanTextUpper
    console.log('Test 3: cleanTextUpper');
    console.log('  Resultado:', cleanTextUpper('Hóla Múndo') === 'HOLA MUNDO' ? '✅' : '❌');
    
    // Test 4: generarId
    console.log('Test 4: generarId');
    const id = generarId();
    console.log('  ID generado:', id);
    console.log('  Resultado:', id.startsWith('ID_') ? '✅' : '❌');
    
    console.log('\n🎉 Tests completados!');
    
  } catch (e) {
    console.error('❌ Error en tests:', e.message);
  }
}