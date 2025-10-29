## Documentación de `src/styles` (archivos top-level)

Este documento describe los archivos CSS que se encuentran directamente en `src/styles` (sin incluir subcarpetas). Incluye propósito, selectores/variables importantes, ejemplos de uso y recomendaciones de mantenimiento.

Archivos cubiertos:
- `actividades.css`
- `avance.css`
- `dashboard.css` (vacío)
- `layout.css`
- `loader.css`
- `login.css`
- `sidebar.css`

---

## Resumen general

La carpeta `src/styles` contiene hojas de estilo organizadas por página/feature. Hay varios patrones repetidos (por ejemplo estilos de `modern-select`, `modern-date`, animaciones y utilidades) que se repiten entre `actividades.css` y `avance.css` — conviene consolidarlos en un archivo compartido (p. ej. `components.css` o `controls.css`).

Se usan variables CSS locales en algunos archivos (por ejemplo `--sidebar-width`, `--primary-color` y `--avance-accent`) pero no existe un único archivo de tokens/variables globales — sería recomendable centralizarlas.

---

### actividades.css

Propósito
- Estilos específicos de la página de Actividades: formularios, tabla, tarjeta de actividades, selects y datepickers "modern". También contiene controles de ortografía, animaciones y utilidades (loading, tooltip, validación).

Selectores / fragmentos importantes
- Formulario: `#form-actividad`, `#actividad-form`, `.descripcion-actividad-editor`, `.descripcion-ortografia-panel`.
- Modern controls: `.modern-select`, `.modern-select__trigger`, `.modern-select__dropdown`, `.modern-date`, `.modern-multiselect`.
- Tarjetas: `#actividades-grid`, `.activity-card`, `.activity-card h3`.
- Tabla: `#tabla-actividades`, `.estado-badge` y clases de estado (`.estado-planeado`, `.estado-en-ejecucion`, ...).
- Utilidades: `.loading`, `.campo-error`, `.campo-valido`, `.fade-in-up`, `.pulse`, `.tooltip`.

Puntos clave y ejemplos
- Modern select: para usar el control consistente con JS, la estructura esperada es:

  <div class="modern-select" id="my-select">
    <select class="modern-select__native"> ... </select>
    <button class="modern-select__trigger" type="button">
      <span class="modern-select__label modern-select__label--placeholder">Selecciona</span>
      <span class="modern-select__chevron material-symbols-outlined">expand_more</span>
    </button>
    <div class="modern-select__dropdown"> ... </div>
  </div>

- Modern date similarmente espera `.modern-date` con una `input` nativa posicionada en `.modern-date__native`.

- Para resaltar errores en inputs el proyecto usa `.campo-error` y `.campo-valido` (aplican box-shadow y border-color con !important en algunos casos).

Observaciones específicas
- Contiene reglas para `prefers-reduced-motion` en animaciones de cards/modal.
- Maneja barras de scroll estilizadas para dropdowns y listas.

Recomendaciones
- Extraer `modern-select`, `modern-date` y `modern-multiselect` a un archivo compartido para evitar duplicación con `avance.css`.
- Evitar uso de `!important` salvo en casos justificados (hoy se usa en `.campo-error`).

---

### avance.css

Propósito
- Estilos de la página Avances: tabla de avances, chips de estado, componentes de performance y comportamientos visuales de la tabla.

Selectores / fragmentos importantes
- Utilidades tipográficas: `.long-number`, `.long-number-inline`.
- Controles compartidos: `.modern-select`, `.modern-date` (duplicados aquí — ver recomendación anterior).
- Performance: `.avance-performance`, sus variantes `.avance-performance--superado`, `--en-ruta`, `--en-riesgo`, `--sin-meta`.
- Estado/Chips: `.status-chip` y sus variantes `--pending`, `--review`, `--approved`, etc.

Puntos clave y ejemplos
- Marcar el estado visual de performance en la fila de la tabla:

  <div class="avance-performance avance-performance--en-ruta">
    <div class="avance-performance__bar">
      <span class="avance-performance__bar-fill" style="width:60%"></span>
    </div>
  </div>

- Uso de `.long-number` para números tabulares y evitar saltos en columnas.

Observaciones específicas
- Duplica estilos de `modern-select` y `modern-date` que ya están en `actividades.css`.

Recomendaciones
- Consolidar estilos compartidos. Mantener `avance.css` centrado en estilos únicos de la vista de avances (performance, chips, tabla) y delegar controles a un archivo común.

---

### dashboard.css

Estado actual
- Archivo vacío (no contiene reglas). Probablemente reservado para estilos específicos del dashboard o quedó sin implementar.

Recomendaciones
- Si no se usa: eliminar o mantener con un comentario indicando propósito futuro.
- Si el dashboard necesita estilos, mover reglas relacionadas desde otros CSS a este archivo para mantener separación por features.

---

### layout.css

Propósito
- Helpers de layout para la aplicación: grid con sidebar y main, variables para controlar ancho del sidebar, gestión de overflow y comportamientos responsivos.

Selectores / variables importantes
- Variables en :root: `--sidebar-width`, `--sidebar-expanded-width`.
- Clases clave: `.layout-with-sidebar`, `body.sidebar-expanded`, `body.sidebar-pinned`.

Puntos clave
- La estrategia usa variables CSS para permitir que JS cambie la anchura del sidebar mediante clases en `body` (`sidebar-expanded`, `sidebar-pinned`).
- `main` se transforma con `translateX` para animaciones suaves cuando el sidebar cambia.

Recomendaciones
- Documentar en JS el contrato: qué clases en `body` afectan layout y qué variables deben ajustarse (`--sidebar-offset`, `--sidebar-collapsed-w`).
- Asegurar que los scripts que manipulan el sidebar actualicen también `aria` attributes para accesibilidad (p. ej. `aria-expanded` en botón de toggle).

---

### loader.css

Propósito
- Estilos del loader de la aplicación (`.app-loader`), con variantes: blocking, toast, inline. Animaciones de texto/efecto y backdrop.

Selectores / fragmentos importantes
- `.app-loader`, `.app-loader--blocking`, `.app-loader--toast`, `.app-loader--inline`.
- Efecto tipográfico `letter` y keyframe `fill-effect` para animaciones de logo.

Ejemplo de uso

  <div class="app-loader app-loader--blocking">
    <div class="app-loader__backdrop"></div>
    <div class="app-loader__inner">
      <div class="loader"><span class="letter">P</span><span class="letter">A</span>...</div>
    </div>
  </div>

Recomendaciones
- Evitar usar `pointer-events: none` en el contenedor si se quiere permitir interacciones en loaders no bloqueantes; usar las variantes `--blocking` / `--inline` apropiadamente.
- Considerar reducir el tamaño de la fuente o animación en móviles para rendimiento.

---

### login.css

Propósito
- Estilos completos para la vista de login, incluye layout split, fondos animados (gradients), formulario, tarjetas y carousel para la sección visual.

Selectores / fragmentos importantes
- `.main-login-wrapper`, `.login-split-layout`, `.login-form-panel`, `.login-visual-panel`, `.card`, `.input-field`, `.button1`.
- Fondos animados: `.gradient-bg` y `.g1..g5` (usa `mix-blend-mode` y animaciones largas).

Puntos clave y ejemplos
- La estructura recomendada en HTML:

  <div class="main-login-wrapper">
    <div class="gradient-bg"> ... </div>
    <div class="login-split-layout">
      <div class="login-form-panel"> ... form ...</div>
      <div class="login-visual-panel"> ... carousel ...</div>
    </div>
  </div>

Recomendaciones
- Los efectos de blend/filter pueden costar en GPU; asegúrate de medir el rendimiento en dispositivos de gama baja. Añadir `prefers-reduced-motion` fallbacks para usuarios que lo requieran.

---

### sidebar.css

Propósito
- Estilos para el sidebar global (colapso/expansión, animaciones, íconos y áreas inferiores con logout/pin).

Selectores / variables importantes
- Variables: `--sidebar-bg`, `--pin-color`, `--sidebar-collapsed-w`, `--sidebar-expanded-w`.
- Clases: `.sidebar`, `.sidebar.expanded`, `.sidebar.collapsed`, `.menu-label`, `.pin-btn`, `.logout-danger`.

Puntos clave y ejemplos
- HTML esperable:

  <aside class="sidebar">
    <div class="p-6"> ... logo ... <span class="menu-title">App</span></div>
    <nav>
      <ul>
        <li><a href="#"><span class="material-icons">home</span><span class="menu-label">Inicio</span></a></li>
        ...
      </ul>
    </nav>
    <div class="bottom-area">
      <button class="logout-danger">Salir</button>
    </div>
  </aside>

- Para colapsar/expandir, el JS debe alternar `body.sidebar-expanded` o `.sidebar.expanded` / `.sidebar.collapsed`. Las etiquetas `.menu-label` desaparecen visualmente en collapsed.

Recomendaciones
- Centralizar la lógica de apertura/cierre en un único módulo JS que actualice variables CSS y atributos ARIA (ej. `aria-expanded` en el botón de toggle).
- Evitar duplicar transformaciones en `main` y `sidebar` que puedan crear conflictos de stacking context (ya se usa `transform` en `main` y `sidebar` tiene `position: fixed`).

---

## Observaciones generales y recomendaciones

1. Consolidar controles compartidos
- `modern-select`, `modern-date`, `modern-multiselect` y animaciones shared (`modern-select-pop`, `modern-date-pop`, keyframes similares) aparecen repetidos. Moverlos a `src/styles/components.css` o `src/styles/controls.css` y dejar los archivos feature-specific con reglas propias.

2. Centralizar tokens / variables
- Crear `tokens.css` (o `variables.css`) con variables globales: colores (primary, accent), radios, spacing, z-index scale, breakpoints. Esto facilita temas y consistencia.

3. Dashboard vacío
- `dashboard.css` está vacío — confirmar si se necesita o eliminar para evitar ruido.

4. Accesibilidad
- Revisar contrastes de colores (badges, chips y alertas). Muchos gradientes están bien, pero algunos textos en tarjetas y alerts deben cumplir WCAG AA.
- Asegurar `prefers-reduced-motion` en animaciones críticas y ajustar interacciones para usuarios que lo soliciten.

5. Performance y mantenibilidad
- Evitar reglas muy específicas con selectores largos que dificulten override. Emplear clases utilitarias cuando sea posible. Considerar usar PostCSS + purgecss (o configurar build) para eliminar estilos no usados en producción.
- Moderar `z-index` y `backdrop-filter` (costosos en GPU); usarlos con medida.

6. Tests y verificación visual
- Agregar una página de referencia visual (styleguide) con ejemplos de cada componente: modern-select, modal, activity-card, avance-performance, status-chip, loader variants, sidebar collapsed/expanded. Esto ayuda a detectar regresiones visuales.

7. JavaScript <-> CSS contract
- Documentar en README o en comentarios las clases/IDs que JS espera (p. ej. `.sidebar.expanded`, `body.sidebar-expanded`, `app-loader--blocking`, ids de modal y selects). Algunos contratos ya están en los módulos JS (e.g. `state.bindDomReferences()` en `avances`), pero centralizarlos evita roturas.

8. Sugerencia de refactor de bajo riesgo
- Crear `src/styles/components.css` con `modern-select`, `modern-date`, `modern-multiselect`, `.loading`, `.tooltip`, `.status-chip`, `.avance-performance` y eliminar duplicados en `actividades.css` y `avance.css`. Mantener en los archivos feature-specific solo estilos únicos.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.
