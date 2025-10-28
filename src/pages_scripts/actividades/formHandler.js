/**
 * form-handler.js - Gestión de formularios para el módulo de actividades
 */

import { serializarFormulario, mostrarToast, convertirValoresFormulario } from './utils.js';

/**
 * Clase para manejar formularios dinámicos
 */
class FormHandler {
  /**
   * Constructor
   * @param {string|HTMLElement} formContainer - ID o elemento contenedor del formulario
   * @param {Object} options - Opciones de configuración
   */
  constructor(formContainer, options = {}) {
    // Obtener el contenedor
    this.container = typeof formContainer === 'string' 
      ? document.getElementById(formContainer) 
      : formContainer;
    
    if (!this.container) {
      throw new Error('No se encontró el contenedor del formulario');
    }
    
    // Opciones por defecto
    this.options = {
      id: `form-${Math.floor(Math.random() * 10000)}`,
      fields: [],
      data: {},
      submitButton: true,
      cancelButton: true,
      submitButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      layout: 'horizontal', // horizontal o vertical
      columns: 1, // 1, 2 o 3 columnas en el formulario
      validators: {},
      onSubmit: null,
      onCancel: null,
      ...options
    };
    
    // Estado del formulario
    this.state = {
      isValid: true,
      errors: {},
      isSubmitting: false,
      formData: { ...this.options.data }
    };
    
    // Crear el formulario
    this.createForm();
  }
  
  /**
   * Crea el formulario HTML
   * @private
   */
  createForm() {
    // Limpiar el contenedor
    this.container.innerHTML = '';
    
    // Crear elemento form
    this.formElement = document.createElement('form');
    this.formElement.id = this.options.id;
    this.formElement.className = 'needs-validation';
    this.formElement.noValidate = true;
    
    // Establecer clases según layout
    if (this.options.layout === 'horizontal') {
      this.formElement.classList.add('row', 'g-3');
    }
    
    // Crear campos del formulario
    this.createFormFields();
    
    // Crear botones
    this.createFormButtons();
    
    // Agregar el formulario al contenedor
    this.container.appendChild(this.formElement);
    
    // Inicializar validadores
    this.initValidation();
    
    // Inicializar eventos
    this.initEvents();
  }
  
  /**
   * Crea los campos del formulario
   * @private
   */
  createFormFields() {
    // Crear contenedor de campos según columnas
    const fieldsContainer = document.createElement('div');
    if (this.options.columns > 1) {
      fieldsContainer.className = 'row';
    }
    
    this.formElement.appendChild(fieldsContainer);
    
    // Crear cada campo
    this.options.fields.forEach(field => {
      // Determinar el ancho de la columna
      const columnClass = this.options.columns > 1 
        ? `col-md-${12 / this.options.columns}` 
        : '';
      
      // Contenedor del campo
      const fieldContainer = document.createElement('div');
      fieldContainer.className = columnClass;
      
      // Si es un campo oculto, simplificamos
      if (field.type === 'hidden') {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = field.name;
        input.id = `${this.options.id}-${field.name}`;
        input.value = this.state.formData[field.name] || field.value || '';
        fieldContainer.appendChild(input);
        fieldsContainer.appendChild(fieldContainer);
        return;
      }
      
      // Para campos visibles, crear grupo de formulario
      const formGroup = document.createElement('div');
      formGroup.className = this.options.layout === 'horizontal' 
        ? 'row mb-3' 
        : 'mb-3';
      
      // Crear label si es necesario
      if (field.label) {
        const label = document.createElement('label');
        label.htmlFor = `${this.options.id}-${field.name}`;
        label.textContent = field.label;
        
        if (this.options.layout === 'horizontal') {
          label.className = 'col-sm-3 col-form-label';
        } else {
          label.className = 'form-label';
        }
        
        // Si es requerido, agregar indicador
        if (field.required) {
          const requiredSpan = document.createElement('span');
          requiredSpan.className = 'text-danger';
          requiredSpan.textContent = ' *';
          label.appendChild(requiredSpan);
        }
        
        formGroup.appendChild(label);
      }
      
      // Contenedor del input
      const inputContainer = document.createElement('div');
      if (this.options.layout === 'horizontal') {
        inputContainer.className = field.label ? 'col-sm-9' : 'col-sm-12';
      }
      
      // Crear campo según el tipo
      let input;
      
      switch (field.type) {
        case 'select':
          input = this.createSelectField(field);
          break;
          
        case 'textarea':
          input = this.createTextareaField(field);
          break;
          
        case 'checkbox':
          input = this.createCheckboxField(field);
          break;
          
        case 'radio':
          input = this.createRadioField(field);
          break;
          
        case 'date':
        case 'datetime-local':
        case 'time':
          input = this.createDateField(field);
          break;
          
        default:
          input = this.createInputField(field);
      }
      
      // Agregar mensaje de error
      const invalidFeedback = document.createElement('div');
      invalidFeedback.className = 'invalid-feedback';
      invalidFeedback.id = `${this.options.id}-${field.name}-feedback`;
      invalidFeedback.textContent = field.errorMessage || 'Este campo es requerido';
      
      // Agregar ayuda si existe
      if (field.helpText) {
        const helpText = document.createElement('div');
        helpText.className = 'form-text text-muted';
        helpText.textContent = field.helpText;
        inputContainer.appendChild(helpText);
      }
      
      inputContainer.appendChild(input);
      inputContainer.appendChild(invalidFeedback);
      formGroup.appendChild(inputContainer);
      fieldContainer.appendChild(formGroup);
      fieldsContainer.appendChild(fieldContainer);
    });
  }
  
  /**
   * Crea un campo de tipo input
   * @private
   * @param {Object} field - Configuración del campo
   * @returns {HTMLElement} Elemento input
   */
  createInputField(field) {
    const input = document.createElement('input');
    input.type = field.type || 'text';
    input.className = 'form-control';
    input.id = `${this.options.id}-${field.name}`;
    input.name = field.name;
    
    // Asignar valor si existe
    const value = this.state.formData[field.name] !== undefined 
      ? this.state.formData[field.name] 
      : (field.value || '');
    
    input.value = value;
    
    // Propiedades adicionales
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.required) input.required = true;
    if (field.readonly) input.readOnly = true;
    if (field.disabled) input.disabled = true;
    if (field.autocomplete === false) input.autocomplete = 'off';
    
    // Para campos numéricos
    if (field.type === 'number') {
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step !== undefined) input.step = field.step;
    }
    
    return input;
  }
  
  /**
   * Crea un campo de tipo select
   * @private
   * @param {Object} field - Configuración del campo
   * @returns {HTMLElement} Elemento select
   */
  createSelectField(field) {
    const select = document.createElement('select');
    select.className = 'form-select';
    select.id = `${this.options.id}-${field.name}`;
    select.name = field.name;
    
    // Propiedades adicionales
    if (field.required) select.required = true;
    if (field.disabled) select.disabled = true;
    if (field.multiple) select.multiple = true;
    
    // Opción vacía al inicio
    if (!field.noEmptyOption && !field.multiple) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = field.placeholder || 'Seleccione...';
      select.appendChild(emptyOption);
    }
    
    // Agregar opciones
    if (Array.isArray(field.options)) {
      field.options.forEach(option => {
        const optionEl = document.createElement('option');
        
        // Si la opción es un objeto o un string
        if (typeof option === 'object') {
          optionEl.value = option.value || option.id || '';
          optionEl.textContent = option.label || option.nombre || option.text || '';
        } else {
          optionEl.value = option;
          optionEl.textContent = option;
        }
        
        select.appendChild(optionEl);
      });
    }
    
    // Asignar valor si existe
    const value = this.state.formData[field.name] !== undefined 
      ? this.state.formData[field.name] 
      : (field.value || '');
    
    select.value = value;
    
    // Si se permite personalización (con datalist)
    if (field.allowCustom) {
      // Reemplazar select con input y datalist
      const container = document.createElement('div');
      
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control';
      input.id = `${this.options.id}-${field.name}`;
      input.name = field.name;
      input.value = value;
      input.setAttribute('list', `${this.options.id}-${field.name}-list`);
      
      // Propiedades adicionales
      if (field.required) input.required = true;
      if (field.readonly) input.readOnly = true;
      if (field.disabled) input.disabled = true;
      if (field.placeholder) input.placeholder = field.placeholder || 'Seleccione o escriba...';
      
      // Crear datalist
      const datalist = document.createElement('datalist');
      datalist.id = `${this.options.id}-${field.name}-list`;
      
      // Copiar opciones al datalist
      if (Array.isArray(field.options)) {
        field.options.forEach(option => {
          const optionEl = document.createElement('option');
          
          if (typeof option === 'object') {
            optionEl.value = option.label || option.nombre || option.text || '';
          } else {
            optionEl.value = option;
          }
          
          datalist.appendChild(optionEl);
        });
      }
      
      container.appendChild(input);
      container.appendChild(datalist);
      
      return container;
    }
    
    return select;
  }
  
  /**
   * Crea un campo de tipo textarea
   * @private
   * @param {Object} field - Configuración del campo
   * @returns {HTMLElement} Elemento textarea
   */
  createTextareaField(field) {
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.id = `${this.options.id}-${field.name}`;
    textarea.name = field.name;
    
    // Asignar valor si existe
    const value = this.state.formData[field.name] !== undefined 
      ? this.state.formData[field.name] 
      : (field.value || '');
    
    textarea.value = value;
    
    // Propiedades adicionales
    if (field.placeholder) textarea.placeholder = field.placeholder;
    if (field.required) textarea.required = true;
    if (field.readonly) textarea.readOnly = true;
    if (field.disabled) textarea.disabled = true;
    if (field.rows) textarea.rows = field.rows;
    
    return textarea;
  }
  
  /**
   * Crea un campo de tipo checkbox
   * @private
   * @param {Object} field - Configuración del campo
   * @returns {HTMLElement} Contenedor con el checkbox
   */
  createCheckboxField(field) {
    const container = document.createElement('div');
    container.className = 'form-check';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'form-check-input';
    input.id = `${this.options.id}-${field.name}`;
    input.name = field.name;
    
    // Verificar si debe estar marcado
    const checked = this.state.formData[field.name] !== undefined 
      ? Boolean(this.state.formData[field.name]) 
      : Boolean(field.value);
    
    input.checked = checked;
    
    // Propiedades adicionales
    if (field.required) input.required = true;
    if (field.disabled) input.disabled = true;
    
    // Label del checkbox
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = input.id;
    label.textContent = field.checkboxLabel || field.label || field.name;
    
    container.appendChild(input);
    container.appendChild(label);
    
    return container;
  }
  
  /**
   * Crea un campo de tipo radio
   * @private
   * @param {Object} field - Configuración del campo
   * @returns {HTMLElement} Contenedor con los radios
   */
  createRadioField(field) {
    const container = document.createElement('div');
    
    // Asegurar que haya opciones
    if (!Array.isArray(field.options) || field.options.length === 0) {
      return container;
    }
    
    // Obtener el valor actual
    const currentValue = this.state.formData[field.name] !== undefined 
      ? this.state.formData[field.name] 
      : (field.value || '');
    
    // Crear los radios
    field.options.forEach((option, index) => {
      const radioContainer = document.createElement('div');
      radioContainer.className = 'form-check';
      
      // Si es horizontal
      if (field.inline) {
        radioContainer.classList.add('form-check-inline');
      }
      
      const input = document.createElement('input');
      input.type = 'radio';
      input.className = 'form-check-input';
      input.id = `${this.options.id}-${field.name}-${index}`;
      input.name = field.name;
      
      // Si la opción es un objeto o un string
      if (typeof option === 'object') {
        input.value = option.value || option.id || '';
        input.checked = String(currentValue) === String(input.value);
        
        // Label del radio
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = input.id;
        label.textContent = option.label || option.nombre || option.text || '';
        
        radioContainer.appendChild(input);
        radioContainer.appendChild(label);
      } else {
        input.value = option;
        input.checked = String(currentValue) === String(option);
        
        // Label del radio
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = input.id;
        label.textContent = option;
        
        radioContainer.appendChild(input);
        radioContainer.appendChild(label);
      }
      
      // Propiedades adicionales
      if (field.required) input.required = true;
      if (field.disabled) input.disabled = true;
      
      container.appendChild(radioContainer);
    });
    
    return container;
  }
  
  /**
   * Crea un campo de tipo date
   * @private
   * @param {Object} field - Configuración del campo
   * @returns {HTMLElement} Elemento input date
   */
  createDateField(field) {
    const input = document.createElement('input');
    input.type = field.type; // date, datetime-local, time
    input.className = 'form-control';
    input.id = `${this.options.id}-${field.name}`;
    input.name = field.name;
    
    // Asignar valor si existe
    let value = this.state.formData[field.name] !== undefined 
      ? this.state.formData[field.name] 
      : (field.value || '');
    
    // Convertir valor de fecha si es necesario
    if (value && !(value instanceof Date) && !value.includes('T')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          if (field.type === 'date') {
            value = date.toISOString().split('T')[0];
          } else if (field.type === 'datetime-local') {
            value = date.toISOString().slice(0, 16);
          } else if (field.type === 'time') {
            value = date.toTimeString().slice(0, 5);
          }
        }
      } catch (error) {
        console.error(`[ERROR] Error formateando fecha para ${field.name}:`, error);
      }
    }
    
    input.value = value;
    
    // Propiedades adicionales
    if (field.min) input.min = field.min;
    if (field.max) input.max = field.max;
    if (field.required) input.required = true;
    if (field.readonly) input.readOnly = true;
    if (field.disabled) input.disabled = true;
    
    return input;
  }
  
  /**
   * Crea los botones del formulario
   * @private
   */
  createFormButtons() {
    // Si no hay botones, salir
    if (!this.options.submitButton && !this.options.cancelButton) {
      return;
    }
    
    // Contenedor de botones
    const buttonContainer = document.createElement('div');
    buttonContainer.className = this.options.layout === 'horizontal'
      ? 'row mt-3'
      : 'mt-3';
    
    // Div para alinear botones
    const buttonDiv = document.createElement('div');
    buttonDiv.className = this.options.layout === 'horizontal'
      ? 'col-sm-9 offset-sm-3 d-flex gap-2'
      : 'd-flex gap-2';
    
    // Botón submit
    if (this.options.submitButton) {
      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.className = 'btn btn-primary';
      submitButton.textContent = this.options.submitButtonText;
      submitButton.id = `${this.options.id}-submit`;
      buttonDiv.appendChild(submitButton);
    }
    
    // Botón cancelar
    if (this.options.cancelButton) {
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'btn btn-secondary';
      cancelButton.textContent = this.options.cancelButtonText;
      cancelButton.id = `${this.options.id}-cancel`;
      buttonDiv.appendChild(cancelButton);
    }
    
    buttonContainer.appendChild(buttonDiv);
    this.formElement.appendChild(buttonContainer);
  }
  
  /**
   * Inicializa la validación del formulario
   * @private
   */
  initValidation() {
    // Crear validadores personalizados
    // ... (lógica de validación)
  }
  
  /**
   * Inicializa los eventos del formulario
   * @private
   */
  initEvents() {
    // Evento submit
    this.formElement.addEventListener('submit', this.handleSubmit.bind(this));
    
    // Evento cancelar
    const cancelButton = document.getElementById(`${this.options.id}-cancel`);
    if (cancelButton) {
      cancelButton.addEventListener('click', this.handleCancel.bind(this));
    }
    
    // Eventos de cambio para cada campo
    this.options.fields.forEach(field => {
      const input = document.getElementById(`${this.options.id}-${field.name}`);
      if (input) {
        input.addEventListener('change', (e) => this.handleFieldChange(field.name, e.target));
      }
    });
  }
  
  /**
   * Maneja el cambio en un campo
   * @private
   * @param {string} fieldName - Nombre del campo
   * @param {HTMLElement} element - Elemento del campo
   */
  handleFieldChange(fieldName, element) {
    let value;
    
    // Obtener el valor según el tipo de campo
    if (element.type === 'checkbox') {
      value = element.checked;
    } else if (element.type === 'radio') {
      // Obtener el radio seleccionado
      const checkedRadio = this.formElement.querySelector(`input[name="${fieldName}"]:checked`);
      value = checkedRadio ? checkedRadio.value : null;
    } else {
      value = element.value;
    }
    
    // Actualizar el estado
    this.state.formData[fieldName] = value;
    
    // Si hay dependencias, actualizar campos relacionados
    this.updateDependentFields(fieldName, value);
  }
  
  /**
   * Actualiza campos dependientes
   * @private
   * @param {string} fieldName - Nombre del campo que cambió
   * @param {*} value - Nuevo valor
   */
  updateDependentFields(fieldName, value) {
    // Buscar campos que dependen de este
    this.options.fields.forEach(field => {
      // Si el campo tiene una dependencia
      if (field.dependsOn && field.dependsOn.field === fieldName) {
        const dependentField = document.getElementById(`${this.options.id}-${field.name}`);
        if (!dependentField) return;
        
        const shouldShow = this.evaluateDependency(field.dependsOn, value);
        
        // Mostrar u ocultar el grupo del campo
        const fieldGroup = dependentField.closest('.mb-3');
        if (fieldGroup) {
          fieldGroup.style.display = shouldShow ? '' : 'none';
        }
        
        // Activar o desactivar la validación
        dependentField.disabled = !shouldShow;
      }
    });
  }
  
  /**
   * Evalúa una dependencia
   * @private
   * @param {Object} dependency - Configuración de la dependencia
   * @param {*} value - Valor actual
   * @returns {boolean} Si se cumple la condición
   */
  evaluateDependency(dependency, value) {
    const { condition, value: targetValue } = dependency;
    
    switch (condition) {
      case 'equals':
        return value == targetValue;
      case 'notEquals':
        return value != targetValue;
      case 'contains':
        return String(value).includes(String(targetValue));
      case 'notEmpty':
        return value !== null && value !== undefined && value !== '';
      case 'isEmpty':
        return value === null || value === undefined || value === '';
      default:
        return true;
    }
  }
  
  /**
   * Maneja el envío del formulario
   * @private
   * @param {Event} event - Evento submit
   */
  handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Marcar formulario como enviado (para CSS)
    this.formElement.classList.add('was-validated');
    
    // Validar el formulario
    const isValid = this.validateForm();
    
    if (!isValid) {
      return;
    }
    
    // Marcar como enviando
    this.state.isSubmitting = true;
    
    // Desactivar botón submit
    const submitButton = document.getElementById(`${this.options.id}-submit`);
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
    }
    
    // Obtener datos del formulario
    const formData = serializarFormulario(this.formElement);
    
    // Convertir valores si es necesario
    const processedData = convertirValoresFormulario(formData);
    
    // Llamar al callback si existe
    if (this.options.onSubmit) {
      Promise.resolve(this.options.onSubmit(processedData))
        .catch(error => {
          console.error('[ERROR] Error en onSubmit:', error);
          mostrarToast('Error al procesar el formulario', 'error');
        })
        .finally(() => {
          // Restaurar estado
          this.state.isSubmitting = false;
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = this.options.submitButtonText;
          }
        });
    } else {
      // Si no hay callback, simplemente restaurar estado
      this.state.isSubmitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = this.options.submitButtonText;
      }
    }
  }
  
  /**
   * Maneja la cancelación del formulario
   * @private
   */
  handleCancel() {
    // Resetear formulario
    this.formElement.classList.remove('was-validated');
    this.formElement.reset();
    
    // Resetear estado
    this.state.errors = {};
    
    // Llamar al callback si existe
    if (this.options.onCancel) {
      this.options.onCancel();
    }
  }
  
  /**
   * Valida el formulario completo
   * @private
   * @returns {boolean} Si el formulario es válido
   */
  validateForm() {
    // Validación nativa del navegador
    const isNativeValid = this.formElement.checkValidity();
    
    // Validación personalizada
    const customValidation = this.validateCustomRules();
    
    return isNativeValid && customValidation;
  }
  
  /**
   * Valida reglas personalizadas
   * @private
   * @returns {boolean} Si pasa la validación
   */
  validateCustomRules() {
    // Implementar validación personalizada si es necesario
    return true;
  }
  
  /**
   * Establece los valores de los campos
   * @param {Object} data - Datos a establecer
   */
  setValues(data) {
    // Actualizar estado
    this.state.formData = { ...data };
    
    // Actualizar campos
    this.options.fields.forEach(field => {
      const input = document.getElementById(`${this.options.id}-${field.name}`);
      if (!input) return;
      
      const value = data[field.name] !== undefined ? data[field.name] : '';
      
      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else if (input.type === 'radio') {
        const radio = this.formElement.querySelector(`input[name="${field.name}"][value="${value}"]`);
        if (radio) {
          radio.checked = true;
        }
      } else {
        input.value = value;
      }
      
      // Actualizar dependencias
      this.updateDependentFields(field.name, value);
    });
    
    // Resetear validación
    this.formElement.classList.remove('was-validated');
  }
  
  /**
   * Obtiene los valores actuales del formulario
   * @returns {Object} Datos del formulario
   */
  getValues() {
    return serializarFormulario(this.formElement);
  }
  
  /**
   * Resetea el formulario
   */
  reset() {
    this.formElement.reset();
    this.formElement.classList.remove('was-validated');
    this.state.errors = {};
    this.state.formData = {};
  }
}

export default FormHandler;