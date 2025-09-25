/* Minimal UI shim copied to public/ for production static serving */
export function toast(type, message, ms=3500){
  try{ console.log('toast', type, message); }catch(e){}
}
export function showMessage(m,t){ toast(t,m); }
export const UI = { toast, showMessage };
