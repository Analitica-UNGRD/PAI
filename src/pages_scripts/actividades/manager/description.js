import { DESCRIPCION_OPCIONES, SUGERENCIAS_TILDES, MENSAJE_GENERADOR_DEFAULT } from './constants.js';

function inicializarGeneradorDescripcion(form) {
  if (this.descripcionElements?.verbo) {
    this.poblarSelectsDescripcion();
    return;
  }

  const resultadoHidden = document.getElementById('descripcion_actividad');
  const resultadoEditor = document.getElementById('descripcion_actividad_editor') || resultadoHidden;

  const elementos = {
    verbo: document.getElementById('descripcion_verbo'),
    objeto: document.getElementById('descripcion_objeto'),
    finalidad: document.getElementById('descripcion_finalidad'),
    beneficiarios: document.getElementById('descripcion_beneficiarios'),
    temporalidad: document.getElementById('descripcion_temporalidad'),
    resultado: resultadoEditor,
    resultadoHidden
  };

  this.descripcionElements = elementos;

  ['verbo', 'objeto', 'finalidad', 'beneficiarios'].forEach((key) => {
    const elemento = elementos[key];
    if (!elemento) return;
    if (!elemento.name) {
      elemento.name = `descripcion_${key}`;
    }
    elemento.required = true;
  });

  if (elementos.temporalidad && !elementos.temporalidad.name) {
    elementos.temporalidad.name = 'descripcion_temporalidad';
  }

  this.poblarSelectsDescripcion();

  if (elementos.resultado && elementos.resultado.parentElement) {
    const feedback = document.createElement('div');
    feedback.id = 'descripcion-feedback';
    feedback.className = 'mt-2 text-xs text-[var(--text-secondary)]';
    elementos.resultado.parentElement.appendChild(feedback);
    this.descripcionFeedbackElement = feedback;
    this.actualizarFeedbackDescripcion('info', [MENSAJE_GENERADOR_DEFAULT]);
  }

  const manejarCambio = () => this.generarDescripcionEstandar({ desdeEvento: true });
  ['verbo', 'objeto', 'finalidad', 'beneficiarios', 'temporalidad'].forEach((key) => {
    const elemento = elementos[key];
    if (!elemento) return;
    elemento.addEventListener('change', manejarCambio);
  });

  if (elementos.resultado) {
    elementos.resultado.addEventListener('input', () => {
      if (this.descripcionEstado.actualizacionProgramatica) return;
      this.descripcionEstado.edicionManual = true;
      elementos.resultado.classList.remove('border-green-500', 'border-red-500');
      this.actualizarFeedbackDescripcion('info', ['Has modificado la descripción manualmente. Usa "Limpiar selección" si deseas regenerarla.']);
    });
  }

  const btnVerificar = document.getElementById('verificar-ortografia');
  if (btnVerificar) {
    btnVerificar.addEventListener('click', () => this.verificarOrtografiaDescripcion());
  }

  const btnLimpiar = document.getElementById('limpiar-descripcion');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      this.limpiarGeneradorDescripcion();
      this.focusDescripcionEditor();
    });
  }

  if (form && elementos.verbo && !form.contains(elementos.verbo)) {
    form.appendChild(elementos.verbo);
  }
}

function poblarSelectsDescripcion() {
  if (!this.descripcionElements) return;

  const definiciones = [
    { key: 'verbo', opciones: DESCRIPCION_OPCIONES.verbos },
    { key: 'objeto', opciones: DESCRIPCION_OPCIONES.objetos },
    { key: 'finalidad', opciones: DESCRIPCION_OPCIONES.finalidades },
    { key: 'beneficiarios', opciones: DESCRIPCION_OPCIONES.beneficiarios },
    { key: 'temporalidad', opciones: DESCRIPCION_OPCIONES.temporalidades }
  ];

  definiciones.forEach(({ key, opciones }) => {
    const select = this.descripcionElements[key];
    if (!select) return;

    const placeholder = select.querySelector('option[value=""]')?.textContent || select.dataset.placeholder || 'Seleccionar...';
    const valorActual = select.value;

    select.innerHTML = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);

    opciones.forEach((opcion) => {
      const optionEl = document.createElement('option');
      optionEl.value = opcion.value;
      optionEl.textContent = opcion.label;
      select.appendChild(optionEl);
    });

    if (valorActual && opciones.some(op => op.value === valorActual)) {
      select.value = valorActual;
    } else {
      select.value = '';
    }
  });
}

function generarDescripcionEstandar({ desdeEvento = false, force = false, skipFeedback = false } = {}) {
  if (!this.descripcionElements) return;

  if (this.descripcionEstado.edicionManual && desdeEvento && !force) {
    const continuar = window.confirm('La descripción fue editada manualmente. ¿Deseas reemplazarla con la versión generada automáticamente?');
    if (!continuar) {
      return;
    }
  }

  const { verbo, objeto, finalidad, beneficiarios, temporalidad, resultado } = this.descripcionElements;
  const valores = {
    verbo: verbo?.value?.trim() || '',
    objeto: objeto?.value?.trim() || '',
    finalidad: finalidad?.value?.trim() || '',
    beneficiarios: beneficiarios?.value?.trim() || '',
    temporalidad: temporalidad?.value?.trim() || ''
  };

  if (!valores.verbo && !valores.objeto && !valores.finalidad && !valores.beneficiarios && !valores.temporalidad) {
    if (!skipFeedback) {
      this.actualizarFeedbackDescripcion('info', [MENSAJE_GENERADOR_DEFAULT]);
    }
    if (resultado && !this.descripcionEstado.edicionManual) {
      this.setDescripcionTexto('');
    }
    this.descripcionEstado.ultimaGenerada = '';
    return;
  }

  let descripcion = '';
  if (valores.verbo) {
    descripcion += `${this.capitalizarFrase(valores.verbo)} `;
  }
  if (valores.objeto) {
    descripcion += valores.objeto;
  }
  if (valores.finalidad) {
    descripcion += descripcion ? ` ${valores.finalidad}` : this.capitalizarFrase(valores.finalidad);
  }
  if (valores.beneficiarios) {
    descripcion += descripcion ? ` ${valores.beneficiarios}` : this.capitalizarFrase(valores.beneficiarios);
  }
  if (valores.temporalidad) {
    descripcion += descripcion ? ` ${valores.temporalidad}` : this.capitalizarFrase(valores.temporalidad);
  }

  descripcion = descripcion.replace(/\s+/g, ' ').trim();
  if (descripcion && !/[.!?]$/.test(descripcion)) {
    descripcion += '.';
  }

  if (resultado) {
    this.setDescripcionTexto(descripcion);
  }

  this.descripcionEstado.edicionManual = false;
  this.descripcionEstado.ultimaGenerada = descripcion;

  if (!skipFeedback) {
    this.actualizarFeedbackDescripcion('info', ['Descripción generada automáticamente. Ajusta manualmente si lo requieres.']);
  }
}

function limpiarGeneradorDescripcion({ conservarTextarea = false } = {}) {
  if (!this.descripcionElements) return;

  const { verbo, objeto, finalidad, beneficiarios, temporalidad, resultado } = this.descripcionElements;
  [verbo, objeto, finalidad, beneficiarios, temporalidad].forEach(select => {
    if (select) select.value = '';
  });

  if (resultado && !conservarTextarea) {
    this.setDescripcionTexto('');
  }

  this.descripcionEstado.edicionManual = false;
  this.descripcionEstado.ultimaGenerada = '';
  this.actualizarFeedbackDescripcion('info', [MENSAJE_GENERADOR_DEFAULT]);
}

function getDescripcionEditor() {
  return this.descripcionElements?.resultado || null;
}

function getDescripcionHidden() {
  return this.descripcionElements?.resultadoHidden || null;
}

function getDescripcionTexto() {
  const hidden = this.getDescripcionHidden();
  if (hidden && typeof hidden.value === 'string') {
    return hidden.value;
  }

  const editor = this.getDescripcionEditor();
  if (!editor) return '';

  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return editor.value || '';
  }

  return (editor.innerText || editor.textContent || '');
}

function setDescripcionTexto(texto = '') {
  const editor = this.getDescripcionEditor();
  if (!editor) return;

  const checker = editor.__orthographyChecker;
  this.descripcionEstado.actualizacionProgramatica = true;

  if (checker) {
    checker.setText(texto || '');
  } else if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    editor.value = texto || '';
  } else {
    editor.textContent = texto || '';
  }

  this.descripcionEstado.actualizacionProgramatica = false;

  const hidden = this.getDescripcionHidden();
  if (hidden) {
    hidden.value = texto || '';
  }

  editor.classList.remove('border-green-500', 'border-red-500');
}

function focusDescripcionEditor() {
  const editor = this.getDescripcionEditor();
  if (editor && typeof editor.focus === 'function') {
    editor.focus();
    if (window.getSelection && editor.childNodes?.length) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }
}

function verificarOrtografiaDescripcion() {
  if (!this.descripcionElements?.resultado) return;
  const editor = this.descripcionElements.resultado;
  const texto = this.getDescripcionTexto().trim();

  const checker = editor.__orthographyChecker;
  if (checker) {
    checker.runSpellcheck({ force: true }).catch(() => {});
  } else {
    const btn = document.getElementById('verificar-ortografia');
    if (btn) btn.click();
  }

  if (!texto) {
    this.actualizarFeedbackDescripcion('warning', ['Ingresa o genera una descripción antes de ejecutar la verificación.']);
    editor.classList.remove('border-green-500');
    editor.classList.add('border-red-500');
    this.focusDescripcionEditor();
    return;
  }

  const hallazgos = [];

  if (texto.length < 40) {
    hallazgos.push('La descripción es muy breve. Amplía el detalle para mayor claridad.');
  }

  if (!/[.!?]$/.test(texto)) {
    hallazgos.push('Añade un punto final para cerrar la idea principal.');
  }

  if (/( {2,})/.test(texto)) {
    hallazgos.push('Se detectaron espacios duplicados. Reemplázalos por un solo espacio.');
  }

  const repetidas = texto.match(/\b(\w{3,})\b\s+\b\1\b/gi);
  if (repetidas) {
    const unicas = [...new Set(repetidas.map(palabra => palabra.trim()))];
    hallazgos.push(`Palabras repetidas detectadas: ${unicas.join(', ')}.`);
  }

  const posiblesTildes = [];
  Object.entries(SUGERENCIAS_TILDES).forEach(([incorrecta, correcta]) => {
    if (!correcta) return;
    const regex = new RegExp(`\\b${incorrecta}\\b`, 'gi');
    if (regex.test(texto)) {
      posiblesTildes.push(`${incorrecta} -> ${correcta}`);
    }
  });
  if (posiblesTildes.length) {
    hallazgos.push(`Revisa posibles tildes: ${posiblesTildes.join(', ')}.`);
  }

  if (hallazgos.length === 0) {
    if (this.descripcionFeedbackElement) {
      this.descripcionFeedbackElement.textContent = '';
      this.descripcionFeedbackElement.className = 'hidden';
    }
    editor.classList.remove('border-red-500', 'border-green-500');
  } else {
    this.actualizarFeedbackDescripcion('warning', hallazgos);
    editor.classList.remove('border-green-500');
    editor.classList.add('border-red-500');
  }
}

function actualizarFeedbackDescripcion(tipo, mensajes) {
  if (!this.descripcionFeedbackElement) return;
  const clases = {
    info: 'mt-2 text-xs text-[var(--text-secondary)]',
    success: 'mt-2 text-xs text-green-600',
    warning: 'mt-2 text-xs text-amber-600',
    error: 'mt-2 text-xs text-rose-600'
  };

  const lista = Array.isArray(mensajes) ? mensajes : [mensajes];
  this.descripcionFeedbackElement.className = clases[tipo] || clases.info;

  if (lista.length > 1) {
    this.descripcionFeedbackElement.innerHTML = `<ul class="list-disc pl-5 space-y-1">${lista.map(msg => `<li>${msg}</li>`).join('')}</ul>`;
  } else {
    this.descripcionFeedbackElement.textContent = lista[0];
  }
}

function establecerValoresGeneradorDescripcion(detalles = {}, descripcionBase = '') {
  if (!this.descripcionElements) return;

  const mapping = {
    descripcion_verbo: 'verbo',
    descripcion_objeto: 'objeto',
    descripcion_finalidad: 'finalidad',
    descripcion_beneficiarios: 'beneficiarios',
    descripcion_temporalidad: 'temporalidad'
  };

  let tieneComponentes = false;

  Object.entries(mapping).forEach(([campo, key]) => {
    const select = this.descripcionElements[key];
    if (!select) return;
    const valor = detalles[campo] || '';
    select.value = valor;
    if (valor) tieneComponentes = true;
  });

  if (tieneComponentes) {
    this.generarDescripcionEstandar({ desdeEvento: false, force: true, skipFeedback: true });
    this.actualizarFeedbackDescripcion('info', ['Descripción recuperada a partir de los componentes guardados.']);
  } else if (descripcionBase) {
    this.setDescripcionTexto(descripcionBase);
    this.descripcionEstado.edicionManual = true;
    this.actualizarFeedbackDescripcion('info', ['La descripción fue cargada desde el registro existente. Usa "Limpiar selección" si deseas regenerarla.']);
  } else {
    this.limpiarGeneradorDescripcion();
  }
}

export const descriptionMethods = {
  inicializarGeneradorDescripcion,
  poblarSelectsDescripcion,
  generarDescripcionEstandar,
  limpiarGeneradorDescripcion,
  getDescripcionEditor,
  getDescripcionHidden,
  getDescripcionTexto,
  setDescripcionTexto,
  focusDescripcionEditor,
  verificarOrtografiaDescripcion,
  actualizarFeedbackDescripcion,
  establecerValoresGeneradorDescripcion
};
