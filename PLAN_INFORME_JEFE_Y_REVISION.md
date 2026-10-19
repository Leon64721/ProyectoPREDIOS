# Plan — Informe a la jefatura y revisión de estado

> Estado: plan conjunto (2026-10-18). La sección 12 manda si algo de arriba dice lo contrario. **No implementar** hasta que Fabian lo pida.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`.
> No hace `clasp push` ni publica la Web App. No cambia el envío por gestor ni la hoja de seguimiento más allá de lo que esta entrega nombra.

## 1. Qué pide Fabian

Los correos a gestor y articulador siguen. Además, la jefatura recibe un informe gerencial del mismo envío: cómo van los vencimientos por articulador y por gestor, quién ha respondido y quién no, cuántos dijeron que no van a usar la regla, y un enlace a cada anexo.

Ese informe lleva un Excel con lo que hoy se adjunta, más la fecha de vencimiento de la alerta. No los días por vencer, porque ese número cambia según el día del reporte.

En el correo a gestor y articulador, el asunto nombra la alerta filtrada. El texto inicial dice, en tono técnico, en qué casos es obligatorio cargar la observación y un solo documento, llamado informe técnico / jurídico. Hoy se exigen dos archivos. Con uno basta.

Si la persona considera que el requisito ya se cumple y lo que falta es actualizar la base, marca **Revisar observación**. Debe escribir la observación, la fecha del documento y dejar claro que la evidencia tiene que estar en los repositorios para poder corroborarla. Esos casos, y solo esos, se envían al correo de quien revisa soportes y actualiza estados. El nombre y el correo de esa persona se piden en el envío, igual que el de la jefatura.

## 2. Qué hace el código hoy

El asunto es fijo: `Alertas Tempranas - gestor [fecha]` o `Informe de Alertas Tempranas [fecha]`. No usa el filtro de regla.

La alerta guarda `DIAS RESTANTES`. Ese número sale de `dias_vida_util` menos los días transcurridos desde `columna_fecha_inicio` (`evaluador_alertas.js`, `_evaluarReglaTiempo`). La hoja `ALERTAS_ACTIVAS` no guarda la fecha de vencimiento. Sumar los días restantes a hoy en el momento del correo reproduce el mismo número que cambia cada día. La fecha estable es la de inicio más la vida útil de la regla, en días calendario o hábiles según `tipo_dias`.

El Excel del correo lo arma `_buildAlertasEmailAttachmentGrid`. No trae fecha de vencimiento ni enlaces de seguimiento.

El formulario pide dos archivos si marcan que no se va a usar. `guardarSeguimientoAlertas` los exige los dos. La jefatura solo recibe correo cuando alguien declara no uso, no un informe del envío.

No hay marca de "revisar observación" ni correo de quien actualiza estados.

En el repositorio no hay un procedimiento del IDU, por tipo de alerta, que se pueda citar como norma. El texto del correo tiene que ser operativo. Fabian lo aprueba antes de que salga. No se inventa un artículo ni una resolución.

## 3. Correo a gestor y articulador

El asunto usa el filtro de regla. Si eligieron una, el asunto lleva ese nombre, por ejemplo `Alerta temprana - Vigencia de avalúo [fecha]`. Si el filtro es todas, el asunto dice `Alerta temprana - Varias reglas [fecha]`. Se quita el emoji.

Arriba del listado, un párrafo fijo:

Equipo de seguimiento predial. Al contrastar la base de datos del tablero con la fecha de inicio y la vida útil de cada alerta, se encuentran los predios de este informe. La novedad es que el término está vencido o próximo a vencer y el estado predial no muestra una actualización posterior. Cuando la alerta lo exige, hay que cargar una observación por cada RT. Si la decisión es que el proceso no se va a usar, se adjunta un solo archivo: el informe técnico / jurídico. Si la gestión o el documento ya existen y lo que falta es actualizar la base, marque Revisar observación, indique la fecha del documento y deje la evidencia cargada en los repositorios institucionales para que pueda corroborarse.

Debajo sigue la nota propia de la regla, si existe.

## 4. Un solo anexo

En el formulario, "No se va a usar" pide un archivo: **Informe técnico / jurídico**. El servidor deja de exigir el segundo. El enlace se guarda en `ARCHIVO_JURIDICO_URL`. `ARCHIVO_TECNICO_URL` se deja vacío para no borrar enlaces viejos. El tope sigue en 5 MB y los mismos tipos: PDF, DOC, DOCX o imagen.

## 5. Revisar observación

En cada RT del formulario hay un control **Revisar observación**. El texto visible dice: la gestión o el documento ya cumplen el requisito, pero la base de datos no está actualizada. Al marcarlo son obligatorios la observación y la fecha del documento. No pide anexo. El texto recuerda que el documento debe estar cargado en los repositorios para corroborar la evidencia.

En el cuadro de Enviar reporte se agregan **Nombre de quien revisa soportes** y **Correo de quien revisa soportes**. Son obligatorios solo si el envío incluye alguna alerta que exige observación. No se guardan en la hoja de usuarios. Se copian a cada fila pendiente de ese envío.

Al oprimir Enviar, las filas marcadas como revisión se escriben en `SEGUIMIENTO_ALERTAS` y, además, sale un correo solo con esas filas al revisor: RT, regla, observación, fecha del documento y el recordatorio de los repositorios. No lleva los RT que no se marcaron. Ese correo no cambia el estado predial. Quien revisa actualiza el estado en la base. El sistema no escribe el estado por su cuenta.

Columnas nuevas, y solo estas: `REVISION_ESTADO`, `FECHA_DOCUMENTO`, `REVISOR_NOMBRE`, `REVISOR_EMAIL`.

## 6. Informe a la jefatura

Usa el correo de jefatura que ya se pide en Enviar reporte. Sale además de los correos a gestores, en el mismo envío, no solo cuando hay no uso.

El cuerpo es gerencial:

- Una tabla por articulador y, dentro, por gestor: cantidad de alertas, cuántas vencen en los próximos 15 días, cuántas entre 16 y 30, cuántas después, y cuántas ya están vencidas. La cuenta usa la fecha de vencimiento, no los días guardados en la hoja.
- Del historial `SEGUIMIENTO_ALERTAS`: cuántas observaciones están respondidas, cuántas siguen pendientes, cuántas dijeron que no se va a usar y cuántas pidieron revisión de estado. Se presenta como acumulado, no como respuesta al correo que se acaba de enviar.
- Los anexos del historial salen como hipervínculo.

El Excel del informe de jefatura tiene dos hojas. La primera repite el detalle actual y agrega `FECHA_VENCIMIENTO`. La segunda trae los totales y las estadísticas. Los correos a gestor y articulador también agregan `FECHA_VENCIMIENTO` a su Excel, para que el dato no viva solo en el informe de la jefatura.

`FECHA_VENCIMIENTO` la calcula el evaluador al generar la alerta: fecha de inicio de la regla más `dias_vida_util`, en calendario o en hábiles según la regla. Se escribe en `ALERTAS_ACTIVAS`. No se arma como "hoy más días restantes" en el momento del correo.

## 7. Fases

### F1 — Asunto, texto y un anexo
- **Archivos:** `Codigo.js` (asuntos y párrafo), `seguimiento_formulario.html`, `seguimiento_alertas.js` (un archivo).
- **Hecho cuando:** un envío filtrado por una regla lleva ese nombre en el asunto, el párrafo inicial está, y no uso guarda con un solo archivo.

### F2 — Revisión de estado
- **Archivos:** `app_alertas_js.html` (nombre y correo del revisor), `seguimiento_formulario.html`, `seguimiento_alertas.js` (columnas y correo al revisor).
- **Hecho cuando:** al marcar Revisar observación sin fecha, no envía. Con fecha, la fila queda en la hoja y el revisor recibe solo esos RT. El estado predial no cambia.

### F3 — Fecha de vencimiento e informe de jefatura
- **Archivos:** `evaluador_alertas.js` (calcula y guarda la fecha), `Codigo.js` (Excel y correo a la jefatura).
- **Hecho cuando:** el Excel muestra una fecha que no cambia al día siguiente si la regla no cambió. El correo a la jefatura trae las tablas y el acumulado de respuestas.

### F4 — Bitácora
- Entrada corta en `DOCUMENTACION_TECNICA_VIVA.md`, firmada Cursor. Sin commit y sin `clasp push`.

## 8. Pruebas

`node --check` en los `.js` tocados y lint del formulario. No hay envío automático de correo. La prueba de la fecha se hace con una fila ficticia de inicio y vida útil, sin leer la hoja real.

## 9. Fuera de alcance

- No actualizar solo el estado predial desde este formulario.
- No citar normas del IDU que no estén en el repositorio.
- No quitar el correo al gestor ni el de no uso a la jefatura.
- No publicar la Web App en esta entrega.
- No hacer gráficas como imagen adjunta. Las tablas del correo y la hoja de totales del Excel son el análisis.

## 10. Riesgos

- Una regla de días hábiles sin festivos bien cargados mueve la fecha de vencimiento. Se usa el mismo cálculo de hábiles que ya tiene el motor.
- El acumulado de respuestas mezcla meses. El informe debe decir que es el historial de la hoja, no el resultado de este envío.
- Quien no tiene rol en Permisos sigue sin abrir el formulario.

## 11. Decisiones que quedan para Fabian

1. El correo al revisor informa. Una persona actualiza el estado en la base. El sistema no lo escribe. Si Fabian quiere que el sistema cambie el estado predial, es otro trabajo.
2. El párrafo de la sección 12 es el que saldría en el correo. Fabian puede pedir otro texto antes de programar.

## 12. Plan conjunto

Auditor: [auditor del informe](aa0193e5-cc90-40d9-96bc-639dfe5a4532). Veredicto: aprobar con cambios. Cursor contrastó el dictamen con el código y publica esto como lo que se programa.

### Se acepta

- Los correos a gestor y articulador siguen. El informe de jefatura es un correo más, uno solo por envío, al correo de jefatura que ya se pide. Si ese campo va vacío, los correos a gestores salen igual y el resultado dice que el informe de jefatura no se envió.
- Un solo anexo, el informe técnico / jurídico, en `ARCHIVO_JURIDICO_URL`. `ARCHIVO_TECNICO_URL` queda vacío. Al responder el hilo solo se adjunta el archivo que sí existe. Hoy el código empuja los dos blobs y, con uno solo, el envío falla.
- Revisar observación y No se va a usar no pueden ir marcados en el mismo RT. Revisar observación exige observación y fecha del documento. La fecha no puede ser posterior a hoy. El servidor lo valida. La pantalla también.
- El correo al revisor lleva solo los RT marcados: RT, regla, observación, fecha del documento y el aviso de los repositorios. No cambia el estado predial.
- Columnas nuevas al final de `SEGUIMIENTO_ALERTAS`: `REVISION_ESTADO`, `FECHA_DOCUMENTO`, `REVISOR_NOMBRE`, `REVISOR_EMAIL`. Si la hoja ya existe, se agregan esos encabezados en las columnas que faltan. No se reescriben las columnas viejas. Hoy `_hojaSeguimientoAlertas_` solo escribe encabezados cuando crea la hoja.
- La fecha de vencimiento la calcula el evaluador: fecha de inicio más `dias_vida_util`. En días hábiles se suma con la misma regla de fines de semana y festivos que ya usa `_calcularDiasHabiles`, que hoy solo cuenta hacia atrás. Se guarda en `ALERTAS_ACTIVAS` como `FECHA_VENCIMIENTO`. La fila vacía de "no hay alertas" debe tener el mismo número de columnas que el encabezado. Hoy son 12 valores fijos y un encabezado nuevo la rompe.
- No se vuelve a correr el motor al enviar. La fecha queda escrita en la corrida del motor. Si una fila no la tiene, el Excel dice `Sin fecha`.
- En los Excel, `DIAS RESTANTES` se reemplaza por `FECHA_VENCIMIENTO`. El cuerpo del correo a gestor sigue mostrando los días de vigencia, porque ese número dice la urgencia de hoy. El Excel es el dato que no se mueve.
- El Excel de gestores sigue siendo la tabla HTML de una hoja. El de jefatura es un XLSX de verdad, con dos hojas, porque el adjunto actual no puede tener dos hojas. Se arma en un libro temporal, se exporta y se borra el temporal.
- El asunto sale de las reglas que van en ese correo. Si es una, lleva su nombre: `Alerta temprana - Vigencia de avalúo [fecha]`. Si son varias: `Alerta temprana - Varias reglas [fecha]`. Sin emoji.
- Las estadísticas salen de `SEGUIMIENTO_ALERTAS`, por RT, regla y persona: respondidas, pendientes, no uso y revisión de estado. El texto dice que es el historial de la hoja, no la respuesta a este envío. Los anexos van como hipervínculo de `ARCHIVO_JURIDICO_URL` en el Excel de jefatura.
- La tabla del correo a jefatura agrupa por articulador y, dentro, por gestor: vencidas, que vencen en 15 días, entre 16 y 30, y después. La cuenta usa `FECHA_VENCIMIENTO`.

### Se rechaza

- Asunto tomado solo del filtro de pantalla. Se usa el nombre de las reglas que realmente van en el correo.
- Dejar `DIAS RESTANTES` en el Excel al lado de la fecha. En el Excel queda la fecha.
- El párrafo que dice que el motor comprobó que el estado predial no está actualizado. El motor no hace esa comprobación.
- Gráficas como imagen. El análisis son las tablas del correo y la segunda hoja del Excel.
- Correr el motor completo antes de cada envío. Esa corrida borra y reescribe `ALERTAS_ACTIVAS`.
- Exigir el correo de jefatura para poder enviar a los gestores.

### Párrafo del correo

Equipo de seguimiento predial. Este informe relaciona los predios que las reglas de alerta temprana marcaron al contrastar la fecha de inicio y la vida útil configuradas en la base de datos del tablero. Junto a cada RT se muestra el estado predial tal como está registrado, para que el equipo verifique si corresponde a la gestión más reciente. Cuando la alerta lo exige, hay que cargar una observación por cada RT. Si la decisión es que el proceso no se va a usar, se adjunta un solo archivo: el informe técnico / jurídico. Si la gestión o el documento ya existen y lo que falta es actualizar la base, marque Revisar observación, indique la fecha del documento y deje la evidencia cargada en los repositorios institucionales para que pueda corroborarse.

### Fases que se programan

1. Asunto, párrafo y un solo anexo, incluido el arreglo de adjuntar solo el archivo que existe.
2. Marca Revisar observación, fecha, columnas nuevas con migración de encabezados, y correo al revisor.
3. Fecha de vencimiento en el evaluador, Excel de gestores con esa fecha, e informe XLSX a la jefatura con tablas y acumulado.
4. Entrada en `DOCUMENTACION_TECNICA_VIVA.md`, firmada Cursor. Sin commit y sin `clasp push` hasta que Fabian lo pida.

## 13. Texto inicial editable en Retroalimentación

Esto ajusta el uso del párrafo de la sección 12. Ese párrafo no se borra: queda como texto base.

En Retroalimentación, cada regla gana un campo **Texto inicial del correo**, encima de los colores. Se guarda en la regla como `texto_inicial_correo`. No va dentro de `seguimiento_correo`, porque ese bloque es por color y este texto es de la alerta completa. Si el campo queda vacío, no se borra el resto de la retroalimentación.

Al armar el correo:

- Si el envío trae una sola regla y esa regla tiene texto, sale ese texto.
- Si no tiene texto, sale el párrafo de la sección 12.
- Si el envío trae varias reglas, el párrafo de la sección 12 sale una vez arriba. Debajo, cada regla que tenga su propio texto lo muestra antes de sus RT. La nota por color (`nota_correo`) sigue donde ya está.

El campo admite hasta 2.000 caracteres. La pantalla y `guardarRetroalimentacionAlertas` lo validan. Un botón **Usar texto base** copia el párrafo de la sección 12 en el campo para poder editarlo. Archivo: `app_reglas_editor_js.html`. El cuerpo del correo, en `Codigo.js`, lee ese campo al enviar.
