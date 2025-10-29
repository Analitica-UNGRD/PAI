# README — src/pages_scripts

Este README documenta los archivos situados directamente en `src/pages_scripts/` (no incluye subcarpetas). Contiene por cada archivo:
- Propósito y responsabilidad
- Resumen de contenido y dependencias
- Elementos/IDs del DOM referenciados (cuando aplicable)
- Ejemplos de comportamiento (basados en el código)
- Consideraciones y recomendaciones específicas derivadas del código leído

Archivos cubiertos (top-level):
- `login-page.js`
- `dashboard.js`
- `avance.js`
- `actividades.js`
- `admin.js`

---

## `login-page.js`

Propósito
- Controlador completo para la página de autenticación. Valida el formulario, gestiona el envío de credenciales, muestra mensajes y monta un carrusel de slides.

Resumen y dependencias
- Importa: `Auth` desde `../lib/auth.js`, `UI` desde `../lib/ui.js` y funciones de `../lib/loader.js` (p. ej. `showLoaderDuring`, `showLoader`).
- Implementa una clase `LoginPage` que inicializa listeners, valida campos, maneja el submit y controla un carrusel automático.

IDs y selectores importantes referenciados
- `#loginForm` — formulario principal.
- `#email` — campo de correo.
- `#password` — campo contraseña.
- `#emailError`, `#passwordError` — contenedores de mensajes de error por campo.
- `#carouselSlides`, `#carouselDots` — contenedores del carrusel (slides y puntos).

Comportamiento observado / ejemplos
- Validación local: el email se valida con una expresión regular y la contraseña debe tener al menos 3 caracteres.
- Flujo de login (simplificado):
  1. Al submit: se previene el envío por defecto, se limpian errores y se valida.
  2. Si es válido, se llama `Auth.login(email, password)` envuelto en `showLoaderDuring(...)`.
  3. Se espera un objeto `result` con al menos `result.success` (boolean) y opcionalmente `result.message`.
  4. Si `result.success` es true: muestra mensaje de éxito y redirige a `./dashboard.html` después de mostrar loaders breves.
  5. Si falla: muestra `UI.showMessage(...)`, habilita el formulario y marca campos erróneos.

Forma esperada de respuesta de `Auth.login` (inferida)
- Al menos: `{ success: boolean, message?: string, ... }`.

Recomendaciones y consideraciones específicas
- Manejo de errores de red: ya se muestra un mensaje genérico, pero conviene distinguir errores de red de errores del backend para dar feedback más accionable.
- Seguridad: evitar logs en consola con información sensible; el archivo no imprime credenciales pero sí imprime errores genéricos (ok).
- UX: el método `setFormEnabled(false)` reemplaza el texto del botón con "Iniciando sesión..."; añadir aria-busy/aria-live para usuarios de lectores de pantalla mejora accesibilidad.
- Robustez: agregar un timeout o límite de reintentos para el login para evitar intentos infinitos en caso de servicios lentos.
- Tests: crear pruebas unitarias (JSDOM) para: validación de email, comportamiento de `setFormEnabled`, y manejo de `result.success` true/false.

---

## `dashboard.js`

Propósito y estado actual
- Archivo mantenido por compatibilidad. Su contenido actual se limita a una advertencia y un re-export/import del módulo moderno.

Contenido observado
- Imprime un `console.warn` indicando que el módulo `pages_scripts/avance.js` está obsoleto y luego importa `./avances/index.js`.

Consideraciones y recomendaciones específicas
- Si tu proyecto ya migró la lógica a `pages_scripts/avances/index.js`, este archivo puede mantenerse como shim para no romper referencias antiguas.
- Documentar en el README del proyecto que `dashboard.js`/`avance.js` son shims para evitar confusión.

---

## `avance.js`

Propósito y estado actual
- Archivo de compatibilidad que reexporta la implementación modular actual (ubicada en `pages_scripts/avances/index.js`).

Contenido observado
- Este archivo contiene un `console.warn` que indica que está obsoleto y ejecuta `import './avances/index.js'`.

Consideraciones específicas
- Mantener este archivo evita romper referencias antiguas (p. ej. HTML que sigue incluyendo `avance.js`).
- Cuando se depreque por completo, actualizar las páginas HTML para apuntar directamente al nuevo entrypoint.

---

## `actividades.js`

Propósito
- Entry point que carga la versión modularizada más reciente de la lógica de actividades.

Contenido observado
- Import simple: `import './actividades/index.js';` y un `console.log` indicando que el módulo se cargó.

Consideraciones específicas
- El archivo es deliberadamente mínimo: toda la lógica reside en la subcarpeta `actividades/`. Esto es correcto desde el punto de vista modular, pero implica que la documentación y tests deben apuntar a la carpeta interna.
- Para propósitos de este README (sin entrar en subcarpetas), anotar que la responsabilidad aquí es solo montar el módulo.

Recomendación
- Si dependes de mapas de sourcemap o bundling, confirmar que el bundler/copier incluya `actividades/index.js` y sus dependencias.

---

## `admin.js`

Propósito
- Entry point mínimo para cargar la versión modular del panel de administración.

Contenido observado
- Contiene `import './admin/index.js';` y nada más.

Consideraciones específicas
- Igual que `actividades.js`: la lógica real está en la subcarpeta `admin/`.
- Asegurar que las referencias HTML apunten a este entrypoint para no romper compatibilidad.

---

## Observaciones generales (derivadas de los archivos leídos)

- Muchos archivos top-level son "shims" o entrypoints que delegan la implementación a subcarpetas. Esto es una buena práctica para mantener el punto de entrada estable, pero exige mantener sincronizados los imports en las páginas HTML.
- La página de login contiene la mayor parte de la lógica visible en este nivel y es la que necesita más pruebas unitarias y verificaciones de seguridad/UX.
- Los módulos usan importaciones relativas; por tanto, al servir las páginas en desarrollo usa un servidor que soporte ESM (no `file://`).

Pruebas y validación sugeridas (concrete)
- Login: pruebas JSDOM para validar reglas de formulario y comportamiento en `result.success` true/false.
- Entrypoints: prueba de integración que carga `actividades.js` y `admin.js` y verifica que no lanzan errores (puede hacerse con un pequeño harness que importe los módulos en Node + JSDOM / esbuild + vm).

Ejemplos de contratos inferidos
- `Auth.login(email, password)` -> devuelve al menos `{ success: boolean, message?: string }`.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.
