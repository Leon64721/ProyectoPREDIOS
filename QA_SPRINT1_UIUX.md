# QA Sprint 1 - Performance + UI/UX (Guiado por Pantallas)

Fecha: 2026-08-06
Alcance: revisar arranque, filtros principales y consistencia visual base para cierre de Sprint 1.

## 1) Criterios de Sprint 1
- Tiempo hasta primer render util reducido (sin bloqueos innecesarios en arranque).
- Filtros principales con experiencia consistente y buscable.
- Sin desbordes evidentes de texto en cards/tablas/badges.
- Sin errores de sintaxis ni problemas estructurales en archivos modificados.

## 2) Validacion tecnica (codigo)
1. Arranque no bloqueante:
- `loadDashboardData()` inicia inmediatamente en `document.ready`.
- `getUserAndRole()` queda en segundo plano.
- Estado: OK (validado por codigo).

2. Payload inicial optimizado:
- `getDashboardData()` ya no envia `filtrosMatriz` completo al abrir.
- Estado: OK (validado por codigo).

3. Carga diferida de filtros matriz completos:
- `cargarFiltrosMatriz()` se ejecuta con `setTimeout(..., 0)` tras render inicial.
- Estado: OK (validado por codigo).

4. Filtros alertas ahora buscables:
- Regla, Proyecto, Articulador migrados a dropdown contextual con input interno.
- Estado: OK (validado por codigo).

5. Control de overflow:
- Se agrego `overflow-wrap/word-break` para titulos, badges y tablas.
- Estado: OK (validado por codigo).

## 3) Checklist por pantallas
## Pantalla Matriz General
- [x] Filtro Proyecto searchable.
- [x] Filtro Tramo searchable.
- [x] Filtro Estado searchable.
- [x] Barra de filtros sin doble altura por input+select.
- [ ] Verificar en runtime responsive (360/768/1024/1440).

## Pantalla Alertas
- [x] Filtro Regla searchable.
- [x] Filtro Proyecto searchable.
- [x] Filtro Articulador searchable.
- [x] Limpiar filtros restablece ALL y vacia busquedas.
- [ ] Verificar en runtime que Enter/Escape y cierre de dropdown funcionen sin glitch.

## Pantalla PAC
- [ ] Revisar overflow en cabeceras/celdas de tabla PAC en runtime.
- [ ] Definir si filtros PAC requieren searchable dropdown (si listas > 12 elementos).

## Pantallas Historial / Auditoria / Permisos / Reportes
- [ ] Revisar labels, placeholders y alineaciones en runtime.
- [ ] Confirmar que no haya texto fuera de contenedor en tablas largas.

## 4) Evidencia de validacion automatica
- `get_errors`: sin errores en archivos impactados.
- `node --check`: sin errores en `Codigo.js`, `datos.js`, `app_core_js`, `app_matriz_js`, `app_alertas_js`.

## 5) Riesgos residuales (Sprint 1)
1. Aun hay evaluacion visual pendiente en runtime real (Apps Script WebApp).
2. No se capturaron metricas de tiempo reales en navegador (solo mejoras estructurales).

## 6) Cierre Sprint 1 (propuesta)
Sprint 1 puede considerarse "tecnicamente listo" cuando se complete esta corrida manual en runtime:
1. Abrir app y medir `t_boot_start` -> primer render visible.
2. Validar Matriz y Alertas en desktop + mobile.
3. Confirmar ausencia de overflow visual en tablas/cards.
4. Registrar tiempos y observaciones en DOCUMENTACION_TECNICA_VIVA.md.
