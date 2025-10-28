import apiService from '../api.js';
import { mostrarToast, normalizarRol } from '../../actividades/utils.js';
import { showLoaderDuring } from '../../../lib/loader.js';

export const userMethods = {
  async cargarAreasParaUsuarios() {
    if (!this.puedeGestionarUsuarios() || this.usuariosAreaLoaded) {
      return;
    }

    try {
      const areas = await apiService.fetchCatalogo('area', { forceRefresh: false });
      if (Array.isArray(areas) && areas.length) {
        const etiquetas = areas
          .map(item => item?.label || item?.nombre || item?.descripcion || item?.area || '')
          .filter(valor => Boolean(valor && valor.trim()));
        this.actualizarOpcionesArea(etiquetas);
      }
    } catch (error) {
      console.warn('[WARN] No se pudieron cargar las áreas para el formulario de usuarios:', error);
    } finally {
      this.usuariosAreaLoaded = true;
    }
  },

  actualizarOpcionesArea(valores = []) {
    if (!Array.isArray(valores) || valores.length === 0) return;

    valores.forEach(valor => {
      const texto = (valor || '').toString().trim();
      if (texto) {
        this.areaOptionsCache.add(texto);
      }
    });

    const usuariosDom = this.dom.usuarios;
    const areaSelect = usuariosDom?.inputs?.area;
    if (!areaSelect) return;

    const previousValue = areaSelect.value || '';
    areaSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Sin área (opcional)';
    areaSelect.appendChild(defaultOption);

    Array.from(this.areaOptionsCache)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
      .forEach(valor => {
        const option = document.createElement('option');
        option.value = valor;
        option.textContent = valor;
        areaSelect.appendChild(option);
      });

    if (previousValue && this.areaOptionsCache.has(previousValue)) {
      areaSelect.value = previousValue;
    } else {
      areaSelect.value = '';
    }
  },

  obtenerEtiquetaRol(rol) {
    const normalized = normalizarRol(rol);
    switch (normalized) {
      case 'admin':
        return 'Administrador';
      case 'contribuidor':
        return 'Contribuidor';
      case 'visualizador':
      default:
        return 'Visualizador';
    }
  },

  async loadUsuarios(force = false) {
    if (!this.puedeGestionarUsuarios()) return;

    try {
      const usuarios = await showLoaderDuring(
        () => apiService.fetchUsuarios(),
        'Cargando usuarios registrados...',
        'solid',
        400
      );

      const lista = Array.isArray(usuarios) ? usuarios : [];
      this.state.usuarios = lista;
      this.state.usuariosIndex = {};

      lista.forEach((item) => {
        const email = (item?.email || item?.correo || '').toString().trim().toLowerCase();
        if (email) {
          this.state.usuariosIndex[email] = item;
        }
      });

      const termino = force ? this.state.usuariosBusqueda : (this.state.usuariosBusqueda || '');
      this.applyUsuarioFiltro(termino);
      this.mostrarMensajeUsuario('Usuarios actualizados desde el backend.', 'info');

      const areas = lista.map(item => item?.area || '').filter(Boolean);
      this.actualizarOpcionesArea(areas);
    } catch (error) {
      console.error('[ERROR] Error cargando usuarios:', error);
      this.state.usuarios = [];
      this.state.usuariosIndex = {};
      this.applyUsuarioFiltro('');
      const mensaje = error?.message || 'No fue posible cargar los usuarios.';
      this.mostrarMensajeUsuario(mensaje, 'error');
      mostrarToast('Error al obtener usuarios desde el backend.', 'error');
    }
  },

  applyUsuarioFiltro(termino) {
    if (!this.puedeGestionarUsuarios()) return;

    const valor = (termino || '').toString();
    const normalized = valor.trim().toLowerCase();
    this.state.usuariosBusqueda = valor;

    let filtrados = [...this.state.usuarios];
    if (normalized) {
      filtrados = filtrados.filter(item => {
        const email = (item?.email || item?.correo || '').toString().toLowerCase();
        const rol = (item?.role || item?.rol || '').toString().toLowerCase();
        const area = (item?.area || '').toString().toLowerCase();
        return email.includes(normalized) || rol.includes(normalized) || area.includes(normalized);
      });
    }

    this.state.usuariosFiltrados = filtrados;
    this.renderUsuariosTabla(filtrados);
  },

  renderUsuariosTabla(items) {
    if (!this.puedeGestionarUsuarios()) return;

    const usuariosDom = this.dom.usuarios;
    if (!usuariosDom?.tableBody) return;

    usuariosDom.tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron usuarios registrados.
        </td>
      `;
      usuariosDom.tableBody.appendChild(fila);
    } else {
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const email = (item?.email || item?.correo || '').toString().trim().toLowerCase();
        const rol = this.obtenerEtiquetaRol(item?.role || item?.rol);
        const area = (item?.area || '').toString() || 'Sin área';
        const creado = item?.created_at ? this.formatearFecha(item.created_at, { includeTime: false }) : 'Sin registro';

        const fila = document.createElement('tr');
        fila.dataset.email = email;
        fila.innerHTML = `
          <td class="px-3 py-2 text-left text-sm text-gray-900">${email || 'N/A'}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${rol}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${area || 'Sin área'}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${creado || 'Sin registro'}</td>
          <td class="px-3 py-2 text-right">
            <div class="flex justify-end gap-2">
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600" data-action="edit" data-email="${email}">
                <span class="material-icons" style="font-size:14px">edit</span>
                Editar
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:text-red-600" data-action="delete" data-email="${email}">
                <span class="material-icons" style="font-size:14px">person_remove</span>
                Eliminar
              </button>
            </div>
          </td>
        `;
        fragment.appendChild(fila);
      });
      usuariosDom.tableBody.appendChild(fragment);
    }

    if (usuariosDom.summary) {
      const total = this.state.usuarios.length;
      const visibles = items ? items.length : 0;
      usuariosDom.summary.textContent = total === visibles
        ? `${total} usuarios`
        : `${visibles} de ${total} usuarios`;
    }
  },

  mostrarMensajeUsuario(mensaje, tipo = 'info') {
    const usuariosDom = this.dom.usuarios;
    if (!usuariosDom?.formStatus) return;
    usuariosDom.formStatus.textContent = mensaje || '';
    usuariosDom.formStatus.dataset.status = tipo;
  },

  limpiarUsuarioFormulario() {
    if (!this.puedeGestionarUsuarios()) return;

    const usuariosDom = this.dom.usuarios;
    usuariosDom?.form?.reset?.();
    if (usuariosDom?.inputs?.password) {
      usuariosDom.inputs.password.value = '';
      usuariosDom.inputs.password.placeholder = 'Debe compartirse por canal seguro';
    }

    if (usuariosDom?.inputs?.area) {
      usuariosDom.inputs.area.value = '';
    }

    if (usuariosDom?.inputs?.email) {
      usuariosDom.inputs.email.readOnly = false;
      usuariosDom.inputs.email.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
    }

    if (usuariosDom?.submitButton) {
      usuariosDom.submitButton.innerHTML = `
        <span class="material-icons text-base">person_add</span>
        Registrar usuario
      `;
    }

    this.usuarioEditando = null;

    usuariosDom?.inputs?.email?.focus?.();

    if (usuariosDom?.formTitle) {
      usuariosDom.formTitle.textContent = 'Registrar nuevo usuario';
    }

    this.mostrarMensajeUsuario('Formulario listo para un nuevo registro.', 'info');
  },

  async handleUsuarioSubmit(event) {
    event.preventDefault();
    if (!this.puedeGestionarUsuarios()) return;

    const usuariosDom = this.dom.usuarios;
    if (!usuariosDom?.inputs) return;

    const email = (usuariosDom.inputs.email?.value || '').toString().trim().toLowerCase();
    const password = (usuariosDom.inputs.password?.value || '').toString();
    const role = normalizarRol(usuariosDom.inputs.role?.value || 'contribuidor');
    const area = (usuariosDom.inputs.area?.value || '').toString().trim();

    const editingEmail = (this.usuarioEditando?.email || this.usuarioEditando?.correo || '').toString().trim().toLowerCase();
    const isEditing = Boolean(editingEmail && editingEmail === email);

    if (!email) {
      const mensaje = 'Debes ingresar el correo del usuario.';
      this.mostrarMensajeUsuario(mensaje, 'error');
      mostrarToast(mensaje, 'warning');
      return;
    }

    if (!isEditing && !password) {
      const mensaje = 'Debes ingresar una contraseña temporal para crear el usuario.';
      this.mostrarMensajeUsuario(mensaje, 'error');
      mostrarToast(mensaje, 'warning');
      return;
    }

    if (password && password.length > 0 && password.length < 8) {
      const mensaje = 'La contraseña debe tener al menos 8 caracteres.';
      this.mostrarMensajeUsuario(mensaje, 'error');
      mostrarToast(mensaje, 'warning');
      return;
    }

    try {
      if (isEditing) {
        const payload = { email, role, area };
        if (password) {
          payload.password = password;
        }

        const resultado = await showLoaderDuring(
          () => apiService.updateUsuario(payload),
          'Actualizando usuario...',
          'solid',
          400
        );

        const passwordInfo = resultado?.passwordUpdated ? ' Se asignó una nueva contraseña.' : '';
        mostrarToast('Usuario actualizado correctamente.', 'success');
        this.mostrarMensajeUsuario(`Cambios guardados para ${email}.${passwordInfo}`, 'success');
        if (area) {
          this.actualizarOpcionesArea([area]);
        }
      } else {
        await showLoaderDuring(
          () => apiService.createUsuario({ email, password, role, area }),
          'Registrando usuario...',
          'solid',
          400
        );

        mostrarToast('Usuario creado correctamente.', 'success');
        this.mostrarMensajeUsuario(`Usuario ${email} registrado con éxito.`, 'success');
        if (area) {
          this.actualizarOpcionesArea([area]);
        }
      }

      this.limpiarUsuarioFormulario();
      await this.loadUsuarios(true);
    } catch (error) {
      console.error('[ERROR] Error guardando usuario:', error);
      const mensaje = error?.message || 'No fue posible guardar el usuario.';
      this.mostrarMensajeUsuario(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  handleUsuariosClick(event) {
    if (!this.puedeGestionarUsuarios()) return;

    const boton = event.target.closest('button[data-action]');
    if (!boton) return;

    const accion = boton.dataset.action;
    const email = boton.dataset.email || boton.closest('tr')?.dataset.email;
    if (!email) {
      mostrarToast('No se pudo determinar el usuario seleccionado.', 'warning');
      return;
    }

    if (accion === 'edit') {
      this.prepararEdicionUsuario(email);
      return;
    }

    if (accion === 'delete') {
      this.confirmarEliminarUsuario(email);
    }
  },

  async confirmarEliminarUsuario(email) {
    if (!this.puedeGestionarUsuarios()) return;

    const correo = (email || '').toString().trim().toLowerCase();
    if (!correo) return;

    if (correo === (this.state?.usuario?.email || '').toString().trim().toLowerCase()) {
      const mensaje = 'No puedes eliminar tu propia cuenta desde este panel.';
      this.mostrarMensajeUsuario(mensaje, 'warning');
      mostrarToast(mensaje, 'warning');
      return;
    }

    const usuarioObjetivo = this.state?.usuariosIndex?.[correo];
    if (usuarioObjetivo) {
      const rolObjetivo = normalizarRol(usuarioObjetivo.role || usuarioObjetivo.rol);
      if (rolObjetivo === 'admin') {
        const totalAdmins = this.state.usuarios.filter(item => normalizarRol(item?.role || item?.rol) === 'admin').length;
        if (totalAdmins <= 1) {
          const mensaje = 'Debe permanecer al menos un administrador activo en el sistema.';
          this.mostrarMensajeUsuario(mensaje, 'warning');
          mostrarToast(mensaje, 'warning');
          return;
        }
      }
    }

    const confirmado = window.confirm(`¿Eliminar la cuenta ${correo}? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

    try {
      await showLoaderDuring(
        () => apiService.deleteUsuario(correo),
        'Eliminando usuario...',
        'solid',
        400
      );

      mostrarToast('Usuario eliminado correctamente.', 'success');
      this.mostrarMensajeUsuario(`Usuario ${correo} eliminado.`, 'success');
      await this.loadUsuarios(true);
    } catch (error) {
      console.error('[ERROR] Error eliminando usuario:', error);
      const mensaje = error?.message || 'No fue posible eliminar el usuario.';
      this.mostrarMensajeUsuario(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  prepararEdicionUsuario(email) {
    if (!this.puedeGestionarUsuarios()) return;

    const correo = (email || '').toString().trim().toLowerCase();
    if (!correo) {
      mostrarToast('No se pudo determinar el usuario a editar.', 'warning');
      return;
    }

    const usuario = this.state?.usuariosIndex?.[correo];
    if (!usuario) {
      mostrarToast('No se encontró la información del usuario seleccionado.', 'warning');
      return;
    }

    this.usuarioEditando = usuario;

    const usuariosDom = this.dom.usuarios;
    if (usuariosDom?.inputs?.email) {
      usuariosDom.inputs.email.value = correo;
      usuariosDom.inputs.email.readOnly = true;
      usuariosDom.inputs.email.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
    }

    if (usuariosDom?.inputs?.password) {
      usuariosDom.inputs.password.value = '';
      usuariosDom.inputs.password.placeholder = 'Deja en blanco para mantener la contraseña actual';
    }

    if (usuariosDom?.inputs?.role) {
      const rol = normalizarRol(usuario.role || usuario.rol || 'contribuidor');
      usuariosDom.inputs.role.value = rol;
    }

    if (usuariosDom?.inputs?.area) {
      const areaValor = (usuario.area || '').toString().trim();
      if (areaValor && !this.areaOptionsCache.has(areaValor)) {
        this.actualizarOpcionesArea([areaValor]);
      }
      usuariosDom.inputs.area.value = areaValor;
    }

    if (usuariosDom?.formTitle) {
      usuariosDom.formTitle.textContent = `Editar usuario ${correo}`;
    }

    if (usuariosDom?.submitButton) {
      usuariosDom.submitButton.innerHTML = `
        <span class="material-icons text-base">save</span>
        Guardar cambios
      `;
    }

    this.mostrarMensajeUsuario('Modifica los campos necesarios y guarda los cambios. Usa "Limpiar" para cancelar la edición.', 'info');
    usuariosDom?.inputs?.role?.focus?.();
  }
};
