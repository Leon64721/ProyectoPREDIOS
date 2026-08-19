# Contribuir a APLICACIÓN DE PREDIOS

## Ramas

Trunk-based simplificado. `main` es la única rama de larga vida, protegida.

- `feat/<módulo>-<descripción>` — funcionalidad nueva
- `fix/<módulo>-<descripción>` — corrección de bug
- Ramas cortas, una por tarea. PR obligatorio hacia `main`, **squash-merge**.

### Una tarea de agente de IA = una rama, en su propio worktree

Si vas a trabajar con Claude Code, Copilot u otro agente, nunca compartas el mismo checkout local entre dos sesiones activas al mismo tiempo — es la causa raíz de al menos dos incidentes reales ya documentados en este proyecto (ver `TODOS.md`, ítem 12).

```bash
git worktree add ../predios-<tarea> -b feat/<módulo>-<descripción> main
# trabajar solo dentro de ese directorio
git worktree remove ../predios-<tarea>   # al terminar
```

Antes de lanzar un agente, revisa/actualiza `AGENTS_ACTIVE.md` (si existe en el repo) para no lanzar dos sesiones sobre el mismo módulo sin saberlo.

## Commits

Formato obligatorio (validado por `commitlint` + hook `commit-msg` de Husky):

```
tipo(módulo): descripción en imperativo [TICKET]
```

- **tipo:** `feat` | `fix` | `refactor` | `chore` | `docs` | `test` | `perf` | `style` | `ci`
- **módulo:** el archivo o dominio principal tocado (`equipos`, `alertas`, `matriz`, `config`...)
- **TICKET:** `CONC-FE-XX` / `CONC-BE-XX`, o `sin-ticket` si es trabajo suelto — el sufijo es obligatorio, no opcional.

```bash
git commit -m "fix(alertas): corregir cálculo de severidad en evaluador [CONC-FE-22]"
```

**Cuándo commitear:** por tarea cerrada y verificada, nunca por tiempo transcurrido. Checklist mínimo antes de cada commit:

- [ ] Sintaxis validada — `npm run lint` (cubre `.js` y `<script>` embebido en `.html`)
- [ ] Sin `console.log`/debug agregado a propósito
- [ ] Sin IDs de spreadsheet/Drive ni secretos hardcodeados (deben vivir en `PropertiesService`, ver `config.js`)
- [ ] Mensaje sigue el formato de arriba

## Pull Requests

- Hacia `main`, siempre. Nunca push directo (branch protection lo bloquea).
- CI corre en cada PR: lint de JS/HTML, sintaxis de los scripts Python en `consolidacion_colab/`, formato del título del PR (commitlint) y escaneo de secretos.
- Squash-merge: el **título del PR** se vuelve el mensaje del commit final en `main` — debe seguir el mismo formato que un commit normal.

## Deploy a producción (Apps Script)

El deploy (`clasp push`/`clasp deploy`) es manual, siempre desde `main` recién actualizada, siguiendo el checklist ya existente en `CLAUDE.md` (`validateConfig()`, `diagnosticarSistema()`, revisión de la hoja `Permisos`). No se automatiza en CI a propósito — ver `TODOS.md` ítem 20 para el razonamiento.

## Datos sensibles

Nunca hardcodear IDs de spreadsheet, API keys ni datos personales en el código. Usar `PropertiesService.getScriptProperties()` (ver `getConfigProperty()` en `config.js`). El repositorio ya pasó por una limpieza de historial por este motivo — no lo repitas.
