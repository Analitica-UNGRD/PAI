// minimal loader shim
export function showLoaderDuring(promise, message){ return promise; }
export function showLoader(msg = 'Cargando...', style = 'transparent'){
  try {
    let el = document.getElementById('appLoader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appLoader';
      document.body.appendChild(el);
    }
    el.style.position = 'fixed';
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
    el.innerHTML = `
      <div class="app-loader-card">
        <div class="app-loader-spinner" aria-hidden="true">
          <div class="app-loader-inner"></div>
        </div>
        <div class="app-loader-text">${msg}</div>
      </div>
    `;
  } catch (e) { console.log('[loader] ', msg, style); }
}
export async function showLoaderDuring(promiseOrFunc, msg = 'Procesando...', style='transparent', minMs = 300){
  showLoader(msg, style);
  const start = Date.now();
  let result;
  if(typeof promiseOrFunc === 'function') result = await promiseOrFunc(); else result = await promiseOrFunc;
  const elapsed = Date.now() - start; if(elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
  try { const el = document.getElementById('appLoader'); if(el) el.remove(); } catch(e){}
  return result;
}
