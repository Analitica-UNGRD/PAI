import { avancesState, domRefs, selectEnhancerContext } from './state.js';
import { resolveActivityByAnyReference } from './activities.js';
import { setSelectedActivity, applyAvancesFilters } from './filters.js';
import { openAvanceModal } from './modal.js';

export function applyInitialSelectionAfterLoad() {
  if (!avancesState.initialURLSelection) return;
  const { activityValue, openModal, bimestreSelectValue, bimestreIndex, bimestreRaw } = avancesState.initialURLSelection;
  let resolvedActivity = null;

  if (activityValue) {
    resolvedActivity = resolveActivityByAnyReference(activityValue);
    if (resolvedActivity) {
      setSelectedActivity(resolvedActivity.id, { updateURL: false, updateSelect: true, silent: true });
    }
  }

  if (bimestreSelectValue) {
    avancesState.filtros.bimestre = bimestreSelectValue;
    if (domRefs.filters.bimestre) {
      domRefs.filters.bimestre.value = bimestreSelectValue;
      if (selectEnhancerContext?.refreshModernSelect) {
        selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.filters.bimestre.id);
      }
    }
  }

  applyAvancesFilters();

  if (openModal) {
    const modalBimestre = bimestreRaw || bimestreSelectValue || bimestreIndex || '';
    openAvanceModal({
      activityId: resolvedActivity ? resolvedActivity.id : undefined,
      bimestreValue: modalBimestre || undefined
    });
  }

  avancesState.initialURLSelection = null;
}
