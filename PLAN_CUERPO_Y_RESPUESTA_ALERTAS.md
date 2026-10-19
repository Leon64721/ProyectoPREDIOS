# Plan — Cuerpo completo y respuesta sin el tablero

> Estado: plan conjunto Cursor + Claude (2026-10-18). Veredicto: APROBAR CON CAMBIOS. La sección 9 manda. **No implementar** hasta que Fabian lo pida.
> Script único: `18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi`.
> Este plan reemplaza el cuerpo descrito en `PLAN_CUERPO_CORREO_ALERTAS.md`. El tope de 40 RT queda anulado.
> No hace `clasp push` ni un despliegue nuevo. No toca el envío por gestor, la hoja `SEGUIMIENTO_ALERTAS`, PAC ni los scopes.

## 1. Qué pidió Fabian después de recibir el correo

El correo de prueba del 2026-10-18 salió. En el cuerpo falta información y sobra un recorte.

- No se resume la lista. Van todos los RT que cumplen el criterio. La frase "Los demás están en el archivo adjunto" no debe aparecer.
- Dentro de cada alerta, los RT se ordenan por vencimiento. En cada uno se ve cuántos días de vigencia quedan, el gestor, el articulador y el estado predial.
- El botón "Cargar observaciones" abre el tablero. No es eso. Debe abrir una ventana solo con los RT que exigen comentario. Ahí se escribe la observación y, si declaran que no se va a usar, los dos soportes son obligatorios para poder guardar. Al guardar se responde el mismo correo y queda escrito en la hoja de seguimiento.

## 2. Qué hace el código hoy

`MAX_RT_CUERPO_ALERTAS` vale 40 en `seguimiento_alertas.js`. `_buildResumenHtmlAgrupado` y `_textoPlanoAlertas_` cortan cada regla y color en 40 y, si sobra aunque sea uno, escriben "Los demás están en el archivo adjunto (N)". Cada RT sale como "RT · proyecto". No muestran días, gestor, articulador ni estado predial. Esas columnas ya vienen en la fila: `DIAS RESTANTES`, `GESTOR_EMAIL`, `ARTICULADOR`, `ARTICULADOR_EMAIL`, `ESTADO PREDIAL ACTUAL`. No hay una fecha de vencimiento distinta de los días restantes.

El botón usa `_urlSeguimientoAlertas_`. La dirección es `ScriptApp.getService().getUrl()`, o sea la Web App publicada (`/exec`), más `?sa=`. `doGet` siempre evalúa `Index.html`, el tablero completo. El cuadro de observaciones vive en `app_seguimiento_alertas_js.html` y solo se intenta abrir después de cargar el tablero. Si la versión publicada es anterior a ese cuadro, el botón deja a la persona en el tablero y nada más.

El guardado ya existe: `guardarSeguimientoAlertas` exige observación en cada RT, exige los dos archivos si marcan no uso, escribe `RESPONDIDA` en `SEGUIMIENTO_ALERTAS`, cierra la fila `PENDIENTE` y responde el hilo con `replyAll`. Si hubo no uso, manda otro correo a la jefatura. Gmail no ejecuta formularios dentro del mensaje: la ventana tiene que ser una página de la Web App, no un formulario metido en el HTML del correo.

## 3. Cuerpo del correo

Se quita el corte de 40. HTML y texto plano listan todos los RT de esa regla y color. Se borra la frase del adjunto. El Excel sigue yendo adjunto, como detalle, sin sustituir la lista.

Dentro de cada regla, los RT se ordenan por `DIAS RESTANTES` de menor a mayor. Un valor que no sea número va al final. Si empatan, se ordena por RT.

Cada renglón lleva:

`RT 55403 · Proyecto · 12 días · Gestor: correo · Articulador: nombre · Estado predial: texto`

El gestor es `GESTOR_EMAIL`, porque la alerta no trae el nombre del gestor. El articulador es el nombre y, si hay correo distinto, también el correo. El estado es `ESTADO PREDIAL ACTUAL`. Si un dato viene vacío, se escribe "sin dato" en ese hueco.

La nota configurada de la regla (`nota_correo`) sigue debajo de sus RT, una sola vez. El botón del final solo aparece si alguna alerta del correo exige comentario y el enlace se pudo armar. El texto del botón pasa a "Responder observaciones".

## 4. Ventana de respuesta

Si `doGet` recibe `sa` con el formato ya validado (`/^[A-Za-z0-9-]{20,64}$/`), no carga `Index.html`. Carga una página nueva, `seguimiento_formulario.html`, sin menú y sin matriz.

Esa página llama a `obtenerSeguimientoPorToken` y pinta solo las filas `PENDIENTE` que esa persona puede ver: su correo es el gestor o el articulador, o es Administrador. Cada fila muestra RT, regla, color, proyecto, días, gestor, articulador y estado predial, la observación anterior si existe, y un cuadro de texto obligatorio.

Si esa regla y color permiten no uso, hay una casilla "No se va a usar". Al marcarla se ven el aviso y dos archivos, jurídico y técnico. Sin los dos archivos y sin la observación, Guardar y enviar no pasa. El servidor ya rechaza ese caso; la página debe decir el mismo error antes de llamar.

El botón se llama "Guardar y enviar". Usa `guardarSeguimientoAlertas`, que ya escribe la hoja y responde el correo. No se duplica esa lógica.

Quien no tiene rol en Permisos sigue sin entrar, igual que hoy. Un token inválido muestra una página corta de enlace inválido, no el tablero.

El cuadro viejo dentro del tablero no se abre cuando la persona llega por `?sa=`, porque ya no carga el tablero. No se borra el módulo de guardado.

## 5. Fases

### F1 — Cuerpo
- **Archivos:** `Codigo.js`, funciones `_buildResumenHtmlAgrupado` y `_textoPlanoAlertas_`. En `seguimiento_alertas.js` se deja de usar `MAX_RT_CUERPO_ALERTAS`.
- **Hecho cuando:** un correo con 41 RT de la misma regla no dice "los demás están en el archivo adjunto" y cada renglón trae días, gestor, articulador y estado predial, ordenados por días.

### F2 — Página de respuesta
- **Archivos:** `seguimiento_formulario.html` nuevo. `Codigo.js` `doGet`, solo el ramal de `sa`. No se cambia `guardarSeguimientoAlertas` ni las columnas de la hoja.
- **Hecho cuando:** abrir `?sa=` en la URL de desarrollo muestra solo el formulario. Guardar y enviar deja la fila respondida y contesta el hilo. Marcar no uso sin los dos archivos no guarda.

### F3 — Bitácora
- Entrada corta en `DOCUMENTACION_TECNICA_VIVA.md`, firmada Cursor. Sin commit y sin `clasp push`.

## 6. Pruebas

Revisión estática del HTML del cuerpo y lint del HTML nuevo. En la URL de desarrollo, después de que Fabian pida la subida: un correo con más de 40 RT de una regla, orden por días, y el enlace abre el formulario. La versión publicada no cambia hasta un despliegue nuevo. Los correos ya enviados apuntan a `/exec`; ese botón seguirá abriendo el tablero publicado hasta ese despliegue.

## 7. Fuera de alcance

- No quitar el Excel adjunto.
- No meter el formulario dentro del HTML del correo.
- No cambiar Para, CC ni el asunto del informe.
- No agregar columnas a `SEGUIMIENTO_ALERTAS`.
- No desplegar la Web App en esta entrega.
- No rehacer las frases fijas del plan anterior del cuerpo. La nota de la regla se mantiene.

## 8. Riesgos

- Un cuerpo con cientos de RT puede acercarse al límite de Gmail. No se vuelve a ocultar RT. Si el envío falla por tamaño, el error se muestra y no se recorta la lista en silencio.
- `getUrl()` sigue siendo la Web App publicada. Hasta el despliegue nuevo, el botón de un correo real abre la versión vieja.
- El gestor se muestra como correo porque la alerta no guarda su nombre.

## 9. Plan conjunto

Auditoría de Claude ([auditoría del cuerpo y la respuesta](0f436508-d65c-4ec0-9dca-0d2b46aae29a)): APROBAR CON CAMBIOS. Queda una decisión abierta: el despliegue. Lo demás queda cerrado con lo que Fabian ya pidió.

**Se acepta**

- El cuerpo lista todos los RT. Se quitan los dos cortes de `MAX_RT_CUERPO_ALERTAS` y la frase del adjunto. El Excel sigue adjunto.
- Dentro de cada regla, orden por días de vigencia, de menor a mayor. Si el número es negativo: "vencido hace N días". Si es cero o positivo: "N días de vigencia". Lo que no sea número va al final.
- Cada renglón del correo lleva gestor (`GESTOR_EMAIL`), articulador y estado predial. Un hueco vacío dice "sin dato".
- La nota de la regla sigue una vez, debajo de sus RT.
- El botón dice "Responder observaciones" y va arriba del listado y también al final, porque Gmail puede recortar un correo muy largo y esconder el final.
- Si `sa` es válido, `doGet` no carga el tablero. Eso ocurre después de comprobar el rol y antes de registrar "Ingreso al Tablero". La página nueva es `seguimiento_formulario.html`.
- La ventana muestra RT, regla, color, proyecto, la observación anterior, el texto nuevo y, si aplica, "No se va a usar". Al marcarla se ve el aviso, la casilla "Leí el aviso" y los dos archivos. Sin observación, sin esa casilla o sin los dos archivos, no guarda. Días, gestor y estado predial se quedan en el correo: la hoja de seguimiento no los tiene y no se le agregan columnas.
- Guardar y enviar sigue siendo `guardarSeguimientoAlertas`: escribe la hoja y responde el hilo. Si el correo de respuesta falla, la página muestra ese aviso y vuelve a leer el token. No pide reenviar, porque la fila ya no está pendiente.
- Quien no tiene rol en Permisos no entra. Eso ya estaba cerrado.
- La lectura de archivos repite las reglas que ya tiene el cuadro actual: PDF, DOC, DOCX o imagen, máximo 5 MB. No depende de las funciones del tablero.

**Se cambia**

- No se prometen días ni estado predial dentro de la ventana.
- No se parte el informe en varios correos si pesa mucho. Van todos los RT. El botón de arriba queda visible si Gmail recorta el final.
- No hay una prueba que envíe correo. Hay una función de editor, solo Administrador, que arma un cuerpo de más de 150 RT ficticios y escribe en el registro si falta alguno, si el orden falló y cuántos caracteres pesa. No llama a Gmail.

**Decisión abierta**

Publicar una versión nueva de la Web App, sobre el mismo `/exec`, para que el botón de los correos ya enviados abra el formulario y no el tablero. El ejecutor no despliega. Fabian lo pide cuando el formulario se haya visto en la URL de desarrollo.

**Qué hace el ejecutor:** F1, F2 y F3, con estos cambios. Nada más.
