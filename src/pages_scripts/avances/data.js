import { callBackend } from './api.js';
import { domRefs, avancesState, selectEnhancerContext } from './state.js';
import { normalizeActividadForAvances, resolveActivityByAnyReference } from './activities.js';
import { normalizeStringLocal } from './utils.js';
import { syncFilterStateFromUI, applyAvancesFilters } from './filters.js';
import { updateModalActivityContext, refreshModalActivitySelect } from './ui.js';
import { normalizeAvance } from './records.js';
import { coincideAreaUsuario } from '../actividades/utils.js';
import { rebuildAvancesAnalytics } from './analytics.js';

function actividadCoincideConArea(activity, areaReferencia) {
  const referencia = typeof areaReferencia === 'string' ? areaReferencia.trim() : '';
  if (!activity || !referencia) return false;

  const comparables = [
    activity.area,
    activity.raw?.area,
    activity.raw?.area_nombre,
    activity.raw?.areaNombre,
    activity.raw?.area_label,
    activity.raw?.areaDescripcion,
    activity.raw?.area_descripcion,
    activity.raw?.areaCodigo,
    activity.raw?.area_codigo,
    activity.raw?.area_id,
    activity.raw?.areaId,
    activity.raw?.codigo_area,
    activity.raw?.id_area
  ];

  return coincideAreaUsuario(referencia, comparables);
}

export async function loadActividades({ restringirPorArea = false, areaAsignada = '' } = {}) {
  if (domRefs.modal.actividadSelect) {
    domRefs.modal.actividadSelect.innerHTML = '<option value="">Cargando actividades...</option>';
    domRefs.modal.actividadSelect.disabled = true;
    selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.modal.actividadSelect.id);
  }
  if (domRefs.filters.actividad) {
    domRefs.filters.actividad.innerHTML = '<option value="">Todas las actividades</option>';
    selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.filters.actividad.id);
  }

  try {
    const response = await callBackend('actividades/obtener', { incluir_catalogos: true });
    const listaActividades = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : [];

    const normalizedList = listaActividades
      .map(item => normalizeActividadForAvances(item))
      .filter(Boolean);

    const aplicarRestriccion = restringirPorArea && typeof areaAsignada === 'string' && areaAsignada.trim() !== '';
    const filteredActivities = aplicarRestriccion
      ? normalizedList.filter(activity => actividadCoincideConArea(activity, areaAsignada))
      : normalizedList;

    avancesState.actividades = filteredActivities;
    avancesState.actividadesIndex.clear();
    avancesState.actividadesCodigoIndex.clear();

    filteredActivities.forEach(activity => {
      avancesState.actividadesIndex.set(activity.id, activity);
      const codeKey = normalizeStringLocal(activity.codigo || activity.id);
      if (codeKey) {
        avancesState.actividadesCodigoIndex.set(codeKey, activity.id);
      }
      const descKey = normalizeStringLocal(activity.descripcion || '');
      if (descKey && !avancesState.actividadesCodigoIndex.has(descKey)) {
        avancesState.actividadesCodigoIndex.set(descKey, activity.id);
      }
    });

    if (domRefs.filters.actividad) {
      const previousValue = domRefs.filters.actividad.value;
      domRefs.filters.actividad.innerHTML = '<option value="">Todas las actividades</option>';
      filteredActivities.forEach(activity => {
        const option = document.createElement('option');
        option.value = activity.id;
        option.textContent = activity.descripcion;
        domRefs.filters.actividad.appendChild(option);
      });
      if (previousValue && avancesState.actividadesIndex.has(previousValue)) {
        domRefs.filters.actividad.value = previousValue;
      } else {
        domRefs.filters.actividad.value = '';
      }
      selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.filters.actividad.id);
    }

    if (domRefs.modal.actividadSelect) {
      const previousValue = domRefs.modal.actividadSelect.value;
      domRefs.modal.actividadSelect.innerHTML = '<option value="">Seleccionar actividad...</option>';
      const disponibles = filteredActivities;

      if (!disponibles.length) {
        const option = document.createElement('option');
        option.value = '';
        option.disabled = true;
        option.textContent = restringirPorArea
          ? 'No hay actividades disponibles para tu área asignada'
          : 'No hay actividades disponibles';
        domRefs.modal.actividadSelect.appendChild(option);
        domRefs.modal.actividadSelect.disabled = true;
      } else {
        domRefs.modal.actividadSelect.disabled = false;
        disponibles.forEach(activity => {
          const option = document.createElement('option');
          option.value = activity.id;
          option.textContent = activity.descripcion;
          domRefs.modal.actividadSelect.appendChild(option);
        });
      }

      const selected = previousValue && avancesState.actividadesIndex.has(previousValue)
        ? previousValue
        : (avancesState.actividadSeleccionadaId && avancesState.actividadesIndex.has(avancesState.actividadSeleccionadaId)
          ? avancesState.actividadSeleccionadaId
          : '');
      refreshModalActivitySelect(selected);
    }

    syncFilterStateFromUI();
    applyAvancesFilters();
    updateModalActivityContext(avancesState.actividadSeleccionadaId ? avancesState.actividadesIndex.get(avancesState.actividadSeleccionadaId) || null : null);
    rebuildAvancesAnalytics();
    return filteredActivities;
  } catch (error) {
    console.error('Error cargando actividades desde backend', error);
    avancesState.actividades = [];
    avancesState.actividadesIndex.clear();
    avancesState.actividadesCodigoIndex.clear();
    if (domRefs.modal.actividadSelect) {
      domRefs.modal.actividadSelect.innerHTML = '<option value="">Error cargando actividades</option>';
      domRefs.modal.actividadSelect.disabled = true;
      selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.modal.actividadSelect.id);
    }
    throw error;
  }
}

export async function loadAvances({ forceRefresh = false } = {}) {
  try {
    const response = await callBackend('avances/obtener', forceRefresh ? { reload: true } : {});
    const lista = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : [];

    const { restringirPorArea, areaAsignada } = avancesState.restricciones;
    const aplicarRestriccion = restringirPorArea && typeof areaAsignada === 'string' && areaAsignada.trim() !== '';
    const areaReferencia = aplicarRestriccion ? areaAsignada.trim() : '';

    const filteredList = aplicarRestriccion
      ? lista.filter(avance => {
          const activityCandidates = [
            avance?.actividad_id,
            avance?.actividad,
            avance?.actividad_codigo,
            avance?.actividadCodigo,
            avance?.codigo_actividad,
            avance?.actividadId
          ];

          for (const candidate of activityCandidates) {
            if (candidate === null || candidate === undefined || candidate === '') continue;
            const activity = resolveActivityByAnyReference(candidate);
            if (activity) {
              return true;
            }
          }

          const areaComparables = [
            avance?.area,
            avance?.area_nombre,
            avance?.area_label,
            avance?.areaCodigo,
            avance?.area_codigo,
            avance?.area_id,
            avance?.areaId,
            avance?.actividad_area,
            avance?.actividad_area_nombre,
            avance?.actividad_area_label
          ];

          return coincideAreaUsuario(areaReferencia, areaComparables);
        })
      : lista;

    avancesState.avances = filteredList.map(normalizeAvance);
    rebuildAvancesAnalytics();
    applyAvancesFilters();
    return avancesState.avances;
  } catch (error) {
    console.error('Error cargando avances desde backend', error);
    avancesState.avances = [];
    applyAvancesFilters();
    throw error;
  }
}
