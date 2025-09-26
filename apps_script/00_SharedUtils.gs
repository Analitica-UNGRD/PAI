/**
 * SharedUtils.gs - Utilidades Compartidas del Sistema PAI-UNGRD
 * 
 * Este archivo contiene:
 * - Configuración global del sistema
 * - Utilidades de formateo y validación
 * - Funciones auxiliares comunes
 * - Generadores de IDs y timestamps
 * - Manejo de errores estandarizado
 * 
 * @author: Sistema PAI-UNGRD
 * @version: 1.0
 */

// ==================== CONFIGURACIÓN GLOBAL ====================

/**
 * Configuración unificada del sistema
 */
const SYSTEM_CONFIG = {
  // IDs y referencias principales
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '170_RbLY4e_T4bC4gXJd6pdw0xuOaXoie-h6_3VQuo_U',
  
  // Hojas del sistema
  SHEETS: {
    CATALOG: 'Catalogo_Unificado',        // Nueva estructura normalizada
    ACTIVITIES: 'Actividades',
    ADVANCES: 'Avances',
    USERS: 'Usuarios',
    // Mantener compatibilidad durante transición
    LEGACY_CATALOGS: 'Catalogos'
  },
  
  // Configuración API
  API: {
    VERSION: '2.0',
    CORS_HEADERS: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  },
  
  // Estados válidos para actividades
  ACTIVITY_STATES: ['Planeada', 'En Progreso', 'Completada', 'Suspendida', 'Cancelada'],
  
  // Tipos de catálogo según nueva estructura
  CATALOG_TYPES: {
    AREA: 'area',
    SUBPROCESO: 'subproceso', 
    OBJETIVO: 'objetivo',
    ESTRATEGIA: 'estrategia',
    LINEA: 'linea',
    INDICADOR: 'indicador',
    PLAN: 'plan',
    BIMESTRE: 'bimestre',
    MIPG: 'mipg',
    FUENTE: 'fuente'
  },
  
  // Configuración de seguridad
  SECURITY: {
    TOKEN_EXPIRY_HOURS: 24,
    MAX_LOGIN_ATTEMPTS: 3,
    HMAC_SECRET: PropertiesService.getScriptProperties().getProperty('HMAC_SECRET') || 'replace_with_secret'
  }
};

// ==================== GENERADORES DE ID Y TIMESTAMPS ====================

/**
 * Genera un UUID v4 simplificado para Apps Script
 * @returns {string} UUID único
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Genera un ID único con prefijo personalizado
 * @param {string} prefix - Prefijo del ID (ej: 'ACT', 'CAT')
 * @param {boolean} useUUID - Si usar UUID completo o timestamp
 * @returns {string} ID único generado
 */
function generateUniqueId(prefix = 'ID', useUUID = false) {
  if (useUUID) {
    return `${prefix}-${generateUUID()}`;
  }
  
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Genera códigos legibles para catálogos
 * @param {string} type - Tipo de catálogo
 * @param {string} name - Nombre del elemento
 * @param {number} counter - Contador secuencial opcional
 * @returns {string} Código generado
 */
function generateCatalogCode(type, name, counter = null) {
  const typePrefix = type.substr(0, 3).toUpperCase();
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 4).toUpperCase();
  const suffix = counter ? counter.toString().padStart(3, '0') : Math.floor(Math.random() * 999).toString().padStart(3, '0');
  
  return `${typePrefix}_${cleanName}_${suffix}`;
}

/**
 * Genera timestamp ISO con zona horaria de Colombia
 * @returns {string} Timestamp en formato ISO
 */
function getCurrentTimestamp() {
  const now = new Date();
  // Ajustar a UTC-5 (hora de Colombia)
  now.setHours(now.getHours() - 5);
  return now.toISOString();
}

/**
 * Devuelve la fecha actual como texto 'YYYY-MM-DD' (solo fecha, sin hora)
 * Esto evita problemas de zonas horarias al guardar/mostrar fechas.
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function getCurrentDateOnly() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normaliza un valor de fecha entrante y devuelve 'YYYY-MM-DD' o cadena vacía
 * Acepta: Date, 'YYYY-MM-DD', ISO datetime 'YYYY-MM-DDTHH:MM:SSZ', otras cadenas parseables.
 * @param {Date|string|null} value
 * @returns {string}
 */
function normalizeDateInput(value) {
  if (!value && value !== 0) return '';

  // Si ya es una Date
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  const s = String(value).trim();
  if (!s) return '';

  // Si ya está en formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Si es ISO con T, tomar la parte antes de 'T'
  if (s.indexOf('T') !== -1) {
    return s.split('T')[0];
  }

  // Si contiene espacio separado (ej: '2025-09-22 00:00:00'), tomar la primera parte
  if (s.indexOf(' ') !== -1) {
    const p = s.split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  }

  // Intentar parsear con Date y construir fecha local (fallback)
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  } catch (e) {
    // fallthrough
  }

  // No se pudo normalizar
  return '';
}

/**
 * Formatea fecha para Colombia (DD/MM/YYYY)
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
function formatDateColombia(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ==================== UTILIDADES DE VALIDACIÓN ====================

/**
 * Valida si un email es válido
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida si una cadena no está vacía
 * @param {string} value - Valor a validar
 * @returns {boolean} True si no está vacío
 */
function isNotEmpty(value) {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

/**
 * Valida si un valor está en una lista de opciones válidas
 * @param {any} value - Valor a validar
 * @param {Array} validOptions - Array de opciones válidas
 * @returns {boolean} True si es válido
 */
function isValidOption(value, validOptions) {
  return validOptions.includes(value);
}

/**
 * Valida formato de fecha (YYYY-MM-DD)
 * @param {string} dateString - Cadena de fecha
 * @returns {boolean} True si es válida
 */
function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
}

/**
 * Valida que una fecha sea futura
 * @param {string} dateString - Cadena de fecha
 * @returns {boolean} True si es futura
 */
function isFutureDate(dateString) {
  if (!isValidDate(dateString)) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

/**
 * Valida estructura básica de actividad
 * @param {Object} activity - Datos de actividad
 * @param {string} operation - Operación ('create', 'update')
 * @returns {Object} Resultado de validación
 */
function validateActivityData(activity, operation = 'create') {
  const errors = [];
  
  // Campos requeridos para crear
  if (operation === 'create') {
    if (!isNotEmpty(activity.descripcion_actividad)) {
      errors.push('Descripción de actividad es requerida');
    }
    if (!isNotEmpty(activity.subproceso_id)) {
      errors.push('Subproceso es requerido');
    }
    if (!isNotEmpty(activity.linea_id)) {
      errors.push('Línea de acción es requerida');
    }
  }
  
  // Validaciones de formato si los campos están presentes
  if (activity.fecha_inicio_planeada && !isValidDate(activity.fecha_inicio_planeada)) {
    errors.push('Fecha de inicio debe tener formato YYYY-MM-DD');
  }
  
  if (activity.fecha_fin_planeada && !isValidDate(activity.fecha_fin_planeada)) {
    errors.push('Fecha de fin debe tener formato YYYY-MM-DD');
  }
  
  if (activity.estado && !isValidOption(activity.estado, SYSTEM_CONFIG.ACTIVITY_STATES)) {
    errors.push(`Estado debe ser uno de: ${SYSTEM_CONFIG.ACTIVITY_STATES.join(', ')}`);
  }
  
  // Validar que fecha fin sea posterior a fecha inicio
  if (activity.fecha_inicio_planeada && activity.fecha_fin_planeada) {
    const inicio = new Date(activity.fecha_inicio_planeada);
    const fin = new Date(activity.fecha_fin_planeada);
    if (fin <= inicio) {
      errors.push('Fecha de fin debe ser posterior a fecha de inicio');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ==================== MANEJO DE RESPUESTAS Y ERRORES ====================

/**
 * Formatea respuesta estándar para todas las APIs
 * @param {boolean} success - Indicador de éxito
 * @param {any} data - Datos de respuesta
 * @param {string} message - Mensaje descriptivo
 * @param {string|Array} errors - Errores si los hay
 * @param {Object} meta - Metadatos adicionales
 * @returns {Object} Respuesta formateada
 */
function formatResponse(success, data = null, message = '', errors = null, meta = {}) {
  return {
    success: success,
    data: data,
    message: message,
    errors: errors ? (Array.isArray(errors) ? errors : [errors]) : null,
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v3.0',
      ...meta
    }
  };
}

/**
 * Maneja errores de forma consistente
 * @param {Error} error - Error capturado
 * @param {string} context - Contexto donde ocurrió
 * @param {Object} additionalData - Datos adicionales para debug
 * @returns {Object} Respuesta de error formateada
 */
function handleError(error, context = 'unknown', additionalData = {}) {
  const errorMessage = `Error en ${context}: ${error.message}`;
  
  // Log detallado para debugging
  console.error(`[${context}] Error:`, {
    message: error.message,
    stack: error.stack,
    additionalData: additionalData,
    timestamp: getCurrentTimestamp()
  });
  
  return formatResponse(
    false, 
    null, 
    'Ha ocurrido un error en el sistema', 
    [errorMessage],
    { context: context }
  );
}

/**
 * Maneja respuestas JSON con headers CORS
 * @param {number} statusCode - Código de estado HTTP
 * @param {Object} responseData - Datos de respuesta
 * @returns {ContentService} Respuesta formateada para Apps Script
 */
function jsonResponseWithCORS(statusCode, responseData) {
  const jsonOutput = JSON.stringify(responseData);
  const output = ContentService.createTextOutput(jsonOutput)
    .setMimeType(ContentService.MimeType.JSON);

  // Obtener headers CORS desde la configuración si están disponibles
  const defaultCors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Max-Age': '3600'
  };

  const corsFromConfig = (typeof SYSTEM_CONFIG !== 'undefined' && SYSTEM_CONFIG.API && SYSTEM_CONFIG.API.CORS_HEADERS)
    ? SYSTEM_CONFIG.API.CORS_HEADERS
    : {};

  // Mezclar configuraciones (config tiene prioridad sobre defaults)
  const headers = Object.assign({}, defaultCors, corsFromConfig);

  try {
    output.setHeaders(headers);
  } catch (e) {
    // setHeaders puede fallar en ciertos entornos; registrar y continuar devolviendo la respuesta JSON
    console.warn('jsonResponseWithCORS: setHeaders falló:', e && e.message);
  }

  return output;
}

// ==================== UTILIDADES DE HOJA DE CÁLCULO ====================

/**
 * Abre la hoja de cálculo principal del sistema
 * @returns {Spreadsheet} Objeto Spreadsheet
 */
function openSystemSpreadsheet() {
  const id = SYSTEM_CONFIG.SPREADSHEET_ID;
  if (!id || id === 'REPLACE_WITH_SPREADSHEET_ID') {
    throw new Error('SPREADSHEET_ID no configurado en las propiedades del script');
  }
  return SpreadsheetApp.openById(id);
}

/**
 * Obtiene o crea una hoja del sistema
 * @param {string} sheetName - Nombre de la hoja
 * @param {Array} headers - Headers para crear la hoja si no existe
 * @returns {Sheet} Objeto Sheet
 */
function getOrCreateSheet(sheetName, headers = []) {
  const spreadsheet = openSystemSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    
    if (headers.length > 0) {
      // Añadir headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Formatear header
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#2563eb');
      headerRange.setFontColor('#ffffff');
    }
  }
  
  return sheet;
}

/**
 * Lee todas las filas de una hoja como objetos
 * @param {string} sheetName - Nombre de la hoja
 * @param {boolean} includeEmpty - Incluir filas vacías
 * @returns {Array} Array de objetos con los datos
 */
function readSheetAsObjects(sheetName, includeEmpty = false) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SYSTEM_CONFIG.SPREADSHEET_ID);
    console.log('Spreadsheet opened:', spreadsheet ? spreadsheet.getName() : 'null');
    
    const sheet = spreadsheet.getSheetByName(sheetName);
    console.log(`Sheet '${sheetName}' found:`, sheet ? 'yes' : 'no');
    
    if (!sheet) {
      console.error(`Sheet '${sheetName}' not found. Available sheets:`, 
        spreadsheet.getSheets().map(s => s.getName()));
      return [];
    }
    
    if (sheet.getLastRow() <= 1) {
      console.log('Sheet has no data rows (only header or empty)');
      return [];
    }
  
    const range = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn());
    const values = range.getValues();
    const headers = values[0];
    
    console.log('Headers found:', headers);
    console.log('Total rows with data:', values.length);
  
    const objects = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    
    // Saltar filas completamente vacías si no se incluyen
    if (!includeEmpty && row.every(cell => cell === '' || cell == null)) {
      continue;
    }
    
    const obj = {};
    let hasData = false;
    
    headers.forEach((header, index) => {
      if (header && header.toString().trim()) {
        const value = row[index] || '';
        obj[header.toString().trim()] = value;
        if (value !== '' && value != null) {
          hasData = true;
        }
      }
    });
    
    if (hasData || includeEmpty) {
      objects.push(obj);
    }
  }
  
  return objects;
  
  } catch (error) {
    console.error('Error reading sheet as objects:', error);
    return [];
  }
}

/**
 * Busca una fila por un campo específico
 * @param {string} sheetName - Nombre de la hoja
 * @param {string} searchField - Campo por el cual buscar
 * @param {any} searchValue - Valor a buscar
 * @returns {Object|null} Objeto encontrado o null
 */
function findRowByField(sheetName, searchField, searchValue) {
  const objects = readSheetAsObjects(sheetName);
  return objects.find(obj => obj[searchField] === searchValue) || null;
}

/**
 * Actualiza una fila específica en la hoja
 * @param {string} sheetName - Nombre de la hoja
 * @param {string} keyField - Campo clave para identificar la fila
 * @param {any} keyValue - Valor del campo clave
 * @param {Object} updateData - Datos a actualizar
 * @returns {boolean} True si se actualizó exitosamente
 */
function updateRowByKey(sheetName, keyField, keyValue, updateData) {
  const spreadsheet = openSystemSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) return false;
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  
  // Encontrar la columna del campo clave
  const keyColumnIndex = headers.findIndex(h => h === keyField);
  if (keyColumnIndex === -1) return false;
  
  // Encontrar la fila
  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][keyColumnIndex] === keyValue) {
      targetRow = i + 1; // +1 porque las filas de Sheets son 1-indexed
      break;
    }
  }
  
  if (targetRow === -1) return false;
  
  // Actualizar campos especificados
  Object.keys(updateData).forEach(field => {
    const columnIndex = headers.findIndex(h => h === field);
    if (columnIndex !== -1) {
      sheet.getRange(targetRow, columnIndex + 1).setValue(updateData[field]);
    }
  });
  
  return true;
}

// ==================== UTILIDADES DE TEXTO ====================

/**
 * Limpia y normaliza texto para búsquedas
 * @param {string} text - Texto a limpiar
 * @returns {string} Texto normalizado
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remover acentos
}

/**
 * Capitaliza la primera letra de cada palabra
 * @param {string} text - Texto a capitalizar
 * @returns {string} Texto capitalizado
 */
function capitalizeWords(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Trunca texto a una longitud específica
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @param {string} suffix - Sufijo a añadir si se trunca
 * @returns {string} Texto truncado
 */
function truncateText(text, maxLength = 50, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

// ==================== COMPATIBILIDAD CON VERSIÓN ANTERIOR ====================

// Aliases para mantener compatibilidad mientras se migra el código existente
const CONFIG = SYSTEM_CONFIG; // Alias para configuración existente
const formatearRespuesta = formatResponse; // Alias para función de formateo existente
const manejarError = handleError; // Alias para manejo de errores existente
const generarIdUnico = generateUniqueId; // Alias para generación de IDs