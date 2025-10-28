import actividadesApi from '../../actividades/api.js';
import { mostrarToast, obtenerEmailUsuarioActual } from '../../actividades/utils.js';
import { showLoaderDuring } from '../../../lib/loader.js';
import { ADMIN_LOADER_MESSAGE } from './constants.js';

export const activitiesMethods = {
  async loadActividades(force = false) {
    try {
      const actividades = await showLoaderDuring(
        () => actividadesApi.fetchActividades({ loaderMessage: null }),
        ADMIN_LOADER_MESSAGE,
        'solid',
        400
      );

      const lista = Array.isArray(actividades) ? actividades : [];
      this.state.actividades = lista;
      this.state.actividadesIndex = {};
      lista.forEach(item => {
        const id = this.obtenerActividadId(item);
        if (id) {
          this.state.actividadesIndex[id] = item;
        }
      });

      const termino = force ? this.state.actividadesBusqueda : (this.state.actividadesBusqueda || '');
      this.applyActividadFiltro(termino);
      this.mostrarMensajeActividad('Actividades actualizadas desde el backend.', 'info');
    } catch (error) {
      console.error('[ERROR] Error cargando actividades:', error);
      this.state.actividades = [];
      this.state.actividadesIndex = {};
      this.applyActividadFiltro('');
      this.mostrarMensajeActividad('No fue posible cargar las actividades.', 'error');
      mostrarToast('Error al obtener actividades desde el backend.', 'error');
    }
  },

  applyActividadFiltro(termino) {
    const valor = (termino || '').toString();
    const normalized = valor.trim().toLowerCase();
    this.state.actividadesBusqueda = valor;

    let filtradas = [...this.state.actividades];
    if (normalized) {
      filtradas = filtradas.filter(item => {
        const codigo = (this.obtenerActividadCodigo?.(item) || item.codigo || item.codigo_actividad || item.codigoActividad || '').toString().toLowerCase();
        const descripcion = (item.descripcion_actividad || item.descripcion || item.nombre || '').toString().toLowerCase();
        const area = (item.area || item.area_responsable || item.area_id || '').toString().toLowerCase();
        const estado = (item.estado || item.estado_actividad || '').toString().toLowerCase();
        const estadoRevision = (item.estado_revision || item.estadoRevision || '').toString().toLowerCase();
        const responsable = (item.responsable || item.responsable_nombre || item.responsable_correo || '').toString().toLowerCase();
        return codigo.includes(normalized) || descripcion.includes(normalized) || area.includes(normalized) || estado.includes(normalized) || estadoRevision.includes(normalized) || responsable.includes(normalized);
      });
    }

    this.state.actividadesFiltradas = filtradas;
    this.renderActividadesTabla(filtradas);
  },

  renderActividadesTabla(items) {
    const actividadesDom = this.dom.actividades;
    if (!actividadesDom?.tableBody) return;

    actividadesDom.tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron actividades registradas.
        </td>
      `;
      actividadesDom.tableBody.appendChild(fila);
    } else {
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        const id = this.obtenerActividadId(item);
        const codigo = this.obtenerActividadCodigo?.(item) || this.obtenerActividadId(item) || 'Sin código';
        const descripcion = item.descripcion_actividad || item.descripcion || item.nombre || 'Sin descripción';
        const area = item.area || item.area_responsable || item.area_id || 'Sin área';
        const estado = item.estado || item.estado_actividad || '';
        const estadoRevision = item.estado_revision || item.estadoRevision || 'Sin revisión';
        const responsable = item.responsable || item.responsable_nombre || item.responsable_correo || 'Sin responsable';

        const fila = document.createElement('tr');
        fila.dataset.id = id;
        fila.innerHTML = `
          <td class="px-3 py-2 text-left text-sm text-gray-900">
            <div class="font-mono text-xs uppercase tracking-wide text-indigo-600">${codigo}</div>
            ${id && id !== codigo ? `<div class="text-[11px] text-gray-400">ID: ${id}</div>` : ''}
          </td>
          <td class="px-3 py-2 text-sm text-gray-900">${descripcion}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${area}</td>
          <td class="px-3 py-2 text-sm text-gray-500">
            ${this.renderEstadoRevisionBadge(estadoRevision)}
            ${estado ? `<div class="mt-1 text-xs text-gray-400">${estado}</div>` : ''}
          </td>
          <td class="px-3 py-2 text-sm text-gray-500">${responsable}</td>
          <td class="px-3 py-2 text-right">
            <div class="flex flex-wrap justify-end gap-2">
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-600 hover:border-green-300 hover:text-green-700" data-action="approve" data-id="${id}" title="Marcar como aprobado">
                <span class="material-icons" style="font-size:14px">check_circle</span>
                Aprobar
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-600 hover:border-amber-300 hover:text-amber-700" data-action="mark-review" data-id="${id}" title="Marcar en revisión">
                <span class="material-icons" style="font-size:14px">pending</span>
                En revisión
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-orange-200 px-2 py-1 text-xs font-medium text-orange-600 hover:border-orange-300 hover:text-orange-700" data-action="request-changes" data-id="${id}" title="Solicitar correcciones">
                <span class="material-icons" style="font-size:14px">edit_note</span>
                Corrección
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600" data-action="edit" data-id="${id}">
                <span class="material-icons" style="font-size:14px">edit</span>
                Editar
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:text-red-600" data-action="delete" data-id="${id}">
                <span class="material-icons" style="font-size:14px">delete</span>
                Eliminar
              </button>
            </div>
          </td>
        `;
        fragment.appendChild(fila);
      });
      actividadesDom.tableBody.appendChild(fragment);
    }

    if (actividadesDom.summary) {
      const total = this.state.actividades.length;
      const visibles = items ? items.length : 0;
      actividadesDom.summary.textContent = total === visibles
        ? `${total} actividades`
        : `${visibles} de ${total} actividades`;
    }
  },

  handleActividadesClick(event) {
    const boton = event.target.closest('[data-action]');
    const fila = event.target.closest('tr[data-id]');
    const id = boton?.dataset.id || fila?.dataset.id;
    if (!id) return;

    const actividad = this.state.actividadesIndex[id];
    if (!actividad) {
      mostrarToast('No se encontró la actividad seleccionada.', 'warning');
      return;
    }

    const accion = boton?.dataset.action || 'edit';

    if (accion === 'delete') {
      this.confirmarEliminarActividad(id, actividad);
      return;
    }

    if (['approve', 'mark-review', 'request-changes'].includes(accion)) {
      this.procesarAccionRevisionActividad(accion, actividad);
      return;
    }

    this.mostrarActividadEnFormulario(actividad);
  },

  async procesarAccionRevisionActividad(accion, actividad) {
    const actividadId = this.obtenerActividadId(actividad);
    if (!actividadId) {
      mostrarToast('No se pudo determinar el ID de la actividad.', 'error');
      return;
    }

    const configuracion = {
      approve: {
        estado: 'Aprobado',
        confirmacion: `¿Confirmas marcar la actividad "${actividadId}" como aprobada?`,
        loader: 'Marcando actividad como aprobada...'
      },
      'mark-review': {
        estado: 'En revisión',
        confirmacion: `¿Confirmas marcar la actividad "${actividadId}" en revisión?`,
        loader: 'Actualizando estado de revisión...'
      },
      'request-changes': {
        estado: 'Corrección requerida',
        confirmacion: `¿Solicitar correcciones para la actividad "${actividadId}"?`,
        loader: 'Solicitando correcciones...',
        requiereComentarios: true
      }
    };

    const opciones = configuracion[accion];
    if (!opciones) return;

    const confirmado = window.confirm(opciones.confirmacion);
    if (!confirmado) return;

    let comentarios = '';
    if (opciones.requiereComentarios) {
      comentarios = window.prompt('Describe brevemente las correcciones requeridas:', actividad?.revision_comentarios || '') || '';
      if (!comentarios.trim()) {
        mostrarToast('Debes ingresar comentarios para solicitar correcciones.', 'warning');
        return;
      }
    }

    const revisor = this.state?.usuario?.email || obtenerEmailUsuarioActual();
    const payload = {
      actividad_id: actividadId,
      estado_revision: opciones.estado,
      revisor
    };

    if (comentarios.trim()) {
      payload.comentarios = comentarios.trim();
    }

    try {
      await showLoaderDuring(
        () => actividadesApi.reviewActividad(payload),
        opciones.loader,
        'solid',
        300
      );

      mostrarToast('Estado de revisión actualizado correctamente.', 'success');
      this.mostrarMensajeActividad(`Actividad ${actividadId} actualizada (${opciones.estado}).`, 'success');
      await this.loadActividades(true);
    } catch (error) {
      console.error('[ERROR] procesarAccionRevisionActividad:', error);
      const mensaje = error?.message || 'No fue posible actualizar el estado de revisión.';
      mostrarToast(mensaje, 'error');
      this.mostrarMensajeActividad(mensaje, 'error');
    }
  },

  mostrarActividadEnFormulario(actividad) {
    const actividadDom = this.dom.actividades;
    if (!actividadDom?.inputs) return;

    const codigo = this.obtenerActividadId(actividad);
    if (actividadDom.inputs.id) actividadDom.inputs.id.value = codigo;
    if (actividadDom.inputs.codigo) actividadDom.inputs.codigo.value = codigo;
    if (actividadDom.inputs.estado) actividadDom.inputs.estado.value = actividad.estado || actividad.estado_actividad || '';
    if (actividadDom.inputs.descripcion) actividadDom.inputs.descripcion.value = actividad.descripcion_actividad || actividad.descripcion || actividad.nombre || '';
    if (actividadDom.inputs.meta) actividadDom.inputs.meta.value = actividad.meta || actividad.meta_anual || '';
    if (actividadDom.inputs.responsable) actividadDom.inputs.responsable.value = actividad.responsable || actividad.responsable_nombre || actividad.responsable_correo || '';
    if (actividadDom.inputs.detalle) {
      try {
        actividadDom.inputs.detalle.value = JSON.stringify(actividad, null, 2);
      } catch (error) {
        actividadDom.inputs.detalle.value = '';
      }
    }

    if (actividadDom.formTitle) {
      actividadDom.formTitle.textContent = 'Editar actividad seleccionada';
    }

    this.mostrarMensajeActividad(`Actividad ${codigo || ''} cargada.`, 'info');
    this.desplazarHacia(actividadDom.form || actividadDom.root);
  },

  async confirmarEliminarActividad(id, actividad) {
    try {
      const nombre = actividad?.descripcion_actividad || actividad?.descripcion || actividad?.nombre || id;
      const confirmado = window.confirm(`¿Eliminar la actividad "${nombre}"?`);
      if (!confirmado) return;

      await showLoaderDuring(
        () => actividadesApi.callBackend('actividades/eliminar', { id }, { loaderMessage: null }),
        'Eliminando actividad',
        'solid',
        400
      );

      mostrarToast('Actividad eliminada correctamente.', 'success');
      this.mostrarMensajeActividad('Actividad eliminada correctamente.', 'success');

      if (this.dom.actividades?.inputs?.id && this.dom.actividades.inputs.id.value === id) {
        this.limpiarActividadFormulario();
      }

      await this.loadActividades(true);
    } catch (error) {
      console.error('[ERROR] Error eliminando actividad:', error);
      const mensaje = error?.message || 'No se pudo eliminar la actividad.';
      this.mostrarMensajeActividad(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  limpiarActividadFormulario() {
    const actividadDom = this.dom.actividades;
    if (!actividadDom) return;

    actividadDom.form?.reset?.();
    if (actividadDom.inputs?.detalle) actividadDom.inputs.detalle.value = '';
    if (actividadDom.inputs?.id) actividadDom.inputs.id.value = '';

    if (actividadDom.formTitle) {
      actividadDom.formTitle.textContent = 'Editar actividad seleccionada';
    }

    this.mostrarMensajeActividad('Formulario listo para nuevas consultas.', 'info');
  },

  mostrarMensajeActividad(mensaje, tipo = 'info') {
    const actividadDom = this.dom.actividades;
    if (!actividadDom?.formStatus) return;
    actividadDom.formStatus.textContent = mensaje || '';
    actividadDom.formStatus.dataset.status = tipo;
  }
};
