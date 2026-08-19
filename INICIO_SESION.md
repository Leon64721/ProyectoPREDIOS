# Inicio de sesión — APLICACIÓN DE PREDIOS

> Lee este archivo antes de escribir cualquier línea de código.
> Luego ejecuta `git status` y `git log --oneline -5`.

## Antes de tocar código

1. `git status` — si hay cambios sin commitear que no son tuyos, **no los toques ni los reviertas**; puede ser una sesión concurrente (ver `TODOS.md` ítem 12, incidente real ya ocurrido dos veces).
2. `git branch -a` — confirmar que estás sobre `main` actualizada, no sobre una rama vieja.
3. Revisar `TODOS.md` para pendientes abiertos antes de asumir que algo "no está hecho".
4. `CLAUDE.md` tiene las reglas del proyecto (incluida la actualización obligatoria de `DOCUMENTACION_TECNICA_VIVA.md`) — léelo si es tu primera vez en este repo.

## Flujo Git obligatorio

Trunk-based: `main` es la única rama de larga vida. Ver `CONTRIBUTING.md` para el detalle completo (worktrees por agente, checklist pre-commit, deploy manual).

```bash
# 1. Crear rama nueva desde main
git checkout -b feat/nombre-funcionalidad main

# 2. Hacer cambios y commits — formato validado por commitlint + Husky
git add .
git commit -m "feat(modulo): descripción [TICKET]"

# 3. Push y PR (nunca push directo a main, branch protection lo bloquea)
git push origin feat/nombre-funcionalidad
```

## Antes de cerrar sesión

Si hiciste cambios relevantes en backend, frontend, config, PAC, auditoría, permisos o despliegue: documenta en `DOCUMENTACION_TECNICA_VIVA.md` (regla obligatoria de `CLAUDE.md`) y, si el cierre incluye un commit `docs(reflect)`/cierre de sesión que la modifica, regenera `Documento_Tecnico_Aplicacion_Predios.docx`/`.pdf` en el mismo commit:

```bash
~/.claude/skills/gstack/make-pdf/dist/pdf.exe generate DOCUMENTACION_TECNICA_VIVA.md Documento_Tecnico_Aplicacion_Predios.docx --to docx
~/.claude/skills/gstack/make-pdf/dist/pdf.exe generate DOCUMENTACION_TECNICA_VIVA.md Documento_Tecnico_Aplicacion_Predios.pdf --to pdf --cover --toc
```
