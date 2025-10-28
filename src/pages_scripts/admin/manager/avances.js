import actividadesApi from '../../actividades/api.js';
import { mostrarToast, obtenerEmailUsuarioActual } from '../../actividades/utils.js';
import { showLoaderDuring } from '../../../lib/loader.js';
import { ADMIN_LOADER_MESSAGE } from './constants.js';

export const avancesMethods = {
  async loadAvances(force = false) {
    try {
      const respuesta = await showLoaderDuring(
        () => actividadesApi.callBackend('avances/obtener', {}, { loaderMessage: null }),
        ADMIN_LOADER_MESSAGE,
        'solid',
        400
      );

      const lista = respuesta && Array.isArray(respuesta.data)
        ? respuesta.data
        : Array.isArray(respuesta)
          ? respuesta
          : Array.isArray(respuesta?.items)
            ? respuesta.items
            : [];

      this.state.avances = lista;
      this.state.avancesIndex = {};
      lista.forEach(item => {
        const id = this.obtenerAvanceId(item);
        if (id) {
          this.state.avancesIndex[id] = item;
        }
      });

      const termino = force ? this.state.avancesBusqueda : (this.state.avancesBusqueda || '');
      this.applyAvanceFiltro(termino);
      this.mostrarMensajeAvance('Avances actualizados desde el backend.', 'info');
    } catch (error) {
      console.error('[ERROR] Error cargando avances:', error);
      this.state.avances = [];
      this.state.avancesIndex = {};
      this.applyAvanceFiltro('');
      this.mostrarMensajeAvance('No fue posible cargar los avances.', 'error');
      mostrarToast('Error al obtener avances desde el backend.', 'error');
    }
  },

  applyAvanceFiltro(termino) {
    const valor = (termino || '').toString();
    const normalized = valor.trim().toLowerCase();
    this.state.avancesBusqueda = valor;

    let filtrados = [...this.state.avances];
    if (normalized) {
      filtrados = filtrados.filter(item => {
        const codigoActividad = (this.obtenerActividadCodigo?.(item) || item.actividad_codigo || item.codigo || '').toString().toLowerCase();
        const actividad = (item.actividad_id || item.actividad || '').toString().toLowerCase();
        const bimestre = (item.bimestre_id || item.bimestre || '').toString().toLowerCase();
        const responsable = (item.reportado_por || '').toString().toLowerCase();
  const estadoRevision = (item.estado_revision || item.estadoRevision || '').toString().toLowerCase();
        return codigoActividad.includes(normalized) || actividad.includes(normalized) || bimestre.includes(normalized) || responsable.includes(normalized) || estadoRevision.includes(normalized);
      });
    }

    this.state.avancesFiltrados = filtrados;
    this.renderAvancesTabla(filtrados);
  },

  renderAvancesTabla(items) {
    const avancesDom = this.dom.avances;
    if (!avancesDom?.tableBody) return;

    avancesDom.tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron registros de avance.
        </td>
      `;
      avancesDom.tableBody.appendChild(fila);
    } else {
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const id = this.obtenerAvanceId(item);
        let actividad = item.actividad || item.actividad_nombre || item.actividad_id || 'Sin actividad';
        if (actividad && typeof actividad === 'object') {
          actividad = actividad.descripcion_actividad || actividad.descripcion || actividad.nombre || actividad.titulo || actividad.label || actividad.id || actividad.codigo || 'Sin actividad';
        }
        actividad = actividad || 'Sin actividad';
    const bimestre = item.bimestre_id || item.bimestre || 'Sin bimestre';
    const responsable = item.reportado_por || 'Sin responsable';
    const estadoRevision = item.estado_revision || item.estadoRevision || 'Sin revisión';
    const estadoHtml = this.renderEstadoRevisionBadge(estadoRevision);
        const codigoActividad = (this.obtenerActividadCodigo?.(item) || item.actividad_codigo || item.codigo || '').toString().trim() || actividad;
        const fecha = item.fecha_reporte ? this.formatearFecha(item.fecha_reporte) : 'Sin fecha';

        const fila = document.createElement('tr');
        fila.dataset.id = id;
        fila.innerHTML = `
          <td class="px-3 py-2 text-left text-sm font-mono text-gray-700">${id || 'N/A'}</td>
          <td class="px-3 py-2 text-sm text-gray-900">
            <div class="font-mono text-xs uppercase tracking-wide text-indigo-600">${codigoActividad}</div>
          </td>
          <td class="px-3 py-2 text-sm text-gray-900">${actividad}</td>
          <td class="px-3 py-2 text-sm text-gray-500">
            <div>${bimestre}</div>
            <div class="mt-1">${estadoHtml}</div>
          </td>
          <td class="px-3 py-2 text-sm text-gray-500">${responsable}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${fecha}</td>
          <td class="px-3 py-2 text-right">
            <div class="flex justify-end gap-2">
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-600 hover:border-green-300 hover:text-green-700" data-action="approve" data-id="${id}">
                <span class="material-icons" style="font-size:14px">check_circle</span>
                Aprobar
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-600 hover:border-amber-300 hover:text-amber-700" data-action="mark-review" data-id="${id}">
                <span class="material-icons" style="font-size:14px">pending</span>
                En revisión
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-orange-200 px-2 py-1 text-xs font-medium text-orange-600 hover:border-orange-300 hover:text-orange-700" data-action="request-changes" data-id="${id}">
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

      avancesDom.tableBody.appendChild(fragment);
    }

    if (avancesDom.summary) {
      const total = this.state.avances.length;
      const visibles = items ? items.length : 0;
      avancesDom.summary.textContent = total === visibles
        ? `${total} registros`
        : `${visibles} de ${total} registros`;
    }
  },

  handleAvancesClick(event) {
    const boton = event.target.closest('[data-action]');
    const fila = event.target.closest('tr[data-id]');
    const id = boton?.dataset.id || fila?.dataset.id;
    if (!id) return;

    const avance = this.state.avancesIndex[id];
    if (!avance) {
      mostrarToast('No se encontró el avance seleccionado.', 'warning');
      return;
    }

    const accion = boton?.dataset.action || 'edit';

    if (accion === 'delete') {
      this.confirmarEliminarAvance(id, avance);
      return;
    }

    if (['approve', 'mark-review', 'request-changes'].includes(accion)) {
      this.procesarAccionRevisionAvance(accion, avance);
      return;
    }

    this.mostrarAvanceEnFormulario(avance);
  },

  async procesarAccionRevisionAvance(accion, avance) {
    const avanceId = this.obtenerAvanceId(avance);
    if (!avanceId) {
      mostrarToast('No se pudo determinar el ID del avance.', 'error');
      return;
    }

    const configuracion = {
      approve: {
        estado: 'Aprobado',
        confirmacion: `¿Confirmas marcar el avance "${avanceId}" como aprobado?`,
        loader: 'Marcando avance como aprobado...'
      },
      'mark-review': {
        estado: 'En revisión',
        confirmacion: `¿Confirmas marcar el avance "${avanceId}" en revisión?`,
        loader: 'Actualizando estado de revisión...'
      },
      'request-changes': {
        estado: 'Corrección requerida',
        confirmacion: `¿Solicitar correcciones para el avance "${avanceId}"?`,
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
      comentarios = window.prompt('Describe brevemente las correcciones requeridas:', avance?.revision_comentarios || '') || '';
      if (!comentarios.trim()) {
        mostrarToast('Debes ingresar comentarios para solicitar correcciones.', 'warning');
        return;
      }
    }

    const revisor = this.state?.usuario?.email || obtenerEmailUsuarioActual();
    const payload = {
      avance_id: avanceId,
      estado_revision: opciones.estado,
      revisor
    };

    if (comentarios.trim()) {
      payload.comentarios = comentarios.trim();
    }

    try {
      await showLoaderDuring(
        () => actividadesApi.reviewAvance(payload),
        opciones.loader,
        'solid',
        300
      );

      mostrarToast('Estado de revisión del avance actualizado.', 'success');
      this.mostrarMensajeAvance(`Avance ${avanceId} actualizado (${opciones.estado}).`, 'success');
      await this.loadAvances(true);
    } catch (error) {
      console.error('[ERROR] procesarAccionRevisionAvance:', error);
      const mensaje = error?.message || 'No fue posible actualizar el estado de revisión.';
      mostrarToast(mensaje, 'error');
      this.mostrarMensajeAvance(mensaje, 'error');
    }
  },

  mostrarAvanceEnFormulario(avance) {
    const avancesDom = this.dom.avances;
    if (!avancesDom?.inputs) return;

    const id = this.obtenerAvanceId(avance);
    if (avancesDom.inputs.id) avancesDom.inputs.id.value = id;
    if (avancesDom.inputs.actividad) avancesDom.inputs.actividad.value = avance.actividad_id || avance.actividad || '';
    if (avancesDom.inputs.bimestre) avancesDom.inputs.bimestre.value = avance.bimestre_id || avance.bimestre || '';
    if (avancesDom.inputs.fecha) avancesDom.inputs.fecha.value = this.formatearFechaISO(avance.fecha_reporte);
    if (avancesDom.inputs.reportado) avancesDom.inputs.reportado.value = avance.reportado_por || '';
    if (avancesDom.inputs.detalle) {
      try {
        avancesDom.inputs.detalle.value = JSON.stringify(avance, null, 2);
      } catch (error) {
        avancesDom.inputs.detalle.value = '';
      }
    }

    if (avancesDom.formTitle) {
      avancesDom.formTitle.textContent = 'Editar avance seleccionado';
    }

    this.mostrarMensajeAvance(`Avance ${id || ''} cargado.`, 'info');
    this.desplazarHacia(avancesDom.form || avancesDom.root);
  },

  async confirmarEliminarAvance(id, avance) {
    try {
      const referencia = avance?.actividad_id || avance?.actividad || id;
      const confirmado = window.confirm(`¿Eliminar el avance asociado a "${referencia}"?`);
      if (!confirmado) return;

      await showLoaderDuring(
        () => actividadesApi.callBackend('avances/eliminar', { id }, { loaderMessage: null }),
        'Eliminando avance',
        'solid',
        400
      );

      mostrarToast('Avance eliminado correctamente.', 'success');
      this.mostrarMensajeAvance('Avance eliminado correctamente.', 'success');

      if (this.dom.avances?.inputs?.id && this.dom.avances.inputs.id.value === id) {
        this.limpiarAvanceFormulario();
      }

      await this.loadAvances(true);
    } catch (error) {
      console.error('[ERROR] Error eliminando avance:', error);
      const mensaje = error?.message || 'No se pudo eliminar el avance.';
      this.mostrarMensajeAvance(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  limpiarAvanceFormulario() {
    const avancesDom = this.dom.avances;
    if (!avancesDom) return;

    avancesDom.form?.reset?.();
    if (avancesDom.inputs?.detalle) avancesDom.inputs.detalle.value = '';
    if (avancesDom.inputs?.id) avancesDom.inputs.id.value = '';

    if (avancesDom.formTitle) {
      avancesDom.formTitle.textContent = 'Editar avance seleccionado';
    }

    this.mostrarMensajeAvance('Formulario listo para nuevas consultas.', 'info');
  },

  mostrarMensajeAvance(mensaje, tipo = 'info') {
    const avancesDom = this.dom.avances;
    if (!avancesDom?.formStatus) return;
    avancesDom.formStatus.textContent = mensaje || '';
    avancesDom.formStatus.dataset.status = tipo;
  }
};
