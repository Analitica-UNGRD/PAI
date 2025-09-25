// Thin wrapper copied to public/pages_scripts to avoid module resolution issues
import { Auth } from '../lib/auth.js';
import { UI } from '../lib/ui.js';

class LoginPage {
  constructor(){
    try{ this.form = document.getElementById('loginForm'); }catch(e){}
    this.init();
  }
  init(){
    if(!this.form) return;
    this.form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      UI.showMessage('Iniciando sesión...', 'info');
      // Attempt login using Auth.login; Auth shim in public/lib/auth.js is minimal and will fail gracefully
      try {
        const res = await Auth.login(email, password);
        if (res && res.success) { window.location.href = './dashboard.html'; }
        else { UI.showMessage(res && res.message ? res.message : 'Error de autenticación', 'error'); }
      } catch (e) { UI.showMessage('Error interno', 'error'); }
    });
  }
}

document.addEventListener('DOMContentLoaded', ()=> new LoginPage());
