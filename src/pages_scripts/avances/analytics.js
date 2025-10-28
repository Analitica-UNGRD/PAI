import { avancesState } from './state.js';
import { normalizeStringLocal, resolveBimestreLocal } from './utils.js';
import { parseNumericValue } from './formatters.js';

function createEmptyBimestreEntry({ key, index = '', label = '' }) {
  return {
    key,
    index,
    label,
    registros: 0,
    totalMetaProgramada: 0,
    totalLogro: 0,
    totalPresupuesto: 0,
    planMeta: null,
    planPresupuesto: null
  };
}

function ensureActivityAnalytics(activity) {
  return {
    activityId: activity?.id || '',
    activity,
    registros: 0,
    totalLogro: 0,
    totalPresupuesto: 0,
    totalMetaProgramada: 0,
    bimestres: new Map()
  };
}

export function rebuildAvancesAnalytics() {
  const totalsByActivity = new Map();

  avancesState.actividades.forEach(activity => {
    if (!activity) return;
    const entry = ensureActivityAnalytics(activity);
    totalsByActivity.set(activity.id, entry);
    if (Array.isArray(activity.bimestres)) {
      activity.bimestres.forEach(bimestre => {
        if (!bimestre) return;
        const key = bimestre.index
          ? `idx:${bimestre.index}`
          : `label:${normalizeStringLocal(bimestre.label || '')}`;
        const bEntry = createEmptyBimestreEntry({
          key,
          index: bimestre.index || '',
          label: bimestre.label || ''
        });
        bEntry.planMeta = parseNumericValue(bimestre.meta);
        bEntry.planPresupuesto = parseNumericValue(bimestre.presupuesto);
        entry.bimestres.set(key, bEntry);
      });
    }
  });

  avancesState.avances.forEach(avance => {
    if (!avance || !avance.actividad_id) return;
    const actividadId = String(avance.actividad_id);
    const activity = avancesState.actividadesIndex.get(actividadId) || null;
    if (!totalsByActivity.has(actividadId)) {
      totalsByActivity.set(actividadId, ensureActivityAnalytics(activity));
    }
    const entry = totalsByActivity.get(actividadId);
    entry.registros += 1;
  entry.totalLogro += parseNumericValue(avance.logro_valor) || 0;
  entry.totalPresupuesto += parseNumericValue(avance.presupuesto_valor) || 0;
  entry.totalMetaProgramada += parseNumericValue(avance.meta_programada_bimestre) || 0;

    const resolved = resolveBimestreLocal(avance.bimestre_index || avance.bimestre_label || avance.bimestre_id || '');
    const key = resolved.index
      ? `idx:${resolved.index}`
      : `label:${normalizeStringLocal(resolved.label || avance.bimestre_label || '')}`;

    if (!entry.bimestres.has(key)) {
      entry.bimestres.set(key, createEmptyBimestreEntry({
        key,
        index: resolved.index || '',
        label: resolved.label || avance.bimestre_label || ''
      }));
    }

    const bEntry = entry.bimestres.get(key);
    bEntry.registros += 1;
  bEntry.totalMetaProgramada += parseNumericValue(avance.meta_programada_bimestre) || 0;
  bEntry.totalLogro += parseNumericValue(avance.logro_valor) || 0;
  bEntry.totalPresupuesto += parseNumericValue(avance.presupuesto_valor) || 0;

    if (bEntry.planMeta === null && activity && Array.isArray(activity.bimestres)) {
      const plan = activity.bimestres.find(item => {
        if (!item) return false;
        if (resolved.index && String(item.index) === String(resolved.index)) return true;
        if (resolved.label && normalizeStringLocal(item.label || '') === normalizeStringLocal(resolved.label)) return true;
        return false;
      });
      if (plan) {
        bEntry.planMeta = parseNumericValue(plan.meta);
        bEntry.planPresupuesto = parseNumericValue(plan.presupuesto);
      }
    }
  });

  avancesState.analytics = {
    totalsByActivity
  };
}

export function getActivityAnalytics(activityId) {
  if (!activityId) return null;
  const map = avancesState.analytics?.totalsByActivity;
  return map ? map.get(String(activityId)) || null : null;
}

export function getBimestreAnalytics(activityId, bimestreValue) {
  if (!activityId || !bimestreValue) return null;
  const activity = avancesState.actividadesIndex.get(String(activityId)) || null;
  const analytics = getActivityAnalytics(activityId) || ensureActivityAnalytics(activity);
  const resolved = resolveBimestreLocal(bimestreValue);
  const key = resolved.index
    ? `idx:${resolved.index}`
    : `label:${normalizeStringLocal(resolved.label || bimestreValue)}`;

  if (!analytics.bimestres.has(key)) {
    const fallback = createEmptyBimestreEntry({
      key,
      index: resolved.index || '',
      label: resolved.label || bimestreValue
    });
    if (activity && Array.isArray(activity.bimestres)) {
      const plan = activity.bimestres.find(item => {
        if (!item) return false;
        if (resolved.index && String(item.index) === String(resolved.index)) return true;
        if (resolved.label && normalizeStringLocal(item.label || '') === normalizeStringLocal(resolved.label)) return true;
        return false;
      });
      if (plan) {
        fallback.planMeta = parseNumericValue(plan.meta);
        fallback.planPresupuesto = parseNumericValue(plan.presupuesto);
      }
    }
    analytics.bimestres.set(key, fallback);
  }

  return analytics.bimestres.get(key);
}

export function getActividadPlan(activityId) {
  if (!activityId) return null;
  const activity = avancesState.actividadesIndex.get(String(activityId));
  if (!activity) return null;
  return {
    metaPlan: parseNumericValue(activity.metaPlan),
    presupuestoPlan: parseNumericValue(activity.presupuestoPlan)
  };
}
