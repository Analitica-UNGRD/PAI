/**
 * index.js - Punto de entrada para el módulo de administración
 */

import AdminManager from './adminManager.js';

// Inicializar cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  // Verificar si estamos en la página correcta
  if (document.getElementById('app-admin')) {
    console.log('[INFO] Inicializando módulo de administración...');
    window.adminManager = new AdminManager();
  }
});

// Exportar clases y funcionalidades principales para uso externo
export { default as AdminManager } from './adminManager.js';