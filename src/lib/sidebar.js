/**
 * Sidebar behavior: expand/collapse, pin, highlight active link and auto-init
 * Portable version extracted for export
 */

/**
 * Inicializa el comportamiento de la barra lateral
 * @param {HTMLElement|string} target - Elemento de la barra lateral o selector CSS
 * @param {Object} options - Opciones de configuración
 * @param {string} [options.storageKey='sidebarPinned'] - Clave para almacenar el estado en localStorage
 * @param {string} [options.selector='.sidebar'] - Selector CSS alternativo para encontrar la barra lateral
 */
export function initSidebar(target, options = {}) {
  let sidebar = null;
  if(typeof target === 'string') sidebar = document.querySelector(target);
  else if(target instanceof HTMLElement) sidebar = target;
  else sidebar = document.querySelector(options.selector || '.sidebar');

  if(!sidebar) return;
  if(sidebar.dataset.sidebarInit === '1') return;

  const STORAGE_KEY = options.storageKey || 'sidebarExportPinned';
  let hoverTimeout = null;
  const pinBtn = sidebar.querySelector('.pin-btn') || document.querySelector('.pin-btn');

  function isPinned() { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch(e) { return false; } }
  function setPinned(val) { try { if(val) localStorage.setItem(STORAGE_KEY,'1'); else localStorage.removeItem(STORAGE_KEY); } catch(e) {} }
  // Small helper to manage a transitioning state and remove it after transitions end
  function startTransition() {
    sidebar.classList.add('is-transitioning');
    const onEnd = (e) => {
      // only react to transitions on the sidebar element (avoid bubbling children)
      if (e.target !== sidebar) return;
      // remove the flag once the width/opacity/transform transition ends
      if (['width','opacity','transform','box-shadow'].indexOf(e.propertyName) !== -1) {
        sidebar.removeEventListener('transitionend', onEnd);
        sidebar.classList.remove('is-transitioning');
      }
    };
    sidebar.addEventListener('transitionend', onEnd);
  }

  // Apply expansion/collapse using rAF to ensure the browser batches style changes
  function expandSidebar() {
    sidebar.classList.remove('collapsed');
    // allow the removal to flush, then add expanded so transition occurs
    requestAnimationFrame(() => {
      sidebar.classList.add('expanded');
      sidebar.setAttribute('aria-expanded','true');
      applyBodyExpanded(true);
      startTransition();
    });
  }

  function collapseSidebar() {
    if(isPinned()) return;
    sidebar.classList.remove('expanded');
    requestAnimationFrame(() => {
      sidebar.classList.add('collapsed');
      sidebar.setAttribute('aria-expanded','false');
      applyBodyExpanded(false);
      startTransition();
    });
  }

  // Helper: sync page-level classes and CSS variable for layout
  function applyBodyExpanded(expanded) {
    try {
      // helper to convert CSS length (px/rem/em/etc) to pixels by using a temporary element
      function toPx(value) {
        if(!value) return 0;
        // if it's already in px, parse quickly
        const trimmed = String(value).trim();
        if(/^-?\d+(?:px)?$/.test(trimmed)) return parseFloat(trimmed);
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.visibility = 'hidden';
        el.style.height = '0';
        el.style.width = trimmed;
        document.body.appendChild(el);
        const px = el.getBoundingClientRect().width;
        document.body.removeChild(el);
        return px;
      }

      const expandedVal = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-expanded-w') || '16rem';
      const collapsedVal = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-collapsed-w') || '64px';

      if(expanded) {
        // add expanded class for styling, but DO NOT change --sidebar-width (we keep main margin based on collapsed width)
        document.body.classList.add('sidebar-expanded');
        const pxExpanded = toPx(expandedVal);
        const pxCollapsed = toPx(collapsedVal);
        const diff = Math.max(0, pxExpanded - pxCollapsed);
        // Use a small fraction of the full sidebar width difference to produce a subtle nudge only.
        const MOVE_FACTOR = 0.12; // smaller nudge (~12% of width diff)
        const MAX_OFFSET_PX = 32; // cap the nudge
        const offsetPx = Math.min(MAX_OFFSET_PX, Math.round(diff * MOVE_FACTOR));
        document.body.style.setProperty('--sidebar-offset', offsetPx + 'px');
      } else {
        document.body.classList.remove('sidebar-expanded');
        // reset nudge
        document.body.style.setProperty('--sidebar-offset', '0px');
      }
    } catch(e) {}
  }

  const onEnter = () => { if(hoverTimeout) clearTimeout(hoverTimeout); expandSidebar(); updatePinVisibility(); };
  const onLeave = () => { hoverTimeout = setTimeout(collapseSidebar, 180); updatePinVisibility(); };

  sidebar.addEventListener('mouseenter', onEnter);
  sidebar.addEventListener('mouseleave', onLeave);

  if(pinBtn) {
    pinBtn.addEventListener('click', () => { 
      const newPinned = !isPinned(); 
      setPinned(newPinned); 
      updatePinButton();
      if(newPinned) { expandSidebar(); applyBodyExpanded(true); document.body.classList.add('sidebar-pinned'); }
      else { collapseSidebar(); applyBodyExpanded(false); document.body.classList.remove('sidebar-pinned'); }
    });
  }

  function shouldShowPin() { try { return isPinned() || sidebar.matches(':hover') || sidebar.classList.contains('expanded'); } catch(e) { return isPinned(); } }
  function updatePinVisibility() { if(!pinBtn) return; if(shouldShowPin()) pinBtn.classList.add('force-visible'); else pinBtn.classList.remove('force-visible'); }
  function updatePinButton() { 
    const pinned = isPinned(); 
    if(pinBtn) { 
      pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false'); 
      pinBtn.title = pinned ? 'Desfijar barra lateral' : 'Fijar barra lateral'; 
      if(pinned) pinBtn.classList.add('pinned'); else pinBtn.classList.remove('pinned'); 
    } 
  }

  if(isPinned()) expandSidebar(); else collapseSidebar();
  updatePinButton(); updatePinVisibility();
  // ensure body classes match initial state
  applyBodyExpanded(isPinned());
  if(isPinned()) document.body.classList.add('sidebar-pinned'); else document.body.classList.remove('sidebar-pinned');

  window.addEventListener('storage', (e) => {
    if(e.key === STORAGE_KEY) {
      updatePinButton();
      if(isPinned()) expandSidebar(); else collapseSidebar();
      updatePinVisibility();
    }
  });

  sidebar.dataset.sidebarInit = '1';

  function highlightActiveLink() {
    try {
      const anchors = sidebar.querySelectorAll('a[href]');
      const cur = (location.href || '').split('#')[0];
      const curPath = (new URL(cur, location.href)).pathname.replace(/\/+$/g,'').replace(/^\//,'');
      anchors.forEach(a => {
        try {
          const href = a.getAttribute('href');
          if(!href) return;
          const abs = (new URL(href, location.href)).href.split('#')[0];
          const absPath = (new URL(abs)).pathname.replace(/\/+$/g,'').replace(/^\//,'');
          const li = a.closest('li');
          if(!li) return;
          if(absPath === curPath) {
            li.classList.add('bg-gray-700');
            li.classList.add('text-white');
          } else {
            li.classList.remove('bg-gray-700');
            li.classList.remove('text-white');
          }
        } catch(e) {}
      });
    } catch(e) {}
  }

  try { highlightActiveLink(); window.addEventListener('popstate', highlightActiveLink); } catch(e) {}
}

export function ensureInitForElement(el) {
  try {
    if(!el || el.dataset.sidebarInit === '1') return;
    initSidebar(el);
    el.dataset.sidebarInit = '1';
  } catch(e) {}
}

if(typeof MutationObserver !== 'undefined') {
  const mo = new MutationObserver((records) => {
    for(const r of records) {
      for(const n of r.addedNodes) {
        if(!(n instanceof HTMLElement)) continue;
        if(n.matches && n.matches('aside.sidebar')) {
          try { initSidebar(n); n.dataset.sidebarInit = '1'; } catch(e) {}
        } else {
          const found = n.querySelector && n.querySelector('aside.sidebar');
          if(found && !found.dataset.sidebarInit) { 
            try { initSidebar(found); found.dataset.sidebarInit = '1'; } catch(e) {} 
          }
        }
      }
    }
  });
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
}