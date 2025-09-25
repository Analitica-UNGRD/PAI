/**
 * @fileoverview Utilidades mínimas para la interfaz de usuario
 * Este módulo proporciona funciones para gestionar notificaciones toast y modales,
 * permitiendo una interacción más rica con el usuario.
 */

/**
 * Crea un elemento DOM para una notificación toast
 * @private
 * @param {string} type - Tipo de notificación ('success', 'error', 'info')
 * @param {string} message - Mensaje a mostrar
 * @returns {HTMLElement} - Elemento DOM para la notificación
 */
function makeToastEl(type, message){
	const el = document.createElement('div');
	el.className = 'app-toast';
	// Estilos inline por defecto (asegura visibilidad aunque no exista framework CSS)
	el.style.padding = '10px 14px';
	el.style.borderRadius = '8px';
	el.style.marginBottom = '10px';
	el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
	el.style.fontSize = '0.95rem';
	el.style.display = 'flex';
	el.style.alignItems = 'center';
	el.style.gap = '8px';

	// Establece los colores según el tipo de notificación
	if(type === 'success') { el.style.backgroundColor = '#ECFDF5'; el.style.color = '#065F46'; }
	else if(type === 'error') { el.style.backgroundColor = '#FEF2F2'; el.style.color = '#991B1B'; }
	else { el.style.backgroundColor = '#F8FAFC'; el.style.color = '#0F172A'; }

	el.textContent = message;
	return el;
}

/**
 * Muestra una notificación toast
 * @param {string} type - Tipo de notificación ('success', 'error', 'info')
 * @param {string} message - Mensaje a mostrar
 * @param {number} ms - Duración en milisegundos
 */
export function toast(type, message, ms=3500){
	try{
		let container = document.getElementById('toastContainer');
		// Si no existe el contenedor, crearlo y aplicarle estilos
		if(!container){
			container = document.createElement('div');
			container.id = 'toastContainer';
			container.style.position = 'fixed';
			container.style.top = '16px';
			container.style.right = '16px';
			container.style.zIndex = '999999';
			container.style.display = 'flex';
			container.style.flexDirection = 'column';
			container.style.alignItems = 'flex-end';
			document.body.appendChild(container);
		}

		const el = makeToastEl(type, message);
		container.appendChild(el);

		// Desvanecer y eliminar después del tiempo especificado
		setTimeout(()=>{ 
			el.style.transition = 'opacity 0.25s';
			el.style.opacity = '0';
			setTimeout(()=> el.remove(), 300); 
		}, ms);
	}catch(e){ console.error(e); }
}

/**
 * Abre un modal por su ID
 * @param {string} id - ID del elemento modal
 */
export function openModal(id){
	const el = document.getElementById(id); if(!el) return;
	el.classList.remove('hidden');
	
	// Enfoca automáticamente el primer input dentro del modal
	const fi = el.querySelector('input,button,textarea'); 
	if(fi) fi.focus();
}

/**
 * Cierra un modal por su ID
 * @param {string} id - ID del elemento modal
 */
export function closeModal(id){
	const el = document.getElementById(id); if(!el) return;
	el.classList.add('hidden');
}

/**
 * Muestra un mensaje (compatibilidad con versiones anteriores)
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de mensaje ('info', 'success', 'error')
 * @param {number} ms - Duración en milisegundos
 */
export function showMessage(message, type='info', ms=3500){
	// Normaliza los argumentos: toast espera (type, message, ms)
	try{ return toast(type, message, ms); }catch(e){ console.error(e); }
}

/**
 * Objeto UI para acceso conveniente a las funciones
 * @type {Object}
 */
export const UI = { toast, showMessage, openModal, closeModal };