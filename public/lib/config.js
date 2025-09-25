/**
 * @fileoverview Configuración central del sistema - Gestión de URLs y entornos
 * Este módulo determina qué URL de API utilizar basándose en el entorno.
 * El sistema utiliza un enfoque de cascada para seleccionar la URL base:
 * 1. Si existe un override en window.APP_CONFIG_OVERRIDE.BASE_URL, se usa esa URL (prioridad máxima)
 * 2. En desarrollo local o red privada (localhost, IPs privadas), se usa el proxy local
 * 3. En producción, se usa la URL pública del Apps Script
 */

// Config resolver:
// - Highest priority: window.APP_CONFIG_OVERRIDE.BASE_URL (useful for temporary overrides)
// - In local/private-network development (localhost, 127.0.0.1, 10.*, 172.16-31.*, 192.168.*) prefer the local proxy
// - Otherwise use the Apps Script public exec URL (production)
// This makes the app work on LAN dev hosts like 172.16.x.x while keeping production pointing to Apps Script.

/** URL de configuración desde window, si existe (override manual) */
const _fromWindow = (typeof window !== 'undefined' && window.APP_CONFIG_OVERRIDE && window.APP_CONFIG_OVERRIDE.BASE_URL) ? window.APP_CONFIG_OVERRIDE.BASE_URL : '';

/** URL del Apps Script en producción */
// URL del script de Google Apps Script desplegado
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxBj5ae8whf6pg2pY588V-TecItxK6fz5j5lBXLHFRUXHLHhPYEVisygRwhMCN6ogRoUw/exec';

/** URL del proxy de desarrollo local */
const DEFAULT_DEV_PROXY = 'http://localhost:3000/api';

/** 
 * Detecta hostnames locales/privados típicos 
 * Cubre localhost, 127.0.0.1 y rangos de IP privados comunes
 * para determinar si se debe usar el proxy de desarrollo
 */
let useProxy = false;
try {
	if (typeof window !== 'undefined' && window.location && window.location.hostname) {
		const h = window.location.hostname;
		if (h === 'localhost' || h === '127.0.0.1') useProxy = true;
		// 10.x.x.x - Rango de IPs privadas Clase A
		if (/^10\./.test(h)) useProxy = true;
		// 192.168.x.x - Rango de IPs privadas Clase C
		if (/^192\.168\./.test(h)) useProxy = true;
		// 172.16.0.0 - 172.31.255.255 - Rango de IPs privadas Clase B
		if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) useProxy = true;
	}
} catch (e) {
	// En caso de error, se establece en false como valor predeterminado
}

/** 
 * URL base resuelta según la lógica de prioridad:
 * 1. Override desde window (may be injected by start scripts)
 * 2. If running on localhost (dev) use the dev proxy (DEFAULT_DEV_PROXY)
 * 3. If running in production (deployed, non-localhost) use a relative '/api' endpoint
 *    which should be implemented as a serverless function (for example on Vercel)
 */
const RESOLVED_BASE = _fromWindow || (useProxy ? DEFAULT_DEV_PROXY : '/api');

/**
 * Configuración global de la aplicación
 * @const {Object} APP_CONFIG - Objeto de configuración exportado
 * @property {string} BASE_URL - URL base para las llamadas a la API
 */
export const APP_CONFIG = {
	BASE_URL: RESOLVED_BASE
};

/**
 * Función helper para obtener la configuración
 * @returns {Promise<Object>} Configuración de la aplicación
 */
export async function getConfig() {
	return {
		SCRIPT_URL: APP_CONFIG.BASE_URL
	};
}