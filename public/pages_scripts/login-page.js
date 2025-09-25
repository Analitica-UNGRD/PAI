/**
 * Login page controller (restored from src/pages_scripts/login-page.js)
 * - Handles form submit, validation, shows loader, and runs the carousel.
 */
import { Auth } from '../lib/auth.js';
import { UI } from '../lib/ui.js';
import { showLoaderDuring, showLoader } from '../lib/loader.js';

class LoginPage {
  constructor() {
    this.form = document.getElementById('loginForm');
    this.emailInput = document.getElementById('email');
    this.passwordInput = document.getElementById('password');
    this.emailError = document.getElementById('emailError');
    this.passwordError = document.getElementById('passwordError');
    this.carouselSlides = document.getElementById('carouselSlides');
    this.carouselDots = document.getElementById('carouselDots');
    this.currentSlide = 0;
    this.slideCount = 0;
    this.slideInterval = null;

    this.init();
  }

  init() {
    if (!this.form) return;
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    if (this.emailInput) this.emailInput.addEventListener('input', () => this.clearError('email'));
    if (this.passwordInput) this.passwordInput.addEventListener('input', () => this.clearError('password'));
    if (this.emailInput) this.emailInput.focus();
    this.initCarousel();
  }

  initCarousel() {
    if (!this.carouselSlides || !this.carouselDots) return;
    const slides = this.carouselSlides.querySelectorAll('.carousel-slide');
    this.slideCount = slides.length;
    const dots = this.carouselDots.querySelectorAll('.carousel-dot');
    dots.forEach((dot, index) => dot.addEventListener('click', () => this.goToSlide(index)));
    if (slides.length > 0) slides[0].classList.add('active');
    this.startCarousel();
  }

  startCarousel() {
    if (this.slideInterval) clearInterval(this.slideInterval);
    this.slideInterval = setInterval(() => this.nextSlide(), 5000);
  }

  nextSlide() {
    let nextIndex = this.currentSlide + 1;
    if (nextIndex >= this.slideCount) nextIndex = 0;
    this.goToSlide(nextIndex);
  }

  goToSlide(index) {
    if (!this.carouselSlides || !this.carouselDots) return;
    if (index < 0) index = this.slideCount - 1;
    if (index >= this.slideCount) index = 0;
    const slides = this.carouselSlides.querySelectorAll('.carousel-slide');
    slides.forEach(s => s.classList.remove('active'));
    if (slides[index]) slides[index].classList.add('active');
    const dots = this.carouselDots.querySelectorAll('.carousel-dot');
    dots.forEach((dot, i) => i === index ? dot.classList.add('active') : dot.classList.remove('active'));
    this.currentSlide = index;
    this.startCarousel();
  }

  async handleSubmit(e) {
    e.preventDefault();
    this.clearAllErrors();
    const email = (this.emailInput && this.emailInput.value) ? this.emailInput.value.trim() : '';
    const password = (this.passwordInput && this.passwordInput.value) ? this.passwordInput.value.trim() : '';
    if (!this.validateForm(email, password)) return;
    this.setFormEnabled(false);
    try {
      const result = await showLoaderDuring(
        Auth.login(email, password),
        'Verificando credenciales...',
        'transparent',
        500
      );
      if (result && result.success) {
        UI.showMessage('¡Acceso concedido!', 'success', 1500);
        setTimeout(() => {
          showLoader('Cargando dashboard...', 'solid');
          setTimeout(() => window.location.href = './dashboard.html', 1000);
        }, 1000);
      } else {
        const msg = (result && result.message) || 'Credenciales inválidas';
        UI.showMessage(msg, 'error', 4000);
        this.setFormEnabled(true);
        if (/credencial|credenciales|inválida/i.test(msg)) {
          this.showFieldError('password', 'Correo o contraseña incorrectos');
          const emailEl = document.getElementById('email');
          if (emailEl) emailEl.classList.add('login-is-invalid');
          if (this.passwordInput) { this.passwordInput.focus(); this.passwordInput.select(); }
        }
      }
    } catch (error) {
      console.error('Error en login:', error);
      UI.showMessage('Error de conexión. Verifique su conexión a internet.', 'error', 3000);
      this.setFormEnabled(true);
    }
  }

  validateForm(email, password) {
    let isValid = true;
    if (!email) { this.showFieldError('email', 'El correo electrónico es requerido'); isValid = false; }
    else if (!this.isValidEmail(email)) { this.showFieldError('email', 'Ingrese un correo electrónico válido'); isValid = false; }
    if (!password) { this.showFieldError('password', 'La contraseña es requerida'); isValid = false; }
    else if (password.length < 3) { this.showFieldError('password', 'La contraseña debe tener al menos 3 caracteres'); isValid = false; }
    return isValid;
  }

  isValidEmail(email) { const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; return emailRegex.test(email); }

  showFieldError(field, message) {
    const errorElement = document.getElementById(`${field}Error`);
    const inputElement = document.getElementById(field);
    if (errorElement) { errorElement.textContent = message; errorElement.classList.add('login-error-text'); }
    if (inputElement) { inputElement.classList.add('login-is-invalid'); inputElement.setAttribute('aria-invalid', 'true'); }
  }

  clearError(field) {
    const errorElement = document.getElementById(`${field}Error`);
    const inputElement = document.getElementById(field);
    if (errorElement) { errorElement.textContent = ''; errorElement.classList.remove('login-error-text'); }
    if (inputElement) { inputElement.classList.remove('login-is-invalid'); inputElement.setAttribute('aria-invalid', 'false'); }
  }

  clearAllErrors() { this.clearError('email'); this.clearError('password'); }

  setFormEnabled(enabled) {
    if (!this.form) return;
    const submitButton = this.form.querySelector('button[type="submit"]');
    if (!submitButton) return;
    if (this.emailInput) this.emailInput.disabled = !enabled;
    if (this.passwordInput) this.passwordInput.disabled = !enabled;
    submitButton.disabled = !enabled;
    submitButton.textContent = enabled ? 'Iniciar Sesión' : 'Iniciando sesión...';
  }
}

document.addEventListener('DOMContentLoaded', () => new LoginPage());
