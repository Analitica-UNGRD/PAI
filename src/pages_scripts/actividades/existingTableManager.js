/**
 * existingTableManager.js - Gestión de tablas para tablas existentes en HTML
 * Esta versión está adaptada para trabajar con una estructura de tabla ya definida en el HTML
 */

import { formatearFecha } from './utils.js';

/**
 * Gestiona tablas HTML existentes
 */
class ExistingTableManager {
  /**
   * Constructor de la clase
   * @param {string} tbodyId - ID del tbody de la tabla
   * @param {Object} options - Opciones de configuración
   */
  constructor(tbodyId, options = {}) {
    this.tbodyId = tbodyId;
    this.tbody = document.getElementById(tbodyId);
    
    if (!this.tbody) {
      throw new Error(`No se encontró el tbody con ID: ${tbodyId}`);
    }
    
    // Buscar la tabla padre
    this.table = this.tbody.closest('table');
    if (!this.table) {
      throw new Error(`El tbody con ID: ${tbodyId} no está dentro de una tabla`);
    }
    
    // Buscar el contenedor de la tabla
    this.container = this.table.parentElement;
    if (!this.container) {
      this.container = this.table; // Usar la tabla como contenedor si no hay padre
    }
    
    // Opciones por defecto
    this.options = {
      columns: [],
      data: [],
      pagination: false,
      pageSize: 10,
      currentPage: 1,
      sortable: false,
      sortField: null,
      sortOrder: 'asc',
      search: false,
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
    console.log('[INFO] Inicializando ExistingTableManager para:', this.tbodyId);
    
    // Si hay paginación y búsqueda, crearlos
    this.initExtraElements();
    
    // Establecer datos iniciales
    this.setData(this.options.data);
    
    // Inicializar eventos
    this.initEvents();
    
    console.log('[INFO] ExistingTableManager inicializado');
  }
  
  /**
   * Inicializa elementos adicionales como búsqueda y paginación
   * @private
   */
  initExtraElements() {
    // Contenedor para elementos adicionales
    this.extraContainer = document.createElement('div');
    this.extraContainer.className = 'table-controls my-3 flex flex-wrap items-center justify-between gap-2';
    
    // Añadir antes de la tabla
    if (this.table.parentElement) {
      this.table.parentElement.insertBefore(this.extraContainer, this.table);
    }
    
    // Búsqueda si está habilitada
    if (this.options.search) {
      const searchDiv = document.createElement('div');
      searchDiv.className = 'search-container';
      searchDiv.innerHTML = `
        <div class="relative">
          <input type="text" id="${this.tbodyId}-search" 
            class="block w-full rounded-md border-gray-300 pl-10 pr-3 py-2 text-sm 
            focus:border-indigo-500 focus:ring-indigo-500 shadow-sm" 
            placeholder="Buscar...">
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span class="material-symbols-outlined text-gray-400">search</span>
          </div>
        </div>
      `;
      this.extraContainer.appendChild(searchDiv);
      
      // Referencia al campo de búsqueda
      this.searchInput = document.getElementById(`${this.tbodyId}-search`);
    }
    
    // Paginación si está habilitada
    if (this.options.pagination) {
      this.paginationContainer = document.createElement('div');
      this.paginationContainer.className = 'pagination-container';
      this.extraContainer.appendChild(this.paginationContainer);
    }
  }
  
  /**
   * Inicializa los eventos de la tabla
   * @private
   */
  initEvents() {
    // Evento de búsqueda
    if (this.options.search && this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.state.searchTerm = this.searchInput.value;
        this.state.currentPage = 1; // Resetear a la primera página
        this.renderRows();
      });
    }
    
    // Eventos de ordenación
    if (this.options.sortable) {
      const headerRow = this.table.querySelector('thead tr');
      if (headerRow) {
        const headers = headerRow.querySelectorAll('th');
        
        headers.forEach((header, index) => {
          if (index < this.options.columns.length) {
            const column = this.options.columns[index];
            
            if (column.sortable !== false) {
              header.style.cursor = 'pointer';
              header.classList.add('sortable-column');
              
              header.addEventListener('click', () => {
                // Actualizar estado de ordenación
                if (this.state.sortField === column.field) {
                  this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                  this.state.sortField = column.field;
                  this.state.sortOrder = 'asc';
                }
                
                // Actualizar indicadores visuales
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                header.classList.add(`sort-${this.state.sortOrder}`);
                
                // Renderizar tabla ordenada
                this.renderRows();
              });
            }
          }
        });
      }
    }
  }
  
  /**
   * Establece los datos de la tabla
   * @param {Array} data - Datos para poblar la tabla
   */
  setData(data) {
    this.options.data = Array.isArray(data) ? data : [];
    this.filterAndSort();
    this.renderRows();
  }
  
  /**
   * Filtra y ordena los datos según el estado actual
   * @private
   */
  filterAndSort() {
    let filteredData = [...this.options.data];
    
    // Aplicar filtro de búsqueda si hay término de búsqueda
    if (this.state.searchTerm) {
      const searchTerm = this.state.searchTerm.toLowerCase();
      
      filteredData = filteredData.filter(item => {
        // Buscar en todas las columnas
        return this.options.columns.some(column => {
          const value = this.getCellValue(item, column);
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchTerm);
        });
      });
    }
    
    // Aplicar ordenación si hay campo de ordenación
    if (this.state.sortField) {
      filteredData.sort((a, b) => {
        const column = this.options.columns.find(col => col.field === this.state.sortField);
        
        if (!column) return 0;
        
        let valueA = this.getCellValue(a, column);
        let valueB = this.getCellValue(b, column);
        
        // Si hay un comparador personalizado
        if (column.sortComparator) {
          return column.sortComparator(valueA, valueB) * (this.state.sortOrder === 'asc' ? 1 : -1);
        }
        
        // Comparación estándar
        if (valueA === valueB) return 0;
        if (valueA === null || valueA === undefined) return 1;
        if (valueB === null || valueB === undefined) return -1;
        
        const result = valueA < valueB ? -1 : 1;
        return this.state.sortOrder === 'asc' ? result : -result;
      });
    }
    
    this.state.filteredData = filteredData;
  }
  
  /**
   * Obtiene el valor de una celda según la configuración de la columna
   * @param {Object} item - Elemento de datos
   * @param {Object} column - Configuración de la columna
   * @returns {*} Valor de la celda
   * @private
   */
  getCellValue(item, column) {
    if (!item || !column) return null;
    
    // Si hay un getter personalizado
    if (column.valueGetter) {
      return column.valueGetter(item);
    }
    
    // Si el campo es un path con puntos (ej: "user.name")
    if (column.field && column.field.includes('.')) {
      return column.field.split('.').reduce((obj, key) => 
        obj && obj[key] !== undefined ? obj[key] : null
      , item);
    }
    
    // Caso normal
    return column.field ? item[column.field] : null;
  }
  
  /**
   * Renderiza las filas de la tabla según el estado actual
   * @private
   */
  renderRows() {
    // Filtrar y ordenar los datos
    this.filterAndSort();
    
    // Limpiar la tabla
    this.tbody.innerHTML = '';
    
    // Si no hay datos
    if (this.state.filteredData.length === 0) {
      const emptyRow = document.createElement('tr');
      const columns = this.options.columns.length || 1;
      
      emptyRow.innerHTML = `
        <td colspan="${columns}" class="px-6 py-12 text-center text-sm text-gray-500">
          <div class="flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-4xl text-gray-300">assignment</span>
            <p>No hay actividades registradas</p>
            <p class="text-xs">Usa el botón "Nueva Actividad" para comenzar</p>
          </div>
        </td>
      `;
      
      this.tbody.appendChild(emptyRow);
      
      // Actualizar paginación
      if (this.options.pagination) {
        this.renderPagination();
      }
      
      return;
    }
    
    // Calcular rango de datos para la paginación
    let dataToRender = this.state.filteredData;
    
    if (this.options.pagination) {
      const startIndex = (this.state.currentPage - 1) * this.options.pageSize;
      const endIndex = startIndex + this.options.pageSize;
      dataToRender = dataToRender.slice(startIndex, endIndex);
    }
    
    // Renderizar cada fila
    dataToRender.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      
      // Iterar por las columnas configuradas
      this.options.columns.forEach(column => {
        const cell = document.createElement('td');
        cell.className = column.cellClass || 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
        
        // Obtener el valor y renderizarlo
        const value = this.getCellValue(item, column);
        
        // Si hay un renderizador personalizado
        if (column.cellRenderer) {
          cell.innerHTML = column.cellRenderer(value, item);
        } else {
          cell.textContent = value !== null && value !== undefined ? value : '';
        }
        
        row.appendChild(cell);
      });
      
      // Añadir fila a la tabla
      this.tbody.appendChild(row);
    });
    
    // Actualizar paginación
    if (this.options.pagination) {
      this.renderPagination();
    }
  }
  
  /**
   * Registra un callback para el clic en botones dentro de las celdas
   * @param {string} selector - Selector CSS para identificar el botón
   * @param {Function} callback - Función a llamar cuando se hace clic
   */
  onButtonClick(selector, callback) {
    // Delegación de eventos en el tbody
    this.tbody.addEventListener('click', (event) => {
      // Encontrar el elemento clickeado que coincida con el selector
      let target = event.target;
      
      // Si el clic es en un ícono dentro del botón, subir al botón
      if (target.tagName === 'I' || target.tagName === 'SPAN') {
        target = target.closest(selector) || target;
      }
      
      // Verificar si el elemento clickeado o algún ancestro coincide con el selector
      const button = target.matches(selector) ? target : target.closest(selector);
      
      if (button) {
        // Encontrar la fila padre
        const row = button.closest('tr');
        if (!row) return;
        
        // Obtener el índice de la fila
        const rowIndex = Array.from(this.tbody.children).indexOf(row);
        if (rowIndex === -1) return;
        
        // Obtener los datos de la fila
        let dataIndex = rowIndex;
        
        if (this.options.pagination) {
          dataIndex += (this.state.currentPage - 1) * this.options.pageSize;
        }
        
        const record = this.state.filteredData[dataIndex];
        if (!record) return;
        
        // Llamar al callback con el evento y los datos
        callback(event, { 
          record, 
          rowIndex, 
          dataIndex, 
          row, 
          button 
        });
      }
    });
  }

  /**
   * Renderiza los controles de paginación
   * @private
   */
  renderPagination() {
    if (!this.paginationContainer) return;
    
    // Calcular páginas
    const totalPages = Math.ceil(this.state.filteredData.length / this.options.pageSize);
    
    // Si no hay páginas o solo hay una
    if (totalPages <= 1) {
      this.paginationContainer.innerHTML = '';
      return;
    }
    
    // Crear estructura de paginación
    let html = `
      <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Mostrando <span class="font-medium">${(this.state.currentPage - 1) * this.options.pageSize + 1}</span> a 
              <span class="font-medium">${Math.min(this.state.currentPage * this.options.pageSize, this.state.filteredData.length)}</span> de 
              <span class="font-medium">${this.state.filteredData.length}</span> resultados
            </p>
          </div>
          <div>
            <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button class="pagination-btn prev relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${this.state.currentPage <= 1 ? 'disabled opacity-50' : ''}" ${this.state.currentPage <= 1 ? 'disabled' : ''}>
                <span class="sr-only">Anterior</span>
                <span class="material-symbols-outlined text-sm">chevron_left</span>
              </button>
    `;
    
    // Añadir botones de página
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || // Primera página
        i === totalPages || // Última página
        (i >= this.state.currentPage - 1 && i <= this.state.currentPage + 1) // ±1 página de la actual
      ) {
        html += `
          <button class="pagination-btn page relative inline-flex items-center px-4 py-2 text-sm font-semibold ${i === this.state.currentPage ? 'bg-indigo-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}" data-page="${i}">
            ${i}
          </button>
        `;
      } else if (
        (i === 2 && this.state.currentPage > 3) || 
        (i === totalPages - 1 && this.state.currentPage < totalPages - 2)
      ) {
        // Puntos suspensivos
        html += `
          <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">
            ...
          </span>
        `;
      }
    }
    
    // Botón siguiente
    html += `
              <button class="pagination-btn next relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${this.state.currentPage >= totalPages ? 'disabled opacity-50' : ''}" ${this.state.currentPage >= totalPages ? 'disabled' : ''}>
                <span class="sr-only">Siguiente</span>
                <span class="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
    `;
    
    // Actualizar el contenedor
    this.paginationContainer.innerHTML = html;
    
    // Añadir eventos a los botones
    this.paginationContainer.querySelectorAll('.pagination-btn').forEach(button => {
      button.addEventListener('click', () => {
        if (button.classList.contains('prev')) {
          if (this.state.currentPage > 1) {
            this.state.currentPage--;
          }
        } else if (button.classList.contains('next')) {
          if (this.state.currentPage < totalPages) {
            this.state.currentPage++;
          }
        } else if (button.classList.contains('page')) {
          this.state.currentPage = parseInt(button.dataset.page, 10);
        }
        
        this.renderRows();
      });
    });
  }
}

export default ExistingTableManager;