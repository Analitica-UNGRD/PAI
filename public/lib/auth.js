/* Minimal public auth shim that calls the real API via APP_CONFIG if available */
import { APP_CONFIG } from './config.js';

export const Auth = {
  async login(email, password){
    if (!APP_CONFIG || !APP_CONFIG.BASE_URL) return { success:false, message:'No API configurada' };
    try {
      // lightweight ping to ensure backend is reachable
      const resp = await fetch(APP_CONFIG.BASE_URL, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ path: 'ping', payload: {} })
      });
      if (!resp.ok) return { success:false, message: 'Servidor no responde: ' + resp.status };
      const j = await resp.json();
      return { success:false, message: 'Modo público: inicie sesión en el entorno de producción.' };
    } catch(e){ return { success:false, message: String(e) }; }
  },
  isAuthenticated: ()=>false
};

export default Auth;
