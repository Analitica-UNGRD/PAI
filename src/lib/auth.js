/**
 * @fileoverview Sistema de autenticación 
 * Este módulo proporciona funciones para la gestión de autenticación
 * incluyendo login, verificación de estado, y cierre de sesión.
 * Utiliza localStorage para almacenar los datos de sesión.
 */

import { APP_CONFIG } from './config.js';
import { showLoaderDuring } from './loader.js';

function shouldUseTextPlain(url) {
  try {
    if (!url) return false;
    if (!/^https?:\/\//.test(url)) return false;
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
    const host = parsed.hostname || '';
    return host.endsWith('script.google.com') || host.endsWith('googleusercontent.com');
  } catch (err) {
    return false;
  }
}

/**
 * Objeto Auth con métodos de autenticación
 * @namespace
 */
const Auth = {
	/**
	 * Inicia sesión con credenciales de correo y contraseña
	 * @param {string} email - Correo electrónico del usuario (debe ser del dominio institucional)
	 * @param {string} password - Contraseña del usuario
	 * @returns {Promise<Object>} Resultado de la autenticación con estado y mensaje
	 */
	async login(email, password){
		// Valida que el correo sea del dominio institucional
		const domainOK = /@gestiondelriesgo\.gov\.co$/i.test(email);
		if(!domainOK) return { success:false, message:"Use su correo institucional @gestiondelriesgo.gov.co" };
		
		// Valida que la contraseña tenga un mínimo de caracteres
		if(!password || password.length < 3){
			return { success:false, message:"Contraseña muy corta" };
		}

		// Si hay una URL base configurada, llama al endpoint remoto de Apps Script
		if (APP_CONFIG && APP_CONFIG.BASE_URL) {
			try {
				// Realiza la petición de autenticación al servidor
				// Añadir timeout a la petición para evitar esperas largas
				const controller = new AbortController();
				const timeoutMs = (APP_CONFIG.LOGIN_TIMEOUT_MS && Number(APP_CONFIG.LOGIN_TIMEOUT_MS)) || 5000;
				const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
				const usePlain = shouldUseTextPlain(APP_CONFIG.BASE_URL);
                const headers = usePlain ? { 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' };
                const resp = await showLoaderDuring(() => fetch(APP_CONFIG.BASE_URL, {
                    method: 'POST',
                    headers,
					body: JSON.stringify({ path: 'auth/login', payload: { email, password, remember: false } }),
					signal: controller.signal
				}), 'Validando credenciales...', 'solid');
				clearTimeout(timeoutId);
				
				// Procesa la respuesta
				const data = await resp.json();
				// The Apps Script backend returns { success: boolean, data: {...}, message: string, errors: [...] }
				if (!data || data.success !== true) {
					// Prefer a descriptive error message if provided
					const errMsg = (data && (data.message || (Array.isArray(data.errors) ? data.errors.join('; ') : data.error))) || 'Error de autenticación';
					return { success: false, message: errMsg };
				}

				// Use the returned data payload
				const payload = data.data || {};

				// Store token and metadata if provided by backend
				if (payload.token) {
					localStorage.setItem('auth_token', payload.token);
				} else {
					// Fallback: create a local token so UI flows work (short-lived)
					const token = btoa(`${email}|${Date.now()}`);
					localStorage.setItem('auth_token', token);
				}

				localStorage.setItem('auth_email', payload.email || email);
				localStorage.setItem('auth_role', payload.role || payload.rol || '');

				return { success: true, message: data.message || 'OK', role: payload.role || payload.rol };
			} catch (err) {
				if (err && err.name === 'AbortError') {
					return { success: false, message: 'Tiempo de respuesta agotado. Intente de nuevo.' };
				}
				return { success: false, message: 'Error de conexión: ' + String(err) };
			}
		}

		// Si no hay URL de API configurada, no hacemos un fallback: devolvemos error.
		return { success:false, message: 'No hay URL de API configurada. Configure APP_CONFIG.BASE_URL para poder iniciar sesión.' };
	},
	
	/**
	 * Verifica si el usuario está autenticado y su sesión no ha expirado
	 * @returns {boolean} true si hay un token válido y no ha expirado (1 hora)
	 */
	isAuthenticated(){
		const token = localStorage.getItem("auth_token");
		if (!token) return false;
		
		try {
			// Decodifica el token para obtener el timestamp
			const decoded = atob(token);
			const parts = decoded.split('|');
			if (parts.length < 2) return false;
			
			const timestamp = parseInt(parts[1]);
			const now = Date.now();
			const oneHour = 60 * 60 * 1000; // 1 hora en milisegundos
			
			// Verifica si la sesión ha expirado
			if (now - timestamp > oneHour) {
				// Sesión expirada, limpia los datos
				this.logout();
				return false;
			}
			
			return true;
		} catch (error) {
			// Token malformado, limpia los datos
			this.logout();
			return false;
		}
	},
	
	/**
	 * Cierra la sesión del usuario eliminando todos los datos de autenticación
	 */
	logout(){
		// Eliminar datos de sesión
		localStorage.removeItem("auth_token");
		localStorage.removeItem("auth_email");
		localStorage.removeItem('auth_role');

		// Intentar limpiar sessionStorage por si algo se guardó ahí también
		try { sessionStorage.removeItem('auth_token'); sessionStorage.removeItem('auth_email'); } catch(e) {}

		// Redirigir al login de forma segura usando replace para evitar navegar atrás a una página autenticada
		try {
			window.location.replace('./login.html');
		} catch (e) {
			window.location.href = './login.html';
		}
	},
	
	/**
	 * Obtiene el correo electrónico del usuario autenticado
	 * @returns {string|null} Correo electrónico o null si no está autenticado
	 */
	currentEmail(){
		return localStorage.getItem("auth_email");
	},
	
	/**
	 * Obtiene el rol del usuario autenticado
	 * @returns {string|null} Rol del usuario o null si no está definido
	 */
	currentRole(){
		return localStorage.getItem('auth_role');
	},
	
	/**
	 * Obtiene el tiempo restante de la sesión en minutos
	 * @returns {number} Minutos restantes de la sesión, 0 si ha expirado
	 */
	getSessionTimeRemaining(){
		const token = localStorage.getItem("auth_token");
		if (!token) return 0;
		
		try {
			const decoded = atob(token);
			const parts = decoded.split('|');
			if (parts.length < 2) return 0;
			
			const timestamp = parseInt(parts[1]);
			const now = Date.now();
			const oneHour = 60 * 60 * 1000; // 1 hora en milisegundos
			const remaining = oneHour - (now - timestamp);
			
			return remaining > 0 ? Math.ceil(remaining / (60 * 1000)) : 0;
		} catch (error) {
			return 0;
		}
	},
	
	/**
	 * Inicia el monitoreo automático de la sesión
	 * Redirige al login cuando la sesión expire
	 */
	startSessionMonitoring(){
		// Verificar cada minuto si la sesión sigue activa
		setInterval(() => {
			if (!this.isAuthenticated()) {
				// Sesión expirada, mostrar mensaje y redirigir al login
				if (typeof UI !== 'undefined' && UI.showMessage) {
					UI.showMessage('Su sesión ha expirado por seguridad. Por favor, inicie sesión nuevamente.', 'warning', 3000);
				}
				setTimeout(() => {
					window.location.href = './login.html';
				}, 3000);
			}
		}, 60000); // Verificar cada minuto
		
		// Verificar inmediatamente al cargar la página
		if (!this.isAuthenticated()) {
			window.location.href = './login.html';
		}
	},
	
	/**
	 * Renueva el token de sesión manteniendo la misma información
	 * Útil para extender la sesión cuando el usuario está activo
	 */
	renewToken(){
		if (!this.isAuthenticated()) return false;
		
		const email = this.currentEmail();
		const role = this.currentRole();
		
		if (email) {
			// Crear nuevo token con timestamp actual
			const newToken = btoa(`${email}|${Date.now()}`);
			localStorage.setItem('auth_token', newToken);
			return true;
		}
		
		return false;
	}
};

export { Auth };
export default Auth;





