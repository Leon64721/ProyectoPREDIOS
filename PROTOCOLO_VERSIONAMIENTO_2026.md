# PROTOCOLO FORMAL DE VERSIONAMIENTO
**Aplicación de Predios — Proceso de Adquisición Predial del IDU**

**Versión:** 1.0  
**Fecha:** 2026-09-23  
**Ámbito:** Sincronización tripartita: Local (Git) ↔ Google Apps Script ↔ GitHub

---

## 1. ARQUITECTURA DE VERSIONAMIENTO

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL (GIT REPOSITORY)                    │
│  ├─ Branch: main (production)                               │
│  ├─ Branch: fix/feature/* (topic branches)                  │
│  └─ Working tree: commits, staging                          │
└──────────────────┬──────────────────────────────────────────┘
                   │ clasp push/pull
                   ↓
┌─────────────────────────────────────────────────────────────┐
│          GOOGLE APPS SCRIPT (REMOTE PRODUCTION)              │
│  ├─ Script ID: 18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi...    │
│  ├─ Deployment (@HEAD): auto-reflects latest push          │
│  └─ Verification: grep en archivos post-push                │
└──────────────────┬──────────────────────────────────────────┘
                   │ git push (after clasp push verification)
                   ↓
┌─────────────────────────────────────────────────────────────┐
│            GITHUB REMOTE (BACKUP + COLLABORATION)            │
│  ├─ Repository: Leon64721/ProyectoPREDIOS                    │
│  ├─ Main: branch protection + 4 required status checks       │
│  ├─ PRs: enforcidas via main, status checks bloqueadas       │
│  └─ Billing: CRÍTICO — bloquea todos los checks             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. CICLO DE VERSIONAMIENTO (5 PASOS OBLIGATORIOS)

**ANTES de declarar cualquier fase o feature "completada":**

### Paso 1: git status — Estado local limpio
```bash
git status --short
```
**Verificar:** Sin archivos modificados sin commitear (excepto .clasp.json local).  
**Reporte:** Output literal, no resumen.

### Paso 2: git commit — Versionar cambios
```bash
git add <archivos>
git commit -m "<tipo>(<módulo>): <descripción> [TICKET-O-sin-ticket]"
```
**Verificar:** Cada commit tiene descripción y sufijo de ticket.  
**Reporte:** Output literal de commit (hash, descripción, archivos).

### Paso 3: clasp push — Sincronizar a Google Apps Script
```bash
clasp push --force
```
**Verificar:** Output dice "Pushed N files" (no "Script is already up to date" si hay cambios).  
**Reporte:** Lista de archivos pusheados, hash de commit que se deployó.

### Paso 4: Verificación remota — Confirmar cambios en Google Apps Script
```bash
# Crear directorio temporal
mkdir -p /tmp/clasp-verify-$(date +%s)
cd /tmp/clasp-verify-$(date +%s)

# Crear .clasp.json con scriptId
cat > .clasp.json << EOF
{
  "scriptId": "18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi",
  "rootDir": "."
}
EOF

# Descargar y verificar
clasp pull
grep -n "<función/patrón-buscado>" <archivo-crítico>.js
```
**Verificar:** El cambio específico aparece en el remoto con el número de línea esperado.  
**Reporte:** grep output literal (línea, patrón encontrado).

### Paso 5: Documentar en DOCUMENTACION_TECNICA_VIVA.md
```markdown
## [N]. <Nombre de Fase> — [Estado: COMPLETADO/BLOQUEADO YYYY-MM-DD]

**Commit:** `<hash>`  
**Archivos modificados:** X  
**clasp push:** Y archivos pusheados  
**Verificación remota:** <función-crítica> línea <número> ✅
```
**Verificar:** Número de línea confirmado por grep (paso 4), no heredado.  
**Reporte:** Sección completa dentro de DOCUMENTACION_TECNICA_VIVA.md.

---

## 3. LECCIONES APRENDIDAS — FALLOS DETECTADOS EN SESIÓN 2026-09-23

### (a) "Completado" sin evidencia pegada

**Fallo:** Reportar "18/18 funciones protegidas ✅ COMPLETADAS" sin mostrar `grep` o `sed` que lo compruebe.

**Consecuencia:** Descubrimiento tardío (auditoría posterior) de que una función NO tenía protección, contradictando el reporte de cierre.

**Protocolo:** NUNCA reportar "completado" sin pegar el output literal de al menos un comando de verificación (grep, sed o clasp pull). Una tabla resumida no es evidencia.

---

### (b) Confusión de nombres de función entre reportes

**Fallo:** Listar "generarPlantillaAsignacion" en el inventario, luego descubrir que la función real es "generarPlantillaAsignacionCSV", y no está claro cuál de las dos versiones (o si hay dos) está siendo contabilizada.

**Consecuencia:** Ambigüedad sobre qué se protegió realmente; auditoría posterior reveló que había dos funciones con nombres similares (wrapper + interna).

**Protocolo:** Usar `grep -n "^function nombreFunción" <archivo>` en el remoto ANTES de incluir en el inventario. Si hay múltiples versiones (wrapper + interna), listar ambas con línea de cada una.

---

### (c) "Protegida indirectamente" por proximidad, sin verificar llamada literal

**Fallo:** Listar saveTrackingData como "indirectamente protegida por saveFollowupData" sin verificar que:
1. saveFollowupData realmente LLAMA a saveTrackingData en su cuerpo
2. Esa llamada es INCONDICIONAL (no está dentro de un `if` que podría saltarla)
3. saveFollowupData tiene validarPermiso ANTES de la llamada (no después)

**Consecuencia:** Asumir protección que no era verificable en el código real.

**Protocolo:** Para cada "indirecta", ejecutar:
```bash
sed -n '/^function <llamante>/,/^}/p' <archivo> | grep -i "<función-a-proteger>\|validarPermiso"
```
Y mostrar el bloque completo (no solo grep aislado). Confirmar:
- Llamada literal presente en el cuerpo
- validarPermiso ANTES de la llamada (o en el llamante, antes de invocar al que lo invoca)
- Sin `if` u otra lógica que pueda evitar la validación

---

### (d) Reportar PR como "cerrado" cuando solo está "abierto" o con checks bloqueados

**Fallo:** Describir PR #4 como "COMPLETADO" aunque:
- GitHub status: OPEN
- Checks: bloqueados por billing
- No puede mergearse a main

**Consecuencia:** Confusión sobre si el código está efectivamente en producción (main) o solo en rama de PR.

**Protocolo:** Distinguir explícitamente:
- **Código verificado en Apps Script:** `clasp push + clasp pull + grep` ✅ (remoto de Apps Script)
- **PR abierto en GitHub:** `gh pr view <#>` (rama de PR)
- **Mergeado a main:** `git log main | grep <commit-hash>` (rama main de GitHub)
- **Bloqueado por:** "causa externa (billing)", "status checks", etc.

Reportar el ESTADO REAL sin mezclar niveles.

---

### (e) Inconsistencia de números de línea entre reportes o entre local y remoto

**Fallo:** Reportar validarPermiso en "línea 301" tras un `clasp push`, pero `clasp pull` posterior muestra que en remoto solo existe en línea 208. Segunda ejecución de `clasp push --force` sí transfiere el cambio a línea 301.

**Consecuencia:** Incertidumbre sobre si el segundo push funcionó realmente.

**Protocolo:**
- SIEMPRE ejecutar `clasp push --force` (no confiar en "Script is already up to date").
- SIEMPRE hacer `clasp pull` INMEDIATAMENTE después en un dir temporal.
- SIEMPRE hacer `grep` o `sed` en el dir temporal post-pull para confirmar el número de línea.
- Si hay inconsistencia local vs. remoto, ejecutar `clasp push --force` nuevamente y verificar.
- Reportar el NÚMERO DE LÍNEA DEL REMOTO, no del local (el remoto es la verdad).

---

### (f) Segundo push que no transfiere cambios sin detectarse automáticamente

**Fallo:** Editar export_backend.js línea 295 para agregar validarPermiso al wrapper. Ejecutar `clasp push --force`. Asumir transferencia exitosa. `clasp pull` post-push en dir nuevo revela que la línea 301 (wrapper) NO tiene validarPermiso, solo la línea 208 (interna). Sin esta verificación post-push, el cambio habría quedado en local sin llegar a Apps Script.

**Consecuencia:** Falsa sensación de completitud; brecha de seguridad no detectada.

**Protocolo:**
- Después de CADA `clasp push`, ejecutar `clasp pull` en un dir temporal DIFERENTE (no reusar dir anterior).
- Ejecutar `grep` sobre el archivo crítico en ese dir temporal para confirmar cambio específico.
- Si el cambio no está, NO asumir; ejecutar `clasp push --force` nuevamente sin cambios intermedios.
- Incluir el output de la verificación post-push en la Sección de DOCUMENTACION_TECNICA_VIVA.md para ese commit.

---

## 4. CHECKLIST DE VERSIONAMIENTO

Use este checklist antes de declarar cualquier feature, fix, auditoría o phase "completada":

- [ ] **Paso 1:** `git status --short` — working tree limpio (salvo .clasp.json)
- [ ] **Paso 2:** `git commit` — commit hecho con mensaje y ticket
- [ ] **Paso 3:** `clasp push --force` — output dice "Pushed N files" (no "already up to date")
- [ ] **Paso 4a:** `clasp pull` en dir temporal nuevo
- [ ] **Paso 4b:** `grep -n <patrón> <archivo>` — cambio visible en línea esperada (reportar output literal)
- [ ] **Paso 4c:** Si inconsistencia, ejecutar `clasp push --force` nuevamente y volver a Paso 4a
- [ ] **Paso 5:** DOCUMENTACION_TECNICA_VIVA.md actualizado con:
  - Número de línea del remoto (del Paso 4b)
  - Hash del commit (del Paso 2)
  - Lista de archivos (del Paso 3)
  - Resultado de verificación remota (del Paso 4b)

**NO marcar "completado" sin marcar todos estos checkboxes.**

---

## 5. ESCENARIOS CRÍTICOS

### Escenario A: Cambio en 2 archivos, uno se pushea otro no

**Situación:** `git commit` incluye cambios a `export_backend.js` y `Codigo.js`. `clasp push` dice "Pushed 48 files". `clasp pull + grep` muestra que export_backend.js tiene el cambio pero Codigo.js no.

**Acción:**
1. Verificar que Codigo.js NO está en .claspignore
2. Ejecutar `clasp push --force` nuevamente
3. Volver a Paso 4 (clasp pull + grep en ambos archivos)
4. Si aún no transfiere, revisar credenciales de .clasp.json (scriptId correcto)

**NO seguir adelante con un push "parcial".**

---

### Escenario B: GitHub billing bloqueado, PR abierto pero checks no corren

**Situación:** PR #4 abierto con 3 commits nuevos. Status: checks queued pero "The job was not started because your account is locked due to a billing issue."

**Acción:**
1. Código está verificado en Google Apps Script (Pasos 1-4 completados) ✅
2. PR abierto en GitHub ✅
3. GitHub main tiene branch protection que requiere checks ❌
4. Billing debe resolverse en https://github.com/account/billing/overview (MANUAL, no CLI)
5. Una vez resuelto, checks correrán automáticamente y PR podrá mergearse

**Reportar estado real:** "Código verificado en Apps Script, GitHub bloqueado por billing (externo)". NO reportar como "completado en GitHub" hasta que esté en main.

---

### Escenario C: Inconsistencia de número de línea (1 línea offset)

**Situación:** Local muestra validarPermiso en línea 301. Remoto post-clasp-pull muestra línea 308. Reporte anterior decía línea 301.

**Acción:**
1. NOT A BUG de clasp — el archivo cambió (ej. alguien agregó líneas antes).
2. Ejecutar `git log -p export_backend.js | head -100` para ver qué agregó líneas.
3. Reportar el número del REMOTO (308), no el del reporte anterior (301).
4. Actualizar DOCUMENTACION_TECNICA_VIVA.md con el número correcto y explicar el offset.

---

## 6. RESPONSABILIDADES

| Rol | Responsabilidad |
|-----|-----------------|
| Agente/Developer | Ejecutar todos los 5 pasos; incluir output literal en reporte |
| Revisor | Verificar que output literal está presente; reproducir Paso 4 en dir nuevo |
| Admin | Mantener credenciales .clasp.json, resolver GitHub billing issues |

---

## 7. REFERENCIAS

- **Código central:** [Codigo.js](Codigo.js), [config.js](config.js), [export_backend.js](export_backend.js)
- **Documentación técnica viva:** [DOCUMENTACION_TECNICA_VIVA.md](DOCUMENTACION_TECNICA_VIVA.md)
- **Auditoría RBAC:** [Sección 40-41 en DOCUMENTACION_TECNICA_VIVA.md](DOCUMENTACION_TECNICA_VIVA.md)
- **Google Apps Script:** https://script.google.com/home/projects/18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi/edit
- **GitHub:** https://github.com/Leon64721/ProyectoPREDIOS

---

**Versión del Protocolo:** 1.0 (2026-09-23)  
**Próxima revisión:** 2026-10-01 (post-cierre Fase 4)
