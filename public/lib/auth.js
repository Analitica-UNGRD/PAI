/* Minimal public auth shim that calls the real API via APP_CONFIG if available */
import { APP_CONFIG } from './config.js';

export const Auth = {
  async login(email, password){
    if (!APP_CONFIG || !APP_CONFIG.BASE_URL) return { success:false, message:'No API configurada' };
    try {
      const resp = await fetch(APP_CONFIG.BASE_URL, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ path: 'login', payload: { email, password } })
      });
      const txt = await resp.text();
      // Try parse JSON; if parse fails, return raw text
      try {
        const body = JSON.parse(txt);
        // If backend returned an error status, forward it
        if (!resp.ok) return { success:false, message: body && (body.message || body.error) ? (body.message || body.error) : `Servidor no responde: ${resp.status}` };
        return body;
      } catch (e) {
        if (!resp.ok) return { success:false, message: `Servidor no responde: ${resp.status} - ${txt}` };
        return { success: true, message: 'OK' };
      }
    } catch(e){ return { success:false, message: String(e) }; }
  },
  isAuthenticated: ()=>false
};

export default Auth;
