import { BIMESTRES_LIST } from './constants.js';

export function normalizeStringLocal(value) {
  if (value === null || value === undefined) return '';
  try {
    return value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_/]+/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return value.toString().toLowerCase().trim();
  }
}

export function resolveBimestreLocal(input) {
  if (input === null || input === undefined) {
    return { index: '', label: '' };
  }

  if (typeof input === 'object') {
    const candidateIndex = input.index ?? input.numero ?? input.id ?? input.value;
    if (candidateIndex) {
      const resolvedByIndex = resolveBimestreLocal(candidateIndex);
      if (resolvedByIndex.index) return resolvedByIndex;
    }

    const candidateLabel = input.label ?? input.nombre ?? input.periodo ?? input.descripcion;
    if (candidateLabel) {
      const resolvedByLabel = resolveBimestreLocal(candidateLabel);
      if (resolvedByLabel.index) return resolvedByLabel;
    }
  }

  const rawText = String(input).trim();
  if (!rawText) {
    return { index: '', label: '' };
  }

  const normalized = normalizeStringLocal(rawText);
  if (!normalized) {
    return { index: '', label: rawText };
  }

  const numericMatch = normalized.match(/\b([1-6])\b/);
  if (numericMatch) {
    const idx = numericMatch[1];
    const def = BIMESTRES_LIST.find(item => String(item.index) === String(idx));
    if (def) {
      return { index: String(def.index), label: def.label };
    }
  }

  const ordinalKeywords = new Map([
    ['primer', '1'],
    ['primero', '1'],
    ['1er', '1'],
    ['uno', '1'],
    ['segundo', '2'],
    ['segund', '2'],
    ['2do', '2'],
    ['dos', '2'],
    ['tercero', '3'],
    ['tercer', '3'],
    ['3er', '3'],
    ['tres', '3'],
    ['cuarto', '4'],
    ['cuart', '4'],
    ['cuatro', '4'],
    ['quinto', '5'],
    ['cinco', '5'],
    ['sexto', '6'],
    ['seis', '6']
  ]);

  for (const [keyword, indexValue] of ordinalKeywords.entries()) {
    if (normalized.includes(keyword)) {
      const def = BIMESTRES_LIST.find(item => String(item.index) === indexValue);
      if (def) {
        return { index: String(def.index), label: def.label };
      }
    }
  }

  for (const def of BIMESTRES_LIST) {
    const normalizedLabel = normalizeStringLocal(def.label);
    if (normalized === normalizedLabel) {
      return { index: String(def.index), label: def.label };
    }

    if (Array.isArray(def.aliases) && def.aliases.some(alias => normalizeStringLocal(alias) === normalized)) {
      return { index: String(def.index), label: def.label };
    }

    if (normalized.includes(normalizedLabel)) {
      return { index: String(def.index), label: def.label };
    }
  }

  const monthGroups = [
    { index: '1', months: ['enero', 'febrero'] },
    { index: '2', months: ['marzo', 'abril'] },
    { index: '3', months: ['mayo', 'junio'] },
    { index: '4', months: ['julio', 'agosto'] },
    { index: '5', months: ['septiembre', 'octubre'] },
    { index: '6', months: ['noviembre', 'diciembre'] }
  ];

  for (const group of monthGroups) {
    const matchesAll = group.months.every(month => normalized.includes(month));
    if (matchesAll) {
      const def = BIMESTRES_LIST.find(item => String(item.index) === group.index);
      if (def) {
        return { index: String(def.index), label: def.label };
      }
    }
  }

  return { index: '', label: rawText };
}

export function generateAvanceId() {
  return `av_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readInitialSelectionFromURL() {
  if (typeof window === 'undefined' || !window.location) {
    return { activityValue: '', openModal: false, bimestreRaw: '', bimestreSelectValue: '', bimestreIndex: '' };
  }
  try {
    const params = new URLSearchParams(window.location.search || '');
    const activityValue = params.get('actividad') || params.get('actividad_id') || params.get('codigo') || params.get('actividadCodigo') || '';
    const nuevoParam = (params.get('nuevo') || '').toLowerCase();
    const modalParam = (params.get('modal') || '').toLowerCase();
    const openModal = ['1', 'true', 'si', 'sí'].includes(nuevoParam) || ['nuevo', 'avance'].includes(modalParam);
    const bimestreRaw = params.get('bimestre')
      || params.get('bimestre_id')
      || params.get('bimestreIndex')
      || params.get('bimestre_numero')
      || '';
    const trimmedBimestre = bimestreRaw ? bimestreRaw.trim() : '';
    const bimestreResolved = trimmedBimestre ? resolveBimestreLocal(trimmedBimestre) : { index: '', label: '' };
    return {
      activityValue: activityValue ? activityValue.trim() : '',
      openModal,
      bimestreRaw: trimmedBimestre,
      bimestreSelectValue: bimestreResolved.label || '',
      bimestreIndex: bimestreResolved.index || ''
    };
  } catch (error) {
    console.warn('[WARN] No fue posible interpretar los parámetros iniciales de la URL:', error);
    return { activityValue: '', openModal: false, bimestreRaw: '', bimestreSelectValue: '', bimestreIndex: '' };
  }
}

export function updateURLWithSelection(activityId) {
  if (typeof window === 'undefined' || !window.history || !window.location) return;
  try {
    const url = new URL(window.location.href);
    if (activityId) {
      url.searchParams.set('actividad', activityId);
    } else {
      url.searchParams.delete('actividad');
    }
    url.searchParams.delete('nuevo');
    url.searchParams.delete('modal');
    url.searchParams.delete('bimestre');
    url.searchParams.delete('bimestre_id');
    url.searchParams.delete('bimestreIndex');
    url.searchParams.delete('bimestre_numero');
    url.searchParams.delete('origen');
    window.history.replaceState({}, '', url.toString());
  } catch (error) {
    console.warn('[WARN] No se pudo actualizar la URL con la actividad seleccionada:', error);
  }
}
