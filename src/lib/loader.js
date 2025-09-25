/**
 * @fileoverview Utilidades mínimas para mostrar indicadores de carga
 * Este módulo proporciona funciones básicas para gestionar los estados de carga
 * que pueden ser utilizados en toda la aplicación. Pueden ser reemplazados
 * por implementaciones más completas a nivel de UI.
 */

/**
 * Muestra un indicador de carga
 * @param {string} msg - Mensaje a mostrar durante la carga
 * @param {string} style - Estilo del loader ('transparent', 'fullscreen', etc.)
 */
export function showLoader(msg = 'Cargando...', style = 'transparent'){
  // Crear o actualizar un loader DOM visible para el usuario
  try {
    let el = document.getElementById('appLoader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appLoader';
      document.body.appendChild(el);
    }

    // estilos base
    el.style.position = style === 'solid' ? 'fixed' : 'fixed';
    el.style.left = '0';
    el.style.right = '0';
    el.style.zIndex = '999998';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.padding = '12px';

    if (style === 'solid') {
      el.style.top = '0';
      el.style.bottom = '0';
      el.style.background = 'rgba(15, 23, 42, 0.6)';
      el.style.backdropFilter = 'blur(2px)';
    } else {
      el.style.top = '12px';
      el.style.height = 'auto';
      el.style.pointerEvents = 'none';
    }

    // Contenido usando clases definidas en login.css para apariencia glossy
    el.innerHTML = `
      <div class="app-loader-card">
        <div class="app-loader-spinner" aria-hidden="true">
          <div class="app-loader-inner"></div>
        </div>
        <div class="app-loader-text">${msg}</div>
      </div>
    `;

    // keyframes están en login.css
  } catch (e) {
    console.log('[loader] ', msg, style);
  }
}

/**
 * Muestra un indicador de carga mientras se resuelve una promesa o se ejecuta una función
 * Garantiza un tiempo mínimo de visualización para evitar parpadeos en operaciones rápidas
 * 
 * @param {Promise|Function} promiseOrFunc - Promesa a resolver o función que devuelve una promesa
 * @param {string} msg - Mensaje a mostrar durante la carga
 * @param {string} style - Estilo del loader ('transparent', 'fullscreen', etc.)
 * @param {number} minMs - Tiempo mínimo en milisegundos que se mostrará el indicador
 * @returns {Promise<any>} - El resultado de la promesa o función ejecutada
 */
export async function showLoaderDuring(promiseOrFunc, msg = 'Procesando...', style='transparent', minMs = 300){
  showLoader(msg, style);
  const start = Date.now();
  let result;
  
  if(typeof promiseOrFunc === 'function'){
    result = await promiseOrFunc();
  } else {
    result = await promiseOrFunc;
  }
  
  // Garantiza un tiempo mínimo de visualización para evitar parpadeos
  const elapsed = Date.now() - start;
  if(elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
  // Ocultar loader DOM
  hideLoader();

  return result;
}
export function hideLoader() {
  try { const el = document.getElementById('appLoader'); if (el) el.remove(); } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.APP_LOADER = window.APP_LOADER || {};
  window.APP_LOADER.showLoader = showLoader;
  window.APP_LOADER.showLoaderDuring = showLoaderDuring;
  window.APP_LOADER.hideLoader = hideLoader;
}

