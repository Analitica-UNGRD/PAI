/**
 * @fileoverview Controlador para la página de inicio de sesión
 * Este módulo maneja la interacción del usuario con el formulario de login,
 * incluyendo validaciones, envío de credenciales y manejo de errores.
 * También incluye la funcionalidad del carrusel de características.
 */

import { Auth } from './auth.js';
import { UI } from './ui.js';
import { showLoaderDuring, showLoader } from './loader.js';

/**
 * Clase que controla el comportamiento de la página de login
 * Gestiona la validación de formularios, envío de credenciales y navegación post-login
 * Además maneja la funcionalidad del carrusel de características
 */
class LoginPage {
    /**
     * Inicializa la página de login y configura los listeners de eventos
     */
    constructor() {
        // Obtiene referencias a los elementos del DOM
        this.form = document.getElementById('loginForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.emailError = document.getElementById('emailError');
        this.passwordError = document.getElementById('passwordError');
        
        // Elementos del carrusel
        this.carouselSlides = document.getElementById('carouselSlides');
        this.carouselDots = document.getElementById('carouselDots');
        this.currentSlide = 0;
        this.slideCount = 0;
        this.slideInterval = null;

        this.init();
    }

    /**
     * Inicializa los eventos del formulario, el carrusel y establece el foco inicial
     */
    init() {
        if (!this.form) return;
        
        // Configura el evento submit del formulario
        this.form.addEventListener('submit', this.handleSubmit.bind(this));

        // Configura listeners para limpiar errores al escribir
        if (this.emailInput) this.emailInput.addEventListener('input', () => this.clearError('email'));
        if (this.passwordInput) this.passwordInput.addEventListener('input', () => this.clearError('password'));

        // Establece el foco en el campo de email para mejor UX
        if (this.emailInput) this.emailInput.focus();
        
        // Inicializa el carrusel
        this.initCarousel();
    }
    
    /**
     * Inicializa el carrusel de características
     */
    initCarousel() {
        if (!this.carouselSlides || !this.carouselDots) return;
        
        // Cuenta el número de slides
        const slides = this.carouselSlides.querySelectorAll('.carousel-slide');
        this.slideCount = slides.length;
        
        // Configura los dots del carrusel
        const dots = this.carouselDots.querySelectorAll('.carousel-dot');
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.goToSlide(index);
            });
        });
        
        // Marcar el primer slide como activo
        if (slides.length > 0) {
            slides[0].classList.add('active');
        }
        
        // Inicia la rotación automática del carrusel
        this.startCarousel();
    }
    
    /**
     * Inicia la rotación automática del carrusel
     */
    startCarousel() {
        // Limpia el intervalo existente si hay uno
        if (this.slideInterval) {
            clearInterval(this.slideInterval);
        }
        
        // Configura un nuevo intervalo
        this.slideInterval = setInterval(() => {
            this.nextSlide();
        }, 5000); // Cambia de slide cada 5 segundos
    }
    
    /**
     * Avanza al siguiente slide del carrusel
     */
    nextSlide() {
        let nextIndex = this.currentSlide + 1;
        if (nextIndex >= this.slideCount) {
            nextIndex = 0;
        }
        this.goToSlide(nextIndex);
    }
    
    /**
     * Navega a un slide específico del carrusel
     * @param {number} index - Índice del slide al que se quiere navegar
     */
    goToSlide(index) {
        if (!this.carouselSlides || !this.carouselDots) return;
        
        // Aseguramos que el índice sea válido
        if (index < 0) index = this.slideCount - 1;
        if (index >= this.slideCount) index = 0;
        
        // Obtenemos todos los slides
        const slides = this.carouselSlides.querySelectorAll('.carousel-slide');
        
        // Quitamos la clase active de todos los slides
        slides.forEach(slide => {
            slide.classList.remove('active');
        });
        
        // Añadimos la clase active al slide actual
        if (slides[index]) {
            slides[index].classList.add('active');
        }
        
        // Actualiza los dots (indicadores)
        const dots = this.carouselDots.querySelectorAll('.carousel-dot');
        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        
        // Actualiza el índice actual
        this.currentSlide = index;
        
        // Reinicia el temporizador para evitar cambios abruptos
        this.startCarousel();
    }

    /**
     * Maneja el envío del formulario de login
     * @param {Event} e - Evento de formulario
     */
    async handleSubmit(e) {
        e.preventDefault();
        this.clearAllErrors();

        // Obtiene y limpia los valores de los campos
        const email = (this.emailInput && this.emailInput.value) ? this.emailInput.value.trim() : '';
        const password = (this.passwordInput && this.passwordInput.value) ? this.passwordInput.value.trim() : '';

        // Valida el formulario antes de proceder
        if (!this.validateForm(email, password)) return;

        // Deshabilita el formulario durante el proceso de login
        this.setFormEnabled(false);

        try {
            // Inicia el proceso de login mostrando un indicador de carga
            const result = await showLoaderDuring(
                Auth.login(email, password),
                'Verificando credenciales...',
                'transparent',
                1000
            );

            // Maneja el resultado del login
            if (result && result.success) {
                // Login exitoso: muestra mensaje y redirige al dashboard
                UI.showMessage('¡Acceso concedido!', 'success', 1500);
                setTimeout(() => {
                    showLoader('Cargando dashboard...', 'solid');
                    setTimeout(() => {
                        // Navega a la página del dashboard (ruta relativa)
                        window.location.href = './dashboard.html';
                    }, 1000);
                }, 1000);
            } else {
                // Login fallido: muestra mensaje de error y restablece el formulario
                UI.showMessage((result && result.message) || 'Credenciales inválidas', 'error', 3000);
                this.setFormEnabled(true);
                
                // Enfoca el campo de contraseña para reintentar
                if (this.passwordInput) {
                    this.passwordInput.focus();
                    this.passwordInput.select();
                }
            }
        } catch (error) {
            console.error('Error en login:', error);
            UI.showMessage('Error de conexión. Verifique su conexión a internet.', 'error', 3000);
            this.setFormEnabled(true);
        }
    }

    /**
     * Valida los campos del formulario de login
     * @param {string} email - Dirección de correo electrónico
     * @param {string} password - Contraseña
     * @returns {boolean} true si los campos son válidos, false en caso contrario
     */
    validateForm(email, password) {
        let isValid = true;
        
        // Valida el campo de correo electrónico
        if (!email) {
            this.showFieldError('email', 'El correo electrónico es requerido');
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showFieldError('email', 'Ingrese un correo electrónico válido');
            isValid = false;
        }

        // Valida el campo de contraseña
        if (!password) {
            this.showFieldError('password', 'La contraseña es requerida');
            isValid = false;
        } else if (password.length < 3) {
            this.showFieldError('password', 'La contraseña debe tener almenos 3 caracteres');
            isValid = false;
        }

        return isValid;
    }

    /**
     * Valida el formato de una dirección de correo electrónico
     * @param {string} email - Dirección de correo a validar
     * @returns {boolean} true si el formato es válido
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Muestra un mensaje de error para un campo específico
     * @param {string} field - ID del campo con error
     * @param {string} message - Mensaje de error a mostrar
     */
    showFieldError(field, message) {
        // Obtiene referencias a los elementos
        const errorElement = document.getElementById(`${field}Error`);
        const inputElement = document.getElementById(field);
        
        // Muestra el mensaje de error
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('login-error-text');
        }
        
        // Marca visualmente el campo con error
        if (inputElement) {
            inputElement.classList.add('login-is-invalid');
            inputElement.setAttribute('aria-invalid', 'true');
        }
    }

    /**
     * Elimina los mensajes de error para un campo específico
     * @param {string} field - ID del campo a limpiar
     */
    clearError(field) {
        // Obtiene referencias a los elementos
        const errorElement = document.getElementById(`${field}Error`);
        const inputElement = document.getElementById(field);
        
        // Elimina el mensaje de error
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('login-error-text');
        }
        
        // Restaura el estilo normal del campo
        if (inputElement) {
            inputElement.classList.remove('login-is-invalid');
            inputElement.setAttribute('aria-invalid', 'false');
        }
    }

    /**
     * Elimina todos los mensajes de error del formulario
     */
    clearAllErrors() {
        this.clearError('email');
        this.clearError('password');
    }

    /**
     * Habilita o deshabilita el formulario durante la autenticación
     * @param {boolean} enabled - true para habilitar, false para deshabilitar
     */
    setFormEnabled(enabled) {
        if (!this.form) return;
        
        // Obtiene el botón de envío
        const submitButton = this.form.querySelector('button[type="submit"]');
        if (!submitButton) return;
        
        // Actualiza el estado de los campos y el botón
        if (this.emailInput) this.emailInput.disabled = !enabled;
        if (this.passwordInput) this.passwordInput.disabled = !enabled;
        submitButton.disabled = !enabled;
        
        // Actualiza el texto del botón según el estado
        submitButton.textContent = enabled ? 'Iniciar Sesión' : 'Iniciando sesión...';
    }
}

// Inicializa la página de login cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    new LoginPage();
});