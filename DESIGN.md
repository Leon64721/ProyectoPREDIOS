# DESIGN.md - Aplicacion de Predios

## 1) Objetivo de diseño
Elevar la experiencia de la aplicacion a un nivel enterprise moderno: mas rapida en percepcion, visualmente consistente, accesible, y con flujos de filtros/reportes mas fluidos para usuarios operativos.

## 2) Diagnostico UX actual
- Jerarquia visual inconsistente entre modulos (Matriz, Alertas, PAC, Permisos).
- Controles de filtro heterogeneos (algunos buscables, otros no).
- Casos de overflow de texto en cards, badges y celdas.
- Densidad visual alta en algunas vistas sin suficiente estructura por bloques.
- Estados de carga y vacio con lenguaje/estilo no uniforme.

## 3) Direccion visual propuesta
### 3.1 Sistema visual
- Tipografia: Inter (ya usada) con escala tipografica unificada.
- Paleta semantica: mantener azul corporativo como primario; normalizar rojo/naranja/amarillo para riesgo.
- Espaciado: sistema 4/8/12/16/24/32 px aplicado transversalmente.
- Bordes/radios: unificar radios en 6/8/10 px por nivel de componente.
- Sombras: 2 niveles maximos para evitar ruido.

### 3.2 Principios de interfaz
- Una accion principal por bloque.
- Filtros siempre visibles, buscables y consistentes.
- Cualquier lista > 12 items debe soportar busqueda.
- Textos largos nunca deben desbordar contenedores.
- Feedback inmediato en acciones de escritura (toast + estado).

## 4) Arquitectura de componentes UI
### 4.1 Filtros
- Componente base: SearchableDropdown
- Variantes: compact (alertas), standard (matriz), dense (modales)
- Comportamiento:
  - foco automatico al abrir
  - Enter selecciona primera coincidencia
  - Escape limpia busqueda
  - opcion ALL siempre visible

### 4.2 Tablas y celdas
- Celdas con wrap inteligente y tooltip opcional para truncado.
- Encabezados sticky donde aplique.
- Presets de densidad (normal y compacta) por vista.

### 4.3 Estados
- Loading: skeleton por seccion.
- Empty: mensaje accionable.
- Error: mensaje corto + siguiente accion sugerida.

## 5) Plan de trabajo integral (FASE 9)
## Sprint 1 - Performance UX First Paint (alto impacto)
1. Eliminar operaciones bloqueantes en arranque (ya iniciado en CONC-FE-04).
2. Diferir cargas secundarias no criticas (agrupaciones, metadata pesada).
3. Agregar metricas de tiempo en cliente:
   - t_boot_start
   - t_dashboard_loaded
   - t_first_render
4. Definir presupuesto de arranque: objetivo <= 6s en frio, <= 2.5s en cache hit.

## Sprint 2 - Consistencia de filtros
1. Migrar todos los selects de filtros de vistas principales a SearchableDropdown.
2. Unificar placeholders, etiquetas y semantica de opcion ALL.
3. Añadir contador de coincidencias en todos los dropdowns buscables.
4. QA responsive de filtros en 360px, 768px, 1024px, 1440px.

## Sprint 3 - Layout y legibilidad
1. Normalizar spacing vertical en headers, filtros y tablas.
2. Corregir todos los casos de overflow/word-break en cards y tablas.
3. Revisar contraste de color (AA) para textos secundarios y badges.
4. Reducir estilos inline y consolidar en estilos.html.

## Sprint 4 - Microinteracciones y feedback
1. Estandarizar toasts (exito, warning, error) con misma posicion/tiempo.
2. Animaciones suaves en apertura de dropdowns y cambios de estado.
3. Indicadores claros para procesos largos (exportaciones, recargas).

## Sprint 5 - Hardening visual y accesibilidad
1. Navegacion por teclado en filtros, tablas y modales.
2. Atributos ARIA en controles personalizados.
3. Pruebas de regresion visual por captura (desktop/mobile).

## 6) Criterios de aceptacion (Definition of Done)
- Ningun texto desborda su contenedor en vistas principales.
- 100% de filtros principales con busqueda funcional.
- Tiempos de arranque dentro del presupuesto definido.
- Sin errores de consola en carga inicial.
- Validacion UX aprobada en desktop y mobile.

## 7) Orden de implementacion recomendado
1. Performance arranque (impacto inmediato en usuario).
2. Filtros buscables restantes.
3. Overflow + spacing global.
4. Accesibilidad y microinteracciones.

## 8) Riesgos y mitigaciones
- Riesgo: cambios amplios en filtros rompen eventos existentes.
  - Mitigacion: mantener select oculto como source of truth y pruebas por modulo.
- Riesgo: regresiones visuales por CSS global.
  - Mitigacion: clases namespaced y rollout por secciones.
- Riesgo: payload variable por crecimiento de datos.
  - Mitigacion: mantener chunking en cache + diferir payloads secundarios.
