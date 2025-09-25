/**
 * AdvancesManager.gs - Handler mínimo para avances (stubs para desarrollo)
 *
 * Implementa rutas básicas: 'avances/crear' y 'avances/obtener' para permitir
 * que el frontend de desarrollo pruebe la integración. En producción este
 * módulo debe ser completado con persistencia real en hoja de cálculo.
 */

function handleAdvancesRoutes(request) {
  try {
    const { path, payload = {} } = request;

    switch (path) {
      case 'avances/crear':
        return crearAvance(payload);

      case 'avances/obtener':
        return obtenerAvances(payload);

      case 'avances/debugStatus':
        return debugAvancesStatus();

      case 'avances/fixHeaders':
        return fixAvancesHeaders();

      case 'avances/cleanupTestRows':
        return cleanupTestRows(payload);

      case 'avances/eliminar':
        return eliminarAvance(payload);

      default:
        return formatResponse(false, null, '', `Endpoint '${path}' no reconocido por AdvancesManager`);
    }
  } catch (e) {
    console.error('Error en handleAdvancesRoutes:', e);
    return formatResponse(false, null, '', 'Error interno en AdvancesManager');
  }
}

// Definición canónica de headers para la hoja Avances
const ADVANCE_HEADERS = [
  'avance_id',
  'actividad_id',
  'anio',
  'bimestre_id',
  'logro_valor',
  'presupuesto_ejecutado_bimestre',
  'avances_texto',
  'dificultades_texto',
  'evidencia_url',
  'fecha_reporte',
  'reportado_por',
  'creado_en'
];

function crearAvance(datos) {
  try {
    // Validaciones básicas
    if (!datos || !datos.actividad_id) {
      return formatResponse(false, null, '', 'actividad_id es requerido');
    }

    // Generar id de avance (usar helper si está disponible)
    let id;
    try {
      id = (typeof generateUniqueId === 'function') ? generateUniqueId('AV') : ('av_' + new Date().getTime());
    } catch (e) {
      id = 'av_' + new Date().getTime();
    }

    // Normalizar y preparar datos para la hoja
    const nowISO = (typeof new Date().toISOString === 'function') ? new Date().toISOString() : getCurrentTimestamp();
    const fechaReporte = datos && datos.fecha_reporte ? normalizeDateInput(datos.fecha_reporte) : getCurrentDateOnly();

    // Log recibido para debugging
    try { console.log('crearAvance: datos recibidos ->', JSON.stringify(datos)); } catch (e) { /* ignore */ }

    // Mapear campos explícitamente y aceptar variantes de nombres
    const complete = {
      avance_id: id,
      actividad_id: (datos && (datos.actividad_id || datos.actividad || datos.activity_id || datos.id)) || '',
      anio: (datos && (datos.anio || datos.year)) || (new Date().getFullYear()).toString(),
      bimestre_id: (datos && (datos.bimestre_id || datos.bimestre)) || '',
      logro_valor: (datos && (datos.logro_valor !== undefined && datos.logro_valor !== null && datos.logro_valor !== '')) ? Number(datos.logro_valor) : '',
      presupuesto_ejecutado_bimestre: (datos && (datos.presupuesto_ejecutado_bimestre !== undefined && datos.presupuesto_ejecutado_bimestre !== null && datos.presupuesto_ejecutado_bimestre !== '')) ? Number(datos.presupuesto_ejecutado_bimestre) : '',
      avances_texto: (datos && (datos.avances_texto || datos.avances || datos.avance_texto)) || '',
      dificultades_texto: (datos && (datos.dificultades_texto || datos.dificultad_texto || datos.dificultades)) || '',
      evidencia_url: (datos && (datos.evidencia_url || datos.evidence || datos.evidencia)) || '',
      fecha_reporte: fechaReporte,
      reportado_por: (datos && (datos.reportado_por || datos.creado_por || datos.usuario || datos.email)) || '',
      creado_en: nowISO
    };

    // Obtener o crear la hoja de avances usando headers canónicos
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, ADVANCE_HEADERS);

    // Si la hoja no tiene headers escritos en la primera fila, escribirlos explícitamente
    const lastCol = Math.max(sheet.getLastColumn(), ADVANCE_HEADERS.length);
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    const existingHeaders = (lastCol > 0) ? headerRange.getValues()[0] : [];
    const headerMismatch = ADVANCE_HEADERS.some((h, i) => String(existingHeaders[i] || '').trim() !== String(h).trim());
    if (sheet.getLastRow() === 0 || headerMismatch) {
      sheet.getRange(1, 1, 1, ADVANCE_HEADERS.length).setValues([ADVANCE_HEADERS]);
    }

    // Preparar fila en el mismo orden de ADVANCE_HEADERS
    const rowData = ADVANCE_HEADERS.map(h => {
      const v = complete[h];
      return (v === null || typeof v === 'undefined') ? '' : v;
    });

    // Insertar la fila y retornar el registro creado
    sheet.appendRow(rowData);

    return formatResponse(true, complete, 'Avance creado correctamente');
  } catch (e) {
    console.error('Error en crearAvance:', e);
    return formatResponse(false, null, '', `Error guardando avance: ${e && e.message ? e.message : e}`);
  }
}

function obtenerAvances(filter) {
  try {
    // Leer la hoja de Avances y devolver objetos
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const objects = readSheetAsObjects(sheetName, false);

    // Opcional: aplicar filtro simple por actividad_id o reportado_por si se solicita
    let results = objects;
    if (filter && typeof filter === 'object') {
      if (filter.actividad_id) {
        results = results.filter(r => r.actividad_id === filter.actividad_id);
      }
      if (filter.reportado_por) {
        results = results.filter(r => r.reportado_por === filter.reportado_por);
      }
    }

    return formatResponse(true, results, 'Lista de avances');
  } catch (e) {
    console.error('Error en obtenerAvances:', e);
    return formatResponse(false, null, '', 'Error obteniendo avances');
  }
}

/**
 * Reescribe la fila de headers en la hoja 'Avances' usando ADVANCE_HEADERS
 * Útil para corregir cabeceras mal formadas (ej: celda vacía al final).
 */
function fixAvancesHeaders() {
  try {
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, ADVANCE_HEADERS);

    // Sobrescribir la primera fila con los headers canónicos
    sheet.getRange(1, 1, 1, ADVANCE_HEADERS.length).setValues([ADVANCE_HEADERS]);

    return formatResponse(true, { headers: ADVANCE_HEADERS }, 'Headers reescritos correctamente');
  } catch (e) {
    console.error('fixAvancesHeaders error', e);
    return formatResponse(false, null, '', 'Error reescribiendo headers');
  }
}

/**
 * Elimina filas de la hoja Avances que coincidan con ciertos patrones de prueba.
 * Si no se especifica payload, eliminará filas donde actividad_id comienza con 'ACT-TEST'.
 * Payload opcional: { actividad_prefix: 'ACT-TEST' }
 */
function cleanupTestRows(payload) {
  try {
    const prefix = payload && payload.actividad_prefix ? String(payload.actividad_prefix) : 'ACT-TEST';
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, ADVANCE_HEADERS);

    const range = sheet.getDataRange();
    const values = range.getValues();
    if (!values || values.length <= 1) return formatResponse(true, { deleted: 0 }, 'No hay filas para procesar');

    const headers = values[0] || [];
    const activityCol = headers.findIndex(h => h === 'actividad_id');
    if (activityCol === -1) return formatResponse(false, null, '', "Columna 'actividad_id' no encontrada");

    let deleted = 0;
    // Iterar de abajo hacia arriba para eliminar sin romper índices
    for (let r = values.length - 1; r >= 1; r--) {
      const cell = String(values[r][activityCol] || '');
      if (cell.indexOf(prefix) === 0) {
        sheet.deleteRow(r + 1); // rango values está offset por 1 (headers)
        deleted++;
      }
    }

    return formatResponse(true, { deleted: deleted }, `Filas eliminadas que comenzaban con '${prefix}'`);
  } catch (e) {
    console.error('cleanupTestRows error', e);
    return formatResponse(false, null, '', 'Error limpiando filas de prueba');
  }
}

/**
 * Debug helper: devuelve información sobre el spreadsheet y la hoja 'Avances'
 */
function debugAvancesStatus() {
  try {
    const ssId = SYSTEM_CONFIG && SYSTEM_CONFIG.SPREADSHEET_ID ? SYSTEM_CONFIG.SPREADSHEET_ID : null;
    if (!ssId) return formatResponse(false, null, '', 'SPREADSHEET_ID no configurado');

    const ss = SpreadsheetApp.openById(ssId);
    const sheetNames = ss.getSheets().map(s => s.getName());

    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return formatResponse(true, { spreadsheetId: ssId, sheetNames: sheetNames, message: `Sheet '${sheetName}' not found` }, 'Debug status');

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    const headers = headerRange.getValues()[0];

    // Get last up to 5 rows of data
    const fromRow = Math.max(2, lastRow - 4);
    let data = [];
    if (lastRow >= 2) {
      const rows = sheet.getRange(fromRow, 1, lastRow - fromRow + 1, lastCol).getValues();
      data = rows.map(r => r);
    }

    return formatResponse(true, { spreadsheetId: ssId, sheetNames: sheetNames, sheetName: sheetName, headers: headers, lastRow: lastRow, previewRows: data }, 'Debug status');
  } catch (e) {
    console.error('debugAvancesStatus error', e);
    return formatResponse(false, null, '', 'Error running debug status');
  }
}

function eliminarAvance(payload) {
  try {
    const id = payload && (payload.avance_id || payload.id);
    if (!id) return formatResponse(false, null, '', 'avance_id requerido');

    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, []);

    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0] || [];
    const idCol = headers.findIndex(h => h === 'avance_id');
    if (idCol === -1) return formatResponse(false, null, '', "Columna 'avance_id' no encontrada");

    let foundRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(id)) { foundRow = i + 1; break; }
    }

    if (foundRow === -1) return formatResponse(false, null, '', 'avance_id no encontrado');

    sheet.deleteRow(foundRow);
    return formatResponse(true, { avance_id: id }, 'Avance eliminado');
  } catch (e) {
    console.error('eliminarAvance error', e);
    return formatResponse(false, null, '', 'Error eliminando avance');
  }
}
