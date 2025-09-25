// Script para la página de Avances
// Usa la misma estrategia de conexión al backend que `actividades.js`:
// - En desarrollo usa el proxy local (http://localhost:3000/api)
// - En producción usa la URL del Apps Script

// Copiar lógica mínima para resolver backend y llamar al script (compatible con local proxy)
const DEFAULT_APPS_SCRIPT = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL)
  ? window.APP_CONFIG.APPS_SCRIPT_URL
  : 'https://script.google.com/macros/s/AKfycbxBj5ae8whf6pg2pY588V-TecItxK6fz5j5lBXLHFRUXHLHhPYEVisygRwhMCN6ogRoUw/exec';
const DEFAULT_DEV_PROXY = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.LOCAL_PROXY_URL)
  ? window.APP_CONFIG.LOCAL_PROXY_URL
  : 'http://localhost:3000/api';
const LOCAL_PROXY_FLAG_KEY = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.LOCAL_PROXY_FLAG_KEY)
  ? window.APP_CONFIG.LOCAL_PROXY_FLAG_KEY
  : 'USE_LOCAL_PROXY';

function shouldUseTextPlain(url) {
  try {
    if (!url) return false;
    if (!/^https?:\/\//.test(url)) return false;
    const parsed = new URL(url, window.location.href);
    const host = parsed.hostname || '';
    return host.endsWith('script.google.com') || host.endsWith('googleusercontent.com');
  } catch (err) {
    return false;
  }
}

function resolveScriptUrlForPages() {
  try {
    if (typeof window !== 'undefined') {
      if (window.APP_CONFIG_OVERRIDE && window.APP_CONFIG_OVERRIDE.BASE_URL) {
        return window.APP_CONFIG_OVERRIDE.BASE_URL;
      }
      if (window.APP_CONFIG && window.APP_CONFIG.BASE_URL) {
        return window.APP_CONFIG.BASE_URL;
      }
      if (window.location && window.location.hostname) {
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') {
          let useLocalProxy = false;
          try {
            useLocalProxy = localStorage.getItem(LOCAL_PROXY_FLAG_KEY) === 'true';
          } catch (storageErr) {
            useLocalProxy = false;
          }
          if (useLocalProxy) {
            console.log('[INFO] Avances: usando proxy local:', DEFAULT_DEV_PROXY);
            return DEFAULT_DEV_PROXY;
          }
          console.log('[INFO] Avances: host local, usando Apps Script:', DEFAULT_APPS_SCRIPT);
          return DEFAULT_APPS_SCRIPT;
        }
      }
    }
  } catch (err) {
    console.warn('[WARN] resolveScriptUrlForPages: error en logica:', err);
  }
  console.log('[INFO] Avances: fallback Apps Script:', DEFAULT_APPS_SCRIPT);
  return DEFAULT_APPS_SCRIPT;
}

const CONFIG_BACKEND = {
  SCRIPT_URL: resolveScriptUrlForPages(),
  TIMEOUT: 20000
};

/**
 * Obtener email del usuario actual — helper local que replica la lógica de `actividades.js`.
 * Intenta usar window.obtenerEmailUsuarioActual si está disponible, si no mira localStorage (auth_email, auth_token)
 */
function obtenerEmailUsuarioActualLocal() {
  try {
    if (typeof window !== 'undefined' && typeof window.obtenerEmailUsuarioActual === 'function') {
      try {
        const e = window.obtenerEmailUsuarioActual();
        if (e) return e;
      } catch (e) {
        // fallthrough
      }
    }

    const storageEmail = localStorage.getItem('auth_email');
    if (storageEmail && storageEmail.includes('@') && storageEmail !== 'null' && storageEmail !== 'undefined') {
      return storageEmail;
    }

    const token = localStorage.getItem('auth_token');
    if (token && token !== 'null') {
      try {
        const decoded = atob(token);
        const parts = decoded.split('|');
        if (parts.length >= 1 && parts[0] && parts[0].includes('@')) return parts[0];
      } catch (e) {
        // ignore
      }
    }

    return 'usuario@gestiondelriesgo.gov.co';
  } catch (err) {
    return 'usuario@gestiondelriesgo.gov.co';
  }
}

async function llamarBackend(path, payload = {}) {
  const exec = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG_BACKEND.TIMEOUT);
    try {
      const readPaths = ['actividades/obtener', 'getCatalogos', 'ping', 'actividades/buscar'];
      let response;
      if (readPaths.some(p => path === p || path.startsWith(p))) {
        const qs = '?path=' + encodeURIComponent(path) + (Object.keys(payload || {}).length ? '&payload=' + encodeURIComponent(JSON.stringify(payload)) : '');
        const url = CONFIG_BACKEND.SCRIPT_URL + qs;
        response = await fetch(url, { method: "GET", signal: controller.signal });
      } else {
        const usePlain = shouldUseTextPlain(CONFIG_BACKEND.SCRIPT_URL);
        const postHeaders = usePlain ? { 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' };
        response = await fetch(CONFIG_BACKEND.SCRIPT_URL, {
          method: 'POST',
          headers: postHeaders,
          body: JSON.stringify({ path: path, payload: payload }),
          signal: controller.signal
        });
      }
      if (!response.ok) throw new Error("Respuesta del servidor: " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const loader = (typeof window !== 'undefined' && window.APP_LOADER && typeof window.APP_LOADER.showLoaderDuring === 'function') ? window.APP_LOADER : null;
  if (loader) {
    return await loader.showLoaderDuring(exec(), obtenerMensajeLoader(path), 'solid');
  }

  return exec();
}

function obtenerMensajeLoader(path) {
  try {
    if (!path) return 'Sincronizando con el servidor...';
    const p = path.toString().toLowerCase();
    if (p.includes('crear')) return 'Guardando avance...';
    if (p.includes('actualizar')) return 'Actualizando avance...';
    if (p.includes('eliminar')) return 'Eliminando avance...';
    if (p.includes('obtener') || p.includes('get') || p.includes('buscar')) return 'Cargando informaci�n desde el servidor...';
    return 'Procesando...';
  } catch (error) {
    return 'Procesando...';
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.querySelector('.export-avances-btn');
  if (exportBtn) exportBtn.addEventListener('click', () => alert('Exportar avances (pendiente de implementar en backend)'));

  const actividadSelect = document.getElementById('actividad_id');
  const avanceForm = document.getElementById('form-registrar-avance');
  const avanceIdInput = document.getElementById('avance_id');

  function generateAvanceId() {
    return 'av_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  // Cargar actividades usando la misma ruta que el backend espera
  async function loadActividadesFromApi() {
    if (!actividadSelect) return;
    actividadSelect.innerHTML = '<option value="">Cargando actividades...</option>';
    try {
      // Llamar al backend con la ruta que actividades.js utiliza
      const response = await llamarBackend('actividades/obtener', { incluir_catalogos: true });
      if (!response || !response.success) throw new Error(response && response.error ? response.error : 'Respuesta inválida');
      const items = response.data || [];
      actividadSelect.innerHTML = '<option value="">-- Seleccionar actividad --</option>';
      items.forEach(item => {
        const id = item.actividad_id || item.id || item._id || item.activity_id || '';
        const label = item.descripcion_actividad || item.label || item.nombre || item.name || item.title || String(id);
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = label;
        actividadSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error cargando actividades desde backend', err);
      actividadSelect.innerHTML = '<option value="">Error cargando actividades</option>';
    }
  }

  loadActividadesFromApi();

  if (avanceForm) {
    if (avanceIdInput) avanceIdInput.value = generateAvanceId();
    // Autofill 'reportado_por' with the current session user if helper exists
    try {
      const reporterInput = document.getElementById('reportado_por');
      if (reporterInput) {
        const email = obtenerEmailUsuarioActualLocal();
        if (email) {
          reporterInput.value = email;
          reporterInput.setAttribute('readonly', 'true');
          reporterInput.classList.add('bg-gray-50', 'cursor-not-allowed');
        }
      }
    } catch (e) {
      console.warn('No se pudo auto-llenar reportado_por:', e);
    }

    avanceForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      const fd = new FormData(form);

      const required = ['actividad_id','bimestre_id','fecha_reporte','reportado_por'];
      for (const k of required) {
        if (!fd.get(k) || String(fd.get(k)).trim() === '') {
          alert('Por favor complete el campo: ' + k);
          return;
        }
      }

      let avanceId = fd.get('avance_id');
      if (!avanceId) {
        avanceId = generateAvanceId();
        fd.set('avance_id', avanceId);
      }

      // Ensure reportado_por is populated from session if empty
      try {
        const reporterInput = document.getElementById('reportado_por');
        if (reporterInput && (!reporterInput.value || reporterInput.value.trim() === '')) {
          const email = obtenerEmailUsuarioActualLocal();
          if (email) reporterInput.value = email;
        }
      } catch (e) { /* ignore */ }

      const payload = {
        avance_id: fd.get('avance_id'),
        actividad_id: fd.get('actividad_id'),
        anio: fd.get('anio'),
        bimestre_id: fd.get('bimestre_id'),
        logro_valor: fd.get('logro_valor') || null,
        presupuesto_ejecutado_bimestre: fd.get('presupuesto_ejecutado_bimestre') || null,
        avances_texto: fd.get('avances_texto') || '',
        dificultades_texto: fd.get('dificultades_texto') || '',
        evidencia_url: fd.get('evidencia_url') || '',
        fecha_reporte: fd.get('fecha_reporte') || '',
        reportado_por: fd.get('reportado_por') || ''
      };

      console.log('Enviando payload al backend (avances/crear):', payload);

      const btn = form.querySelector('button[type="submit"]');
      const origHtml = btn ? btn.innerHTML : null;
      if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; }

      try {
        // Usar la ruta 'avances/crear' en el backend Apps Script (adaptar si tu backend usa otro nombre)
        const res = await llamarBackend('avances/crear', payload);
        if (!res || !res.success) {
          throw new Error((res && (res.error || res.message)) || 'Error desconocido al guardar avance');
        }

        // La API usa el campo `data` para el objeto creado
        const saved = (res && res.data) ? res.data : res;
        console.log('Respuesta guardar avance:', res);

        // Actualizar id si backend lo devuelve
        if (saved && (saved.avance_id || saved.id)) {
          const savedId = saved.avance_id || saved.id;
          if (avanceIdInput) avanceIdInput.value = savedId;
        }

        // Mostrar detalles al usuario (útil en debugging)
        try {
          alert('Avance guardado correctamente. ID: ' + (saved.avance_id || saved.id || 'n/a'));
        } catch (e) { /* ignore */ }
        form.reset();
        // restore generated avance id
        if (avanceIdInput) avanceIdInput.value = generateAvanceId();
        // refill reportado_por after reset (keep readonly)
        try {
          const reporterInput = document.getElementById('reportado_por');
          if (reporterInput) {
            const email = obtenerEmailUsuarioActualLocal();
            if (email) {
              reporterInput.value = email;
              reporterInput.setAttribute('readonly', 'true');
              reporterInput.classList.add('bg-gray-50', 'cursor-not-allowed');
            }
          }
        } catch (e) {
          console.warn('No se pudo restaurar reportado_por tras reset:', e);
        }
      } catch (err) {
        console.error('Error guardando avance:', err);
        alert('Error guardando avance. Revisa la consola para más detalles.');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      }
    });
  }
});








