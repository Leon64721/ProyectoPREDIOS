# Plan — Retroalimentación visible en Alertas tempranas

> Estado: plan conjunto Cursor + Claude (2026-10-18). Veredicto: APROBAR CON CAMBIOS. La sección 6 manda. **No implementar** hasta que Fabian lo pida.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`.
> No hace `clasp push` ni `deploy`. No toca el motor de evaluación, el correo, la hoja `SEGUIMIENTO_ALERTAS` ni PAC.

## 1. Qué falta

Fabian no encuentra, en la Bandeja de Alertas Tempranas, dónde se dice qué regla pide comentario y cuál permite declarar que no se va a usar con soporte. Esa configuración existe, pero no está en esa pantalla.

Hoy vive solo dentro del modal **Nueva regla / Editar** de la página **Motor de Reglas** (`#page-motorReglas`, menú Administración). El bloque se llama "Seguimiento del correo" y lo inyecta `asegurarBloqueSeguimiento()` en `app_reglas_editor_js.html` cuando se abre el constructor. Las tarjetas de reglas no muestran si la regla pide comentario o permite no uso. La bandeja (`#page-alertas`) solo tiene Forzar evaluación, Enviar reporte y Recargar.

El JSON, el validador y el correo ya usan `seguimiento_correo`. No hay que inventar otro almacén.

## 2. Qué se hace

En la Bandeja de Alertas Tempranas, un Administrador ve el botón **Retroalimentación**. Abre un cuadro con todas las reglas. Cada regla muestra tres filas: Crítica, Riesgo y Preventiva. En cada fila:

- Casilla **Exigir comentario**.
- Casilla **Puede decir que no se va a usar**. Si está marcada, esa respuesta ya pide los dos soportes (concepto jurídico y técnico). No se diseña otro tipo de anexo.
- Texto de la nota que sale en el correo.
- Texto del aviso, visible solo si la segunda casilla está marcada.

En Crítica hay un botón **Usar texto de avalúo** que rellena la nota y el aviso de esa regla y marca las dos casillas. No guarda solo.

**Guardar** escribe `seguimiento_correo` en cada regla y usa `persistirConfigReglas`, el mismo guardado del constructor. Si las cuatro cosas de un color están apagadas y vacías, ese color no se escribe. Si la regla queda sin ningún color activo, se borra la clave `seguimiento_correo`.

El bloque del constructor se queda como está. No se le agrega texto en esta entrega. Los avisos en las tarjetas del Motor quedan para después.

Solo Administrador ve el botón y puede guardar. La clase `solo-admin-reglas` ya hace eso. El botón "Nueva Regla" de `pac_seccion.html` no se toca.

## 3. Fases

### F1 — Cuadro en la bandeja
- **Archivos:** `Index.html` solo agrega el botón en `#page-alertas`, con clase `solo-admin-reglas`, junto a Enviar reporte. El cuadro y el guardado van en `app_reglas_editor_js.html`, donde ya están `persistirConfigReglas` y `leerSeguimientoCorreo`. `app_alertas_js.html` solo recibe el parámetro opcional de `cargarJSONenPantalla`.
- **Carga:** `cargarJSONenPantalla(alTerminar)` acepta una función opcional. Los `onclick` actuales no le pasan el evento. Si el editor JSON tiene texto distinto de lo guardado, pregunta antes de recargar. Desde la bandeja el loader dice "Cargando reglas...". Al terminar bien, llama `alTerminar`. Si falla, no abre el cuadro y muestra el error.
- **Validar:** no usar `validarReglaCliente` para este guardado. Esa función exige los metadatos del constructor y marcaría "operador desconocido" en reglas que el usuario no abrió. Validar solo `seguimiento_correo`, con las mismas reglas que ya tiene el cliente en el constructor: nota obligatoria si exige comentario, aviso obligatorio si permite no uso, no uso solo si también exige comentario, tope de 600 caracteres. El servidor sigue validando al guardar.
- **Errores:** `persistirConfigReglas` recibe un tercer argumento opcional `{ alExito, alError }`. Si no viene, se comporta como hoy. Si viene, el error se muestra con `showToast` o dentro del cuadro de retroalimentación, no en `#crErrores`, y no intenta cerrar `modalConstructorRegla`. El éxito cierra solo el cuadro de retroalimentación.
- **Borrado:** si un color no tiene casillas ni textos, no se escribe. Si la regla no tiene ningún color activo, se borra `seguimiento_correo`. Es la misma regla que `leerSeguimientoCorreo`, aplicada al objeto del formulario, no leyendo el DOM del constructor.
- **Hecho cuando:** al entrar a Alertas tempranas sin haber abierto el Motor, el Administrador marca Crítica, guarda, vuelve a abrir y la marca sigue. Un color vacío no deja basura en el JSON. Una regla vieja con un criterio raro no impide guardar la retroalimentación de otra.

### F2 — Aviso en las tarjetas
- Diferida. No entra en esta entrega. Si más adelante se hace, solo un aviso en `renderizarTarjetasReglas`: **Pide comentario** o **Permite no uso**.

### F3 — Bitácora
- Entrada corta en `DOCUMENTACION_TECNICA_VIVA.md`. Sin commit y sin `clasp push` salvo que Fabian lo pida.

## 4. Fuera de alcance

- Cambiar el correo, el token, la hoja de seguimiento o los anexos.
- Crear reglas nuevas desde este cuadro. Para eso sigue Nueva regla en el Motor de Reglas.
- Mover el Motor de Reglas de menú.
- Publicar la Web App.

## 5. Prueba

En la URL de desarrollo, con un Administrador, sin abrir antes el Motor de Reglas: entrar a Alertas tempranas, Retroalimentación, activar comentario en Crítica de una regla de prueba, guardar, volver a abrir y ver la misma marca. Si el Modo JSON tiene cambios sin guardar, la recarga pregunta antes de pisarlos.

## 6. Plan conjunto

Auditor: [Claude](dc2fa43d-6335-4b67-b3e9-a008d3bda5ce), 2026-10-18. Veredicto: **APROBAR CON CAMBIOS**. No implementó código. Esta sección manda sobre el resto del archivo.

**Aceptado**

- El botón va en la bandeja, solo para Administrador.
- Se reutiliza `seguimiento_correo` y `persistirConfigReglas`. No hay otro almacén.
- El cuadro se arma en `app_reglas_editor_js.html`.
- `cargarJSONenPantalla` gana un callback opcional.
- Se valida solo el bloque de retroalimentación, no la regla entera.
- Los errores de este guardado no se escriben en el modal cerrado del constructor.
- PAC, el correo y la hoja de seguimiento no se tocan.

**Rechazado para esta entrega**

- Pasar cada regla por `validarReglaCliente`.
- Poner el guardado en `app_alertas_js.html`.
- Los avisos de las tarjetas y la frase nueva dentro del constructor.

**Qué hace el ejecutor**

F1 y F3, como quedaron arriba. F2 no.
