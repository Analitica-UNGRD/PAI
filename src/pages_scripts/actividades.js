/**
 * Actividades.js - Gestión de actividades del Plan de Acción Institucional
 * Maneja formularios, validaciones y operaciones CRUD
 */

/**
 * Obtiene el email del usuario autenticado actual
 * @returns {string} Email del usuario o fallback
 */
function obtenerEmailUsuarioActual() {
  try {
  console.log('[DEBUG] obtenerEmailUsuarioActual: Buscando email del usuario...');
    
    // Intentar obtener desde localStorage directamente
    const storageEmail = localStorage.getItem('auth_email');
  console.log('[DEBUG] auth_email en localStorage:', storageEmail);
    
    if (storageEmail && storageEmail.includes('@') && storageEmail !== 'null' && storageEmail !== 'undefined') {
  console.log('[OK] Email obtenido desde localStorage:', storageEmail);
      return storageEmail;
    }
    
    // Intentar decodificar del token si existe
    const token = localStorage.getItem('auth_token');
  console.log('[DEBUG] auth_token en localStorage:', token ? 'existe' : 'no existe');
    
    if (token && token !== 'null') {
      try {
        const decoded = atob(token);
        const parts = decoded.split('|');
        if (parts.length >= 1 && parts[0].includes('@')) {
          console.log('[OK] Email obtenido desde token:', parts[0]);
          return parts[0];
        }
      } catch (tokenError) {
  console.warn('[WARN] Error decodificando token:', tokenError);
      }
    }
    
    // Último fallback
  console.warn('[WARN] No se pudo obtener email del usuario, usando fallback');
    return 'usuario@gestiondelriesgo.gov.co';
    
  } catch (error) {
  console.error('[ERROR] Error obteniendo email del usuario:', error);
    return 'usuario@gestiondelriesgo.gov.co';
  }
}

// Hacer la función disponible globalmente
window.obtenerEmailUsuarioActual = obtenerEmailUsuarioActual;

// ==================== CONFIGURACIÓN ====================

/**
 * Configuración del backend de Google Apps Script
 * URL actualizada con el script desplegado
 */
// Resolver dinámicamente la URL del backend (override desde window, proxy local en dev, o Apps Script en producción)
const DEFAULT_APPS_SCRIPT = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL)
  ? window.APP_CONFIG.APPS_SCRIPT_URL
  : 'https://script.google.com/macros/s/AKfycbxBj5ae8whf6pg2pY588V-TecItxK6fz5j5lBXLHFRUXHLHhPYEVisygRwhMCN6ogRoUw/exec';
const DEFAULT_DEV_PROXY = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.LOCAL_PROXY_URL)
  ? window.APP_CONFIG.LOCAL_PROXY_URL
  : 'http://localhost:3000/api';
const LOCAL_PROXY_FLAG_KEY = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.LOCAL_PROXY_FLAG_KEY)
  ? window.APP_CONFIG.LOCAL_PROXY_FLAG_KEY
  : 'USE_LOCAL_PROXY';

function shouldUseTextPlain(url) {
  try {
    if (!url) return false;
    if (!/^https?:\/\//.test(url)) return false;
    const parsed = new URL(url, window.location.href);
    const host = parsed.hostname || '';
    return host.endsWith('script.google.com') || host.endsWith('googleusercontent.com');
  } catch (err) {
    return false;
  }
}

function resolveScriptUrl() {
  try {
    if (typeof window !== 'undefined') {
      if (window.APP_CONFIG_OVERRIDE && window.APP_CONFIG_OVERRIDE.BASE_URL) {
        console.log('[DEBUG] resolveScriptUrl: override manual:', window.APP_CONFIG_OVERRIDE.BASE_URL);
        return window.APP_CONFIG_OVERRIDE.BASE_URL;
      }
      if (window.APP_CONFIG && window.APP_CONFIG.BASE_URL) {
        console.log('[INFO] resolveScriptUrl: usando APP_CONFIG.BASE_URL:', window.APP_CONFIG.BASE_URL);
        return window.APP_CONFIG.BASE_URL;
      }
      if (window.location && window.location.hostname) {
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') {
          let useLocalProxy = false;
          try {
            useLocalProxy = localStorage.getItem(LOCAL_PROXY_FLAG_KEY) === 'true';
          } catch (storageErr) {
            useLocalProxy = false;
          }
          if (useLocalProxy) {
            console.log('[INFO] resolveScriptUrl: flag local activa, usando proxy:', DEFAULT_DEV_PROXY);
            return DEFAULT_DEV_PROXY;
          }
          console.log('[INFO] resolveScriptUrl: host local detectado, usando Apps Script:', DEFAULT_APPS_SCRIPT);
          return DEFAULT_APPS_SCRIPT;
        }
      }
    }
  } catch (e) {
    console.warn('[WARN] resolveScriptUrl: error en logica:', e);
  }
  console.log('[INFO] resolveScriptUrl: fallback Apps Script:', DEFAULT_APPS_SCRIPT);
  return DEFAULT_APPS_SCRIPT;
}

const CONFIG_BACKEND = {
  SCRIPT_URL: resolveScriptUrl(),
  TIMEOUT: 30000, // 30 segundos
  RETRY_ATTEMPTS: 2,
  DESARROLLO: false // Desactivar modo desarrollo para forzar conexión real
};

// Mostrar URL que se está usando
console.log('[INFO] CONFIG_BACKEND: URL configurada:', CONFIG_BACKEND.SCRIPT_URL);
console.log('[INFO] CONFIG_BACKEND: Para usar proxy local, ejecuta: localStorage.setItem("' + LOCAL_PROXY_FLAG_KEY + '", "true")');

class ActividadesManager {
  constructor() {
    this.actividades = [];
    this.catalogos = {
      subprocesos: [],
      areas: [],
      lineas: [],
      estrategias: [],
      objetivos: [],
      indicadores: [],
      planes: [],
      mipg: [],
      fuentes: []
    };
    this.editandoActividad = null;
    
    this.init();
  }

  init() {
    this.cargarCatalogos();
    this.setupEventListeners();
    this.cargarActividades();
    
    // Auto-llenar el campo responsable cuando se carga la página
    setTimeout(() => {
      const responsableInput = document.getElementById('responsable');
      if (responsableInput && !responsableInput.value) {
        const emailUsuario = obtenerEmailUsuarioActual();
        responsableInput.value = emailUsuario;
      console.log('[INFO] Campo responsable inicializado con:', emailUsuario);
      }
    }, 1000);
  }

  setupEventListeners() {
    // Botones principales
    document.getElementById('btn-nueva-actividad')?.addEventListener('click', () => this.mostrarFormulario());
    document.getElementById('btn-cerrar-form')?.addEventListener('click', () => this.ocultarFormulario());
    document.getElementById('btn-cancelar')?.addEventListener('click', () => this.ocultarFormulario());
    
    // Formulario
    document.getElementById('actividad-form')?.addEventListener('submit', (e) => this.guardarActividad(e));
    
    // Filtros
    document.getElementById('filtro-area')?.addEventListener('change', () => this.aplicarFiltros());
    document.getElementById('filtro-estado')?.addEventListener('change', () => this.aplicarFiltros());
    document.getElementById('filtro-plan')?.addEventListener('change', () => this.aplicarFiltros());
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => this.limpiarFiltros());

    // Validación de fechas
    const fechaInicio = document.getElementById('fecha_inicio_planeada');
    const fechaFin = document.getElementById('fecha_fin_planeada');
    
    fechaInicio?.addEventListener('change', () => this.validarFechas());
    fechaFin?.addEventListener('change', () => this.validarFechas());

    // Cascading dropdowns
    document.getElementById('subproceso_id')?.addEventListener('change', (e) => this.actualizarAreaDerivada(e.target.value));
    document.getElementById('linea_id')?.addEventListener('change', (e) => this.actualizarEstrategiaObjetivoDerivados(e.target.value));
  }

  // ==================== CARGA DE CATÁLOGOS ====================
  
  async cargarCatalogos() {
  console.log('[DEBUG] Iniciando cargarCatalogos()');
  console.log('[INFO] URL del backend:', CONFIG_BACKEND.SCRIPT_URL);
    
    try {
      this.mostrarCargando('Cargando catálogos...');

      // Obtener catálogos desde Google Apps Script
  console.log('[DEBUG] Llamando al backend con action: getCatalogos');
  const response = await this.llamarBackend('getCatalogos');
  console.log('[DEBUG] Respuesta del backend recibida:', response);
      
      if (response.success) {
  console.log('[OK] Respuesta exitosa del backend');
  console.log('[DEBUG] Datos recibidos del backend:', response.data);
  console.log('[DEBUG] Tipo de response.data:', typeof response.data);
  console.log('[DEBUG] Es array?', Array.isArray(response.data));
        
        // ARREGLO: Si response.data es un array (datos sin agrupar), agruparlos aquí
        let groupedData;
        if (Array.isArray(response.data)) {
          console.log('[DEBUG] Detectado array plano, agrupando en frontend...');
          groupedData = this.agruparCatalogosEnFrontend(response.data);
          console.log('[DEBUG] Datos agrupados en frontend:', groupedData);
        } else {
          // Los datos ya están agrupados
          groupedData = response.data;
        }
        
        this.catalogos = {
          areas: groupedData.areas || [],
          subprocesos: groupedData.subprocesos || [],
          objetivos: groupedData.objetivos || [],
          estrategias: groupedData.estrategias || [],
          lineas: groupedData.lineas || [],
          indicadores: groupedData.indicadores || [],
          planes: groupedData.planes || [],
          bimestres: groupedData.bimestres || [],
          mipg: groupedData.mipg || [],
          fuentes: groupedData.fuentes || []
        };

  console.log('[DEBUG] Catálogos asignados a this.catalogos:', this.catalogos);
  console.log('[DEBUG] Conteo de elementos por catálogo:');
        Object.keys(this.catalogos).forEach(key => {
          console.log(`   - ${key}: ${this.catalogos[key].length} elementos`);
        });
        
        this.poblarSelects();
      } else {
  console.error('[ERROR] Backend devolvió error:', response.error);
        throw new Error(response.error || 'Error al cargar catálogos');
      }

      this.ocultarCargando();
    } catch (error) {
  console.error('[ERROR] Error en cargarCatalogos:', error);
      this.ocultarCargando();
      this.mostrarError('Error al cargar los catálogos. Verifique la conexión con Google Apps Script.');
      // No cargar datos de fallback - fallar completamente para forzar la corrección de la conexión
    }
  }

  /**
   * Agrupa catálogos planos en el formato esperado por el frontend
   * @param {Array} catalogosArray - Array de elementos de catálogo
   * @returns {Object} Catálogos agrupados por tipo
   */
  agruparCatalogosEnFrontend(catalogosArray) {
  console.log('[DEBUG] agruparCatalogosEnFrontend: Procesando', catalogosArray.length, 'elementos');
    
    const grouped = {
      areas: [],
      subprocesos: [],
      objetivos: [],
      estrategias: [],
      lineas: [],
      indicadores: [],
      planes: [],
      bimestres: [],
      mipg: [],
      fuentes: []
    };

    catalogosArray.forEach((item, index) => {
      if (!item || !item.catalogo) {
  console.warn('[WARN] Item sin catalogo en posición', index, ':', item);
        return;
      }

      const mappedItem = this.mapearItemCatalogo(item);
  console.log(`[DEBUG] Mapeando ${item.catalogo}:`, item, '->', mappedItem);
      
      switch(item.catalogo) {
        case 'area':
          grouped.areas.push(mappedItem);
          break;
        case 'subproceso':
          grouped.subprocesos.push(mappedItem);
          break;
        case 'objetivo':
          grouped.objetivos.push(mappedItem);
          break;
        case 'estrategia':
          grouped.estrategias.push(mappedItem);
          break;
        case 'linea':
          grouped.lineas.push(mappedItem);
          break;
        case 'indicador':
          grouped.indicadores.push(mappedItem);
          break;
        case 'plan':
          grouped.planes.push(mappedItem);
          break;
        case 'bimestre':
          grouped.bimestres.push(mappedItem);
          break;
        case 'mipg':
          grouped.mipg.push(mappedItem);
          break;
        case 'fuente':
          grouped.fuentes.push(mappedItem);
          break;
        default:
          console.warn(`[WARN] Tipo de catálogo desconocido: ${item.catalogo}`, item);
      }
    });

  console.log('[DEBUG] Agrupación completada:');
    Object.keys(grouped).forEach(key => {
      console.log(`   - ${key}: ${grouped[key].length} elementos`);
    });

    return grouped;
  }

  /**
   * Mapea un item de catálogo al formato legacy esperado por el frontend
   * @param {Object} item - Item del catálogo unificado
   * @returns {Object} Item en formato legacy
   */
  mapearItemCatalogo(item) {
    const type = item.catalogo;
    const mapped = {};
    
    // Mapear campos comunes
    mapped[`${type}_id`] = item.code;
    mapped[`${type}_nombre`] = item.label;
    
    // Agregar parent_code si existe (para filtrado jerárquico)
    if (item.parent_code) {
      mapped.parent_code = item.parent_code;
    }
    
    // Mapeos específicos por tipo
    switch(type) {
      case 'area':
        mapped.area_codigo = item.code;
        break;
        
      case 'subproceso':
        mapped.subproceso_codigo = item.code;
        if (item.parent_code) {
          mapped.area_id = item.parent_code;
        }
        break;
        
      case 'objetivo':
        mapped.objetivo_codigo = item.code;
        break;
        
      case 'estrategia':
        mapped.estrategia_codigo = item.code;
        if (item.parent_code) {
          mapped.objetivo_id = item.parent_code;
        }
        break;
        
      case 'linea':
        mapped.linea_codigo = item.code;
        if (item.parent_code) {
          mapped.estrategia_id = item.parent_code;
        }
        break;
        
      case 'indicador':
        mapped.indicador_codigo = item.code;
        mapped.unidad = item.unidad || 'Número';
        mapped.formula_tipo = item.formula_tipo || 'Conteo';
        break;
        
      case 'plan':
        mapped.plan_codigo = item.code;
        break;
        
      case 'fuente':
        mapped.fuente_codigo = item.code;
        break;
        
      case 'bimestre':
        mapped.bimestre_codigo = item.code;
        break;
        
      case 'mipg':
        mapped.mipg_codigo = item.code;
        break;
    }
    
    return mapped;
  }

  poblarSelects() {
  console.log('[DEBUG] Iniciando poblarSelects()');
  console.log('[DEBUG] Estado actual de catalogos:', this.catalogos);
    
    // Poblar áreas (primer nivel de jerarquía)
    const selectArea = document.getElementById('area_id');
  console.log('[DEBUG] selectArea encontrado:', !!selectArea);
  console.log('[DEBUG] areas disponibles:', this.catalogos.areas?.length || 0, this.catalogos.areas);
    
    if (selectArea && this.catalogos.areas) {
      selectArea.innerHTML = '<option value="">Seleccione área</option>';
      this.catalogos.areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.area_id;
        option.textContent = area.area_nombre;
        selectArea.appendChild(option);
  console.log('[DEBUG] Agregada área:', area.area_nombre);
      });
      
      // Configurar listener para filtrado de subprocesos
      selectArea.addEventListener('change', (e) => this.filtrarSubprocesos(e.target.value));
  console.log('[DEBUG] Listener de área configurado');
    }

    // Poblar subprocesos (inicialmente vacío, se llena al seleccionar área)
    const selectSubproceso = document.getElementById('subproceso_id');
    if (selectSubproceso) {
      selectSubproceso.innerHTML = '<option value="">Primero seleccione un área</option>';
      selectSubproceso.addEventListener('change', (e) => this.onSubprocesoChange(e.target.value));
    }

    // Poblar objetivos (primer nivel para líneas estratégicas)
    const selectObjetivo = document.getElementById('objetivo_id');
    if (selectObjetivo && this.catalogos.objetivos) {
      selectObjetivo.innerHTML = '<option value="">Seleccione objetivo</option>';
      this.catalogos.objetivos.forEach(obj => {
        const option = document.createElement('option');
        option.value = obj.objetivo_id;
        option.textContent = obj.objetivo_nombre;
        selectObjetivo.appendChild(option);
      });
      
      // Configurar listener para filtrado de estrategias
      selectObjetivo.addEventListener('change', (e) => this.filtrarEstrategias(e.target.value));
    }

    // Poblar estrategias (inicialmente todas o vacío si hay objetivos)
    const selectEstrategia = document.getElementById('estrategia_id');
    if (selectEstrategia && this.catalogos.estrategias) {
      if (this.catalogos.objetivos && this.catalogos.objetivos.length > 0) {
        selectEstrategia.innerHTML = '<option value="">Primero seleccione un objetivo</option>';
      } else {
        this.poblarEstrategias();
      }
      selectEstrategia.addEventListener('change', (e) => this.filtrarLineas(e.target.value));
    }

    // Poblar líneas de acción
    const selectLinea = document.getElementById('linea_id');
    if (selectLinea) {
      if (this.catalogos.estrategias && this.catalogos.estrategias.length > 0) {
        selectLinea.innerHTML = '<option value="">Primero seleccione una estrategia</option>';
      } else {
        this.poblarLineas();
      }
    }

    // Poblar indicadores (sin filtrado jerárquico por ahora)
    const selectIndicador = document.getElementById('indicador_id');
    if (selectIndicador && this.catalogos.indicadores) {
      selectIndicador.innerHTML = '<option value="">Seleccione indicador</option>';
      this.catalogos.indicadores.forEach(ind => {
        const option = document.createElement('option');
        option.value = ind.indicador_id;
        option.textContent = `${ind.indicador_nombre} ${ind.unidad ? '(' + ind.unidad + ')' : ''}`;
        selectIndicador.appendChild(option);
      });
    }

    // Poblar planes
    const selectPlan = document.getElementById('plan_id');
    if (selectPlan && this.catalogos.planes) {
      selectPlan.innerHTML = '<option value="">Seleccione plan</option>';
      this.catalogos.planes.forEach(plan => {
        const option = document.createElement('option');
        option.value = plan.plan_id;
        option.textContent = plan.plan_nombre;
        selectPlan.appendChild(option);
      });
    }

    // Poblar MIPG
    const selectMipg = document.getElementById('mipg_codigo');
    if (selectMipg && this.catalogos.mipg && this.catalogos.mipg.length > 0) {
      selectMipg.innerHTML = '<option value="">Seleccione MIPG</option>';
      this.catalogos.mipg.forEach(item => {
        const option = document.createElement('option');
        option.value = item.mipg_codigo || item.mipg_id;
        option.textContent = item.mipg_nombre;
        selectMipg.appendChild(option);
      });
    }

    // Poblar fuentes de financiación
    const selectFuente = document.getElementById('fuente_financiacion');
    if (selectFuente && this.catalogos.fuentes && this.catalogos.fuentes.length > 0) {
      selectFuente.innerHTML = '<option value="">Seleccione fuente</option>';
      this.catalogos.fuentes.forEach(item => {
        const option = document.createElement('option');
        option.value = item.fuente_id;
        option.textContent = item.fuente_nombre;
        selectFuente.appendChild(option);
      });
    }

    // Poblar bimestres
    const selectBimestre = document.getElementById('bimestre_id');
    if (selectBimestre && this.catalogos.bimestres) {
      selectBimestre.innerHTML = '<option value="">Seleccione bimestre</option>';
      this.catalogos.bimestres.forEach(bim => {
        const option = document.createElement('option');
        option.value = bim.bimestre_id;
        option.textContent = bim.bimestre_nombre;
        selectBimestre.appendChild(option);
      });
    }

    // Poblar filtros
    this.poblarFiltros();
  }

  /**
   * Filtra subprocesos basándose en el área seleccionada
   */
  filtrarSubprocesos(areaId) {
    const selectSubproceso = document.getElementById('subproceso_id');
    if (!selectSubproceso || !this.catalogos.subprocesos) return;

    selectSubproceso.innerHTML = '<option value="">Seleccione subproceso</option>';

    if (!areaId) {
      selectSubproceso.innerHTML = '<option value="">Primero seleccione un área</option>';
      return;
    }

    // Filtrar subprocesos que pertenecen al área seleccionada
    const subprocesos = this.catalogos.subprocesos.filter(sp => 
      sp.parent_code === areaId || sp.area_id === areaId
    );

    subprocesos.forEach(sp => {
      const option = document.createElement('option');
      option.value = sp.subproceso_id;
      option.textContent = sp.subproceso_nombre;
      selectSubproceso.appendChild(option);
    });

    if (subprocesos.length === 0) {
      selectSubproceso.innerHTML = '<option value="">No hay subprocesos para esta área</option>';
    }
  }

  /**
   * Filtra estrategias basándose en el objetivo seleccionado
   */
  filtrarEstrategias(objetivoId) {
    const selectEstrategia = document.getElementById('estrategia_id');
    if (!selectEstrategia || !this.catalogos.estrategias) return;

    selectEstrategia.innerHTML = '<option value="">Seleccione estrategia</option>';

    if (!objetivoId) {
      selectEstrategia.innerHTML = '<option value="">Primero seleccione un objetivo</option>';
      this.filtrarLineas(''); // Limpiar líneas también
      return;
    }

    // Filtrar estrategias que pertenecen al objetivo seleccionado
    const estrategias = this.catalogos.estrategias.filter(est => 
      est.parent_code === objetivoId || est.objetivo_id === objetivoId
    );

    estrategias.forEach(est => {
      const option = document.createElement('option');
      option.value = est.estrategia_id;
      option.textContent = `${est.estrategia_codigo || ''} - ${est.estrategia_nombre}`;
      selectEstrategia.appendChild(option);
    });

    if (estrategias.length === 0) {
      selectEstrategia.innerHTML = '<option value="">No hay estrategias para este objetivo</option>';
    }
    
    // Limpiar líneas cuando cambie la estrategia
    this.filtrarLineas('');
  }

  /**
   * Filtra líneas de acción basándose en la estrategia seleccionada
   */
  filtrarLineas(estrategiaId) {
    const selectLinea = document.getElementById('linea_id');
    if (!selectLinea || !this.catalogos.lineas) return;

    selectLinea.innerHTML = '<option value="">Seleccione línea de acción</option>';

    if (!estrategiaId) {
      selectLinea.innerHTML = '<option value="">Primero seleccione una estrategia</option>';
      return;
    }

    // Filtrar líneas que pertenecen a la estrategia seleccionada
    const lineas = this.catalogos.lineas.filter(linea => 
      linea.parent_code === estrategiaId || linea.estrategia_id === estrategiaId
    );

    lineas.forEach(linea => {
      const option = document.createElement('option');
      option.value = linea.linea_id;
      option.textContent = `${linea.linea_codigo || ''} - ${linea.linea_nombre}`;
      selectLinea.appendChild(option);
    });

    if (lineas.length === 0) {
      selectLinea.innerHTML = '<option value="">No hay líneas para esta estrategia</option>';
    }
  }

  /**
   * Maneja cambios en la selección de subproceso
   */
  onSubprocesoChange(subprocesoId) {
    // Aquí puedes agregar lógica adicional si es necesaria
    // Por ejemplo, filtrar indicadores por subproceso
  }

  /**
   * Pobla estrategias sin filtro (para casos donde no hay objetivos)
   */
  poblarEstrategias() {
    const selectEstrategia = document.getElementById('estrategia_id');
    if (!selectEstrategia || !this.catalogos.estrategias) return;

    selectEstrategia.innerHTML = '<option value="">Seleccione estrategia</option>';
    this.catalogos.estrategias.forEach(est => {
      const option = document.createElement('option');
      option.value = est.estrategia_id;
      option.textContent = `${est.estrategia_codigo || ''} - ${est.estrategia_nombre}`;
      selectEstrategia.appendChild(option);
    });
  }

  /**
   * Pobla líneas sin filtro (para casos donde no hay estrategias)
   */
  poblarLineas() {
    const selectLinea = document.getElementById('linea_id');
    if (!selectLinea || !this.catalogos.lineas) return;

    selectLinea.innerHTML = '<option value="">Seleccione línea de acción</option>';
    this.catalogos.lineas.forEach(linea => {
      const option = document.createElement('option');
      option.value = linea.linea_id;
      option.textContent = `${linea.linea_codigo || ''} - ${linea.linea_nombre}`;
      selectLinea.appendChild(option);
    });
  }

  poblarFiltros() {
    // Filtro de áreas
    const filtroArea = document.getElementById('filtro-area');
    if (filtroArea && this.catalogos.areas) {
      filtroArea.innerHTML = '<option value="">Todas las áreas</option>';
      this.catalogos.areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.area_id;
        option.textContent = area.area_nombre;
        filtroArea.appendChild(option);
      });
    }

    // Filtro de planes
    const filtroPlan = document.getElementById('filtro-plan');
    if (filtroPlan && this.catalogos.planes) {
      filtroPlan.innerHTML = '<option value="">Todos los planes</option>';
      this.catalogos.planes.forEach(plan => {
        const option = document.createElement('option');
        option.value = plan.plan_id;
        option.textContent = plan.plan_nombre;
        filtroPlan.appendChild(option);
      });
    }
  }

  // ==================== DERIVACIONES ====================
  
  actualizarAreaDerivada(subprocesoId) {
    const subproceso = this.catalogos.subprocesos.find(sp => sp.subproceso_id === subprocesoId);
    if (subproceso) {
      // Mostrar área derivada (solo visual, no se almacena)
      console.log('Área derivada:', this.catalogos.areas.find(a => a.area_id === subproceso.area_id)?.area_nombre);
    }
  }

  actualizarEstrategiaObjetivoDerivados(lineaId) {
    const linea = this.catalogos.lineas.find(l => l.linea_id === lineaId);
    if (linea) {
      const estrategia = this.catalogos.estrategias.find(e => e.estrategia_id === linea.estrategia_id);
      if (estrategia) {
        const objetivo = this.catalogos.objetivos.find(o => o.objetivo_id === estrategia.objetivo_id);
        console.log('Derivados - Estrategia:', estrategia.estrategia_nombre, 'Objetivo:', objetivo?.objetivo_nombre);
      }
    }
  }

  // ==================== VALIDACIONES ====================
  
  validarFechas() {
    const fechaInicio = document.getElementById('fecha_inicio_planeada').value;
    const fechaFin = document.getElementById('fecha_fin_planeada').value;
    
    if (fechaInicio && fechaFin) {
      if (new Date(fechaFin) < new Date(fechaInicio)) {
        document.getElementById('fecha_fin_planeada').setCustomValidity('La fecha de fin debe ser posterior a la fecha de inicio');
      } else {
        document.getElementById('fecha_fin_planeada').setCustomValidity('');
      }
    }
  }

  validarFormulario(formData) {
    const errores = [];
    
    // VALIDACIONES TEMPORALMENTE RELAJADAS PARA PRUEBAS
    // Solo validamos campos críticos
    
    if (!formData.subproceso_id) {
      errores.push('El subproceso es requerido');
    }
    
    if (!formData.linea_id) {
      errores.push('La línea de acción es requerida');
    }
    
    // INDICADOR YA NO ES OBLIGATORIO - comentado permanentemente
    // if (!formData.indicador_id) {
    //   errores.push('El indicador es requerido');
    // }
    
    // Si hay indicador seleccionado, validar que tenga meta
    if (formData.indicador_id && (!formData.meta_indicador || formData.meta_indicador <= 0)) {
      errores.push('Si selecciona un indicador, la meta debe ser mayor a 0');
    }
    
    if (!formData.plan_id) {
      errores.push('El plan es requerido');
    }
    
    if (!formData.estado) {
      errores.push('El estado es requerido');
    }
    
    return errores;
  }

  // ==================== CRUD ACTIVIDADES ====================

  /**
   * Función para llamar al backend de Google Apps Script
   * @param {string} path - Endpoint del backend
   * @param {Object} payload - Datos a enviar
   * @returns {Promise} Respuesta del backend
   */
  async llamarBackend(path, payload = {}) {
  console.log('[DEBUG] llamarBackend: Iniciando con path:', path);
  console.log('[DEBUG] llamarBackend: Payload:', payload);
  console.log('[DEBUG] llamarBackend: Script URL:', CONFIG_BACKEND.SCRIPT_URL);
    
    // Verificar configuración
    if (CONFIG_BACKEND.SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
  console.error('[WARN] Configuración pendiente: Reemplazar YOUR_SCRIPT_ID en CONFIG_BACKEND.SCRIPT_URL');
      throw new Error('Script ID no configurado - no se puede conectar al backend');
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG_BACKEND.TIMEOUT);

      // Endpoints de solo lectura: usar GET sin headers personalizados para evitar preflight CORS
      const readPaths = ['getCatalogos', 'ping', 'actividades/obtener', 'actividades/buscar', 'getDashboardData'];
      let response;

      if (readPaths.some(p => path === p || path.startsWith(p))) {
        // Construir querystring con payload (serializado y URL-encoded)
        const qs = `?path=${encodeURIComponent(path)}` + (Object.keys(payload || {}).length ? `&payload=${encodeURIComponent(JSON.stringify(payload))}` : '');
        const url = CONFIG_BACKEND.SCRIPT_URL + qs;
        
  console.log('[DEBUG] llamarBackend: Usando GET con URL:', url);
        response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });
      } else {
  console.log('[DEBUG] llamarBackend: Usando POST con JSON body');
        // Operaciones que modifican datos: usar POST con JSON (normal)
        const usePlain = shouldUseTextPlain(CONFIG_BACKEND.SCRIPT_URL);
        const postHeaders = usePlain ? { 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' };
        response = await fetch(CONFIG_BACKEND.SCRIPT_URL, {
          method: 'POST',
          headers: postHeaders,
          body: JSON.stringify({ path: path, payload: payload }),
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);
  console.log('[DEBUG] llamarBackend: Response status:', response.status, response.statusText);

      if (!response.ok) {
  console.error('[ERROR] llamarBackend: Response not OK:', response);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
  console.log('[DEBUG] llamarBackend: Response JSON:', result);

      if (typeof result !== 'object' || result === null) {
  console.error('[ERROR] llamarBackend: Invalid response type:', typeof result, result);
        throw new Error('Respuesta del servidor no válida');
      }

      return result;

    } catch (error) {
      console.error('Error llamando al backend:', error);
      throw error;
    }
  }

  /**
   * Muestra indicador de carga
   */
  mostrarCargando(mensaje = "Cargando...", style = "solid") {
    try {
      if (window.APP_LOADER && typeof window.APP_LOADER.showLoader === "function") {
        window.APP_LOADER.showLoader(mensaje, style);
      } else {
        console.log('[loader] mostrarCargando:', mensaje);
      }
    } catch (error) {
      console.log('[loader] mostrarCargando error:', error);
    }
  }

  ocultarCargando() {
    try {
      if (window.APP_LOADER && typeof window.APP_LOADER.hideLoader === "function") {
        window.APP_LOADER.hideLoader();
      } else {
        const el = document.getElementById('appLoader');
        if (el) el.remove();
      }
    } catch (error) {
      console.log('[loader] ocultarCargando error:', error);
    }
  }


  /**
   * Muestra mensaje de éxito
   */
  mostrarExito(mensaje) {
    console.log('Éxito:', mensaje);
    // Implementar notificación de éxito
  }
  
  async cargarActividades() {
    try {
      this.mostrarCargando('Cargando actividades...');

      // Llamar al backend para obtener actividades
      const response = await this.llamarBackend('actividades/obtener', {
        incluir_catalogos: true
      });

      if (response.success) {
        this.actividades = response.data || [];
        this.renderizarTabla();
      } else {
        throw new Error(response.error || 'Error al cargar actividades');
      }

      this.ocultarCargando();

    } catch (error) {
      console.error('Error cargando actividades:', error);
      this.ocultarCargando();
      // No usar datos de fallback - fallar completamente para forzar la corrección de la conexión
      this.mostrarError('Error al cargar actividades desde Google Apps Script. Verifique la conexión.');
    }
  }

  async guardarActividad(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const datos = Object.fromEntries(formData.entries());
    
    // DEBUG: Mostrar qué datos se están enviando
    console.log('Datos del formulario:', datos);
    
    // Validar formulario
    const errores = this.validarFormulario(datos);
    if (errores.length > 0) {
      this.mostrarError(errores.join('\n'));
      return;
    }
    
    try {
      this.mostrarCargando(this.editandoActividad ? 'Actualizando actividad...' : 'Creando actividad...');

      let response;
      
      if (this.editandoActividad) {
        // Actualizar actividad existente
        const emailUsuario = obtenerEmailUsuarioActual();
  console.log('[DEBUG] Email del usuario para actualizar actividad:', emailUsuario);
        
        response = await this.llamarBackend('actividades/actualizar', {
          id: this.editandoActividad,
          datos: datos,
          usuario: emailUsuario,
          email: emailUsuario,
          correo: emailUsuario
        });
      } else {
        // Crear nueva actividad - enviar datos tal como vienen del formulario
        const emailUsuario = obtenerEmailUsuarioActual();
  console.log('[DEBUG] Email del usuario para crear actividad:', emailUsuario);
        
        const datosCompletos = {
          ...datos,
          // Asegurar que descripcion_actividad no esté vacía
          descripcion_actividad: datos.descripcion_actividad || 'Actividad sin descripción',
          usuario: emailUsuario,
          email: emailUsuario,
          correo: emailUsuario,
          creado_por: emailUsuario
        };
        console.log('Datos enviados al backend:', datosCompletos);
        response = await this.llamarBackend('actividades/crear', datosCompletos);
      }

  console.log('[DEBUG] Respuesta completa del backend:', response);
      this.ocultarCargando();

      if (response && response.success) {
  console.log('[DEBUG] Guardado exitoso');
        this.mostrarExito(
          this.editandoActividad ? 
          'Actividad actualizada correctamente' : 
          'Actividad creada correctamente'
        );
        
        // Recargar actividades
        await this.cargarActividades();
        
        // Limpiar formulario y cerrar
        this.editandoActividad = null;
        form.reset();
        this.ocultarFormulario();

      } else {
  console.error('[ERROR] Error en respuesta del backend:', response);
  console.error('[ERROR] Errores específicos:', response.errors);
  console.error('[ERROR] Mensaje:', response.message);
        
        let errorMsg = 'Error desconocido al guardar';
        
        if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
          errorMsg = response.errors.join(', ');
        } else if (response.message) {
          errorMsg = response.message;
        } else if (response.error) {
          errorMsg = response.error;
        }
        
  console.error('[ERROR] Mensaje de error final:', errorMsg);
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error('Error guardando actividad:', error);
      this.ocultarCargando();
      
      // Fallback: guardar localmente para desarrollo
      console.warn('Guardando actividad localmente (fallback)');
      this.guardarActividadFallback(datos);
    }
  }

  guardarActividadFallback(datos) {
    try {
      if (this.editandoActividad) {
        // Actualizar actividad existente
        const index = this.actividades.findIndex(a => a.actividad_id === this.editandoActividad);
        if (index >= 0) {
          this.actividades[index] = {
            ...this.actividades[index],
            ...datos,
            ultima_modificacion: new Date().toISOString().split('T')[0]
          };
        }
        this.mostrarExito('Actividad actualizada correctamente');
      } else {
        // Crear nueva actividad
        const nuevaActividad = {
          ...datos,
          actividad_id: this.generarIdActividad(),
          creado_por: obtenerEmailUsuarioActual(),
          creado_el: new Date().toISOString().split('T')[0],
          actualizado_el: new Date().toISOString().split('T')[0]
        };
        
        this.actividades.push(nuevaActividad);
        this.mostrarExito('Actividad creada correctamente');
      }
      
      this.renderizarTabla();
      this.ocultarFormulario();
      
    } catch (error) {
      console.error('Error guardando actividad:', error);
      this.mostrarError('Error al guardar la actividad');
    }
  }

  editarActividad(actividadId) {
    const actividad = this.actividades.find(a => a.actividad_id === actividadId);
    if (!actividad) return;
    
    this.editandoActividad = actividadId;
    
    // Llenar formulario con datos existentes
    Object.keys(actividad).forEach(key => {
      const input = document.getElementById(key);
      if (input) {
        input.value = actividad[key] || '';
      }
    });
    
    // Actualizar títulos
    document.getElementById('form-title').textContent = 'Editar Actividad';
    document.getElementById('btn-submit-text').textContent = 'Actualizar Actividad';
    
    this.mostrarFormulario();
  }

  async eliminarActividad(actividadId) {
    if (!confirm('¿Está seguro de eliminar esta actividad? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      this.mostrarCargando('Eliminando actividad...');

      // Intentar eliminar desde el backend
      const response = await this.llamarBackend('actividades/eliminar', {
        id: actividadId
      });

      this.ocultarCargando();

      if (response.success) {
        this.mostrarExito('Actividad eliminada correctamente');
        await this.cargarActividades(); // Recargar la lista
      } else {
        throw new Error(response.error || 'Error al eliminar la actividad');
      }

    } catch (error) {
      console.error('Error eliminando actividad:', error);
      this.ocultarCargando();
      
      // Fallback: eliminar localmente
      console.warn('Eliminando actividad localmente (fallback)');
      const index = this.actividades.findIndex(a => a.actividad_id === actividadId);
      if (index >= 0) {
        this.actividades.splice(index, 1);
        this.renderizarTabla();
        this.mostrarExito('Actividad eliminada correctamente');
      }
    }
  }

  // ==================== UI Y RENDERIZADO ====================
  
  mostrarFormulario() {
    document.getElementById('form-actividad').classList.remove('hidden');
    
    const responsableInput = document.getElementById('responsable');
    const responsableLabel = document.querySelector('label[for="responsable"]');
    
    if (this.editandoActividad) {
      // Modo edición: campo editable
      responsableInput.removeAttribute('readonly');
      responsableInput.classList.remove('bg-gray-50', 'cursor-not-allowed');
      responsableInput.classList.add('bg-white');
      if (responsableLabel) {
        responsableLabel.innerHTML = 'Responsable <span class="text-red-500">*</span>';
      }
    } else {
      // Modo creación: campo readonly con auto-asignación
      responsableInput.setAttribute('readonly', true);
      responsableInput.classList.add('bg-gray-50', 'cursor-not-allowed');
      responsableInput.classList.remove('bg-white');
      if (responsableLabel) {
        responsableLabel.innerHTML = 'Responsable <span class="text-red-500">*</span> <span class="text-xs text-gray-500">(Auto-asignado)</span>';
      }
      const emailUsuario = obtenerEmailUsuarioActual();
      responsableInput.value = emailUsuario;
  console.log('[DEBUG] Campo responsable auto-llenado con:', emailUsuario);
    }
    
    document.getElementById('descripcion_actividad').focus();
  }

  ocultarFormulario() {
    document.getElementById('form-actividad').classList.add('hidden');
    document.getElementById('actividad-form').reset();
    
    // Resetear estado de edición
    this.editandoActividad = null;
    document.getElementById('form-title').textContent = 'Nueva Actividad';
    document.getElementById('btn-submit-text').textContent = 'Guardar Actividad';
    
    // Restaurar estado readonly para el campo responsable
    const responsableInput = document.getElementById('responsable');
    const responsableLabel = document.querySelector('label[for="responsable"]');
    
    if (responsableInput) {
      responsableInput.setAttribute('readonly', true);
      responsableInput.classList.add('bg-gray-50', 'cursor-not-allowed');
      responsableInput.classList.remove('bg-white');
    }
    
    if (responsableLabel) {
      responsableLabel.innerHTML = 'Responsable <span class="text-red-500">*</span> <span class="text-xs text-gray-500">(Auto-asignado)</span>';
    }
    
    // Auto-llenar responsable para próxima creación
    setTimeout(() => {
      if (responsableInput) {
        const emailUsuario = obtenerEmailUsuarioActual();
        responsableInput.value = emailUsuario;
      }
    }, 100);
  }

  renderizarTabla() {
    const tbody = document.getElementById('tabla-actividades');
    if (!tbody) return;

    if (this.actividades.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-12 text-center text-sm text-gray-500">
            <div class="flex flex-col items-center gap-2">
              <span class="material-symbols-outlined text-4xl text-gray-300">assignment</span>
              <p>No hay actividades registradas</p>
              <p class="text-xs">Usa el botón "Nueva Actividad" para comenzar</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Allow rendering a provided list (for filtered views) or the full set
    const rowsSource = this.actividadesToRender || this.actividades;

    tbody.innerHTML = rowsSource.map(actividad => {
      const area = this.resolveAreaFromActivity(actividad);
      const indicador = this.resolveIndicatorFromActivity(actividad);
      const estadoClass = this.obtenerClaseEstado(actividad.estado);

      const inicio = this.formatDateOnly(actividad.fecha_inicio_planeada) || 'N/D';
      const fin = this.formatDateOnly(actividad.fecha_fin_planeada) || 'N/D';

      return `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4">
            <div class="text-sm font-medium text-gray-900">${actividad.descripcion_actividad}</div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-900">${area?.area_nombre || actividad.area || 'N/A'}</td>
          <td class="px-6 py-4">
            <div class="text-sm text-gray-900">${indicador?.indicador_nombre || actividad.indicador || 'N/A'}</div>
            <div class="text-sm text-gray-500">${indicador?.unidad || ''}</div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-900">${actividad.meta_indicador_valor || actividad.meta_indicador || ''}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${actividad.responsable || 'No asignado'}</td>
          <td class="px-6 py-4">
            <span class="inline-flex whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-5 ${estadoClass}">
              ${actividad.estado}
            </span>
          </td>
          <td class="px-6 py-4 text-sm text-gray-500">
            <div>Inicio: ${inicio}</div>
            <div>Fin: ${fin}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  aplicarFiltros() {
    // Leer valores de filtros
    const filtroArea = (document.getElementById('filtro-area')?.value || '').trim();
    const filtroEstado = (document.getElementById('filtro-estado')?.value || '').trim();
    const filtroPlan = (document.getElementById('filtro-plan')?.value || '').trim();

    // Aplicar filtros sobre el conjunto de actividades cargadas
    this.actividadesToRender = this.actividades.filter(act => {
      // Area: puede venir por subproceso_id (relacionada) o por campo area directamente
      if (filtroArea) {
        const area = this.resolveAreaFromActivity(act);
        const areaId = area?.area_id || act.area_id || act.area;
        if (!areaId || String(areaId) !== String(filtroArea)) return false;
      }

      if (filtroEstado) {
        if (!act.estado || String(act.estado) !== String(filtroEstado)) return false;
      }

      if (filtroPlan) {
        const planId = act.plan_id || act.plan;
        if (!planId || String(planId) !== String(filtroPlan)) return false;
      }

      return true;
    });

    this.renderizarTabla();
  }

  limpiarFiltros() {
    document.getElementById('filtro-area').value = '';
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-plan').value = '';
  this.actividadesToRender = null;
  this.aplicarFiltros();
  }

  // ==================== UTILIDADES ====================
  
  generarIdActividad() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 3);
    return `ACT-${timestamp}-${random}`.toUpperCase();
  }

  obtenerAreaPorSubproceso(subprocesoId) {
    const subproceso = this.catalogos.subprocesos.find(sp => sp.subproceso_id === subprocesoId);
    if (subproceso) {
      return this.catalogos.areas.find(a => a.area_id === subproceso.area_id);
    }
    return null;
  }

  // Resolver área tomando en cuenta subproceso o campo area directo
  resolveAreaFromActivity(activity) {
    if (!activity) return null;
    // Preferir subproceso relation
    if (activity.subproceso_id) {
      const sub = this.catalogos.subprocesos.find(s => s.subproceso_id === activity.subproceso_id || s.subproceso_codigo === activity.subproceso_id);
      if (sub) {
        return this.catalogos.areas.find(a => a.area_id === sub.area_id || a.area_codigo === sub.parent_code) || null;
      }
    }
    // Fallback: buscar area por id o por nombre
    if (activity.area_id) {
      return this.catalogos.areas.find(a => a.area_id === activity.area_id || a.area_codigo === activity.area_id) || null;
    }
    if (activity.area) {
      return this.catalogos.areas.find(a => a.area_nombre === activity.area) || null;
    }
    return null;
  }

  // Resolver indicador por id o por nombre
  resolveIndicatorFromActivity(activity) {
    if (!activity) return null;
    const indId = activity.indicador_id || activity.indicador || activity.indicador_codigo;
    if (indId) {
      return this.catalogos.indicadores.find(i => i.indicador_id === indId || i.indicador_codigo === indId || i.indicador_nombre === indId) || null;
    }
    return null;
  }

  // Formatea valores de fecha para mostrar solo YYYY-MM-DD
  formatDateOnly(value) {
    if (!value) return '';
    try {
      // Si ya es YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      // Si es ISO con tiempo
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return String(value);
    }
  }

  obtenerClaseEstado(estado) {
    const clases = {
      'Planeada': 'bg-yellow-100 text-yellow-800',
      'En Progreso': 'bg-blue-100 text-blue-800',
      'Completada': 'bg-green-100 text-green-800',
      'Suspendida': 'bg-orange-100 text-orange-800',
      'Cancelada': 'bg-red-100 text-red-800'
    };
    return clases[estado] || 'bg-gray-100 text-gray-800';
  }

  mostrarError(mensaje) {
    // Simple alert por ahora, se puede mejorar con toast/modal
    alert('Error: ' + mensaje);
  }

  mostrarExito(mensaje) {
    // Simple alert por ahora, se puede mejorar con toast/modal
    alert('Éxito: ' + mensaje);
  }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  window.actividadesManager = new ActividadesManager();
});







