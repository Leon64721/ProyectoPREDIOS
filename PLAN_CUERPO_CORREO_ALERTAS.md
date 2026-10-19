# Plan — Texto del correo por alerta

> Estado: plan conjunto Cursor + Claude (2026-10-18). Veredicto: APROBAR CON CAMBIOS. La sección 10 manda. **No implementar** hasta que Fabian lo pida.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`.
> No hace `clasp push` ni `deploy`. No toca el envío (gestor + copia al articulador), la hoja `SEGUIMIENTO_ALERTAS`, el formulario `?sa=`, PAC ni los scopes.

## 1. Qué pide Fabian

Desde Retroalimentación, en Alertas tempranas, poder escribir el texto que sale en el correo cuando esa alerta pide comentario.

El correo debe seguir saliendo como antes: un correo al gestor y copia al articulador. El formato visual debe parecerse al de antes. Lo nuevo es listar los RT de cada alerta, separados si es roja, naranja o amarilla, y decir en ese mismo correo cuáles obligan a comentar y cuáles permiten marcar "no se va a usar" solo como caso excepcional.

## 2. Qué hace el código hoy

El modo `GESTOR_Y_ARTICULADOR` sigue en `procesarReporteAlertas` (`Codigo.js`, cerca de la línea 2199): un correo por `GESTOR_EMAIL` y, si el check está marcado, el articulador en copia. Eso no se cambia.

El cuerpo sí cambió. Antes (`e0fac39`, `_buildResumenHtmlAgrupado`) cada tarjeta era **regla + nivel**, con el articulador y una tabla de gestores y cantidades. No listaba RT. El texto actual lista RT por semáforo y por regla, y perdió esa tarjeta de articulador. Los totales dicen Crítica / Riesgo / Preventiva. El de antes decía ROJO / NARANJA / AMARILLO.

La nota configurable ya existe: `seguimiento_correo.ROJO|NARANJA|AMARILLO.nota_correo`. El cuadro Retroalimentación ya tiene el textarea "Nota que sale en el correo". Si la regla exige comentario, esa nota se imprime una vez, en negrita, debajo de los RT (`_buildResumenHtmlAgrupado`, cerca de la línea 2034). Tope 600 caracteres, ya validado en cliente y en `motor_reglas.js`.

Lo que el correo no dice solo:

- No hay una frase fija de "debes cargar un comentario por cada RT". Si el administrador deja la nota vacía, el guardado lo rechaza; si escribe otra cosa, el correo solo muestra esa nota.
- `texto_no_uso` no sale en el correo. Solo aparece en el formulario, después de marcar la casilla. Quien lee el correo no se entera de que existe el caso excepcional ni de que siguen siendo obligatorios el comentario y los dos soportes.
- El botón dice "Cargar observaciones" y no dice que es obligatorio.

`politicaSeguimientoDeRegla_` ya devuelve `nota_correo` y `texto_no_uso`. No hace falta un campo nuevo en el JSON.

El botón Retroalimentación y estas notas están en el código local. El script de Google todavía no los tiene hasta un `clasp push` que Fabian pida. Este plan no lo hace.

## 3. Redacción que queda mal

El informe se lee como un resumen, no como un pedido. Una persona puede ver la lista de RT y el Excel y no entender que algunas filas exigen comentario en el enlace, y que "no se va a usar" es la excepción, no una salida normal.

Propuesta de frases fijas, iguales para todas las reglas. El administrador no las edita. Van debajo del texto que él escribió:

- Si exige comentario: "Debes cargar un comentario por cada RT de esta alerta. Usa el botón al final de este correo."
- Si además permite no uso: "Solo en caso excepcional puedes marcar que no se va a usar. El comentario sigue siendo obligatorio y debes adjuntar el concepto jurídico y el concepto técnico."
- Después de esa frase, el `texto_no_uso` que configuró (por ejemplo el de avalúo).

El botón del final, solo si alguna alerta del correo exige comentario: "Cargar comentarios obligatorios".

El texto propio de la alerta sigue siendo `nota_correo`, el que se escribe en Retroalimentación. No se crea otro campo.

## 4. Formato

Se conserva la cabecera, la tabla de filtros, el total y el Excel.

Cada tarjeta vuelve a ser una alerta (nombre de la regla) con su color. Orden: roja, naranja, amarilla. La insignia dice las dos formas: "Crítica · roja · 4", "Riesgo · naranja · 2", "Preventiva · amarilla · 1".

Dentro, como antes, un bloque por articulador. En lugar de la tabla de cantidades de gestores, la lista de RT de ese articulador (RT y proyecto). Tope 40 RT por regla y color; el resto sigue en el adjunto. En el modo de un solo correo (`EMAIL_UNICO`) se agrega la línea del gestor encima de sus RT, porque ahí el destinatario no es el gestor.

Debajo de los RT de esa regla y color: el texto configurado, y las frases fijas de la sección 3 solo si la política lo pide. Una alerta sin `exigir_observacion` no lleva esas frases ni entra al botón.

El texto plano (`_textoPlanoAlertas_`) repite lo mismo, sin HTML.

## 5. Dónde se configura

En el cuadro Retroalimentación, el primer textarea pasa a llamarse **Texto de esta alerta en el correo**. El segundo, visible solo si se permite no uso, **Texto del caso excepcional**. Una línea de ayuda: "El sistema añade solo la frase de obligación y el botón. Tú escribes el contenido propio de la alerta."

La misma etiqueta se pone en el bloque "Seguimiento del correo" del constructor, para que los dos sitios digan lo mismo. No se agregan casillas ni campos.

Un color sigue exigiendo la nota si la casilla de comentario está marcada, y el aviso si se permite no uso. Siguen los 600 caracteres.

"Para cada alerta" es cada regla y cada color, no un texto distinto por RT. El mensaje automático de la regla (`MENSAJE`) se queda en el Excel.

## 6. Fases

### F1 — Cuerpo
- **Archivo:** `Codigo.js`, solo `_buildResumenHtmlAgrupado` y `_textoPlanoAlertas_`.
- **Hecho cuando:** un correo de gestor muestra articulador, RT, el texto configurado, la frase de obligación si aplica, la frase de excepción y el aviso si aplica, y un solo botón al final.

### F2 — Etiquetas
- **Archivo:** `app_reglas_editor_js.html`, textos de `pintarYAbrirRetroalimentacion` y de `asegurarBloqueSeguimiento`. Sin lógica nueva de guardado.
- **Hecho cuando:** los dos cuadros nombran igual los dos textos.

### F3 — Bitácora
- Una entrada corta en `DOCUMENTACION_TECNICA_VIVA.md`, firmada Cursor. Sin commit y sin `clasp push`.

## 7. Pruebas

No hay runtime de Apps Script en esta máquina. Revisión estática del HTML generado (escapar RT, proyecto y textos) y lint de `app_reglas_editor_js.html`.

En la URL de desarrollo, cuando Fabian pida la subida: una regla roja con texto de avalúo y no uso, una naranja solo con comentario, una amarilla sin nada. El correo del gestor debe verse como la sección 4. La amarilla no pide comentario. El enlace y la hoja no cambian.

## 8. Fuera de alcance

- No cambiar Para, CC, asunto ni el Excel.
- No un texto distinto por RT.
- No editar las frases fijas desde la pantalla.
- No tocar `seguimiento_alertas.js`, `motor_reglas.js`, el formulario ni PAC.
- No `clasp push` ni deploy en esta entrega.
- No insignias en las tarjetas del Motor (eso quedó fuera en el plan de retroalimentación).

## 9. Riesgos

- Volver a la tarjeta de articulador alarga el correo si un gestor tiene muchos articuladores. El tope de 40 RT por regla y color se mantiene.
- Si `nota_correo` repite la frase fija, el correo se lee dos veces. La ayuda del cuadro lo advierte; no se recorta el texto del administrador.
- Este ajuste no se ve en Google hasta el `clasp push` del botón Retroalimentación y de este cuerpo, en el mismo envío, cuando Fabian lo pida.

## 10. Plan conjunto

Auditoría de Claude ([auditoría del cuerpo](39aee687-6876-47de-aa85-b231f86f54de)): APROBAR CON CAMBIOS. No quedan decisiones abiertas. Lo que sigue reemplaza las secciones 3, 4 y 5 donde choquen.

**Se acepta**

- El envío no cambia: un correo al gestor y copia al articulador.
- Una tarjeta por regla y color, en orden roja, naranja, amarilla, con el bloque del articulador y los RT dentro.
- El texto propio sigue siendo `nota_correo`. No hay campo nuevo. Solo se escribe para las alertas que exigen comentario, que es lo que pidió Fabian.
- Las frases fijas no se editan en pantalla.
- Un solo botón al final, solo si alguna alerta del correo exige comentario y el enlace se pudo armar.
- Mismas etiquetas en Retroalimentación y en el constructor. La ayuda muestra las dos frases que el sistema agrega solo.
- Bitácora corta, sin commit y sin `clasp push`.

**Se cambia respecto del borrador**

- La frase de obligación solo se imprime si hay enlace. Si el enlace no se armó, el correo dice: "Cada RT de esta alerta requiere un comentario. El enlace no pudo armarse; avisa a quien envió este correo." No se menciona un botón que no está.
- La frase, cuando hay enlace, es neutra y sirve para los dos modos: "Cada RT de esta alerta requiere un comentario. El botón al final de este correo abre el formulario."
- El tope de 40 RT es por articulador dentro de la tarjeta, con la línea de "los demás están en el archivo adjunto". Así no se esconde un articulador.
- La insignia dice "Crítica · 4", "Riesgo · 2" o "Preventiva · 1". El color de la tarjeta es el rojo, naranja o amarillo. En los totales: "Crítica (roja)", "Riesgo (naranja)", "Preventiva (amarilla)". No se vuelve a usar ROJO como nombre.
- `texto_no_uso` no se pega en el correo. En el correo va la frase fija del caso excepcional. El aviso largo sigue en el formulario, al marcar la casilla, como ya estaba cerrado. Si el texto de avalúo debe leerse en el correo, se pega en "Texto de esta alerta en el correo".
- No hay vista previa del correo en la pantalla. La redacción se comprueba con un envío de prueba en la URL de desarrollo, cuando se suba.

**Qué hace el ejecutor:** F1, F2 y F3, con estos cambios. Nada más.
