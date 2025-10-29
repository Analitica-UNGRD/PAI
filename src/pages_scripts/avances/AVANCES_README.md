## Módulo `avances` — documentación top-level

Este README describe cada archivo top-level dentro de `src/pages_scripts/avances` (sin incluir la subcarpeta `manager/`).
Incluye propósito, API pública, IDs del DOM que el módulo espera, ejemplos de uso y recomendaciones de mantenimiento.

## Resumen rápido
- Propósito: interfaz para visualizar, filtrar y registrar "avances" (reportes por bimestre) sobre actividades.
- Punto de entrada: `index.js` (ata eventos DOMContentLoaded, bindDomReferences y carga inicial).
- Principales responsabilidades:
  - Cargar actividades y avances desde el backend (`data.js`, `api.js`).
  - Normalizar registros (`records.js`, `activities.js`).
  - Renderizar UI (tabla, resumen, tarjetas por bimestre) (`ui.js`).
  - Modal de registro y validaciones (prefill, límites, envío) (`modal.js`).
  - Filtrado / sincronización de selección (`filters.js`, `routing.js`).
  - Cálculo de métricas por actividad / bimestre (`analytics.js`).
  - Trazas locales para debugging (`tracing.js`).

## Archivos y API pública

### `index.js`
- Qué hace: punto de arranque; llama a `bindDomReferences()`, configura selects/date pickers, obtiene permisos, adjunta eventos y lanza `loadActividades()` y `loadAvances()`.
- Uso: Ninguna exportación pública (auto-ejecutado). Para pruebas se puede importar y ejecutar manualmente las funciones exportadas en otros módulos.
- Flujo importante:
  1. bindDomReferences()
  2. aplicar estilos de selects/datepicker (selectEnhancerContext)
  3. attachModalEvents({ puedeCrearAvances })
  4. loadActividades(), applyInitialSelectionAfterLoad(), loadAvances()

### `constants.js`
- Contiene: constantes compartidas como `AVANCE_PERMISSIONS`, `BIMESTRES_LIST` y `AVANCE_REQUIRED_FIELDS`.
- Uso típico: `AVANCE_REQUIRED_FIELDS` es validado por `modal.handleModalFormSubmit`.

### `utils.js`
- Funciones clave:
  - `normalizeStringLocal(str)` — normaliza cadenas para comparaciones (minúsculas, sin tildes, trimming).
  - `resolveBimestreLocal(input)` — heurística para resolver bimestres desde índices, labels, objetos o meses.
  - `generateAvanceId()` — id único para un avance.
  - URL helpers: leer/actualizar selección inicial en la URL.
- Recomendación: mantener la heurística de bimestres centralizada; si se extiende el calendario, actualizar aquí.

### `formatters.js`
- Funciones clave:
  - `formatCurrency`, `formatNumber`, `formatPercent`, `formatDate` — presentación segura según patterns del proyecto.
  - `parseNumericValue(value)` — detecta formatos con separadores de miles/decimales y devuelve Number o null.
  - `evaluateAvancePerformance(meta, logro)` — devuelve objeto { status, ratio, diff, label, message } usado por la fila y la barra de progreso.

### `state.js`
- Qué contiene: `domRefs`, `avancesState`, `selectEnhancerContext` y `bindDomReferences()`.
- Estados importantes:
  - `avancesState.actividades` (array)
  - `avancesState.actividadesIndex` (Map id -> actividad)
  - `avancesState.actividadesCodigoIndex` (Map claveNormalizada -> id)
  - `avancesState.actividadSeleccionadaId` (string)
  - `avancesState.avances` (array normalizado)
  - `avancesState.filtros` (actividad, year, bimestre)
  - `avancesState.restricciones` (restringirPorArea, areaAsignada)
  - `avancesState.initialURLSelection` (parseada desde la URL)

- DOM IDs ligados por `bindDomReferences()` (lista exacta):
  - Tabla y resumen:
    - `avances-body` (tbody donde se renderiza la tabla)
    - `avances-empty` (estado vacío)
    - `avances-summary` (texto resumen/estadística)
    - `avances-summary-selection` (label con filtros aplicados)
    - `refrescar-avances` (botón para refrescar)
  - Filtros:
    - `filter-actividad` (select)
    - `filter-year` (select)
    - `filter-bimestre` (select)
  - Card resumen de actividad:
    - `actividad-resumen-card`, `actividad-resumen-nombre`, `actividad-resumen-resumen`, `actividad-resumen-codigo`, `actividad-resumen-area`, `actividad-resumen-subproceso`, `actividad-resumen-meta-plan`, `actividad-resumen-presupuesto-plan`, `actividad-resumen-meta-logro`, `actividad-resumen-presupuesto-ejecutado`, `actividad-resumen-avances-count`, `actividad-resumen-ultima-fecha`, `actividad-resumen-bimestres`
  - Modal de registro y sus campos:
    - `modal-registrar-avance`, `modal-registrar-avance-body`, `form-modal-avance`, `modal-actividad-subtitulo`, `modal-actividad-nombre`, `modal-actividad-descripcion`, `modal-actividad-codigo`, `modal-actividad-area`, `modal-actividad-meta-anual`, `modal-actividad-presupuesto`, `modal-actividad_id`, `modal-anio`, `modal-bimestre_id`, `modal-meta_programada_bimestre`, `modal-logro_valor`, `modal-presupuesto_ejecutado_bimestre`, `modal-avances-editor`, `modal-dificultades-editor`, `modal-avances_texto`, `modal-dificultades_texto`, `btn-verificar-avances`, `btn-verificar-dificultades`, `modal-avances-ortografia-panel`, `modal-dificultades-ortografia-panel`, `modal-avance_id`, `modal-reportado_por`, `modal-evidencia_url`, `modal-fecha_reporte`, `modal-bimestre-context`, `modal-bimestre-context-nombre`, `modal-bimestre-context-meta`, `modal-bimestre-context-presupuesto`, `modal-bimestre-context-descripcion`, `modal-bimestre-context-alert`, `modal-bimestre-context-meta-registrado`, `modal-bimestre-context-meta-saldo`, `modal-bimestre-context-presupuesto-registrado`, `modal-bimestre-context-presupuesto-saldo`, `btn-cerrar-modal-avance`, `btn-cancelar-modal-avance`, `btn-guardar-modal-avance`

### `permissions.js`
- Funciones: `obtenerContextoPermisos()` y `obtenerAreaAsignadaUsuario()`; derivan rol y área desde utilidades compartidas o localStorage.
- Uso: `index.js` consulta permisos para determinar si `puedeCrearAvances`.

### `api.js`
- Wrappers que delegan en el cliente de `actividades/api.js`:
  - `callBackend(path, payload)` — llamada genérica.
  - `fetchActividades()`, `fetchAvances()`, `saveAvance(payload)`, `reviewAvance(payload)` — conveniencia.
- Contrato:
  - `loadActividades()` (en `data.js`) usa `callBackend('actividades/obtener', { incluir_catalogos: true })` y espera respuestas con `data`, `items` o un arreglo crudo.
  - `loadAvances()` usa `callBackend('avances/obtener', ...)` con formato similar.

### `activities.js`
- Funciones clave:
  - `normalizeActividadForAvances(raw)` — construye objeto con `id`, `codigo`, `descripcion`, `metaPlan`, `presupuestoPlan`, y una lista `bimestres` normalizada.
  - `resolveActivityByAnyReference(value)` — busca actividad por id, código o descripción (usa índices en `avancesState`).

### `records.js`
- `normalizeAvance(avance)` — normaliza un objeto avance recibido del backend, garantizando campos: `actividad_id`, `actividad_label`, `actividad_codigo`, `area_label`, `subproceso_label`, `bimestre_label`, `bimestre_index`, `estado_label`, `meta_programada_bimestre`, `presupuesto_valor`, `logro_valor`.

### `filters.js`
- Exporta:
  - `syncFilterStateFromUI()` — lee selects y actualiza `avancesState.filtros`.
  - `applyAvancesFilters()` — filtra `avancesState.avances` por filtros y llama a `renderAvancesTabla` y `updateActivitySummary`.
  - `setSelectedActivity(activityId, opts)` — sincroniza selects, estado y URL; opcionalmente silencioso.
  - `handleFilterChange()` — handler ligado a selects.

### `data.js`
- Exporta:
  - `loadActividades({ restringirPorArea, areaAsignada })` — carga actividades, normaliza y llena índices. Actualiza selects del DOM y reconstruye analytics.
  - `loadAvances({ forceRefresh })` — carga avances, aplica posible filtro por área, normaliza con `normalizeAvance` y reconstruye analytics.
- Contrato: ambas funciones devuelven el arreglo normalizado y lanzan excepciones en errores. Manejan formatos `response.data`, `response.items` o arrays.

### `ui.js`
- Exporta funciones de render y helpers:
  - `renderActivityBimestres(activity)` — render cards de bimestres dentro de `actividad-resumen-bimestres`.
  - `updateActivitySummary({ registros })` — actualiza datos del card resumen (totales, última fecha) y llama a renderActivityBimestres.
  - `updateSummarySelectionLabel()` — actualiza `avances-summary-selection` con filtros activos.
  - `updateModalActivityContext(activity)` — llena la sección de contexto del modal según la actividad seleccionada.
  - `updateModalBimestreContext(bimestreValue, opts)` — rellena la tarjeta contextual del bimestre en el modal (plan, acumulados, saldo y alertas).
  - `resetModalForm()` — limpia form y editores.
  - `getEstadoChipClass(estado)` — util para paleta de estado.
  - `renderAvancesTabla(items)` — render principal de la tabla de avances (utiliza `evaluateAvancePerformance`).
  - `refreshModalActivitySelect(activityId)` — actualiza `modal.actividadSelect` y el modernSelect asociado.

### `modal.js`
- Exporta y/o adjunta:
  - `attachModalEvents({ puedeCrearAvances })` — registra handlers para abrir/cerrar modal, cambios en selects y submit. También escucha evento global `avances:open-modal`.
  - `openAvanceModal({ activityId, bimestreValue })` — abre el modal, hace prefill y sincroniza select/bimestre/contexto.
  - `closeAvanceModal({ resetForm })` — cierra y opcionalmente resetea.
  - `handleModalFormSubmit(event, { puedeCrearAvances })` — lógica completa de validación, parseo numérico, evaluación de límites, confirmación si requiere revisión, `saveAvance`, marcación `reviewAvance`, recarga `loadAvances()` y trazado `recordAvanceTrace()`.

### `routing.js`
- `applyInitialSelectionAfterLoad()` — lee `avancesState.initialURLSelection` (parseada por `state.js`) y aplica selección inicial (puede abrir modal si la URL lo pide).

### `analytics.js`
- `rebuildAvancesAnalytics()` — genera `avancesState.analytics.totalsByActivity` con métricas por actividad y bimestre.
- `getActivityAnalytics(activityId)`, `getBimestreAnalytics(activityId, bimestreValue)`, `getActividadPlan(activityId)` están disponibles para consulta rápida desde UI y modal.

### `tracing.js`
- `recordAvanceTrace(eventType, details)` — persistencia local en localStorage bajo la clave `pai_avances_trace_log` (hasta 50 entradas).
- `readLocalAvanceTrace()` — leer trazas.

## Ejemplos de uso (desde consola o pruebas)

- Forzar apertura del modal para actividad `A123` y bimestre `2`:
  document.dispatchEvent(new CustomEvent('avances:open-modal', { detail: { activityId: 'A123', bimestreValue: '2' } }));

- Seleccionar actividad desde código e forzar render:
  import { setSelectedActivity } from './filters.js';
  setSelectedActivity('A123', { updateSelect: true, updateURL: true });

- Recargar avances manualmente:
  import { loadAvances } from './data.js';
  await loadAvances({ forceRefresh: true });

- Consultar analytics de bimestre:
  import { getBimestreAnalytics } from './analytics.js';
  const stats = getBimestreAnalytics('A123', '2');

## Contratos y formatos esperados
- Backend responses aceptados por `api.js`/`data.js`: objetos con `data` (array) o `items` (array) o la respuesta puede ser directamente un array.
- `normalizeAvance` espera los campos comunes que pueden venir en distintas variantes y normaliza a los campos usados por la UI (`actividad_id`, `meta_programada_bimestre`, `logro_valor`, `presupuesto_valor`, `bimestre_label`/`bimestre_index`).

## Errores y edge cases detectados
- Formatos numéricos locales: `parseNumericValue` maneja separadores, pero los datos inconsistentes podrían producir NaN — `formatters.js` normaliza a null/0 según convenga.
- Bimestres: el input puede venir como label, index o un objeto; `resolveBimestreLocal` aplica heurística. Si se añaden periodos no bimestrales, actualizar esa función.
- Permisos: si el rol no permite crear avances, `modal.attachModalEvents` deshabilita el botón y el submit muestra mensaje.
- Memory leaks: muchos listeners se adjuntan sin teardown. Si la app es SPA con navegación interna, agregar detachers para evitar leaks.

## Recomendaciones y mejoras pequeñas (priorizadas)
1. Separar lógica puramente computacional (analytics, evaluateAvancePerformance, parseNumericValue) en un módulo utilitario libre de DOM para facilitar tests unitarios.
2. Añadir try/catch con reintentos y exponential backoff en `api.callBackend` para llamadas críticas (cargas y guardado). Registrar errores con `recordAvanceTrace` cuando fallen.
3. Implementar un método `dispose()` para remover event listeners añadidos por `attachModalEvents` y las referencias de `selectEnhancerContext.components` (mejor soporte SPA).
4. Agregar pruebas unitarias para:
   - `resolveBimestreLocal` (cubrir alias y formatos de meses)
   - `parseNumericValue` (varios locales)
   - `evaluateAvancePerformance` (casos límite: meta = 0, logro = null, etc.)
5. Accessibility: asegurar que los botones con role=button tengan manejo de foco y atributos ARIA correctos (ya se usan label/role/tabIndex en `ui.js`, revisar contrastes de color en alertas).

## Observaciones de implementación
- El modal bloquea `fecha_reporte` para que el valor sea hoy y evita cambios (handler `lockFechaReporteInput`). Esto es deliberado pero puede ser muy restrictivo en casos de registro retroactivo — considerar opción por rol.
- `modal.handleModalFormSubmit` marca los avances en "En revisión" automáticamente si se detectan advertencias; el usuario confirma la acción con window.confirm — para integraciones automatizadas conviene exponer una variante sin prompts.

## Local debugging
- Traza local: `localStorage.getItem('pai_avances_trace_log')` contiene el historial de eventos registrados por `recordAvanceTrace`.

## Contribuir a la documentación
- Si actualizas IDs de DOM en las vistas HTML, actualiza `bindDomReferences()` y este README.

---


