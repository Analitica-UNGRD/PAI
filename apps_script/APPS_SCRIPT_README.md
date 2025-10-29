# Apps Script (carpeta `apps_script`)

Este documento describe en detalle los archivos y la lógica contenida en la carpeta `apps_script`. Estos scripts están diseñados para ejecutarse como un Web App de Google Apps Script (doGet/doPost) o como backend invocado por la función proxy (`api/index.js`) del proyecto.

Cada sección describe el propósito del archivo, las funciones principales, el contrato de entrada/salida y ejemplos de payloads para probar los endpoints más relevantes.

---

## Resumen general

- Entrada HTTP principal: `doGet(e)`, `doPost(e)` y `doOptions(e)` están definidos en `03_Backend.gs`.
- El sistema usa un enrutador central (API_ROUTES) que delega a módulos especializados (CatalogManager, ActivityManager, AdvancesManager, DashboardManager, etc.).
- `00_SharedUtils.gs` contiene utilidades y helpers compartidos (formatters, validadores, logging y formato de respuesta).
- Las rutas esperan un objeto JSON con al menos la propiedad `path` y opcional `payload`.

Formato básico esperado en una petición POST al Apps Script (ejemplo genérico):

```json
{
  "path": "catalog/getAll",
  "payload": { "type": "area" }
}
```

Si se despliega como Web App, puede llamarse directamente a la URL del Web App; cuando se invoca por la función proxy del repo, esa función reenvía el mismo objeto JSON.

---

## 00_SharedUtils.gs — Utilidades compartidas

Propósito:
- Centraliza configuración (`SYSTEM_CONFIG`), validaciones, generación de IDs/timestamps, formato de respuestas y manejo de errores.

Funciones clave y comportamiento:
- `SYSTEM_CONFIG` — contiene IDs, nombres de hojas, estados válidos, secretos (obtenidos de Script Properties) y otros parámetros del sistema.
- `generateUUID()`, `generateUniqueId(prefix, useUUID)` — generadores de identificadores usados por otros módulos.
- `getCurrentTimestamp()`, `getCurrentDateOnly()` — timestamps en ISO y fecha simple.
- Validaciones: `isValidEmail`, `isNotEmpty`, `isValidDate`, `isFutureDate`, `isValidOption`.
- `validateActivityData(activity, operation)` — validación central para actividades (usada por ActivityManager).
- `formatResponse(success, data, message, errors, meta)` — devuelve estructura uniforme { success, data, message, errors, meta }.
- `handleError(error, context, additionalData)` — loguea y devuelve respuesta con estructura de error.
- `jsonResponseWithCORS(statusCode, responseData)` — crea un ContentService response y aplica headers CORS (usado por `doGet/doPost` en Backend).

Ejemplo de uso (interno):

```js
// Un handler puede retornar:
return formatResponse(true, { foo: 'bar' }, 'Operación OK');
// Backend convierte ese objeto a JSON y adjunta headers con jsonResponseWithCORS
```

Notas operativas:
- `SYSTEM_CONFIG` lee `SPREADSHEET_ID` y `HMAC_SECRET` desde Script Properties para no hardcodear credenciales.

---

## 01_CatalogManager.gs — Gestión de catálogos unificados

Propósito:
- Implementa CRUD para catálogos en una hoja única con estructura normalizada (headers definidos en `CATALOG_HEADERS`).

Comportamiento principal:
- Define `CATALOG_DEFINITIONS` con tipos (area, subproceso, objetivo, estrategia, linea, indicador, plan, bimestre, mipg, fuente).
- Funciones públicas a través del router:
  - `catalog/getAll` — devuelve todos los catálogos (o de un tipo si se pasa `type`).
  - `catalog/getByType` — atajo a `getAll` filtrado.
  - `catalog/getById` — buscar por `id` (UUID).
  - `catalog/getByCode` — buscar por `code` legible.
  - `catalog/getHierarchy` — construir árbol parent-child a partir de `parent_code`.
  - `catalog/create`, `catalog/update`, `catalog/delete`, `catalog/activate`, `catalog/deactivate` — operaciones de gestión.
  - `catalog/migrate`, `catalog/validate`, `catalog/reorder` — utilidades de mantenimiento.

Validaciones y contratos:
- Para crear: payload debe contener al menos `catalogo` (tipo), `label`. Opcional `code`, `parent_code`, `sort_order`, `is_active`.
- Respuesta estándar: `formatResponse(true, createdItem, 'Elemento creado')` o errores con lista de validaciones.

Ejemplo de payloads:

Crear catálogo:

```json
{
  "path": "catalog/create",
  "payload": {
    "catalogo": "area",
    "label": "Oficina Asesora de Planeación",
    "code": "ARE_OAPI_001"
  }
}
```

Obtener jerarquía:

```json
{
  "path": "catalog/getHierarchy",
  "payload": { "type": "area" }
}
```

Notas:
- `createCatalogItem` asegura unicidad de `code`, genera `id` (UUID) y calcula `sort_order` si no viene.
- Las funciones leen/escriben directamente la hoja `SYSTEM_CONFIG.SHEETS.CATALOG` usando helpers compartidos (p. ej. `getOrCreateCatalogSheet`, `readSheetAsObjects`, `findRowByField`).

---

## 02_ActivityManager.gs — Gestión de actividades

Propósito:
- Implementa CRUD y lógica de negocio para actividades: generación de códigos legibles, secuencias por área/año, validaciones, mapeo de campos y exportes.

Funciones y características clave:
- Encabezados esperados: `ACTIVITY_HEADERS`.
- Generación de código: `generateActivityCode(sheet, context)` utiliza acrónimos de área (`getAreaAcronym` / `buildAcronymSegment`) y secuencias por año (`getNextActivitySequence`).
- Mapeo de formulario: `FORM_FIELD_MAPPING` normaliza nombres de campos enviados por frontend.
- Validación de datos vía `validateActivityData` (desde SharedUtils).
- Endpoints manejados por `handleActivityRequest` (ver router en `03_Backend.gs`): `activities/create`, `activities/getAll`, `activities/getById`, `activities/update`, `activities/delete`, `activities/search`, `activities/report`, `activities/export`, `activities/validate`, `activities/review`.

Ejemplos de payloads:

Crear una actividad (simplificado):

```json
{
  "path": "activities/create",
  "payload": {
    "descripcion_actividad": "Capacitación en gestión de riesgos",
    "subproceso_id": "SUB_ABC_001",
    "linea_id": "LIN_DEF_001",
    "fecha_inicio_planeada": "2026-02-01",
    "fecha_fin_planeada": "2026-03-01",
    "responsable": "juan.perez@ejemplo.com"
  }
}
```

Obtener actividades con filtros:

```json
{
  "path": "activities/getAll",
  "payload": { "filter": { "estado": "Planeada" }, "page": 1, "pageSize": 50 }
}
```

Notas importantes:
- `generateActivityCode` intenta conservar el código actual si la actividad se actualiza y pertenece al mismo área/año; si no, calcula la siguiente secuencia.
- Muchas funciones hacen un intenso uso de `readSheetAsObjects` y `findRowByField` (helpers en SharedUtils o en utilidades compartidas) — esto puede implicar lecturas completas de hoja para búsquedas; optimizar si la hoja crece mucho.

---

## 03_Backend.gs — Router principal y handlers globales

Propósito:
- Punto de entrada HTTP y router central. Define `doGet`, `doPost`, `doOptions` y `processRequest`.

Puntos clave:
- `API_ROUTES` mapea rutas a módulos: `LOCAL`, `CATALOG`, `ACTIVITY`, etc.
- `doPost(e)` parsea `e.postData.contents` y llama a `processRequest(body)`.
- `processRequest` normaliza `path`, resuelve handler y devuelve la respuesta con `jsonResponseWithCORS`.

Rutas locales (ejemplos): `auth/login`, `ping`, `health`, `debug`.

Ejemplo de petición HTTP que llega aquí (desde la función proxy o directamente al Web App):

```json
{
  "path": "activities/create",
  "payload": { "descripcion_actividad": "..." }
}
```

El `Backend` realiza:
- Autenticación centralizada (si se habilita via `requiresAuthentication` en `06_RoutingUtils.gs`).
- Delegación: `routeToHandler('CATALOG', ...)` llama a `handleCatalogRequest` definido en `01_CatalogManager.gs`.

---

## 04_DashboardManager.gs — Cálculo de KPIs y datos para UI

Propósito:
- Calcular KPIs, generar datos agregados para la interfaz de usuario, resumir indicadores, alertas y series temporales.

Funciones expuestas:
- `getDashboardData`, `dashboard/kpis`, `dashboard/actividades_por_area`, `dashboard/avance_temporal`, `dashboard/indicadores`, `dashboard/alertas`, `dashboard/resumen_ejecutivo`.

Ejemplo de llamada:

```json
{ "path": "getDashboardData", "payload": {} }
```

Notas:
- Consume los endpoints internos `getAllActivities` y `getCatalogByType` para construir métricas; en caso de errores de lectura masiva devuelve resultados parciales con errores en el log.

---

## 05_Auth.gs — Autenticación y gestión de usuarios

Propósito:
- Manejar usuarios, creación, listado, login y validación de tokens.

Funciones clave:
- `openSheet()` / `getCredentialsSheet()` — aseguran y normalizan la hoja de usuarios.
- Hashing y salts: `makeSalt`, `sha256`, `makeHash`.
- Tokens HMAC: `makeToken(email)` y `validateToken(token)` usan `SYSTEM_CONFIG.SECURITY.HMAC_SECRET`.
- CRUD: `createUser`, `listUsers`, `deleteUser`, `updateUser` y `loginUser`.

Ejemplo de login:

```json
{ "path": "auth/login", "payload": { "email": "juan@ejemplo.com", "password": "secreto" } }
```

Respuesta esperada en login exitoso:

```json
{
  "success": true,
  "data": {
    "email": "juan@ejemplo.com",
    "role": "contribuidor",
    "token": "...tokenBase64..."
  }
}
```

Notas de seguridad:
- `makeToken` codifica email|timestamp|signature; `validateToken` valida expiración y firma.
- No expone hashes ni salts en `listUsers`.

---

## 06_RoutingUtils.gs — Utilidades de routing

Propósito:
- Funciones auxiliares para limpiar `path`, parsear parámetros y decidir si una ruta requiere autenticación.

Funciones:
- `cleanPath(path)`, `parsePayloadParameter(payloadParam)`, `parseRequestBody(contents)`, `getRouteHandler(path)`, `requiresAuthentication(path)`, `validateAuthentication(payload)`.

Notas:
- `requiresAuthentication` actualmente devuelve `true` para la mayoría de rutas (excepto una lista de públicas). `validateAuthentication` es placeholder y devuelve `true` (permitir) en desarrollo; para producción hay que integrarla con `validateToken` en `05_Auth.gs`.

---

## 07_LegacyHandlers.gs — Compatibilidad con rutas legacy

Propósito:
- Permitir que clientes antiguos sigan funcionando; mapea rutas legacy (`getCatalogos`, `actividades/crear`, etc.) a las funciones modernas.

Ejemplo:

```json
{ "path": "actividades/crear", "payload": { ... } }
```

Este handler reenvía internamente a `activities/create` para mantener compatibilidad.

---

## 08_AdvancesManager.gs — Gestión de avances (stubs y utilidades)

Propósito:
- Handler mínimo para `avances` con implementación parcial: crear, obtener, revisar, eliminar, utilidades de limpieza y reparación de encabezados.

Funciones y detalles:
- `handleAdvancesRoutes` gestiona rutas como `avances/crear`, `avances/obtener`, `avances/revisar`, `avances/eliminar`.
- Define `ADVANCE_HEADERS` con la estructura canónica de la hoja de Avances.
- `crearAvance(datos)` normaliza campos, resuelve bimestre (usando `resolveBimestreMetadataFromPayload`), genera `avance_id` y escribe en hoja.
- `obtenerAvances(filter)` lee la hoja y devuelve objetos normalizados.

Ejemplo de crear avance:

```json
{
  "path": "avances/crear",
  "payload": {
    "actividad_id": "ACT-2025-001",
    "bimestre": "1",
    "logro_valor": 10,
    "presupuesto_ejecutado_bimestre": 1500000,
    "reportado_por": "maria@ejemplo.com"
  }
}
```

Notas:
- Módulo contiene lógica robusta para normalizar inputs con nombres alternativos (p. ej. `bimestre_id`, `bimestreLabel`, `anio`, etc.).
- Actualmente apunta a persistencia en hoja; puede ser extendido a base de datos si se requiere.

---

## 09_BimestresManager.gs — Gestión y utilidades para bimestres

Propósito:
- Definir la estructura canónica de bimestres, normalizar inputs de presupuesto/meta/descripciones y proporcionar helpers para lectura/escritura en la hoja de `Bimestres`.

Funciones y utilidades:
- `BIMESTRES_DEFINITION` — array con etiquetas y aliases por bimestre.
- `ensureBimestresSheet()` / `enforceBimestresStructure(sheet)` — asegura encabezados y estructura.
- Normalizadores: `normalizeBudgetValue`, `normalizeMetaValue`, `normalizeDescriptionValue`, `collectDescripcionFromBimestreInput`.

Ejemplo de lectura de bimestres:

```json
{ "path": "bimestres/getAll", "payload": {} }
```

Nota: En el router principal `API_ROUTES` puede no existir un `bimestres/getAll` explícito; llamar a estos helpers normalmente se hace desde `AdvancesManager` o `ActivityManager`.

---

## Ejemplos prácticos de llamadas (desde la función proxy o directamente al Web App)

1) Obtener catálogos de tipo `area`:

```json
{
  "path": "catalog/getByType",
  "payload": { "type": "area", "includeInactive": false }
}
```

2) Crear actividad:

```json
{
  "path": "activities/create",
  "payload": {
    "descripcion_actividad": "Realizar taller de sensibilización",
    "subproceso_id": "SUB_001",
    "linea_id": "LIN_002",
    "fecha_inicio_planeada": "2026-04-01",
    "fecha_fin_planeada": "2026-04-30",
    "responsable": "ana@ejemplo.com"
  }
}
```

3) Crear avance:

```json
{
  "path": "avances/crear",
  "payload": {
    "actividad_id": "ACT-2026-001",
    "bimestre": "1",
    "logro_valor": 5,
    "presupuesto_ejecutado_bimestre": 500000
  }
}
```

4) Login (obtener token):

```json
{ "path": "auth/login", "payload": { "email": "admin@ejemplo.com", "password": "secreto" } }
```

---

## Consideraciones técnicas y recomendaciones (solo referencia aquí — no cambios automáticos)

- Lectura/escritura con Sheets: muchos handlers usan lectura completa de hojas (readSheetAsObjects). Para grandes volúmenes, considerar paginación, índices o migrar a un almacén más eficiente.
- Seguridad: `validateAuthentication` en `06_RoutingUtils.gs` es un placeholder; integrar con `validateToken` y chequear roles antes de operaciones destructivas.
- Timeouts: las operaciones `fetch` o heavy computation en Apps Script pueden exceder límites; dividir tareas o usar ejecuciones en segundo plano donde haga sentido.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.

