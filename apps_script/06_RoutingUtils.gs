/**
 * 06_RoutingUtils.gs - Funciones de routing y utilidades
 */

function cleanPath(path) {
  if (!path) return '';
  let cleaned = path.toString().trim();
  if (cleaned.includes('?')) cleaned = cleaned.split('?')[0];
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');
  return cleaned;
}

function parsePayloadParameter(payloadParam) {
  if (!payloadParam) return {};
  try {
    const payloadStr = payloadParam.toString().trim();
    if (!payloadStr || payloadStr === '{}' || payloadStr === '') return {};
    return JSON.parse(payloadStr);
  } catch (error) {
    console.warn('Error parseando payload parameter:', error && error.message);
    return {};
  }
}

function parseRequestBody(contents) {
  try {
    if (!contents) return null;
    return JSON.parse(contents);
  } catch (error) {
    console.error('Error parseando request body:', error && error.message);
    return null;
  }
}

function getRouteHandler(path) {
  if (API_ROUTES[path]) return API_ROUTES[path];
  const pathParts = path.split('/');
  if (pathParts.length >= 2) {
    const prefix = pathParts.slice(0,2).join('/');
    if (API_ROUTES[prefix]) return API_ROUTES[prefix];
  }
  return null;
}

function requiresAuthentication(path) {
  const publicRoutes = [
    'auth/login','login','auth/createUser','createUser','ping','health','debug','getCatalogos','catalog/getAll','catalog/getByType'
  ];
  return !publicRoutes.some(route => path === route || path.startsWith(route));
}

function validateAuthentication(payload) {
  return true; // placeholder (permitir en desarrollo)
}
