/**
 * Reusable sidebar renderer for export
 * - renderSidebar(target, options)
 * - options.logoutHandler: optional function to call for logout (default tries to call Auth.logout())
 */

import { initSidebar } from './sidebar.js';
// Importar el guardian de sesión para que cualquier página que renderice la sidebar
// cargue automáticamente la protección de sesión (excepto páginas públicas como login)
import './session-guard.js';

/**
 * Renderiza una barra lateral canónica
 * @param {HTMLElement|string} target - Contenedor o selector donde insertar
 * @param {Object} options - Opciones adicionales
 * @param {Function} [options.logoutHandler] - Callback que ejecuta el logout; si no se pasa, se intenta usar Auth.logout()
 * @returns {HTMLElement} aside element
 */
export function renderSidebar(target, options = {}) {
  let container = null;
  if(typeof target === 'string') container = document.querySelector(target);
  else if(target instanceof HTMLElement) container = target;

  if(!container) { 
    container = document.createElement('div'); 
    document.body.insertBefore(container, document.body.firstChild); 
  }

  if(container.dataset.sidebarRendered === '1') return container.querySelector('aside.sidebar');

  const aside = document.createElement('aside');
  aside.className = 'sidebar collapsed flex-shrink-0 text-gray-300';
  aside.setAttribute('aria-expanded','false');

  const isHtmlMode = (() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname || '';
    return path.endsWith('.html') || path.includes('/src/');
  })();
  const htmlBase = (() => {
    if (typeof window === 'undefined') return '/';
    if (!isHtmlMode) return '/';
    const path = window.location.pathname || '/';
    const idx = path.lastIndexOf('/');
    return idx >= 0 ? path.slice(0, idx + 1) : '/';
  })();
  const resolvePageHref = (page) => {
    if (typeof window === 'undefined') {
      return page === 'login' ? '/login' : `/${page}`;
    }
    if (isHtmlMode) {
      const target = page === 'login' ? 'login.html' : `${page}.html`;
      return new URL(target, window.location.origin + htmlBase).href;
    }
    const target = page === 'login' ? '/login' : `/${page}`;
    return new URL(target, window.location.origin).href;
  };

  const navItems = [
    { section: 'dashboard', page: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { section: 'actividades', page: 'actividades', icon: 'assignment', label: 'Actividades' },
    { section: 'avance', page: 'avance', icon: 'trending_up', label: 'Avance' },
    { section: 'admin', page: 'admin', icon: 'admin_panel_settings', label: 'Admin' }
  ];

  aside.innerHTML = `
    <div class="sidebar-inner">
      <div class="p-6">
        <h1 class="text-2xl font-bold text-white menu-title">Panel</h1>
      </div>
      <nav class="mt-6">
        <ul>
          ${navItems.map(item => `
            <li class="px-6 py-3" data-section="${item.section}">
              <a class="flex items-center" data-page="${item.page}" href="#">
                <span class="material-icons">${item.icon}</span>
                <span class="ml-4 menu-label">${item.label}</span>
              </a>
            </li>`).join('')}
        </ul>
      </nav>
      <div class="bottom-area">
        <div class="flex items-center justify-between mb-3">
          <a class="flex items-center text-gray-300 hover:bg-gray-700 px-4 py-2 rounded-md" href="#">
            <span class="material-icons">settings</span>
            <span class="ml-4 menu-label">Settings</span>
          </a>
          <button class="pin-btn text-gray-300 hover:text-white focus:outline-none px-2 py-2" title="Pin sidebar" aria-pressed="false">
            <span class="material-icons">push_pin</span>
          </button>
        </div>
        <div>
          <button class="logout-danger w-full flex items-center justify-center gap-3" title="Cerrar sesión">
            <span class="material-icons">logout</span>
            <span class="menu-label">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(aside);
  container.dataset.sidebarRendered = '1';

  const loginHref = resolvePageHref('login');
  aside.querySelectorAll('a[data-page]').forEach((anchor) => {
    const page = anchor.getAttribute('data-page');
    anchor.href = resolvePageHref(page);
  });


  const goToLogin = () => {
    try { window.location.replace(loginHref); } catch (err) { window.location.href = loginHref; }
  };

  try { initSidebar(aside); } catch(e) { console.warn('initSidebar failed', e); }

  // logout wiring: prefer provided handler, then window.Auth.logout(), then fallback to redirect
  try {
    const logoutBtn = aside.querySelector('.logout-danger');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (ev) => {
        try {
          // Preferir handler provisto
          if (options.logoutHandler && typeof options.logoutHandler === 'function') {
            const res = options.logoutHandler();
            // Si devuelve una promesa, esperar
            if (res && typeof res.then === 'function') res.then(() => { goToLogin(); });
            else { goToLogin(); }
            return;
          }

          // Intentar usar Auth.logout si está disponible
          if (window.Auth && typeof window.Auth.logout === 'function') {
            const rtn = window.Auth.logout();
            if (rtn && typeof rtn.then === 'function') {
              rtn.then(() => { goToLogin(); });
            } else {
              goToLogin();
            }
            return;
          }

          // fallback: importar dinámicamente y llamar logout
          try {
            // Import dinámico en IIFE para manejar async/await y errores de forma clara
            (async () => {
              try {
                const m = await import('../lib/auth.js');
                if (m && m.Auth && typeof m.Auth.logout === 'function') {
                  const r = m.Auth.logout();
                  if (r && typeof r.then === 'function') await r;
                }
              } catch (err) {
                // ignore import or logout errors
              }
              goToLogin();
            })();
          } catch(e) {
            goToLogin();
          }
        } catch (e) { console.warn('Logout handler failed', e); goToLogin(); }
      });
    }
  } catch (e) { /* noop */ }

  return aside;
}

// Auto-render into #shared-sidebar if present
if(typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const el = document.getElementById('shared-sidebar');
      if(el) renderSidebar(el);
    } catch(e) {}
  });
}






