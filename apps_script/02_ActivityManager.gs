/**
 * ActivityManager.gs - Gestor de Actividades para PAI-UNGRD
 * 
 * Este módulo maneja todas las operaciones CRUD de actividades:
 * - Integración con el nuevo sistema de catálogos unificado
 * - Validaciones de negocio y integridad referencial
 * - Mapeo automático de campos derivados
 * - API limpia y consistente
 * - Gestión de estados y auditoría
 * 
 * @author: Sistema PAI-UNGRD
 * @version: 1.0
 */

// ==================== CONFIGURACIÓN DE ACTIVIDADES ====================

/**
 * Headers de la hoja de actividades (mantener compatibilidad)
 * Nota: Los campos guardan los labels/nombres para mejor legibilidad
 */
const ACTIVITY_HEADERS = [
  'actividad_id',           // A - ID único de la actividad
  'area',                   // B - Nombre del área (label del catálogo)
  'subproceso',             // C - Nombre del subproceso (label del catálogo)
  'mipg',                   // D - Dimensión MIPG (label del catálogo)
  'linea',                  // E - Nombre de línea de acción (label del catálogo)
  'descripcion_actividad',  // F - Descripción de la actividad
  'indicador',              // G - Nombre del indicador (label del catálogo)
  'meta_indicador_valor',   // H - Valor meta del indicador
  'entregable',             // I - Descripción del entregable
  'presupuesto_programado', // J - Presupuesto programado
  'fuente',                 // K - Fuente de financiación (label del catálogo)
  'plan',                   // L - Nombre del plan (label del catálogo)
  'responsable',            // M - Responsable de la actividad
  'fecha_inicio_planeada',  // N - Fecha de inicio planeada
  'fecha_fin_planeada',     // O - Fecha de fin planeada
  'estado',                 // P - Estado de la actividad
  'creado_por',             // Q - Email del usuario que creó la actividad
  'creado_el',              // R - Fecha de creación
  'actualizado_el'          // S - Fecha de última actualización
];

/**
 * Mapeo de campos de formulario a campos de base de datos
 */
const FORM_FIELD_MAPPING = {
  'subproceso_id': 'subproceso_id',
  'mipg': 'mipg',
  'linea_id': 'linea_id',
  'descripcion_actividad': 'descripcion_actividad',
  'indicador_id': 'indicador_id',
  'meta_indicador_valor': 'meta_indicador_valor',
  'entregable': 'entregable',
  'presupuesto_programado': 'presupuesto_programado',
  'fuente': 'fuente',
  'plan_id': 'plan_id',
  'responsable': 'responsable',
  'fecha_inicio_planeada': 'fecha_inicio_planeada',
  'fecha_fin_planeada': 'fecha_fin_planeada',
  'estado': 'estado'
};

// ==================== MANEJADOR PRINCIPAL ====================

/**
 * Manejador principal para requests de actividades
 * @param {Object} body - Request body con path y payload
 * @returns {Object} Respuesta formateada
 */
function handleActivityRequest(body) {
  try {
    const path = body.path || '';
    const payload = body.payload || {};

    // Router para endpoints de actividades
    switch (path) {
      // Endpoints CRUD básicos
      case 'activities/create':
        return createActivity(payload);
      
      case 'activities/getAll':
        return getAllActivities(payload.filters);
      
      case 'activities/getById':
        return getActivityById(payload.id);
      
      case 'activities/update':
        return updateActivity(payload.id, payload.data);
      
      case 'activities/delete':
        return deleteActivity(payload.id);
      
      // Endpoints de búsqueda y filtros
      case 'activities/search':
        return searchActivities(payload);
      
      case 'activities/filter':
        return filterActivities(payload);
      
      // Endpoints de reportes
      case 'activities/report':
        return generateActivityReport(payload);
      
      case 'activities/export':
        return exportActivities(payload);
      
      // Endpoints de validación
      case 'activities/validate':
        return validateActivity(payload);
      
      default:
        return formatResponse(false, null, '', `Endpoint de actividades '${path}' no reconocido`);
    }
    
  } catch (error) {
    console.error('Error en handleActivityRequest:', error);
    return handleError(error, 'handleActivityRequest');
  }
}

// ==================== FUNCIONES CRUD BÁSICAS ====================

/**
 * Crea una nueva actividad
 * @param {Object} data - Datos de la actividad
 * @returns {Object} Respuesta con la actividad creada
 */
function createActivity(data) {
  console.log('[DEBUG] createActivity: === INICIO ===');
  console.log('[DEBUG] createActivity: Datos recibidos:', JSON.stringify(data, null, 2));
  
  try {
    // Validación básica más detallada
    if (!data || typeof data !== 'object') {
  const error = 'Datos de actividad requeridos';
  console.error('[ERROR] createActivity: ' + error);
      return formatResponse(false, null, '', [error]);
    }
    
    if (!data.descripcion_actividad || typeof data.descripcion_actividad !== 'string' || data.descripcion_actividad.trim() === '') {
  const error = 'Descripción de actividad es requerida';
  console.error('[ERROR] createActivity: ' + error);
      return formatResponse(false, null, '', [error]);
    }

  console.log('[OK] createActivity: Validación básica OK');
    
    // Validar datos de actividad con reglas de negocio
  console.log('[DEBUG] createActivity: Validando datos con reglas de negocio...');
    const validation = validateActivityData(data, 'create');
    if (!validation.valid) {
  console.error('[ERROR] createActivity: Errores de validación:', validation.errors);
      return formatResponse(false, null, '', validation.errors);
    }
  console.log('[OK] createActivity: Validación de reglas de negocio OK');
    
    // Generar ID único ANTES de obtener la hoja
    let activityId;
    try {
      activityId = generateUniqueId('ACT');
  console.log('[OK] createActivity: ID generado:', activityId);
    } catch (idError) {
  console.error('[ERROR] createActivity: Error generando ID:', idError);
      return formatResponse(false, null, '', [`Error generando ID: ${idError.message}`]);
    }
    
    // Obtener hoja de actividades
    let sheet;
    try {
  console.log('[DEBUG] createActivity: Obteniendo hoja de actividades...');
      sheet = getOrCreateActivitiesSheet();
  console.log('[OK] createActivity: Hoja obtenida:', sheet.getName());
    } catch (sheetError) {
  console.error('[ERROR] createActivity: Error obteniendo hoja:', sheetError);
      return formatResponse(false, null, '', [`Error accediendo a hoja: ${sheetError.message}`]);
    }
    
    // Preparar datos básicos
  console.log('[DEBUG] createActivity: Analizando datos de usuario...');
  console.log('[DEBUG] createActivity: data.usuario =', data.usuario);
  console.log('[DEBUG] createActivity: data.correo =', data.correo);
  console.log('[DEBUG] createActivity: data.email =', data.email);
  console.log('[DEBUG] createActivity: data.creado_por =', data.creado_por);
    
    // Determinar el email del usuario con prioridad correcta
    let userEmail = 'sistema@ungrd.gov.co'; // fallback por defecto
    
    if (data.email && data.email !== 'usuario_actual') {
      userEmail = data.email;
  console.log('[OK] createActivity: Usando data.email:', userEmail);
    } else if (data.correo && data.correo !== 'usuario_actual') {
      userEmail = data.correo;
  console.log('[OK] createActivity: Usando data.correo:', userEmail);
    } else if (data.creado_por && data.creado_por !== 'usuario_actual') {
      userEmail = data.creado_por;
  console.log('[OK] createActivity: Usando data.creado_por:', userEmail);
    } else if (data.usuario && data.usuario !== 'usuario_actual' && data.usuario.includes('@')) {
      userEmail = data.usuario;
  console.log('[OK] createActivity: Usando data.usuario (contiene @):', userEmail);
    } else {
  console.log('[WARN] createActivity: No se encontró email válido, usando fallback:', userEmail);
    }
    
  const completeData = {
      actividad_id: activityId,
      descripcion_actividad: data.descripcion_actividad.trim(),
      area_id: data.area_id || '',
      subproceso_id: data.subproceso_id || '',
      objetivo_id: data.objetivo_id || '',
      estrategia_id: data.estrategia_id || '', 
      linea_id: data.linea_id || '',
      indicador_id: data.indicador_id || '',
      plan_id: data.plan_id || '',
      bimestre_id: data.bimestre_id || '',
      mipg: data.mipg || '',
      fuente: data.fuente || '',
      usuario: data.usuario || 'sistema',
      creado_por: userEmail, // Usar el email determinado correctamente
  // Guardar timestamps de auditoría como fecha-only (YYYY-MM-DD)
  creado_el: getCurrentDateOnly(),
  actualizado_el: getCurrentDateOnly()
    };
    
  console.log('[OK] createActivity: creado_por final =', completeData.creado_por);
    
    // Resolver códigos a labels para guardar en la hoja
  console.log('[DEBUG] createActivity: Resolviendo códigos a labels...');
    const dataForSheet = { ...completeData };
    
    // Resolver área (derivada del subproceso)
    if (data.subproceso_id) {
      const subprocesoResult = getCatalogByCode(data.subproceso_id);
      if (subprocesoResult.success) {
  console.log(` [OK] Subproceso resuelto: ${data.subproceso_id} -> ${subprocesoResult.data.label}`);
        dataForSheet.subproceso = subprocesoResult.data.label;
        
        // Resolver área padre
        if (subprocesoResult.data.parent_code) {
          const areaResult = getCatalogByCode(subprocesoResult.data.parent_code);
          if (areaResult.success) {
            console.log(` [OK] Área resuelta: ${subprocesoResult.data.parent_code} -> ${areaResult.data.label}`);
            dataForSheet.area = areaResult.data.label;
          } else {
            console.log(` [ERROR] No se pudo resolver área: ${subprocesoResult.data.parent_code}`);
            dataForSheet.area = subprocesoResult.data.parent_code;
          }
        } else {
          dataForSheet.area = '';
        }
      } else {
  console.log(` [ERROR] No se pudo resolver subproceso: ${data.subproceso_id}`);
        dataForSheet.subproceso = data.subproceso_id;
        dataForSheet.area = '';
      }
    } else {
      dataForSheet.subproceso = '';
      dataForSheet.area = '';
    }
    
    // Resolver línea de acción
    if (data.linea_id) {
      const lineaResult = getCatalogByCode(data.linea_id);
      if (lineaResult.success) {
  console.log(` [OK] Línea resuelta: ${data.linea_id} -> ${lineaResult.data.label}`);
        dataForSheet.linea = lineaResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver línea: ${data.linea_id}`);
        dataForSheet.linea = data.linea_id; // fallback al código
      }
    } else {
      dataForSheet.linea = '';
    }
    
    // Resolver indicador
    if (data.indicador_id) {
      const indicadorResult = getCatalogByCode(data.indicador_id);
      if (indicadorResult.success) {
  console.log(` [OK] Indicador resuelto: ${data.indicador_id} -> ${indicadorResult.data.label}`);
        dataForSheet.indicador = indicadorResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver indicador: ${data.indicador_id}`);
        dataForSheet.indicador = data.indicador_id; // fallback al código
      }
    } else {
      dataForSheet.indicador = '';
    }
    
    // Resolver plan
    if (data.plan_id) {
      const planResult = getCatalogByCode(data.plan_id);
      if (planResult.success) {
  console.log(` [OK] Plan resuelto: ${data.plan_id} -> ${planResult.data.label}`);
        dataForSheet.plan = planResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver plan: ${data.plan_id}`);
        dataForSheet.plan = data.plan_id; // fallback al código
      }
    } else {
      dataForSheet.plan = '';
    }
    
    // Resolver MIPG
    if (data.mipg) {
      const mipgResult = getCatalogByCode(data.mipg);
      if (mipgResult.success) {
  console.log(` [OK] MIPG resuelto: ${data.mipg} -> ${mipgResult.data.label}`);
        dataForSheet.mipg = mipgResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver MIPG: ${data.mipg}`);
        dataForSheet.mipg = data.mipg; // fallback al código
      }
    } else {
      dataForSheet.mipg = '';
    }
    
    // Resolver fuente
    if (data.fuente) {
      const fuenteResult = getCatalogByCode(data.fuente);
      if (fuenteResult.success) {
  console.log(` [OK] Fuente resuelta: ${data.fuente} -> ${fuenteResult.data.label}`);
        dataForSheet.fuente = fuenteResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver fuente: ${data.fuente}`);
        dataForSheet.fuente = data.fuente; // fallback al código
      }
    } else {
      dataForSheet.fuente = '';
    }
    
    // Asegurar que tenemos todos los campos básicos
    dataForSheet.meta_indicador_valor = data.meta_indicador_valor || '';
    dataForSheet.entregable = data.entregable || '';
    dataForSheet.presupuesto_programado = data.presupuesto_programado || '';
    
    // Para responsable, usar el email del usuario si no se proporciona otro valor
    dataForSheet.responsable = data.responsable || userEmail;
    
  // Normalizar fechas entrantes a formato YYYY-MM-DD (texto)
  dataForSheet.fecha_inicio_planeada = normalizeDateInput(data.fecha_inicio_planeada) || '';
  dataForSheet.fecha_fin_planeada = normalizeDateInput(data.fecha_fin_planeada) || '';
    dataForSheet.estado = data.estado || 'Planeada';
    
  console.log('[OK] createActivity: Datos preparados con labels:', JSON.stringify(dataForSheet, null, 2));
    
    // Insertar en la hoja usando método directo
    try {
  console.log('[DEBUG] createActivity: Insertando en hoja...');
      
      // Headers básicos que sabemos que existen (coinciden con ACTIVITY_HEADERS)
      const basicHeaders = [
        'actividad_id', 'area', 'subproceso', 'mipg', 'linea',
        'descripcion_actividad', 'indicador', 'meta_indicador_valor', 'entregable',
        'presupuesto_programado', 'fuente', 'plan', 'responsable',
        'fecha_inicio_planeada', 'fecha_fin_planeada', 'estado', 
        'creado_por', 'creado_el', 'actualizado_el'
      ];
      
      // Si la hoja está vacía, agregar headers
      if (sheet.getLastRow() === 0) {
  console.log('[DEBUG] createActivity: Agregando headers a hoja vacía');
        sheet.getRange(1, 1, 1, basicHeaders.length).setValues([basicHeaders]);
      }
      
      // Preparar fila de datos usando dataForSheet que tiene los labels
      const rowData = basicHeaders.map(header => dataForSheet[header] || '');
  console.log('[DEBUG] createActivity: Fila a insertar (con labels):', rowData);
      
      // Insertar fila
      sheet.appendRow(rowData);
  console.log('[OK] createActivity: Fila insertada exitosamente');
      
      const response = formatResponse(
        true, 
        { actividad_id: activityId, ...completeData }, 
        'Actividad creada exitosamente'
      );
      
  console.log('[OK] createActivity: === FIN EXITOSO ===');
  console.log('[DEBUG] createActivity: Respuesta:', JSON.stringify(response, null, 2));
      return response;
      
    } catch (insertError) {
  console.error('[ERROR] createActivity: Error insertando:', insertError);
      return formatResponse(false, null, '', [`Error insertando actividad: ${insertError.message}`]);
    }
    
  } catch (error) {
  console.error('[ERROR] createActivity: Error general:', error);
  console.error('[ERROR] createActivity: Stack trace:', error.stack);
    return formatResponse(false, null, '', [`Error creando actividad: ${error.message}`]);
  }
}

/**
 * Obtiene todas las actividades con filtros opcionales
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Object} Lista de actividades
 */
function getAllActivities(filters = {}) {
  try {
    const activities = readSheetAsObjects(SYSTEM_CONFIG.SHEETS.ACTIVITIES, false);
    
    let filteredActivities = activities.filter(activity => activity.actividad_id); // Solo actividades válidas
    
    // Aplicar filtros si existen
    if (filters.area_id) {
      filteredActivities = filteredActivities.filter(activity => {
        return activity.subproceso_id && isSubprocessOfArea(activity.subproceso_id, filters.area_id);
      });
    }
    
    if (filters.estado) {
      filteredActivities = filteredActivities.filter(activity => activity.estado === filters.estado);
    }
    
    if (filters.plan_id) {
      filteredActivities = filteredActivities.filter(activity => activity.plan_id === filters.plan_id);
    }
    
    if (filters.responsable) {
      const searchTerm = normalizeText(filters.responsable);
      filteredActivities = filteredActivities.filter(activity => 
        normalizeText(activity.responsable).includes(searchTerm)
      );
    }
    
    // Ordenar por fecha de creación (más recientes primero)
    filteredActivities.sort((a, b) => {
      const dateA = new Date(a.creado_el || '1970-01-01');
      const dateB = new Date(b.creado_el || '1970-01-01');
      return dateB - dateA;
    });
    
    return formatResponse(
      true, 
      filteredActivities, 
      `${filteredActivities.length} actividades obtenidas`,
      null,
      { 
        totalCount: activities.length,
        filteredCount: filteredActivities.length,
        filters: filters 
      }
    );
    
  } catch (error) {
    return handleError(error, 'getAllActivities');
  }
}

/**
 * Obtiene una actividad por su ID
 * @param {string} id - ID de la actividad
 * @returns {Object} Actividad encontrada
 */
function getActivityById(id) {
  if (!id) {
    return formatResponse(false, null, '', 'ID de actividad requerido');
  }
  
  try {
    const activity = findRowByField(SYSTEM_CONFIG.SHEETS.ACTIVITIES, 'actividad_id', id);
    
    if (!activity) {
      return formatResponse(false, null, '', `Actividad con ID '${id}' no encontrada`);
    }
    
    return formatResponse(true, activity, 'Actividad obtenida exitosamente');
    
  } catch (error) {
    return handleError(error, 'getActivityById');
  }
}

/**
 * Actualiza una actividad existente
 * @param {string} id - ID de la actividad
 * @param {Object} updateData - Datos a actualizar
 * @returns {Object} Resultado de la operación
 */
function updateActivity(id, updateData) {
  if (!id) {
    return formatResponse(false, null, '', 'ID de actividad requerido');
  }
  
  try {
    // Verificar que la actividad existe
    const existing = getActivityById(id);
    if (!existing.success) return existing;
    
    // Validar datos de actualización
    const validation = validateActivityData(updateData, 'update');
    if (!validation.valid) {
      return formatResponse(false, null, '', validation.errors);
    }
    
    // Enriquecer datos con catálogos si es necesario
    const enrichedData = enrichActivityWithCatalogData(updateData);
    
    // Preparar datos de actualización
    const processedData = prepareActivityData(id, enrichedData, 'update');
    
    // Actualizar en la hoja
    const updated = updateRowByKey(SYSTEM_CONFIG.SHEETS.ACTIVITIES, 'actividad_id', id, processedData);
    
    if (!updated) {
      return formatResponse(false, null, '', 'Error actualizando actividad en la hoja');
    }
    
    return formatResponse(
      true, 
      { actividad_id: id, ...processedData }, 
      'Actividad actualizada exitosamente'
    );
    
  } catch (error) {
    return handleError(error, 'updateActivity');
  }
}

/**
 * Elimina una actividad (eliminación lógica)
 * @param {string} id - ID de la actividad
 * @returns {Object} Resultado de la operación
 */
function deleteActivity(id) {
  if (!id) {
    return formatResponse(false, null, '', 'ID de actividad requerido');
  }
  
  try {
    // Verificar que existe
    const existing = getActivityById(id);
    if (!existing.success) return existing;
    
    // Marcar como eliminada o cancelada
    const result = updateActivity(id, { 
      estado: 'Cancelada',
      actualizado_el: getCurrentTimestamp()
    });
    
    if (result.success) {
      result.message = 'Actividad eliminada exitosamente';
    }
    
    return result;
    
  } catch (error) {
    return handleError(error, 'deleteActivity');
  }
}

// ==================== FUNCIONES DE ENRIQUECIMIENTO DE DATOS ====================

/**
 * Enriquece datos de actividad con información del catálogo
 * @param {Object} activityData - Datos de la actividad
 * @returns {Object} Datos enriquecidos
 */
function enrichActivityWithCatalogData(activityData) {
  try {
    const enriched = { ...activityData };
    
    // Derivar área y subproceso
    if (activityData.subproceso_id) {
      const subproceso = getCatalogByCode(activityData.subproceso_id);
      if (subproceso.success) {
        enriched.subproceso_nombre = subproceso.data.label;
        
        // Derivar área padre
        if (subproceso.data.parent_code) {
          const area = getCatalogByCode(subproceso.data.parent_code);
          if (area.success) {
            enriched.area_nombre = area.data.label;
          }
        }
      }
    }
    
    // Derivar estrategia y objetivo desde línea de acción
    if (activityData.linea_id) {
      const linea = getCatalogByCode(activityData.linea_id);
      if (linea.success) {
        enriched.linea_nombre = linea.data.label;
        
        // Derivar estrategia
        if (linea.data.parent_code) {
          const estrategia = getCatalogByCode(linea.data.parent_code);
          if (estrategia.success) {
            enriched.estrategia_nombre = estrategia.data.label;
            
            // Derivar objetivo
            if (estrategia.data.parent_code) {
              const objetivo = getCatalogByCode(estrategia.data.parent_code);
              if (objetivo.success) {
                enriched.objetivo_nombre = objetivo.data.label;
              }
            }
          }
        }
      }
    }
    
    return enriched;
    
  } catch (error) {
    console.error('Error enriqueciendo datos de actividad:', error);
    return activityData; // Devolver datos originales si hay error
  }
}

/**
 * Prepara datos de actividad para inserción/actualización
 * @param {string} activityId - ID de la actividad
 * @param {Object} data - Datos de la actividad
 * @param {string} operation - Operación ('create', 'update')
 * @returns {Object} Datos preparados
 */
function prepareActivityData(activityId, data, operation) {
  // Usar helper que devuelve YYYY-MM-DD
  const dateOnly = getCurrentDateOnly();
  
  const prepared = {};
  
  // Campos básicos
  prepared.actividad_id = activityId;
  prepared.subproceso_id = data.subproceso_id || '';
  prepared.mipg = data.mipg || '';
  prepared.linea_id = data.linea_id || '';
  prepared.descripcion_actividad = data.descripcion_actividad || '';
  prepared.indicador_id = data.indicador_id || '';
  prepared.meta_indicador_valor = data.meta_indicador_valor || '';
  prepared.entregable = data.entregable || '';
  prepared.presupuesto_programado = data.presupuesto_programado || '';
  prepared.fuente = data.fuente || '';
  prepared.plan_id = data.plan_id || '';
  prepared.responsable = data.responsable || '';
  // Asegurar que las fechas se almacenen como texto YYYY-MM-DD
  prepared.fecha_inicio_planeada = normalizeDateInput(data.fecha_inicio_planeada) || '';
  prepared.fecha_fin_planeada = normalizeDateInput(data.fecha_fin_planeada) || '';
  prepared.estado = data.estado || 'Planeada';
  
  // Campos de auditoría
  if (operation === 'create') {
    prepared.creado_por = data.usuario || data.creado_por || 'sistema';
    prepared.creado_el = dateOnly;
  }
  prepared.actualizado_el = dateOnly;
  
  // Campos derivados del catálogo
  prepared.area_nombre = data.area_nombre || '';
  prepared.subproceso_nombre = data.subproceso_nombre || '';
  prepared.objetivo_nombre = data.objetivo_nombre || '';
  prepared.estrategia_nombre = data.estrategia_nombre || '';
  prepared.linea_nombre = data.linea_nombre || '';
  
  return prepared;
}

// ==================== FUNCIONES DE BÚSQUEDA Y FILTROS ====================

/**
 * Busca actividades con criterios avanzados
 * @param {Object} searchCriteria - Criterios de búsqueda
 * @returns {Object} Actividades encontradas
 */
function searchActivities(searchCriteria) {
  try {
    const { query, filters = {}, sortBy = 'creado_el', sortOrder = 'desc' } = searchCriteria;
    
    // Obtener todas las actividades
    const allActivities = getAllActivities(filters);
    if (!allActivities.success) return allActivities;
    
    let activities = allActivities.data;
    
    // Aplicar búsqueda por texto si se proporciona
    if (query && query.trim()) {
      const searchTerm = normalizeText(query);
      activities = activities.filter(activity => {
        return normalizeText(activity.descripcion_actividad).includes(searchTerm) ||
               normalizeText(activity.responsable).includes(searchTerm) ||
               normalizeText(activity.entregable).includes(searchTerm) ||
               normalizeText(activity.area_nombre).includes(searchTerm) ||
               normalizeText(activity.subproceso_nombre).includes(searchTerm);
      });
    }
    
    // Ordenar resultados
    activities.sort((a, b) => {
      let valueA = a[sortBy] || '';
      let valueB = b[sortBy] || '';
      
      // Manejar fechas
      if (sortBy.includes('fecha') || sortBy.includes('_el')) {
        valueA = new Date(valueA || '1970-01-01');
        valueB = new Date(valueB || '1970-01-01');
      }
      
      if (sortOrder === 'desc') {
        return valueB > valueA ? 1 : -1;
      } else {
        return valueA > valueB ? 1 : -1;
      }
    });
    
    return formatResponse(
      true, 
      activities, 
      `${activities.length} actividades encontradas`,
      null,
      { query, filters, sortBy, sortOrder }
    );
    
  } catch (error) {
    return handleError(error, 'searchActivities');
  }
}

/**
 * Filtra actividades por múltiples criterios
 * @param {Object} filterCriteria - Criterios de filtrado
 * @returns {Object} Actividades filtradas
 */
function filterActivities(filterCriteria) {
  try {
    const activities = readSheetAsObjects(SYSTEM_CONFIG.SHEETS.ACTIVITIES, false);
    let filtered = activities.filter(activity => activity.actividad_id);
    
    // Aplicar cada filtro
    Object.keys(filterCriteria).forEach(key => {
      const value = filterCriteria[key];
      if (value !== null && value !== undefined && value !== '') {
        switch (key) {
          case 'estado':
            filtered = filtered.filter(a => a.estado === value);
            break;
          case 'area_id':
            filtered = filtered.filter(a => isSubprocessOfArea(a.subproceso_id, value));
            break;
          case 'fecha_inicio_desde':
            filtered = filtered.filter(a => !a.fecha_inicio_planeada || a.fecha_inicio_planeada >= value);
            break;
          case 'fecha_inicio_hasta':
            filtered = filtered.filter(a => !a.fecha_inicio_planeada || a.fecha_inicio_planeada <= value);
            break;
          case 'presupuesto_min':
            filtered = filtered.filter(a => {
              const presupuesto = parseFloat(a.presupuesto_programado) || 0;
              return presupuesto >= parseFloat(value);
            });
            break;
          case 'presupuesto_max':
            filtered = filtered.filter(a => {
              const presupuesto = parseFloat(a.presupuesto_programado) || 0;
              return presupuesto <= parseFloat(value);
            });
            break;
          default:
            if (typeof value === 'string') {
              filtered = filtered.filter(a => a[key] === value);
            }
        }
      }
    });
    
    return formatResponse(
      true, 
      filtered, 
      `${filtered.length} actividades filtradas`,
      null,
      { appliedFilters: filterCriteria }
    );
    
  } catch (error) {
    return handleError(error, 'filterActivities');
  }
}

// ==================== FUNCIONES DE VALIDACIÓN ====================

/**
 * Valida datos de actividad con reglas de negocio
 * @param {Object} data - Datos a validar
 * @param {string} operation - Operación ('create', 'update')
 * @returns {Object} Resultado de validación
 */
function validateActivity(data) {
  return validateActivityData(data, 'validate');
}

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Verifica si un subproceso pertenece a un área específica
 * @param {string} subprocesoId - ID del subproceso
 * @param {string} areaId - ID del área
 * @returns {boolean} True si pertenece al área
 */
function isSubprocessOfArea(subprocesoId, areaId) {
  if (!subprocesoId || !areaId) return false;
  
  try {
    // Buscar subproceso en catálogo
    const subproceso = getCatalogByCode(subprocesoId);
    if (!subproceso.success) return false;
    
    // Verificar si el padre es el área especificada
    return subproceso.data.parent_code === areaId;
    
  } catch (error) {
    console.error('Error verificando subproceso de área:', error);
    return false;
  }
}

/**
 * Obtiene o crea la hoja de actividades
 * @returns {Sheet} Hoja de actividades
 */
function getOrCreateActivitiesSheet() {
  return getOrCreateSheet(SYSTEM_CONFIG.SHEETS.ACTIVITIES, ACTIVITY_HEADERS);
}

/**
 * Genera reporte de actividades
 * @param {Object} reportParams - Parámetros del reporte
 * @returns {Object} Reporte generado
 */
function generateActivityReport(reportParams) {
  try {
    const { groupBy = 'estado', includeSummary = true } = reportParams;
    
    const activities = getAllActivities(reportParams.filters);
    if (!activities.success) return activities;
    
    const data = activities.data;
    const report = {
      total: data.length,
      summary: {},
      details: data
    };
    
    if (includeSummary) {
      // Agrupar por criterio especificado
      const grouped = {};
      data.forEach(activity => {
        const key = activity[groupBy] || 'Sin especificar';
        if (!grouped[key]) {
          grouped[key] = { count: 0, activities: [] };
        }
        grouped[key].count++;
        grouped[key].activities.push(activity);
      });
      
      report.summary = grouped;
    }
    
    return formatResponse(true, report, 'Reporte generado exitosamente');
    
  } catch (error) {
    return handleError(error, 'generateActivityReport');
  }
}

/**
 * Exporta actividades en formato estructurado
 * @param {Object} exportParams - Parámetros de exportación
 * @returns {Object} Datos estructurados para exportar
 */
function exportActivities(exportParams) {
  try {
    const activities = getAllActivities(exportParams.filters);
    if (!activities.success) return activities;
    
    const exportData = {
      metadata: {
        exportDate: getCurrentTimestamp(),
        totalRecords: activities.data.length,
        filters: exportParams.filters || {},
        version: SYSTEM_CONFIG.API.VERSION
      },
      headers: ACTIVITY_HEADERS,
      data: activities.data
    };
    
    return formatResponse(true, exportData, 'Datos preparados para exportación');
    
  } catch (error) {
    return handleError(error, 'exportActivities');
  }
}

// ==================== COMPATIBILIDAD CON VERSIÓN ANTERIOR ====================

// Mantener funciones legacy para compatibilidad durante migración
function crearActividad(datos) {
  return createActivity(datos);
}

function obtenerActividades(filtros) {
  return getAllActivities(filtros);
}

function actualizarActividad(id, datos) {
  return updateActivity(id, datos);
}

function eliminarActividad(id) {
  return deleteActivity(id);
}

function buscarActividades(filtros) {
  return searchActivities({ filters: filtros });
}