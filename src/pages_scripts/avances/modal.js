import { domRefs, avancesState, selectEnhancerContext, obtenerEmailUsuarioActualLocal } from './state.js';
import { AVANCE_REQUIRED_FIELDS } from './constants.js';
import { generateAvanceId, resolveBimestreLocal, normalizeStringLocal } from './utils.js';
import { resolveActivityByAnyReference } from './activities.js';
import { updateModalActivityContext, updateModalBimestreContext, resetModalForm } from './ui.js';
import { setSelectedActivity } from './filters.js';
import { saveAvance, reviewAvance } from './api.js';
import { loadAvances } from './data.js';
import { getBimestreAnalytics } from './analytics.js';
import { formatNumber, formatCurrency, parseNumericValue } from './formatters.js';
import { recordAvanceTrace } from './tracing.js';
import { UI } from '../../lib/ui.js';

const OPEN_MODAL_EVENT = 'avances:open-modal';

function getTodayLocalDateISO() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().split('T')[0];
}

function lockFechaReporteInput(input) {
  if (!input) return;
  const todayISO = getTodayLocalDateISO();
  input.value = todayISO;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.readOnly = true;
  input.setAttribute('aria-readonly', 'true');
  input.setAttribute('min', todayISO);
  input.setAttribute('max', todayISO);
  input.classList.add('bg-gray-50', 'cursor-not-allowed');
  if (!input.dataset.lockHandlersApplied) {
    input.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key?.toLowerCase?.() || '';
      const allowedKeys = ['tab', 'shift', 'enter'];
      if (!allowedKeys.includes(key)) {
        event.preventDefault();
      }
    });
    input.addEventListener('mousedown', event => {
      event.preventDefault();
    });
    input.dataset.lockHandlersApplied = 'true';
  }
}

function formatNumberSafe(value) {
  return Number.isFinite(value) ? formatNumber(value) : 'N/A';
}

function formatCurrencySafe(value) {
  return Number.isFinite(value) ? formatCurrency(value) : 'N/A';
}

function evaluateSubmissionLimits({ actividadId, bimestreValue, metaProgramada, logro, presupuesto }) {
  if (!actividadId || !bimestreValue) {
    return { requiresReview: false, warnings: [], stats: null, planMeta: null, planPresupuesto: null, projected: {} };
  }

  const stats = getBimestreAnalytics(actividadId, bimestreValue);
  if (!stats) {
    return { requiresReview: false, warnings: [], stats: null, planMeta: null, planPresupuesto: null, projected: {} };
  }

  const planMeta = Number.isFinite(stats.planMeta) ? stats.planMeta : null;
  const planPresupuesto = Number.isFinite(stats.planPresupuesto) ? stats.planPresupuesto : null;
  const existenteLogro = stats.totalLogro || 0;
  const existentePresupuesto = stats.totalPresupuesto || 0;
  const warnings = [];

  if (planMeta !== null && existenteLogro > planMeta + 0.0001) {
    warnings.push(`El bimestre ya supera la meta planificada (${formatNumberSafe(planMeta)}); verifica el acumulado actual (${formatNumberSafe(existenteLogro)}).`);
  }

  if (planPresupuesto !== null && existentePresupuesto > planPresupuesto + 1) {
    warnings.push(`El bimestre ya supera el presupuesto planificado (${formatCurrencySafe(planPresupuesto)}); acumulado actual ${formatCurrencySafe(existentePresupuesto)}.`);
  }

  if (planMeta !== null && metaProgramada !== null && metaProgramada > planMeta + 0.0001) {
    warnings.push(`La meta programada (${formatNumberSafe(metaProgramada)}) supera la meta planificada del bimestre (${formatNumberSafe(planMeta)}).`);
  }

  if (planMeta !== null && logro !== null) {
    const proyectadoLogro = existenteLogro + logro;
    if (proyectadoLogro > planMeta + 0.0001) {
      warnings.push(`El logro acumulado (${formatNumberSafe(proyectadoLogro)}) excede la meta planificada (${formatNumberSafe(planMeta)}).`);
    }
  }

  if (planPresupuesto !== null && presupuesto !== null) {
    const proyectadoPresupuesto = existentePresupuesto + presupuesto;
    if (proyectadoPresupuesto > planPresupuesto + 1) {
      warnings.push(`El presupuesto acumulado (${formatCurrencySafe(proyectadoPresupuesto)}) excede el presupuesto planificado (${formatCurrencySafe(planPresupuesto)}).`);
    }
  }

  return {
    requiresReview: warnings.length > 0,
    warnings,
    stats,
    planMeta,
    planPresupuesto,
    projected: {
      logro: existenteLogro + (logro || 0),
      presupuesto: existentePresupuesto + (presupuesto || 0)
    }
  };
}

function resolveBimestreSelectValue(selectElement, rawValue) {
  if (!selectElement || !rawValue) return '';

  const resolved = resolveBimestreLocal(rawValue);
  const options = Array.from(selectElement.options || []);
  const candidates = [];

  if (typeof rawValue === 'string') {
    candidates.push(rawValue);
  }
  if (rawValue && typeof rawValue === 'object') {
    const labelFromObject = rawValue.label || rawValue.nombre || rawValue.descripcion || rawValue.periodo;
    if (labelFromObject) {
      candidates.push(labelFromObject);
    }
  }
  if (resolved.label) {
    candidates.push(resolved.label);
  }
  if (resolved.index) {
    candidates.push(String(resolved.index));
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeStringLocal(candidate);
    const byValue = options.find(option => normalizeStringLocal(option.value || option.textContent || '') === normalizedCandidate);
    if (byValue) return byValue.value;
    const byText = options.find(option => normalizeStringLocal(option.textContent || '') === normalizedCandidate);
    if (byText) return byText.value;
    const byIndex = options.find(option => String(option.dataset?.index || '') === candidate);
    if (byIndex) return byIndex.value;
  }

  if (resolved.index) {
    const byIndex = options.find(option => String(option.dataset?.index || '') === String(resolved.index));
    if (byIndex) return byIndex.value;
  }

  return '';
}

export function openAvanceModal({ activityId = null, bimestreValue = null } = {}) {
  const modal = domRefs.modal;
  if (!modal || !modal.container) return;

  const targetActivityId = activityId ? String(activityId) : (avancesState.filtros.actividad || avancesState.actividadSeleccionadaId || '');

  if (modal.actividadSelect) {
    modal.actividadSelect.value = targetActivityId;
    selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, modal.actividadSelect.id);
  }

  modal.container.classList.remove('hidden');
  modal.container.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');

  if (modal.avanceIdInput) {
    modal.avanceIdInput.value = generateAvanceId();
  }

  if (modal.reportadoPorInput) {
    const email = obtenerEmailUsuarioActualLocal();
    if (email) {
      modal.reportadoPorInput.value = email;
      modal.reportadoPorInput.setAttribute('readonly', 'true');
      modal.reportadoPorInput.classList.add('bg-gray-50', 'cursor-not-allowed');
    }
  }

  if (modal.fechaReporteInput) {
    lockFechaReporteInput(modal.fechaReporteInput);
  }

  if (modal.metaInput) {
    modal.metaInput.dataset.prefilled = modal.metaInput.value ? 'true' : 'false';
    modal.metaInput.dataset.planValue = '';
    modal.metaInput.dataset.acumulado = '';
  }

  if (modal.logroInput) {
    modal.logroInput.dataset.planValue = '';
    modal.logroInput.dataset.acumulado = '';
  }

  if (modal.presupuestoInput) {
    modal.presupuestoInput.dataset.planValue = '';
    modal.presupuestoInput.dataset.acumulado = '';
  }

  const activity = resolveActivityByAnyReference(targetActivityId);
  updateModalActivityContext(activity);

  if (modal.anioSelect) {
    const yearCandidate = avancesState.filtros.year || modal.anioSelect.value;
    if (yearCandidate && Array.from(modal.anioSelect.options || []).some(option => option.value === yearCandidate)) {
      modal.anioSelect.value = yearCandidate;
    }
  }

  if (modal.bimestreSelect) {
    let resolvedValue = '';
    if (bimestreValue) {
      resolvedValue = resolveBimestreSelectValue(modal.bimestreSelect, bimestreValue);
    }

    if (resolvedValue) {
      modal.bimestreSelect.value = resolvedValue;
    }

    if (bimestreValue && !resolvedValue && typeof bimestreValue === 'string') {
      modal.bimestreSelect.value = bimestreValue;
    }

    selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, modal.bimestreSelect.id);
    const selectedValue = modal.bimestreSelect.value;
    if (selectedValue) {
      updateModalBimestreContext(selectedValue, { forcePrefill: true });
    } else {
      updateModalBimestreContext('', { forcePrefill: false });
    }
  } else {
    updateModalBimestreContext('', { forcePrefill: false });
  }
}

export function closeAvanceModal({ resetForm: shouldReset = false } = {}) {
  const modal = domRefs.modal;
  if (!modal || !modal.container) return;

  modal.container.classList.add('hidden');
  modal.container.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overflow-hidden');

  if (shouldReset) {
    resetModalForm();
  }
}

export function attachModalEvents({ puedeCrearAvances = true } = {}) {
  const nuevoAvanceButton = document.getElementById('btn-nuevo-avance');
  if (nuevoAvanceButton) {
    nuevoAvanceButton.addEventListener('click', () => openAvanceModal());
    if (!puedeCrearAvances) {
      nuevoAvanceButton.disabled = true;
      nuevoAvanceButton.classList.add('opacity-60', 'cursor-not-allowed');
    }
  }

  if (typeof document !== 'undefined' && !document.__avancesModalShortcutAttached) {
    document.addEventListener(OPEN_MODAL_EVENT, event => {
      const detail = event?.detail || {};
      openAvanceModal({
        activityId: detail.activityId || detail.activity || null,
        bimestreValue: detail.bimestreValue || detail.bimestreLabel || detail.bimestreIndex || null
      });
    });
    document.__avancesModalShortcutAttached = true;
  }

  if (domRefs.modal.closeButton) {
    domRefs.modal.closeButton.addEventListener('click', () => closeAvanceModal({ resetForm: true }));
  }
  if (domRefs.modal.cancelButton) {
    domRefs.modal.cancelButton.addEventListener('click', () => closeAvanceModal({ resetForm: true }));
  }

  if (domRefs.modal.actividadSelect) {
    domRefs.modal.actividadSelect.addEventListener('change', () => {
      const selected = domRefs.modal.actividadSelect.value;
      setSelectedActivity(selected, { updateSelect: true, updateURL: false, silent: true });
      updateModalActivityContext(selected ? avancesState.actividadesIndex.get(selected) || null : null);
      if (domRefs.modal.bimestreSelect && domRefs.modal.bimestreSelect.value) {
        updateModalBimestreContext(domRefs.modal.bimestreSelect.value, { forcePrefill: false });
      }
    });
  }

  if (domRefs.modal.bimestreSelect) {
    domRefs.modal.bimestreSelect.addEventListener('change', (event) => {
      updateModalBimestreContext(event.target.value, { forcePrefill: true });
    });
  }

  if (domRefs.modal.submitButton && !puedeCrearAvances) {
    domRefs.modal.submitButton.disabled = true;
    domRefs.modal.submitButton.classList.add('opacity-60', 'cursor-not-allowed');
  }

  if (domRefs.modal.form) {
    domRefs.modal.form.addEventListener('submit', (event) => handleModalFormSubmit(event, { puedeCrearAvances }));
  }
}

export async function handleModalFormSubmit(event, { puedeCrearAvances = true } = {}) {
  event.preventDefault();

  if (!puedeCrearAvances) {
    UI.showMessage(
      'Tu rol no permite registrar avances. Comunícate con un administrador si necesitas permisos adicionales.',
      'warning',
      6000
    );
    return;
  }

  if (!domRefs.modal.form) return;

  if (domRefs.modal.avancesHidden && domRefs.modal.avancesEditor) {
    const text = domRefs.modal.avancesEditor.textContent || '';
    if (text.trim()) {
      domRefs.modal.avancesHidden.value = text.trim();
    }
  }

  if (domRefs.modal.dificultadesHidden && domRefs.modal.dificultadesEditor) {
    const text = domRefs.modal.dificultadesEditor.textContent || '';
    if (text.trim()) {
      domRefs.modal.dificultadesHidden.value = text.trim();
    }
  }

  const formData = new FormData(domRefs.modal.form);
  let actividadId = formData.get('actividad_id') || avancesState.actividadSeleccionadaId || '';
  actividadId = actividadId ? String(actividadId).trim() : '';

  if (!actividadId) {
    UI.showMessage('Selecciona una actividad para registrar el avance.', 'warning', 5000);
    return;
  }

  formData.set('actividad_id', actividadId);

  const todayISODate = getTodayLocalDateISO();
  formData.set('fecha_reporte', todayISODate);
  if (domRefs.modal.fechaReporteInput) {
    lockFechaReporteInput(domRefs.modal.fechaReporteInput);
  }

  for (const field of AVANCE_REQUIRED_FIELDS) {
    const value = formData.get(field);
    if (!value || String(value).trim() === '') {
      UI.showMessage(`Por favor completa el campo: ${field}`, 'warning', 5000);
      return;
    }
  }

  let avanceId = formData.get('avance_id');
  if (!avanceId) {
    avanceId = generateAvanceId();
    formData.set('avance_id', avanceId);
    if (domRefs.modal.avanceIdInput) {
      domRefs.modal.avanceIdInput.value = avanceId;
    }
  }

  if (!formData.get('reportado_por') && domRefs.modal.reportadoPorInput) {
    const email = obtenerEmailUsuarioActualLocal();
    if (email) {
      domRefs.modal.reportadoPorInput.value = email;
      formData.set('reportado_por', email);
    }
  }

  const payload = {
    avance_id: formData.get('avance_id'),
    actividad_id: formData.get('actividad_id'),
    anio: formData.get('anio'),
    bimestre_id: formData.get('bimestre_id'),
    meta_programada_bimestre: formData.get('meta_programada_bimestre') || null,
    logro_valor: formData.get('logro_valor') || null,
    presupuesto_ejecutado_bimestre: formData.get('presupuesto_ejecutado_bimestre') || null,
    avances_texto: formData.get('avances_texto') || '',
    dificultades_texto: formData.get('dificultades_texto') || '',
    evidencia_url: formData.get('evidencia_url') || '',
    fecha_reporte: formData.get('fecha_reporte') || '',
    reportado_por: formData.get('reportado_por') || obtenerEmailUsuarioActualLocal() || ''
  };

  const metaProgramadaValue = parseNumericValue(payload.meta_programada_bimestre);
  const logroValue = parseNumericValue(payload.logro_valor);
  const presupuestoValue = parseNumericValue(payload.presupuesto_ejecutado_bimestre);

  payload.meta_programada_bimestre = metaProgramadaValue ?? null;
  payload.logro_valor = logroValue ?? null;
  payload.presupuesto_ejecutado_bimestre = presupuestoValue ?? null;

  const limitsEvaluation = evaluateSubmissionLimits({
    actividadId,
    bimestreValue: payload.bimestre_id,
    metaProgramada: metaProgramadaValue,
    logro: logroValue,
    presupuesto: presupuestoValue
  });

  if (limitsEvaluation.requiresReview) {
    const warningsMessage = limitsEvaluation.warnings.map((warning, idx) => `${idx + 1}. ${warning}`).join('\n');
    const confirmReview = window.confirm(`${warningsMessage}\n\nEl avance se marcará en estado "En revisión" para verificación administrativa. ¿Deseas continuar?`);
    if (!confirmReview) {
      return;
    }
  }

  const reviewContext = limitsEvaluation.requiresReview ? limitsEvaluation : null;

  const submitButton = domRefs.modal.submitButton || domRefs.modal.form.querySelector('button[type="submit"]');
  const submitLabel = submitButton ? submitButton.innerHTML : '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = 'Guardando...';
  }

  let reviewMarked = true;

  try {
    const response = await saveAvance(payload);
    if (response && response.success === false) {
      throw new Error(response.error || response.message || 'Error desconocido al guardar avance');
    }

    if (reviewContext) {
      try {
        await reviewAvance({
          avance_id: payload.avance_id,
          estado_revision: 'En revisión',
          comentarios: reviewContext.warnings.join(' | '),
          revisor: obtenerEmailUsuarioActualLocal() || undefined
        });
      } catch (reviewError) {
        console.warn('No se pudo marcar el avance en revisión automática:', reviewError);
        reviewMarked = false;
      }
    }

    closeAvanceModal({ resetForm: true });
    setSelectedActivity(payload.actividad_id, { updateSelect: true, updateURL: true });
    await loadAvances({ forceRefresh: true });
    recordAvanceTrace('avance_guardado', {
      avanceId: payload.avance_id,
      actividadId: payload.actividad_id,
      bimestre: payload.bimestre_id,
      requiereRevision: Boolean(reviewContext),
      advertencias: reviewContext?.warnings || [],
      proyecciones: reviewContext?.projected || {}
    });

    const successMessage = reviewContext
      ? (reviewMarked
        ? 'Avance guardado y enviado a revisión administrativa.'
        : 'Avance guardado. No fue posible marcarlo automáticamente en revisión, informa al administrador.')
      : 'Avance guardado correctamente.';
    UI.showMessage(successMessage, reviewMarked ? 'success' : 'warning', { duration: 6500 });
  } catch (error) {
    console.error('Error guardando avance:', error);
    recordAvanceTrace('avance_error', {
      avanceId: payload.avance_id,
      actividadId: payload.actividad_id,
      bimestre: payload.bimestre_id,
      error: error?.message || String(error)
    });
    UI.showMessage(`Error guardando avance: ${error.message || error}`, 'error', 6500);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = submitLabel || 'Guardar avance';
    }
  }
}
