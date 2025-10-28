import { avancesState } from './state.js';
import { resolveBimestreLocal, normalizeStringLocal } from './utils.js';

export function normalizeAvance(avance) {
  const actividadId = (avance?.actividad_id || avance?.actividad || '').toString();
  const actividad = actividadId ? avancesState.actividadesIndex.get(actividadId) : null;
  const actividadLabel = actividad?.descripcion_actividad || actividad?.descripcion || actividad?.nombre || actividad?.label || avance?.actividad || actividadId || 'Sin actividad';
  const actividadCodigo = avance?.codigo || avance?.actividad_codigo || avance?.actividadCodigo || actividad?.codigo || actividadId;
  const areaLabel = avance?.area || actividad?.area || actividad?.area_nombre || actividad?.areaNombre || actividad?.raw?.area || '';
  const subprocesoLabel = actividad?.subproceso || actividad?.subproceso_nombre || actividad?.subprocesoNombre || actividad?.raw?.subproceso || '';
  const bimestreCandidates = [
    avance?.bimestre_nombre,
    avance?.bimestre_label,
    avance?.bimestre,
    avance?.bimestre_id
  ];
  let resolvedBimestre = { index: '', label: '' };
  for (const candidate of bimestreCandidates) {
    if (candidate === null || candidate === undefined) continue;
    const resolved = resolveBimestreLocal(candidate);
    if (resolved.label || resolved.index) {
      if (!resolvedBimestre.label || !resolvedBimestre.index || resolved.label) {
        resolvedBimestre = resolved;
      }
      if (resolved.label && resolved.index) {
        break;
      }
    }
  }
  const bimestreLabel = resolvedBimestre.label || '';
  const bimestreIndex = resolvedBimestre.index || '';
  const estadoRevision = avance?.estado_revision || avance?.estadoRevision || 'Sin revisión';
  const presupuesto = avance?.presupuesto_ejecutado_bimestre ?? avance?.presupuesto ?? '';
  const logro = avance?.logro_valor ?? avance?.logro ?? '';
  const metaProgramada = avance?.meta_programada_bimestre ?? avance?.meta_programada ?? '';

  return {
    ...avance,
    actividad_id: actividadId,
    actividad_label: actividadLabel,
  actividad_codigo: actividadCodigo,
    area_label: areaLabel,
    subproceso_label: subprocesoLabel,
    bimestre_label: bimestreLabel,
    bimestre_index: bimestreIndex,
    estado_label: estadoRevision,
    meta_programada_bimestre: metaProgramada,
    presupuesto_valor: presupuesto,
    logro_valor: logro
  };
}
