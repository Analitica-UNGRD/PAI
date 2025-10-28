export const utilsMethods = {
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      return ['true', 'TRUE', '1', 'activo', 'ACTIVO', 'yes', 'si', 'SI'].includes(value.trim());
    }
    return false;
  },

  obtenerActividadId(actividad) {
    if (!actividad || typeof actividad !== 'object') return '';

    const posibles = [
      actividad.id,
      actividad.actividad_id,
      actividad.actividadId,
      actividad.codigo,
      actividad.codigo_actividad,
      actividad.codigoActividad,
      actividad.numero,
      actividad.secuencial
    ]
      .filter(valor => valor !== undefined && valor !== null)
      .map(valor => valor.toString().trim())
      .filter(Boolean);

    if (posibles.length > 0) {
      return posibles[0];
    }

    if (actividad.descripcion_actividad) {
      return actividad.descripcion_actividad.toString().trim().slice(0, 50);
    }

    return '';
  },

  obtenerAvanceId(avance) {
    if (!avance || typeof avance !== 'object') return '';

    const posibles = [
      avance.id,
      avance.avance_id,
      avance.registro_id,
      avance.codigo,
      avance.codigo_avance,
      avance.codigoAvance
    ]
      .filter(valor => valor !== undefined && valor !== null)
      .map(valor => valor.toString().trim())
      .filter(Boolean);

    if (posibles.length > 0) {
      return posibles[0];
    }

    const actividad = avance.actividad_id || avance.actividad;
    const bimestre = avance.bimestre_id || avance.bimestre;
    if (actividad || bimestre) {
      return [actividad, bimestre]
        .filter(Boolean)
        .map(valor => valor.toString().trim())
        .join('-');
    }

    return '';
  },

  obtenerActividadCodigo(registro) {
    if (!registro || typeof registro !== 'object') return '';

    const candidatos = [
      registro.codigo,
      registro.codigo_actividad,
      registro.codigoActividad,
      registro.actividad_codigo,
      registro.actividadCodigo,
      registro.actividad_codigo_formateado,
      registro.actividad_codigo_pai,
      registro.actividad_codigoPai,
      registro.codigo_pai,
      registro.codigoPai
    ];

    if (registro.actividad && typeof registro.actividad === 'object') {
      candidatos.push(
        registro.actividad.codigo,
        registro.actividad.codigo_actividad,
        registro.actividad.codigoActividad,
        registro.actividad.actividad_codigo
      );
    }

    const valores = candidatos
      .filter(valor => valor !== undefined && valor !== null)
      .map(valor => valor.toString().trim())
      .filter(Boolean);

    if (valores.length > 0) {
      return valores[0];
    }

    if (typeof this.obtenerActividadId === 'function') {
      return this.obtenerActividadId(registro);
    }

    return '';
  },

  formatearFechaISO(valor) {
    if (!valor) return '';
    try {
      const date = valor instanceof Date ? valor : new Date(valor);
      if (Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      return '';
    }
  },

  renderEstadoRevisionBadge(estado) {
    const value = (estado || 'Sin revisión').toString();
    const normalized = value.toLowerCase();
    let classes = 'bg-gray-100 text-gray-600';

    if (normalized.includes('aprob')) {
      classes = 'bg-emerald-100 text-emerald-700';
    } else if (normalized.includes('corrección') || normalized.includes('edición')) {
      classes = 'bg-orange-100 text-orange-700';
    } else if (normalized.includes('rechaz')) {
      classes = 'bg-rose-100 text-rose-700';
    } else if (normalized.includes('revisión')) {
      classes = 'bg-amber-100 text-amber-700';
    }

    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}">${value}</span>`;
  },

  desplazarHacia(elemento) {
    if (!elemento) return;

    let target = null;
    if (elemento instanceof Element) {
      target = elemento;
    } else if (typeof elemento === 'string' && typeof document !== 'undefined') {
      target = document.querySelector(elemento);
    }

    if (!target) {
      target = elemento?.current || null;
    }

    try {
      if (target && typeof target.closest === 'function') {
        const detailsParent = target.closest('details');
        if (detailsParent && !detailsParent.open) {
          detailsParent.open = true;
        }
      }
    } catch (error) {
      // Ignorar errores al manipular detalles
    }

    try {
      if (target?.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    } catch (error) {
      // Ignorar errores del scrollIntoView
    }

    try {
      const rect = target?.getBoundingClientRect?.();
      if (rect) {
        const top = rect.top + window.scrollY - 80;
        window.scrollTo({ top: top >= 0 ? top : 0, behavior: 'smooth' });
      }
    } catch (error) {
      // Ignorar errores de scroll manual
    }
  },

  formatearFecha(valor, opciones = {}) {
    if (!valor) return '';
    try {
      const date = valor instanceof Date ? valor : new Date(valor);
      if (Number.isNaN(date.getTime())) return '';
      const { includeTime = true } = opciones;
      const formato = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      };

      if (includeTime) {
        formato.hour = '2-digit';
        formato.minute = '2-digit';
      }

      return date.toLocaleString('es-CO', formato);
    } catch (error) {
      return '';
    }
  }
};
