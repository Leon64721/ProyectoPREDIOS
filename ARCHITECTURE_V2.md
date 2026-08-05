**ARCHITECTURE_V2 — Evolución arquitectural empresarial**

Objetivo: Diseñar la evolución de la solución actual (Consolidación Python → Normalizador → Matriz + Apps Script) hacia una plataforma automatizada, escalable y segura que elimine la intervención manual y permita operaciones a nivel empresarial.

**A) Automatización ETL: propuesta de arquitectura y componentes exactos**

Resumen ejecutivo
- Reemplazar ejecuciones manuales en Colab por pipelines gestionados y auditablemente reproducibles en GCP. Usar Cloud Storage como staging de artefactos, Cloud Run (o Cloud Composer) para procesos batch, BigQuery como almacén canónico y Cloud Functions / Cloud Run HTTP APIs para interacción con la UI (Apps Script). Evitar escritura directa a múltiples hojas externas: mantener una fuente de verdad en BigQuery y sincronizar la "Matriz" (Google Sheet) solo para vistas que requieren edición humana.

Arquitectura propuesta (componentes y responsabilidades)
- Cloud Storage (Bucket: gs://predios-artifacts)
  - Recibe snapshots consolidados (CSV/Parquet) producidos por el servicio de consolidación.
- Consolidator service (Docker, Python) — despliegue en Cloud Run
  - Reemplaza Colab. Ejecuta la lógica de `uniondatosfinales.py` de forma batch.
  - Lee orígenes (Drive paths o GCS), ejecuta heurísticas y escribe snapshot en Cloud Storage.
  - Exposición: HTTP endpoint /run-consolidation y job runner (Cloud Scheduler trigger). Autenticación mediante Workload Identity.
- Normalizer service (Node.js o Python) — despliegue en Cloud Run
  - Toma snapshot desde GCS, aplica reglas de `ConfigNormalizacion` y `CoreNormalizacion` (portadas a Node/Python), escribe resultados a BigQuery (dataset `predios_v2`, table `matriz_normalizada`).
  - Soporta streaming/partitioned ingest si datasets son grandes.
- Orquestador (opcional): Cloud Composer (Airflow managed) o Cloud Scheduler + Pub/Sub
  - Recomiendo Cloud Composer si se requiere DAGs complejos y visibilidad; para simplicidad, usar Cloud Scheduler que desencadena Cloud Run/Cloud Functions y Pub/Sub para encadenamiento.
- BigQuery — fuente de verdad
  - Tabla: `predios_v2.matriz_normalizada` con esquema versionado y columnas alineadas a `estructuraObjetivo`.
  - Almacena historial con particionado por fecha de snapshot (`snapshot_date`) y columnas de auditoría (`ingested_by`, `ingest_ts`, `version`).
- Materialización y vistas
  - Crear vistas materializadas en BigQuery para consultas frecuentes (e.g. `v_matriz_activa`).
- Cache layer: Memorystore Redis (o Cloud Memorystore for Redis)
  - Almacena resultados precomputados de cruces pesados (joins, filtros caros) y páginas de búsqueda.
- API layer — Cloud Functions / Cloud Run HTTP
  - `GET /matriz/query` — consulta paginada/materializada; cache lookup first.
  - `POST /matriz/update` — endpoint seguro para mutaciones de datos desde la UI; valida RBAC y escribe en BigQuery (y opcionalmente sincroniza a Google Sheet principal si necesario, ver flujo de escritura más abajo).
  - `POST /cache/invalidate` — invalidación programática o por usuario forzado.
- Google Apps Script (UI layer)
  - UI ligero (`HtmlService`) que consume la API layer para mostrar datos y botones de acción.
  - Evitar que Apps Script haga lecturas masivas: siempre solicitar a la API. Para edición pequeña (seguimiento/auditoría), la UI envía la actualización al `POST /matriz/update`.
- Sync to Google Sheets (Matriz)
  - Una vez que BigQuery confirme escritura, ejecutar un worker (Cloud Run job) que sincronice únicamente las porciones necesarias a la hoja `CONFIG.DATA_FILES.PRINCIPAL` mediante Sheets API. Todas las escrituras de control deben pasar por la API para mantener coherencia.

Flujo de datos (alto nivel)
1. Cloud Scheduler triggers Consolidator en Cloud Run (o se ejecuta on-demand). Consolidator escribe CSV/Parquet en GCS.
2. Normalizer (Cloud Run) se desencadena por Pub/Sub (evento GCS) o Scheduler; normaliza y carga a BigQuery.
3. BigQuery materializa vistas y notifica a Cache Precompute Job (Cloud Run) que rellena Redis con resultados pesados.
4. Apps Script UI consulta `GET /matriz/query` (cache-first) para mostrar datos.
5. Al editar, UI envía `POST /matriz/update` a la API; API valida permisos y actualiza BigQuery; luego solicita sincronización parcial a Google Sheets mediante Sheets API.

Mermaid (diagrama rápido)
```mermaid
flowchart LR
  A[Orígenes: Drive/Uploads/FTP] -->|CSV/Excel| B[Cloud Storage]
  B --> C[Consolidator (Cloud Run)]
  C --> D[Normalizer (Cloud Run)]
  D --> E[BigQuery (matriz_normalizada)]
  E --> F[Cache (Redis)]
  F --> G[API Layer (Cloud Functions/Run)]
  G --> H[Apps Script UI]
  G --> I[Sync Worker -> Google Sheets]
```

Notas de diseño y trade-offs
- BigQuery como fuente de verdad: pros (escala, SQL, materialized views); cons (costos por query). Mitigar con cache y vistas materializadas.
- Cloud Run + containers: permite portar el código Python existente sin reescribir todo de inmediato.
- Si se requiere orquestación avanzada o retries automáticos, usar Cloud Composer.

Seguridad y acceso
- Todas las APIs expuestas deben requerir autenticación mediante Google ID tokens (Workload Identity / OAuth2). Apps Script debe autenticar con service account vía OAuth2 (OAuth2Service). Evitar cuentas personales.


**B) Caching Avanzado e Invalidación**

Objetivos
- Reducir latencia y costos de BigQuery evitando consultas repetidas para cruces pesados.
- Proporcionar actualizaciones nocturnas programadas y un mecanismo seguro para invalidación manual desde la UI.

Componentes
- Redis (Cloud Memorystore) — primary cache store.
- Precompute Job (Cloud Run) — ejecuta consultas BigQuery pesadas y escribe resultados en Redis como JSON o listas paginadas.
- Cache Metadata Table (BigQuery / Firestore) — mantiene metadatos por cache key: `{key, last_computed_ts, computed_by, etag, ttl_seconds, version}`.

Estrategia de caché
- Cache keys: usar un prefijo claro y determinista: `precomp:{reportId}:{paramsHash}`.
- TTLs: defaults (24h) para cruces nocturnos; shorter TTLs (5-30m) para filtros interactivos.
- Versioning (etag): cada precompute escribe un `etag` (sha256(payload)) en la tabla metadata.
- Atomic update: Precompute Job escribe en Redis una key temporaria `tmp:{key}:{uuid}` y al finalizar hace RENAME (o equivalente) para minimizar ventanas inconsistente.

Sincronización nocturna (Cron Triggers)
- Cloud Scheduler scheduled job (ej. 02:00 local) → Pub/Sub topic `precompute-trigger` → Fan-out con payloads (reportId, params, targetKeys).
- Un precompute Cloud Run job recibe el mensaje, ejecuta la consulta BigQuery, serializa resultados, y escribe en Redis e inserta/actualiza metadata en BigQuery.
- Job registra métricas en Cloud Monitoring y logs en Cloud Logging.

Force Update (botón en UI)
- UI realiza POST a `POST /cache/invalidate` con payload `{reportId, params, userId}`.
- API layer valida RBAC (solo roles autorizados pueden forzar). Si autorizado:
  1. Insertar un job en Pub/Sub `precompute-trigger` con `priority=high` y `requestedBy=userId`.
  2. Responder inmediatamente con `202 Accepted` y operationId.
  3. Worker procesa job de forma síncrona o en cola; al finalizar actualiza metadata y envía evento de Webhook / push message (Firebase Cloud Messaging / Apps Script push) para que UI pueda refrescar.
- Opcional: si el usuario necesita bloqueo hasta completar, ofrecer operación síncrona con feedback en UI (mostrar spinner y luego success/error). Requerir confirmación si job cost estimate > threshold.

Invalidación fina
- Para ediciones puntuales (p.ej. un RT concreto modificado), invalidar solo keys que contengan el RT o forzar re-evaluación incremental.
- Mantener mapeo de dependencia (cacheKey -> set of entityIds) en Redis para invalidación selectiva.

Seguridad y quotas
- Limitar frecuencia de "Force Update" por usuario/role (rate limit en API).
- Registrar cada forzado en `cache_audit` table con userId, timestamp, ip, costEstimate, result.


**C) Control de Acceso (RBAC) — Modelo y reglas**

Roles propuestos
1. Viewer
  - Permisos: consultar datos (leer), descargar reportes (CSV/PDF), ver logs básicos.
  - No puede editar, ni hacer Force Update.
2. Editor
  - Permisos: todo de Viewer + crear/editar registros de seguimiento limitados (seguimiento), comentar, enviar solicitudes de cambio.
  - No puede alterar reglas de normalización ni invalidar cache global.
3. Auditor
  - Permisos: todo de Viewer + acceso a auditoría completa, historial de cambios, y exportes de auditoría. No puede editar datos operativos.
4. PowerEditor
  - Permisos: Editor + puede ejecutar Force Update en reportes asignados (scoped).
5. Admin
  - Permisos: control total — triggers de cron, despliegues, modificar CONFIG, gestionar roles.

Principios de enforcement
- Autenticación: Google Sign-In + ID tokens. Todas las llamadas a API deben incluir Authorization: Bearer <id_token> y el backend debe validar token y extraer `sub` & `email`.
- Autorización: mantener tabla `permissions.users` (BigQuery) o Firestore que mapea `principalId` → roles → scopes.
- Scope granulado: permisos por dataset/table/reportId y por operación (read, update, force_cache).
- Checks en tres niveles:
  1. API gateway / Cloud Armor policy — bloquear requests no autorizados.
  2. API Layer: validar token + role + scope.
  3. Post-write validators: log y reconciliación (audit trail); write operations insertan un record en `audit.matriz_changes`.

UI controls
- Apps Script UI only shows buttons/options permitted by role (backend must be source-of-truth; UI reads allowed actions via `GET /auth/me` endpoint).
- Force Update button only visible/enabled for roles: `PowerEditor`, `Admin` (or `Editor` if scoped by report owner).

Emergency access and separation
- `Admin` actions require 2FA and write operations to `admin_audit` with immediate email alert.
- Sensitive operations (modifying CONFIG, granting Admin) require multi-approver flow (implementable con Workflows + Cloud Tasks + approval signatures recorded).


**D) Delegación gstack — Prompts exactos para agentes**

Nota: los prompts están listos para pasarse a agentes especializados. Provee contexto mínimo (API specs y ejemplos de payload) y salida esperada estricta.

Prompt A — Frontend agent (UI del botón "Forzar actualización" y Searchable Dropdowns)
```
You are a frontend engineer agent. Task: implement UI components for the Apps Script HtmlService frontend that call the backend API layer.
Context: Backend endpoints available:
- GET /matriz/query?reportId={id}&page={n}&size={s} (returns JSON {data,etag,meta})
- POST /cache/invalidate (body: {reportId, params, userId}) returns 202 and {operationId}
- GET /auth/me returns {userId, roles:[]}
Behavior requirements:
1) Add a "Forzar actualización" button near report header. The button should:
  - Be visible only if `roles` includes `PowerEditor` or `Admin`.
  - On click, show confirmation modal with estimated cost and an optional "Wait for completion" checkbox.
  - When confirmed, call POST /cache/invalidate with proper ID token in Authorization header; show optimistic UI: spinner and toast. If operation accepted, show operationId and subscribe to a websocket/poll endpoint `/operations/{operationId}` for status; refresh visible data when complete.
2) Implement Searchable Dropdown components used for filters (RT, Proyecto, Tramo):
  - Debounce user input (300ms), call `GET /matriz/query?reportId=searchHints&term={q}&size=50`.
  - Display server-provided `etag` and use incremental cache (localStorage) keyed by `searchHints:{term}` for 1 hour.
3) Error handling and UX:
  - Show clear error if 401/403 and prompt to re-login.
  - If API returns costEstimate > threshold, show additional confirmation.
Output: provide the exact Html/CSS/JS snippets for Apps Script `HtmlService`, and the HTTP call patterns including ID token acquisition (code snippet using `google.script.run.withSuccessHandler(...)` or fetch with service account via OAuth2), plus unit-testable JS functions for debounced dropdown and operation polling.
```

Prompt B — QA/Security agent (tests and checks)
```
You are a QA and Security testing agent. Task: generate an automated test plan and test cases for the new architecture focusing on cache correctness, RBAC enforcement, and concurrency.
Context: endpoints as above. The environment includes a Staging project with dedicated BigQuery dataset and Redis instance.
Deliverables (structured):
1) Test matrix (cases) with steps, expected result, and severity.
2) Automated scripts (Node.js mocha/jest) for:
   - Concurrency test: simulate 50 concurrent `POST /cache/invalidate` from users with different roles; measure latency and verify rate limiting and audit logs.
   - Authorization fuzzing: try to call `POST /cache/invalidate` without tokens, with expired tokens, and with Viewer role.
   - Cache correctness test: write a deterministic dataset to BigQuery, run precompute, fetch from `/matriz/query` (cache-hit), then update underlying data and verify cache invalidation triggers and subsequent cache reflects changes.
3) Security checks: ensure no `ANYONE_WITH_LINK` Drive sharing; ensure emails with PDFs are sent only to allowed domains; ensure admin actions require 2FA (simulate via header flag).
Output format: provide the test scripts, CI job YAML for GitHub Actions that runs the tests on a staging deploy, and a checklist for manual exploratory testing.
```


**Entrega y gobernanza**

Roadmap corto plazo (next 90 days)
- Week 1–2: Port `uniondatosfinales.py` to a Cloud Run container and validate outputs to GCS.
- Week 3: Implement Normalizer in Cloud Run and load to BigQuery; smoke tests.
- Week 4: Implement API layer with auth and the `cache/invalidate` endpoint; create minimal Apps Script UI that calls it.
- Week 5–6: Implement Redis precompute job and Cloud Scheduler nightly run; add Force Update flow and RBAC checks.
- Week 7–8: QA security, run staging tests, tune BigQuery costs with materialized views and caching.

Governance
- Maintain an `infra/` repo with IaC (Terraform or Deployment Manager) to create: GCS buckets, Cloud Run services, Cloud Scheduler jobs, BigQuery datasets, Redis instance, service accounts, IAM bindings.
- Use centralized logging (Cloud Logging) and alerts (Cloud Monitoring) for failures and high-cost queries.

**Apéndice: decisiones clave y motivos**
- Mantener BigQuery como SOR para analítica y compatibilidad con consultas pesadas.
- Cloud Run para portar Python y Node con menor esfuerzo inicial que una reescritura completa en Node.
- Redis para latencias bajas y reducir costos BigQuery; materialized views para consultas SQL frecuentes.

---
Archivo generado: [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md)
