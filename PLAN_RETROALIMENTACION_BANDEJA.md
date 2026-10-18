# Plan — Retroalimentación visible en Alertas tempranas

> Estado: plan de Cursor (2026-10-18). Pendiente de auditoría. **No implementar** hasta el plan conjunto.
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

Las tarjetas del Motor de Reglas ganan dos avisos, solo si aplican: **Pide comentario** y **Permite no uso**. El bloque del constructor se queda, con una línea: "También se configura en Alertas tempranas → Retroalimentación."

Solo Administrador ve el botón y puede guardar. La clase `solo-admin-reglas` ya hace eso.

## 3. Fases

### F1 — Cuadro en la bandeja
- **Archivos:** `Index.html` (el botón en `#page-alertas`, junto a Enviar reporte), `app_alertas_js.html` (el cuadro y el guardado).
- **Hacer:** el botón llama `abrirRetroalimentacionAlertas()`. Si `motorReglasData` no está cargado, usa `cargarJSONenPantalla` y al terminar abre el cuadro. No duplicar la lectura de reglas.
- Cada regla sale de `motorReglasData.ReglasDeNegocio`, con su índice. Los textos se leen de `regla.seguimiento_correo`.
- Al guardar, clonar la config, aplicar lo del formulario, pasar cada regla por `validarReglaCliente` y, si no hay errores, `persistirConfigReglas`.
- **Hecho cuando:** en la bandeja, un Administrador abre el cuadro, marca Crítica de una regla, guarda, recarga y la marca sigue. Un color vacío no deja basura en el JSON.

### F2 — Aviso en las tarjetas
- **Archivo:** `app_alertas_js.html`, dentro de `renderizarTarjetasReglas`, y una frase en `asegurarBloqueSeguimiento` de `app_reglas_editor_js.html`.
- **Hecho cuando:** una regla con comentario exigido muestra el aviso en su tarjeta. Una sin `seguimiento_correo` no muestra ninguno.

### F3 — Bitácora
- Entrada corta en `DOCUMENTACION_TECNICA_VIVA.md`. Sin commit y sin `clasp push` salvo que Fabian lo pida.

## 4. Fuera de alcance

- Cambiar el correo, el token, la hoja de seguimiento o los anexos.
- Crear reglas nuevas desde este cuadro. Para eso sigue Nueva regla en el Motor de Reglas.
- Mover el Motor de Reglas de menú.
- Publicar la Web App.

## 5. Prueba

En la URL de desarrollo, con un Administrador: abrir Alertas tempranas, Retroalimentación, activar comentario en Crítica de una regla de prueba, guardar, volver a abrir y ver la misma marca. En Motor de Reglas, la tarjeta de esa regla muestra **Pide comentario**.
