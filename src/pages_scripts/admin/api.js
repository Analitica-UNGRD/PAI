/**
 * api.js - Servicios de comunicación con el backend para el panel de administración
 */

import { shouldUseTextPlain, resolveScriptUrl } from '../actividades/config.js';
import { obtenerEmailUsuarioActual } from '../actividades/utils.js';

/**
 * Clase para manejar la comunicación con el backend
 */
class ApiService {
  constructor() {
    this.backendUrl = resolveScriptUrl();
    this.catalogosCache = {};
  }

  /**
   * Envía una solicitud al backend
   * @param {string} endpoint - Endpoint a llamar
   * @param {Object} payload - Datos a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Respuesta del servidor
   */
  async callBackend(endpoint, payload = {}, options = {}) {
    const { loaderMessage = 'Cargando...' } = options;

    if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim()) {
      throw new Error('Endpoint inválido');
    }

    const sanitizedEndpoint = endpoint.trim();

    try {
      if (typeof window !== 'undefined' && window.showLoader && loaderMessage) {
        window.showLoader(loaderMessage);
      }

      const url = this.backendUrl;

      const headers = {
        'Content-Type': shouldUseTextPlain(url) ? 'text/plain' : 'application/json',
      };

      const requestPayload = payload && typeof payload === 'object' ? payload : {};

      const data = {
        path: sanitizedEndpoint,
        payload: requestPayload,
        usuario: requestPayload.usuario || obtenerEmailUsuarioActual(),
        ...requestPayload
      };

      const fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        cache: 'no-store',
        credentials: 'omit'
      };

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result && result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      console.error(`[ERROR] Error en callBackend(${sanitizedEndpoint}):`, error);
      throw error;
    } finally {
      if (typeof window !== 'undefined' && window.hideLoader) {
        window.hideLoader();
      }
    }
  }

  /**
   * Obtiene un catálogo específico
   * @param {string} catalogo - Nombre del catálogo
   * @returns {Promise<Array>} Elementos del catálogo
   */
  async fetchCatalogo(catalogo, options = {}) {
    const { forceRefresh = false } = options;

    if (!catalogo) {
      throw new Error('Tipo de catálogo requerido');
    }

    if (forceRefresh) {
      this.clearCatalogCache(catalogo);
    }

    if (this.catalogosCache[catalogo]) {
      return this.catalogosCache[catalogo];
    }

    const result = await this.callBackend(
      'catalog/getByType',
      { type: catalogo, includeInactive: true },
      { loaderMessage: null }
    );

    if (!result) {
      throw new Error('Respuesta inválida del servidor');
    }

    if (result.success === false) {
      const errorMessage = (result.errors && result.errors[0]) || result.message || 'No se pudo cargar el catálogo';
      throw new Error(errorMessage);
    }

    const items = Array.isArray(result.data) ? result.data : [];
    this.catalogosCache[catalogo] = items;
    return items;
  }

  clearCatalogCache(catalogo) {
    if (catalogo) {
      delete this.catalogosCache[catalogo];
    } else {
      this.catalogosCache = {};
    }
  }

  async createCatalogItem(data) {
    if (!data || !data.catalogo) {
      throw new Error('Datos incompletos para crear el catálogo');
    }

    const payload = {
      catalogo: data.catalogo,
      code: data.code || undefined,
      label: data.label,
      parent_code: data.parent_code || undefined,
      sort_order: data.sort_order ?? undefined,
      is_active: data.is_active !== undefined ? data.is_active : true
    };

  const result = await this.callBackend('catalog/create', payload, { loaderMessage: null });

    if (!result || result.success === false) {
      const errorMessage = (result && ((result.errors && result.errors[0]) || result.message)) || 'No se pudo crear el elemento';
      throw new Error(errorMessage);
    }

    this.clearCatalogCache(data.catalogo);
    return result.data;
  }

  async updateCatalogItem(id, data) {
    if (!id) {
      throw new Error('ID requerido para actualizar');
    }

    const result = await this.callBackend('catalog/update', {
      id,
      data: {
        catalogo: data.catalogo,
        code: data.code || undefined,
        label: data.label,
        parent_code: data.parent_code || undefined,
        sort_order: data.sort_order ?? undefined,
        is_active: data.is_active
      }
    }, { loaderMessage: null });

    if (!result || result.success === false) {
      const errorMessage = (result && ((result.errors && result.errors[0]) || result.message)) || 'No se pudo actualizar el elemento';
      throw new Error(errorMessage);
    }

    if (data.catalogo) {
      this.clearCatalogCache(data.catalogo);
    } else {
      this.clearCatalogCache();
    }

    return result.data;
  }

  async deleteCatalogItem(id) {
    if (!id) {
      throw new Error('ID requerido para eliminar');
    }

  const result = await this.callBackend('catalog/delete', { id }, { loaderMessage: null });

    if (!result || result.success === false) {
      const errorMessage = (result && ((result.errors && result.errors[0]) || result.message)) || 'No se pudo eliminar el elemento';
      throw new Error(errorMessage);
    }

    this.clearCatalogCache();
    return result.data;
  }

  async fetchUsuarios() {
    const result = await this.callBackend('auth/listUsers', {}, { loaderMessage: null });

    if (!result || result.success === false) {
      const errorMessage = (result && (result.message || result.error)) || 'No se pudo obtener la lista de usuarios';
      throw new Error(errorMessage);
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  async createUsuario({ email, password, role, area }) {
    const payload = {
      email,
      password,
      role,
      area
    };

    const result = await this.callBackend('auth/createUser', payload, { loaderMessage: 'Creando usuario...' });

    if (!result || result.success === false) {
      const errorMessage = (result && (result.message || result.error)) || 'No fue posible crear el usuario';
      throw new Error(errorMessage);
    }

    return result.data;
  }

  async updateUsuario({ email, role, area, password }) {
    if (!email) {
      throw new Error('Email requerido para actualizar usuario');
    }

    const payload = {
      email,
      role: role || undefined,
      area: area !== undefined ? area : undefined
    };

    if (password) {
      payload.password = password;
    }

    const result = await this.callBackend('auth/updateUser', payload, { loaderMessage: 'Actualizando usuario...' });

    if (!result || result.success === false) {
      const errorMessage = (result && (result.message || result.error)) || 'No fue posible actualizar el usuario';
      throw new Error(errorMessage);
    }

    return result.data;
  }

  async deleteUsuario(email) {
    if (!email) {
      throw new Error('Email requerido para eliminar usuario');
    }

    const result = await this.callBackend('auth/deleteUser', { email }, { loaderMessage: 'Eliminando usuario...' });

    if (!result || result.success === false) {
      const errorMessage = (result && (result.message || result.error)) || 'No fue posible eliminar el usuario';
      throw new Error(errorMessage);
    }

    return result.data;
  }
}

// Exportar una única instancia del servicio
const apiService = new ApiService();
export default apiService;