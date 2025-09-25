/**
 * 04_DashboardManager.gs - Gestor de Dashboard para PAI-UNGRD
 * 
 * Este módulo maneja todas las operaciones del dashboard:
 * - Cálculo de KPIs y métricas del dashboard
 * - Generación de datos para gráficos y visualizaciones
 * - Resúmenes ejecutivos y estadísticas
 * - Análisis de progreso y cumplimiento
 * - Integración con nueva arquitectura de catálogos
 * 
 * @author: Sistema PAI-UNGRD
 * @version: 2.0
 */

// ==================== MANEJADOR PRINCIPAL ====================

/**
 * Manejador principal para requests del dashboard
 * @param {Object} body - Request body con path y payload
 * @returns {Object} Respuesta formateada
 */
function handleDashboardRequest(body) {
  try {
    const path = body.path || '';
    const payload = body.payload || {};

    // Router para endpoints del dashboard
    switch (path) {
      case 'getDashboardData':
        return obtenerDatosDashboard();
      
      case 'dashboard/kpis':
        return obtenerKPIs();
      
      case 'dashboard/actividades_por_area':
        return obtenerActividadesPorArea();
      
      case 'dashboard/avance_temporal':
        return obtenerAvanceTemporal();
      
      case 'dashboard/indicadores':
        return obtenerResumenIndicadores();
      
      case 'dashboard/alertas':
        return obtenerAlertas();
      
      case 'dashboard/resumen_ejecutivo':
        return obtenerResumenEjecutivo();
      
      default:
        return formatResponse(false, null, '', `Endpoint de dashboard '${path}' no reconocido`);
    }
    
  } catch (error) {
    console.error('Error en handleDashboardRequest:', error);
    return handleError(error, 'handleDashboardRequest');
  }
}

// ==================== FUNCIONES DE DATOS PRINCIPALES ====================

/**
 * Obtiene todos los datos principales del dashboard en una sola llamada
 * @returns {Object} Respuesta con KPIs, gráficos y resúmenes
 */
function obtenerDatosDashboard() {
  try {
    const datos = {
      kpis: calcularKPIsPrincipales(),
      actividadesPorArea: calcularActividadesPorArea(),
      avanceTemporal: calcularAvanceTemporal(),
      indicadores: calcularResumenIndicadores(),
      alertas: generarAlertas(),
      ultimaActualizacion: getCurrentTimestamp()
    };

    return formatResponse(true, datos, 'Datos del dashboard obtenidos exitosamente');

  } catch (error) {
    console.error('Error obteniendo datos del dashboard:', error);
    return handleError(error, 'obtenerDatosDashboard');
  }
}

/**
 * Calcula y devuelve los KPIs principales
 * @returns {Object} Respuesta con KPIs calculados
 */
function obtenerKPIs() {
  try {
    const kpis = calcularKPIsPrincipales();
    return formatResponse(true, kpis, 'KPIs calculados exitosamente');
    
  } catch (error) {
    return handleError(error, 'obtenerKPIs');
  }
}

// ==================== CÁLCULOS DE KPIS ====================

/**
 * Calcula los KPIs principales del sistema
 * @returns {Object} KPIs calculados
 */
function calcularKPIsPrincipales() {
  try {
    // Obtener todas las actividades usando la nueva API
    const activitiesResponse = getAllActivities();
    if (!activitiesResponse.success) {
      throw new Error('Error obteniendo actividades para KPIs');
    }

    const actividades = activitiesResponse.data;
    const totalActividades = actividades.length;

    // Calcular estadísticas por estado
    const estadisticas = {
      total: totalActividades,
      planeadas: actividades.filter(a => a.estado === 'Planeada').length,
      enProceso: actividades.filter(a => a.estado === 'En Progreso').length,
      completadas: actividades.filter(a => a.estado === 'Completada').length,
      suspendidas: actividades.filter(a => a.estado === 'Suspendida').length,
      canceladas: actividades.filter(a => a.estado === 'Cancelada').length
    };

    // Calcular presupuesto
    const presupuestoTotal = actividades.reduce((sum, a) => {
      const presupuesto = parseFloat(a.presupuesto_programado) || 0;
      return sum + presupuesto;
    }, 0);

    // Calcular porcentajes
    const porcentajeAvance = totalActividades > 0 ? 
      Math.round((estadisticas.completadas / totalActividades) * 100) : 0;

    return {
      totalActividades: totalActividades,
      actividadesCompletadas: estadisticas.completadas,
      actividadesEnProceso: estadisticas.enProceso,
      actividadesPendientes: estadisticas.planeadas,
      actividadesSuspendidas: estadisticas.suspendidas,
      porcentajeAvance: porcentajeAvance,
      presupuestoTotal: presupuestoTotal,
      estadisticasPorEstado: estadisticas,
      fechaCalculo: getCurrentTimestamp()
    };

  } catch (error) {
    console.error('Error calculando KPIs principales:', error);
    return {
      totalActividades: 0,
      actividadesCompletadas: 0,
      actividadesEnProceso: 0,
      actividadesPendientes: 0,
      porcentajeAvance: 0,
      presupuestoTotal: 0,
      error: error.message
    };
  }
}

// ==================== FUNCIONES DE ACTIVIDADES POR ÁREA ====================

/**
 * Obtiene distribución de actividades por área
 * @returns {Object} Respuesta con datos de actividades por área
 */
function obtenerActividadesPorArea() {
  try {
    const datos = calcularActividadesPorArea();
    return formatResponse(true, datos, 'Actividades por área calculadas exitosamente');
    
  } catch (error) {
    return handleError(error, 'obtenerActividadesPorArea');
  }
}

/**
 * Calcula distribución de actividades por área
 * @returns {Array} Array de objetos con datos por área
 */
function calcularActividadesPorArea() {
  try {
    // Obtener actividades usando nueva API
    const activitiesResponse = getAllActivities();
    if (!activitiesResponse.success) {
      throw new Error('Error obteniendo actividades');
    }

    // Obtener áreas desde el catálogo unificado
    const areasResponse = getCatalogByType('area');
    if (!areasResponse.success) {
      throw new Error('Error obteniendo catálogo de áreas');
    }

    const actividades = activitiesResponse.data;
    const areas = areasResponse.data;

    // Crear mapa de áreas
    const areaMap = {};
    areas.forEach(area => {
      areaMap[area.code] = {
        codigo: area.code,
        nombre: area.label,
        totalActividades: 0,
        completadas: 0,
        enProceso: 0,
        planeadas: 0,
        presupuesto: 0
      };
    });

    // Procesar actividades
    actividades.forEach(actividad => {
      if (actividad.subproceso_id) {
        // Buscar área padre del subproceso
        const subprocesoResponse = getCatalogByCode(actividad.subproceso_id);
        if (subprocesoResponse.success && subprocesoResponse.data.parent_code) {
          const areaCode = subprocesoResponse.data.parent_code;
          
          if (areaMap[areaCode]) {
            areaMap[areaCode].totalActividades++;
            
            switch (actividad.estado) {
              case 'Completada':
                areaMap[areaCode].completadas++;
                break;
              case 'En Progreso':
                areaMap[areaCode].enProceso++;
                break;
              case 'Planeada':
                areaMap[areaCode].planeadas++;
                break;
            }
            
            const presupuesto = parseFloat(actividad.presupuesto_programado) || 0;
            areaMap[areaCode].presupuesto += presupuesto;
          }
        }
      }
    });

    // Convertir a array y calcular porcentajes
    const resultado = Object.values(areaMap).map(area => ({
      ...area,
      porcentajeAvance: area.totalActividades > 0 ? 
        Math.round((area.completadas / area.totalActividades) * 100) : 0
    }));

    return resultado.sort((a, b) => b.totalActividades - a.totalActividades);

  } catch (error) {
    console.error('Error calculando actividades por área:', error);
    return [];
  }
}

// ==================== FUNCIONES DE AVANCE TEMPORAL ====================

/**
 * Obtiene datos de avance temporal
 * @returns {Object} Respuesta con datos temporales
 */
function obtenerAvanceTemporal() {
  try {
    const datos = calcularAvanceTemporal();
    return formatResponse(true, datos, 'Avance temporal calculado exitosamente');
    
  } catch (error) {
    return handleError(error, 'obtenerAvanceTemporal');
  }
}

/**
 * Calcula avance temporal de actividades
 * @returns {Array} Datos de avance por período
 */
function calcularAvanceTemporal() {
  try {
    // Obtener actividades
    const activitiesResponse = getAllActivities();
    if (!activitiesResponse.success) {
      return [];
    }

    // Obtener períodos desde catálogo
    const bimestresResponse = getCatalogByType('bimestre');
    const bimestres = bimestresResponse.success ? bimestresResponse.data : [];

    const actividades = activitiesResponse.data;
    const avancePorMes = {};

    // Inicializar meses del año actual
    const añoActual = new Date().getFullYear();
    for (let mes = 1; mes <= 12; mes++) {
      const fechaMes = `${añoActual}-${mes.toString().padStart(2, '0')}`;
      avancePorMes[fechaMes] = {
        mes: fechaMes,
        planeadas: 0,
        completadas: 0,
        enProceso: 0
      };
    }

    // Procesar actividades por fecha de creación y estado
    actividades.forEach(actividad => {
      const fechaCreacion = actividad.creado_el;
      if (fechaCreacion) {
        const fechaMes = fechaCreacion.substring(0, 7); // YYYY-MM
        
        if (avancePorMes[fechaMes]) {
          switch (actividad.estado) {
            case 'Completada':
              avancePorMes[fechaMes].completadas++;
              break;
            case 'En Progreso':
              avancePorMes[fechaMes].enProceso++;
              break;
            default:
              avancePorMes[fechaMes].planeadas++;
          }
        }
      }
    });

    return Object.values(avancePorMes).sort((a, b) => a.mes.localeCompare(b.mes));

  } catch (error) {
    console.error('Error calculando avance temporal:', error);
    return [];
  }
}

// ==================== FUNCIONES DE INDICADORES ====================

/**
 * Obtiene resumen de indicadores
 * @returns {Object} Respuesta con resumen de indicadores
 */
function obtenerResumenIndicadores() {
  try {
    const datos = calcularResumenIndicadores();
    return formatResponse(true, datos, 'Resumen de indicadores calculado exitosamente');
    
  } catch (error) {
    return handleError(error, 'obtenerResumenIndicadores');
  }
}

/**
 * Calcula resumen de indicadores
 * @returns {Object} Resumen de indicadores
 */
function calcularResumenIndicadores() {
  try {
    // Obtener actividades
    const activitiesResponse = getAllActivities();
    if (!activitiesResponse.success) {
      return {};
    }

    // Obtener indicadores desde catálogo
    const indicadoresResponse = getCatalogByType('indicador');
    const indicadores = indicadoresResponse.success ? indicadoresResponse.data : [];

    const actividades = activitiesResponse.data;
    const resumenIndicadores = {};

    // Inicializar indicadores
    indicadores.forEach(indicador => {
      resumenIndicadores[indicador.code] = {
        codigo: indicador.code,
        nombre: indicador.label,
        totalActividades: 0,
        metaCumplida: 0,
        enProceso: 0
      };
    });

    // Procesar actividades
    actividades.forEach(actividad => {
      if (actividad.indicador_id && resumenIndicadores[actividad.indicador_id]) {
        resumenIndicadores[actividad.indicador_id].totalActividades++;
        
        if (actividad.estado === 'Completada') {
          resumenIndicadores[actividad.indicador_id].metaCumplida++;
        } else if (actividad.estado === 'En Progreso') {
          resumenIndicadores[actividad.indicador_id].enProceso++;
        }
      }
    });

    // Calcular porcentajes
    Object.values(resumenIndicadores).forEach(indicador => {
      indicador.porcentajeCumplimiento = indicador.totalActividades > 0 ?
        Math.round((indicador.metaCumplida / indicador.totalActividades) * 100) : 0;
    });

    return resumenIndicadores;

  } catch (error) {
    console.error('Error calculando resumen de indicadores:', error);
    return {};
  }
}

// ==================== FUNCIONES DE ALERTAS ====================

/**
 * Obtiene alertas del sistema
 * @returns {Object} Respuesta con alertas
 */
function obtenerAlertas() {
  try {
    const alertas = generarAlertas();
    return formatResponse(true, alertas, 'Alertas generadas exitosamente');
    
  } catch (error) {
    return handleError(error, 'obtenerAlertas');
  }
}

/**
 * Genera alertas del sistema
 * @returns {Array} Array de alertas
 */
function generarAlertas() {
  try {
    const alertas = [];
    
    // Obtener actividades
    const activitiesResponse = getAllActivities();
    if (!activitiesResponse.success) {
      return alertas;
    }

    const actividades = activitiesResponse.data;
    const hoy = new Date();

    // Alertas de actividades vencidas
    const actividadesVencidas = actividades.filter(a => {
      if (a.fecha_fin_planeada && a.estado !== 'Completada') {
        const fechaFin = new Date(a.fecha_fin_planeada);
        return fechaFin < hoy;
      }
      return false;
    });

    if (actividadesVencidas.length > 0) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Actividades Vencidas',
        mensaje: `${actividadesVencidas.length} actividades han superado su fecha límite`,
        cantidad: actividadesVencidas.length,
        prioridad: 'alta'
      });
    }

    // Alertas de actividades próximas a vencer
    const proximasAVencer = actividades.filter(a => {
      if (a.fecha_fin_planeada && a.estado !== 'Completada') {
        const fechaFin = new Date(a.fecha_fin_planeada);
        const diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
        return diasRestantes > 0 && diasRestantes <= 7;
      }
      return false;
    });

    if (proximasAVencer.length > 0) {
      alertas.push({
        tipo: 'info',
        titulo: 'Actividades Próximas a Vencer',
        mensaje: `${proximasAVencer.length} actividades vencen en los próximos 7 días`,
        cantidad: proximasAVencer.length,
        prioridad: 'media'
      });
    }

    // Alertas de actividades sin presupuesto
    const sinPresupuesto = actividades.filter(a => 
      !a.presupuesto_programado || parseFloat(a.presupuesto_programado) === 0
    );

    if (sinPresupuesto.length > 0) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Actividades sin Presupuesto',
        mensaje: `${sinPresupuesto.length} actividades no tienen presupuesto asignado`,
        cantidad: sinPresupuesto.length,
        prioridad: 'baja'
      });
    }

    return alertas;

  } catch (error) {
    console.error('Error generando alertas:', error);
    return [];
  }
}

// ==================== FUNCIONES DE RESUMEN EJECUTIVO ====================

/**
 * Obtiene resumen ejecutivo
 * @returns {Object} Respuesta con resumen ejecutivo
 */
function obtenerResumenEjecutivo() {
  try {
    const resumen = generarResumenEjecutivo();
    return formatResponse(true, resumen, 'Resumen ejecutivo generado exitosamente');
    
  } catch (error) {
    return handleError(error, 'obtenerResumenEjecutivo');
  }
}

/**
 * Genera resumen ejecutivo
 * @returns {Object} Resumen ejecutivo
 */
function generarResumenEjecutivo() {
  try {
    const kpis = calcularKPIsPrincipales();
    const actividadesPorArea = calcularActividadesPorArea();
    
    // Área con más actividades
    const areaMasActiva = actividadesPorArea.reduce((max, area) => 
      area.totalActividades > (max?.totalActividades || 0) ? area : max, null
    );

    // Área con mejor desempeño
    const areaMejorDesempeño = actividadesPorArea.reduce((max, area) => 
      area.porcentajeAvance > (max?.porcentajeAvance || 0) ? area : max, null
    );

    return {
      kpis: {
        totalActividades: kpis.totalActividades,
        porcentajeAvance: kpis.porcentajeAvance,
        presupuestoTotal: kpis.presupuestoTotal
      },
      areas: {
        masActiva: areaMasActiva,
        mejorDesempeño: areaMejorDesempeño,
        totalAreas: actividadesPorArea.length
      },
      fechaGeneracion: getCurrentTimestamp(),
      periodo: `Año ${new Date().getFullYear()}`
    };

  } catch (error) {
    console.error('Error generando resumen ejecutivo:', error);
    return {};
  }
}