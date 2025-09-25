/**
 * 07_LegacyHandlers.gs - Handlers para compatibilidad con rutas legacy
 */

function handleLegacyCatalogRoutes(request) {
  const { path, payload = {} } = request;
  switch (path) {
    case 'getCatalogos':
      console.log('[DEBUG] Iniciando getCatalogos endpoint');
      try {
        const catalogos = getCatalogosAgrupados();
        console.log('[DEBUG] getCatalogosAgrupados() resultado:', JSON.stringify(catalogos, null, 2));
        return catalogos;
      } catch (error) {
        console.error('[ERROR] en getCatalogos:', error);
        return formatResponse(false, null, '', `Error en getCatalogos: ${error.message}`);
      }
    default:
      return formatResponse(false, null, '', `Ruta legacy de catálogo '${path}' no reconocida`);
  }
}

function handleLegacyActivityRoutes(request) {
  const { path, payload = {} } = request;
  console.log('[DEBUG] handleLegacyActivityRoutes: path =', path);
  try {
    if (path === 'actividades/obtener') {
      return handleActivityRequest({ path: 'activities/getAll', payload: payload });
    } else if (path === 'actividades/crear') {
      return handleActivityRequest({ path: 'activities/create', payload: payload });
    } else if (path === 'actividades/actualizar') {
      return handleActivityRequest({ path: 'activities/update', payload: payload });
    } else if (path === 'actividades/eliminar') {
      return handleActivityRequest({ path: 'activities/delete', payload: payload });
    } else if (path === 'actividades/buscar') {
      return handleActivityRequest({ path: 'activities/search', payload: payload });
    } else {
      return { success: false, error: `Ruta de actividad '${path}' no reconocida`, timestamp: new Date().toISOString() };
    }
  } catch (error) {
    console.error('[ERROR] Debug: Error en handleLegacyActivityRoutes:', error);
    return { success: false, error: `Error procesando actividad: ${error.message}`, timestamp: new Date().toISOString() };
  }
}
