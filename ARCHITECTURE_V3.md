# Arquitectura V3 — Fase 9, escalabilidad para 8.000+ registros

## 1. Diagnóstico operativo

El problema principal no es un bug funcional sino un problema de arquitectura de carga y caché:

- El cliente estaba intentando persistir un payload de 8.734 registros en `localStorage`.
- `localStorage` en navegadores modernos tiene un límite aproximado de 5 MB por origen y no es adecuado para datasets de análisis.
- Cuando la escritura falla, la UI optimista se rompe, y se desmonta la experiencia del usuario.
- La carga del dashboard además recibe un payload muy grande desde Google Sheets, lo que multiplica costo de CPU, serialización y memoria en cliente.

Conclusión: la capa cliente debe dejar de ser el almacenamiento primario de datasets voluminosos y pasar a modelos de caché asíncrona, paginación y segmentación de datos.

## 2. Hallazgos de la arquitectura actual

### 2.1 `getDashboardData()`

El backend devuelve un payload completo para todo el conjunto de registros del tablero. Esto funciona para volúmenes pequeños, pero:

- escala mal con 8.000+ filas,
- empuja JSON grandes a través de Apps Script,
- aumenta el tiempo de serialización y deserialización,
- acopla la UI a un único payload monolítico.

### 2.2 Caché del cliente

El uso de `localStorage` para persistir `dashboardData_CURRENT_USER_EMAIL` rompe la escalabilidad por dos razones:

1. el almacenamiento es síncrono y bloquea el hilo principal,
2. el tamaño del payload supera el límite del navegador.

### 2.3 UI optimista

La estrategia actual de pintar desde caché y luego revalidar en segundo plano es válida, pero solo si la caché es:

- asíncrona,
- segmentada,
- tolerante a capacidad limitada.

## 3. Estrategia propuesta para Sprints 2-5

### Sprint 2 — Paginación del servidor

Objetivo: no devolver 8.000 registros de golpe.

Estrategia:

- `getDashboardData(page, pageSize, filters)` con API paginada.
- devolver `records`, `total`, `page`, `pageSize`, `hasMore`.
- el cliente renderiza solo la página activa y no el dataset completo.

Ventaja:

- reduce el tamaño del payload,
- minimiza memoria del navegador,
- mejora tiempo de interacción y scroll.

### Sprint 3 — Caché asíncrona y segmentada

Objetivo: reemplazar la caché monolítica por piezas menores.

Estrategia:

- IndexedDB para persistencia de respuesta paginada por usuario.
- almacenamiento por clave por proyecto/filtro/usuario,
- caché de metadatos separados de registros.

Patrón sugerido:

- `dashboardMeta_<user>_<filterHash>` para columnas, KPIs, contadores.
- `dashboardPage_<user>_<filterHash>_<page>_<pageSize>` para páginas.

Esto elimina la escritura masiva y evita bloquear el hilo principal.

### Sprint 4 — Compresión y serialización eficiente

Objetivo: reducir el tamaño del JSON sin romper compatibilidad.

Opciones reales:

- `LZString.compressToEncodedURIComponent` para payloads de texto grande,
- compresión selectiva solo para bloques de datos repetidos,
- serialización de valores numéricos a formato compacto,
- evitar mandar columnas internas no utilizadas por tabla.

Recomendación: usar compresión solo en rutas que realmente lleven JSON grande, no por defecto para todos los casos.

### Sprint 5 — Migración gradual de módulos pesados

Objetivo: desacoplar la carga del tablero del cálculo total del dataset.

Estrategia:

- mover KPIs y resúmenes a endpoints especializados,
- cargar detalles solo al abrir modal/RT,
- separar cálculo de matriz vs. panel de alertas vs. panel de permisos,
- crear una capa de “lazy data” para `detailModal`, `filters`, `audit` y `metrics`.

Resultado:

- arranque más rápido,
- menos bloqueos del hilo principal,
- menos presión sobre Apps Script y Sheets.

## 4. Recomendación de arquitectura objetivo

### Capa 1: Backend de consultas

- `getDashboardDataPage` para páginas de registro.
- `getDashboardSummaries` para KPIs y contadores.
- `getDashboardFilterOptions` para listados dinámicos.
- `getRTDetail` para detalle de RT bajo demanda.

### Capa 2: Capa de caché

- `IndexedDB` para persistencia del detalle de la sesión.
- `CacheService` solo para metadatos livianos y validaciones rápidas.
- `localStorage` solo para preferencia UI de pequeño tamaño.

### Capa 3: Frontend reactivo

- render por página,
- scroll virtual o paginación incremental,
- carga progresiva de filas visibles,
- UI optimista únicamente para cambios locales y transaccionales.

## 5. Estrategia de migración sugerida

1. Mantener la carga actual funcionando con el hotfix IndexedDB.
2. Añadir paginación desde el backend sin romper el contrato actual del cliente.
3. Introducir respuestas paginadas por filtro y por proyecto.
4. Rediseñar la caché del cliente como una capa de páginas y metadatos, no de dataset completo.
5. Desacoplar paneles pesados del arranque inicial.

## 6. Criterios de éxito

- tiempo de cold start < 3 s para el dashboard inicial,
- uso de memoria del cliente estable,
- ausencia de errores de quota en `Storage`,
- carga incremental basada en user interaction y no endataset global.

## 7. Conclusión

La verdadera solución no es “guardar un JSON más grande en otra api del navegador”, sino cambiar el modelo de consumo: mover la base de verdad a partir de paginación, caché segmentada y carga progresiva. El dataset grande no debe ser una respuesta monolítica; debe convertirse en un servicio de datos incremental y precalculado.
