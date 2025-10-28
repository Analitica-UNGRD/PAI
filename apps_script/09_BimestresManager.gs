/**
 * 09_BimestresManager.gs - Gestión de presupuestos por bimestre
 */

const BIMESTRES_HEADERS = Object.freeze([
  'actividad_id',
  'codigo',
  'bimestre',
  'presupuesto',
  'meta',
  'descripcion',
  'creado_el',
  'actualizado_el'
]);

const BIMESTRES_DEFINITION = Object.freeze([
  { index: 1, label: 'Enero-Febrero', shortLabel: 'Bimestre 1', aliases: ['enero febrero', 'b1', 'bimestre 1'] },
  { index: 2, label: 'Marzo-Abril', shortLabel: 'Bimestre 2', aliases: ['marzo abril', 'b2', 'bimestre 2'] },
  { index: 3, label: 'Mayo-Junio', shortLabel: 'Bimestre 3', aliases: ['mayo junio', 'b3', 'bimestre 3'] },
  { index: 4, label: 'Julio-Agosto', shortLabel: 'Bimestre 4', aliases: ['julio agosto', 'b4', 'bimestre 4'] },
  { index: 5, label: 'Septiembre-Octubre', shortLabel: 'Bimestre 5', aliases: ['septiembre octubre', 'b5', 'bimestre 5'] },
  { index: 6, label: 'Noviembre-Diciembre', shortLabel: 'Bimestre 6', aliases: ['noviembre diciembre', 'b6', 'bimestre 6'] }
]);

function getBimestresDefinition() {
  return BIMESTRES_DEFINITION.map(item => ({ ...item }));
}

function ensureBimestresSheet() {
  const sheet = getOrCreateSheet(SYSTEM_CONFIG.SHEETS.BIMESTRES, BIMESTRES_HEADERS);

  try {
    enforceBimestresStructure(sheet);
  } catch (error) {
    console.error('Error asegurando encabezados de bimestres:', error);
  }

  return sheet;
}

function enforceBimestresStructure(sheet) {
  if (!sheet) return;

  const requiredColumns = BIMESTRES_HEADERS.length;
  const currentMaxColumns = sheet.getMaxColumns();

  if (currentMaxColumns < requiredColumns) {
    sheet.insertColumnsAfter(currentMaxColumns, requiredColumns - currentMaxColumns);
  } else if (currentMaxColumns > requiredColumns) {
    sheet.deleteColumns(requiredColumns + 1, currentMaxColumns - requiredColumns);
  }

  const headerRange = sheet.getRange(1, 1, 1, requiredColumns);
  const currentHeaders = headerRange.getValues()[0] || [];

  let needsUpdate = currentHeaders.length !== requiredColumns;
  if (!needsUpdate) {
    for (let i = 0; i < requiredColumns; i++) {
      const expected = BIMESTRES_HEADERS[i];
      const existing = (currentHeaders[i] || '').toString().trim();
      if (existing !== expected) {
        needsUpdate = true;
        break;
      }
    }
  }

  if (needsUpdate) {
    headerRange.setValues([BIMESTRES_HEADERS]);
  }
}

function readBimestresRecords() {
  const sheet = ensureBimestresSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const range = sheet.getRange(1, 1, lastRow, BIMESTRES_HEADERS.length);
  const values = range.getValues();
  const headers = values[0].map(header => (header || '').toString().trim().toLowerCase());
  const records = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(cell => cell === '' || cell === null)) {
      continue;
    }

    const record = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      record[header] = row[idx];
    });

    if (record.actividad_id) {
      record.actividad_id = record.actividad_id.toString();
      record.codigo = record.codigo ? record.codigo.toString() : '';
      record.descripcion = normalizeDescriptionValue(record.descripcion || '');
      records.push(record);
    }
  }

  return records;
}

function createEmptyBimestres() {
  return getBimestresDefinition().map(def => ({
    index: def.index,
    codigo: '',
    bimestre: def.label,
    presupuesto: 0,
    meta: 0,
    descripcion: '',
    creado_el: '',
    actualizado_el: ''
  }));
}

function normalizeBudgetValue(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) return 0;
    return roundCurrency(value);
  }

  let str = value.toString().trim();
  if (!str) return 0;

  str = str.replace(/[^0-9,.-]/g, '');
  if (!str) return 0;

  const hasComma = str.indexOf(',') !== -1;
  const hasPeriod = str.indexOf('.') !== -1;

  if (hasComma && hasPeriod) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (hasComma) {
    str = str.replace(/\./g, '').replace(/,/g, '.');
  }

  const num = Number(str);
  if (Number.isNaN(num) || !isFinite(num)) {
    return 0;
  }

  return roundCurrency(num);
}

function normalizeMetaValue(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  let str = value.toString().trim();
  if (!str) return 0;

  str = str.replace(/[^0-9,.-]/g, '');
  if (!str) return 0;

  const hasComma = str.indexOf(',') !== -1;
  const hasPeriod = str.indexOf('.') !== -1;

  if (hasComma && hasPeriod) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (hasComma) {
    str = str.replace(/\./g, '').replace(/,/g, '.');
  }

  const num = Number(str);
  if (Number.isNaN(num) || !isFinite(num)) {
    return 0;
  }

  return Math.round(num * 100) / 100;
}

function normalizeDescriptionValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    const parts = value
      .map(item => normalizeDescriptionValue(item))
      .filter(text => text && text.trim().length);
    return parts.join('\n');
  }

  if (typeof value === 'object') {
    const textKeys = [
      'descripcion',
      'descripcion_detalle',
      'descripcionDetallada',
      'detalle',
      'detalleDescripcion',
      'description',
      'label',
      'nombre',
      'titulo',
      'texto',
      'tipo',
      'categoria'
    ];

    const amountKeys = ['cantidad', 'meta', 'valor', 'total'];
    const segments = [];

    for (let i = 0; i < textKeys.length; i++) {
      const key = textKeys[i];
      if (value[key]) {
        segments.push(value[key].toString().trim());
        break;
      }
    }

    for (let j = 0; j < amountKeys.length; j++) {
      const key = amountKeys[j];
      if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
        const amount = normalizeMetaValue(value[key]);
        if (!Number.isNaN(amount) && amount !== 0) {
          segments.push(`Cantidad: ${formatNumberForMessages(amount)}`);
          break;
        }
      }
    }

    if (!segments.length) {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return value.toString().trim();
      }
    }

    return segments.join(' - ');
  }

  return value.toString().trim();
}

function collectDescripcionFromBimestreInput(raw) {
  if (raw === null || raw === undefined) {
    return '';
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return normalizeDescriptionValue(raw);
  }

  const segments = [];
  const primaryKeys = [
    'descripcion',
    'descripcion_detalle',
    'descripcionDetallada',
    'descripcion_detallada',
    'descripcionProgramada',
    'descripcion_programada',
    'description',
    'detalle',
    'detalleDescripcion',
    'detalleDescripcionProgramada',
    'descripcion_meta',
    'meta_descripcion',
    'metaDescripcion',
    'observaciones',
    'notas'
  ];

  for (let i = 0; i < primaryKeys.length; i++) {
    const key = primaryKeys[i];
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      segments.push(normalizeDescriptionValue(raw[key]));
    }
  }

  const detailKeys = [
    'detalles',
    'detalle_items',
    'detalleItems',
    'entregables',
    'breakdown',
    'breakdowns',
    'desglose',
    'desgloses',
    'items'
  ];

  for (let j = 0; j < detailKeys.length; j++) {
    const key = detailKeys[j];
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      segments.push(normalizeDescriptionValue(raw[key]));
    }
  }

  if (!segments.length) {
    return '';
  }

  const cleaned = [];
  const seen = {};

  for (let k = 0; k < segments.length; k++) {
    const piece = segments[k] ? segments[k].trim() : '';
    if (piece && !seen[piece]) {
      cleaned.push(piece);
      seen[piece] = true;
    }
  }

  return cleaned.join('\n');
}

function extractNumbersFromDescription(text) {
  if (text === null || text === undefined) {
    return [];
  }

  let content = text;
  if (typeof content !== 'string') {
    try {
      content = JSON.stringify(content);
    } catch (error) {
      content = String(content);
    }
  }

  if (!content) {
    return [];
  }

  const matches = content.match(/\d+(?:[.,]\d+)?/g);
  if (!matches) {
    return [];
  }

  const numbers = [];
  for (let i = 0; i < matches.length; i++) {
    const numeric = matches[i].replace(/\./g, '').replace(/,/g, '.');
    const parsed = Number(numeric);
    if (!Number.isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
      numbers.push(Math.round(parsed * 100) / 100);
    }
  }

  return numbers;
}

function roundCurrency(value) {
  const num = Number(value);
  if (Number.isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function formatCurrencyForMessages(value) {
  try {
    return roundCurrency(value).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  } catch (error) {
    return `$${roundCurrency(value)}`;
  }
}

function formatNumberForMessages(value) {
  try {
    const numero = Number(value) || 0;
    return numero.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  } catch (error) {
    const num = Number(value) || 0;
    return num.toFixed(2);
  }
}

function resolveBimestreIndexFromLabel(label, definition) {
  if (!label) return null;
  const normalized = normalizeText(label);
  for (let i = 0; i < definition.length; i++) {
    const def = definition[i];
    if (normalizeText(def.label) === normalized) {
      return def.index;
    }
    if (def.shortLabel && normalizeText(def.shortLabel) === normalized) {
      return def.index;
    }
    if (Array.isArray(def.aliases)) {
      for (let j = 0; j < def.aliases.length; j++) {
        if (normalizeText(def.aliases[j]) === normalized) {
          return def.index;
        }
      }
    }
  }
  return null;
}

function resolveBimestreIndexFromInput(item, definition) {
  if (!item) return null;

  if (Object.prototype.hasOwnProperty.call(item, 'index')) {
    const idx = Number(item.index);
    if (!Number.isNaN(idx) && idx >= 1 && idx <= definition.length) {
      return idx;
    }
  }

  if (Object.prototype.hasOwnProperty.call(item, 'bimestre_index')) {
    const idx = Number(item.bimestre_index);
    if (!Number.isNaN(idx) && idx >= 1 && idx <= definition.length) {
      return idx;
    }
  }

  const candidates = [];
  ['bimestre', 'label', 'nombre', 'periodo'].forEach(prop => {
    if (item[prop]) {
      candidates.push(item[prop]);
    }
  });

  for (let i = 0; i < candidates.length; i++) {
    const idx = resolveBimestreIndexFromLabel(candidates[i], definition);
    if (idx) return idx;
  }

  return null;
}

function validateBimestreDistribution(bimestresInput, totalBudget, options = {}) {
  const definition = getBimestresDefinition();
  const requireCompleteSet = options.requireCompleteSet !== false;
  const tolerance = typeof options.tolerance === 'number' ? Math.max(options.tolerance, 0.0001) : 0.01;
  const metaTolerance = typeof options.metaTolerance === 'number' ? Math.max(options.metaTolerance, 0.0001) : tolerance;

  const errors = [];
  const normalized = createEmptyBimestres();

  if (!Array.isArray(bimestresInput) || (requireCompleteSet && bimestresInput.length < definition.length)) {
    if (requireCompleteSet) {
      errors.push(`Debe proporcionar información para los ${definition.length} bimestres del año`);
    }
  }

  const mapping = {};
  if (Array.isArray(bimestresInput)) {
    bimestresInput.forEach(item => {
      if (!item) return;
      const idx = resolveBimestreIndexFromInput(item, definition);
      if (idx) {
        mapping[idx] = item;
      }
    });
  }

  for (let i = 0; i < definition.length; i++) {
    const def = definition[i];
    const raw = mapping[def.index] || (Array.isArray(bimestresInput) ? bimestresInput[i] : null) || {};
    const presupuesto = normalizeBudgetValue(raw.presupuesto ?? raw.valor ?? raw.monto ?? 0);
    const meta = normalizeMetaValue(raw.meta ?? raw.meta_programada ?? raw.metaProgramada ?? raw.meta_bimestre ?? 0);
    const descripcion = collectDescripcionFromBimestreInput(raw);
    const descripcionNumeros = extractNumbersFromDescription(descripcion);
    const descripcionTotal = Math.round(descripcionNumeros.reduce((acc, value) => acc + normalizeMetaValue(value), 0) * 100) / 100;
    if (presupuesto < 0 || meta < 0) {
      errors.push(`El presupuesto o la meta del ${def.shortLabel || def.label} no pueden ser negativos`);
    }

    if (meta <= 0 && descripcionTotal > 0) {
      errors.push(`La descripción del ${def.shortLabel || def.label} registra ${formatNumberForMessages(descripcionTotal)} entregables, pero la meta programada es 0.`);
    } else if (descripcionTotal > meta + metaTolerance) {
      errors.push(`La descripción del ${def.shortLabel || def.label} suma ${formatNumberForMessages(descripcionTotal)} entregables y excede la meta programada de ${formatNumberForMessages(meta)}.`);
    }

    normalized[i] = {
      index: def.index,
      codigo: raw.codigo ? raw.codigo.toString() : '',
      bimestre: def.label,
      presupuesto: presupuesto,
      meta: meta,
      descripcion: descripcion,
      descripcion_total: descripcionTotal,
      creado_el: raw.creado_el || '',
      actualizado_el: raw.actualizado_el || ''
    };
  }

  const sum = sumBimestres(normalized);
  const metaSum = sumMetaBimestres(normalized);
  const budget = normalizeBudgetValue(totalBudget);
  const totalMetaOption = Object.prototype.hasOwnProperty.call(options, 'totalMeta')
    ? options.totalMeta
    : options.metaTotal;
  const metaTotal = normalizeMetaValue(totalMetaOption);
  const metaDifference = Math.round((metaSum - metaTotal) * 100) / 100;

  if (budget < 0) {
    errors.push('El presupuesto programado no puede ser negativo');
  }

  if (metaTotal < 0) {
    errors.push('La meta del indicador no puede ser negativa');
  }

  if (Math.abs(sum - budget) > tolerance) {
    if (sum < budget) {
      errors.push(`La distribución por bimestres es menor al presupuesto programado por ${formatCurrencyForMessages(budget - sum)}`);
    } else {
      errors.push(`La distribución por bimestres excede el presupuesto programado en ${formatCurrencyForMessages(sum - budget)}`);
    }
  }

  if (Math.abs(metaDifference) > metaTolerance) {
    if (metaSum < metaTotal) {
      errors.push(`La suma de la meta programada por bimestres es menor a la meta del indicador por ${formatNumberForMessages(metaTotal - metaSum)}`);
    } else {
      errors.push(`La suma de la meta programada por bimestres excede la meta del indicador en ${formatNumberForMessages(metaSum - metaTotal)}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    bimestres: normalized,
    total: budget,
    sum: sum,
    difference: roundCurrency(sum - budget),
    metaTotal: metaTotal,
    metaSum: metaSum,
    metaDifference: metaDifference
  };
}

function getBimestresMapByActivity() {
  const definition = getBimestresDefinition();
  const records = readBimestresRecords();
  const grouped = {};

  records.forEach(record => {
    const actividadId = (record.actividad_id || '').toString();
    if (!actividadId) return;

    if (!grouped[actividadId]) {
      grouped[actividadId] = createEmptyBimestres();
    }

    const idx = resolveBimestreIndexFromLabel(record.bimestre, definition);
    if (!idx) return;

    const posicion = idx - 1;
    grouped[actividadId][posicion] = {
      index: idx,
      codigo: record.codigo ? record.codigo.toString() : '',
      bimestre: definition[posicion].label,
      presupuesto: normalizeBudgetValue(record.presupuesto),
      meta: normalizeMetaValue(record.meta),
      descripcion: normalizeDescriptionValue(record.descripcion || ''),
      creado_el: record.creado_el || '',
      actualizado_el: record.actualizado_el || ''
    };
  });

  return grouped;
}

function getBimestresForActivity(actividadId) {
  if (!actividadId) {
    return createEmptyBimestres();
  }
  const map = getBimestresMapByActivity();
  const key = actividadId.toString();
  if (!map[key]) {
    return createEmptyBimestres();
  }
  return map[key].map(item => ({ ...item }));
}

function sumBimestres(bimestres) {
  if (!Array.isArray(bimestres)) return 0;
  return roundCurrency(bimestres.reduce((acc, current) => acc + normalizeBudgetValue(current ? current.presupuesto : 0), 0));
}

function sumMetaBimestres(bimestres) {
  if (!Array.isArray(bimestres)) return 0;
  const total = bimestres.reduce((acc, current) => acc + normalizeMetaValue(current ? current.meta : 0), 0);
  return Math.round(total * 100) / 100;
}

function writeBimestresForActivity(actividadId, bimestres, options = {}) {
  if (!actividadId) {
    throw new Error('actividadId requerido para escribir bimestres');
  }

  const normalizedId = actividadId.toString();
  const definition = getBimestresDefinition();
  const sheet = ensureBimestresSheet();
  const records = readBimestresRecords();
  const otherRecords = records.filter(record => record.actividad_id !== normalizedId);
  const existingMap = {};

  records.forEach(record => {
    if (record.actividad_id === normalizedId) {
      const idx = resolveBimestreIndexFromLabel(record.bimestre, definition);
      if (idx) {
        existingMap[idx] = record;
      }
    }
  });

  const toCodigoString = (value) => {
    if (value === null || value === undefined) return '';
    try {
      const text = value.toString();
      return typeof text === 'string' ? text.trim() : '';
    } catch (error) {
      try {
        const fallback = String(value);
        return fallback.trim();
      } catch (innerError) {
        return '';
      }
    }
  };

  let codigoActividad = '';
  if (options && typeof options === 'object') {
    const optionKeys = ['codigo', 'activityCode', 'codigoActividad'];
    for (let i = 0; i < optionKeys.length; i++) {
      const candidate = toCodigoString(options[optionKeys[i]]);
      if (candidate) {
        codigoActividad = candidate;
        break;
      }
    }
  }

  if (!codigoActividad && typeof findRowByField === 'function') {
    try {
      const activityRecord = findRowByField(SYSTEM_CONFIG.SHEETS.ACTIVITIES, 'actividad_id', normalizedId);
      if (activityRecord) {
        const activityKeys = ['codigo', 'codigo_actividad', 'codigoActividad', 'actividad_id'];
        for (let j = 0; j < activityKeys.length; j++) {
          const candidate = toCodigoString(activityRecord[activityKeys[j]]);
          if (candidate) {
            codigoActividad = candidate;
            break;
          }
        }
      }
    } catch (lookupError) {
      console.warn('writeBimestresForActivity: no se pudo resolver codigo para actividad', lookupError);
    }
  }

  if (!codigoActividad) {
    codigoActividad = normalizedId;
  }

  const resolveCodigoForRow = (data, previous) => {
    const candidates = [
      data && data.codigo,
      data && data.activityCode,
      data && data.codigoActividad,
      previous && previous.codigo,
      codigoActividad
    ];
    for (let k = 0; k < candidates.length; k++) {
      const candidate = toCodigoString(candidates[k]);
      if (candidate) {
        return candidate;
      }
    }
    return codigoActividad;
  };

  const normalizedBimestres = Array.isArray(bimestres) ? bimestres : createEmptyBimestres();
  const now = new Date();

  const preservedRows = otherRecords.map(record => ([
    record.actividad_id,
    toCodigoString(record.codigo) || toCodigoString(record.actividad_id),
    record.bimestre,
    normalizeBudgetValue(record.presupuesto),
    normalizeMetaValue(record.meta),
    normalizeDescriptionValue(record.descripcion || ''),
    record.creado_el || '',
    record.actualizado_el || ''
  ]));

  const newRows = definition.map(def => {
    const byIndex = normalizedBimestres.find(item => Number(item.index) === def.index);
    const fallback = normalizedBimestres[def.index - 1];
    const data = byIndex || fallback || { presupuesto: 0 };
    const previous = existingMap[def.index];
    const createdAt = previous && previous.creado_el ? previous.creado_el : now;
    const descripcionFuente = data.descripcion ?? data.description ?? data.detalle ?? data.descripcion_detalle ?? data.descripcionDetallada ?? data.breakdown ?? '';
    const descripcion = normalizeDescriptionValue(descripcionFuente);

    return [
      normalizedId,
      resolveCodigoForRow(data, previous),
      def.label,
      normalizeBudgetValue(data.presupuesto),
      normalizeMetaValue(data.meta),
      descripcion,
      createdAt,
      now
    ];
  });

  const finalRows = preservedRows.concat(newRows);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, BIMESTRES_HEADERS.length).setValues([BIMESTRES_HEADERS]);
  if (finalRows.length) {
    sheet.getRange(2, 1, finalRows.length, BIMESTRES_HEADERS.length).setValues(finalRows);
  }
}

function deleteBimestresForActivity(actividadId) {
  if (!actividadId) return;
  const normalizedId = actividadId.toString();
  const sheet = ensureBimestresSheet();
  const records = readBimestresRecords();
  const remaining = records.filter(record => record.actividad_id !== normalizedId);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, BIMESTRES_HEADERS.length).setValues([BIMESTRES_HEADERS]);
  if (remaining.length) {
    const rows = remaining.map(record => ([
      record.actividad_id,
      record.codigo ? record.codigo.toString() : (record.actividad_id ? record.actividad_id.toString() : ''),
      record.bimestre,
      normalizeBudgetValue(record.presupuesto),
      normalizeMetaValue(record.meta),
      normalizeDescriptionValue(record.descripcion || ''),
      record.creado_el || '',
      record.actualizado_el || ''
    ]));
    sheet.getRange(2, 1, rows.length, BIMESTRES_HEADERS.length).setValues(rows);
  }
}
