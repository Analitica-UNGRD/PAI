import {
  normalizarRol as normalizarRolInterno,
  obtenerPermisosRol as obtenerPermisosRolInterno,
  tienePermiso as tienePermisoInterno,
  esRolAdministrador as esRolAdministradorInterno,
  esRolContribuidor as esRolContribuidorInterno,
  esRolVisualizador as esRolVisualizadorInterno
} from '../../lib/roles.js';
import { toast } from '../../lib/ui.js';

export const normalizarRol = normalizarRolInterno;
export const obtenerPermisosRol = obtenerPermisosRolInterno;
export const tienePermiso = tienePermisoInterno;
export const esRolAdministrador = esRolAdministradorInterno;
export const esRolContribuidor = esRolContribuidorInterno;
export const esRolVisualizador = esRolVisualizadorInterno;

/**
 * Obtiene el email del usuario autenticado actual
 * @returns {string} Email del usuario o fallback
 */
export function obtenerEmailUsuarioActual() {
  try {
    console.log('[DEBUG] obtenerEmailUsuarioActual: Buscando email del usuario...');

    const storageEmail = localStorage.getItem('auth_email');
    console.log('[DEBUG] auth_email en localStorage:', storageEmail);

    if (storageEmail && storageEmail.includes('@') && storageEmail !== 'null' && storageEmail !== 'undefined') {
      console.log('[OK] Email obtenido desde localStorage:', storageEmail);
      return storageEmail;
    }

    const token = localStorage.getItem('auth_token');
    console.log('[DEBUG] auth_token en localStorage:', token ? 'existe' : 'no existe');

    if (token && token !== 'null') {
      try {
        const decoded = atob(token);
        const parts = decoded.split('|');
        if (parts.length >= 1 && parts[0].includes('@')) {
          console.log('[OK] Email obtenido desde token:', parts[0]);
          return parts[0];
        }
      } catch (tokenError) {
        console.warn('[WARN] Error decodificando token:', tokenError);
      }
    }

    console.warn('[WARN] No se pudo obtener email del usuario, usando fallback');
    return 'usuario@gestiondelriesgo.gov.co';
  } catch (error) {
    console.error('[ERROR] Error obteniendo email del usuario:', error);
    return 'usuario@gestiondelriesgo.gov.co';
  }
}

/**
 * Serializa un formulario a objeto
 */
export function serializarFormulario(formulario) {
  const formData = new FormData(formulario);
  const objeto = {};
  const processedKeys = new Set();

  for (const key of formData.keys()) {
    if (processedKeys.has(key)) continue;
    const values = formData.getAll(key);
    objeto[key] = values.length > 1 ? values : values[0];
    processedKeys.add(key);
  }

  return objeto;
}

/**
 * Muestra un mensaje toast simple
 */
export function mostrarToast(mensaje, tipo = 'info', opciones = {}) {
  console.log(`[TOAST] ${tipo}: ${mensaje}`);
  try {
    const normalizedOptions = typeof opciones === 'number' ? { duration: opciones } : opciones || {};
    toast(tipo, mensaje, normalizedOptions);
  } catch (error) {
    console.error('[ERROR] No se pudo mostrar el toast mediante UI:', error);
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`${(tipo || 'info').toUpperCase()}: ${mensaje}`);
    }
  }
}

/**
 * Formatea una fecha a string legible
 */
export function formatearFecha(fecha) {
  if (!fecha) return '';
  try {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('[ERROR] Error formateando fecha:', error);
    return fecha.toString();
  }
}

/**
 * Convierte valores de formulario aplicando un esquema básico de tipos
 */
export function convertirValoresFormulario(valores, esquema = {}) {
  if (!valores) return {};

  const resultado = { ...valores };
  Object.keys(resultado).forEach(key => {
    const valor = resultado[key];
    if (esquema[key]?.tipo === 'fecha' || esquema[key]?.tipo === 'datetime') {
      if (valor && typeof valor === 'string') {
        try {
          resultado[key] = new Date(valor);
        } catch (e) {
          console.warn(`[WARN] Error convirtiendo fecha ${key}:`, e);
        }
      }
    } else if (esquema[key]?.tipo === 'numero' || esquema[key]?.tipo === 'decimal') {
      if (valor !== null && valor !== undefined && valor !== '') {
        resultado[key] = Number(valor);
      }
    } else if (esquema[key]?.tipo === 'boolean' || esquema[key]?.tipo === 'checkbox') {
      if (typeof valor === 'string') {
        resultado[key] = ['true', 'si', 'yes', '1', 'on'].includes(valor.toLowerCase());
      }
    }
  });

  return resultado;
}

/**
 * Obtiene el rol almacenado del usuario autenticado
 */
export function obtenerRolUsuarioActual() {
  try {
    const storedRole = localStorage.getItem('auth_role');
    if (storedRole && storedRole !== 'null' && storedRole !== 'undefined') {
      return storedRole.trim();
    }
    return '';
  } catch (error) {
    console.error('[ERROR] Error obteniendo rol del usuario:', error);
    return '';
  }
}

/**
 * Retorna el rol normalizado usando la tabla de permisos
 */
export function obtenerRolUsuarioNormalizado() {
  return normalizarRolInterno(obtenerRolUsuarioActual());
}

/**
 * Obtiene el área asociada al usuario autenticado
 * @returns {string} Área del usuario o cadena vacía si no se encuentra
 */
export function obtenerAreaUsuarioActual() {
  try {
    const storedArea = localStorage.getItem('auth_area');
    if (storedArea && storedArea !== 'null' && storedArea !== 'undefined') {
      return storedArea.trim();
    }
    return '';
  } catch (error) {
    console.error('[ERROR] Error obteniendo área del usuario:', error);
    return '';
  }
}

function normalizarTextoBasico(valor) {
  if (valor === null || valor === undefined) return '';
  try {
    return valor
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_/]+/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return valor.toString().toLowerCase().trim();
  }
}

function generarVariantesArea(valor) {
  const base = normalizarTextoBasico(valor);
  if (!base) return [];

  const variantes = new Set([base]);
  const separadores = ['-', '|'];
  separadores.forEach(separador => {
    if (base.includes(separador)) {
      base.split(separador)
        .map(segmento => segmento.trim())
        .filter(Boolean)
        .forEach(segmento => variantes.add(segmento));
    }
  });

  return Array.from(variantes);
}

export function coincideAreaUsuario(areaUsuario, valores = []) {
  const variantesUsuario = generarVariantesArea(areaUsuario);
  if (!variantesUsuario.length) return false;

  const listaValores = Array.isArray(valores) ? valores : [valores];
  for (const valor of listaValores) {
    const variantesValor = generarVariantesArea(valor);
    if (!variantesValor.length) continue;
    if (variantesValor.some(token => variantesUsuario.includes(token))) {
      return true;
    }
  }

  return false;
}

if (typeof window !== 'undefined') {
  window.obtenerEmailUsuarioActual = window.obtenerEmailUsuarioActual || obtenerEmailUsuarioActual;
  window.obtenerRolUsuarioActual = window.obtenerRolUsuarioActual || obtenerRolUsuarioActual;
  window.obtenerAreaUsuarioActual = window.obtenerAreaUsuarioActual || obtenerAreaUsuarioActual;
}