import {
  obtenerRolUsuarioActual,
  normalizarRol,
  obtenerPermisosRol,
  obtenerAreaUsuarioActual as obtenerAreaAsignada
} from '../actividades/utils.js';

export function obtenerContextoPermisos() {
  let rolNormalizado = '';
  try {
    const rol = obtenerRolUsuarioActual();
    rolNormalizado = normalizarRol(rol) || '';
  } catch (error) {
    console.warn('[WARN] No se pudo determinar el rol actual del usuario:', error);
    rolNormalizado = '';
  }

  let permisos = {};
  try {
    permisos = rolNormalizado ? (obtenerPermisosRol(rolNormalizado) || {}) : {};
  } catch (error) {
    console.warn('[WARN] No se pudieron obtener los permisos del rol:', error);
    permisos = {};
  }

  return {
    rol: rolNormalizado || 'visualizador',
    permisos
  };
}

export function obtenerAreaAsignadaUsuario() {
  try {
    const area = obtenerAreaAsignada();
    if (typeof area === 'string') return area.trim();
  } catch (error) {
    console.warn('[WARN] No se pudo obtener el área asignada desde utilidades compartidas:', error);
  }

  try {
    const stored = localStorage.getItem('auth_area');
    return stored ? stored.trim() : '';
  } catch (error) {
    return '';
  }
}
