/**
 * @fileoverview Sistema de protección de sesión
 * Este módulo verifica automáticamente la validez de la sesión
 * y redirige al login cuando expire. Se ejecuta en todas las páginas protegidas.
 */

import { Auth } from './auth.js';

/**
 * Clase para manejar la protección de sesión
 */
class SessionGuard {
    constructor() {
        this.intervalId = null;
        this.warningShown = false;
        this.lastActivity = Date.now();
        this.activityListeners = [];
        this.init();
    }

    /**
     * Inicializa el guardian de sesión
     */
    init() {
        // Verificar inmediatamente si hay sesión válida
        if (!Auth.isAuthenticated()) {
            this.redirectToLogin('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
            return;
        }

        // Iniciar monitoreo continuo
        this.startMonitoring();
        
        // Configurar listeners de actividad del usuario
        this.setupActivityListeners();
        
        // Verificar cuando la ventana regain focus (usuario vuelve a la pestaña)
        window.addEventListener('focus', () => {
            // Resetear la advertencia cuando el usuario vuelve
            this.warningShown = false;
            
            if (!Auth.isAuthenticated()) {
                this.redirectToLogin('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
            } else {
                // Actualizar actividad cuando regresa el foco
                this.lastActivity = Date.now();
            }
        });

        // Verificar antes de que se cierre la ventana/pestaña
        window.addEventListener('beforeunload', () => {
            this.stopMonitoring();
        });
    }

    /**
     * Configura listeners para detectar actividad del usuario
     */
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        const activityHandler = () => {
            this.lastActivity = Date.now();
        };

        events.forEach(event => {
            document.addEventListener(event, activityHandler, true);
            this.activityListeners.push({ event, handler: activityHandler });
        });
    }

    /**
     * Limpia los listeners de actividad
     */
    cleanupActivityListeners() {
        this.activityListeners.forEach(({ event, handler }) => {
            document.removeEventListener(event, handler, true);
        });
        this.activityListeners = [];
    }

    /**
     * Inicia el monitoreo de la sesión
     */
    startMonitoring() {
        // Verificar cada 30 segundos
        this.intervalId = setInterval(() => {
            const timeRemaining = Auth.getSessionTimeRemaining();
            
            // Si quedan menos de 5 minutos, mostrar advertencia una sola vez
            if (timeRemaining <= 5 && timeRemaining > 0 && !this.warningShown) {
                this.showExpirationWarning(timeRemaining);
                this.warningShown = true;
            }
            
            // Si la sesión ha expirado, redirigir
            if (!Auth.isAuthenticated()) {
                this.redirectToLogin('Su sesión ha expirado por seguridad.');
                return;
            }
            
            // Si el usuario ha estado inactivo por más de 45 minutos, mostrar advertencia
            const inactiveTime = Date.now() - this.lastActivity;
            const maxInactiveTime = 45 * 60 * 1000; // 45 minutos
            
            if (inactiveTime > maxInactiveTime && timeRemaining > 5 && !this.warningShown) {
                this.showInactivityWarning();
                this.warningShown = true;
            }
            
        }, 30000); // Verificar cada 30 segundos
    }

    /**
     * Detiene el monitoreo de la sesión
     */
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.cleanupActivityListeners();
    }

    /**
     * Muestra una advertencia de expiración próxima
     * @param {number} minutesRemaining - Minutos restantes
     */
    showExpirationWarning(minutesRemaining) {
        // Verificar si existe UI para mostrar el mensaje
        if (typeof UI !== 'undefined' && UI.showMessage) {
            UI.showMessage(
                `Su sesión expirará en ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}. Guarde su trabajo.`,
                'warning',
                8000
            );
        } else {
            // Fallback usando alert nativo
            alert(`Su sesión expirará en ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}. Por favor, guarde su trabajo.`);
        }
    }

    /**
     * Muestra una advertencia de inactividad
     */
    showInactivityWarning() {
        const timeRemaining = Auth.getSessionTimeRemaining();
        if (typeof UI !== 'undefined' && UI.showMessage) {
            UI.showMessage(
                `Ha estado inactivo. Su sesión expirará en ${timeRemaining} minuto${timeRemaining !== 1 ? 's' : ''}. Mueva el mouse para mantener la sesión activa.`,
                'warning',
                10000
            );
        } else {
            alert(`Ha estado inactivo. Su sesión expirará en ${timeRemaining} minuto${timeRemaining !== 1 ? 's' : ''}. Haga clic en OK para mantener la sesión activa.`);
            // El usuario hizo clic en OK, actualizar actividad
            this.lastActivity = Date.now();
        }
    }

    /**
     * Redirige al login con mensaje
     * @param {string} message - Mensaje a mostrar
     */
    redirectToLogin(message) {
        this.stopMonitoring();
        
        // Mostrar mensaje si está disponible
        if (typeof UI !== 'undefined' && UI.showMessage) {
            UI.showMessage(message, 'warning', 3000);
            setTimeout(() => {
                window.location.href = './login.html';
            }, 3000);
        } else {
            // Redirigir inmediatamente si no hay UI
            window.location.href = './login.html';
        }
    }

    /**
     * Obtiene información de la sesión actual
     * @returns {Object} Información de la sesión
     */
    getSessionInfo() {
        const timeRemaining = Auth.getSessionTimeRemaining();
        const inactiveTime = Math.floor((Date.now() - this.lastActivity) / (60 * 1000)); // minutos
        
        return {
            isValid: Auth.isAuthenticated(),
            timeRemaining: timeRemaining,
            email: Auth.currentEmail(),
            role: Auth.currentRole(),
            inactiveMinutes: inactiveTime,
            lastActivity: new Date(this.lastActivity).toLocaleTimeString()
        };
    }
}

// Crear instancia global del guardian de sesión
let sessionGuard = null;

/**
 * Inicializa el guardian de sesión cuando se carga el DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    // Solo inicializar en páginas que no sean login
    const currentPage = (location.pathname || '').split('/').pop() || '';
    const publicPages = ['login.html', 'index.html', ''];
    
    if (!publicPages.includes(currentPage)) {
        sessionGuard = new SessionGuard();
    }
});

// Exportar la clase para uso manual si es necesario
export { SessionGuard };
export default SessionGuard;