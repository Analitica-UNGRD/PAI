import { showLoaderDuring, hideLoader } from "../lib/loader.js";

const DEFAULT_APPS_SCRIPT = (typeof window !== "undefined" && window.APP_CONFIG?.APPS_SCRIPT_URL)
  ? window.APP_CONFIG.APPS_SCRIPT_URL
  : "https://script.google.com/macros/s/AKfycbxBj5ae8whf6pg2pY588V-TecItxK6fz5j5lBXLHFRUXHLHhPYEVisygRwhMCN6ogRoUw/exec";
const DEFAULT_DEV_PROXY = (typeof window !== "undefined" && window.APP_CONFIG?.LOCAL_PROXY_URL)
  ? window.APP_CONFIG.LOCAL_PROXY_URL
  : "http://localhost:3000/api";
const LOCAL_PROXY_FLAG_KEY = (typeof window !== "undefined" && window.APP_CONFIG?.LOCAL_PROXY_FLAG_KEY)
  ? window.APP_CONFIG.LOCAL_PROXY_FLAG_KEY
  : "USE_LOCAL_PROXY";

function shouldUseTextPlain(url) {
  try {
    if (!url) return false;
    if (!/^https?:\/\//.test(url)) return false;
    const parsed = new URL(url, window.location.href);
    const host = parsed.hostname || "";
    return host.endsWith("script.google.com") || host.endsWith("googleusercontent.com");
  } catch (err) {
    return false;
  }
}

function resolveBackendUrl() {
  try {
    if (window.APP_CONFIG_OVERRIDE?.BASE_URL) return window.APP_CONFIG_OVERRIDE.BASE_URL;
    if (window.APP_CONFIG?.BASE_URL) return window.APP_CONFIG.BASE_URL;
    const host = window.location?.hostname;
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(host)) {
      let useLocalProxy = false;
      try {
        useLocalProxy = localStorage.getItem(LOCAL_PROXY_FLAG_KEY) === "true";
      } catch (storageErr) {
        useLocalProxy = false;
      }
      return useLocalProxy ? DEFAULT_DEV_PROXY : DEFAULT_APPS_SCRIPT;
    }
  } catch (err) {
    console.warn("[admin] No se pudo resolver BACKEND: usando Apps Script", err);
  }
  return DEFAULT_APPS_SCRIPT;
}

function getCurrentUserEmail() {
  try {
    const email = localStorage.getItem("auth_email");
    if (email && email.includes("@")) return email;
    const token = localStorage.getItem("auth_token");
    if (token && token !== "null") {
      const decoded = atob(token);
      const parts = decoded.split("|");
      if (parts.length && parts[0].includes("@")) return parts[0];
    }
  } catch (err) {
    console.warn("[admin] No fue posible obtener email de usuario", err);
  }
  return "usuario@gestiondelriesgo.gov.co";
}

function safeJsonParse(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function formatDateShort(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch (err) {
    return String(value);
  }
}

class AdminDashboard {
  constructor() {
    this.backendUrl = resolveBackendUrl();
    this.catalogoActual = "";
    this.catalogosCache = [];
    this.actividades = [];
    this.avances = [];
    this.panelLoaded = {
      actividades: false,
      avances: false
    };

    this.catalogKeyMap = {
      area: ["area", "areas"],
      areas: ["area", "areas"],
      subproceso: ["subproceso", "subprocesos"],
      subprocesos: ["subproceso", "subprocesos"],
      objetivo: ["objetivo", "objetivos"],
      estrategia: ["estrategia", "estrategias"],
      linea: ["linea", "lineas"],
      indicador: ["indicador", "indicadores"],
      plan: ["plan", "planes"],
      fuente: ["fuente", "fuentes"],
      bimestre: ["bimestre", "bimestres"],
      mipg: ["mipg"]
    };
    this.catalogoRefs = {
      tipo: document.getElementById("catalogo-tipo"),
      refrescar: document.getElementById("catalogo-refrescar"),
      exportar: document.getElementById("catalogo-exportar"),
      contador: document.getElementById("catalogo-contador"),
      tablaBody: document.getElementById("catalogo-tabla-body"),
      form: document.getElementById("catalogo-form"),
      formTitulo: document.getElementById("catalogo-form-titulo"),
      formStatus: document.getElementById("catalogo-form-status"),
      formReset: document.getElementById("catalogo-form-reset"),
      eliminar: document.getElementById("catalogo-eliminar"),
      inputs: {
        id: document.getElementById("catalogo-id"),
        idDisplay: document.getElementById("catalogo-id-display"),
        code: document.getElementById("catalogo-code"),
        label: document.getElementById("catalogo-label"),
        parent: document.getElementById("catalogo-parent"),
        sortOrder: document.getElementById("catalogo-sort-order"),
        activo: document.getElementById("catalogo-activo"),
        updatedAt: document.getElementById("catalogo-updated-at")
      }
    };

    this.actividadRefs = {
      refrescar: document.getElementById("actividades-recargar"),
      buscar: document.getElementById("actividades-buscar"),
      resumen: document.getElementById("actividades-resumen"),
      tablaBody: document.getElementById("actividades-tabla-body"),
      form: document.getElementById("actividades-form"),
      formTitulo: document.getElementById("actividad-form-titulo"),
      formStatus: document.getElementById("actividad-form-status"),
      limpiar: document.getElementById("actividad-limpiar"),
      eliminar: document.getElementById("actividad-eliminar"),
      inputs: {
        id: document.getElementById("actividad-id"),
        codigo: document.getElementById("actividad-codigo"),
        estado: document.getElementById("actividad-estado"),
        descripcion: document.getElementById("actividad-descripcion"),
        meta: document.getElementById("actividad-meta"),
        responsable: document.getElementById("actividad-responsable"),
        raw: document.getElementById("actividad-detalle")
      }
    };

    this.avanceRefs = {
      refrescar: document.getElementById("avances-recargar"),
      buscar: document.getElementById("avances-buscar"),
      resumen: document.getElementById("avances-resumen"),
      tablaBody: document.getElementById("avances-tabla-body"),
      form: document.getElementById("avances-form"),
      formTitulo: document.getElementById("avance-form-titulo"),
      formStatus: document.getElementById("avance-form-status"),
      limpiar: document.getElementById("avance-limpiar"),
      eliminar: document.getElementById("avance-eliminar"),
      inputs: {
        id: document.getElementById("avance-id"),
        actividad: document.getElementById("avance-actividad"),
        bimestre: document.getElementById("avance-bimestre"),
        fecha: document.getElementById("avance-fecha"),
        reportado: document.getElementById("avance-reportado"),
        raw: document.getElementById("avance-detalle")
      }
    };

    this.bindEvents();
    this.setupAutoLoadPanels();
    console.log("[admin] Panel administrativo listo. Backend:", this.backendUrl);
  }

  async callBackend(path, payload = {}, { method = "POST", loaderMessage = "Procesando...", loaderStyle = "solid", minDuration = 350 } = {}) {
    const exec = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const usePlain = shouldUseTextPlain(this.backendUrl);
        let response;
        if (method === "GET") {
          const qs = new URLSearchParams({ path, payload: JSON.stringify(payload || {}) });
          const url = `${this.backendUrl}?${qs.toString()}`;
          response = await fetch(url, { method: "GET", signal: controller.signal });
        } else {
          const headers = usePlain
            ? { "Content-Type": "text/plain;charset=UTF-8", Accept: "application/json" }
            : { "Content-Type": "application/json", Accept: "application/json" };
          response = await fetch(this.backendUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ path, payload }),
            signal: controller.signal
          });
        }
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status} - ${response.statusText}${text ? ` | ${text}` : ""}`);
        }
        const text = await response.text();
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch (err) {
          console.warn("[admin] Respuesta no JSON para", path, text);
          return { success: response.ok, raw: text };
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    if (loaderMessage === null) {
      return exec();
    }

    const loaderFn = (typeof window !== "undefined" && window.APP_LOADER && typeof window.APP_LOADER.showLoaderDuring === "function")
      ? window.APP_LOADER.showLoaderDuring.bind(window.APP_LOADER)
      : showLoaderDuring;

    const message = loaderMessage || "Procesando...";
    return loaderFn(exec, message, loaderStyle, minDuration);
  }

  bindEvents() {
    // Catalogo
    this.catalogoRefs.tipo?.addEventListener("change", () => {
      if (this.catalogoRefs.tipo.value) {
        this.loadCatalogo(this.catalogoRefs.tipo.value);
      }
    });
    this.catalogoRefs.refrescar?.addEventListener("click", () => {
      if (!this.catalogoRefs.tipo?.value) {
        this.setCatalogoStatus("Selecciona un tipo de catalogo primero", "warn");
        return;
      }
      this.loadCatalogo(this.catalogoRefs.tipo.value);
    });
    this.catalogoRefs.exportar?.addEventListener("click", () => {
      if (!this.catalogosCache.length) {
        this.setCatalogoStatus("No hay datos para exportar", "warn");
        return;
      }
      const blob = new Blob([JSON.stringify(this.catalogosCache, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `catalogo_${this.catalogoActual || "general"}_${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    this.catalogoRefs.form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      this.persistCatalogo();
    });
    this.catalogoRefs.formReset?.addEventListener("click", () => this.resetCatalogoForm());
    this.catalogoRefs.eliminar?.addEventListener("click", () => this.deleteCatalogo());

    // Actividades
    this.actividadRefs.refrescar?.addEventListener("click", () => this.loadActividades());
    this.actividadRefs.buscar?.addEventListener("input", (ev) => this.renderActividades(ev.currentTarget.value));
    this.actividadRefs.form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      this.persistActividad();
    });
    this.actividadRefs.limpiar?.addEventListener("click", () => this.resetActividadForm());
    this.actividadRefs.eliminar?.addEventListener("click", () => this.deleteActividad());

    // Avances
    this.avanceRefs.refrescar?.addEventListener("click", () => this.loadAvances());
    this.avanceRefs.buscar?.addEventListener("input", (ev) => this.renderAvances(ev.currentTarget.value));
    this.avanceRefs.form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      this.persistAvance();
    });
    this.avanceRefs.limpiar?.addEventListener("click", () => this.resetAvanceForm());
    this.avanceRefs.eliminar?.addEventListener("click", () => this.deleteAvance());
  }

  setupAutoLoadPanels() {
    const actividadesPanel = document.getElementById("actividades-tabla")?.closest("details");
    const avancesPanel = document.getElementById("avances-tabla")?.closest("details");

    const ensureLoaded = async (panel, key, loader) => {
      if (!panel) return;
      const loadIfNeeded = () => {
        if (panel.open && !this.panelLoaded[key]) {
          this.panelLoaded[key] = true;
          loader.call(this).catch((err) => {
            console.error(`[admin] Error cargando ${key}`, err);
            this.panelLoaded[key] = false;
          });
        }
      };
      panel.addEventListener("toggle", loadIfNeeded, { passive: true });
      if (panel.open) {
        loadIfNeeded();
      }
    };

    ensureLoaded(actividadesPanel, "actividades", this.loadActividades);
    ensureLoaded(avancesPanel, "avances", this.loadAvances);
  }

  setCatalogoStatus(message, variant = "info") {
    if (!this.catalogoRefs.formStatus) return;
    const colors = {
      info: "text-indigo-600",
      warn: "text-yellow-600",
      error: "text-red-600",
      success: "text-emerald-600"
    };
    this.catalogoRefs.formStatus.textContent = message || "";
    this.catalogoRefs.formStatus.className = `text-xs ${colors[variant] || colors.info}`;
  }

  setActividadStatus(message, variant = "info") {
    if (!this.actividadRefs.formStatus) return;
    const colors = {
      info: "text-indigo-600",
      warn: "text-yellow-600",
      error: "text-red-600",
      success: "text-emerald-600"
    };
    this.actividadRefs.formStatus.textContent = message || "";
    this.actividadRefs.formStatus.className = `text-xs ${colors[variant] || colors.info}`;
  }

  setAvanceStatus(message, variant = "info") {
    if (!this.avanceRefs.formStatus) return;
    const colors = {
      info: "text-indigo-600",
      warn: "text-yellow-600",
      error: "text-red-600",
      success: "text-emerald-600"
    };
    this.avanceRefs.formStatus.textContent = message || "";
    this.avanceRefs.formStatus.className = `text-xs ${colors[variant] || colors.info}`;
  }
  normalizeCatalogList(response, tipo, { silent = false } = {}) {
    if (!response) return [];
    if (response.success === false) {
      if (!silent) {
        console.warn("[admin] Respuesta sin exito al obtener catalogo", response);
      }
      return [];
    }
    const data = (typeof response.data !== "undefined") ? response.data : response;
    const items = this.getCatalogItemsFromData(data, tipo);
    return items.map((item) => this.normalizeCatalogItem(item, tipo)).filter((item) => item.label || item.code);
  }

  getCatalogItemsFromData(data, tipo) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data !== "object") return [];
    const key = (tipo || "").toLowerCase();
    const candidates = this.catalogKeyMap[key] || [key, `${key}s`];
    for (const candidate of candidates) {
      if (candidate && Array.isArray(data[candidate])) {
        return data[candidate];
      }
    }
    const aggregated = [];
    Object.values(data).forEach((value) => {
      if (Array.isArray(value)) aggregated.push(...value);
    });
    if (!aggregated.length) return [];
    if (!key) return aggregated;
    return aggregated.filter((item) => (item?.catalogo || item?.type || "").toLowerCase() === key);
  }

  normalizeCatalogItem(raw = {}, tipo) {
    if (!raw || typeof raw !== "object") {
      return {
        raw,
        id: "",
        code: "",
        label: "",
        parent_code: "",
        description: "",
        sort_order: null,
        is_active: true,
        updated_at: "",
        extra: null,
        catalogo: (tipo || raw?.catalogo || "").toLowerCase()
      };
    }
    const type = (tipo || raw.catalogo || raw.type || "").toLowerCase();
    const dynamicIdKey = type ? `${type}_id` : null;
    const dynamicCodeKey = type ? `${type}_codigo` : null;
    const dynamicNameKey = type ? `${type}_nombre` : null;

    const codeKeys = [
      "code",
      "codigo",
      "catalogo_codigo",
      "catalogo_id",
      dynamicCodeKey,
      dynamicIdKey,
      "id",
      "_id",
      "uuid",
      "area_codigo",
      "indicador_codigo"
    ].filter(Boolean);

    const labelKeys = [
      "label",
      "nombre",
      "titulo",
      dynamicNameKey,
      "descripcion",
      "descripcion_larga",
      "descripcion_actividad",
      "nombre_largo",
      "nombre_catalogo"
    ].filter(Boolean);

    let code = "";
    for (const key of codeKeys) {
      if (key && raw[key]) {
        code = raw[key];
        break;
      }
    }

    let label = "";
    for (const key of labelKeys) {
      if (key && raw[key]) {
        label = raw[key];
        break;
      }
    }

    let parentCode = raw.parent_code || raw.parent || raw.parentCode || raw.parentcode || raw.parent_id || raw.parentId || "";
    if (!parentCode) {
      if (type === "subproceso" && raw.area_id) {
        parentCode = raw.area_id;
      } else if (type === "estrategia" && (raw.objetivo_id || raw.objetivo_codigo)) {
        parentCode = raw.objetivo_id || raw.objetivo_codigo;
      } else if (type === "linea" && (raw.estrategia_id || raw.estrategia_codigo)) {
        parentCode = raw.estrategia_id || raw.estrategia_codigo;
      } else if (type === "indicador" && (raw.plan_id || raw.plan_codigo)) {
        parentCode = raw.plan_id || raw.plan_codigo;
      } else if (raw.area_id && type !== "area") {
        parentCode = raw.area_id;
      }
    }

    const description = raw.description || raw.descripcion || raw.detalle || raw.nota || "";
    const sortOrderRaw = raw.sort_order ?? raw.sortOrder ?? raw.order ?? raw.orden ?? raw.index ?? raw.position;
    const updatedAtRaw = raw.updated_at || raw.updatedAt || raw.updated_at_utc || raw.updated || raw.fecha_actualizacion || raw.modified_at || raw.created_at || "";

    let extra = raw.extra || raw.metadata || raw.meta || raw.datos || raw.raw || null;
    if (typeof extra === "string") {
      const parsed = safeJsonParse(extra, null);
      if (parsed && typeof parsed === "object") {
        extra = parsed;
      }
    }

    let sort_order = null;
    if (sortOrderRaw !== undefined && sortOrderRaw !== null && sortOrderRaw !== "") {
      const numericValue = Number(sortOrderRaw);
      sort_order = Number.isNaN(numericValue) ? sortOrderRaw : numericValue;
    }

    const is_active = this.coerceBoolean(raw.is_active ?? raw.activo ?? raw.estado ?? raw.habilitado ?? true, true);
    const idValue = raw.id || raw._id || raw.uuid || raw.catalogo_id || raw.catalogoId || "";

    return {
      raw,
      id: idValue || (typeof code === "string" ? code : ""),
      code: String(code || "").trim(),
      label: String(label || "").trim(),
      parent_code: String(parentCode || "").trim(),
      description: String(description || "").trim(),
      sort_order,
      is_active,
      updated_at: updatedAtRaw || "",
      extra: extra && typeof extra === "object" ? extra : null,
      catalogo: type || ""
    };
  }

  coerceBoolean(value, fallback = true) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "si", "activo", "activa", "habilitado"].includes(normalized)) return true;
    if (["false", "0", "no", "inactivo", "inactiva", "deshabilitado"].includes(normalized)) return false;
    return fallback;
  }

  buildCatalogPayloadFromForm() {
    const refs = this.catalogoRefs?.inputs || {};
    let code = refs.code?.value ? refs.code.value.trim() : "";
    if (!code) {
      code = this.generateNextCode();
      if (refs.code) refs.code.value = code;
    }
    const label = refs.label?.value ? refs.label.value.trim() : "";
    if (!label) {
      throw new Error('Nombre es obligatorio');
    }
    const parent = refs.parent?.value ? refs.parent.value.trim() : "";
    const sortInput = refs.sortOrder ? refs.sortOrder : null;
    let sortOrder = null;
    if (sortInput) {
      const raw = sortInput.value ? sortInput.value.trim() : '';
      if (raw) {
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
          throw new Error('Orden debe ser un numero valido');
        }
        sortOrder = parsed;
      }
    }
    if (sortOrder === null) {
      sortOrder = this.generateNextSortOrder();
      if (sortInput) sortInput.value = sortOrder;
    }
    const payload = {
      catalogo: this.catalogoActual,
      code,
      label,
      parent_code: parent || '',
      is_active: refs.activo ? Boolean(refs.activo.checked) : true,
      sort_order: sortOrder
    };
    return payload;
  }

  sanitizeLegacyPayload(data) {
    const sanitized = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) return;
      if (value === null) {
        sanitized[key] = null;
        return;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          if (key == 'parent_code') {
            sanitized[key] = '';
          }
          return;
        }
        sanitized[key] = trimmed;
        return;
      }
      sanitized[key] = value;
    });
    return sanitized;
  }
  generateCatalogId() {
    const rawType = (this.catalogoActual || 'CAT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const prefix = rawType.slice(0, 4) || 'CAT';
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}_${stamp}${random}`;
  }

  generateNextSortOrder() {
    if (!Array.isArray(this.catalogosCache) || !this.catalogosCache.length) {
      return 1;
    }
    const values = this.catalogosCache
      .map((item) => Number(item.sort_order ?? item.order ?? item.orden))
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return this.catalogosCache.length + 1;
    }
    return Math.max(...values) + 1;
  }

  generateNextCode() {
    const prefix = (this.catalogoActual || 'CAT').toUpperCase();
    const existing = new Set(
      (this.catalogosCache || [])
        .map((item) => (item && item.code ? String(item.code).toUpperCase() : ''))
        .filter(Boolean)
    );

    let max = 0;
    (this.catalogosCache || []).forEach((item) => {
      const code = item && item.code ? String(item.code) : '';
      const match = code.match(/(\d+)(?!.*\d)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > max) {
          max = num;
        }
      }
    });

    let next = max + 1;
    let candidate = `${prefix}_${String(next).padStart(3, '0')}`;
    while (existing.has(candidate.toUpperCase())) {
      next += 1;
      candidate = `${prefix}_${String(next).padStart(3, '0')}`;
    }
    return candidate;
  }

  populateParentOptions(selectedCode = '') {
    const select = this.catalogoRefs?.inputs?.parent;
    if (!select) return;

    const previous = selectedCode || select.value || '';
    select.innerHTML = '';

    const baseOption = document.createElement('option');
    baseOption.value = '';
    baseOption.textContent = 'Sin padre / raíz';
    select.appendChild(baseOption);

    const items = (this.catalogosCache || [])
      .filter((item) => item && item.code)
      .map((item) => ({
        code: String(item.code),
        label: item.label || item.description || item.code
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    const usedCodes = new Set();
    items.forEach((item) => {
      if (usedCodes.has(item.code)) return;
      usedCodes.add(item.code);
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = `${item.code} — ${item.label}`.trim();
      if (item.code === previous) option.selected = true;
      select.appendChild(option);
    });

    if (previous && select.value !== previous) {
      const fallbackOption = document.createElement('option');
      fallbackOption.value = previous;
      fallbackOption.textContent = previous;
      fallbackOption.selected = true;
      fallbackOption.dataset.fallback = '1';
      select.appendChild(fallbackOption);
    }
  }


  async loadCatalogo(tipo) {
    if (!tipo) {
      this.catalogoActual = "";
      this.catalogosCache = [];
      this.renderCatalogo();
      this.setCatalogoStatus("Selecciona un tipo de catalogo primero", "warn");
      return;
    }
    this.catalogoActual = tipo;
    this.setCatalogoStatus("Cargando datos...");
    try {
      let registros = [];
      let primaryError = null;
      try {
        const primary = await this.callBackend("catalog/getByType", { type: tipo, includeInactive: true }, { loaderMessage: "Sincronizando catalogo" });
        if (primary?.success === false) {
          primaryError = new Error(primary.error || primary.message || "Endpoint catalog/getByType no disponible");
        } else {
          registros = this.normalizeCatalogList(primary, tipo, { silent: true });
        }
      } catch (err) {
        primaryError = err;
      }

      if (!registros.length) {
        const legacy = await this.callBackend("getCatalogos", {}, { method: "GET", loaderMessage: null });
        registros = this.normalizeCatalogList(legacy, tipo, { silent: Boolean(primaryError) });
      }

      if (!registros.length && primaryError) {
        console.warn("[admin] No se pudo usar catalog/getByType, se uso getCatalogos:", primaryError.message || primaryError);
      }

      this.catalogosCache = registros;
      this.populateParentOptions();
      this.resetCatalogoForm();
      this.renderCatalogo();
      if (registros.length) {
        this.setCatalogoStatus(`${registros.length} elemento(s) listos`, "success");
      } else {
        this.setCatalogoStatus("Sin datos para este catalogo.", "warn");
      }
    } catch (err) {
      console.error("[admin] Error al cargar catalogo", err);
      this.catalogosCache = [];
      this.renderCatalogo();
      this.setCatalogoStatus(`Error al cargar catalogo: ${err.message}`, "error");
    }
  }

  renderCatalogo() {
    if (!this.catalogoRefs.tablaBody) return;
    const body = this.catalogoRefs.tablaBody;
    body.innerHTML = "";
    if (!this.catalogosCache.length) {
      body.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500">Sin datos para este catalogo.</td></tr>`;
      this.catalogoRefs.contador.textContent = "0 elementos";
      return;
    }
    this.catalogoRefs.contador.textContent = `${this.catalogosCache.length} elemento(s)`;
    const fragment = document.createDocumentFragment();
    this.catalogosCache.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50";
      const estadoBadge = item.is_active
        ? '<span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Activo</span>'
        : '<span class="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-600">Inactivo</span>';
      const descripcion = item.description || "";
      const updated = item.updated_at ? formatDateShort(item.updated_at) : "";
      tr.innerHTML = `
        <td class="px-4 py-2 font-mono text-xs text-gray-700">${item.code || "&mdash;"}</td>
        <td class="px-4 py-2 text-sm text-gray-800" title="${descripcion.replace(/"/g, '&quot;')}">${item.label || "Sin nombre"}</td>
        <td class="px-4 py-2 text-xs text-gray-500">${item.parent_code || ""}</td>
        <td class="px-4 py-2 text-xs text-gray-500">${item.sort_order ?? ""}</td>
        <td class="px-4 py-2 text-xs">${estadoBadge}</td>
        <td class="px-4 py-2 text-xs text-gray-500">${updated || ""}</td>
        <td class="px-4 py-2 text-right">
          <button class="catalogo-editar inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-[var(--primary-color)] hover:border-indigo-300">
            <span class="material-icons text-sm">edit</span>Editar
          </button>
        </td>`;
      tr.querySelector(".catalogo-editar")?.addEventListener("click", () => this.populateCatalogoForm(item));
      fragment.appendChild(tr);
    });
    body.appendChild(fragment);
  }

  populateCatalogoForm(item) {
    if (!item) return;
    const payload = item.raw && typeof item.raw === "object" ? item.raw : item;
    const id = item.id || payload.id || payload._id || "";
    if (this.catalogoRefs.inputs.id) {
      this.catalogoRefs.inputs.id.value = id;
      this.catalogoRefs.inputs.id.dataset.generated = id || this.generateCatalogId();
    }
    if (this.catalogoRefs.inputs.idDisplay) {
      this.catalogoRefs.inputs.idDisplay.value = id || "Nuevo (auto)";
    }
    const codeValue = item.code || payload.code || payload.catalogo_id || payload.catalogo_codigo || "";
    if (this.catalogoRefs.inputs.code) {
      this.catalogoRefs.inputs.code.value = codeValue || this.generateNextCode();
    }
    if (this.catalogoRefs.inputs.label) {
      this.catalogoRefs.inputs.label.value = item.label || payload.label || payload.nombre || "";
    }
    const parentCode = item.parent_code || payload.parent_code || payload.parent || payload.parentCode || payload.area_id || "";
    this.populateParentOptions(parentCode);
    if (this.catalogoRefs.inputs.parent) {
      this.catalogoRefs.inputs.parent.value = parentCode || "";
    }
    if (this.catalogoRefs.inputs.sortOrder) {
      const sortValue = item.sort_order ?? payload.sort_order ?? payload.order ?? payload.orden;
      this.catalogoRefs.inputs.sortOrder.value = Number.isFinite(sortValue) ? sortValue : "";
    }
    if (this.catalogoRefs.inputs.activo) {
      this.catalogoRefs.inputs.activo.checked = item.is_active !== false;
    }
    if (this.catalogoRefs.inputs.updatedAt) {
      const rawDate = item.updated_at || payload.updated_at || payload.updated || payload.fecha_actualizacion || "";
      if (rawDate) {
        this.catalogoRefs.inputs.updatedAt.value = formatDateShort(rawDate);
        this.catalogoRefs.inputs.updatedAt.dataset.raw = rawDate;
      } else {
        this.catalogoRefs.inputs.updatedAt.value = "";
        delete this.catalogoRefs.inputs.updatedAt.dataset.raw;
      }
    }
    this.catalogoRefs.formTitulo.textContent = "Editar entrada de catalogo";
    this.catalogoRefs.eliminar.classList.remove("hidden");
    this.setCatalogoStatus("Editando entrada seleccionada", "info");
  }

  resetCatalogoForm() {
    const refs = this.catalogoRefs?.inputs || {};
    this.catalogoRefs.form?.reset();
    if (refs.id) {
      refs.id.value = "";
    }
    const generatedId = this.generateCatalogId();
    if (refs.id) {
      refs.id.dataset.generated = generatedId;
    }
    if (this.catalogoRefs.inputs.idDisplay) {
      this.catalogoRefs.inputs.idDisplay.value = generatedId;
    }
    if (refs.code) {
      refs.code.value = this.generateNextCode();
    }
    if (refs.sortOrder) {
      refs.sortOrder.value = this.generateNextSortOrder();
    }
    this.populateParentOptions();
    if (refs.activo) {
      refs.activo.checked = true;
    }
    if (refs.updatedAt) {
      const nowIso = new Date().toISOString();
      refs.updatedAt.value = formatDateShort(nowIso);
      refs.updatedAt.dataset.raw = nowIso;
    }
    this.catalogoRefs.formTitulo.textContent = "Agregar entrada";
    this.catalogoRefs.eliminar.classList.add("hidden");
    this.setCatalogoStatus("Formulario listo para nuevo registro", "info");
  }

  async persistCatalogo() {
    if (!this.catalogoActual) {
      this.setCatalogoStatus("Selecciona un tipo de catalogo antes de guardar", "warn");
      return;
    }

    let basePayload;
    try {
      basePayload = this.buildCatalogPayloadFromForm();
    } catch (validationError) {
      this.setCatalogoStatus(validationError.message, "warn");
      return;
    }

    const idInput = this.catalogoRefs.inputs.id;
    const idDisplay = this.catalogoRefs.inputs.idDisplay;
    let id = idInput?.value ? idInput.value.trim() : "";
    const isUpdate = Boolean(id);
    const loaderMessage = isUpdate ? "Actualizando catalogo" : "Creando catalogo";
    const userEmail = getCurrentUserEmail();
    const nowIso = new Date().toISOString();

    if (!isUpdate) {
      id = id || idInput?.dataset.generated || this.generateCatalogId();
      if (idInput) {
        idInput.dataset.generated = id;
      }
      if (idDisplay) {
        idDisplay.value = id;
      }
      basePayload.id = id;
    } else if (id) {
      basePayload.id = id;
    }
    basePayload.updated_at = nowIso;
    if (this.catalogoRefs.inputs.updatedAt) {
      this.catalogoRefs.inputs.updatedAt.value = formatDateShort(nowIso);
      this.catalogoRefs.inputs.updatedAt.dataset.raw = nowIso;
    }

    if (basePayload.sort_order == null) {
      basePayload.sort_order = this.generateNextSortOrder();
      if (this.catalogoRefs.inputs.sortOrder) {
        this.catalogoRefs.inputs.sortOrder.value = basePayload.sort_order;
      }
    }

    const primaryPath = isUpdate ? "catalog/update" : "catalog/create";
    const primaryPayload = isUpdate
      ? { id, data: { ...basePayload, catalogo: this.catalogoActual, usuario: userEmail } }
      : { ...basePayload, usuario: userEmail };
    const legacyPayload = this.sanitizeLegacyPayload({ ...basePayload, id, usuario: userEmail });

    try {
      this.setCatalogoStatus(isUpdate ? "Guardando cambios..." : "Creando registro...", "info");
      let response;
      try {
        response = await this.callBackend(primaryPath, primaryPayload, { loaderMessage });
        if (response?.success === false) {
          const message = response?.error || response?.message || "";
          if (/no reconocido|not recognized|unknown endpoint/i.test(message)) {
            response = await this.callBackend("catalogo_unificado/guardar", legacyPayload, { loaderMessage });
          }
        }
      } catch (err) {
        const msg = String(err?.message || "");
        if (/no reconocido|Endpoint/i.test(msg)) {
          response = await this.callBackend("catalogo_unificado/guardar", legacyPayload, { loaderMessage });
        } else {
          throw err;
        }
      }

      if (response?.success === false) {
        throw new Error(response.error || response.message || "No fue posible guardar");
      }

      this.setCatalogoStatus(isUpdate ? "Cambios guardados correctamente" : "Elemento creado", "success");
      await this.loadCatalogo(this.catalogoActual);
      this.resetCatalogoForm();
    } catch (err) {
      console.error("[admin] Error guardando catalogo", err);
      this.setCatalogoStatus(`No se pudo guardar: ${err.message}` , "error");
    } finally {
      hideLoader();
    }
  }

  async deleteCatalogo() {
    const id = this.catalogoRefs.inputs.id.value;
    if (!id) {
      this.setCatalogoStatus("Selecciona un registro a eliminar", "warn");
      return;
    }
    if (!confirm("Eliminar esta entrada del catalogo?")) return;
    try {
      this.setCatalogoStatus("Eliminando registro...", "info");
      let response;
      try {
        response = await this.callBackend("catalog/delete", { id }, { loaderMessage: "Eliminando" });
        if (response?.success === false) {
          const message = response?.error || response?.message || "";
          if (/no reconocido|not recognized|unknown endpoint/i.test(message)) {
            response = await this.callBackend("catalogo_unificado/eliminar", { id, catalogo: this.catalogoActual, usuario: getCurrentUserEmail() }, { loaderMessage: "Eliminando" });
          }
        }
      } catch (err) {
        const msg = String(err?.message || "");
        if (/no reconocido|Endpoint/i.test(msg)) {
          response = await this.callBackend("catalogo_unificado/eliminar", { id, catalogo: this.catalogoActual, usuario: getCurrentUserEmail() }, { loaderMessage: "Eliminando" });
        } else {
          throw err;
        }
      }

      if (response?.success === false) {
        throw new Error(response.error || response.message || "No fue posible eliminar");
      }

      this.setCatalogoStatus("Registro eliminado", "success");
      await this.loadCatalogo(this.catalogoActual);
      this.resetCatalogoForm();
    } catch (err) {
      console.error("[admin] Error eliminando catalogo", err);
      this.setCatalogoStatus(`No se pudo eliminar: ${err.message}` , "error");
    } finally {
      hideLoader();
    }
  }

  async loadActividades() {
    this.setActividadStatus("Cargando actividades...");
    try {
      const response = await this.callBackend("actividades/obtener", { incluir_catalogos: false }, { loaderMessage: "Obteniendo actividades" });
      const items = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
      this.actividades = items;
      this.renderActividades(this.actividadRefs.buscar?.value || "");
      this.setActividadStatus(`${items.length} actividad(es) disponibles`, "success");
    } catch (err) {
      console.error("[admin] Error cargando actividades", err);
      this.actividades = [];
      this.renderActividades("");
      this.setActividadStatus(`No se pudieron cargar actividades: ${err.message}`, "error");
      this.panelLoaded.actividades = false;
    }
  }

  renderActividades(filterText = "") {
    if (!this.actividadRefs.tablaBody) return;
    const term = (filterText || "").toLowerCase();
    const list = this.actividades.filter((item) => {
      if (!term) return true;
      const values = [
        item?.actividad_id,
        item?.descripcion_actividad,
        item?.area,
        item?.estado,
        item?.responsable
      ];
      return values.some((val) => val && String(val).toLowerCase().includes(term));
    });
    this.actividadRefs.resumen.textContent = `${list.length} actividad(es)`;
    const body = this.actividadRefs.tablaBody;
    body.innerHTML = "";
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">Sin resultados con el filtro actual.</td></tr>`;
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50";
      tr.innerHTML = `
        <td class="px-3 py-2 font-mono text-xs text-gray-600">${item.actividad_id || item.id || "&mdash;"}</td>
        <td class="px-3 py-2 text-sm text-gray-800">${item.descripcion_actividad || item.descripcion || "Sin descripci?n"}</td>
        <td class="px-3 py-2 text-xs text-gray-500">${item.area || item.area_nombre || ""}</td>
        <td class="px-3 py-2"><span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">${item.estado || "Sin estado"}</span></td>
        <td class="px-3 py-2 text-xs text-gray-500">${item.responsable || item.reportado_por || ""}</td>
        <td class="px-3 py-2 text-right">
          <button class="actividad-editar inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-[var(--primary-color)] hover:border-indigo-300">
            <span class="material-icons text-sm">edit</span>Editar
          </button>
        </td>`;
      tr.querySelector(".actividad-editar")?.addEventListener("click", () => this.populateActividadForm(item));
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }

  populateActividadForm(item) {
    if (!item) return;
    const inputs = this.actividadRefs.inputs;
    inputs.id.value = item.id || item.actividad_id || "";
    inputs.codigo.value = item.actividad_id || item.id || "";
    inputs.estado.value = item.estado || "";
    inputs.descripcion.value = item.descripcion_actividad || item.descripcion || "";
    inputs.meta.value = item.meta || item.meta_anual || "";
    inputs.responsable.value = item.responsable || item.reportado_por || "";
    inputs.raw.value = JSON.stringify(item, null, 2);
    this.actividadRefs.eliminar.classList.remove("hidden");
    this.actividadRefs.formTitulo.textContent = "Editar actividad seleccionada";
    this.setActividadStatus("Editando actividad", "info");
  }

  resetActividadForm() {
    this.actividadRefs.form?.reset();
    this.actividadRefs.inputs.raw.value = "";
    this.actividadRefs.eliminar.classList.add("hidden");
    this.actividadRefs.formTitulo.textContent = "Editar actividad seleccionada";
    this.setActividadStatus("Formulario limpio", "info");
  }

  async persistActividad() {
    const inputs = this.actividadRefs.inputs;
    const id = inputs.id.value || inputs.codigo.value;
    if (!id) {
      this.setActividadStatus("Selecciona primero una actividad", "warn");
      return;
    }
    const baseDatos = safeJsonParse(inputs.raw.value || "{}");
    const datos = {
      ...baseDatos,
      actividad_id: id,
      descripcion_actividad: inputs.descripcion.value.trim() || baseDatos.descripcion_actividad || "",
      estado: inputs.estado.value || baseDatos.estado || "",
      meta: inputs.meta.value || baseDatos.meta || baseDatos.meta_anual || "",
      responsable: inputs.responsable.value || baseDatos.responsable || baseDatos.reportado_por || ""
    };
    const payload = {
      id,
      datos,
      usuario: getCurrentUserEmail(),
      email: getCurrentUserEmail()
    };
    try {
      this.setActividadStatus("Guardando cambios...");
      const response = await this.callBackend("actividades/actualizar", payload, { loaderMessage: "Sincronizando actividad" });
      if (response?.success === false) {
        throw new Error(response.error || response.message || "No fue posible guardar");
      }
      this.setActividadStatus("Actividad actualizada", "success");
      await this.loadActividades();
    } catch (err) {
      console.error("[admin] Error actualizando actividad", err);
      this.setActividadStatus(`Error: ${err.message}`, "error");
    } finally {
      hideLoader();
    }
  }

  async deleteActividad() {
    const id = this.actividadRefs.inputs.id.value;
    if (!id) {
      this.setActividadStatus("Selecciona la actividad a eliminar", "warn");
      return;
    }
    if (!confirm("Eliminar esta actividad?")) return;
    try {
      this.setActividadStatus("Eliminando actividad...");
      const response = await this.callBackend("actividades/eliminar", { id, usuario: getCurrentUserEmail() }, { loaderMessage: "Eliminando" });
      if (response?.success === false) {
        throw new Error(response.error || response.message || "No fue posible eliminar");
      }
      this.setActividadStatus("Actividad eliminada", "success");
      await this.loadActividades();
      this.resetActividadForm();
    } catch (err) {
      console.error("[admin] Error eliminando actividad", err);
      this.setActividadStatus(`Error: ${err.message}`, "error");
    } finally {
      hideLoader();
    }
  }
  async loadAvances() {
    this.setAvanceStatus("Cargando avances...");
    try {
      let response;
      try {
        response = await this.callBackend("avances/obtener", {}, { loaderMessage: "Obteniendo avances" });
      } catch (primaryErr) {
        console.warn("[admin] Endpoint avances/obtener no disponible, usando avances/listar", primaryErr);
        response = await this.callBackend("avances/listar", {}, { loaderMessage: "Obteniendo avances" });
      }
      const items = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
      this.avances = items;
      this.renderAvances(this.avanceRefs.buscar?.value || "");
      this.setAvanceStatus(`${items.length} registro(s)`, "success");
    } catch (err) {
      console.error("[admin] Error cargando avances", err);
      this.avances = [];
      this.renderAvances("");
      this.setAvanceStatus(`No se pudieron cargar avances: ${err.message}`, "error");
      this.panelLoaded.avances = false;
    }
  }

  renderAvances(filterText = "") {
    if (!this.avanceRefs.tablaBody) return;
    const term = (filterText || "").toLowerCase();
    const list = this.avances.filter((item) => {
      if (!term) return true;
      const values = [
        item?.avance_id,
        item?.actividad_id,
        item?.descripcion_actividad,
        item?.reportado_por,
        item?.estado
      ];
      return values.some((val) => val && String(val).toLowerCase().includes(term));
    });
    this.avanceRefs.resumen.textContent = `${list.length} registro(s)`;
    const body = this.avanceRefs.tablaBody;
    body.innerHTML = "";
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">Sin resultados con el filtro actual.</td></tr>`;
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50";
      tr.innerHTML = `
        <td class="px-3 py-2 font-mono text-xs text-gray-600">${item.avance_id || item.id || "&mdash;"}</td>
        <td class="px-3 py-2 text-sm text-gray-800">${item.actividad_id || item.actividad || ""}</td>
        <td class="px-3 py-2 text-xs text-gray-500">${item.bimestre_id || item.bimestre || ""}</td>
        <td class="px-3 py-2 text-xs text-gray-500">${item.reportado_por || item.responsable || ""}</td>
        <td class="px-3 py-2 text-xs text-gray-500">${formatDateShort(item.fecha_reporte || item.fecha || item.created_at)}</td>
        <td class="px-3 py-2 text-right">
          <button class="avance-editar inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-[var(--primary-color)] hover:border-indigo-300">
            <span class="material-icons text-sm">edit</span>Editar
          </button>
        </td>`;
      tr.querySelector(".avance-editar")?.addEventListener("click", () => this.populateAvanceForm(item));
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }

  populateAvanceForm(item) {
    if (!item) return;
    const inputs = this.avanceRefs.inputs;
    const extras = { ...item };
    inputs.id.value = item.avance_id || item.id || "";
    inputs.actividad.value = item.actividad_id || item.actividad || "";
    inputs.bimestre.value = item.bimestre_id || item.bimestre || "";
    inputs.fecha.value = formatDateShort(item.fecha_reporte || item.fecha || extras.created_at || "");
    inputs.reportado.value = item.reportado_por || item.responsable || "";
    delete extras.avance_id;
    delete extras.id;
    if (inputs.raw) inputs.raw.value = JSON.stringify(extras, null, 2);
    this.avanceRefs.eliminar.classList.remove("hidden");
    this.avanceRefs.formTitulo.textContent = "Editar avance seleccionado";
    this.setAvanceStatus("Editando avance", "info");
  }

  resetAvanceForm() {
    this.avanceRefs.form?.reset();
    if (this.avanceRefs.inputs.raw) this.avanceRefs.inputs.raw.value = "";
    this.avanceRefs.eliminar.classList.add("hidden");
    this.avanceRefs.formTitulo.textContent = "Editar avance seleccionado";
    this.setAvanceStatus("Formulario limpio", "info");
  }

  async persistAvance() {
    const inputs = this.avanceRefs.inputs;
    const id = inputs.id.value;
    if (!id) {
      this.setAvanceStatus("Selecciona un avance para modificar", "warn");
      return;
    }
    const baseDatos = safeJsonParse(inputs.raw.value || "{}");
    const payload = {
      avance_id: id,
      actividad_id: inputs.actividad.value || baseDatos.actividad_id,
      bimestre_id: inputs.bimestre.value || baseDatos.bimestre_id,
      fecha_reporte: inputs.fecha.value || baseDatos.fecha_reporte,
      reportado_por: inputs.reportado.value || baseDatos.reportado_por,
      datos: {
        ...baseDatos,
        avances_texto: baseDatos.avances_texto || baseDatos.avance || baseDatos.descripcion || ""
      },
      usuario: getCurrentUserEmail()
    };
    try {
      this.setAvanceStatus("Guardando avance...");
      const response = await this.callBackend("avances/actualizar", payload, { loaderMessage: "Actualizando avance" });
      if (response?.success === false) {
        throw new Error(response.error || response.message || "No fue posible actualizar");
      }
      this.setAvanceStatus("Avance actualizado", "success");
      await this.loadAvances();
    } catch (err) {
      console.error("[admin] Error actualizando avance", err);
      this.setAvanceStatus(`Error: ${err.message}`, "error");
    } finally {
      hideLoader();
    }
  }

  async deleteAvance() {
    const id = this.avanceRefs.inputs.id.value;
    if (!id) {
      this.setAvanceStatus("Selecciona el avance que deseas eliminar", "warn");
      return;
    }
    if (!confirm("Eliminar este registro de avance?")) return;
    try {
      this.setAvanceStatus("Eliminando avance...");
      const response = await this.callBackend("avances/eliminar", { id, usuario: getCurrentUserEmail() }, { loaderMessage: "Eliminando avance" });
      if (response?.success === false) {
        throw new Error(response.error || response.message || "No fue posible eliminar");
      }
      this.setAvanceStatus("Avance eliminado", "success");
      await this.loadAvances();
      this.resetAvanceForm();
    } catch (err) {
      console.error("[admin] Error eliminando avance", err);
      this.setAvanceStatus(`Error: ${err.message}`, "error");
    } finally {
      hideLoader();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.adminDashboard = new AdminDashboard();
});




