/**
 * adminManager.js - Controlador del panel de administración
 */

import {
  obtenerEmailUsuarioActual,
  obtenerRolUsuarioActual,
  normalizarRol,
  obtenerPermisosRol
} from '../actividades/utils.js';
import { utilsMethods } from './manager/utils.js';
import { permissionMethods } from './manager/permissions.js';
import { catalogMethods } from './manager/catalogs.js';
import { userMethods } from './manager/users.js';
import { activitiesMethods } from './manager/activities.js';
import { avancesMethods } from './manager/avances.js';

class AdminManager {
  constructor() {
    const usuarioEmail = obtenerEmailUsuarioActual();
    const rolNormalizado = normalizarRol(obtenerRolUsuarioActual());
    const permisos = obtenerPermisosRol(rolNormalizado);

    this.state = {
      usuario: {
        email: usuarioEmail,
        rol: rolNormalizado
      },
      permisos,
      catalogoActual: '',
      catalogoItems: [],
      catalogoIndex: {},
      isLoading: false,
      actividades: [],
      actividadesFiltradas: [],
      actividadesIndex: {},
      actividadesBusqueda: '',
      usuarios: [],
      usuariosFiltrados: [],
      usuariosIndex: {},
      usuariosBusqueda: '',
      avances: [],
      avancesFiltrados: [],
      avancesIndex: {},
      avancesBusqueda: ''
    };

    this.dom = {
      root: document.getElementById('app-admin'),
      catalogSelect: document.getElementById('catalogo-tipo'),
      refreshButton: document.getElementById('catalogo-refrescar'),
      exportButton: document.getElementById('catalogo-exportar'),
      counter: document.getElementById('catalogo-contador'),
      tableBody: document.getElementById('catalogo-tabla-body'),
      form: document.getElementById('catalogo-form'),
      formTitle: document.getElementById('catalogo-form-titulo'),
      formStatus: document.getElementById('catalogo-form-status'),
      formReset: document.getElementById('catalogo-form-reset'),
      formDelete: document.getElementById('catalogo-eliminar'),
      inputs: {
        id: document.getElementById('catalogo-id'),
        idDisplay: document.getElementById('catalogo-id-display'),
        updatedAt: document.getElementById('catalogo-updated-at'),
        code: document.getElementById('catalogo-code'),
        label: document.getElementById('catalogo-label'),
        parent: document.getElementById('catalogo-parent'),
        sortOrder: document.getElementById('catalogo-sort-order'),
        active: document.getElementById('catalogo-activo')
      },
      usuarios: {
        panel: document.getElementById('panel-usuarios'),
        refreshButton: document.getElementById('usuarios-recargar'),
        searchInput: document.getElementById('usuarios-buscar'),
        summary: document.getElementById('usuarios-resumen'),
        tableBody: document.getElementById('usuarios-tabla-body'),
        form: document.getElementById('usuarios-form'),
        formTitle: document.getElementById('usuario-form-titulo'),
        formStatus: document.getElementById('usuario-form-status'),
        clearButton: document.getElementById('usuario-limpiar'),
        submitButton: document.querySelector('#usuarios-form button[type="submit"]'),
        inputs: {
          email: document.getElementById('usuario-email'),
          password: document.getElementById('usuario-password'),
          role: document.getElementById('usuario-rol'),
          area: document.getElementById('usuario-area')
        }
      },
      actividades: {
        refreshButton: document.getElementById('actividades-recargar'),
        searchInput: document.getElementById('actividades-buscar'),
        summary: document.getElementById('actividades-resumen'),
        tableBody: document.getElementById('actividades-tabla-body'),
        form: document.getElementById('actividades-form'),
        formTitle: document.getElementById('actividad-form-titulo'),
        formStatus: document.getElementById('actividad-form-status'),
        clearButton: document.getElementById('actividad-limpiar'),
        inputs: {
          id: document.getElementById('actividad-id'),
          codigo: document.getElementById('actividad-codigo'),
          estado: document.getElementById('actividad-estado'),
          descripcion: document.getElementById('actividad-descripcion'),
          meta: document.getElementById('actividad-meta'),
          responsable: document.getElementById('actividad-responsable'),
          detalle: document.getElementById('actividad-detalle')
        }
      },
      avances: {
        refreshButton: document.getElementById('avances-recargar'),
        searchInput: document.getElementById('avances-buscar'),
        summary: document.getElementById('avances-resumen'),
        tableBody: document.getElementById('avances-tabla-body'),
        form: document.getElementById('avances-form'),
        formTitle: document.getElementById('avance-form-titulo'),
        formStatus: document.getElementById('avance-form-status'),
        clearButton: document.getElementById('avance-limpiar'),
        inputs: {
          id: document.getElementById('avance-id'),
          actividad: document.getElementById('avance-actividad'),
          bimestre: document.getElementById('avance-bimestre'),
          fecha: document.getElementById('avance-fecha'),
          reportado: document.getElementById('avance-reportado'),
          detalle: document.getElementById('avance-detalle')
        }
      }
    };

    this.areaOptionsCache = new Set();
    this.usuariosAreaLoaded = false;
    this.usuarioEditando = null;

    if (!this.puedeGestionarCatalogos()) {
      this.mostrarAccesoRestringido();
      return;
    }

    this.init();
  }

  init() {
    this.applyPermissionGuards();
    this.bindEvents();
    this.establecerCatalogoInicial();

    if (this.puedeGestionarUsuarios()) {
      this.loadUsuarios();
      this.cargarAreasParaUsuarios();
    }

    this.loadActividades();
    this.loadAvances();
  }

  bindEvents() {
    if (this.dom.catalogSelect) {
      this.dom.catalogSelect.addEventListener('change', (event) => {
        const tipo = event.target.value;
        this.setCatalogoActual(tipo);
        this.loadCatalogo(true);
      });
    }

    if (this.dom.refreshButton) {
      this.dom.refreshButton.addEventListener('click', () => this.loadCatalogo(true));
    }

    if (this.dom.exportButton) {
      this.dom.exportButton.addEventListener('click', () => this.exportarCatalogo());
    }

    if (this.dom.tableBody) {
      this.dom.tableBody.addEventListener('click', (event) => this.handleTablaClick(event));
    }

    if (this.dom.form) {
      this.dom.form.addEventListener('submit', (event) => this.handleSubmitFormulario(event));
    }

    if (this.dom.formReset) {
      this.dom.formReset.addEventListener('click', () => this.limpiarFormulario());
    }

    if (this.dom.formDelete) {
      this.dom.formDelete.addEventListener('click', () => this.confirmarEliminacion());
    }

    const usuariosDom = this.dom.usuarios;
    if (this.puedeGestionarUsuarios() && usuariosDom) {
      usuariosDom.refreshButton?.addEventListener('click', () => this.loadUsuarios(true));
      usuariosDom.searchInput?.addEventListener('input', (event) => {
        this.applyUsuarioFiltro(event.target.value || '');
      });
      usuariosDom.tableBody?.addEventListener('click', (event) => this.handleUsuariosClick(event));
      usuariosDom.form?.addEventListener('submit', (event) => this.handleUsuarioSubmit(event));
      usuariosDom.clearButton?.addEventListener('click', () => this.limpiarUsuarioFormulario());
      if (usuariosDom.panel) {
        usuariosDom.panel.addEventListener('toggle', () => {
          if (usuariosDom.panel.open && !this.usuariosAreaLoaded) {
            this.cargarAreasParaUsuarios();
          }
        });
      }
    }

    const actividadesDom = this.dom.actividades;
    if (actividadesDom?.refreshButton) {
      actividadesDom.refreshButton.addEventListener('click', () => this.loadActividades(true));
    }
    if (actividadesDom?.searchInput) {
      actividadesDom.searchInput.addEventListener('input', (event) => {
        this.applyActividadFiltro(event.target.value || '');
      });
    }
    if (actividadesDom?.tableBody) {
      actividadesDom.tableBody.addEventListener('click', (event) => this.handleActividadesClick(event));
    }
    if (actividadesDom?.clearButton) {
      actividadesDom.clearButton.addEventListener('click', () => this.limpiarActividadFormulario());
    }

    const avancesDom = this.dom.avances;
    if (avancesDom?.refreshButton) {
      avancesDom.refreshButton.addEventListener('click', () => this.loadAvances(true));
    }
    if (avancesDom?.searchInput) {
      avancesDom.searchInput.addEventListener('input', (event) => {
        this.applyAvanceFiltro(event.target.value || '');
      });
    }
    if (avancesDom?.tableBody) {
      avancesDom.tableBody.addEventListener('click', (event) => this.handleAvancesClick(event));
    }
    if (avancesDom?.clearButton) {
      avancesDom.clearButton.addEventListener('click', () => this.limpiarAvanceFormulario());
    }
  }

  establecerCatalogoInicial() {
    if (!this.dom.catalogSelect) return;

    const initialValue = this.dom.catalogSelect.value || this.dom.catalogSelect.querySelector('option[value]')?.value;
    if (!initialValue) return;

    this.setCatalogoActual(initialValue);
    this.loadCatalogo(true);
  }
}

Object.assign(
  AdminManager.prototype,
  utilsMethods,
  permissionMethods,
  catalogMethods,
  userMethods,
  activitiesMethods,
  avancesMethods
);

export default AdminManager;
