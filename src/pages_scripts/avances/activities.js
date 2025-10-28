import { BIMESTRES_LIST } from './constants.js';
import { parseNumericValue } from './formatters.js';
import { resolveBimestreLocal, normalizeStringLocal } from './utils.js';
import { avancesState } from './state.js';

export function normalizeActividadForAvances(raw) {
  if (!raw) return null;
  const idCandidate = raw.actividad_id ?? raw.id ?? raw.codigo ?? raw.code ?? raw._id;
  if (!idCandidate) return null;

  const id = String(idCandidate);
  const descripcion = raw.descripcion_actividad ?? raw.descripcion ?? raw.nombre ?? raw.titulo ?? `Actividad ${id}`;
  const codigo = raw.codigo ? String(raw.codigo).trim() : id;
  const area = raw.area_nombre ?? raw.area ?? raw.areaNombre ?? raw.area_label ?? raw.areaDescripcion ?? raw.areaDescripcionTexto ?? '';
  const subproceso = raw.subproceso_nombre ?? raw.subproceso ?? raw.subprocesoNombre ?? raw.subprocesoDescripcion ?? '';
  const metaPlanRaw = parseNumericValue(raw.meta_indicador_valor ?? raw.meta_valor ?? raw.meta_indicador ?? raw.meta ?? raw.metaTotal ?? raw.meta_indicador);
  const presupuestoPlanRaw = parseNumericValue(raw.presupuesto_programado ?? raw.presupuesto ?? raw.presupuestoTotal ?? raw.presupuesto_indicador);
  const rawBimestres = Array.isArray(raw.bimestres) ? raw.bimestres : [];

  const normalizedBimestres = BIMESTRES_LIST.map(def => {
    const found = rawBimestres.find(item => {
      if (!item) return false;
      const baseValue = item.bimestre ?? item.bimestre_nombre ?? item.label ?? item.nombre ?? item.ciclo ?? item.codigo ?? item.periodo;
      const resolved = resolveBimestreLocal(baseValue ?? item.index ?? item.numero ?? '');
      if (resolved.index && String(resolved.index) === String(def.index)) return true;
      if (resolved.label && normalizeStringLocal(resolved.label) === normalizeStringLocal(def.label)) return true;
      const indexCandidate = item.index ?? item.numero ?? item.bimestre_index ?? item.bimestreId ?? item.codigo;
      if (indexCandidate && String(indexCandidate) === String(def.index)) return true;
      return false;
    }) || null;

    const resolved = found
      ? resolveBimestreLocal(found.bimestre ?? found.bimestre_nombre ?? found.label ?? found.nombre ?? found.index ?? found.numero ?? found.codigo)
      : { index: String(def.index), label: def.label };

    const meta = found ? parseNumericValue(found.meta ?? found.meta_programada ?? found.meta_programada_bimestre ?? found.valor ?? found.total ?? found.metaPlaneada) : null;
    const presupuesto = found ? parseNumericValue(found.presupuesto ?? found.presupuesto_programado ?? found.presupuesto_bimestre ?? found.budget ?? found.presupuestoPlaneado) : null;
    const descripcionDetalle = found?.descripcion ?? found?.descripcion_detalle ?? found?.detalle ?? found?.entregables ?? found?.comentarios ?? '';

    return {
      index: resolved.index || String(def.index),
      label: resolved.label || def.label,
      meta,
      presupuesto,
      descripcion: descripcionDetalle ? descripcionDetalle.toString().trim() : '',
      raw: found || null
    };
  });

  const metaPlan = Number.isFinite(metaPlanRaw)
    ? metaPlanRaw
    : normalizedBimestres.reduce((acc, item) => acc + (Number.isFinite(item.meta) ? item.meta : 0), 0);
  const presupuestoPlan = Number.isFinite(presupuestoPlanRaw)
    ? presupuestoPlanRaw
    : normalizedBimestres.reduce((acc, item) => acc + (Number.isFinite(item.presupuesto) ? item.presupuesto : 0), 0);

  return {
    id,
    codigo,
    descripcion,
    area,
    subproceso,
    metaPlan,
    presupuestoPlan,
    bimestres: normalizedBimestres,
    raw
  };
}

export function resolveActivityByAnyReference(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  if (avancesState.actividadesIndex.has(text)) {
    return avancesState.actividadesIndex.get(text);
  }

  const normalized = normalizeStringLocal(text);
  if (avancesState.actividadesCodigoIndex.has(normalized)) {
    const id = avancesState.actividadesCodigoIndex.get(normalized);
    return avancesState.actividadesIndex.get(id) || null;
  }

  for (const activity of avancesState.actividades) {
    if (!activity) continue;
    if (activity.codigo && normalizeStringLocal(activity.codigo) === normalized) {
      return activity;
    }
    if (activity.descripcion && normalizeStringLocal(activity.descripcion) === normalized) {
      return activity;
    }
  }

  return null;
}
