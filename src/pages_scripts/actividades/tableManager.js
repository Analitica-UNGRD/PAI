/**
 * tableManager.js - Gestión de tablas para el módulo de actividades
 */

import { formatearFecha } from './utils.js';

/**
 * Gestiona la creación y manipulación de tablas Bootstrap
 */
class TableManager {
  /**
   * Constructor de la clase
   * @param {string} containerId - ID del contenedor de la tabla
   * @param {Object} options - Opciones de configuración
   */
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      throw new Error(`No se encontró el contenedor con ID: ${containerId}`);
    }
    
    // Opciones por defecto
    this.options = {
      columns: [],
      data: [],
      pagination: true,
      pageSize: 10,
      currentPage: 1,
      sortable: true,
      sortField: null,
      sortOrder: 'asc',
      search: true,
      showColumnHeaders: true,
      tableClass: 'table table-striped table-hover',
      ...options
    };
    
    // Estado de la tabla
    this.state = {
      filteredData: [],
      searchTerm: '',
      currentPage: 1,
      sortField: this.options.sortField,
      sortOrder: this.options.sortOrder
    };
    
    // Inicializar tabla
    this.init();
  }
  
  /**
   * Inicializa la tabla
   * @private
   */
  init() {
    // Crear estructura de la tabla
    this.createTableStructure();
    
    // Establecer datos iniciales
    this.setData(this.options.data);
    
    // Inicializar eventos
    this.initEvents();
  }
  
  /**
   * Crea la estructura HTML de la tabla
   * @private
   */
  createTableStructure() {
    // Limpiar el contenedor
    this.container.innerHTML = '';
    
    // Contenedor de búsqueda si está habilitada
    if (this.options.search) {
      const searchContainer = document.createElement('div');
      searchContainer.className = 'mb-3';
      searchContainer.innerHTML = `
        <div class="input-group">
          <input type="text" class="form-control form-control-sm" 
                placeholder="Buscar..." id="${this.containerId}-search">
          <button class="btn btn-outline-secondary btn-sm" type="button" id="${this.containerId}-search-clear">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      this.container.appendChild(searchContainer);
    }
    
    // Crear tabla
    this.table = document.createElement('table');
    this.table.id = `${this.containerId}-table`;
    this.table.className = this.options.tableClass;
    
    // Crear encabezado
    if (this.options.showColumnHeaders) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      this.options.columns.forEach(column => {
        const th = document.createElement('th');
        
        // Si es ordenable
        if (this.options.sortable && column.sortable !== false) {
          th.className = 'sortable';
          th.innerHTML = `${column.title} <span class="sort-icon"></span>`;
          th.addEventListener('click', () => this.handleSort(column.field));
        } else {
          th.textContent = column.title;
        }
        
        // Si tiene un ancho específico
        if (column.width) {
          th.style.width = column.width;
        }
        
        // Si debe ocultarse
        if (column.visible === false) {
          th.style.display = 'none';
        }
        
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      this.table.appendChild(thead);
    }
    
    // Crear cuerpo de la tabla
    this.tbody = document.createElement('tbody');
    this.table.appendChild(this.tbody);
    
    // Agregar tabla al contenedor
    this.container.appendChild(this.table);
    
    // Crear paginación si está habilitada
    if (this.options.pagination) {
      const paginationContainer = document.createElement('div');
      paginationContainer.className = 'pagination-container mt-3 d-flex justify-content-between align-items-center';
      paginationContainer.innerHTML = `
        <div class="d-flex align-items-center">
          <span class="me-2">Mostrar</span>
          <select class="form-select form-select-sm" id="${this.containerId}-page-size" style="width: auto;">
            <option value="5">5</option>
            <option value="10" selected>10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span class="ms-2">registros</span>
        </div>
        <div class="pagination-info"></div>
        <nav>
          <ul class="pagination pagination-sm mb-0" id="${this.containerId}-pagination"></ul>
        </nav>
      `;
      
      this.container.appendChild(paginationContainer);
      
      // Establecer el tamaño de página seleccionado
      const pageSizeSelect = document.getElementById(`${this.containerId}-page-size`);
      if (pageSizeSelect) {
        pageSizeSelect.value = this.options.pageSize;
      }
    }
  }
  
  /**
   * Inicializa los eventos de la tabla
   * @private
   */
  initEvents() {
    // Evento de búsqueda
    if (this.options.search) {
      const searchInput = document.getElementById(`${this.containerId}-search`);
      const clearButton = document.getElementById(`${this.containerId}-search-clear`);
      
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.state.searchTerm = e.target.value;
          this.state.currentPage = 1; // Volver a la primera página al buscar
          this.renderTable();
        });
      }
      
      if (clearButton) {
        clearButton.addEventListener('click', () => {
          const searchInput = document.getElementById(`${this.containerId}-search`);
          if (searchInput) {
            searchInput.value = '';
            this.state.searchTerm = '';
            this.renderTable();
          }
        });
      }
    }
    
    // Evento de cambio de tamaño de página
    if (this.options.pagination) {
      const pageSizeSelect = document.getElementById(`${this.containerId}-page-size`);
      if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
          this.options.pageSize = parseInt(e.target.value, 10);
          this.state.currentPage = 1; // Volver a la primera página
          this.renderTable();
        });
      }
    }
  }
  
  /**
   * Establece los datos de la tabla
   * @param {Array} data - Datos a mostrar en la tabla
   */
  setData(data) {
    this.options.data = Array.isArray(data) ? data : [];
    this.state.filteredData = [...this.options.data];
    this.state.currentPage = 1;
    this.renderTable();
  }
  
  /**
   * Obtiene los datos actuales de la tabla
   * @returns {Array} Datos actuales
   */
  getData() {
    return [...this.options.data];
  }
  
  /**
   * Actualiza una fila específica
   * @param {string|number} id - ID del registro a actualizar
   * @param {Object} newData - Nuevos datos
   * @returns {boolean} Si la actualización fue exitosa
   */
  updateRow(id, newData) {
    const idField = this._getIdField();
    const index = this.options.data.findIndex(item => item[idField] === id);
    
    if (index !== -1) {
      this.options.data[index] = { ...this.options.data[index], ...newData };
      this.renderTable();
      return true;
    }
    
    return false;
  }
  
  /**
   * Elimina una fila por su ID
   * @param {string|number} id - ID del registro a eliminar
   * @returns {boolean} Si la eliminación fue exitosa
   */
  deleteRow(id) {
    const idField = this._getIdField();
    const initialLength = this.options.data.length;
    
    this.options.data = this.options.data.filter(item => item[idField] !== id);
    
    if (this.options.data.length < initialLength) {
      this.renderTable();
      return true;
    }
    
    return false;
  }
  
  /**
   * Agrega una nueva fila
   * @param {Object} rowData - Datos de la fila a agregar
   */
  addRow(rowData) {
    this.options.data.unshift(rowData);
    this.renderTable();
  }
  
  /**
   * Obtiene el campo ID de la tabla
   * @private
   * @returns {string} Nombre del campo ID
   */
  _getIdField() {
    // Buscar una columna con field='id'
    const idColumn = this.options.columns.find(col => col.field === 'id');
    return idColumn ? idColumn.field : 'id';
  }
  
  /**
   * Maneja el evento de ordenamiento
   * @param {string} field - Campo por el cual ordenar
   */
  handleSort(field) {
    if (this.state.sortField === field) {
      // Cambiar dirección si ya estamos ordenando por este campo
      this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Nuevo campo de ordenamiento
      this.state.sortField = field;
      this.state.sortOrder = 'asc';
    }
    
    this.renderTable();
  }
  
  /**
   * Filtra los datos según el término de búsqueda
   * @private
   * @returns {Array} Datos filtrados
   */
  filterData() {
    const { searchTerm } = this.state;
    
    if (!searchTerm) {
      return [...this.options.data];
    }
    
    const termLower = searchTerm.toLowerCase();
    return this.options.data.filter(item => {
      // Buscar en todas las propiedades visibles
      return this.options.columns.some(column => {
        if (column.visible === false) return false;
        
        const value = item[column.field];
        if (value === null || value === undefined) return false;
        
        return String(value).toLowerCase().includes(termLower);
      });
    });
  }
  
  /**
   * Ordena los datos según el campo y dirección
   * @private
   * @param {Array} data - Datos a ordenar
   * @returns {Array} Datos ordenados
   */
  sortData(data) {
    const { sortField, sortOrder } = this.state;
    
    if (!sortField) {
      return data;
    }
    
    return [...data].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      // Manejar valores null o undefined
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      
      // Convertir a string para comparación
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      
      // Comparar según la dirección
      if (sortOrder === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
    });
  }
  
  /**
   * Obtiene los datos para la página actual
   * @private
   * @param {Array} data - Datos filtrados y ordenados
   * @returns {Array} Datos de la página actual
   */
  paginateData(data) {
    if (!this.options.pagination) {
      return data;
    }
    
    const start = (this.state.currentPage - 1) * this.options.pageSize;
    const end = start + this.options.pageSize;
    
    return data.slice(start, end);
  }
  
  /**
   * Renderiza la paginación
   * @private
   * @param {number} totalPages - Número total de páginas
   */
  renderPagination(totalPages) {
    if (!this.options.pagination) return;
    
    const paginationEl = document.getElementById(`${this.containerId}-pagination`);
    const paginationInfo = this.container.querySelector('.pagination-info');
    
    if (!paginationEl || !paginationInfo) return;
    
    // Limpiar paginación
    paginationEl.innerHTML = '';
    
    // No mostrar paginación si solo hay una página
    if (totalPages <= 1) {
      paginationInfo.textContent = `Mostrando ${this.state.filteredData.length} registros`;
      return;
    }
    
    // Información de paginación
    const start = (this.state.currentPage - 1) * this.options.pageSize + 1;
    const end = Math.min(start + this.options.pageSize - 1, this.state.filteredData.length);
    paginationInfo.textContent = `Mostrando ${start} a ${end} de ${this.state.filteredData.length} registros`;
    
    // Botón anterior
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${this.state.currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = '<a class="page-link" href="#">&laquo;</a>';
    prevLi.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.state.currentPage > 1) {
        this.state.currentPage--;
        this.renderTable();
      }
    });
    paginationEl.appendChild(prevLi);
    
    // Botones de página
    let startPage = Math.max(1, this.state.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const pageLi = document.createElement('li');
      pageLi.className = `page-item ${i === this.state.currentPage ? 'active' : ''}`;
      pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      pageLi.addEventListener('click', (e) => {
        e.preventDefault();
        this.state.currentPage = i;
        this.renderTable();
      });
      paginationEl.appendChild(pageLi);
    }
    
    // Botón siguiente
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${this.state.currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = '<a class="page-link" href="#">&raquo;</a>';
    nextLi.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.state.currentPage < totalPages) {
        this.state.currentPage++;
        this.renderTable();
      }
    });
    paginationEl.appendChild(nextLi);
  }
  
  /**
   * Renderiza la tabla con los datos actuales
   */
  renderTable() {
    // Filtrar datos
    this.state.filteredData = this.filterData();
    
    // Ordenar datos
    const sortedData = this.sortData(this.state.filteredData);
    
    // Paginar datos
    const paginatedData = this.paginateData(sortedData);
    
    // Limpiar tbody
    this.tbody.innerHTML = '';
    
    // Mostrar mensaje si no hay datos
    if (paginatedData.length === 0) {
      const noDataRow = document.createElement('tr');
      const noDataCell = document.createElement('td');
      noDataCell.colSpan = this.options.columns.length;
      noDataCell.className = 'text-center';
      noDataCell.textContent = this.state.searchTerm ? 'No se encontraron resultados' : 'No hay datos disponibles';
      noDataRow.appendChild(noDataCell);
      this.tbody.appendChild(noDataRow);
    } else {
      // Renderizar filas
      paginatedData.forEach(rowData => {
        const row = document.createElement('tr');
        
        // Agregar ID de fila si existe
        const idField = this._getIdField();
        if (rowData[idField]) {
          row.dataset.id = rowData[idField];
        }
        
        // Crear celdas
        this.options.columns.forEach(column => {
          const cell = document.createElement('td');
          
          // Si debe ocultarse
          if (column.visible === false) {
            cell.style.display = 'none';
          }
          
          // Aplicar formateador si existe
          if (typeof column.formatter === 'function') {
            cell.innerHTML = column.formatter(rowData[column.field], rowData);
          } else {
            // Formateo especial para fechas
            if (column.field.includes('fecha') && rowData[column.field]) {
              cell.textContent = formatearFecha(rowData[column.field]);
            } else {
              cell.textContent = rowData[column.field] !== undefined && rowData[column.field] !== null ? 
                                rowData[column.field] : '';
            }
          }
          
          row.appendChild(cell);
        });
        
        this.tbody.appendChild(row);
      });
    }
    
    // Actualizar iconos de ordenamiento
    if (this.options.sortable) {
      const headers = this.table.querySelectorAll('th.sortable');
      headers.forEach((header, index) => {
        const field = this.options.columns[index].field;
        header.classList.remove('sort-asc', 'sort-desc');
        
        if (field === this.state.sortField) {
          header.classList.add(this.state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc');
        }
      });
    }
    
    // Actualizar paginación
    if (this.options.pagination) {
      const totalPages = Math.ceil(this.state.filteredData.length / this.options.pageSize) || 1;
      this.renderPagination(totalPages);
    }
    
    // Evento después de renderizar la tabla
    if (this.options.onRender) {
      this.options.onRender(paginatedData);
    }
  }
  
  /**
   * Establece un manejador de eventos para las filas
   * @param {string} eventType - Tipo de evento
   * @param {Function} handler - Función manejadora
   */
  onRowEvent(eventType, handler) {
    // Agregar event listener delegado
    this.tbody.addEventListener(eventType, (event) => {
      const row = event.target.closest('tr');
      if (!row) return;
      
      const idField = this._getIdField();
      const id = row.dataset.id;
      
      if (!id) return;
      
      // Buscar el registro
      const record = this.options.data.find(item => String(item[idField]) === String(id));
      
      if (!record) return;
      
      // Llamar al handler con información
      handler(event, {
        id,
        row,
        record
      });
    });
  }
  
  /**
   * Establece un manejador para eventos de botones dentro de las filas
   * @param {string} selector - Selector CSS del botón
   * @param {Function} handler - Función manejadora
   */
  onButtonClick(selector, handler) {
    this.tbody.addEventListener('click', (event) => {
      const button = event.target.closest(selector);
      if (!button) return;
      
      const row = button.closest('tr');
      if (!row) return;
      
      const idField = this._getIdField();
      const id = row.dataset.id;
      
      if (!id) return;
      
      // Buscar el registro
      const record = this.options.data.find(item => String(item[idField]) === String(id));
  
      if (!record) return;
      
      // Llamar al handler con información
      handler(event, {
        id,
        button,
        row,
        record
      });
    });
  }
}

export default TableManager;