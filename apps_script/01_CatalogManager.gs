/**
 * CatalogManager.gs - Gestor de Catálogos Unificados para PAI-UNGRD
 * 
 * Este módulo implementa la estructura de catálogo normalizada propuesta:
 * - Tabla única con estructura relacional
 * - UUIDs para identificadores inmutables  
 * - Códigos legibles para referencias humanas
 * - Jerarquías y relaciones parent-child
 * - Audit trail completo
 * - API limpia para CRUD de catálogos
 * 
 * Estructura del catálogo unificado:
 * | catalogo | id (UUID) | code | label | parent_code | sort_order | is_active | updated_at |
 * 
 * @author: Sistema PAI-UNGRD
 * @version: 1.0
 */

// ==================== CONFIGURACIÓN DEL CATÁLOGO UNIFICADO ====================

/**
 * Headers de la nueva estructura de catálogo unificado
 */
const CATALOG_HEADERS = [
  'catalogo',      // Tipo de catálogo (area, subproceso, objetivo, etc.)
  'id',           // UUID inmutable
  'code',         // Código legible para humanos  
  'label',        // Etiqueta/nombre del elemento
  'parent_code',  // Código del elemento padre (para jerarquías)
  'sort_order',   // Orden de visualización
  'is_active',    // Estado activo/inactivo
  'updated_at'    // Timestamp de última actualización
];

/**
 * Mapeo de tipos de catálogo y sus propiedades
 */
const CATALOG_DEFINITIONS = {
  'area': {
    prefix: 'ARE',
    hasParent: false,
    description: 'Áreas institucionales'
  },
  'subproceso': {
    prefix: 'SUB', 
    hasParent: true,
    parentType: 'area',
    description: 'Subprocesos por área'
  },
  'objetivo': {
    prefix: 'OBJ',
    hasParent: false,
    description: 'Objetivos estratégicos'
  },
  'estrategia': {
    prefix: 'EST',
    hasParent: true,
    parentType: 'objetivo',
    description: 'Estrategias por objetivo'
  },
  'linea': {
    prefix: 'LIN',
    hasParent: true,
    parentType: 'estrategia', 
    description: 'Líneas de acción'
  },
  'indicador': {
    prefix: 'IND',
    hasParent: false,
    description: 'Indicadores de gestión'
  },
  'plan': {
    prefix: 'PLA',
    hasParent: false,
    description: 'Planes y programas'
  },
  'bimestre': {
    prefix: 'BIM',
    hasParent: false,
    description: 'Períodos bimestrales'
  },
  'mipg': {
    prefix: 'MIP',
    hasParent: false,
    description: 'Dimensiones MIPG'
  },
  'fuente': {
    prefix: 'FUE',
    hasParent: false,
    description: 'Fuentes de financiación'
  }
};

// ==================== MANEJADOR PRINCIPAL ====================

/**
 * Manejador principal para requests de catálogos
 * @param {Object} body - Request body con path y payload
 * @returns {Object} Respuesta formateada
 */
function handleCatalogRequest(body) {
  try {
    const path = body.path || '';
    const payload = body.payload || {};

    // Router para endpoints de catálogos
    switch (path) {
      // Endpoints de consulta
      case 'catalog/getAll':
        return getAllCatalogs(payload.type, payload.includeInactive);
      
      case 'catalog/getByType':
        return getCatalogByType(payload.type, payload.includeInactive);
      
      case 'catalog/getById':
        return getCatalogById(payload.id);
      
      case 'catalog/getByCode':  
        return getCatalogByCode(payload.code);
      
      case 'catalog/getHierarchy':
        return getCatalogHierarchy(payload.type, payload.rootCode);
      
      // Endpoints de gestión
      case 'catalog/create':
        return createCatalogItem(payload);
      
      case 'catalog/update':
        return updateCatalogItem(payload.id, payload.data);
      
      case 'catalog/delete':
        return deleteCatalogItem(payload.id);
      
      case 'catalog/activate':
        return activateCatalogItem(payload.id);
      
      case 'catalog/deactivate':
        return deactivateCatalogItem(payload.id);
      
      // Endpoints de mantenimiento
      case 'catalog/migrate':
        return migrateLegacyCatalogs();
      
      case 'catalog/validate':
        return validateCatalogIntegrity();
      
      case 'catalog/reorder':
        return reorderCatalogItems(payload.type, payload.ordering);
      
      default:
        return formatResponse(false, null, '', `Endpoint de catálogo '${path}' no reconocido`);
    }
    
  } catch (error) {
    console.error('Error en handleCatalogRequest:', error);
    return handleError(error, 'handleCatalogRequest');
  }
}

// ==================== FUNCIONES DE CONSULTA ====================

/**
 * Obtiene todos los catálogos o de un tipo específico
 * @param {string} type - Tipo de catálogo (opcional)
 * @param {boolean} includeInactive - Incluir elementos inactivos
 * @returns {Object} Lista de catálogos
 */
function getAllCatalogs(type = null, includeInactive = false) {
  try {
    console.log('getAllCatalogs called with:', { type, includeInactive });
    
    const sheet = getOrCreateCatalogSheet();
    console.log('Sheet obtained:', sheet ? sheet.getName() : 'null');
    
    const catalogs = readSheetAsObjects(SYSTEM_CONFIG.SHEETS.CATALOG, false);
    console.log('Raw catalogs from sheet:', catalogs.length, 'items');
    console.log('First few catalog items:', catalogs.slice(0, 3));
    
    let filtered = catalogs;
    
    // Filtrar por tipo si se especifica
    if (type) {
      filtered = filtered.filter(item => item.catalogo === type);
      console.log(`Filtered by type '${type}':`, filtered.length, 'items');
    }
    
    // Filtrar por estado si no se incluyen inactivos
    if (!includeInactive) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => {
        const isActive = item.is_active;
        return isActive === true || isActive === 'TRUE' || isActive === 'true' || isActive === 1;
      });
      console.log(`Filtered by active status: ${beforeCount} -> ${filtered.length} items`);
      console.log('Sample active item check:', filtered[0] ? { is_active: filtered[0].is_active } : 'No items');
    }
    
    // Ordenar por sort_order
    filtered.sort((a, b) => {
      const orderA = parseInt(a.sort_order) || 0;
      const orderB = parseInt(b.sort_order) || 0;
      return orderA - orderB;
    });
    
    console.log('Final filtered catalogs:', filtered.length, 'items');
    
    return formatResponse(
      true, 
      filtered, 
      `${filtered.length} elementos de catálogo obtenidos`,
      null,
      { type: type, includeInactive: includeInactive }
    );
    
  } catch (error) {
    return handleError(error, 'getAllCatalogs');
  }
}

/**
 * Obtiene catálogo por tipo específico
 * @param {string} type - Tipo de catálogo
 * @param {boolean} includeInactive - Incluir inactivos
 * @returns {Object} Catálogo del tipo especificado
 */
function getCatalogByType(type, includeInactive = false) {
  if (!type || !CATALOG_DEFINITIONS[type]) {
    return formatResponse(false, null, '', `Tipo de catálogo '${type}' no válido`);
  }
  
  return getAllCatalogs(type, includeInactive);
}

/**
 * Obtiene un elemento de catálogo por su ID
 * @param {string} id - ID del elemento
 * @returns {Object} Elemento encontrado
 */
function getCatalogById(id) {
  if (!id) {
    return formatResponse(false, null, '', 'ID requerido');
  }
  
  try {
    const item = findRowByField(SYSTEM_CONFIG.SHEETS.CATALOG, 'id', id);
    
    if (!item) {
      return formatResponse(false, null, '', `Elemento con ID '${id}' no encontrado`);
    }
    
    return formatResponse(true, item, 'Elemento encontrado exitosamente');
    
  } catch (error) {
    return handleError(error, 'getCatalogById');
  }
}

/**
 * Obtiene un elemento de catálogo por su código
 * @param {string} code - Código del elemento  
 * @returns {Object} Elemento encontrado
 */
function getCatalogByCode(code) {
  if (!code) {
    return formatResponse(false, null, '', 'Código requerido');
  }
  
  try {
    const item = findRowByField(SYSTEM_CONFIG.SHEETS.CATALOG, 'code', code);
    
    if (!item) {
      return formatResponse(false, null, '', `Elemento con código '${code}' no encontrado`);
    }
    
    return formatResponse(true, item, 'Elemento encontrado exitosamente');
    
  } catch (error) {
    return handleError(error, 'getCatalogByCode');
  }
}

/**
 * Obtiene jerarquía completa de un catálogo
 * @param {string} type - Tipo de catálogo
 * @param {string} rootCode - Código raíz (opcional)
 * @returns {Object} Estructura jerárquica
 */
function getCatalogHierarchy(type, rootCode = null) {
  if (!type || !CATALOG_DEFINITIONS[type]) {
    return formatResponse(false, null, '', `Tipo de catálogo '${type}' no válido`);
  }
  
  try {
    const allItems = getAllCatalogs(type, false);
    if (!allItems.success) return allItems;
    
    const items = allItems.data;
    
    // Crear mapa de elementos por código para acceso rápido
    const itemMap = {};
    items.forEach(item => {
      itemMap[item.code] = { ...item, children: [] };
    });
    
    // Construir jerarquía
    const roots = [];
    
    items.forEach(item => {
      const element = itemMap[item.code];
      
      if (item.parent_code && itemMap[item.parent_code]) {
        // Tiene padre, agregarlo como hijo
        itemMap[item.parent_code].children.push(element);
      } else {
        // Es raíz
        roots.push(element);
      }
    });
    
    // Si se especifica un código raíz, filtrar
    let result = roots;
    if (rootCode && itemMap[rootCode]) {
      result = [itemMap[rootCode]];
    }
    
    return formatResponse(true, result, 'Jerarquía obtenida exitosamente');
    
  } catch (error) {
    return handleError(error, 'getCatalogHierarchy');
  }
}

// ==================== FUNCIONES DE GESTIÓN ====================

/**
 * Crea un nuevo elemento de catálogo
 * @param {Object} data - Datos del elemento
 * @returns {Object} Resultado de la operación
 */
function createCatalogItem(data) {
  try {
    // Validar datos
    const validation = validateCatalogData(data, 'create');
    if (!validation.valid) {
      return formatResponse(false, null, '', validation.errors);
    }
    
    const sheet = getOrCreateCatalogSheet();
    
    // Generar ID y código únicos
    const id = generateUUID();
    const code = data.code || generateCatalogCode(data.catalogo, data.label);
    
    // Verificar que el código sea único
    const existingByCode = findRowByField(SYSTEM_CONFIG.SHEETS.CATALOG, 'code', code);
    if (existingByCode) {
      return formatResponse(false, null, '', `Ya existe un elemento con código '${code}'`);
    }
    
    // Obtener siguiente orden si no se especifica
    let sortOrder = data.sort_order;
    if (!sortOrder) {
      const typeItems = getAllCatalogs(data.catalogo, true);
      sortOrder = typeItems.success ? typeItems.data.length + 1 : 1;
    }
    
    // Preparar datos completos
    const itemData = [
      data.catalogo,                           // catalogo
      id,                                      // id  
      code,                                    // code
      data.label || '',                        // label
      data.parent_code || '',                  // parent_code
      sortOrder,                               // sort_order  
      data.is_active !== false ? 'TRUE' : 'FALSE', // is_active
      getCurrentTimestamp()                    // updated_at
    ];
    
    // Insertar en la hoja
    sheet.appendRow(itemData);
    
    // Preparar respuesta con datos completos
    const createdItem = {
      catalogo: data.catalogo,
      id: id,
      code: code,
      label: data.label,
      parent_code: data.parent_code || '',
      sort_order: sortOrder,
      is_active: data.is_active !== false,
      updated_at: getCurrentTimestamp()
    };
    
    return formatResponse(
      true, 
      createdItem, 
      'Elemento de catálogo creado exitosamente'
    );
    
  } catch (error) {
    return handleError(error, 'createCatalogItem');
  }
}

/**
 * Actualiza un elemento de catálogo existente
 * @param {string} id - ID del elemento
 * @param {Object} updateData - Datos a actualizar
 * @returns {Object} Resultado de la operación  
 */
function updateCatalogItem(id, updateData) {
  if (!id) {
    return formatResponse(false, null, '', 'ID requerido para actualizar');
  }
  
  try {
    // Verificar que el elemento existe
    const existing = getCatalogById(id);
    if (!existing.success) return existing;
    
    // Validar datos de actualización
    const validation = validateCatalogData(updateData, 'update');
    if (!validation.valid) {
      return formatResponse(false, null, '', validation.errors);
    }
    
    // Si se actualiza el código, verificar unicidad
    if (updateData.code && updateData.code !== existing.data.code) {
      const existingByCode = findRowByField(SYSTEM_CONFIG.SHEETS.CATALOG, 'code', updateData.code);
      if (existingByCode && existingByCode.id !== id) {
        return formatResponse(false, null, '', `Ya existe un elemento con código '${updateData.code}'`);
      }
    }
    
    // Preparar datos de actualización con timestamp
    const dataToUpdate = {
      ...updateData,
      updated_at: getCurrentTimestamp()
    };
    
    // Actualizar en la hoja
    const updated = updateRowByKey(SYSTEM_CONFIG.SHEETS.CATALOG, 'id', id, dataToUpdate);
    
    if (!updated) {
      return formatResponse(false, null, '', 'Error actualizando elemento en la hoja');
    }
    
    return formatResponse(
      true, 
      { id: id, ...dataToUpdate }, 
      'Elemento de catálogo actualizado exitosamente'
    );
    
  } catch (error) {
    return handleError(error, 'updateCatalogItem');
  }
}

/**
 * Elimina un elemento de catálogo (eliminación lógica)
 * @param {string} id - ID del elemento
 * @returns {Object} Resultado de la operación
 */
function deleteCatalogItem(id) {
  if (!id) {
    return formatResponse(false, null, '', 'ID requerido para eliminar');
  }
  
  try {
    // Verificar que existe
    const existing = getCatalogById(id);
    if (!existing.success) return existing;
    
    // Verificar que no tenga elementos dependientes
    const hasChildren = checkForDependentItems(existing.data.code);
    if (hasChildren.length > 0) {
      return formatResponse(
        false, 
        null, 
        '', 
        `No se puede eliminar: existen ${hasChildren.length} elementos dependientes`
      );
    }
    
    // Realizar eliminación lógica (desactivar)
    const result = updateCatalogItem(id, { is_active: false });
    
    if (result.success) {
      result.message = 'Elemento de catálogo eliminado exitosamente';
    }
    
    return result;
    
  } catch (error) {
    return handleError(error, 'deleteCatalogItem');
  }
}

/**
 * Activa un elemento de catálogo
 * @param {string} id - ID del elemento
 * @returns {Object} Resultado de la operación
 */
function activateCatalogItem(id) {
  return updateCatalogItem(id, { is_active: true });
}

/**
 * Desactiva un elemento de catálogo  
 * @param {string} id - ID del elemento
 * @returns {Object} Resultado de la operación
 */
function deactivateCatalogItem(id) {
  return updateCatalogItem(id, { is_active: false });
}

// ==================== FUNCIONES DE VALIDACIÓN ====================

/**
 * Valida datos de catálogo
 * @param {Object} data - Datos a validar
 * @param {string} operation - Operación ('create', 'update')  
 * @returns {Object} Resultado de validación
 */
function validateCatalogData(data, operation = 'create') {
  const errors = [];
  
  // Validaciones para crear
  if (operation === 'create') {
    if (!isNotEmpty(data.catalogo)) {
      errors.push('Tipo de catálogo es requerido');
    } else if (!CATALOG_DEFINITIONS[data.catalogo]) {
      errors.push(`Tipo de catálogo '${data.catalogo}' no válido`);
    }
    
    if (!isNotEmpty(data.label)) {
      errors.push('Etiqueta es requerida');
    }
  }
  
  // Validaciones comunes
  if (data.catalogo && !CATALOG_DEFINITIONS[data.catalogo]) {
    errors.push(`Tipo de catálogo '${data.catalogo}' no válido`);
  }
  
  if (data.code && !/^[A-Z0-9_]{3,20}$/.test(data.code)) {
    errors.push('Código debe contener solo letras mayúsculas, números y guiones bajos (3-20 caracteres)');
  }
  
  if (data.sort_order && (isNaN(data.sort_order) || parseInt(data.sort_order) < 0)) {
    errors.push('Orden debe ser un número mayor o igual a 0');
  }
  
  // Validar relación padre-hijo si aplica
  if (data.catalogo && CATALOG_DEFINITIONS[data.catalogo].hasParent) {
    if (operation === 'create' && !isNotEmpty(data.parent_code)) {
      errors.push(`${CATALOG_DEFINITIONS[data.catalogo].description} requiere elemento padre`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Verifica elementos dependientes de un código  
 * @param {string} code - Código a verificar
 * @returns {Array} Lista de elementos dependientes
 */
function checkForDependentItems(code) {
  const allItems = getAllCatalogs(null, true);
  if (!allItems.success) return [];
  
  return allItems.data.filter(item => item.parent_code === code);
}

// ==================== FUNCIONES DE MIGRACIÓN ====================

/**
 * Migra catálogos del sistema legacy al nuevo formato
 * @returns {Object} Resultado de la migración
 */
function migrateLegacyCatalogs() {
  try {
    console.log('Iniciando migración de catálogos legacy...');
    
    // Verificar que existe hoja legacy
    const spreadsheet = openSystemSpreadsheet();
    const legacySheet = spreadsheet.getSheetByName(SYSTEM_CONFIG.SHEETS.LEGACY_CATALOGS);
    
    if (!legacySheet) {
      return formatResponse(false, null, '', 'No se encontró hoja de catálogos legacy');
    }
    
    // Crear hoja del nuevo catálogo
    const newSheet = getOrCreateCatalogSheet();
    
    const migratedItems = [];
    const errors = [];
    
    // Migrar cada tipo de catálogo
    Object.keys(CATALOG_DEFINITIONS).forEach(catalogType => {
      try {
        const legacyData = readLegacyCatalogType(catalogType);
        
        legacyData.forEach((item, index) => {
          try {
            const migratedItem = migrateLegacyItem(item, catalogType, index + 1);
            migratedItems.push(migratedItem);
            
            // Insertar en nueva hoja
            const rowData = [
              migratedItem.catalogo,
              migratedItem.id,
              migratedItem.code,
              migratedItem.label,
              migratedItem.parent_code,
              migratedItem.sort_order,
              'TRUE',
              getCurrentTimestamp()
            ];
            
            newSheet.appendRow(rowData);
            
          } catch (itemError) {
            errors.push(`Error migrando ${catalogType} item ${index + 1}: ${itemError.message}`);
          }
        });
        
      } catch (typeError) {
        errors.push(`Error migrando tipo ${catalogType}: ${typeError.message}`);
      }
    });
    
    return formatResponse(
      true,
      { 
        migratedCount: migratedItems.length,
        errors: errors
      },
      `Migración completada: ${migratedItems.length} elementos migrados`,
      errors.length > 0 ? errors : null
    );
    
  } catch (error) {
    return handleError(error, 'migrateLegacyCatalogs');
  }
}

/**
 * Lee un tipo de catálogo del sistema legacy
 * @param {string} catalogType - Tipo de catálogo
 * @returns {Array} Datos del catálogo legacy
 */
function readLegacyCatalogType(catalogType) {
  // Esta función necesitaría implementarse según la estructura actual
  // Por ahora devolver array vacío
  return [];
}

/**
 * Migra un elemento individual del sistema legacy
 * @param {Object} legacyItem - Elemento legacy
 * @param {string} catalogType - Tipo de catálogo  
 * @param {number} sortOrder - Orden de clasificación
 * @returns {Object} Elemento migrado
 */
function migrateLegacyItem(legacyItem, catalogType, sortOrder) {
  return {
    catalogo: catalogType,
    id: generateUUID(),
    code: generateCatalogCode(catalogType, legacyItem.nombre || legacyItem.label, sortOrder),
    label: legacyItem.nombre || legacyItem.label || '',
    parent_code: legacyItem.parent_code || '',
    sort_order: sortOrder,
    is_active: true,
    updated_at: getCurrentTimestamp()
  };
}

// ==================== FUNCIONES DE MANTENIMIENTO ====================

/**
 * Valida integridad referencial del catálogo
 * @returns {Object} Resultado de la validación
 */
function validateCatalogIntegrity() {
  try {
    const allItems = getAllCatalogs(null, true);
    if (!allItems.success) return allItems;
    
    const items = allItems.data;
    const errors = [];
    const warnings = [];
    
    // Crear mapa de códigos existentes
    const codeMap = {};
    items.forEach(item => {
      codeMap[item.code] = item;
    });
    
    // Validar cada elemento
    items.forEach(item => {
      // Verificar que parent_code existe si está especificado
      if (item.parent_code && !codeMap[item.parent_code]) {
        errors.push(`${item.code}: Código padre '${item.parent_code}' no existe`);
      }
      
      // Verificar definición de catálogo
      if (!CATALOG_DEFINITIONS[item.catalogo]) {
        errors.push(`${item.code}: Tipo de catálogo '${item.catalogo}' no válido`);
      } else {
        const definition = CATALOG_DEFINITIONS[item.catalogo];
        
        // Verificar requerimiento de padre
        if (definition.hasParent && !item.parent_code) {
          warnings.push(`${item.code}: Debería tener elemento padre según definición`);
        }
        
        // Verificar tipo correcto del padre
        if (definition.hasParent && item.parent_code && codeMap[item.parent_code]) {
          const parent = codeMap[item.parent_code];
          if (parent.catalogo !== definition.parentType) {
            errors.push(`${item.code}: Padre debería ser de tipo '${definition.parentType}' pero es '${parent.catalogo}'`);
          }
        }
      }
      
      // Verificar formato de código
      if (!/^[A-Z0-9_]{3,20}$/.test(item.code)) {
        warnings.push(`${item.code}: Formato de código no sigue convenciones`);
      }
    });
    
    // Detectar códigos duplicados
    const codeCounts = {};
    items.forEach(item => {
      codeCounts[item.code] = (codeCounts[item.code] || 0) + 1;
    });
    
    Object.keys(codeCounts).forEach(code => {
      if (codeCounts[code] > 1) {
        errors.push(`Código '${code}' está duplicado (${codeCounts[code]} veces)`);
      }
    });
    
    return formatResponse(
      errors.length === 0,
      {
        totalItems: items.length,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        errors: errors,
        warnings: warnings
      },
      errors.length === 0 ? 'Integridad del catálogo validada exitosamente' : 'Se encontraron problemas de integridad',
      errors.length > 0 ? errors : null
    );
    
  } catch (error) {
    return handleError(error, 'validateCatalogIntegrity');
  }
}

/**
 * Reordena elementos de un tipo de catálogo
 * @param {string} type - Tipo de catálogo
 * @param {Array} ordering - Array de códigos en el orden deseado
 * @returns {Object} Resultado de la operación
 */
function reorderCatalogItems(type, ordering) {
  if (!type || !CATALOG_DEFINITIONS[type]) {
    return formatResponse(false, null, '', `Tipo de catálogo '${type}' no válido`);
  }
  
  if (!Array.isArray(ordering)) {
    return formatResponse(false, null, '', 'Orden debe ser un array de códigos');
  }
  
  try {
    const typeItems = getCatalogByType(type, false);
    if (!typeItems.success) return typeItems;
    
    const items = typeItems.data;
    const updated = [];
    
    // Actualizar orden de cada elemento
    ordering.forEach((code, index) => {
      const item = items.find(i => i.code === code);
      if (item) {
        const result = updateCatalogItem(item.id, { sort_order: index + 1 });
        if (result.success) {
          updated.push(code);
        }
      }
    });
    
    return formatResponse(
      true,
      { updatedItems: updated },
      `Reordenados ${updated.length} elementos exitosamente`
    );
    
  } catch (error) {
    return handleError(error, 'reorderCatalogItems');
  }
}

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Obtiene o crea la hoja del catálogo unificado
 * @returns {Sheet} Hoja del catálogo
 */
function getOrCreateCatalogSheet() {
  return getOrCreateSheet(SYSTEM_CONFIG.SHEETS.CATALOG, CATALOG_HEADERS);
}

/**
 * Busca elementos de catálogo con filtros avanzados
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Object} Elementos filtrados
 */
function searchCatalog(filters) {
  try {
    let result = getAllCatalogs(filters.type, filters.includeInactive);
    if (!result.success) return result;
    
    let items = result.data;
    
    // Aplicar filtros adicionales
    if (filters.search) {
      const searchTerm = normalizeText(filters.search);
      items = items.filter(item => 
        normalizeText(item.label).includes(searchTerm) ||
        normalizeText(item.code).includes(searchTerm)
      );
    }
    
    if (filters.parent_code) {
      items = items.filter(item => item.parent_code === filters.parent_code);
    }
    
    return formatResponse(true, items, `${items.length} elementos encontrados`);
    
  } catch (error) {
    return handleError(error, 'searchCatalog');
  }
}