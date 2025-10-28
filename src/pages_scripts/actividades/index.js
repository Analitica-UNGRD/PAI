/**
 * index.js - Punto de entrada para el módulo de actividades
 * Este archivo inicializa la aplicación y expone las funcionalidades principales
 */

import ActividadesManager from './actividadesManager.js';

// Inicializar cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  // Verificar si estamos en la página correcta
  if (document.getElementById('app-actividades')) {
    console.log('[INFO] Inicializando módulo de actividades...');
    window.actividadesManager = new ActividadesManager();
  }
});

// Exportar clases y funcionalidades principales para uso externo
export { default as ActividadesManager } from './actividadesManager.js';
export { default as TableManager } from './tableManager.js';
export { default as FormHandler } from './formHandler.js';