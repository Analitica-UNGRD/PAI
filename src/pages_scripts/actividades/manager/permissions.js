import { tienePermiso } from '../utils.js';

function tienePermisoClave(clave) {
  if (!clave) return false;
  if (this.state?.permisos && Object.prototype.hasOwnProperty.call(this.state.permisos, clave)) {
    return Boolean(this.state.permisos[clave]);
  }
  return tienePermiso(this.state?.usuario?.rol, clave);
}

function puedeCrearActividades() {
  return this.tienePermisoClave('activities:create');
}

function puedeEditarActividades() {
  return this.tienePermisoClave('activities:edit');
}

function puedeEliminarActividades() {
  return this.tienePermisoClave('activities:delete');
}

function puedeCrearAvances() {
  return this.tienePermisoClave('advances:create');
}

function puedeGestionarCatalogos() {
  return this.tienePermisoClave('catalogs:manage');
}

function aplicarPermisosInterfaz() {
  const puedeCrear = this.puedeCrearActividades();
  const puedeEditar = this.puedeEditarActividades();
  const puedeEliminar = this.puedeEliminarActividades();
  const mostrarAcciones = puedeEditar || puedeEliminar;

  const btnNuevaActividad = document.getElementById('btn-nueva-actividad');
  if (btnNuevaActividad) {
    btnNuevaActividad.classList.toggle('hidden', !puedeCrear);
    btnNuevaActividad.disabled = !puedeCrear;
    btnNuevaActividad.setAttribute('aria-hidden', String(!puedeCrear));
    btnNuevaActividad.title = puedeCrear ? '' : 'Tu rol no permite crear nuevas actividades.';
  }

  if (!puedeCrear) {
    const formWrapper = document.getElementById('form-actividad');
    if (formWrapper) {
      formWrapper.classList.add('hidden');
    }
  }

  const accionesHeader = document.querySelector('#app-actividades table thead tr th:last-child');
  if (accionesHeader) {
    accionesHeader.style.display = mostrarAcciones ? '' : 'none';
  }
}

export const permissionMethods = {
  tienePermisoClave,
  puedeCrearActividades,
  puedeEditarActividades,
  puedeEliminarActividades,
  puedeCrearAvances,
  puedeGestionarCatalogos,
  aplicarPermisosInterfaz
};
