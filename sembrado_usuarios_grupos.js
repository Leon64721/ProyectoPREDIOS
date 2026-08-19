'use strict';

/**
 * ARCHIVO SANITIZADO DE PII [2026-08-19].
 *
 * Este archivo contenía originalmente `DIRECTORIO_OFICIAL_SEMBRADO`: 260 registros
 * con nombre completo + correo institucional de empleados reales del IDU
 * (DTDP/STAP), más `ejecutarSembradoInicialUsuarios()` para cargarlos en la hoja
 * USUARIOS. El archivo fue removido por completo de TODO el historial de git
 * (git filter-repo --path sembrado_usuarios_grupos.js --invert-paths) por
 * privacidad (Ley 1581/2012) antes de evaluar hacer público el repositorio —
 * ver auditoría de seguridad en DOCUMENTACION_TECNICA_VIVA.md. Ningún commit,
 * pasado o presente, contiene ya los datos reales.
 *
 * Al momento de este commit, ejecutarSembradoInicialUsuarios() seguía sin
 * ejecutarse contra producción (ver TODOS.md ítem 18: "EJECUCIÓN PENDIENTE") —
 * la hoja USUARIOS no tiene estos registros cargados todavía.
 *
 * Para volver a sembrar USUARIOS en el futuro: obtener el directorio real desde
 * una fuente segura fuera de Git (ej. Script Properties, un spreadsheet propio, o
 * el backup local pre-limpieza) y reconstruir esta función con esos datos.
 */
const DIRECTORIO_OFICIAL_SEMBRADO = [];
