# APLICACIÓN DE PREDIOS

Tablero web para gestión y seguimiento de predios del **Instituto de Desarrollo Urbano (IDU)**: matriz de datos, módulo PAC (seguimiento y alertas de riesgo), gestión de equipos (asignación Articulador/Gestor con RBAC), informes institucionales (PDF/Excel) y auditoría.

## Stack

- **Runtime de la aplicación:** [Google Apps Script](https://developers.google.com/apps-script) (V8), desplegado como Web App vía [`clasp`](https://github.com/google/clasp).
- **Frontend:** `HtmlService`, partials `.html` con `<script>` embebido (sin bundler ni framework — ver `Index.html` + `app_*_js.html`).
- **Datos:** Google Sheets como almacén, con IDs sensibles resueltos en runtime desde Script Properties (nunca hardcodeados — ver `config.js`).
- **Tooling de desarrollo** (este repo, no el runtime de la app): Node.js + Husky + commitlint, solo para lint y hooks de git. La app en sí **no corre sobre Node** — no hay build ni servidor propio.

## Estructura del repo (mapa rápido)

| Archivo | Propósito |
|---|---|
| `Codigo.js` | Orquestador principal, `doGet()`, endpoints públicos |
| `config.js` | `CONFIG` central, `getConfig()`/`getConfigProperty()`, validación |
| `datos.js` | Acceso a la hoja principal de datos |
| `pac_*.js` | Módulo PAC (seguimiento, alertas, triggers) |
| `gestion_equipos_backend.js`, `homologacion_usuarios.js` | Asignación de equipos y homologación de usuarios |
| `auditoria.js`, `permisos.js` | Auditoría y control de permisos por rol |
| `reportes.js`, `export_*.js` | Generación de reportes PDF/Excel |
| `Index.html`, `app_*_js.html`, `pac_*.html` | Frontend (HtmlService) |
| `consolidacion_colab/` | Script Python (Google Colab) de consolidación de datos, fuera del deploy de Apps Script |

Ver [`CLAUDE.md`](CLAUDE.md) para el mapa completo, scopes de OAuth, checklist de despliegue y reglas de configuración, y [`DOCUMENTACION_TECNICA_VIVA.md`](DOCUMENTACION_TECNICA_VIVA.md) como bitácora técnica canónica del proyecto.

## Desarrollo local

```bash
# Herramientas de dev (lint, git hooks) — no instala nada del runtime de la app
npm install

# Lint de sintaxis (incluye <script> embebido en los .html)
npm run lint
```

Para trabajar contra el proyecto real de Apps Script se necesita `clasp` configurado (`clasp login`, `.clasp.json` ya presente en el repo) — ver el checklist de despliegue en `CLAUDE.md`.

## Flujo de versionamiento

Trunk-based simplificado: `main` protegida, una rama corta por tarea (`feat/<módulo>-<descripción>`, `fix/<módulo>-<descripción>`), PR obligatorio, squash-merge. Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) para la convención de commits y el flujo completo.

## Contacto / soporte

`fabian.montanez@idu.gov.co`, `sistemasdtdp@idu.gov.co`

<!-- verificación CI/CD -->
